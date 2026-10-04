# Progress log

Newest first. What was built, how it was tested, what broke and how it was fixed.

## 2026-10-05: Phase 3: lock and trace

**Built**
- **A4 Year lock** and **A5 marks locks** (`middleware/locks.js`, `routes/year-settings.js`,
  admin page *Locks & Finalisation*). Staff are refused (423). Admins are prompted for a reason,
  which is audited. A banner shows on every page while the year is locked.
- **A14 Audit coverage:** 16 previously unaudited write routes, sign-in attempts, old → new
  values on record edits, `lock.override` / `lock.refused` entries.
- **A15 Audit Log page** (admin) with filters and pagination. **A16 Student History**
  popup on the Marks & Evaluation page.
- Repository cleanup (37 files removed, archived locally), and the student CSV purged from all
  git history. Pushed by Soham; Render and Vercel verified running the new code.

**Tested**
- `npm test`: 158 tests, all passing (16 suites). New: locks (year + marks, staff/admin/reason,
  previews still allowed when locked, refused attempts audited), history and audit-log search,
  driven through the real routes.
- **In the real app** (throwaway local replica set, test accounts): admin locked "Industry
  evaluator marks" and the year from the new page. The banner appeared. An admin name edit
  triggered the reason prompt and saved. History showed who, when, the reason and old → new.
  Staff saw the read-only banner, got a clear refusal with no prompt, and data was unchanged.
  The Audit Log filtered by action and showed the override reason.

**Bugs found and fixed**
- Refused attempts on a locked year were not audited: the lock middleware answered before the
  route's audit step. Now logged as `lock.refused`. Found while checking the Audit Log page.
- Success message said "Saved marks" when only a name changed.

## 2026-10-05: Phase 2: making mistakes recoverable

**Built**
- **A7 Marks-import validation:** one shared, tested handler for the five single-field marks
  imports. Any invalid mark rejects the file and writes nothing. Decimals are kept. Changes are
  audited as `{uid, from, to}`. One `bulkWrite` instead of a round trip per row.
- **A8 Transactions:** generate / unassign / clear-all are all-or-nothing (`withTransaction`).
- **A3 Soft delete + Recycle Bin:** students are hidden, not erased. Admin-only bin with
  restore and permanent delete (UID must be typed to confirm). New page `/recycle-bin`.
- **A6 Import preview:** every import shows new / changed (field by field) / unchanged /
  binned / error rows before anything is written. Add-only by default.
- **A2 Undo last import:** added students go to the Recycle Bin; changed fields revert unless
  someone edited them since.

**Tested**
- `npm test`: 143 tests, all passing (14 suites). New: marks-import planner + route with real
  `.xlsx` uploads, group transactions with forced mid-operation failures, soft delete across
  every read path, import planner + preview/apply/undo route.
- **In the real app** (built frontend + real backend on a throwaway local replica set, test
  accounts): a sheet with one changed, one unchanged, one new, one invalid-branch and one
  missing-UID row previewed exactly right. Import stayed disabled until the error rows were
  explicitly skipped. "Also update" changed the company but kept a stored remark despite a blank
  cell. Undo reverted the change and moved the new student to the bin. Staff could not see or
  call the bin (403). The admin restored the student from the bin.
- Frontend `CI=true` build compiles cleanly.

**Bugs found and fixed**
- *Zero treated as blank:* `String(value || '')` turned a numeric `0` ("did not attend") into
  `''`. Caught by a planner test; fixed with `??`.
- *Marks truncated:* the old imports used `parseInt`, so a viva mark of 32.5 became 32.
- *Import overwrote data with blanks and "today":* the page's parser sent missing columns as `''`
  and missing dates as `new Date()`. The real sheet has no date columns, so **every import so far
  set start/end dates to the import time**. The stored dates are not meaningful.
- *Invented UIDs:* rows without a UID were imported as `AUTO-1`, `AUTO-2`… (colliding across
  sheets), and the "Sr No" column was accepted as a UID.
- *Stale analytics after an update import:* the derived `standardized_company_name` was hidden
  from the diff and therefore not written. Caught by an integration test.
- *Clear-all query bug:* `{ $ne: null, $ne: '' }` in one object keeps only the last `$ne`. Replaced with `$nin`.

