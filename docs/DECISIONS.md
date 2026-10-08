# Decisions

One entry per significant choice: what, why, what else was considered, and what we gave up.
Newest first.

---

## 2026-10-09: Phase 5 scope: what was built, what was deliberately skipped

**Built:** CI, privacy (log redaction, export audit), accounts (change password, admin user
management), database-level validation, speed (evaluator directory, stale-search cancelling),
and the SheetJS security upgrade.
**Skipped on Soham's instruction:** concurrent-edit protection (A9), cookie-based sessions / 2FA
(B6), and the mobile layout pass (D7). They stay listed in `PLAN.md`.

---

## 2026-10-09: Upgrade SheetJS from its official CDN, not npm

**What.** `xlsx` 0.18.5 → 0.20.3 in all three installs (root, `backend/`, `frontend/`), installed
from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` and pinned by an integrity hash in each lockfile.
**Why.** `npm audit` flagged two **high** advisories (prototype pollution CVE-2023-30533, ReDoS
CVE-2024-22363), both reachable because the portal parses *uploaded* spreadsheets. The npm
registry has no fixed version: SheetJS stopped publishing there, and its documented channel is its own CDN.
**Rejected.** *Switching to `exceljs`:* rewriting every import and export for no functional gain.
*Staying on 0.18.5:* known, reachable, high-severity bugs in the code that handles untrusted files.
**Trade-off.** Installs now depend on `cdn.sheetjs.com` being reachable, and `npm update` won't
pick up new versions; upgrades are a deliberate URL change. The integrity hash means a tampered
tarball fails the install instead of slipping in.

---

## 2026-10-09: Evaluator directory: 3 queries instead of ~90 (measured)

**What.** The directory ran one populated query per mentor just to *count* students. It now runs
three queries in total (mentors, their groups, which of those students are active) and counts in memory.
**Measured on production data** (read-only, same machine, 5 runs each): external 90 queries /
median 997 ms → 3 queries / 81 ms; internal 95 → 3 queries / 992 → 77 ms. Output compared and
**identical** to the old implementation for both years.
**Not done, by measurement:** indexes on `groups.externalMentor`, `groups.students`,
`internships.branch` and `internships.assignedGroup`. Query plans showed full scans of 41 groups /
410 students in **0 ms**, so an index would add write cost and no read benefit. Revisit at about
10k records, or when any query exceeds 50 ms.

**Bug found while measuring:** populating a group's students threw `MissingSchemaError` when no
other route had registered the `Internship` model on that connection yet. In other words, the
evaluator directory crashed if it was the first page opened after a restart, which on Render
means after every deploy and every cold start. `getGroupModel` now registers the models it
references. A test runs it in a fresh process to prove it.

---

## 2026-10-09: Database-level validation ($jsonSchema), checked before switched on

**What.** MongoDB itself enforces the critical rules on `internships`: UID required, marks in range
(or null, meaning "not entered"), allowed values for branch, gender, type and profile, and dates
stored as dates. Extra fields are allowed. `validationLevel: "moderate"` never blocks edits to old
records. `npm run schema-validation` is **read-only by default**, reporting violations per year;
`--apply` switches the rules on.
**Why.** App-level validation only covers writes that go through the app. Scripts, the Atlas web UI
and future bugs bypass it.
**Found while checking production:** one 2026 record stores viva marks as `null`. That's a real "not
entered yet" state, so the rule was widened to allow it rather than "fixing" the data. After that,
production has 0 violations.
**Trade-off.** Applying needs a database user with `collMod` (the app user shouldn't have it), so
it's a deliberate, one-off admin step.

---

## 2026-10-09: Accounts managed in the portal, with lock-out protection

**What.** *My Account* (change your own password) and an admin *Users* page (create, change role,
status and years, reset password), backed by `/api/auth/change-password` and `/api/users`.
**Rules.**
- Changing a password requires the current one, and is rate-limited like login.
- Password rules: 12–128 characters, not containing the username.
- Admins can't demote or disable themselves, and the portal always keeps one active admin.
  Legacy records with no username never count; production has one with `role: admin`.
- Disabling an account or resetting a password signs that user out everywhere.
- Hashes and session internals never leave the server, and everything is audited without passwords.

**Why.** Running `manage-users.js` from a terminal meant only the developer could manage accounts,
so in practice both people shared one login, which defeats the audit log.

---

## 2026-10-09: Privacy: no personal data in server logs; every export audited

**What.** 24 routine `console.log` calls removed. Group export used to print the **entire request
body, every student's details**, on every export. Remaining error logs pass through `redact()`,
which masks email addresses, because MongoDB duplicate-key errors contain them. Server-side
exports are audited. Browser-side exports (records, evaluation scores, generated groups) report
themselves to `POST /api/audit-logs/export`.
**Trade-off.** The browser report is fire-and-forget: a failed report never blocks the download.
It records honest use, not a determined bypass; someone with API access can always fetch data
directly, and those fetches are authenticated reads.

---

## 2026-10-05: In-app dialogs and toasts as a tiny module store

**What.** `ui/feedback.js` exposes `confirmDialog`, `promptDialog` and `toast` as plain async
functions backed by a 60-line store; `<FeedbackHost/>` (mounted once) renders them. All 27
`window.confirm/prompt/alert` calls were replaced. Destructive dialogs are red, state their
consequences, and start with focus on Cancel. Bulk deletes use type-to-confirm.

**Why.** Native dialogs can't explain consequences, can't enforce "type the UID", block the page,
and look different in each browser. Plain functions, rather than a React context or hook, let code
outside components use them too, notably the axios interceptor that asks for a lock-override reason.

**Alternatives rejected.** *A UI library (MUI, react-modal):* a large dependency for two dialog
types. *A React context + hook:* the axios interceptor can't call hooks.

**Safety detail.** If the host isn't mounted, the functions fall back to the native dialogs
instead of resolving silently. A confirmation can never be skipped by accident.

---

## 2026-10-05: Cold starts: longer timeout + "waking up" notice; keep-warm left to an external pinger

**What.** API timeout raised from 20 s to 60 s, plus a toast while any request has been pending
for more than 4 s ("The server is waking up…").

**Why.** Render's free tier sleeps after ~15 minutes idle and takes 30–60 s to wake. With a 20 s
timeout, the first click after a quiet spell *failed*, so the portal looked broken.

**Rejected:** *a GitHub Action pinging every 10 minutes.* Once the repo is private, that's about 4,300
Actions minutes a month, over the free 2,000. A free external monitor (e.g. UptimeRobot hitting
`/api/health`) does the same job at no cost; see RUNBOOK. *Paying for Render* removes the problem
entirely and is the real fix if the budget allows.

---

## 2026-10-05: Session expiry: warn, explain, and return to the same page

**What.** The client reads the token's `exp` (only to *warn*; the server still verifies). A toast
appears 5 minutes before expiry; at expiry, or on any 401, the user goes to
`/login?reason=expired&next=<page>` and returns to that page, including its query string, after
signing in. `safeNextPath` only allows same-app paths, so a crafted `?next=https://…` link can't
redirect elsewhere (open-redirect protection).

