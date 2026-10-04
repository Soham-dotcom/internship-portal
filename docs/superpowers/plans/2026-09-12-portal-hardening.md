# Internship Portal — Hardening & Polish: Audit + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make the SPIT Internship Portal trustworthy, reliable and professional enough to open up beyond its current 2 users — without a rewrite.

**Architecture:** Keep the existing MERN + per-academic-year-database design. Add a thin authorization layer, a validation layer, an audit trail, and a consistent UI system on top of what already exists. No new infrastructure.

**Tech Stack:** React 19 (CRA) · Tailwind · Recharts · Express 4 · Mongoose 7 · MongoDB Atlas · Render + Vercel

**Spec:** User brief of 2026-09-12 (Phases 1–11), plus `PROJECT_ANALYSIS_AND_RBAC_ROADMAP.md`

## Global Constraints

- **No rewrite.** Smallest change that properly solves the problem.
- **No new infrastructure**: no microservices, queues, k8s, distributed cache, sharding.
- **Security > correctness > reliability > UX polish > optimization.**
- **Never trust the frontend** — every permission enforced server-side.
- Maintainable by a college student/small team. Avoid unnecessary dependencies.
- Preserve all currently working functionality and workflows.
- Optimize for today's scale (~2 users, a few hundred records/year), cheap hooks for tomorrow.

---

## Status — 2026-09-12

**Phase 0 is largely complete.** Verified: backend boots, security headers and rate
limiting confirmed live over HTTP, **40 unit tests passing**, frontend compiles
successfully (357 kB JS / 5.69 kB CSS — the CSS dropped sharply once Bootstrap was removed).

Done: A1 A2 A3(partial) A4 A5 A6 A7 A8 · B1 B2 B4 · C2 · D2 D5 D6 · E1 · F1 F4 · I2 · K3 K4 · L1 · M2 M1a(partial)
Also: dependency upgrades (13 → 4 vulnerabilities), 30 mojibake characters repaired,
destructive scripts quarantined behind a guard, user-administration script added.

Still open in Phase 0: C1/I1 (structured logging with PII redaction), E6 (backup runbook),
and applying the role decision to live accounts — see **Open Items** below.

### Two findings that changed the plan's assumptions

1. **There is only one working login account.** The shared `users` collection holds three
   documents, but two are orphaned records from an earlier schema iteration (they have
   `email`/`name`/`isActive` and no `username`, one with a legacy `role: "teacher"`), so
   `User.findOne({ username })` can never match them. Only
   `internshipAdministrator@spit.ac.in` can actually sign in — meaning **both people are
   sharing a single admin account**. No audit trail can tell them apart until a second
   account exists. The orphans have not been touched pending a decision.

