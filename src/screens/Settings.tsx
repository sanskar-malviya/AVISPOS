import { useCallback, useEffect, useState } from 'react';
import { getOwnerPinHash, hashPin } from '../data/settings';
import { ProductsTab } from './settings/ProductsTab';
import { BusinessTab } from './settings/BusinessTab';
import { PrinterTab } from './settings/PrinterTab';
import { SecurityTab } from './settings/SecurityTab';

type Tab = 'products' | 'business' | 'printer' | 'security';
const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'business', label: 'Business & receipt' },
  { id: 'printer', label: 'Printer' },
  { id: 'security', label: 'PIN, staff & backups' },
];

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function PinPad({ pinHash, onUnlock }: { pinHash: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [, force] = useState(0);

  // Re-render once per second while in lockout so the countdown updates.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const lockedFor = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));

  async function submit(value: string) {
    if (lockedFor > 0 || value.length < 4) return;
    if ((await hashPin(value)) === pinHash) {
      onUnlock();
      return;
    }
    const n = attempts + 1;
    setAttempts(n);
    setPin('');
    if (n >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_MS);
      setAttempts(0);
      setError('Too many wrong attempts. Please wait 30 seconds.');
    } else {
      setError(`Wrong PIN (${MAX_ATTEMPTS - n} attempts left)`);
    }
  }

  function press(d: string) {
    if (lockedFor > 0) return;
    setError('');
    setPin((p) => (p.length < 6 ? p + d : p));
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
  return (
    <div className="h-full grid place-items-center p-4">
      <div className="card p-6 w-[min(92vw,22rem)] text-center">
        <h1 className="text-xl font-extrabold">Owner PIN</h1>
        <p className="text-sm text-stone-500">Enter the PIN to open Settings</p>
        <div className="my-5 flex justify-center gap-3 h-5" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={'w-4 h-4 rounded-full ' + (i < pin.length ? 'bg-tandoori-700' : 'bg-stone-200')}
            />
          ))}
        </div>
        <p className="min-h-[1.25rem] text-sm font-semibold text-red-700">
          {lockedFor > 0 ? `Locked — try again in ${lockedFor}s` : error}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <button
              key={k}
              disabled={lockedFor > 0}
              onClick={() => {
                if (k === '⌫') setPin((p) => p.slice(0, -1));
                else if (k === '✓') void submit(pin);
                else press(k);
              }}
              className={
                'h-16 rounded-xl text-2xl font-bold disabled:opacity-40 ' +
                (k === '✓'
                  ? 'bg-tandoori-700 text-white active:bg-tandoori-800'
                  : 'bg-stone-100 active:bg-stone-200')
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const [state, setState] = useState<'checking' | 'locked' | 'unlocked' | 'error'>('checking');
  const [pinHash, setPinHash] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('products');

  // The PIN is asked on every visit (unlock state lives only in this
  // component), so an owner who walks away doesn't leave Settings open.
  const load = useCallback(async () => {
    setState('checking');
    try {
      const h = await getOwnerPinHash();
      setPinHash(h);
      setState(h ? 'locked' : 'unlocked');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'checking') return <p className="p-6 text-stone-400">Loading…</p>;
  if (state === 'error')
    return (
      <div className="p-6">
        <p className="font-semibold text-red-700">Could not open Settings: {error}</p>
        <button className="btn-secondary mt-3" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  if (state === 'locked') return <PinPad pinHash={pinHash} onUnlock={() => setState('unlocked')} />;

  return (
    <div className="h-full flex flex-col md:flex-row">
      <nav className="shrink-0 md:w-56 bg-white border-b md:border-b-0 md:border-r border-stone-200 p-3 flex md:flex-col gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={
              'text-left px-4 py-3 rounded-xl font-semibold whitespace-nowrap ' +
              (tab === t.id ? 'bg-tandoori-700 text-white' : 'text-stone-700 hover:bg-stone-100')
            }
          >
            {t.label}
          </button>
        ))}
        {pinHash && (
          <button
            onClick={() => setState('locked')}
            className="md:mt-auto text-left px-4 py-3 rounded-xl font-semibold text-stone-500 hover:bg-stone-100 whitespace-nowrap"
          >
            🔒 Lock settings
          </button>
        )}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {!pinHash && tab !== 'security' && (
          <div className="mb-4 rounded-xl bg-amber-50 text-amber-900 px-4 py-3 text-sm font-semibold">
            No owner PIN is set, so anyone signed in as owner can open Settings. Set one under
            “PIN, staff &amp; backups”.
          </div>
        )}
        {tab === 'products' && <ProductsTab />}
        {tab === 'business' && <BusinessTab />}
        {tab === 'printer' && <PrinterTab />}
        {tab === 'security' && <SecurityTab pinHash={pinHash} onPinChanged={setPinHash} />}
      </div>
    </div>
  );
}
