# SPIT Internship Portal — Project Analysis, Findings & RBAC Roadmap

> Prepared as a working reference for hardening the portal and adding **role-wise access**.
> Date: 2026-09-09. Covers the codebase at branch `main` (commit `59f4ac9`).

---

## 1. Project Context

### 1.1 What this is
A full-stack **internship management & evaluation portal** built for SPIT (Sardar Patel
Institute of Technology). The Training & Placement Office / department coordinators use it
to:

- Import student internship records in bulk from Excel (placement sheets).
- Filter, search, edit and delete internship records.
- Form evaluation **groups** of students and allocate **internal** and **external** mentors/examiners.
- Email each mentor their group's student list (Excel attachment) from a configurable draft + sender account.
- Import evaluation data (meeting attendance, weekly reports, final report, external/internal viva marks).
- View a **marks & evaluation dashboard** and **weekly report viewer**.
- View **company-wise analytics** (hiring, branch split, stipend, tech/non-tech).

The app is **actively used by the college** for real internship cycles and report making.

### 1.2 Tech stack
| Layer | Stack |
|---|---|
| Backend | Node.js, Express 4, Mongoose 7, MongoDB Atlas, `xlsx` (SheetJS) 0.18.5, `multer` 1.x, `nodemailer` 6, `jsonwebtoken` 9, `bcryptjs` 2 |
| Frontend | React 18 (CRA), React Router 6, TailwindCSS, Recharts, Axios, client-side `xlsx` |
| Hosting | Backend on Render, Frontend on Vercel, DB on MongoDB Atlas |

### 1.3 Architecture

```
frontend (React SPA, Vercel)
    │  Axios, JWT in localStorage, Bearer header
    ▼
backend (Express, Render)
    │  /api/auth  → public (login, config)
    │  /api/*     → authRequired (JWT verify only)
    ▼
MongoDB Atlas (one cluster, MANY databases)
    ├── spit-common              → User, SenderEmail   (shared)
    ├── spit-internships-2025    → Internship, Group, Mentor, InternalMentor,
    ├── spit-internships-2026       MailDraft, EvaluationSettings   (per academic year)
    └── spit-internships-2027 ...
```

**Multi-tenancy is by academic year.** `getYearDb(year)` in
[backend/db/connection.js](backend/db/connection.js:19) does `mongoose.connection.useDb('spit-internships-' + year)`.
The year comes from the JWT (`req.year`), which was set at login from a **field the user
picked on the login form** ([backend/routes/auth.js:52](backend/routes/auth.js:52)).

### 1.4 Data models
| Model | DB | Key fields |
|---|---|---|
| `User` | shared | `username` (unique), `passwordHash`, `role` (default `'admin'`, **never read anywhere**) — [backend/models/User.js](backend/models/User.js) |
| `SenderEmail` | shared | `email`, `passwordEncrypted{iv,authTag,cipherText}` (AES-256-GCM) — [backend/models/SenderEmail.js](backend/models/SenderEmail.js) |
| `Internship` | year | `uid` (unique PK), student info, company, mentor name, dates, `assignedGroup`, evaluation fields (`meeting_attended`, `weekly_reports_completed`, `final_report_submitted`, `external_marks`, `external_viva_marks`, `internal_viva_marks`, `weekly_report_data` = Mixed) — [backend/models/Internship.js](backend/models/Internship.js) |
| `Group` | year | `name` (unique), `externalMentor` ref, `internalMentor` ref, `students[]` ref, `mailSent` — [backend/models/Group.js](backend/models/Group.js) |
| `Mentor` / `InternalMentor` | year | `name`, `email` (unique), `phone`, `isAssigned` — no link to a `User` — [backend/models/Mentor.js](backend/models/Mentor.js) |
| `MailDraft` | year | `key:'global'`, `subject`, `body`, `evaluationLink` — [backend/models/MailDraft.js](backend/models/MailDraft.js) |
| `EvaluationSettings` | year | `key:'default'`, `totalWeeks`, `weights{}` — [backend/models/EvaluationSettings.js](backend/models/EvaluationSettings.js) |

