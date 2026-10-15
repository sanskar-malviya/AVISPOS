import { useEffect, useState } from 'react';
import { useShopData } from '../app/data';
import { useConnectPrinter } from './useConnectPrinter';
import {
  onPrinterStatus,
  reconnectSavedPrinter,
  savedPrinterName,
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
 *
 * When the app opens (and whenever it comes back to the foreground) it first
 * tries to reconnect the last printer silently. The button only turns yellow
 * if that fails; tapping it opens the Bluetooth picker (browsers require a
 * real tap for this).
 */
export function PrinterButton() {
  const { settings } = useShopData();
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const { connect, busy, dialog } = useConnectPrinter();
  const bluetooth = settings.printer.type === 'bluetooth';

  useEffect(() => onPrinterStatus(setStatus), []);

  useEffect(() => {
    if (!bluetooth) return;
    void reconnectSavedPrinter();
    // Printer switched on after the app? Try again each time the tablet wakes
    // or the cashier returns to the app.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reconnectSavedPrinter();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [bluetooth]);

  if (!bluetooth) return null;

  const idle = status === 'disconnected' || status === 'unsupported';
  const paired = settings.printer.deviceName || savedPrinterName();
  return (
    <>
      <button
        onClick={() => {
          if (idle && !busy) void connect();
        }}
        className={
          'text-sm font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap ' +
          (idle ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'bg-white/10')
        }
        aria-label={LABEL[status]}
        title={paired ? `Printer: ${paired}` : LABEL[status]}
      >
        <span aria-hidden>🖨</span>
        {/* On phones the colour alone says it: amber = tap to connect. */}
        <span className="hidden lg:inline">{LABEL[status]}</span>
      </button>
      {dialog}
    </>
  );
}
