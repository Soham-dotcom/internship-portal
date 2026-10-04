# SPIT Internship Management & Evaluation Portal

The portal the internship office at Sardar Patel Institute of Technology (SPIT), Mumbai uses
to run each 8th-semester internship cycle:

1. **Import** the students' internship records from the placement spreadsheet.
2. **Form evaluation groups** of about 5 students.
3. **Allocate evaluators**: one internal examiner (SPIT faculty) and one external evaluator (industry) per group.
4. **Mail** each evaluator their group's student list as an Excel attachment.
5. **Collect marks** from six evaluation spreadsheets and show a weighted final score per student.
6. **Analyse** placements by company, branch and internship type.

Office staff are the only users. Students and mentors are data, not accounts.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 (Create React App), React Router, Tailwind CSS, Recharts, axios: hosted on **Vercel** |
| Backend | Node.js, Express 4, Mongoose 7, multer, nodemailer, SheetJS: hosted on **Render** |
| Database | MongoDB Atlas: one database per academic year plus a shared one |
| Auth | bcrypt + JWT, roles `admin` / `staff`, account checked on every request |
| Tests | Jest + supertest + mongodb-memory-server |

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Why it is built this way:
[docs/DECISIONS.md](docs/DECISIONS.md).

## Data protection at a glance

- **Roles:** `admin` can do everything. `staff` cannot bulk-delete, change evaluation weights or
  store mail credentials. Enforced by the server, not just hidden in the UI.
- **Sessions:** disabling, demoting or logging out takes effect on the next request.
- **Marks:** edited only through validated endpoints (range-checked). Every single-student change
  is logged with its old and new value.
- **Audit log:** destructive and sensitive actions are recorded in `spit-common.auditlogs`.
- **Backups:** nightly encrypted backup via GitHub Actions, with a tested restore. See
  [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Running locally

Prerequisites: Node.js 18+ and a MongoDB connection string (an Atlas cluster or local MongoDB).

```bash
npm run install-all                    # backend (root) + frontend dependencies
cp backend/.env.example .env           # then fill in the values (see below)
SEED_PASSWORD="<12+ characters>" npm run seed-user   # first admin account
npm run dev                            # backend :5000 and frontend :3000
```

Key environment variables (`.env` in the repo root):

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Atlas connection string |
| `JWT_SECRET` | Signs login tokens. Long and random. |
| `MAIL_CREDENTIALS_SECRET` | Encrypts stored sender-mail passwords |
| `ACADEMIC_YEARS` | Years offered at login, e.g. `2025,2026` |
| `FRONTEND_URL` | Allowed CORS origin |
| `SMTP_*`, `MAIL_FROM` | Fallback mail settings |

The frontend reads `REACT_APP_API_URL` (see `frontend/.env.example`).

## Testing

```bash
npm test                         # backend: unit + integration tests (in-memory MongoDB)
cd frontend && npm run build     # frontend must compile
```

The first test run downloads a MongoDB binary for `mongodb-memory-server`.

## Operations

Backups, restores, creating and disabling accounts, and what to do if an account is
compromised: [docs/RUNBOOK.md](docs/RUNBOOK.md).

> **Never commit student data.** Spreadsheets (`*.csv`, `*.xlsx`) and `backups/` are git-ignored on purpose.

## Project docs

| File | What it answers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it fits together, the data model, known issues |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why each major choice was made |
| [docs/PLAN.md](docs/PLAN.md) | The security and smoothness roadmap and its status |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Dated log of what was built and tested |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operating procedures |
| [docs/INTERVIEW_PREP.md](docs/INTERVIEW_PREP.md) | Likely interview questions with answers |