### 1.5 Current authentication & authorization

- **Login** ([backend/routes/auth.js](backend/routes/auth.js)): `username` + `password` + `year`.
  bcrypt compare; a legacy plaintext `password` field is auto-upgraded to a hash on first login.
  Issues a JWT `{ sub, username, year }`, `expiresIn: '12h'`.
- **Guard** ([backend/middleware/auth.js](backend/middleware/auth.js)): `authRequired` verifies the
  JWT signature/expiry and sets `req.user = { id, username, year }`, `req.year`.
- **Authorization: none.** Every `/api/*` route (all mutations, all deletes, `clear-all`,
  evaluation-settings, sender-emails, mail) is available to **any user who can log in**.
  The `User.role` field exists but is never checked. There is a single seeded account
  (`spit-admin`), so today "authenticated == full admin".
- **Year is not a security boundary.** One account can log in three times, each time
  choosing a different year, and get three tokens — one per year database.

### 1.6 Feature ↔ route ↔ page map
| Feature | Backend | Frontend page |
|---|---|---|
| Login | `POST /api/auth/login`, `GET /api/auth/config` | [Login.js](frontend/src/pages/Login.js) |
| Dashboard stats | `GET /api/internships/stats/summary`, `/api/analytics/*` | [Dashboard.js](frontend/src/pages/Dashboard.js) |
| Internship records | `GET/POST/PUT/DELETE /api/internships`, `/:id` | [InternshipList.js](frontend/src/pages/InternshipList.js) |
| Bulk Excel import | `POST /api/upload/excel`, `POST /api/upload/import` | [ExcelUpload.js](frontend/src/pages/ExcelUpload.js) |
| Student record edit | `PUT /api/mentor/:id`, `POST /api/mentor/:id/attendance` | [MentorEdit.js](frontend/src/pages/MentorEdit.js) |
| Group generation | `POST /api/groups/generate`, `/unassign`, `/clear-all` | [GroupGenerator.js](frontend/src/pages/GroupGenerator.js) |
| Group + mentor management | `GET /api/groups/list-with-mentors`, `PUT /api/groups/:groupId/assign-mentor`, `/allocate-all-*` | [AllGroups.js](frontend/src/pages/AllGroups.js) |
| Mentor directory | `GET/POST/PUT /api/mentors`, `POST /api/upload/(internal-)mentors` | [AllMentors.js](frontend/src/pages/AllMentors.js), [MentorEdit.js] |
| Evaluation data import | `POST /api/upload/evaluation/*` | [EvaluationMatrixUpload.js](frontend/src/pages/EvaluationMatrixUpload.js) |
| Evaluation overview | `GET /api/internships/evaluation-overview`, `GET/PUT /api/evaluation-settings` | [EvaluationOverview.js](frontend/src/pages/EvaluationOverview.js) |
| Weekly reports | `GET /api/internships/weekly-reports` | [WeeklyReportViewer.js](frontend/src/pages/WeeklyReportViewer.js) |
| Send group mail | `POST /api/send-mail`, `GET/POST /api/mail-draft`, `GET/POST /api/sender-emails` | [AllGroups.js] |
| Company analytics | `GET /api/analytics/*` | [CompanyAnalytics.js](frontend/src/pages/CompanyAnalytics.js) |
| Random student picker | `POST /api/groups/random-pick`, `/export-random` | [StudentPicker.js](frontend/src/pages/StudentPicker.js) |

---

## 2. Security Findings

Severity is rated for the **current** single-admin deployment and, in brackets, for the
**post-RBAC** world where mentors/coordinators/students have accounts.

