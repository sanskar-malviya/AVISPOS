# Receipt printer guide

The app supports three printer modes (*Settings → Printer*):

| Mode | Prints automatically? | Works on | Extra taps |
|---|---|---|---|
| **Bluetooth thermal printer** (recommended) | Yes, silently, right after payment | Chrome on **Android** | None |
| **Browser print dialog** | Opens the system print dialog | Any device/browser incl. iPad | 1–2 per receipt |
| **No printer** | No | — | Print manually when needed |

## Why a plain web page can't "just print"

For security, browsers never let a website print silently to a printer. `window.print()` always shows a
dialog. Silent printing is possible here because Chrome's **Web Bluetooth** lets the app, *after you choose
the printer once*, send raw **ESC/POS** commands straight to a Bluetooth thermal printer. No driver or extra
app is needed.

## Choosing a printer — read before buying

You need a **58 mm or 80 mm ESC/POS thermal printer with Bluetooth Low Energy (BLE)**.

> ⚠ **Important:** many cheap "Bluetooth thermal printers" only support **classic Bluetooth (SPP)**.
> Web Bluetooth can only talk to **BLE**. Look for "BLE", "Bluetooth 4.0/5.0 dual-mode" or "supports
> iOS". iPhones can't use classic SPP printers, so iOS support is a good hint that a printer has BLE.
>
> To check a printer you already own, install **nRF Connect** (free, Play Store), switch the printer on and
> scan. If the printer appears in the list, it speaks BLE.

The app recognises the print channels used by most common BLE thermal printers. If yours connects but says
"no printing channel", it is probably classic-Bluetooth-only (see *Fallbacks* below).

## Tablet requirements

- Android 8+ with **Google Chrome** (kept up to date). Web Bluetooth isn't available in Firefox, Samsung
  Internet or any iPad browser.
- The app must be opened over **https** (Firebase Hosting provides this) or on `localhost`.
- Bluetooth on. When Chrome asks for **Nearby devices** (or *Location* on older Android), tap **Allow**.
- No pairing in Android's Bluetooth settings is needed. The app connects directly.

## First-time connection

1. Switch the printer on and load paper.
2. *Settings → Printer →* select **Bluetooth thermal printer** → **Connect printer**.
3. Pick the printer in Chrome's list → **Pair**. The list shows only Bluetooth thermal printers. If yours
   isn't there, close the list and tap **Show all devices** to look through every nearby device (a few
   printers only announce themselves as a printer once connected).
4. Tap **Print test receipt**. You should get a sample receipt (no sale is recorded).
5. Set the right paper width in *Settings → Business & receipt* (58 mm = 32 characters/line, 80 mm =
   48 characters/line).

## Everyday use

- The top bar shows **🖨 Printer ready** when connected. Receipts print automatically after every payment.
- After the app or tablet restarts, the app reconnects the last printer **by itself** when it opens, and
  tries again each time you come back to the app (e.g. after switching the printer on). Only if that fails
  does the yellow **🖨 Connect printer** button show — tap it and pick the printer. Chrome only allows a
  website to open the Bluetooth picker from a tap, which is why this step can't be automatic.
- Silent reconnection needs Chrome to remember the printer permission across restarts. Recent Chrome
  versions do this by default; if the yellow button shows after **every** restart even with the printer
  on, open `chrome://flags/#enable-web-bluetooth-new-permissions-backend` in Chrome on the tablet, set it
  to **Enabled**, relaunch Chrome and connect the printer once more.
- If the printer is off, out of range or out of battery, the payment still completes and the order is
  **saved**. The success screen shows a clear red **Printing failed** message with **Retry Print** and
  **Print with browser instead**.
- **Retry and reprint never create a second sale.** A reprint only increases the order's reprint counter.
  Copies printed after the first successful print are marked `*** REPRINT ***`.
- Old receipts can be reprinted from **Orders →** order → **Reprint Receipt**.

## What "success" means

The app reports **"Receipt sent to the printer"** only after the printer has acknowledged every byte over
Bluetooth. No web technology can detect paper-out or a jammed print head, so if the app says sent but no
paper came out, check the paper and tap **Print Receipt** again.

## Receipt contents

Business name, tagline, optional heading/contact, **token number**, order number, date & time, items
(name, qty, amount), subtotal, **TOTAL**, payment method (Cash/UPI) and the footer. Thermal printers can't
print the ₹ sign, so Bluetooth receipts show **Rs.**; browser-printed receipts show **₹**.

**Token number.** The day's order sequence without leading zeros: order `20261012-0007` is token **7**.
It is printed on the receipt and also on a separate **token slip** after it: shop name, "TOKEN NO.", the
number in big type (three times normal size), the food and quantities (e.g. `2 x Extra Bhatura`), time
and order number. On a printer with a cutter the slip is cut off separately; otherwise tear it off.
**Print Token** (after payment) and **Reprint Token** (in *Orders*) print just the slip again. Orders saved offline get a token like **OFF 4** until they
sync, so they never clash with an online token. Reprints say *REPRINT* on both.

Three switches under *Settings → Business & receipt → When printing* control the extras independently:

| Switch | Effect | Bluetooth printing time |
|---|---|---|
| **Logo at the top** | Shop logo (`public/brand/logo.jpg`) above the receipt, about 24 mm wide (30 mm on 80 mm paper) | about +1 s |
| **Logo watermark** | Faint logo behind the items | about +4–5 s |
| **Separate token slip** | The token slip after the receipt | under +1 s |
| **Food & quantity on the token slip** | Lists what to prepare under the token number | — |

Thermal printers can't print text over an image, so with the watermark on, the lines behind it are printed
as one picture (text and faint logo together) and the rest stays normal printer text. That picture is why
the watermark takes a few seconds; switch it off if the queue is long. The on-screen receipt can't be
selected or copied.

None of this makes a paper receipt impossible to copy, since anyone can photocopy one. To check whether a
receipt is genuine, search its order number in **Orders**: a real one shows the same items, total and time.

## Fallbacks

- **Classic-Bluetooth (SPP) or USB printer on Android:** install an ESC/POS *print service* app from the
  Play Store (for example **RawBT**), set it up for your printer, then choose **Browser print dialog** in
  the app. Each receipt then needs one tap in the print dialog.
- **iPad or Windows PC:** use **Browser print dialog** with a printer that has a system driver.
- In browser mode, set the paper size in the print dialog to match your roll and margins to *None*.

## Troubleshooting

| Problem | Try |
|---|---|
| Printer not in Chrome's list | Tap **Show all devices** when offered. Printer on and in pairing mode? Bluetooth on? *Nearby devices* permission allowed? Is it a BLE printer (nRF Connect)? |
| Yellow Connect button after every restart | Chrome isn't keeping the printer permission — see the Chrome flag under *Everyday use*. |
| "Not supported in this browser" | Use Chrome on Android, opened via the https app URL (not a file or an IP address). |
| Connected but "no printing channel" | Classic-Bluetooth-only printer → use the fallback above. |
| Garbled characters | Printer not in ESC/POS mode (see its manual / self-test page). |
| Text cut off at the right edge | Paper width setting is 80 mm on a 58 mm printer. |
| Prints but very faint | Thermal paper is upside down, or the battery is low. |
