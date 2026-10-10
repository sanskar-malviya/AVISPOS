import { useEffect, useState } from 'react';
import { useShopData } from '../app/data';
import { useToast } from './Toast';
import {
  connectBluetoothPrinter,
  onPrinterStatus,
  type PrinterStatus,
} from '../printer/bluetooth';

const LABEL: Record<PrinterStatus, string> = {
  unsupported: 'Printer: not supported',
  disconnected: 'Connect printer',
  connecting: 'Connecting…',
  connected: 'Printer ready',
  printing: 'Printing…',
};

/**
 * Top-bar printer status. Shown only when a Bluetooth printer is configured.
 * Tapping it while disconnected opens the Bluetooth picker (browsers require a
 * real tap for this), so the cashier can reconnect in one tap each morning.
 */
export function PrinterButton() {
  const { settings } = useShopData();
  const toast = useToast();
  const [status, setStatus] = useState<PrinterStatus>('disconnected');

  useEffect(() => onPrinterStatus(setStatus), []);

  if (settings.printer.type !== 'bluetooth') return null;

  const ok = status === 'connected' || status === 'printing';
  return (
    <button
      onClick={async () => {
        if (ok || status === 'connecting') return;
        try {
          const name = await connectBluetoothPrinter();
          toast.success(`Printer connected: ${name}`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not connect the printer.');
        }
      }}
      className={
        'text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ' +
        (ok ? 'bg-white/10' : 'bg-amber-400 text-amber-950 hover:bg-amber-300')
      }
      title={settings.printer.deviceName ? `Paired: ${settings.printer.deviceName}` : undefined}
    >
      <span aria-hidden>🖨</span>
      {LABEL[status]}
    </button>
  );
}
