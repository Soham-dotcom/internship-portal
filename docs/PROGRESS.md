# Progress log

Newest first. What was built, how it was tested, what broke and how it was fixed.

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
scripts. 40 unit tests. Full detail in `docs/superpowers/plans/2026-09-12-portal-hardening.md`.