**Noticed, not yet acted on**
- Production start/end dates are import timestamps, not real internship dates (see above).
- Local development now needs a replica set (Atlas, or `mongod --replSet`), because of transactions.

## 2026-10-05: Phase 1 of the data-protection plan

**Built**
- Committed the earlier hardening work (roles, audit log, rate limits, write whitelists, tests).
- Stopped tracking the real student CSV; git now ignores spreadsheets and backups.
- **Instant session control:** per-request account check plus `tokenVersion`. New
  `POST /api/auth/logout`, and the frontend Logout button calls it.
- **Evaluation weights:** explicit admin-only Save with confirmation. The server validates
  (`utils/evaluationSettings.js`). The auto-save on page load is gone.
- **Marks endpoint** `PUT /api/internships/:id/marks` with range validation (`utils/marks.js`)
  and before → after audit. The Evaluation page uses it and shows the stored values. UID is no
  longer editable inline.
- **Admin-only UI:** "Delete All evaluators" and "+ Add New Sender Email" hidden from staff.
- **Backups:** `npm run backup` / `npm run restore`, a nightly encrypted GitHub Action, and `docs/RUNBOOK.md`.

**Tested**
- `npm test`: 90 tests, all passing (unit + integration against in-memory MongoDB).
- Session integration: logout, disable and demote each cut off an existing token immediately.
- Marks integration: saves valid marks, rejects out-of-range marks with no partial write,
  ignores smuggled `uid`/`name`, writes old/new values to the audit log.
- Backup round trip: encrypted backup → restore keeps documents, ObjectId/Date types and unique
  indexes; refuses to restore over non-empty data; wrong passphrase fails.
- **Real data:** backed up production (read-only, 1,378 documents across 16 collections),
  restored it into a throwaway in-memory MongoDB, and all counts and the unique `uid` index
  matched. The local copy was deleted afterwards.
- **In the real app** (built frontend + real backend on a throwaway in-memory database with
  generated test accounts):
  - admin: weights load with no save request on page load; 110% is refused, 100% saves and survives a reload
  - inline mark edit saves and survives a reload; viva 99 is refused with a clear message; UID not editable
  - staff: weight inputs disabled with an explanation; a direct API call to change weights gets 403;
    "Delete All evaluators" not shown
  - Logout calls the server, and the old token then gets 401 "Your session has ended"
  - *Not clicked through:* hiding "+ Add New Sender Email" for staff (needs a group with a mentor
    in the mail dialog). It's a one-line conditional, and the server refuses staff anyway.
- Frontend: `CI=true` production build (warnings fail) compiles cleanly.

**Bugs found and fixed**
- *Inline mark edits silently discarded.* The record-edit route had been whitelisted to ignore
  marks, but the Evaluation page still sent marks there and showed them as saved. Fixed with
  the dedicated marks endpoint.
- *Weights could reset to defaults* if the settings request was slow (Render cold start),
  because the auto-save fired before the real values had loaded. Fixed by removing auto-save.
- *Save/Discard buttons missing after my first edit:* a scripted replacement silently failed on
  Windows CRLF line endings. Caught by the strict build's "assigned but never used" warning,
  then fixed. Lesson: treat lint warnings as errors locally too, which Vercel does with `CI=true`.
- *Canonical EJSON turned metadata numbers into wrapper objects*, so the backup version check
  failed. Fixed by keeping metadata as plain JSON and only the data in canonical EJSON.

**Noticed, not yet acted on**
- `spit-internships-2025.weeklyreports` (274 docs) has no model in the current code; it's a
  legacy collection. Backups include it; don't delete it without checking.
- `spit-common.users` holds two orphaned records with no username, from an older schema.
- No `auditlogs` exist in production yet: the audit trail starts with this deploy.

## 2026-09-12: Hardening phase 0 (earlier session)
Roles, year access, rate limiting, lockout, helmet, upload limits, field whitelists, audit
log, regex escaping, error redaction, Bootstrap removal, error boundary, guarded destructive
scripts. 40 unit tests. (The original audit plan was archived during the 2026-10-05 repo cleanup; its open items live in `docs/PLAN.md`.)
