# Backups and recovery

## What protects your data already

- **Sales can't be deleted** from the app, by anyone (enforced by the security rules). Cancellations and
  refunds are status changes with a reason.
- **Audit log:** every price change, cancellation, refund and staff-role change is recorded. The security
  rules refuse a price change or cancellation that doesn't come with its audit entry. Nobody can edit or
  delete the log.
- **Offline protection:** orders made without internet are stored on the tablet and sync when the
  connection returns. Don't clear Chrome's site data or uninstall the app while the orange Offline bar is
  showing, or unsynced orders on that device would be lost.
- **Firestore** keeps data replicated across several Google data centres.

## Automatic nightly backups

Every night at **00:15 India time**, the `backup-daily` server function saves the business day that just
ended to Netlify Blobs: that day's orders, audit entries and order counter, plus a copy of the menu and
business settings. The owner PIN is never included. Each file is about 0.5 MB, and backups are kept
indefinitely.

**To download one:** *Settings → PIN, staff & backups → Backups* → **⬇ Download** next to the date. Keep
your own copy somewhere else too (Google Drive, email to yourself), e.g. once a week.

**Back up right now** (e.g. before closing early or changing many prices): tap **Back up today now** in
the same place.

## CSV export (for your accounts)

*Orders →* set **From / To → Export CSV** gives a spreadsheet of sales, Cash vs UPI, and quantity per
product. Keep it monthly for your accounts. It's a report, not a restorable backup.

## Recovery procedures

**A tablet was lost, broken or reset.** Nothing is lost except orders made offline that never synced.
Install the app on the new tablet, sign in, and reconnect the printer.

**Wrong changes were made (prices, products, settings).** Fix them in *Settings*. The audit log (Firebase
console → Firestore → `audit` collection) shows what changed, when, and by whom.

**Data was damaged or deleted outside the app.** Restore from the downloaded backup files, using a
computer with this project and the admin key file ([DEPLOY.md](DEPLOY.md) step 1.4):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\keys\avis-pos-admin.json"
# Restore the orders, audit entries and counters of the days you need:
npm run restore-backup -- day-20261010.json day-20261011.json
# Also restore the menu and settings (from the last file given):
npm run restore-backup -- day-20261011.json --with-menu
```

The restore rewrites the documents saved in those files and never deletes anything else. Do it outside
opening hours. Ask a developer to help if you're not comfortable with the terminal.

**Lost owner access.** Run `npm run bootstrap-owner -- your@email "new-password"` with the admin key
([DEPLOY.md](DEPLOY.md) step 3). It resets the password and restores the owner role.
