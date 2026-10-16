import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribeOrdersInRange, findByOrderNumber } from '../data/orders';
import { useToast } from '../components/Toast';
import { dateKey } from '../lib/ids';
import { formatINR } from '../lib/money';
import {
  dateKeyToInput,
  formatDateKey,
  formatTime,
  inputToDateKey,
  orderTime,
  paymentLabel,
} from '../lib/format';
import { downloadCsv, ordersToCsv, summarize } from '../lib/reports';
import type { Order } from '../lib/types';

function StatusBadge({ order, pending }: { order: Order; pending: boolean }) {
  if (order.status === 'cancelled')
    return <span className="badge bg-stone-200 text-stone-700">Cancelled</span>;
  if (order.status === 'refunded')
    return <span className="badge bg-purple-100 text-purple-800">Refunded</span>;
  if (pending) return <span className="badge bg-amber-100 text-amber-800">Not synced</span>;
  if (order.validationErrors.length > 0)
    return <span className="badge bg-red-100 text-red-800">⚠ Check</span>;
  return <span className="badge bg-green-100 text-green-800">Paid</span>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// The chosen dates survive opening an order and coming back (and a reload),
// so the owner doesn't have to pick them again. A "today" range follows the
// current day, so the screen isn't stuck on yesterday the next morning.
const RANGE_KEY = 'aviz.orders.range';
const isDk = (v: unknown): v is string => typeof v === 'string' && /^\d{8}$/.test(v);

function loadRange(today: string): { from: string; to: string } {
  try {
    const s = JSON.parse(sessionStorage.getItem(RANGE_KEY) || 'null') as {
      from?: unknown;
      to?: unknown;
      today?: unknown;
    } | null;
    if (s && isDk(s.from) && isDk(s.to) && !(s.from === s.today && s.to === s.today)) {
      return { from: s.from, to: s.to };
    }
  } catch {
    /* ignore */
  }
  return { from: today, to: today };
}

function saveRange(from: string, to: string, today: string) {
  try {
    sessionStorage.setItem(RANGE_KEY, JSON.stringify({ from, to, today }));
  } catch {
    /* ignore */
  }
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm font-semibold text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Orders() {
  const navigate = useNavigate();
  const toast = useToast();
  const today = dateKey();
  const [from, setFrom] = useState(() => loadRange(today).from);
  const [to, setTo] = useState(() => loadRange(today).to);
  useEffect(() => saveRange(from, to, today), [from, to, today]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setLoading(true);
    const [a, b] = from <= to ? [from, to] : [to, from];
    return subscribeOrdersInRange(
      a,
      b,
      (list) => {
        setOrders(list);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [from, to]);

  // Orders still waiting to sync have no server timestamp yet (offline sales).
  const pendingIds = useMemo(
    () => new Set(orders.filter((o) => o.createdAt === null).map((o) => o.id)),
    [orders],
  );

  const summary = useMemo(() => summarize(orders), [orders]);
  const rangeLabel =
    from === to ? formatDateKey(from) : `${formatDateKey(from)} – ${formatDateKey(to)}`;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) || o.provisionalNumber.toLowerCase().includes(q),
    );
  }, [orders, search]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (filtered.length === 1) {
      navigate(`/orders/${filtered[0].id}`);
      return;
    }
    if (filtered.length > 1) return; // already filtered in the list below
    // Not in the selected dates — look it up across all orders.
    setSearching(true);
    try {
      const found = await findByOrderNumber(q);
      if (found) navigate(`/orders/${found.id}`);
      else toast.error(`No order found with number "${q}".`);
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      setSearching(false);
    }
  }

  function exportCsv() {
    const csv = ordersToCsv(orders, `Avi's Food Corner sales report — ${rangeLabel}`);
    const [a, b] = from <= to ? [from, to] : [to, from];
    downloadCsv(`avis-food-corner-sales-${a}${a === b ? '' : '-' + b}.csv`, csv);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">From</label>
            <input
              type="date"
              className="input"
              value={dateKeyToInput(from)}
              max={dateKeyToInput(today)}
              onChange={(e) => e.target.value && setFrom(inputToDateKey(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1">To</label>
            <input
              type="date"
              className="input"
              value={dateKeyToInput(to)}
              max={dateKeyToInput(today)}
              onChange={(e) => e.target.value && setTo(inputToDateKey(e.target.value))}
            />
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              setFrom(today);
              setTo(today);
            }}
          >
            Today
          </button>
          <div className="flex-1" />
          <button className="btn-secondary" onClick={exportCsv} disabled={orders.length === 0}>
            ⬇ Export CSV
          </button>
        </div>

        {/* Summary */}
        <div>
          <h1 className="text-xl font-extrabold mb-3">Sales summary · {rangeLabel}</h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Completed orders" value={String(summary.completedCount)} />
            <Stat label="Total collected" value={formatINR(summary.totalPaise)} />
            <Stat
              label="Cash"
              value={formatINR(summary.cashPaise)}
              sub={plural(summary.cashCount, 'order')}
            />
            <Stat label="UPI" value={formatINR(summary.upiPaise)} sub={plural(summary.upiCount, 'order')} />
          </div>
          {(summary.cancelled.count > 0 || summary.refunded.count > 0) && (
            <p className="mt-2 text-sm text-stone-600">
              Not counted in sales: {summary.cancelled.count} cancelled (
              {formatINR(summary.cancelled.paise)}) · {summary.refunded.count} refunded (
              {formatINR(summary.refunded.paise)})
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5 items-start">
          {/* Quantity per product */}
          <div className="card p-4">
            <h2 className="font-extrabold mb-2">Quantity sold</h2>
            {summary.products.length === 0 ? (
              <p className="text-sm text-stone-500">No sales in this period.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-stone-500">
                    <th className="py-1 font-semibold">Item</th>
                    <th className="py-1 font-semibold text-right">Qty</th>
                    <th className="py-1 font-semibold text-right">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.products.map((p) => (
                    <tr key={p.name} className="border-t border-stone-100">
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-right font-bold tabular-nums">{p.qty}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatINR(p.salesPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Orders list */}
          <div className="card lg:col-span-2 overflow-hidden">
            <form onSubmit={onSearch} className="p-3 border-b border-stone-100 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Search order number…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputMode="search"
              />
              <button className="btn-secondary" disabled={searching}>
                {searching ? 'Searching…' : 'Find'}
              </button>
            </form>

            {loading ? (
              <p className="p-6 text-center text-stone-400">Loading orders…</p>
            ) : error ? (
              <p className="p-6 text-center text-red-700 font-semibold">
                Could not load orders: {error}
              </p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-stone-500">No orders.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold truncate">{o.orderNumber}</div>
                        <div className="text-xs text-stone-500 truncate">
                          <span className="sm:hidden">{paymentLabel(o.paymentMethod)} · </span>
                          {from !== to && `${formatDateKey(o.dateKey)} · `}
                          {formatTime(orderTime(o))} ·{' '}
                          {o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}
                        </div>
                      </div>
                      <span className="hidden sm:block text-sm font-semibold text-stone-600 w-12 text-center">
                        {paymentLabel(o.paymentMethod)}
                      </span>
                      {/* Phones: amount above the status badge to save width. */}
                      <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-1 sm:gap-3 shrink-0">
                        <StatusBadge order={o} pending={pendingIds.has(o.id)} />
                        <span
                          className={
                            'sm:w-20 text-right font-extrabold tabular-nums ' +
                            (o.status !== 'completed' ? 'line-through text-stone-400' : '')
                          }
                        >
                          {formatINR(o.grandTotalPaise)}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
