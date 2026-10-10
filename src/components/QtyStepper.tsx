interface QtyStepperProps {
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

/** Large +/- control for adjusting an order line's quantity instantly (spec §4). */
export function QtyStepper({ qty, onIncrement, onDecrement }: QtyStepperProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="Decrease quantity"
        onClick={onDecrement}
        className="w-11 h-11 rounded-lg bg-stone-100 text-stone-800 text-2xl font-bold grid place-items-center active:bg-stone-200"
      >
        −
      </button>
      <span className="w-9 text-center text-lg font-bold tabular-nums">{qty}</span>
      <button
        aria-label="Increase quantity"
        onClick={onIncrement}
        className="w-11 h-11 rounded-lg bg-tandoori-700 text-white text-2xl font-bold grid place-items-center active:bg-tandoori-800"
      >
        +
      </button>
    </div>
  );
}
