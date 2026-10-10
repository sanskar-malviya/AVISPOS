# Running costs

**Short version: ₹0 per month, and no payment card is needed.** Everything runs on free plans: Firebase
Spark and Netlify Free. Prices and free limits are set by those companies and can change; check
<https://firebase.google.com/pricing> and <https://www.netlify.com/pricing> occasionally.

## Estimated usage for a busy day (≈300 orders)

| Service | What uses it | Approx. | Free limit | Cost |
|---|---|---|---|---|
| Firestore writes | order + counter + server check + occasional reprint/audit | ~1,000–1,500/day | 20,000/day | ₹0 |
| Firestore reads | menu loads, checkout, server checks, reports, backup | ~3,000–10,000/day | 50,000/day | ₹0 |
| Firestore storage | orders (~1 KB each) + product photos (~70 KB each) | ~100 MB/year | 1 GiB | ₹0 for years |
| Firebase Authentication | email/password sign-ins | a few/day | 50,000 monthly users | ₹0 |
| Netlify website | app downloads (cached on the tablet) | a few MB/day | Free plan | ₹0 |
| Netlify functions | ~1 call per sale + order checks every 10 min + 1 nightly backup | ~15,000 calls/month | Free plan | ₹0 |
| Netlify builds | one build per push to GitHub | a few minutes/month | Free plan | ₹0 |
| Netlify Blobs (backups) | one file per day (~0.5 MB) | ~180 MB/year | Free plan | ₹0 |

If the free limits are ever reached, the service pauses rather than billing you, because no card is on file.
At one stall's volume that's very unlikely.

## One-time and optional

| Item | Cost |
|---|---|
| Custom domain (e.g. `pos.avisfoodcorner.in`) | ~₹700–1,200/year (optional; `*.netlify.app` works fine) |
| Android tablet (10", landscape) | ₹10,000–20,000 (if not already owned) |
| 58 mm BLE thermal printer | ~₹1,500–3,500 |
| 80 mm BLE thermal printer | ~₹4,000–9,000 |
| Thermal paper rolls | ~₹15–40 per roll |
| Internet | your existing mobile data / Wi-Fi (the app uses very little) |

## No other subscriptions

There are no licence fees, per-transaction fees or third-party services. UPI goes straight to your own UPI
app or sound box. An automatic UPI payment gateway, if added later, would charge its own fees. That isn't
part of version 1.
