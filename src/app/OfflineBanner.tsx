import { useOnline } from './useOnline';

/**
 * A clearly visible banner shown whenever the device is offline. Orders still
 * work — they are saved locally and synced when the connection returns — so the
 * message reassures the cashier rather than alarming them (spec §2, §9, §13).
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="w-full bg-amber-500 text-amber-950 text-center py-2 px-4 font-semibold text-sm sm:text-base">
      ⚠ Offline — orders are being saved on this device and will sync
      automatically when the internet returns.
    </div>
  );
}
