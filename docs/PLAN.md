# Plan: security, data protection and smoothness

Agreed 2026-10-05. The goal: the portal's data cannot be wrongly edited or deleted, and if it
ever is, the change is recorded and can be undone.

Four layers: **Prevent** wrong changes · **Record** every change · **Recover** from any
mistake · keep it **Smooth** so people don't make mistakes in the first place.

## Product decisions (from Soham, 2026-10-05)

| # | Question | Decision |
|---|---|---|
| D1 | Atlas plan | **Free (M0)**: no built-in backups, so we build our own (A1) |
| D2 | Editing a year after it is locked | **Admin only**, with a recorded reason |
| D3 | Deleting a student | **Soft delete only**. Admin alone can restore or permanently remove. |
| D4 | Re-uploading marks | Staff may overwrite **until the marks are locked**; after that admin only |

## Phases

### Phase 1: urgent ✅ (2026-10-05)
| ID | Item | Status |
|---|---|---|
| 0.1 | Commit the existing hardening work | ✅ |
| 0.2 | Stop tracking the student CSV; ignore spreadsheets and backups | ✅ untracked. **Repo private + history purge pending (needs Soham)** |
| 0.3 | Individual login per person | ⏳ Soham to create the second account (RUNBOOK §3) |
| A1 | Nightly encrypted backups + tested restore | ✅ code + workflow; real-data restore verified. **Secrets setup pending (needs Soham)** |
| A13 | Evaluation weights: explicit admin-only Save, server validates sum = 100 | ✅ |
| B1 | Hide admin-only controls from staff | ✅ |
| B3 | Disable / demote / logout take effect immediately | ✅ |
| — | Fix: inline mark edits were silently discarded | ✅ new audited `PUT /internships/:id/marks` |

### Phase 2: make mistakes recoverable ✅ (2026-10-05)
| ID | Item | Status |
|---|---|---|
| A3 | Soft delete + admin Recycle Bin with restore (D3) | ✅ students. Groups/mentors deliberately not (regenerable; see DECISIONS) |
| A6 | Import preview: new / changed (before → after) / errors; add-only default | ✅ |
| A7 | Range-check marks in the marks imports | ✅ the five single-field imports; weekly reports are text, not marks |
| A8 | Transactions for multi-step writes | ✅ generate, unassign, clear-all, permanent delete |
| A2 | Undo last import | ✅ per-import record, not a whole-collection snapshot (see DECISIONS) |

### Phase 3: lock and trace ✅ (2026-10-05)
| ID | Item | Status |
|---|---|---|
| A4 | Year lock (D2): staff refused, admin needs a recorded reason | ✅ |
| A5 | Per-component marks locks (D4) | ✅ |
| A14 | Audit old → new values; cover every write route | ✅ incl. sign-ins and refused lock attempts |
| A15 | Admin audit-log page | ✅ |
| A16 | "Last edited by" on records | ✅ as a full per-student History (see DECISIONS) |

### Phase 4: smoothness ✅ (2026-10-05)
| ID | Item | Status |
|---|---|---|
| D1 | Cold-start "waking up" state + keep-warm | ✅ notice + 60 s timeout. Keep-warm: external pinger, Soham to set up (RUNBOOK §6) |
| D2 | Dialogs and toasts; Undo after delete | ✅ all 27 native dialogs replaced |
| D3 | Loading skeletons and empty states | ✅ plus real error states |
| D4 | Session-expiry warning, return to the same page | ✅ |

### Phase 5: everything else (2026-10-09)
| ID | Item | Status |
|---|---|---|
| E | CI | ✅ `.github/workflows/ci.yml` (staging database not set up) |
| C2, C3 | Export audit, log redaction | ✅ |
| C4 | `xlsx` upgrade | ✅ 0.20.3 from SheetJS CDN |
| B4 | Change-password page | ✅ |
| B2 | User-management page | ✅ |
| A10 | MongoDB schema validation | ✅ code + check (0 violations); **`--apply` on production needs Soham's OK** |
| D5 | Speed | ✅ evaluator directory 90 → 3 queries; indexes measured and not needed yet |
| D6 | Stale-request cancelling | ✅ group search |
| A9, B6, D7 | Concurrent edits, cookie/2FA, mobile | ⏸ skipped on request |
| A11 | Least-privilege DB user | ⏳ Atlas setting, Soham |
| C1, C5 | Field projection, retention | ⏳ not started |