**Why.** Before, a 401 silently dumped the user on the login page and then on the dashboard.
Half-filled work was lost with no explanation.

---

## 2026-10-05: Year lock and marks locks, with "admin + reason" overrides

**What.** A `yearsettings` document per academic year holds `locked` and a list of locked marks
components. One middleware (`enforceYearLock`) refuses every write to a locked year. Marks routes
also call `ensureMarksWritable(fields)`. Locked + staff → **423 Locked**. Locked + admin →
allowed only with a reason in the `X-Lock-Override-Reason` header, recorded in the audit log.
The frontend's axios interceptor turns a 423 that asks for a reason into a prompt, then retries
the same request, so no page needed its own lock code.

**Why.** Decisions D2 and D4. Once results are published, the risk is not a malicious user but
an honest mistake months later. A lock turns "be careful" into "you can't, unless you're an admin
and say why", and every override carries a reason in the audit trail.

**Alternatives rejected.**
- *Checking the lock inside every route:* ~40 write routes and easy to miss one. The middleware
  is default-deny for writes, with a short explicit list of read-only POSTs (exports, previews).
- *Admin overrides without a reason:* that would make the lock meaningless for the one role
  that can bypass it.
- *A separate "unlock, edit, re-lock" flow:* three steps, and people forget the third.
  Per-request reasons keep the year locked.

**Trade-offs.** One extra small read per write request (the settings document). The 423 status
("Locked", from WebDAV) is less common than 403, but describes exactly this situation, and lets
the frontend tell "you can never do this" (403) apart from "this is frozen" (423). Refused
attempts are audited as `lock.refused`.

---

## 2026-10-05: Full audit coverage; history is read from the audit log

**What.** Every route that changes data now writes an audit entry (16 didn't), including sign-in
attempts (never passwords). Record edits store each changed field's old and new value. An admin
Audit Log page searches by action, user, student UID and date. A per-student **History** combines
the audit log with import records into one timeline.

**Why.** "Who changed this mark, and from what?" must always have an answer, especially once
more than one person can write.

**Alternatives rejected.** *A `lastEditedBy`/`lastEditedAt` field on each student* (the original
plan item A16) only shows the *last* change, and every write path, including bulk writes, would
have to remember to set it. Reading the history from the audit log gives the full trail with no
extra writes.

**Trade-offs.** History only goes back to when auditing was switched on (this deploy); earlier
changes are invisible. The audit log grows without limit. At this portal's scale (a few thousand
entries a year) that's fine, and a retention rule is listed in PLAN phase 5 (C5).

---

## 2026-10-05: Repository cleanup and removing student data from history

