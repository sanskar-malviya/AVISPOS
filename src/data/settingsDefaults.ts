import type { BusinessSettings } from '../lib/types';

/** Defaults used until the owner saves settings (and by the seed script). */
export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "AVI'S FOOD CORNER",
  tagline: '100% Vegetarian',
  contact: '',
  receiptHeader: '',
  receiptFooter: 'Thank you for visiting!',
  paperWidth: '58',
  printer: { type: 'none' },
  vegLabel: 'VEG',
  receiptLogo: true,
};
