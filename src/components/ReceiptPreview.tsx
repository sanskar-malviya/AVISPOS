import type { BusinessSettings, Order } from '../lib/types';
import { buildReceiptLines, columnsFor } from '../printer/receipt';
import { LOGO_URL } from '../printer/logo';

const block = (e: { preventDefault: () => void }) => e.preventDefault();

/**
 * On-screen receipt, rendered from the exact same layout used for printing.
 * Shows the shop logo with a faint copy behind the items, and the text can't
 * be selected, copied or dragged out.
 */
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
      className="relative overflow-hidden bg-white shadow-md border border-stone-200 rounded-sm mx-auto py-4 px-3 font-mono text-[12px] leading-[1.35] text-black select-none"
      style={{ width: `calc(${cols}ch + 1.5rem)`, WebkitTouchCallout: 'none' }}
      aria-label="Receipt preview"
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      {settings.receiptLogo && (
        <>
          <img
            src={LOGO_URL}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 w-[80%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 grayscale"
          />
          <img
            src={LOGO_URL}
            alt=""
            draggable={false}
            className="pointer-events-none relative block mx-auto mb-2 w-[5.5rem] h-[5.5rem] rounded-full"
          />
        </>
      )}
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            'relative ' +
            (l.align === 'center' ? 'text-center whitespace-pre-wrap ' : 'whitespace-pre ') +
            (l.bold ? 'font-bold ' : '') +
            (l.large ? 'text-[15px] ' : '')
          }
        >
          {l.text || ' '}
        </div>
      ))}
    </div>
  );
}
