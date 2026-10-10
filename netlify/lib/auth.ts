// Verify the caller's Firebase ID token (sent as "Authorization: Bearer <token>")
// and their role custom claim.
import { adminAuth } from './admin';
import { HttpError } from './http';

export type Role = 'owner' | 'cashier';

export interface Caller {
  uid: string;
  email: string;
  role: Role;
}

export async function requireRole(req: Request, allowed: Role[]): Promise<Caller> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please sign in.');

  let decoded;
  try {
    // checkRevoked: a disabled/removed staff member is rejected immediately.
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, 'Your sign-in has expired. Please sign in again.');
  }
  const role = decoded.role;
  if (role !== 'owner' && role !== 'cashier') {
    throw new HttpError(403, 'This account has no POS role yet. Ask the owner to set one.');
  }
  if (!allowed.includes(role)) {
    throw new HttpError(403, 'Only the owner can do this.');
  }
  return { uid: decoded.uid, email: decoded.email ?? '', role };
}
