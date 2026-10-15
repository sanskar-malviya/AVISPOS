import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
import { connectBluetoothPrinter, NoPrinterSelectedError } from '../printer/bluetooth';

/**
 * The "connect a Bluetooth printer" flow shared by the top-bar button and the
 * Printer settings tab. The first picker lists only thermal printers; if the
 * printer isn't there (some don't advertise their service), a dialog offers
 * "Show all devices", which opens the full list. Render `dialog` somewhere in
 * the tree.
 */
export function useConnectPrinter(onConnected?: (name: string) => void | Promise<void>): {
  connect: () => Promise<void>;
  busy: boolean;
  dialog: ReactNode;
} {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [askAll, setAskAll] = useState(false);

  async function run(allDevices: boolean) {
    setBusy(true);
    try {
      const name = await connectBluetoothPrinter({ allDevices });
      await onConnected?.(name);
      toast.success(`Printer connected: ${name}`);
    } catch (e) {
      if (e instanceof NoPrinterSelectedError && !allDevices) {
        setAskAll(true); // printer not in the short list → offer the full one
      } else {
        toast.error(e instanceof Error ? e.message : 'Could not connect the printer.');
      }
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <ConfirmDialog
      open={askAll}
      title="Printer not in the list?"
      confirmLabel="Show all devices"
      cancelLabel="Close"
      message={
        <p>
          The list showed only Bluetooth thermal printers. If yours wasn't there, make sure it is
          switched on and nearby, then look through all nearby Bluetooth devices.
        </p>
      }
      onConfirm={() => {
        setAskAll(false);
        void run(true); // still inside the tap → the picker is allowed to open
      }}
      onCancel={() => setAskAll(false)}
    />
  );

  return { connect: () => run(false), busy, dialog };
}
