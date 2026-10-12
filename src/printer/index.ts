// Printing entry point. Picks the configured driver and reports an HONEST
// outcome — we never claim a receipt printed unless the driver confirmed it
// (spec §6).
import type { BusinessSettings, Order } from '../lib/types';
import { buildReceiptLines, buildTokenLines, receiptHtml } from './receipt';
import { concatBytes, encodeEscPos } from './escpos';
import { watermarkImage } from './watermark';
import { bluetoothPrint } from './bluetooth';
import { printHtmlViaBrowser } from './browserPrint';
import { LOGO_URL, escPosRaster, logoBitmap, logoDotsFor } from './logo';

export type PrintMethod = 'bluetooth' | 'browser';

export type PrintOutcome =
  | { ok: true; method: PrintMethod; message: string }
  | { ok: false; method: PrintMethod | 'none'; message: string };

export interface PrintOptions {
  reprint?: boolean;
  /** Use the browser print dialog regardless of the configured printer. */
  forceBrowser?: boolean;
}

export async function printOrderReceipt(
  order: Order,
  settings: BusinessSettings,
  opts: PrintOptions = {},
): Promise<PrintOutcome> {
  const method = opts.forceBrowser ? 'browser' : settings.printer.type;

  if (method === 'none') {
    return {
      ok: false,
      method: 'none',
      message: 'No receipt printer is set up. Use "Print Receipt" to print via the browser.',
    };
  }

  try {
    const tokenLines = settings.tokenSlip
      ? buildTokenLines(order, settings, { reprint: opts.reprint })
      : undefined;
    if (method === 'bluetooth') {
      const lines = buildReceiptLines(order, settings, { currency: 'Rs.', reprint: opts.reprint });
      // A logo or watermark that can't be prepared never blocks the receipt itself.
      const logo = settings.receiptLogo
        ? await logoBitmap(logoDotsFor(settings.paperWidth)).then(escPosRaster, () => undefined)
        : undefined;
      const image = settings.receiptWatermark
        ? await watermarkImage(lines, settings.paperWidth).catch(() => undefined)
        : undefined;
      const receipt = encodeEscPos(lines, { cut: true, logo, image });
      await bluetoothPrint(
        tokenLines ? concatBytes(receipt, encodeEscPos(tokenLines, { cut: true })) : receipt,
      );
      return {
        ok: true,
        method,
        message: tokenLines ? 'Receipt and token sent to the printer.' : 'Receipt sent to the printer.',
      };
    }
    const lines = buildReceiptLines(order, settings, { currency: '₹', reprint: opts.reprint });
    await printHtmlViaBrowser(
      receiptHtml(lines, settings.paperWidth, {
        logoUrl: new URL(LOGO_URL, location.origin).href,
        logo: settings.receiptLogo,
        watermark: settings.receiptWatermark,
        tokenLines,
      }),
    );
    return { ok: true, method, message: 'Print dialog opened — tap Print there to finish.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, method, message: `Printing failed: ${msg}` };
  }
}

/** Print only the token slip (e.g. a second copy for the kitchen). */
export async function printTokenSlip(
  order: Order,
  settings: BusinessSettings,
  opts: PrintOptions = {},
): Promise<PrintOutcome> {
  const method = opts.forceBrowser ? 'browser' : settings.printer.type;
  if (method === 'none') {
    return { ok: false, method: 'none', message: 'No receipt printer is set up.' };
  }
  try {
    const lines = buildTokenLines(order, settings, { reprint: opts.reprint });
    if (method === 'bluetooth') {
      await bluetoothPrint(encodeEscPos(lines, { cut: true }));
      return { ok: true, method, message: 'Token sent to the printer.' };
    }
    await printHtmlViaBrowser(receiptHtml(lines, settings.paperWidth));
    return { ok: true, method, message: 'Print dialog opened — tap Print there to finish.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, method, message: `Printing failed: ${msg}` };
  }
}
