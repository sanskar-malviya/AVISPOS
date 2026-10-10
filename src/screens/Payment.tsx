import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { useShopData } from '../app/data';
import { useCart, buildCartLines } from '../store/cartStore';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { submitOrder, recordReprint, type SubmitResult } from '../data/orders';
import { printOrderReceipt, type PrintOutcome } from '../printer';
import { upiProvider } from '../payments/upi';
import { newId } from '../lib/ids';
import { formatINR, sumPaise } from '../lib/money';
import { paymentLabel } from '../lib/format';
import type { Order, PaymentMethod } from '../lib/types';

const AUTO_RETURN_SECONDS = 4;

type PrintState = { state: 'idle' | 'printing' | 'ok' | 'failed'; message: string };

export function Payment() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { products, settings, loading } = useShopData();
  const { qtyByProduct, clear } = useCart();

  // One id per checkout, chosen up front: any retry re-uses it, so the order
  // can never be saved twice (spec §4 "prevent double-submission", §11).
  const [orderId] = useState(() => newId());
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [confirmUpi, setConfirmUpi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [saved, setSaved] = useState<SubmitResult | null>(null);
  const [print, setPrint] = useState<PrintState>({ state: 'idle', message: '' });
  const printedOnce = useRef(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const lines = useMemo(() => buildCartLines(products, qtyByProduct), [products, qtyByProduct]);
  const totalPaise = useMemo(() => sumPaise(lines.map((l) => l.lineTotalPaise)), [lines]);

  // Once the order is saved, empty the cart so it can never be paid twice.
  useEffect(() => {
    if (saved) clear();
  }, [saved, clear]);

  // Auto-return to a fresh billing screen after a successful print.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  if (loading) {
    return <div className="h-full grid place-items-center text-stone-400">Loading…</div>;
  }
  // Nothing to pay for (e.g. opened /payment directly) → back to billing.
  if (!saved && lines.length === 0) return <Navigate to="/" replace />;

  async function doPrint(order: Order, forceBrowser = false): Promise<PrintOutcome> {
    setPrint({ state: 'printing', message: 'Printing…' });
    // A copy printed after one already succeeded is a duplicate → mark REPRINT.
    const isReprint = printedOnce.current;
    const res = await printOrderReceipt(order, settings, { forceBrowser, reprint: isReprint });
    if (res.ok) {
      if (isReprint) recordReprint(order.id).catch(() => undefined);
      printedOnce.current = true;
      setPrint({ state: 'ok', message: res.message });
    } else {
      setPrint({ state: 'failed', message: res.message });
    }
    return res;
  }

  async function confirmPayment(m: PaymentMethod) {
    if (submittingRef.current || saved || !user) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitOrder(
        orderId,
        { items: lines, subtotalPaise: totalPaise, grandTotalPaise: totalPaise, paymentMethod: m },
        { cashierUid: user.uid },
      );
      // The cart is cleared by an effect once `saved` has committed (see
      // below). Clearing it here would re-render this screen with an empty
      // cart *before* `saved` is applied and bounce back to billing.
      setSaved(result);
      if (settings.printer.type !== 'none') {
        const res = await doPrint(result.order);
        if (res.ok && res.method === 'bluetooth') setCountdown(AUTO_RETURN_SECONDS);
      }
    } catch (e) {
      // Same orderId is kept, so tapping again cannot create a duplicate.
      submittingRef.current = false;
      toast.error(
        `Could not save the order (${e instanceof Error ? e.message : 'unknown error'}). ` +
          'Tap the button again to retry — it will not be saved twice.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── SUCCESS VIEW ───────────────────────────────────────────────────────────
  if (saved) {
    const order = saved.order;
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 grid md:grid-cols-2 gap-6 items-start">
          <div className="card p-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-veg-600 text-white grid place-items-center text-5xl">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-stone-900">Payment received</h1>
            <p className="mt-1 text-stone-600">
              {formatINR(order.grandTotalPaise)} · {paymentLabel(order.paymentMethod)}
            </p>
            <p className="mt-3 text-lg">
              Order No. <span className="font-extrabold">{order.orderNumber}</span>
            </p>

            {saved.provisional && (
              <p className="mt-3 text-sm font-semibold text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                Saved on this device (offline). It will sync automatically when the internet
                returns — no need to re-enter it.
              </p>
            )}

            <div
              className={
                'mt-4 rounded-lg px-3 py-2 text-sm font-semibold ' +
                (print.state === 'ok'
                  ? 'bg-green-50 text-veg-600'
                  : print.state === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-stone-50 text-stone-600')
              }
              role="status"
            >
              {print.state === 'idle'
                ? settings.printer.type === 'none'
                  ? 'No printer set up — tap Print Receipt to print via the browser.'
                  : 'Preparing receipt…'
                : print.message}
            </div>

            <div className="mt-5 grid gap-3">
              <button
                className="btn-secondary h-14 text-lg"
                disabled={print.state === 'printing'}
                onClick={() => {
                  setCountdown(null);
                  void doPrint(order, settings.printer.type === 'none');
                }}
              >
                {print.state === 'failed' ? 'Retry Print' : 'Print Receipt'}
              </button>
              {print.state === 'failed' && settings.printer.type === 'bluetooth' && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setCountdown(null);
                    void doPrint(order, true);
                  }}
                >
                  Print with browser instead
                </button>
              )}
              <button
                className="btn-primary h-16 text-xl"
                onClick={() => navigate('/', { replace: true })}
              >
                New Order{countdown !== null ? ` (${countdown})` : ''}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <ReceiptPreview order={order} settings={settings} />
          </div>
        </div>
      </div>
    );
  }

  // ── CHECKOUT VIEW ──────────────────────────────────────────────────────────
  const shortRef = orderId.slice(0, 6).toUpperCase();
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <button
          className="btn-ghost -ml-2 mb-3"
          onClick={() => navigate('/')}
          disabled={submitting}
        >
          ← Back to Order
        </button>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Order summary */}
          <div className="card p-5">
            <div className="flex items-baseline justify-between">
              <h1 className="text-xl font-extrabold">Order Ref #{shortRef}</h1>
              <span className="text-xs text-stone-500">Order No. assigned on payment</span>
            </div>
            <ul className="mt-4 divide-y divide-stone-100">
              {lines.map((l) => (
                <li key={l.productId} className="py-2 flex justify-between gap-3">
                  <span>
                    <span className="font-semibold">{l.name}</span>
                    <span className="text-stone-500"> × {l.qty}</span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatINR(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t-2 border-stone-200 flex items-baseline justify-between">
              <span className="text-lg font-semibold text-stone-600">Amount payable</span>
              <span className="text-4xl font-extrabold tabular-nums">{formatINR(totalPaise)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="card p-5">
            <h2 className="text-lg font-extrabold mb-3">Payment method</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['cash', 'upi'] as const).map((m) => (
                <button
                  key={m}
                  disabled={submitting}
                  onClick={() => setMethod(m)}
                  className={
                    'h-24 rounded-2xl border-4 text-2xl font-extrabold flex flex-col items-center justify-center gap-1 ' +
                    (method === m
                      ? 'border-tandoori-700 bg-tandoori-700 text-white'
                      : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300')
                  }
                >
                  <span aria-hidden>{m === 'cash' ? '💵' : '📱'}</span>
                  {m === 'cash' ? 'Cash' : 'UPI'}
                </button>
              ))}
            </div>

            {method === 'cash' && (
              <div className="mt-5">
                <p className="text-stone-700">
                  Collect <strong>{formatINR(totalPaise)}</strong> in cash from the customer.
                </p>
                <button
                  className="btn-primary w-full h-16 text-xl mt-3"
                  disabled={submitting}
                  onClick={() => confirmPayment('cash')}
                >
                  {submitting ? 'Saving…' : 'Cash Received — Complete'}
                </button>
              </div>
            )}

            {method === 'upi' && (
              <div className="mt-5">
                <p className="text-stone-700">
                  Ask the customer to pay <strong>{formatINR(totalPaise)}</strong> by UPI. Wait until
                  your UPI app or sound box confirms the payment.
                </p>
                <button
                  className="btn-primary w-full h-16 text-xl mt-3"
                  disabled={submitting}
                  onClick={() => {
                    // Manual mode: selecting UPI never marks the order paid —
                    // the cashier must explicitly confirm (spec §5, test 8).
                    if (upiProvider.mode === 'manual') setConfirmUpi(true);
                  }}
                >
                  {submitting ? 'Saving…' : 'Customer Has Paid — Complete'}
                </button>
              </div>
            )}

            {!method && (
              <p className="mt-5 text-stone-500 text-sm">Choose Cash or UPI to continue.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmUpi}
        title="UPI payment received?"
        message={
          <>
            Only confirm after you have seen the <strong>{formatINR(totalPaise)}</strong> payment
            succeed on your UPI app or sound box.
          </>
        }
        confirmLabel="Yes, payment received"
        cancelLabel="Not yet"
        onConfirm={() => {
          setConfirmUpi(false);
          void confirmPayment('upi');
        }}
        onCancel={() => setConfirmUpi(false)}
      />
    </div>
  );
}
