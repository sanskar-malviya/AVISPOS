// Staff account management. Creating users and changing roles needs the
// Firebase Admin SDK, so these call the owner-only `staff` server function.
import { callFunction } from './api';
import type { Role } from '../lib/types';

export interface StaffMember {
  uid: string;
  email: string;
  role: Role | null;
  disabled: boolean;
}

export async function listStaff(): Promise<StaffMember[]> {
  const res = await callFunction<{ staff: StaffMember[] }>('staff', { body: { action: 'list' } });
  return res.staff;
}

export async function createStaffUser(email: string, password: string, role: Role): Promise<void> {
  await callFunction('staff', { body: { action: 'create', email, password, role } });
}

export async function setStaffRole(uid: string, role: Role): Promise<void> {
  await callFunction('staff', { body: { action: 'setRole', uid, role } });
}

export async function setStaffDisabled(uid: string, disabled: boolean): Promise<void> {
  await callFunction('staff', { body: { action: 'setDisabled', uid, disabled } });
}

/** Short message for the owner. */
export function staffErrorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Something went wrong.';
}