### S1 — No authorization layer / `role` never enforced — **High**
Every `/api/*` endpoint trusts any valid JWT. Destructive endpoints
(`POST /api/groups/clear-all` [groups.js:353](backend/routes/groups.js:353),
`DELETE /api/internships/:id`, `DELETE /api/upload/mentors`,
`PUT /api/evaluation-settings`) have no role gate. This is the central gap the upgrade
must close (see §5).

### S2 — Academic year is a client-chosen value, not a permission — **Medium [High]**
`year` is taken from the login form body ([auth.js:17](backend/routes/auth.js:17)),
only checked against the global `ACADEMIC_YEARS` list, then embedded in the token and used
to pick the database. Any account can reach **any** year's data. After RBAC, year access
must be derived from the user record, not from login input.

### S3 — No brute-force protection on login — **Medium**
No `express-rate-limit`, no account lockout, no CAPTCHA, no delay on failed
`POST /api/auth/login`. Combined with short usernames this allows offline-speed guessing
against the live endpoint.

### S4 — Regex / ReDoS injection through query params — **Medium**
User input is passed straight into `new RegExp(...)`:
- [internships.js:25-29](backend/routes/internships.js:25) — `company`, `mentor`, `uid`, `name`
- [groups.js:1023](backend/routes/groups.js:1023) — `/groups/search?query=`
- [analytics.js:361](backend/routes/analytics.js:361) — `companies/search?name=`
- [mentor-edit.js:14](backend/routes/mentor-edit.js:14) — `mentorName`

A crafted value like `(a+)+$` causes catastrophic backtracking (CPU DoS); `.*` etc. also
lets a low-privilege user widen their result set. Escape input, or switch to a MongoDB
text index / anchored exact match.

### S5 — Mass assignment on write endpoints — **Medium [High]**
- `POST /api/upload/import` → `Internship.findOneAndUpdate({uid}, { $set: record }, { runValidators:false })` ([upload.js:635](backend/routes/upload.js:635)) — the client controls **every** field, including `external_marks`, `internal_viva_marks`, `assignedGroup`, timestamps.
- `POST /api/internships` → `new Internship(req.body)` ([internships.js:123](backend/routes/internships.js:123))
- `PUT /api/internships/:id` and `PUT /api/mentor/:id` → `findByIdAndUpdate(id, req.body)` ([internships.js:135](backend/routes/internships.js:135), [mentor-edit.js:28](backend/routes/mentor-edit.js:28))

With RBAC an internal mentor could set any student's external marks. Fix with per-role
field whitelists.

### S6 — `xlsx` (SheetJS) 0.18.5 is vulnerable and unmaintained on npm — **Medium**
0.18.5 is affected by prototype-pollution (CVE-2023-30533) and ReDoS (CVE-2024-22363).
The `xlsx` npm package is no longer updated; fixed builds ship only from SheetJS's own CDN.
Uploaded `.xlsx` files are parsed on the server ([upload.js:27](backend/routes/upload.js:27))
and in the browser. Move to the maintained SheetJS distribution (or `exceljs`) and treat
uploads as untrusted.

### S7 — Unbounded file upload + 50 MB JSON body — **Medium**
`multer({ storage: memoryStorage() })` with **no `limits`** ([upload.js:14](backend/routes/upload.js:14))
and `express.json({ limit: '50mb' })` ([server.js:69](backend/server.js:69)). A few
concurrent large uploads exhaust the Render instance's memory. Add `limits.fileSize`,
accept only `.xlsx/.xls` MIME + extension, and drop the JSON limit to ~1–2 MB (use a
separate higher limit only on `/api/upload/import`).

### S8 — JWT in `localStorage`, no security headers — **Medium**
Token is stored in `localStorage` ([frontend/src/auth/session.js](frontend/src/auth/session.js))
and there is no `helmet`, no CSP, no `X-Frame-Options`, no HSTS set by the app. Any XSS
(e.g. via a rendered field, a dependency, or the mail draft HTML) yields full token theft.
Add `helmet`, a CSP, and consider an `httpOnly` cookie + CSRF token instead of localStorage.

