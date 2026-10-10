import type { OrderItem } from '../lib/types';
import { formatINR } from '../lib/money';
import { QtyStepper } from './QtyStepper';

interface OrderPanelProps {
  lines: OrderItem[];
  grandTotalPaise: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onContinue: () => void;
  /** Shown as a "Hide" button when the panel is a pop-up sheet (phones). */
  onClose?: () => void;
}

export function OrderPanel({
  lines,
  grandTotalPaise,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onContinue,
  onClose,
}: OrderPanelProps) {
  const empty = lines.length === 0;

  return (
    <aside className="h-full flex flex-col bg-white border-l border-stone-200">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-200">
        <h2 className="text-lg font-extrabold text-stone-900">Current Order</h2>
        <div className="flex items-center gap-1">
          {!empty && (
            <button
              onClick={onClear}
              className="text-sm font-semibold text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Clear Order
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm font-semibold text-stone-600 px-3 py-1.5 rounded-lg bg-stone-100"
            >
              Hide ▾
            </button>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {empty ? (
          <div className="h-full grid place-items-center text-center px-6 text-stone-400">
            <div>
              <div className="text-5xl mb-3">🛒</div>
              <p className="font-semibold">No items yet</p>
              <p className="text-sm">Tap a dish to start the order.</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {lines.map((line) => (
              <li key={line.productId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-stone-900 truncate">
                      {line.name}
                    </div>
                    <div className="text-sm text-stone-500">
                      {formatINR(line.unitPricePaise)} each
                    </div>
                  </div>
                  <button
                    aria-label={`Remove ${line.name}`}
                    onClick={() => onRemove(line.productId)}
                    className="text-stone-400 hover:text-red-600 text-xl leading-none px-2"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <QtyStepper
                    qty={line.qty}
                    onIncrement={() => onIncrement(line.productId)}
                    onDecrement={() => onDecrement(line.productId)}
                  />
                  <div className="font-extrabold text-stone-900 text-lg tabular-nums">
                    {formatINR(line.lineTotalPaise)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Total + continue */}
      <div className="shrink-0 border-t border-stone-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-stone-600">Total</span>
          <span className="text-3xl font-extrabold text-stone-900 tabular-nums">
            {formatINR(grandTotalPaise)}
          </span>
        </div>
        <button
          className="btn-primary w-full text-lg h-16"
          disabled={empty}
          onClick={onContinue}
        >
          Continue to Payment →
        </button>
      </div>
    </aside>
  );
}