2. **The repository lives inside OneDrive, and `node_modules` is being cloud-synced.**
   388 of 4,000 sampled dependency files carry the `Offline` attribute. Node's
   `readFileSync` fails on these with `errno -4094 UNKNOWN`, which is what broke the
   production build and the test run — non-deterministically, and with an error message
   that points nowhere near the real cause. It also explains 15-minute build times.
   Verification for this session was performed outside OneDrive to get trustworthy results.
   **Recommended fix:** move the project to a non-synced path (e.g. `C:\dev\`), or exclude
   `node_modules` from OneDrive sync.

---

## 0. Executive Summary

The codebase is **better than average for a student project** and does not need a rewrite. There
is a real design system in `index.css`, a sensible per-year data isolation model, encrypted
mail credentials, and bcrypt+JWT auth. The problems are concentrated in four places:

1. **There is no authorization at all.** Every logged-in user is a full administrator with
   delete-everything power over every academic year. With 2 trusted people this is survivable.
   **The moment a third person logs in, it is not.** This is the single blocker to your stated goal.
2. **A schema/UI mismatch is silently producing wrong numbers.** The `status` field is queried
   in 6 places but does not exist in the `Internship` schema — so the Dashboard's "Completed
   Internships" and "Pending Approvals" always read 0, the analytics status chart is empty, and
   StudentPicker's status filter always returns nothing. A portal that shows confidently wrong
   numbers destroys trust faster than one that looks plain.
3. **Bootstrap and Tailwind are both loaded.** `index.js:3` imports the full Bootstrap stylesheet
   while every component is written in Tailwind. Their base/reset styles fight each other. This is
   the root cause of the "doesn't feel polished/consistent" symptom — and it is a one-line fix.
4. **The app is desktop-only and inaccessible.** 104 `<label>` elements, **zero** `htmlFor`
   attributes. Near-zero responsive classes on the largest pages. 3 ARIA attributes in 6,466 lines.

### My main recommendation — and a pushback

In my earlier `PROJECT_ANALYSIS_AND_RBAC_ROADMAP.md` I proposed a 6-role RBAC system
(`super_admin`, `coordinator`, `internal_mentor`, `external_examiner`, `student`, `viewer`).

**Do not build that now.** For 2 users it is over-engineering, and it is exactly the kind of
"enterprise architecture we don't currently need" you asked me to avoid. Building role scoping
for mentors and students who do not yet have accounts means maintaining speculative code paths
you cannot test against real usage.

**Build a 2-role model instead** — `admin` and `staff` — which costs ~4 hours, closes the actual
security hole, and leaves the exact same hook (`role` on the user, `requireRole()` middleware) to
expand into later when real mentors and students arrive. The full role set stays in Phase 4 as a
documented future step, not as code.

---

## 1. How the System Actually Works (verified against code, not docs)

### 1.1 Request flow

```
Browser (Vercel SPA)
  └─ ProtectedLayout → isAuthenticated() → localStorage 'auth_token' present?   [frontend gate only]
       └─ axios interceptor attaches  Authorization: Bearer <jwt>
            └─ Express (Render)
                 ├─ cors(allowlist)                          server.js:67
                 ├─ express.json({limit:'50mb'})             server.js:69
                 ├─ /api/* → 503 if mongoose not connected   server.js:101
                 ├─ /api/auth/*  → PUBLIC                    server.js:112
                 ├─ /api/*       → authRequired (verify JWT only, NO role check)  server.js:113
                 └─ router → getYearDb(req.year) → mongoose.useDb('spit-internships-<year>')
                      └─ Mongoose model → MongoDB Atlas
```

### 1.2 Login flow (the important one)

`POST /api/auth/login { username, password, year }` → `backend/routes/auth.js`
1. Checks `year` is in the global `ACADEMIC_YEARS` env list — **not** that this user may access it.
2. `User.findOne({username})` against the shared `spit-common` DB.
3. `bcrypt.compare`; if the doc has a legacy plaintext `password`, it compares directly and
   upgrades to a hash on success (`auth.js:38-44`).
4. Signs `{ sub, username, year }` for 12h.

**Consequence:** the `year` is a value the client picked from a dropdown. One account can log in
three times choosing three different years and hold three tokens, one per year database. Year is
a *selector*, not a *permission*.

### 1.3 Feature inventory (verified working unless noted)

| Feature | Status |
|---|---|
| Excel bulk import w/ header auto-map + UID upsert | Works |
| Group generation + auto-balance + duplicate prevention | Works |
| Internal/external mentor allocation + conflict detection | Works via `PUT /groups/:groupId/assign-mentor` |
| Mentor group mail w/ Excel attachment + templates | Works |
| 6 evaluation-data Excel imports | Works |
| Weighted evaluation scoring + overview | Works |
| Company analytics (aggregation + Recharts) | Works |
| Dashboard "Completed"/"Pending" cards | **BROKEN — always 0** (E1) |
| Analytics status distribution | **BROKEN — empty** (E1) |
| StudentPicker status filter | **BROKEN — returns nothing** (E1) |
| `PUT /api/groups/:id` (group edit) | **BROKEN — ReferenceError 500** (D2) |
| `GET /api/health` | **Returns 401** — sits behind `authRequired` (B4) |
| `npm run seed-salary` | **BROKEN** — references missing `backend/seed-with-salary.js` (K4) |

---

## 2. Improvement Audit

Priority: **CRITICAL** = unsafe/broken today · **HIGH** = fix before more users · **MEDIUM** = fix soon · **LOW** = when convenient.
"When": **NOW** = before onboarding user #3 · **SOON** = next iteration · **DEFER** = revisit when scale/roles demand it.

### A. Security & Trust

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| A1 | No security headers | Clickjacking, MIME sniffing, no CSP. Free to fix. | No `helmet` → add `helmet()` + CSP; add headers to `vercel.json` | HIGH | 1.0 | — | NOW |
| A2 | No login rate-limit or lockout | Unlimited password guessing against a live endpoint | Nothing → `express-rate-limit` on `/api/auth/login` + `failedLoginAttempts`/`lockUntil` on User | CRITICAL | 1.5 | — | NOW |
| A3 | Raw `error.message` returned on every 500 | Leaks schema fields, index names, driver internals | `res.json({message: error.message})` → generic message + server-side log w/ request id | HIGH | 1.0 | I1 | NOW |
| A4 | Default seed password `Spit@2026!` in repo | `scripts/seed-user.js:13`. If the deploy used it, the admin password is public | Default → require `SEED_PASSWORD`, fail without it; rotate live password | CRITICAL | 0.5 | — | NOW |
| A5 | No audit trail | No record of who deleted a student, cleared groups, changed marks or sent mail | None → `AuditLog` collection in shared DB + middleware on mutations | HIGH | 3.0 | B1 | NOW |
| A6 | Secrets may exist in git history | If `.env` was ever committed, every secret is public | `.gitignore` correct now → verify history, rotate if found | CRITICAL | 0.5 | — | NOW |
| A7 | Regex/ReDoS injection via query params | `new RegExp(userInput)` in 4 routes → CPU DoS + filter bypass | Raw interpolation → escape input, anchor exact matches | HIGH | 1.5 | — | NOW |
| A8 | Unbounded uploads + 50MB JSON | `multer` has no `limits`; memory storage. A few uploads OOM the Render dyno | No limits → `limits.fileSize` 5MB, extension+MIME check, JSON limit 1MB (higher only on `/upload/import`) | HIGH | 1.0 | — | NOW |
| A9 | `xlsx@0.18.5` (frontend **and** backend) | CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS; parses untrusted uploads; unmaintained on npm | 0.18.5 → maintained SheetJS build or `exceljs` | HIGH | 2.0 | — | SOON |
| A10 | JWT in `localStorage`, no CSP | Any XSS = full token theft | localStorage → (later) `httpOnly` cookie + CSRF. Needs SameSite=None across Vercel↔Render | MEDIUM | 3.0 | A1 | DEFER |

### B. Authentication / Authorization

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| B1 | **No authorization layer** | Any logged-in user can delete all students, wipe all groups, change evaluation weights, send mail as the office, across every year | `authRequired` only → add `role: 'admin'\|'staff'` + `requireRole()` guarding every mutation | CRITICAL | 4.0 | — | NOW |
| B2 | Year chosen by client at login | One account reaches every year's database | Trust login body → store `allowedYears` on User, validate `req.year` against it | HIGH | 1.5 | B1 | NOW |
| B3 | No logout invalidation / no refresh token | 12h stateless window; a leaked token stays valid | Stateless JWT → acceptable at this size; document it | LOW | 2.0 | — | DEFER |
| B4 | `GET /api/health` returns 401 | Uptime monitors can't check the API; mounted after `authRequired` | Move above the auth middleware | LOW | 0.25 | — | SOON |
| B5 | No per-user resource ownership yet | No IDOR surface *today* (single tenant), but appears the moment mentors get accounts | — → design ownership scoping with B1 hook | MEDIUM | — | B1 | DEFER |

### C. Data Protection & Privacy

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| C1 | Student PII logged to Render logs | `console.log` of request bodies, emails, names, phones in send-mail/mail-draft/upload | Verbose emoji logs → structured logger w/ redaction, no bodies at info level | HIGH | 1.0 | I1 | NOW |
| C2 | Mass assignment on writes | `$set: record` / `findByIdAndUpdate(id, req.body)` — client controls **every** field including `external_marks`, `internal_viva_marks` | Raw body → per-role field whitelist before any write | HIGH | 2.0 | B1 | NOW |
| C3 | APIs return whole documents | Phone, email, stipend, CTC returned where only name/UID is rendered | No projection → `.select()` the fields each endpoint actually needs | MEDIUM | 1.5 | — | SOON |
| C4 | Anyone can add a sender email & send mail | Reputational: mail goes out as the placement office | Open to all → `admin` only + audit each send | MEDIUM | — | B1,A5 | NOW |

### D. Backend / API Reliability

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| D1 | No request validation | Malformed/hostile bodies reach Mongoose; unclear 400s | None → `zod` schemas on all mutating routes | HIGH | 3.0 | — | SOON |
| D2 | `PUT /api/groups/:id` throws `ReferenceError` | Uses `Mentor`/`InternalMentor` not in scope (`groups.js:1368,1396`) → 500 | Fix destructure or delete the dead route | HIGH | 0.5 | — | NOW |
| D3 | Inconsistent status codes / envelopes | Some errors 400, some 500, some 404 for the same class of failure | Ad-hoc → shared `ApiError` + consistent `{success, data\|message}` | MEDIUM | 1.5 | D4 | SOON |
| D4 | No global error handler / no `unhandledRejection` | A thrown async error can take the process down | Per-route try/catch → central error middleware + process handlers + graceful SIGTERM | MEDIUM | 1.0 | — | SOON |
| D5 | Biased shuffle | `sort(() => Math.random()-0.5)` for group assignment and random student pick — **not uniform**. In a college context, selection fairness is a real concern | Biased sort → Fisher–Yates | MEDIUM | 0.5 | — | SOON |
| D6 | `uuid` import inverted + dep missing | `groups.js:10` always falls through to the timestamp fallback; `uuid` isn't in `package.json` | → use `crypto.randomUUID()` | LOW | 0.25 | — | SOON |

### E. Database

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| E1 | **`status` queried but not in schema** | Dashboard cards read 0, analytics chart empty, picker filter dead, exports blank. Visibly wrong data = lost trust | Missing field → **product decision**: add `status` enum + backfill, *or* remove the dead UI. See Open Question Q2 | HIGH | 2.0 | — | NOW |
| E2 | Missing indexes | `Group.find({externalMentor})`, `{internalMentor}`, `{students}`, `Internship.find({branch})`, `{assignedGroup}` all collection-scan | Only `uid`+`standardized_company_name` → add 5 indexes | MEDIUM | 1.0 | — | SOON |
| E3 | No pagination | `GET /api/internships` returns every record | Unbounded → `limit`/`skip` + total count | MEDIUM | 2.0 | — | SOON |
| E4 | `weekly_report_data` is `Mixed`, unvalidated | Arbitrary shapes can be written | Mixed → validate keys `week1..weekN` on write | LOW | 0.5 | D1 | DEFER |
| E5 | Dead `viva_marks` field | Confusion vs `external_viva_marks`/`internal_viva_marks` in reports | → remove after confirming no data depends on it | LOW | 0.25 | — | SOON |
| E6 | No documented backup/restore | A bad import or `clear-all` is unrecoverable. This is a **trust** issue for a college portal | None → enable Atlas backups, write a restore runbook, test it once | MEDIUM | 1.0 | — | NOW |

### F. Frontend / UI

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| F1 | **Bootstrap CSS loaded alongside Tailwind** | `index.js:3` imports full Bootstrap; `react-bootstrap` installed but never used. Conflicting resets cause the inconsistent typography/spacing/buttons you're feeling. ~230KB dead CSS | Both → drop Bootstrap, uninstall both packages, Tailwind only | HIGH | 1.0 | — | NOW |
| F2 | Design system exists but is bypassed | `index.css` defines `btn-primary`, `form-input`, `data-table`, `alert-*`, `badge-*` — yet pages use ad-hoc Tailwind + 14 inline `style={{}}` in AllGroups alone | Mixed → apply the existing classes everywhere, remove inline styles | MEDIUM | 3.0 | F1 | SOON |
| F3 | `AllGroups.js` is 1,202 lines | ~30 `useState`, 4 modals, 24 try/catch in one component. Highest-risk file to change | Monolith → split into `GroupList`, `EditGroupModal`, `SendMailModal`, `MailDraftModal`, `AssignMentorModal` | MEDIUM | 4.0 | — | DEFER |
| F4 | Dead / fragmented files | `InternshipList_improved.js` (179 lines, unused); `api/mentorEdit.js` is 2 lines, `api/analytics.js` 7, `api/mail.js` 10, beside a 321-line `axios.js` | → delete dead file, consolidate api modules | LOW | 0.5 | — | SOON |
| F5 | Native `alert()`×2 and `window.confirm()`×19 | Browser dialogs look unprofessional and can't explain consequences ("this deletes 47 records") | Native dialogs → shared `<ConfirmDialog>` + `<Toast>` | MEDIUM | 3.0 | F1 | SOON |

### G. UX / Accessibility

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| G1 | **Zero `htmlFor`** on 104 labels / 114 inputs | Clicking a label doesn't focus its field; screen readers announce nothing. Cheapest credibility win available | 0 associations → `id` + `htmlFor` on every field | HIGH | 2.0 | — | SOON |
| G2 | Almost no ARIA (3 in 6,466 lines) | Sidebar toggle, modals, sortable headers are unlabelled; no focus trap in modals | → `aria-label`, `role="dialog"`, `aria-modal`, focus trap + Esc to close | MEDIUM | 2.0 | F5 | SOON |
| G3 | **Desktop-only** | AllGroups (1,202 lines) has **1** responsive class; ExcelUpload and EvaluationOverview have **0**. Wide tables overflow the viewport; sidebar fixed at 240px | → responsive pass: horizontal-scroll table wrappers, stacked filters, collapsible sidebar, mobile modals | HIGH | 4.0 | F1 | SOON |
| G4 | Inconsistent loading/empty states | `loading-spinner` class exists but several pages render nothing or jump; some pages lack empty states entirely | → skeleton loaders + a shared `<EmptyState>` | MEDIUM | 2.5 | F1 | SOON |
| G6 | Session expiry is abrupt | axios 401 → `clearAuthSession()` + hard `window.location.href='/login'`. In-progress work is silently lost with no explanation | → warn before expiry, explain on redirect, return to the intended page after login | MEDIUM | 1.5 | — | SOON |

### H. Performance

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| H1 | No `AbortController` / mount guards | Only `Login.js` guards. Debounced search in `AllGroups.js:86-105` can land out of order and render stale results; setState-after-unmount warnings | → abort in-flight requests on unmount/param change | MEDIUM | 1.5 | — | SOON |
| H2 | `/groups/search` loads all groups then filters in JS | `groups.js:1026` — fine at 20 groups, quadratic-feeling at 200 | → push the filter into the Mongo query | MEDIUM | 1.0 | E2 | SOON |
| H3 | Import loops `await` one doc at a time | ~500 sequential round-trips per import | → `bulkWrite` | LOW | 1.0 | — | DEFER |

### I. Error Handling / Observability

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| I1 | No structured logging | 28 `console.*` in frontend, emoji `console.log` of request bodies in backend. Can't debug an incident, and PII lands in logs | → `pino` w/ levels + redaction; strip frontend logs in production build | MEDIUM | 2.0 | — | NOW |
| I2 | **No React error boundary** | One render error = blank white page with no explanation. Worst possible trust signal | → `<ErrorBoundary>` around routes w/ a recovery action | HIGH | 1.0 | — | NOW |
| I3 | No request-id correlation | Can't tie a user's "it failed" to a log line | → `x-request-id` middleware, surface in error responses | LOW | 1.0 | I1 | DEFER |
| I4 | No uptime/error alerting | Render free tier sleeps; nobody knows when it's down | → free uptime monitor on `/` (works today), depends on B4 for `/api/health` | LOW | 0.5 | B4 | SOON |

### J. Scalability

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| J1 | One database per academic year | Good isolation, but cross-year analytics are impossible and connection/index overhead grows per year. **Do not change now** — it works and the migration cost is real | → document the tradeoff and the trigger point (≈5+ years or first cross-year report request) | MEDIUM | 0.5 | — | DEFER |
| J2 | `multer` memoryStorage | Fine for 5MB sheets; becomes a problem only with large/concurrent uploads | → document the threshold; revisit if files exceed ~10MB | LOW | — | A8 | DEFER |
| J3 | Render free-tier cold starts | First request after sleep takes ~30s and looks broken to users | → frontend "waking up the server" state, or paid tier | LOW | 0.5 | G4 | SOON |

### K. Code Quality / Maintainability

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| K1 | No lint/format config on backend | Style drift; nothing catches unused vars like the D2 bug | → ESLint + Prettier, `npm run lint` | MEDIUM | 1.0 | — | SOON |
| K2 | `companyNormalization` duplicated frontend+backend | Two copies will drift and produce different company groupings | → single source, or document that the frontend copy is display-only | LOW | 0.5 | — | SOON |
| K3 | Destructive scripts committed at top level | `remove-databases.js`, `clear-all-groups.js`, `cleanup.js` are one `node` command from wiping production | → move under `scripts/dangerous/` with an explicit confirm prompt | MEDIUM | 0.5 | — | NOW |
| K4 | `npm run seed-salary` broken | References missing `backend/seed-with-salary.js` | → remove the script entry | LOW | 0.25 | — | SOON |
| K5 | 15 overlapping markdown docs in root | `info.txt`, `README`, `FEATURES`, `QUICK_START`, `QUICK_START_GUIDE`, `START_HERE`, `START_APPLICATION`… mostly stale and contradictory | → one accurate `README` + `docs/`, archive the rest | LOW | 1.5 | N1 | DEFER |

### L. Deployment / Configuration

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| L1 | `vercel.json` has only SPA rewrites | No CSP/HSTS/X-Frame-Options on the frontend | → add a `headers` block | MEDIUM | 0.5 | A1 | NOW |
| L2 | Partial env validation at boot | `JWT_SECRET` and mail secret are checked; nothing else | → validate all required env vars at startup with clear messages | LOW | 0.5 | — | SOON |
| L4 | No CI | Nothing stops a broken build or failing test from shipping | → GitHub Actions: install, lint, test, build | MEDIUM | 1.5 | M2 | SOON |

### M. Testing

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| M1 | **Zero meaningful tests** | Only CRA's default `App.test.js`. Every change to a live college system is unverified | → `jest` + `supertest` + `mongodb-memory-server`; cover auth, authz, group generation, import upsert | HIGH | — | M2 | NOW |
| M1a | — auth + authorization tests | The two things that must never silently regress | → login success/failure/lockout; each role × each protected route | HIGH | 4.0 | B1,M2 | NOW |
| M1b | — API + business-logic tests | Group generation maths, UID upsert, evaluation weighting | → table-driven tests | MEDIUM | 3.0 | M2 | SOON |
| M2 | No test harness | Can't write tests without one | → in-memory Mongo + fixtures + `npm test` | HIGH | 1.5 | — | NOW |

### N. Documentation

| ID | Problem | Why it matters | Current → Proposed | Pri | Hrs | Deps | When |
|---|---|---|---|---|---|---|---|
| N1 | Docs contradict the code | `info.txt`/`API_DOCUMENTATION.md` describe `/api/advanced-analytics` and `/api/mentor-edit/:uid` routes that don't exist, and a schema with `salary`/`status` that doesn't match | → regenerate from code, delete the rest | MEDIUM | 2.0 | — | SOON |
| N2 | No operational runbook | Nobody but you can deploy, restore a backup, or rotate a secret | → `docs/RUNBOOK.md`: deploy, env vars, backup/restore, add a user, rotate secrets | MEDIUM | 1.5 | E6 | SOON |

---

## 3. Prioritised Implementation Plan

### PHASE 0 — MUST FIX BEFORE MORE USERS

*The bar: what has to be true before a third person gets an account.*

| Pri | ID | Task | Why | Hrs |
|---|---|---|---|---|
| CRIT | A4,A6 | Require `SEED_PASSWORD`, rotate live admin password, audit git history for secrets | Default password may be public | 1.0 |
| CRIT | A2 | Login rate-limit + account lockout | Unlimited password guessing | 1.5 |
| CRIT | B1 | `role: admin\|staff` + `requireRole()` on every mutation | User #3 currently gets delete-everything power | 4.0 |
| HIGH | B2 | Bind `allowedYears` to the user; validate `req.year` | Year is currently a client-chosen value | 1.5 |
| HIGH | C2 | Per-role field whitelist on update/import | Stop clients writing arbitrary fields incl. marks | 2.0 |
| HIGH | A5 | `AuditLog` + middleware on destructive/admin actions | Accountability once >1 person can write | 3.0 |
| HIGH | A1,L1 | `helmet` + CSP + `vercel.json` headers | Free baseline hardening | 1.0 |
| HIGH | A3,C1,I1 | Sanitize error responses; structured logging w/ PII redaction | Stop leaking internals and student PII | 2.5 |
| HIGH | A7 | Escape user input before `new RegExp()` | ReDoS + filter bypass | 1.5 |
| HIGH | A8 | Upload size/type limits; reduce JSON body limit | Trivial memory-exhaustion DoS | 1.0 |
| HIGH | D2 | Fix `PUT /api/groups/:id` `ReferenceError` | Broken endpoint returning 500 | 0.5 |
| HIGH | E1 | Resolve the `status` schema/UI mismatch | Portal currently displays wrong numbers | 2.0 |
| HIGH | I2 | React error boundary | White screen of death on any render error | 1.0 |
| HIGH | F1 | Remove Bootstrap; unify on Tailwind | One-line fix for the core UI inconsistency | 1.0 |
| MED | E6 | Enable Atlas backups + write & test a restore runbook | A bad import is currently unrecoverable | 1.0 |
| MED | K3 | Quarantine destructive scripts behind a confirm prompt | One command from wiping production | 0.5 |
| HIGH | M2,M1a | Test harness + auth/authorization tests | Lock the security work against regression | 5.5 |
| | | **PHASE 0 TOTAL** | | **30.5h** |

### PHASE 1 — HIGH-VALUE SMALL IMPROVEMENTS

| Pri | ID | Task | Why | Hrs |
|---|---|---|---|---|
| HIGH | D1 | `zod` validation on all mutating routes | Clear 400s, hostile input rejected at the edge | 3.0 |
| HIGH | A9 | Migrate off vulnerable `xlsx@0.18.5` (both ends) | Known CVEs on untrusted upload parsing | 2.0 |
| MED | D4,D3 | Global error handler, `unhandledRejection`, graceful shutdown, consistent envelopes | Process stability + predictable API | 2.5 |
| MED | E2 | Add 5 missing indexes | Cheap now, painful later | 1.0 |
| MED | C3 | Field projection on list endpoints | Stop over-returning PII | 1.5 |
| MED | H1 | `AbortController` + mount guards | Fixes stale/out-of-order search results | 1.5 |
| MED | D5 | Fisher–Yates shuffle | Selection fairness actually matters here | 0.5 |
| MED | G6 | Graceful session-expiry handling | Stop silently losing users' work | 1.5 |
| LOW | B4,D6,E5,K4,F4 | Health endpoint above auth; `crypto.randomUUID`; drop dead fields/files/scripts | Small correctness + hygiene | 1.5 |
| MED | L2 | Validate all required env vars at boot | Fail fast with a clear message | 0.5 |
| | | **PHASE 1 TOTAL** | | **15.5h** |

### PHASE 2 — UI/UX POLISH

*Assumes F1 (Bootstrap removal) landed in Phase 0 — everything here builds on a single clean design system.*

| Pri | ID | Task | Why | Hrs |
|---|---|---|---|---|
| HIGH | G3 | Responsive pass: table scroll wrappers, stacked filters, collapsible sidebar, mobile modals | App is currently desktop-only | 4.0 |
| HIGH | G1 | `id` + `htmlFor` on all 114 inputs | Labels currently do nothing | 2.0 |
| MED | F5 | Shared `<ConfirmDialog>` + `<Toast>` replacing 19 `confirm()` / 2 `alert()` | Destructive actions should state consequences | 3.0 |
| MED | F2 | Apply the existing design-system classes consistently; remove inline styles | Consistency without a redesign | 3.0 |
| MED | G4 | Skeleton loaders + shared `<EmptyState>` | Smoothness; no layout jumps | 2.5 |
| MED | G2 | ARIA, focus states, modal focus trap + Esc, keyboard nav | Practical accessibility | 2.0 |
| LOW | J3 | "Waking up the server" state for Render cold starts | Stops a 30s cold start looking broken | 0.5 |
| | | **PHASE 2 TOTAL** | | **17.0h** |

### PHASE 3 — FUTURE SCALABILITY

| Pri | ID | Task | Why | Hrs |
|---|---|---|---|---|
| MED | E3 | Pagination + server-side search/sort | Before record counts grow | 3.0 |
| MED | M1b | API + business-logic tests | Protect group maths and import upsert | 3.0 |
| MED | F3 | Split `AllGroups.js` into 5 components | Highest-risk file to maintain | 4.0 |
| MED | L4,K1 | CI pipeline + ESLint/Prettier | Stop broken code shipping | 2.5 |
| MED | H2 | Push group search into MongoDB | Removes an in-memory scan | 1.0 |
| MED | N1,N2 | Regenerate docs from code + operational runbook | Bus factor is currently 1 | 3.5 |
| | | **PHASE 3 TOTAL** | | **17.0h** |

### PHASE 4 — NICE TO HAVE / WHEN REAL USERS ARRIVE

| Pri | ID | Task | Why | Hrs |
|---|---|---|---|---|
| — | B5 | Expand `admin\|staff` → full role set (coordinator, internal_mentor, student…) with ownership scoping | **Only when those users actually exist** | 12.0 |
| — | A10 | `httpOnly` cookie auth + CSRF | Removes XSS token-theft risk; needs cross-site cookie config | 3.0 |
| — | H3,E4 | `bulkWrite` imports; validate `weekly_report_data` shape | Efficiency + data integrity | 1.5 |
| — | K5,K2 | Doc consolidation; de-duplicate `companyNormalization` | Repo hygiene | 2.0 |
| — | J1 | Revisit per-year DB design | Only at ~5+ years or first cross-year report | 0.5 |
| — | — | CRA → Vite migration | CRA is unmaintained; React 19 + CRA 5 is fragile | 4.0 |
| | | **PHASE 4 TOTAL** | | **23.0h** |

---

## 4. Totals & Recommended Scope

| Scope | Contents | Hours |
|---|---|---|
| **MINIMUM — before more college users** | Phase 0 | **30.5h** |
| **RECOMMENDED** | Phase 0 + 1 + 2 | **63h** |
| **IDEAL** | Phase 0 + 1 + 2 + 3 | **80h** |
| Everything incl. deferred | + Phase 4 | 103h |

**MUST DO NOW** → Phase 0 (30.5h)
**SHOULD DO NOW** → Phase 1 + 2 (32.5h)
**CAN WAIT** → Phase 3 + 4 (40h)

### What I recommend implementing first

A **~9 hour "Day 1" bundle** — pure risk reduction and one big visual win, with **zero change to any
existing workflow**, so it is safe to ship immediately and independently of the authorization work:

1. A4/A6 — rotate the seeded password, verify git history (1.0h)
2. A1/L1 — `helmet` + CSP + Vercel headers (1.0h)
3. A2 — login rate-limit + lockout (1.5h)
4. A3 — stop leaking raw error messages (1.0h)
5. A7 — escape regex inputs (1.5h)
6. A8 — upload + body size limits (1.0h)
7. D2 — fix the `groups` 500 crash (0.5h)
8. I2 — React error boundary (1.0h)
9. F1 — remove Bootstrap (1.0h) ← immediately makes the UI look more consistent

Then the **authorization block** (B1 + B2 + C2 + A5 + M2/M1a ≈ 16h), which is the actual gate on
letting more people in. Then Phase 2 for the polish you're after.

---

## 5. Open Questions (need your decision before I implement those items)

**Q1 — Role model scope.** Recommended: ship `admin` + `staff` now (4h) and defer the full role
set until real mentors/students have accounts. Alternative: build the fuller model up front (+12h).

**Q2 — The `status` field (E1).** The UI offers `pending / approved / in-progress / completed /
cancelled` but the schema has no such field, so those features silently do nothing. Two valid
directions: (a) add the field and an approval workflow — makes the Dashboard cards meaningful,
~2h + workflow; or (b) remove the dead status UI entirely — honest and simpler, ~1h. This is a
product decision, not a technical one.

**Q3 — Who counts as "staff"?** For B1 I need to know whether the second current user should be
`admin` (equal power) or `staff` (no destructive/bulk operations, no sender-email management).