### S9 — Raw error messages returned to the client — **Low/Medium**
Almost every `catch` does `res.status(500).json({ message: error.message })`. Mongoose/driver
errors leak schema field names, index names and occasionally connection detail. Return a
generic message; log the detail server-side with a correlation id.

### S10 — Predictable default admin credentials in the repo — **Medium**
`scripts/seed-user.js` defaults to `spit-admin` / `Spit@2026!`
([scripts/seed-user.js:12](backend/scripts/seed-user.js:12)). If the deploy ran the seed
without overriding `SEED_PASSWORD`, that password is public. Rotate it; require the seed to
fail unless `SEED_PASSWORD` is set.

### S11 — No audit trail — **Medium (blocks RBAC accountability)**
No record of who imported, edited marks, deleted a student, cleared groups, or sent mail.
Essential once more than one person has write access. Add an `AuditLog` collection.

### S12 — Sender email credentials — **Low**
Gmail app passwords are stored AES-256-GCM encrypted at rest
([backend/utils/crypto.js](backend/utils/crypto.js)) with a scrypt-derived key from
`MAIL_CREDENTIALS_SECRET` — reasonable. `GET /api/sender-emails` correctly omits the
ciphertext. Residual risk: a single env secret guards all of them, and any authenticated
user can add a sender and send mail as the office. Gate behind coordinator+ and log sends.

### S13 — `POST /api/mail-draft` body is stored and later rendered as email HTML — **Low**
The draft `body` is escaped before being turned into HTML
([send-mail.js:231-240](backend/routes/send-mail.js:231)), which is good. Keep it that
way; do not switch to storing raw HTML without sanitisation.

### S14 — CORS + `/api/auth/config` exposure — **Low**
`GET /api/auth/config` is public and returns the configured academic years. Minor
information disclosure. CORS is an allow-list (fine); `!origin` requests are allowed
(needed for health checks / mobile), acceptable.

### S15 — `.env` files present locally, correctly git-ignored — **verify history**
`git ls-files` shows only `*.env.example` tracked; `.gitignore` excludes `.env`/`.env.*`.
Confirm no secret was ever committed earlier: `git log --all --full-history -- .env backend/.env`.
If anything shows up, rotate `JWT_SECRET`, `MAIL_CREDENTIALS_SECRET`, the Mongo URI
password and all Gmail app passwords.

---

## 3. Bugs & Correctness Issues

### B1 — `PUT /api/groups/:id` throws `ReferenceError` — **High (feature broken if hit)**
[groups.js:1334](backend/routes/groups.js:1334) destructures only `{ Group }` from
`getModels(req)` but then calls `Mentor.findById(...)` and `InternalMentor.findById(...)`
([groups.js:1368](backend/routes/groups.js:1368), [:1396](backend/routes/groups.js:1396)).
`Mentor`/`InternalMentor` are not in scope → 500. The working path is the separate
`PUT /api/groups/:groupId/assign-mentor` route. Either fix the destructure or delete the
dead route.

### B2 — `uuid` import logic is inverted and dependency is missing — **Low**
[groups.js:10](backend/routes/groups.js:10):
`const { v4: uuidv4 } = require('crypto').randomUUID ? {} : require('uuid');`
On modern Node, `crypto.randomUUID` exists → the expression is `{}` → `uuidv4` is
`undefined` → `generateGroupId()` always uses the `Date.now()+Math.random()` fallback. Also
`uuid` is **not** in `package.json`, so the `else` branch would crash. Use
`crypto.randomUUID()` directly.

### B3 — Biased shuffle — **Low**
`array.sort(() => Math.random() - 0.5)` is used for group randomisation and "random pick"
([groups.js:123](backend/routes/groups.js:123), [:641](backend/routes/groups.js:641),
[:731](backend/routes/groups.js:731)). It is not a uniform shuffle — some students are
systematically more likely to be picked. Use Fisher–Yates.

