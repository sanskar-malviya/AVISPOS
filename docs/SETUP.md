# Owner setup guide

Do this once, after the app is deployed ([DEPLOY.md](DEPLOY.md)) and you can sign in as the owner.

## 1. Set your owner PIN

**Settings → PIN, staff & backups → Owner PIN.** Choose 4–6 digits and enter them twice. From now on, Settings asks
for the PIN every time it is opened. A tablet left signed in as owner therefore can't be changed by anyone
else. After 5 wrong attempts the PIN pad locks for 30 seconds.

## 2. Check the menu

**Settings → Products.** The default items are already there (Chole Bhature ₹90, Pav Bhaji ₹70, Veg
Biryani ₹50, Chole Kulche ₹60, Vada Pav ₹30, and the add-ons Extra Bhatura ₹20, Extra Pav ₹10, Extra
Kulcha ₹15 per piece). If the list is empty, tap **Load default menu**. If a menu set up earlier is
missing the add-ons, a **New on the standard menu** box appears at the top — tap **Add to menu**.

For each product you can:

| Action | How | Effect |
|---|---|---|
| Change name or price | **Edit** → change → **Save** | Applies to **new** orders immediately. Past orders and receipts keep their old price. Every price change is written to the audit log. |
| Replace the photo | **Edit → Replace photo** → take a photo or pick one → **Save** | Photo is shrunk automatically (fast loading) and shown on the billing screen at once |
| Sold out for today | Switch **Available** off | Card stays on the billing screen but greyed out and can't be tapped |
| Remove from the menu | Switch **On menu** off | Card disappears from billing. Turn it back on any time. |
| Change the order on screen | ▲ / ▼ arrows | Billing screen shows products in this order |
| New product | **+ Add product** | Name, whole-rupee price, section, optional photo |
| Main dish or extra | **Edit → Section: Main dishes / Extras** | Extras (add-ons like extra bread) appear in a smaller section below the main dishes |

Products are never deleted, so old orders and reports always stay correct.

**Photos:** the app ships with sample photos of each dish. For the best result, replace them over time
with bright, close-up, landscape photos of *your own* plates. Use the same angle and background for all
of them so the screen stays easy to read.

## 3. Business and receipt

**Settings → Business & receipt:** business name, tagline ("100% Vegetarian"), optional contact line,
optional receipt heading, receipt footer ("Thank you for visiting!"), and **paper width (58 mm or 80 mm)**.
Under **When printing**, switch the **logo at the top**, the **logo watermark** and the **separate token
slip** on or off, each on its own (see [PRINTER.md](PRINTER.md#receipt-contents)).
The preview on the right shows exactly what the receipt and token slip will look like.

## 4. Printer

**Settings → Printer.** Choose **Bluetooth thermal printer**, tap **Connect printer**, pick your printer from
the list, then tap **Print test receipt**. Full details and troubleshooting are in [PRINTER.md](PRINTER.md).

## 5. Staff accounts

**Settings → PIN, staff & backups → Staff accounts.** Enter an email and a password (8+ characters), keep the role as
**Cashier**, tap **Add account**. Cashiers can bill and print, but can't see Orders or Settings.

- **Disable** an account when someone leaves. They are signed out and can't sign back in.
- After changing someone's role, they must sign out and back in.

**Recommended routine:** keep the tablet signed in with the cashier account. Sign in as owner only to change
settings or look at reports.

## 6. Daily routine

- **Morning:** switch on the printer, open the app, tap the yellow **Connect printer** button in the top bar
  if it shows.
- **During the day:** sold-out items → *Settings → Products → Available off*.
- **Evening:** **Orders** shows today's summary: total collected, Cash vs UPI, quantity per product. Tap
  **Export CSV** to keep a copy for your accounts. Count the cash drawer against the **Cash** figure.

## Cancelling or refunding an order

**Orders →** tap the order → **Cancel order** or **Mark refunded** → enter a reason. The order stays in
history marked Cancelled/Refunded and is removed from the sales totals. The change is recorded in the audit
log. Sales can never be deleted.
