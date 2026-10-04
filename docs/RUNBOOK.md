# Runbook: operating the portal

Plain steps for the jobs that matter when something goes wrong. Run every command from
the repository root.

## 1. Backups

### How backups happen
- **Nightly, automatic:** the GitHub Action `.github/workflows/backup.yml` runs at 02:00 IST.
  It saves one **encrypted** file holding every portal database, kept for **30 days** under
  *GitHub → Actions → Nightly database backup → (a run) → Artifacts*.
- **On demand:** before anything risky (a big import, clearing groups, a deploy that
  changes data), take a manual backup:
  - from GitHub: *Actions → Nightly database backup → Run workflow*, or
  - locally: `BACKUP_PASSPHRASE="..." npm run backup`, which writes into `backups/`
    (git-ignored).

### One-time setup (admin)
1. **Create a read-only database user** in Atlas: *Database Access → Add New Database User*,
   with the built-in role **"Only read any database"**. Backups must never use the app's
   read-write login.
2. **Allow GitHub to reach Atlas:** under *Network Access*, the list must allow GitHub's
   runners. If it already allows `0.0.0.0/0` (needed by Render's free tier), there is nothing to do.
3. **Add repository secrets** in *GitHub → Settings → Secrets and variables → Actions*:
   - `BACKUP_MONGODB_URI`: the read-only user's connection string
   - `BACKUP_PASSPHRASE`: a long random phrase (16+ characters)
4. **Store the passphrase somewhere safe outside GitHub** (e.g. a password manager). Without
   it the backups cannot be decrypted, by anyone.
5. Run the workflow once by hand and check that it is green.

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. If the
> portal sits untouched over a vacation, re-enable the workflow from the Actions tab.

### Check that backups are healthy (monthly, 5 minutes)
1. Open the latest run and confirm it is green and shows sensible document counts in the log.
2. Every few months, do a test restore (below) with `--suffix -restoretest`, then delete
   those databases.

## 2. Restoring

The restore script **never** targets the live database by default, and **never** overwrites
data unless you explicitly ask it to.

1. Download the artifact from GitHub and unzip it. You get `portal-backup-<time>.json.gz.enc`.
2. **Safest path: restore next to the live data and inspect it first.**
   ```
   RESTORE_MONGODB_URI="<admin connection string>" BACKUP_PASSPHRASE="..." \
     npm run restore -- portal-backup-<time>.json.gz.enc --suffix -restored
   ```
   This creates `spit-internships-2026-restored`, `spit-common-restored`, and so on. Compare
   them with the live databases (Atlas Data Explorer or Compass) and copy back only what was lost.
3. **Full rollback** (replace live data with the backup; last resort):
   ```
   I_UNDERSTAND_THIS_DELETES_DATA=yes RESTORE_MONGODB_URI="<admin connection string>" \
     BACKUP_PASSPHRASE="..." npm run restore -- portal-backup-<time>.json.gz.enc --drop
   ```
   Take a fresh backup **first**, so the rollback itself can be undone.

## 3. Accounts

| Task | Command |
|---|---|
| List accounts | `npm run manage-users -- list` *(or `node backend/scripts/manage-users.js list`)* |
| Create an account | `SEED_USERNAME=<name> SEED_PASSWORD="<12+ chars>" SEED_ROLE=staff node backend/scripts/seed-user.js` |
| Change role | `node backend/scripts/manage-users.js set-role <username> admin\|staff` |
| Disable / re-enable | `node backend/scripts/manage-users.js set-status <username> disabled\|active` |
| Limit years | `node backend/scripts/manage-users.js set-years <username> 2026` (or `all`) |
| Reset a password | `NEW_PASSWORD="<12+ chars>" node backend/scripts/set-password.js <username>` |

Role, status and year changes apply on the user's **next request**: no need to wait for
their session to expire. A password reset also signs them out everywhere.

## 4. If an account may be compromised
1. `set-status <username> disabled`: they are cut off immediately.
2. Check what they did: Atlas → `spit-common.auditlogs`, filter by `actorUsername`.
3. If data was damaged, restore it (section 2).
4. Reset their password, then re-enable.