### B4 — Legacy `viva_marks` field co-exists with `external_viva_marks`/`internal_viva_marks` — **Low**
[Internship.js:75-77](backend/models/Internship.js:75). `viva_marks` is dead but still in the
schema; risk of confusion in reports.

### B5 — Stale documentation — **Low**
`info.txt` / `API_DOCUMENTATION.md` describe routes that no longer exist
(`/api/advanced-analytics`, `/api/mentor-edit/:uid` with GET/PATCH) and a different schema
(`salary` field, `status` enum) than the code. New devs will be misled.

### B6 — Duplicate/dead frontend files — **Low**
`frontend/src/pages/InternshipList_improved.js` and `frontend/src/utils/companyNormalization.js`
duplicate `InternshipList.js` / the backend util. `App.test.js`, `setupTests.js` are CRA
defaults. Remove or consolidate.

### B7 — `DELETE /api/internships/:id` cascade reads the wrong field — **Low**
[internships.js:162](backend/routes/internships.js:162) sets
`assignedGroupName = internship.assignedGroup` (the group **id**), and the "clean up empty
groups" step keys off `students` arrays, so it happens to work, but the variable name and
intent are wrong and fragile.

---

## 4. Code Quality, Performance & DevOps

| # | Item | Notes |
|---|---|---|
| Q1 | No pagination on `GET /api/internships` | Returns every record. Fine at ~hundreds, add `limit`/`skip` before it grows. |
| Q2 | `GET /api/groups/search` loads **all** groups and filters in JS ([groups.js:1026](backend/routes/groups.js:1026)) | Move the filter into the Mongo query / aggregation. |
| Q3 | Import endpoints `await` one document at a time in a `for` loop ([upload.js:623](backend/routes/upload.js:623)) | OK now; use `bulkWrite` for larger sheets. |
| Q4 | No input-validation library | Add `zod` or `express-validator` schemas per route. |
| Q5 | `console.log` with emojis on every request, incl. request bodies ([send-mail.js:305](backend/routes/send-mail.js:305), [mail-draft.js:44](backend/routes/mail-draft.js:44)) | Logs student PII and mail content to Render logs. Use a real logger with levels + redaction. |
| Q6 | No tests, no CI, no enforced lint | Only the CRA default test. Add a smoke test per route + a GitHub Actions workflow. |
| Q7 | Destructive one-off scripts committed | `backend/remove-databases.js`, `clear-all-groups.js`, `cleanup.js`, `quick-seed.js`, `check-*.js` — footguns, not exposed via API but easy to run against prod. Move to a `scripts/dangerous/` folder with a guard prompt, or delete. |
| Q8 | `multer` 1.x, `xlsx` 0.18.5, CRA (`react-scripts`) all have advisories | Plan a dependency refresh (`multer` 2.x, maintained SheetJS, or migrate CRA → Vite). |
| Q9 | Backend has no graceful-shutdown / unhandled-rejection handler | Add `process.on('unhandledRejection')` and close Mongo on `SIGTERM`. |
| Q10 | Many-databases-per-year design | Simplifies isolation but makes cross-year analytics and RBAC harder, multiplies index maintenance, and Atlas connection-pool pressure grows with years. Consider a single DB with a `year` field + compound indexes as a future architectural option (not required for RBAC). |

---

## 5. Upgrade: Role-Based Access Control (RBAC)

### 5.1 Proposed roles

| Role | Purpose | Access |
|---|---|---|
| `super_admin` | TPO head / system owner | Everything, all years, **user management**, settings, sender emails, audit log. |
| `coordinator` | Dept / year internship coordinator | Full CRUD on **their assigned year(s)**: imports, internship records, groups, mentor directory, mail, evaluation settings, evaluation imports, analytics. No user management. |
| `internal_mentor` | Internal examiner (faculty) | Read students in their year; **write only to their own groups** — internal viva marks, meeting attendance, weekly-report verification. Export only their groups. |
| `external_examiner` *(phase 3)* | External evaluator | Login-scoped to one group: submit external marks / external viva only. (Until then: no login, receives Excel by mail as today.) |
| `student` *(phase 3)* | Intern | Submit / update own internship record (goes to `pending`), upload own weekly reports, view own evaluation. |
| `viewer` *(optional)* | Read-only auditor | Analytics + read-only lists, no exports of PII. |

