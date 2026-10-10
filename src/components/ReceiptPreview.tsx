import type { BusinessSettings, Order } from '../lib/types';
import { buildReceiptLines, columnsFor } from '../printer/receipt';

/** On-screen receipt, rendered from the exact same layout used for printing. */
export function ReceiptPreview({
  order,
  settings,
  reprint = false,
}: {
  order: Order;
  settings: BusinessSettings;
  reprint?: boolean;
}) {
  const lines = buildReceiptLines(order, settings, { currency: '₹', reprint });
  const cols = columnsFor(settings.paperWidth);
  return (
    <div
      className="bg-white shadow-md border border-stone-200 rounded-sm mx-auto py-4 px-3 font-mono text-[12px] leading-[1.35] text-black"
      style={{ width: `calc(${cols}ch + 1.5rem)` }}
      aria-label="Receipt preview"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            (l.align === 'center' ? 'text-center whitespace-pre-wrap ' : 'whitespace-pre ') +
            (l.bold ? 'font-bold ' : '') +
            (l.large ? 'text-[15px] ' : '')
          }
        >
          {l.text || ' '}
        </div>
      ))}
    </div>
  );
}
