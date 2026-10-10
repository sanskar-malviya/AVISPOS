import { useEffect, useState } from 'react';
import { useShopData } from '../../app/data';
import { useToast } from '../../components/Toast';
import { saveSettings } from '../../data/settings';
import {
  connectBluetoothPrinter,
  connectedPrinterName,
  disconnectBluetoothPrinter,
  isBluetoothSupported,
  onPrinterStatus,
  type PrinterStatus,
} from '../../printer/bluetooth';
import { printOrderReceipt } from '../../printer';
import { sampleOrder } from '../../lib/sampleOrder';
import type { PrinterConfig } from '../../lib/types';

const OPTIONS: { type: PrinterConfig['type']; title: string; desc: string }[] = [
  {
    type: 'bluetooth',
    title: 'Bluetooth thermal printer (recommended)',
    desc: 'Prints automatically after payment with no dialog. Needs Chrome on Android and a Bluetooth LE (BLE) ESC/POS printer.',
  },
  {
    type: 'browser',
    title: 'Browser print dialog',
    desc: 'Works on any device and printer, but shows the system print dialog every time (one extra tap).',
  },
  {
    type: 'none',
    title: 'No printer',
    desc: 'No automatic printing. Receipts can still be printed manually via the browser.',
  },
];

export function PrinterTab() {
  const { settings } = useShopData();
  const toast = useToast();
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const supported = isBluetoothSupported();

  useEffect(() => onPrinterStatus(setStatus), []);

  async function choose(type: PrinterConfig['type']) {
    try {
      await saveSettings({ printer: { ...settings.printer, type } });
      setTestMsg(null);
    } catch (e) {
      toast.error(`Could not save: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function connect() {
    setBusy(true);
    try {
      const name = await connectBluetoothPrinter();
      await saveSettings({ printer: { type: 'bluetooth', deviceName: name } });
      toast.success(`Connected to ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  }

  async function testPrint() {
    setBusy(true);
    setTestMsg(null);
    const res = await printOrderReceipt(sampleOrder(), settings, {
      forceBrowser: settings.printer.type === 'none',
    });
    setTestMsg({ ok: res.ok, text: res.message });
    setBusy(false);
  }

  const connected = status === 'connected' || status === 'printing';

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-extrabold">Receipt printer</h1>

      <div className="grid gap-3">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            onClick={() => void choose(o.type)}
            className={
              'card p-4 text-left border-2 ' +
              (settings.printer.type === o.type ? 'border-tandoori-700' : 'border-transparent')
            }
          >
            <div className="flex items-center gap-3">
              <span
                className={
                  'w-5 h-5 rounded-full border-2 shrink-0 ' +
                  (settings.printer.type === o.type
                    ? 'border-tandoori-700 bg-tandoori-700 shadow-[inset_0_0_0_3px_white]'
                    : 'border-stone-300')
                }
              />
              <div>
                <div className="font-bold">{o.title}</div>
                <div className="text-sm text-stone-500">{o.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {settings.printer.type === 'bluetooth' && (
        <div className="card p-5 space-y-3">
          {!supported ? (
            <p className="text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-2">
              Bluetooth printing is not available in this browser. Open the POS in Google Chrome on
              the Android tablet (the app must be opened over https). iPad/Safari is not supported —
              use “Browser print dialog” there.
            </p>
          ) : (
            <>
              <p className="font-semibold">
                Status:{' '}
                <span className={connected ? 'text-veg-600' : 'text-amber-700'}>
                  {connected
                    ? `Connected to ${connectedPrinterName()}`
                    : status === 'connecting'
                      ? 'Connecting…'
                      : 'Not connected'}
                </span>
              </p>
              {settings.printer.deviceName && (
                <p className="text-sm text-stone-500">Last paired: {settings.printer.deviceName}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button className="btn-primary" disabled={busy} onClick={() => void connect()}>
                  {connected ? 'Pair a different printer' : 'Connect printer'}
                </button>
                {connected && (
                  <button className="btn-secondary" onClick={disconnectBluetoothPrinter}>
                    Disconnect
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-500">
                Switch the printer on, then tap Connect and pick it from the list. Chrome may ask
                for “Nearby devices” permission — allow it. After restarting the tablet, tap the
                printer button in the top bar once to reconnect.
              </p>
            </>
          )}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <p className="font-semibold">Test print</p>
        <p className="text-sm text-stone-500">
          Prints a sample receipt (no sale is recorded). Paper width: {settings.paperWidth} mm —
          change it under “Business &amp; receipt”.
        </p>
        <button className="btn-secondary" disabled={busy} onClick={() => void testPrint()}>
          {busy ? 'Working…' : '🖨 Print test receipt'}
        </button>
        {testMsg && (
          <p
            className={
              'text-sm font-semibold rounded-lg px-3 py-2 ' +
              (testMsg.ok ? 'bg-green-50 text-veg-600' : 'bg-red-50 text-red-700')
            }
          >
            {testMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}