### 5.2 Data model changes (shared DB)

```js
// User (extended)
{
  username, passwordHash,
  name, email,
  status: { type: String, enum: ['active','disabled'], default: 'active' },
  role:   { type: String, enum: ['super_admin','coordinator','internal_mentor','external_examiner','student','viewer'], required: true },
  allowedYears: [String],          // e.g. ['2025','2026']  — the year DBs this user may touch
  linkedMentor: { year: String, mentorType: String, mentorId: ObjectId },  // for internal_mentor / external_examiner
  linkedStudentUid: String,        // for student
  mustChangePassword: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  lastLoginAt: Date,
}

// AuditLog (new, shared DB)
{ actorId, actorUsername, role, action, resource, resourceId, year, ip, meta, before, after, createdAt }
```

Optionally add `userId` back-refs on `InternalMentor` / `Mentor`.

### 5.3 Backend enforcement

1. **Login** returns and signs `{ sub, username, role, allowedYears, linkedMentorId }`.
   Stop trusting a `year` from the request body — the client may only *select* among
   `allowedYears`, validated server-side.
2. **New middleware** (`backend/middleware/`):
   - `authRequired` (exists) → also load `status`, reject `disabled`.
   - `requireRole(...roles)` → 403 if `req.user.role` not in list.
   - `requireYearAccess` → 403 unless `req.year ∈ req.user.allowedYears` (or `super_admin`).
   - `scopeToOwnGroups` → for `internal_mentor`, inject a filter
     `{ internalMentor: req.user.linkedMentorId }` and reject writes to students outside it.
   - `allowFields(role → whitelist)` → strip non-permitted keys from `req.body` before any
     `findByIdAndUpdate` / `$set`.
3. **Route guards** (illustrative):
   | Route group | Guard |
   |---|---|
   | `POST/PUT/DELETE /api/internships*`, `/api/upload/*`, `/api/groups/*` mutations, `/api/mentors*` writes, `/api/mail-draft` POST, `/api/send-mail`, `/api/sender-emails`, `PUT /api/evaluation-settings` | `requireRole('super_admin','coordinator')` + `requireYearAccess` |
   | `POST /api/upload/evaluation/internal-viva-marks`, `/meeting-attendance` | `requireRole('super_admin','coordinator','internal_mentor')` + `scopeToOwnGroups` |
   | `POST /api/upload/evaluation/external-marks`, `/external-viva-marks` | `requireRole('super_admin','coordinator')` (or `external_examiner` scoped, phase 3) |
   | `GET` lists / analytics / weekly-reports | any active role + `requireYearAccess` (mentor sees only own groups) |
   | `/api/users/*` (new) | `requireRole('super_admin')` |
4. **Audit middleware** on every mutating route → write an `AuditLog` entry.
5. **Rate limit + lockout** on `/api/auth/login` (`express-rate-limit`, `lockUntil`).
6. Ship enforcement behind a flag `RBAC_MODE = off | log | enforce`. Run in `log` first
   (record what *would* be denied), then flip to `enforce`.

### 5.4 Frontend changes

- Persist `role` + `allowedYears` from the login response
  ([frontend/src/auth/session.js](frontend/src/auth/session.js)).
- `RequireRole` wrapper around routes in [App.js](frontend/src/App.js).
- Add a `roles: []` field to each item in the `navigation` array
  ([frontend/src/components/Layout.js:7](frontend/src/components/Layout.js:7)) and filter the sidebar.
- Hide/disable action buttons by permission (server still enforces).
- New **User Management** page (`super_admin`): create user → set role, `allowedYears`,
  link to a mentor/student.
