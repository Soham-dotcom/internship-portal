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

## 4. Finalising a year (locks)

In the portal, as an admin: **Locks & Finalisation**.
- **Lock each marks component** once its sheet has been verified (for example, industry
  evaluator marks after cross-checking). Other components stay editable.
- **Lock the year** once results are published. Staff can then only read; every page shows a banner.
- **Correcting locked data:** just make the edit as an admin. The portal asks for a reason,
  saves the change, and records the reason in the audit log.
- **Unlocking** (year or a component) also asks for a reason. Prefer a single reasoned correction
  over unlocking.

## 5. Investigating a change

- **One student:** *Marks & Evaluation → History* on their row shows every change: who, when,
  old → new, and any lock-override reason.
- **Everything:** *Audit Log* (admin). Filter by action (e.g. `marks`), user, student UID or dates.

## 6. Keeping the server awake (optional)

Render's free tier sleeps after about 15 minutes without traffic, and the first request then takes
30–60 s. The portal shows a "server is waking up" message, but you can avoid the wait:

1. Create a free account at uptimerobot.com (or any uptime monitor).
2. Add an **HTTP(s)** monitor for `https://internship-portal-bmfy.onrender.com/api/health`, every 5 minutes.
3. You also get an email if the portal goes down.

A GitHub Action is not used for this: on a private repo it would use more Actions minutes than the
free allowance. Upgrading the Render instance removes sleeping altogether.

## 7. If an account may be compromised
1. `set-status <username> disabled`: they are cut off immediately.
2. Check what they did: *Audit Log* page, filter by their username (or Atlas → `spit-common.auditlogs`).
3. If data was damaged, restore it (section 2).
4. Reset their password, then re-enable.
