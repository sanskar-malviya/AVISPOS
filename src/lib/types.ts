// Shared domain types for the Avi's Food Corner POS.
// NOTE: all monetary values are integer PAISE (1 rupee = 100 paise) to avoid
// floating-point errors. Never store rupees as a float anywhere.

export type ID = string;

/** Billing-screen section: main dishes, or small add-ons such as extra bread. */
export type ProductCategory = 'main' | 'extra';

export interface Product {
  id: ID;
  name: string;
  pricePaise: number; // integer paise
  imageUrl: string; // download URL or bundled placeholder path
  imagePath: string; // Cloud Storage path (for replace/delete); '' if placeholder
  active: boolean; // false = hidden from billing entirely
  available: boolean; // false = temporarily unavailable (shown but not sellable)
  sortOrder: number;
  category: ProductCategory;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export type PaymentMethod = 'cash' | 'upi';
export type PaymentStatus = 'unpaid' | 'paid';
export type OrderStatus = 'completed' | 'cancelled' | 'refunded';
export type OrderSource = 'online' | 'offline';

export interface OrderItem {
  productId: ID;
  name: string; // snapshot at time of sale
  unitPricePaise: number; // snapshot at time of sale
  qty: number;
  lineTotalPaise: number; // qty * unitPricePaise
}

export interface Order {
  id: ID; // client-generated UUID == Firestore doc id (idempotency)
  orderNumber: string; // human-friendly, e.g. "20261010-0007"
  orderNumberProvisional: boolean; // true if assigned offline, awaiting reconcile
  createdAt: number | null; // server timestamp (ms); null while write pending
  clientCreatedAt: number; // device epoch ms (always present)
  dateKey: string; // YYYYMMDD (local) for daily counters & reports
  items: OrderItem[];
  subtotalPaise: number;
  grandTotalPaise: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  cashierUid: string;
  deviceId: string;
  reprintCount: number;
  checked: boolean; // false until the server has checked the order
  validated: boolean; // true when the server found no problems
  validationErrors: string[]; // problems found by the server (empty when OK)
  provisionalNumber: string; // original offline number after reconciliation ('' if none)
  source: OrderSource;
  statusReason: string; // reason given for cancel/refund ('' otherwise)
  paymentCorrected?: boolean; // true once the owner changed cash↔UPI after the sale
}

export type PaperWidth = '58' | '80';

export interface PrinterConfig {
  type: 'bluetooth' | 'browser' | 'none';
  deviceName?: string; // last paired BLE device name (reconnect hint)
}

export interface BusinessSettings {
  businessName: string;
  tagline: string; // e.g. "100% Vegetarian"
  contact: string;
  receiptHeader: string;
  receiptFooter: string;
  paperWidth: PaperWidth;
  printer: PrinterConfig;
  vegLabel: string; // short veg indicator text, e.g. "VEG"
  receiptLogo: boolean; // print the shop logo at the top of receipts
  receiptWatermark: boolean; // faint logo behind the receipt items
  tokenSlip: boolean; // print a separate token slip after the receipt
  tokenItems: boolean; // list the food and quantities on the token slip
}
// NOTE: the owner PIN hash is deliberately NOT part of BusinessSettings. It lives
// in settings/security, which only owner accounts can read (see firestore.rules).

export type Role = 'owner' | 'cashier';
