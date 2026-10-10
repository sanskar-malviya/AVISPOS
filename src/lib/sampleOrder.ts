import type { Order } from './types';

/** A demo order used for receipt previews and test prints in Settings. */
export function sampleOrder(): Order {
  const now = Date.now();
  return {
    id: 'sample',
    orderNumber: 'TEST-0001',
    orderNumberProvisional: false,
    createdAt: now,
    clientCreatedAt: now,
    dateKey: '',
    items: [
      { productId: 'a', name: 'Chole Bhature', unitPricePaise: 9000, qty: 2, lineTotalPaise: 18000 },
      { productId: 'b', name: 'Vada Pav', unitPricePaise: 3000, qty: 1, lineTotalPaise: 3000 },
    ],
    subtotalPaise: 21000,
    grandTotalPaise: 21000,
    paymentMethod: 'upi',
    paymentStatus: 'paid',
    status: 'completed',
    cashierUid: '',
    deviceId: '',
    reprintCount: 0,
    validated: true,
    validationErrors: [],
    provisionalNumber: '',
    source: 'online',
    statusReason: '',
  };
}
