/**
 * UPI payment confirmation strategy (spec §5).
 *
 * Version 1 uses MANUAL confirmation: selecting UPI never marks an order paid;
 * the cashier must explicitly confirm they have seen the payment succeed on the
 * shop's UPI app / sound box.
 *
 * To add automatic UPI later (e.g. a payment-gateway dynamic QR with webhook),
 * implement `UpiProvider` with mode 'automatic': `requestPayment` would create
 * a payment intent and resolve 'paid' only after the gateway confirms it
 * (verified server-side in a Cloud Function — never trust the client). The
 * Payment screen already branches on `upiProvider.mode`.
 */
export interface UpiPaymentResult {
  status: 'paid' | 'pending' | 'failed';
  transactionRef?: string;
}

export interface UpiProvider {
  mode: 'manual' | 'automatic';
  requestPayment(amountPaise: number, orderId: string): Promise<UpiPaymentResult>;
}

export const manualUpiProvider: UpiProvider = {
  mode: 'manual',
  // Manual mode never confirms by itself — the cashier must confirm.
  async requestPayment() {
    return { status: 'pending' };
  },
};

export const upiProvider: UpiProvider = manualUpiProvider;
