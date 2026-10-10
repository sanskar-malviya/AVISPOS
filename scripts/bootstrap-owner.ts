// Create (or promote) the FIRST owner account. Run once after setting up the
// Firebase project; after that, the owner adds staff from Settings → PIN & staff.
//
//   npm run bootstrap-owner -- owner@example.com "a-strong-password"
//   npm run bootstrap-owner -- owner@example.com "a-strong-password" --emulator
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { args, initAdmin } from './admin';

async function main() {
  const [email, password] = args();
  if (!email || !password) {
    console.error('Usage: npm run bootstrap-owner -- <email> <password> [--emulator]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Use a password of at least 8 characters.');
    process.exit(1);
  }
  initAdmin();
  const auth = getAuth();

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { password, disabled: false });
    console.log(`Updated existing user ${email}`);
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/user-not-found') throw e;
    uid = (await auth.createUser({ email, password })).uid;
    console.log(`Created user ${email}`);
  }

  await auth.setCustomUserClaims(uid, { role: 'owner' });
  await getFirestore().collection('users').doc(uid).set({ email, role: 'owner', disabled: false });
  console.log(`✔ ${email} is now an OWNER. Sign in to the POS with this account.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
