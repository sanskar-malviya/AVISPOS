# Acceptance test checklist (spec §13)

Testing happens on two levels:

1. **Automated**, on any computer. These ran and passed on 10 Oct 2026:
   - `npm test`: 31 unit tests (cart, money, defaults, receipt layout, ESC/POS, reports/CSV, server validation)
   - `npm run test:rules`: 21 Firestore security-rules tests
   - `npm run test:e2e`: 41 checks driving the real app in a browser against the Firebase emulators,
     tablet-sized landscape window with touch
2. **On the real tablet and printer.** These must be done by hand before going live, because hardware can't
   be automated. Tick each box.

| # | Acceptance test | Automated proof | ✔ On device |
|---|---|---|---|
| 1 | Tap Chole Bhature twice → quantity 2 | unit `cart` + e2e T1 (badge "2", single order line) | ☐ |
| 2 | Multiple products → correct grand total | unit `cart` + e2e T2 (₹210) | ☐ |
| 3 | Decrease/remove → total updates immediately | unit `cart` + e2e T3 | ☐ |
| 4 | Five default prices correct | unit `money-and-defaults` + e2e T4 | ☐ |
| 5 | Owner changes a price → new price on future orders | e2e T5 (Vada Pav ₹30 → ₹35) + audit entry | ☐ |
| 6 | Completed order keeps its original price | unit `receipt` + e2e T6 | ☐ |
| 7 | Cash or UPI can be selected and confirmed | e2e T7 | ☐ |
| 8 | UPI can't be marked paid just by selecting UPI | e2e T8 (no order saved until "Yes, payment received") + rules test (unpaid orders rejected) | ☐ |
| 9 | Completed order saved with a unique order number | e2e T9 (`YYYYMMDD-0001`…) + rules (counter only +1, no overwrite) | ☐ |
| 10 | Receipt shows correct items, qty, totals, payment | unit `receipt` + e2e T10 | ☐ |
| 11 | Printing works; failed print retried without another sale | e2e T11 (repeat print = same sale, reprint counter +1). **Bluetooth printing needs the device test.** | ☐ |
| 12 | Daily sales with separate Cash and UPI totals | unit `reports` + e2e T12 (incl. cancelled order excluded) | ☐ |
| 13 | Internet drop doesn't silently lose an order | e2e T13 (sold offline → banner + "saved on this device" → synced, canonical number) | ☐ |
| 14 | Comfortable on the tablet without a keyboard | e2e T14 (all products visible, no touch target under 40 px) | ☐ |
| 15 | Main billing flow simple and fast | e2e T15 | ☐ |

## On-device test script (≈ 20 minutes)

Use the real tablet, the real printer, the deployed app URL and a **cashier** login.

**Billing (1–4, 14, 15)**
- [ ] All 5 products visible without scrolling in landscape; photos sharp; prices ₹90/₹70/₹50/₹60/₹30.
- [ ] Tap Chole Bhature ×2, Vada Pav ×1 → badge 2, total ₹210. Use −, +, ✕; total updates instantly.
- [ ] Time a normal 2-item cash order from first tap to receipt: target **≤ 15 s**. Time: ____ s.
- [ ] Every button is easy to hit with a thumb; nothing needs the keyboard.

**Payment (7–9)**
- [ ] UPI → "Customer Has Paid" → **Not yet** → still on payment screen; nothing in Orders.
- [ ] UPI → confirm → success screen with order number; order appears in *Orders* (owner).
- [ ] Cash order → success; order numbers increase by one each sale.
- [ ] Rapidly double-tap the complete button → only **one** order in *Orders*.

**Printing (10, 11)**
- [ ] Printer connected → after payment the receipt prints **without any dialog**.
- [ ] Receipt matches: name, tagline, order no., date/time, items, qty, amounts, Subtotal, TOTAL, Payment.
- [ ] Correct width for your roll (58/80 mm); nothing cut off.
- [ ] Switch the printer **off** → make a sale → red "Printing failed" → switch on → **Retry Print** →
      prints; *Orders* still shows exactly one sale.
- [ ] *Orders* → open an order → **Reprint Receipt** → prints with `*** REPRINT ***`; no new sale.
- [ ] Restart the tablet → open the app → reconnect the printer with one tap → next sale prints.

**Offline (13)**
- [ ] Turn Wi-Fi/data **off** → orange Offline bar → make 2 sales → each says "Saved on this device".
- [ ] Turn internet **on** → within a minute both appear in *Orders* with normal order numbers. Searching
      the printed `OFF-…` number finds them.

**Owner (5, 6, 12)**
- [ ] Change a price → billing shows it at once → new sale uses it; an older order still shows the old price.
- [ ] *Orders* today: total = Cash + UPI; counts match; CSV export opens in Excel/Sheets.
- [ ] Cancel an order with a reason → excluded from totals, listed as cancelled.
- [ ] Cashier login can't see Orders/Settings; Settings asks for the owner PIN.

Tested by: ______________ Date: __________ Tablet model: ______________ Printer model: ______________

**Go-live only when every box above is ticked.**