**What.** Removed 37 files that deployment and development don't need: 17 overlapping or stale
markdown guides (they described routes and fields that no longer exist), 11 one-off debug and
seed scripts (several already broken), 3 finished database migrations, and Create React App
boilerplate. They were copied to a local archive folder next to the project before removal.
The real student spreadsheet was purged from **all of git history**, not just untracked, and a
real student's details were replaced in the downloadable import template.

**Kept on purpose.** `backend/package.json` *and* the root `package.json`. Both were added in
the same "deployment" commit, and it isn't recorded which one Render builds from. Deleting the
wrong one would take production down, so the duplicate stays until the Render settings are
confirmed. `scripts/init-year.js` (needed each new academic year) and
`backfill-company-names.js` (needed if company-name normalisation changes) also stay.

**Trade-off.** Rewriting history changes every commit hash after the CSV was added, so any other
clone must be re-cloned. A pre-rewrite backup bundle is kept locally, outside OneDrive.
GitHub may still serve the old commits by hash from its cache until they are garbage-collected,
which is why the repo should also be made private.

---

## 2026-10-05: Import preview, add-only by default, and undo

**What.** `POST /upload/import` first builds a plan for every row: new / changed (field-level
before → after) / unchanged / in the Recycle Bin / error. `dryRun: true` returns the plan
without writing, and the page always shows it before the Import button is enabled. Applying
recomputes the same plan and writes it in one transaction, together with an `ImportBatch`
document listing the inserted ids and every changed field's old and new value. "Undo last
import" moves the added students to the Recycle Bin and reverts changed fields.

**Rules.**
- **Add-only by default:** existing students are never modified unless the user picks "also update".
- **Blank never erases:** a missing column or empty cell is not sent, so it can't overwrite data.
- **Errors block the import** unless the user ticks "skip these rows".
- **Undo is careful:** only the most recent import, only once, and a field is reverted only if it
  still holds the imported value. A later edit is kept and reported as a conflict.

**Why.** Imports were the riskiest operation in the portal: one click silently overwrote existing
students, with no way to see what would change and no way back. Building the preview also
exposed three real bugs in the page's parser: blanks and missing date columns were sent as `''`
and *today's date* (every import reset start/end dates); rows without a UID got invented IDs
(`AUTO-1`) that collide across sheets; and Excel dates arrived as serial numbers.

**Alternatives rejected.**
- *Snapshot the whole collection before each import:* simple, but restoring it would also wipe
  every unrelated edit made since. The batch records exactly what this import did, so undo
  touches nothing else.
- *Allow undoing any past import:* undoing an older import after a newer one has changed the
  same students gets hard to reason about. Latest-only keeps undo predictable.

**Trade-offs.** Undo only covers the student-records import; marks imports are protected by
validation and the audit log, and by backups. Plans are capped at 200 rows in the preview
response (counts are always complete).

---

## 2026-10-05: Soft delete for students, enforced in the model

**What.** Deleting a student sets `deletedAt`/`deletedBy`. A Mongoose query middleware on the
Internship model adds `deletedAt: null` to every find, count, distinct, update and aggregate,
unless the caller explicitly opts in with `setOptions({ withDeleted: true })`. Only admins can
see the Recycle Bin, restore, or permanently delete, and permanent delete only works on a
student already in the bin.

**Why.** A student record holds a semester of marks. A hard delete was one API call from gone
forever. Putting the filter in the model rather than in each route means a route added next year
can't forget it: lists, analytics, group member lists, the evaluation overview and edits all
respect it automatically (an integration test checks each path).

**Alternatives rejected.**
- *A `deletedAt` filter in every route:* 40+ queries, and one forgotten filter shows deleted
  students in a report.
- *Moving deleted records to a separate "trash" collection:* restore becomes a copy-back that
  can collide on the unique UID, and group references break.

**Trade-offs.** `bulkWrite` and `estimatedDocumentCount` have no Mongoose hooks. The two
`bulkWrite` callers select targets with a filtered query first. A deleted student's UID stays
reserved (unique index), so re-adding them means restoring, which is the behaviour we want.
Only students are soft-deleted. Groups can be regenerated, and mentors are re-importable
directory data, both covered by backups. The bin is fed by Student Record Management's
"Move to Recycle Bin" button (originally "Remove Student Record"; this entry first said no such
button existed, which was wrong and was corrected on 2026-10-05) and by "undo import".

---

## 2026-10-05: Transactions for multi-step group writes

**What.** `withTransaction(fn)` in `db/connection.js`. Generate groups, unassign and clear-all
each run as one MongoDB transaction. Generate also re-checks at write time that every student is
still unassigned, and aborts with 409 otherwise.

**Why.** Each of these did 2–4 separate writes. A failure in between left students "assigned"
to groups that didn't exist, or listed in a group after being unassigned. Two people generating
at the same moment could also put one student in two groups.

**Trade-offs.** Transactions need a replica set. Atlas (including free M0) always is one, but a
plain local `mongod` is not, so local development must use Atlas or a single-node replica set.
Tests use `MongoMemoryReplSet`, and include forced mid-operation failures that must roll back.

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
