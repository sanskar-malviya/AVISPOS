import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useShopData } from '../app/data';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { tokenFor } from '../printer/receipt';
import {
  changeOrderStatus,
  changePaymentMethod,
  recordReprint,
  subscribeOrder,
} from '../data/orders';
import { printOrderReceipt, printTokenSlip } from '../printer';
import { formatINR, paiseToRupees } from '../lib/money';
import { formatDateTime, orderTime, paymentLabel } from '../lib/format';
import type { Order, PaymentMethod } from '../lib/types';

type StatusAction = 'cancelled' | 'refunded';

export function OrderDetail() {
  const { id = '' } = useParams();
  const { settings } = useShopData();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printMsg, setPrintMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [payTo, setPayTo] = useState<PaymentMethod | null>(null);
  const [payNote, setPayNote] = useState('');
  const [refundRupees, setRefundRupees] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');

  useEffect(
    () =>
      subscribeOrder(
        id,
        (o, p) => {
          setOrder(o);
          setPending(p);
        },
        (e) => setError(e.message),
      ),
    [id],
  );

  if (error) return <p className="p-6 text-red-700 font-semibold">Could not load order: {error}</p>;
  if (order === undefined) return <p className="p-6 text-stone-400">Loading…</p>;
  if (order === null)
    return (
      <div className="p-6">
        <p className="font-semibold">Order not found.</p>
        <Link to="/orders" className="text-tandoori-700 font-semibold">
          ← Back to orders
        </Link>
      </div>
    );

  const current = order;

  async function reprint() {
    setPrinting(true);
    setPrintMsg(null);
    // A reprint only re-sends the existing receipt — it never creates a sale.
    const res = await printOrderReceipt(current, settings, {
      reprint: true,
      forceBrowser: settings.printer.type === 'none',
    });
    if (res.ok) recordReprint(current.id).catch(() => undefined);
    setPrintMsg({ ok: res.ok, text: res.message });
    setPrinting(false);
  }

  async function reprintToken() {
    setPrinting(true);
    setPrintMsg(null);
    const res = await printTokenSlip(current, settings, {
      reprint: true,
      forceBrowser: settings.printer.type === 'none',
    });
    setPrintMsg({ ok: res.ok, text: res.message });
    setPrinting(false);
  }

  const refundPaise = Math.round(Number(refundRupees) * 100);
  const refundValid =
    Number.isInteger(Number(refundRupees)) && refundPaise >= 100 && refundPaise <= current.grandTotalPaise;

  function startRefund() {
    setRefundRupees(String(paiseToRupees(current.grandTotalPaise)));
    setRefundMethod(current.paymentMethod);
    setAction('refunded');
  }

  async function applyStatus() {
    if (!action) return;
    if (!reason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }
    if (action === 'refunded' && !refundValid) {
      toast.error(`Enter a whole-rupee refund between ₹1 and ${formatINR(current.grandTotalPaise)}.`);
      return;
    }
    setSaving(true);
    try {
      await changeOrderStatus(
        current,
        action,
        reason,
        action === 'refunded' ? { refundPaise, refundMethod } : undefined,
      );
      toast.success(
        action === 'cancelled'
          ? 'Order cancelled'
          : `Refund of ${formatINR(refundPaise)} by ${paymentLabel(refundMethod)} recorded`,
      );
      setAction(null);
      setReason('');
    } catch (e) {
      toast.error(`Could not update the order: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  async function applyPayment() {
    if (!payTo) return;
    setSaving(true);
    try {
      await changePaymentMethod(current, payTo, payNote);
      toast.success(`Payment changed to ${paymentLabel(payTo)}`);
      setPayTo(null);
      setPayNote('');
    } catch (e) {
      toast.error(`Could not update the order: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  const otherMethod: PaymentMethod = current.paymentMethod === 'upi' ? 'cash' : 'upi';

  const rows: [string, string][] = [
    ['Order No.', current.orderNumber],
    ['Token No.', tokenFor(current)],
    // Online orders also keep a backup number (used only if the server was too
    // slow); show it just for orders that were really sold offline.
    ...(current.provisionalNumber && current.source === 'offline'
      ? ([['Offline receipt no.', current.provisionalNumber]] as [string, string][])
      : []),
    ['Date & time', formatDateTime(orderTime(current))],
    [
      'Payment',
      `${paymentLabel(current.paymentMethod)} · ${current.paymentStatus}` +
        (current.paymentCorrected ? ' (corrected by owner)' : ''),
    ],
    ['Status', current.status + (current.statusReason ? ` — ${current.statusReason}` : '')],
    ...(current.status === 'refunded'
      ? ([
          [
            'Refund',
            `${formatINR(current.refundPaise ?? current.grandTotalPaise)} given back by ${paymentLabel(
              current.refundMethod ?? current.paymentMethod,
            )}`,
          ],
        ] as [string, string][])
      : []),
    ['Receipt reprints', String(current.reprintCount)],
    ['Sync', pending ? 'Waiting to sync (saved on device)' : 'Saved to cloud'],
    [
      'Server check',
      !current.checked ? 'Pending' : current.validationErrors.length ? 'Problem found' : 'Verified',
    ],
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <Link to="/orders" className="btn-ghost -ml-2 mb-3">
          ← Back to orders
        </Link>

        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="card p-5">
              <h1 className="text-xl font-extrabold mb-3">Order details</h1>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-stone-500 font-semibold">{k}</dt>
                    <dd className="font-semibold break-words">{v}</dd>
                  </div>
                ))}
              </dl>

              {current.validationErrors.length > 0 && (
                <div className="mt-3 text-sm bg-red-50 text-red-800 rounded-lg p-3">
                  <p className="font-bold">The server flagged this order:</p>
                  <ul className="list-disc ml-5">
                    {current.validationErrors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <table className="w-full mt-4 text-sm">
                <thead>
                  <tr className="text-left text-stone-500">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-right">Price</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {current.items.map((i) => (
                    <tr key={i.productId} className="border-t border-stone-100">
                      <td className="py-1.5">{i.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatINR(i.unitPricePaise)}</td>
                      <td className="py-1.5 text-right tabular-nums">{i.qty}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatINR(i.lineTotalPaise)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-stone-200 font-extrabold">
                    <td className="py-2" colSpan={3}>
                      Total
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatINR(current.grandTotalPaise)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card p-5 space-y-3">
              <button className="btn-primary w-full h-14 text-lg" onClick={reprint} disabled={printing}>
                {printing ? 'Printing…' : '🖨 Reprint Receipt'}
              </button>
              <button className="btn-secondary w-full h-12" onClick={reprintToken} disabled={printing}>
                Reprint Token
              </button>
              {printMsg && (
                <p
                  className={
                    'text-sm font-semibold rounded-lg px-3 py-2 ' +
                    (printMsg.ok ? 'bg-green-50 text-veg-600' : 'bg-red-50 text-red-700')
                  }
                >
                  {printMsg.text}
                </p>
              )}
              {current.status === 'completed' && (
                <>
                  <button
                    className="btn-secondary w-full h-12"
                    onClick={() => setPayTo(otherMethod)}
                  >
                    Change payment to {paymentLabel(otherMethod)}
                  </button>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                    <button className="btn-danger" onClick={() => setAction('cancelled')}>
                      Cancel order
                    </button>
                    <button className="btn-danger" onClick={startRefund}>
                      Mark refunded
                    </button>
                  </div>
                </>
              )}
              <p className="text-xs text-stone-500">
                Sales are never deleted. Cancelled orders stay in history but are excluded from
                sales totals. A refund records how much went back and whether it was given in cash
                or by UPI, so the Cash and UPI figures stay right. Changing the payment method only
                moves the amount between the Cash and UPI totals. Every change is recorded in the
                audit log.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <ReceiptPreview order={current} settings={settings} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={action === 'cancelled' ? 'Cancel this order?' : 'Mark this order as refunded?'}
        danger
        confirmLabel={saving ? 'Saving…' : action === 'cancelled' ? 'Cancel order' : 'Mark refunded'}
        cancelLabel="Keep order"
        message={
          <div>
            {action === 'cancelled' ? (
              <p>
                {formatINR(current.grandTotalPaise)} will be removed from sales totals. This is
                recorded in the audit log.
              </p>
            ) : (
              <>
                <p>
                  The customer paid {formatINR(current.grandTotalPaise)} by{' '}
                  {paymentLabel(current.paymentMethod)}. Enter how much you gave back and how.
                </p>
                <label className="block text-sm font-semibold text-stone-700 mt-3 mb-1">
                  Refund amount (₹)
                </label>
                <input
                  className="input w-full"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={paiseToRupees(current.grandTotalPaise)}
                  step={1}
                  value={refundRupees}
                  onChange={(e) => setRefundRupees(e.target.value)}
                />
                <span className="block text-sm font-semibold text-stone-700 mt-3 mb-1">
                  Refund given by
                </span>
                <div className="flex gap-2">
                  {(['cash', 'upi'] as PaymentMethod[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      aria-pressed={refundMethod === m}
                      onClick={() => setRefundMethod(m)}
                      className={
                        'btn flex-1 min-h-0 py-2 border-2 ' +
                        (refundMethod === m
                          ? 'border-tandoori-700 bg-tandoori-700 text-white'
                          : 'border-stone-200 bg-white')
                      }
                    >
                      {paymentLabel(m)}
                    </button>
                  ))}
                </div>
                {refundValid && (
                  <p className="text-xs text-stone-600 mt-2">
                    {formatINR(refundPaise)} will be taken off the{' '}
                    <strong>{paymentLabel(refundMethod)}</strong> total
                    {refundPaise < current.grandTotalPaise
                      ? `; the remaining ${formatINR(current.grandTotalPaise - refundPaise)} stays as sales.`
                      : '.'}
                  </p>
                )}
              </>
            )}
            <label className="block text-sm font-semibold text-stone-700 mt-3 mb-1">Reason</label>
            <textarea
              className="input w-full"
              rows={2}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer changed mind"
            />
          </div>
        }
        onConfirm={() => void applyStatus()}
        onCancel={() => {
          setAction(null);
          setReason('');
        }}
      />

      <ConfirmDialog
        open={payTo !== null}
        title={`Change payment to ${payTo ? paymentLabel(payTo) : ''}?`}
        confirmLabel={saving ? 'Saving…' : `Change to ${payTo ? paymentLabel(payTo) : ''}`}
        cancelLabel="Keep as is"
        message={
          <div>
            <p>
              {formatINR(current.grandTotalPaise)} will be counted as{' '}
              <strong>{payTo ? paymentLabel(payTo) : ''}</strong> instead of{' '}
              {paymentLabel(current.paymentMethod)} in the sales totals. The total and the items
              don't change. This is recorded in the audit log.
            </p>
            <label className="block text-sm font-semibold text-stone-700 mt-3 mb-1">
              Note (optional)
            </label>
            <textarea
              className="input w-full"
              rows={2}
              maxLength={200}
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="e.g. UPI failed, customer paid cash"
            />
          </div>
        }
        onConfirm={() => {
          if (!saving) void applyPayment();
        }}
        onCancel={() => {
          if (saving) return;
          setPayTo(null);
          setPayNote('');
        }}
      />
    </div>
  );
}
