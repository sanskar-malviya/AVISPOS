# Running costs

**Short version: expect ₹0–₹100 per month** for the cloud side at a single food stall, plus one-time
hardware. Firebase bills in USD; the ₹ figures below are approximate. Prices are as published by Google at
the time of writing and can change. Always check <https://firebase.google.com/pricing> and set a budget
alert ([DEPLOY.md](DEPLOY.md) step 1.2).

## Why the Blaze (pay-as-you-go) plan is needed

Cloud Functions, which do the server-side order validation and staff management, and new Cloud Storage
buckets require Blaze. Blaze keeps the free allowances of the free plan, so a small business usually pays
nothing. You only pay for usage *above* the free quotas.

## Estimated usage for a busy day (≈300 orders)

| Service | What uses it | Approx. per day | Free allowance | Expected cost |
|---|---|---|---|---|
| Firestore writes | order + counter + server validation + occasional reprint | ~1,000–1,500 | 20,000/day | ₹0 |
| Firestore reads | menu loads, checkout transaction, validation, reports | ~3,000–8,000 | 50,000/day | ₹0 |
| Firestore storage | orders (~1 KB each) | ~100 MB per year | 1 GiB | ₹0 for years |
| Cloud Functions | ~2 calls per order + staff admin | ~600–900 | 2,000,000/month | ₹0 |
| Authentication | email/password logins | a few | 50,000 monthly users | ₹0 |
| Cloud Storage | product photos (~100 KB each) | a few MB | small; regional rates of a few cents/GB | ≈ ₹0–₹5/month |
| Netlify (website) | app downloads (cached on the tablet) + a build per push | a few MB | Free plan — far beyond one stall's needs (see netlify.com/pricing) | ₹0 |
| Artifact Registry | container images from deploying Functions | ~0.5–1 GB | 0.5 GB | ₹0–₹10/month (keep the cleanup policy on) |
| Cloud Build | builds when deploying Functions | minutes per deploy | 120 build-min/day | ₹0 |

**Total cloud estimate: ₹0–₹100/month.** It only grows with many more devices or very heavy report use.

## Optional / one-time

| Item | Cost |
|---|---|
| Custom domain (e.g. `pos.avisfoodcorner.in`) | ~₹700–1,200/year (optional; the free `*.web.app` address works fine) |
| Daily managed Firestore backups ([BACKUP.md](BACKUP.md)) | a few ₹/month at this data size |
| Android tablet (10", landscape) | ₹10,000–20,000 one-time (if not already owned) |
| 58 mm BLE thermal printer | ~₹1,500–3,500 one-time |
| 80 mm BLE thermal printer | ~₹4,000–9,000 one-time |
| Thermal paper rolls | ~₹15–40 per roll |
| Internet | your existing mobile data / Wi-Fi (the app uses very little data) |

## No other subscriptions

There are no licence fees, per-transaction fees or third-party services. UPI goes straight to your own UPI
app or sound box. An automatic UPI payment gateway, if added later, would charge its own fees (typically up
to ~2% per transaction, often 0% for UPI). That isn't part of version 1.
