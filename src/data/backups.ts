// Daily server backups (stored on Netlify Blobs by the backup-daily function).
import { callFunction } from './api';
import { auth } from '../lib/firebase';

export interface BackupEntry {
  key: string;
  dateKey: string;
}

export async function listBackups(): Promise<BackupEntry[]> {
  const res = await callFunction<{ backups: BackupEntry[] }>('backups', { method: 'GET' });
  return res.backups;
}

export async function backupNow(dateKey: string): Promise<{ orders: number }> {
  return callFunction('backups', { body: { dateKey } });
}

/** Download one backup file to the device. */
export async function downloadBackup(key: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in.');
  const res = await fetch(`/.netlify/functions/backups?key=${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `avis-pos-${key}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
