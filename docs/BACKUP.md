# Backups and recovery

## What protects your data already

- **Sales can't be deleted** from the app, by anyone (enforced by the security rules). Cancellations and
  refunds are status changes with a reason, and every one is recorded in the **audit log**, along with every
  price change and every staff role change. The audit log is written only by the server.
- **Offline protection:** orders made without internet are stored on the tablet (IndexedDB) and sync when
  the connection returns. Don't clear Chrome's site data or uninstall the app while the Offline bar is
  showing, or unsynced orders on that device would be lost.
- **Firestore** keeps data replicated across multiple Google data centres.

## Recommended backups

### 1. Daily automatic database backups (recommended)

Run once from [Google Cloud Shell](https://shell.cloud.google.com) (replace `PROJECT_ID`):

```bash
gcloud config set project PROJECT_ID
gcloud firestore backups schedules create \
  --database='(default)' --recurrence=daily --retention=14w
```

This keeps 14 weeks of daily backups, at a few rupees per month for this data size. To list them:

```bash
gcloud firestore backups list --format="table(name, snapshotTime, state)"
```

### 2. Point-in-time recovery (optional)

Lets you read or restore the database as it was at any minute in the last 7 days:

```bash
gcloud firestore databases update --database='(default)' --enable-pitr
```

### 3. Weekly CSV export (simple, owner-friendly)

Every week (or month): **Orders →** set *From / To* → **Export CSV**. Save the file to Google Drive or email
it to yourself. This is also your record for accounts and tax.

### 4. Product photos

Photos are in Cloud Storage under `products/`. Keep your original photos on your phone or Drive. Re-uploading
from *Settings → Products* is the simplest recovery.

## Recovery procedures

**A device was lost, broken or reset.** Nothing is lost except orders that were made offline and never synced.
Install the app on the new tablet, sign in, and reconnect the printer.

**Someone made wrong changes (prices, products, settings).** Fix them in *Settings*. The audit log
(Firebase console → Firestore → `audit` collection) shows what changed, when and by whom.

**Data was damaged or needs restoring.** Restore a backup into a **new** database, check it, then switch over:

```bash
# 1. Find the backup to use
gcloud firestore backups list
# 2. Restore it into a new database
gcloud firestore databases restore \
  --source-backup=projects/PROJECT_ID/locations/asia-south1/backups/BACKUP_ID \
  --destination-database=restored
```

Inspect `restored` in the Firebase console. To bring the data back into the live `(default)` database,
export from `restored` with `gcloud firestore export` and import into `(default)` with
`gcloud firestore import`. Do this outside opening hours, and have a developer help if you are not
comfortable with it.

**Lost owner access.** Run `npm run bootstrap-owner -- your@email "new-password"` with a service-account key
([DEPLOY.md](DEPLOY.md) step 4). It resets the password and restores the owner role.
