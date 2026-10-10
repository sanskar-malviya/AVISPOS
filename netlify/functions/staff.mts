// POST /.netlify/functions/staff — owner-only staff account management.
// Body: { action: 'list' }
//       { action: 'create', email, password, role }
//       { action: 'setRole', uid, role }
//       { action: 'setDisabled', uid, disabled }
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../lib/admin';
import { requireRole, type Role } from '../lib/auth';
import { errorResponse, HttpError, json, readJson } from '../lib/http';

const ROLES: Role[] = ['owner', 'cashier'];

function parseRole(v: unknown): Role {
  if (typeof v === 'string' && (ROLES as string[]).includes(v)) return v as Role;
  throw new HttpError(400, 'Role must be "owner" or "cashier".');
}

function parseUid(v: unknown): string {
  if (typeof v === 'string' && v.length > 0 && v.length <= 128) return v;
  throw new HttpError(400, 'Missing user id.');
}

async function audit(by: string, uid: string, detail: Record<string, unknown>) {
  await adminDb()
    .collection('audit')
    .add({ type: 'role_change', uid, who: by, ...detail, at: FieldValue.serverTimestamp() });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const caller = await requireRole(req, ['owner']);
    const body = await readJson(req);
    const auth = adminAuth();
    const db = adminDb();

    switch (body.action) {
      case 'list': {
        const { users } = await auth.listUsers(1000);
        const staff = users
          .map((u) => {
            const r = u.customClaims?.role;
            return {
              uid: u.uid,
              email: u.email ?? '(no email)',
              role: r === 'owner' || r === 'cashier' ? r : null,
              disabled: u.disabled,
            };
          })
          .sort((a, b) => a.email.localeCompare(b.email));
        return json(200, { staff });
      }

      case 'create': {
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
        if (typeof body.password !== 'string' || body.password.length < 8)
          throw new HttpError(400, 'The password must be at least 8 characters.');
        const role = parseRole(body.role);
        const user = await auth.createUser({ email, password: body.password });
        await auth.setCustomUserClaims(user.uid, { role });
        await db.collection('users').doc(user.uid).set({ email, role, disabled: false });
        await audit(caller.uid, user.uid, { email, action: 'created', role });
        return json(200, { uid: user.uid });
      }

      case 'setRole': {
        const uid = parseUid(body.uid);
        const role = parseRole(body.role);
        if (uid === caller.uid) throw new HttpError(400, 'You cannot change your own role.');
        const user = await auth.getUser(uid);
        await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role });
        await auth.revokeRefreshTokens(uid); // new role applies at next sign-in
        await db.collection('users').doc(uid).set({ email: user.email ?? '', role }, { merge: true });
        await audit(caller.uid, uid, { email: user.email ?? '', action: 'role', role });
        return json(200, { ok: true });
      }

      case 'setDisabled': {
        const uid = parseUid(body.uid);
        const disabled = body.disabled === true;
        if (uid === caller.uid) throw new HttpError(400, 'You cannot disable your own account.');
        const user = await auth.updateUser(uid, { disabled });
        if (disabled) await auth.revokeRefreshTokens(uid);
        await db.collection('users').doc(uid).set({ email: user.email ?? '', disabled }, { merge: true });
        await audit(caller.uid, uid, { email: user.email ?? '', action: disabled ? 'disabled' : 'enabled' });
        return json(200, { ok: true });
      }

      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (e) {
    return errorResponse(e);
  }
};
