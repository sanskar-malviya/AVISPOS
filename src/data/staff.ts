// Staff account management. Creating users and changing roles needs the Admin
// SDK, so these call owner-only Cloud Functions (never done in the browser).
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import type { Role } from '../lib/types';

export interface StaffMember {
  uid: string;
  email: string;
  role: Role | null;
  disabled: boolean;
}

export async function listStaff(): Promise<StaffMember[]> {
  const res = await httpsCallable<void, { staff: StaffMember[] }>(functions, 'listStaff')();
  return res.data.staff;
}

export async function createStaffUser(email: string, password: string, role: Role): Promise<void> {
  await httpsCallable(functions, 'createStaffUser')({ email, password, role });
}

export async function setStaffRole(uid: string, role: Role): Promise<void> {
  await httpsCallable(functions, 'setStaffRole')({ uid, role });
}

export async function setStaffDisabled(uid: string, disabled: boolean): Promise<void> {
  await httpsCallable(functions, 'setStaffDisabled')({ uid, disabled });
}

/** Turn a Firebase Functions error into a short message for the owner. */
export function staffErrorMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err.code === 'functions/unavailable' || err.code === 'functions/internal')
    return 'The server could not be reached. Staff accounts can only be managed while online.';
  return err.message || 'Something went wrong.';
}
