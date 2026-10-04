# Decisions

One entry per significant choice: what, why, what else was considered, and what we gave up.
Newest first.

---

## 2026-10-05: Marks imports are all-or-nothing on values

**What.** The five single-field marks imports share one handler built on a pure, tested
planner (`utils/marksImport.js`). If any row holds an invalid mark (out of range, not a
number, or the same UID twice with different values), the whole file is rejected with a list
of the rows to fix, and nothing is written. UIDs not found in the year are skipped and
reported. Blank cells leave the mark unchanged. Every changed mark is audited as
`{uid, from, to}`. Writes use one `bulkWrite` instead of one round trip per row.

**Why.** Before, each row was validated only loosely (`parseInt`, no range), and bad rows
were skipped while good rows were saved. A sheet with one typo half-updated the class, and
`parseInt` silently turned 32.5 into 32. Rejecting the file is easier to reason about: either
the sheet went in, or nothing did.

**Alternatives rejected.** *Skip bad rows, save the rest* (the old behaviour) leaves the
coordinator unsure which marks are current. *Reject on unknown UIDs too* is too strict: sheets
are often shared across lists.

**Bug found while testing.** A helper used `String(value || '')`, which turns the number `0`
into an empty string, so a "did not attend = 0" cell would have been treated as blank. Fixed
with `??`.

---

## 2026-10-05: Backups: our own Node script + GitHub Actions, encrypted

**What.** `backend/scripts/backup.js` dumps every portal database (documents + index definitions)
into one gzipped Extended-JSON file, encrypted with AES-256-GCM using a passphrase. A GitHub
Action runs it nightly and keeps each file as a workflow artifact for 30 days.
`backend/scripts/restore.js` restores it.

**Why.** Atlas's free tier (M0) has **no backups at all**, so one bad import or "clear all" was
unrecoverable. A Node script reuses the MongoDB driver the app already has, so there are no
extra binaries to install anywhere. It is also testable: an automated test restores a backup
into an in-memory MongoDB and checks the documents, types and indexes. We also restored a
backup of the real production data into a throwaway database and every count matched.

**Alternatives rejected.**
- *`mongodump`/`mongorestore`:* the industry standard, but needs MongoDB Database Tools
  installed on every machine and CI runner, and is harder to test in our suite. We'll switch
  if the data passes ~200 MB, since our script holds a backup in memory.
- *Upgrade to Atlas M10 for point-in-time restore:* the best protection, but costs money
  every month. Not justified at this scale.
- *Storing backups in S3/Drive:* another account and more credentials to manage. GitHub
  artifacts are free and already private to the repository.

**Trade-offs.** 30-day retention only. GitHub artifacts are visible to anyone with repo access,
which is why the file is encrypted. Losing the passphrase means losing the backups.
Scheduled workflows pause after 60 days of repo inactivity (documented in the RUNBOOK).

**Safety choices in the restore script.** It targets `RESTORE_MONGODB_URI`, never the app's
`MONGODB_URI`. It checks every collection *before* writing and aborts if any is non-empty,
so it can never half-merge into live data. Overwriting needs `--drop` plus an explicit
environment flag.

---

## 2026-10-05: Check the account on every request (token version)

**What.** The JWT now only proves *who* you are. On every request the server re-reads the
user's role, status, allowed years and `tokenVersion`. Logging out or resetting a password
increments `tokenVersion`, which invalidates every older token.

**Why.** Before, a token was trusted for its whole 12 hours. Disabling a user, demoting an admin,
or logging out did nothing until it expired. For a portal holding student marks, "fired at 10am,
still has admin access until 10pm" is not acceptable.

**Alternatives rejected.**
- *Short-lived access tokens + refresh tokens:* the standard large-scale answer, but two token
  types, rotation logic and a refresh endpoint. That's a lot of moving parts for 2–5 users.
- *A server-side blocklist of revoked tokens:* needs storage plus cleanup, and still doesn't make
  role changes apply immediately.

**Trade-offs.** One extra indexed database read per request. That's negligible here (a tiny
`users` collection), but it would deserve a short cache at thousands of requests per second.
Logout signs the user out on *all* their devices, because there is one counter per account.

---

## 2026-10-05: Marks have their own endpoint, with before → after audit

**What.** `PUT /api/internships/:id/marks` is the only way to edit one student's marks. It
accepts only the six mark fields and validates their ranges (0–100 external, 0–40 viva, 0/1
meeting and final report, whole weeks 0–52). Any invalid field rejects the whole update. The
audit log records each changed field's old and new value.

**Why.** Earlier hardening made the general record-edit route ignore mark fields, which is
correct. But the Evaluation page still sent marks there and then *displayed* the new values,
so edits looked saved but were silently thrown away. A separate endpoint keeps "edit
details" and "change marks" apart. Marks are the most sensitive data, so they get stricter
validation and a full history.

**Alternatives rejected.** Re-allowing marks on the general edit route would undo the
protection that stops imports and record edits from touching marks.

---

## 2026-10-05: Evaluation weights save only on an explicit admin action

**What.** The weights panel loads once. Admins edit, then click **Save weights** and confirm.
Staff see the weights read-only. The server rejects any save unless all six weights are present
and add up to exactly 100%.

**Why.** The page used to auto-save 400 ms after any change, *including on page load* before the
real weights had arrived. A slow or failed load could overwrite the real weights with defaults,
changing every student's final mark without anyone noticing. The old server handler also filled
missing values with defaults instead of rejecting them.

**Trade-offs.** One extra click to save, a deliberate bit of friction for a change that affects
the whole year's results.

---

## 2026-10-05: Stop tracking the student CSV; ignore all spreadsheets

**What.** `Internships 26 - All.csv` was removed from git tracking. `*.csv`, `*.xlsx`, `*.xls`
and `backups/` are git-ignored.

**Why.** The file holds ~408 real students' personal data and was pushed to a public GitHub
repository. Untracking stops future commits. **It is still in git history**: making the repo
private and purging history needs the owner's action.

---

## 2026-09-12: Two roles (admin, staff) instead of six

**What.** Only `admin` and `staff`, with a `requireRole()` hook that can grow later.
**Why.** Only 2 people use the portal. Roles for mentors and students who have no accounts would
be speculative code nobody can test. Staff are blocked from bulk deletes, evaluation weights and
mail credentials. Everything else is day-to-day work.
**Rejected.** A 6-role model (coordinator, mentors, examiner, student, viewer) is deferred until
those users exist.

## 2026-09-12: Keep one database per academic year

**What.** `spit-internships-<year>` per year plus the shared `spit-common`.
**Why.** Strong isolation (a mistake in one year cannot touch another), and it already works.
**Trade-off.** Cross-year reports are harder. Revisit at ~5+ years or the first cross-year report request.
