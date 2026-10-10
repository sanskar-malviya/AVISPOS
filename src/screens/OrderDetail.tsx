import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useShopData } from '../app/data';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { changeOrderStatus, recordReprint, subscribeOrder } from '../data/orders';
import { printOrderReceipt } from '../printer';
import { formatINR } from '../lib/money';
import { formatDateTime, orderTime, paymentLabel } from '../lib/format';
import type { Order } from '../lib/types';

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

  async function applyStatus() {
    if (!action) return;
    if (!reason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }
    setSaving(true);
    try {
      await changeOrderStatus(current, action, reason);
      toast.success(action === 'cancelled' ? 'Order cancelled' : 'Order marked as refunded');
      setAction(null);
      setReason('');
    } catch (e) {
      toast.error(`Could not update the order: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string][] = [
    ['Order No.', current.orderNumber],
    ...(current.provisionalNumber
      ? ([['Offline receipt no.', current.provisionalNumber]] as [string, string][])
      : []),
    ['Date & time', formatDateTime(orderTime(current))],
    ['Payment', `${paymentLabel(current.paymentMethod)} · ${current.paymentStatus}`],
    ['Status', current.status + (current.statusReason ? ` — ${current.statusReason}` : '')],
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
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-100">
                  <button className="btn-danger" onClick={() => setAction('cancelled')}>
                    Cancel order
                  </button>
                  <button className="btn-danger" onClick={() => setAction('refunded')}>
                    Mark refunded
                  </button>
                </div>
              )}
              <p className="text-xs text-stone-500">
                Sales are never deleted. Cancelled and refunded orders stay in history but are
                excluded from sales totals, and every change is recorded in the audit log.
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
            <p>
              {formatINR(current.grandTotalPaise)} will be removed from sales totals. This is
              recorded in the audit log.
            </p>
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
    </div>
  );
}