- Login year dropdown populated from the user's grant for multi-year users; single-year
  users skip the step.
- Internal-mentor dashboard: only their groups, only the fields they may edit.

### 5.5 Migration plan

1. Add the new `User` fields with safe defaults; map the existing `spit-admin`
   (`role:'admin'`) → `role:'super_admin'`, `allowedYears = ACADEMIC_YEARS`.
2. Migration script in `backend/scripts/` — idempotent, dry-run flag.
3. Backfill `internal_mentor` users by matching `InternalMentor.email` (optional, script).
4. Update `scripts/seed-user.js` to take `--role` and `--years`.
5. Deploy with `RBAC_MODE=log`, watch the audit log for a cycle, then `RBAC_MODE=enforce`.

### 5.6 Phasing & rough effort

| Phase | Scope | Effort |
|---|---|---|
| **0 — Hardening** | helmet + CSP, login rate-limit + lockout, error sanitisation, field whitelists on update/import, escape regex inputs, multer `limits` + MIME check, drop JSON limit, fix **B1**, rotate seeded password. | ~1–2 days |
| **1 — RBAC core** | `User` schema + roles + `allowedYears`, token carries role, `requireRole`/`requireYearAccess`, guard all mutations, `super_admin` user-management page + API, `AuditLog` + middleware, frontend route/nav gating. | ~3–5 days |
| **2 — Mentor scoping** | link `User`↔`InternalMentor`, `scopeToOwnGroups`, restrict evaluation-import endpoints per role, per-role field whitelists, internal-mentor dashboard. | ~3–4 days |
| **3 — External examiner & student portals** | external-examiner scoped mark entry; student self-service internship submission + weekly-report upload + coordinator approval workflow + notifications. | larger, scope separately |

---

## 6. Other Enhancements ("and much more")

- **Approval workflow** for student-submitted internships (state machine + actor + timestamps).
- **Student weekly-report submission** in-app (replaces staff Excel import).
- **PDF generation** for evaluation sheets / group reports / consolidated marksheets.
- **Email notifications & reminders** (nodemailer already wired): mentor assignment,
  missing weekly report, evaluation deadline.
- **Server-side pagination, sort and search** on the internship list; MongoDB **text index**
  instead of regex scans.
- **Audit-log viewer** page for `super_admin`.
- **Per-role dashboards** (coordinator KPIs, mentor to-do list, student status).
- **Bulk-action safety**: confirm + audit + soft-delete (`deletedAt`) instead of hard delete.
- **Config in a secret manager**, JWT rotation, short access token + refresh token.
- **Tests + CI** gate before deploy.
- Optional: consolidate the per-year databases into one DB with a `year` field.

---

## 7. Prioritised Action List

**Do first (low effort, high value):**
1. Fix `PUT /api/groups/:id` `ReferenceError` (**B1**) or remove the route.
2. Add `helmet`, login `express-rate-limit`, generic error responses.
3. `multer` `limits.fileSize` + extension/MIME check; reduce `express.json` limit.
4. Escape user input before `new RegExp(...)` (or use anchored exact match / `$text`).
5. Rotate the seeded admin password; make the seed require `SEED_PASSWORD`.
6. `git log --all -- .env backend/.env` → rotate every secret if anything is found.

**Then (the upgrade):**
7. RBAC Phase 0 → 1 → 2 as in §5.6, with `AuditLog` from the start.

**Backlog:**
8. Dependency refresh (`xlsx`/SheetJS, `multer` 2.x, CRA → Vite), pagination, text search,
   tests/CI, doc cleanup, remove dead files & destructive scripts.

---

## 8. Suggested next step

Before implementing RBAC, run a short **brainstorming** pass to lock down: exact role list
for *your* office structure, whether external examiners and students get logins in this
round, single-year vs multi-year coordinators, and whether to keep the per-year-database
design. That resolves the biggest open questions in §5 and turns this roadmap into a
concrete implementation plan.
