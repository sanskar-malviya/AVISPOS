import type { Order } from './types';

/** Best timestamp for an order: server time once synced, else device time. */
export function orderTime(order: Pick<Order, 'createdAt' | 'clientCreatedAt'>): number {
  return order.createdAt ?? order.clientCreatedAt;
}

/** e.g. "10/10/2026, 1:45 pm" (Indian day/month order). */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** e.g. "1:45 pm" */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "YYYYMMDD" -> "YYYY-MM-DD" (for <input type="date">). */
export function dateKeyToInput(dk: string): string {
  return `${dk.slice(0, 4)}-${dk.slice(4, 6)}-${dk.slice(6, 8)}`;
}

/** "YYYY-MM-DD" -> "YYYYMMDD". */
export function inputToDateKey(value: string): string {
  return value.replace(/-/g, '');
}

/** "YYYYMMDD" -> "10 Oct 2026" */
export function formatDateKey(dk: string): string {
  const d = new Date(Number(dk.slice(0, 4)), Number(dk.slice(4, 6)) - 1, Number(dk.slice(6, 8)));
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function paymentLabel(method: Order['paymentMethod']): string {
  return method === 'upi' ? 'UPI' : 'Cash';
}
