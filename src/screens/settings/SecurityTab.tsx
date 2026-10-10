import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../app/auth';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { hashPin, setOwnerPinHash } from '../../data/settings';
import {
  createStaffUser,
  listStaff,
  setStaffDisabled,
  setStaffRole,
  staffErrorMessage,
  type StaffMember,
} from '../../data/staff';
import type { Role } from '../../lib/types';

function PinSection({ pinHash, onPinChanged }: { pinHash: string; onPinChanged: (h: string) => void }) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error('The PIN must be 4 to 6 digits.');
      return;
    }
    if (pin !== confirm) {
      toast.error('The two PINs do not match.');
      return;
    }
    setSaving(true);
    try {
      const h = await hashPin(pin);
      await setOwnerPinHash(h);
      onPinChanged(h);
      setPin('');
      setConfirm('');
      toast.success(pinHash ? 'Owner PIN changed' : 'Owner PIN set');
    } catch (err) {
      toast.error(`Could not save the PIN: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSaving(false);
    }
  }

  const pinInput = (value: string, set: (v: string) => void, label: string) => (
    <div>
      <label className="block text-sm font-semibold text-stone-700 mb-1">{label}</label>
      <input
        className="input w-40 tracking-[0.5em] text-center"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ''))}
      />
    </div>
  );

  return (
    <div className="card p-5">
      <h2 className="text-lg font-extrabold">Owner PIN</h2>
      <p className="text-sm text-stone-500 mt-1">
        {pinHash
          ? 'A PIN is set. It is asked every time Settings is opened.'
          : 'No PIN is set. Set one so cashiers cannot open Settings on a tablet left signed in as owner.'}
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        {pinInput(pin, setPin, pinHash ? 'New PIN' : 'PIN (4–6 digits)')}
        {pinInput(confirm, setConfirm, 'Repeat PIN')}
        <button className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : pinHash ? 'Change PIN' : 'Set PIN'}
        </button>
        {pinHash && (
          <button type="button" className="btn-ghost" onClick={() => setConfirmRemove(true)}>
            Remove PIN
          </button>
        )}
      </form>
      <ConfirmDialog
        open={confirmRemove}
        title="Remove the owner PIN?"
        message="Anyone signed in as owner will be able to open Settings without a PIN."
        confirmLabel="Remove PIN"
        danger
        onCancel={() => setConfirmRemove(false)}
        onConfirm={async () => {
          setConfirmRemove(false);
          try {
            await setOwnerPinHash('');
            onPinChanged('');
            toast.success('Owner PIN removed');
          } catch (err) {
            toast.error(`Could not remove the PIN: ${err instanceof Error ? err.message : err}`);
          }
        }}
      />
    </div>
  );
}

function StaffSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      setStaff(await listStaff());
    } catch (e) {
      setLoadError(staffErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error(staffErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Use a password of at least 8 characters.');
      return;
    }
    await act(() => createStaffUser(email.trim(), password, role), `Account created for ${email.trim()}`);
    setEmail('');
    setPassword('');
  }

  return (
    <div className="card p-5">
      <h2 className="text-lg font-extrabold">Staff accounts</h2>
      <p className="text-sm text-stone-500 mt-1">
        Cashiers can only bill. Owners can also see Orders and Settings. After a role change, the
        person must sign out and sign in again.
      </p>

      {loadError ? (
        <div className="mt-3 text-sm text-red-700 font-semibold">
          {loadError}{' '}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : staff === null ? (
        <p className="mt-3 text-stone-400">Loading…</p>
      ) : (
        <ul className="mt-3 divide-y divide-stone-100">
          {staff.map((s) => {
            const self = s.uid === user?.uid;
            return (
              <li key={s.uid} className="py-2.5 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold">
                    {s.email} {self && <span className="text-xs text-stone-500">(you)</span>}
                  </div>
                  <div className="text-xs text-stone-500">
                    {s.role ?? 'no role'}
                    {s.disabled && ' · disabled'}
                  </div>
                </div>
                {!self && (
                  <>
                    <select
                      className="input py-1.5"
                      value={s.role ?? ''}
                      disabled={busy}
                      onChange={(e) =>
                        void act(
                          () => setStaffRole(s.uid, e.target.value as Role),
                          `${s.email} is now ${e.target.value}`,
                        )
                      }
                    >
                      {!s.role && <option value="">— choose —</option>}
                      <option value="cashier">Cashier</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      className={s.disabled ? 'btn-secondary min-h-0 py-2' : 'btn-danger min-h-0 py-2'}
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => setStaffDisabled(s.uid, !s.disabled),
                          s.disabled ? `${s.email} re-enabled` : `${s.email} can no longer sign in`,
                        )
                      }
                    >
                      {s.disabled ? 'Enable' : 'Disable'}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={add} className="mt-5 pt-4 border-t border-stone-100 grid sm:grid-cols-[1fr,1fr,auto,auto] gap-3 items-end">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">Email</label>
          <input
            className="input w-full"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-1">Password</label>
          <input
            className="input w-full"
            type="text"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="cashier">Cashier</option>
          <option value="owner">Owner</option>
        </select>
        <button className="btn-primary" disabled={busy}>
          Add account
        </button>
      </form>
    </div>
  );
}

export function SecurityTab({
  pinHash,
  onPinChanged,
}: {
  pinHash: string;
  onPinChanged: (h: string) => void;
}) {
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-xl font-extrabold">PIN &amp; staff</h1>
      <PinSection pinHash={pinHash} onPinChanged={onPinChanged} />
      <StaffSection />
    </div>
  );
}
