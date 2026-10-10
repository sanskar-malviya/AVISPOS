import { useEffect, useState } from 'react';
import { useOnline } from './useOnline';
import { onSlowNetworkChange } from '../data/orders';

/**
 * A clearly visible banner shown whenever the device is offline, or online but
 * too slow to reach the server. Orders still work either way — they are saved
 * locally and synced when the connection allows — so the message reassures the
 * cashier rather than alarming them (spec §2, §9, §13).
 */
export function OfflineBanner() {
  const online = useOnline();
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowNetworkChange(setSlow), []);

  if (online && !slow) return null;
  return (
    <div className="w-full bg-amber-500 text-amber-950 text-center py-1.5 sm:py-2 px-4 font-semibold text-sm sm:text-base">
      {online
        ? '⚠ Slow internet — sales are saved on this device and sync in the background.'
        : '⚠ Offline — sales are saved on this device and sync automatically when the internet returns.'}
    </div>
  );
}
