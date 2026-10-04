# Interview prep: SPIT Internship Portal

Short answers you can say out loud. Each one names the trade-off, because that's what
interviewers probe.

## The project

**Q: What is it, in one minute?**
A portal my college's internship office uses every year to manage around 400 final-year
interns. It imports their records from Excel, forms evaluation groups, assigns each group an
internal faculty examiner and an industry evaluator, emails the evaluators, collects marks from
six spreadsheets, and computes a weighted final score. It's MERN: React on Vercel, Express on
Render, MongoDB Atlas. It's in real use, and that shaped most of my decisions.

**Q: Who uses it?**
Two office staff today. Students and mentors are data, not users. I deliberately built for
that instead of a large role system nobody would use yet.

## Design choices

**Q: Why one database per academic year?**
Isolation: a bad import in 2026 physically cannot touch 2025's records, and archiving a year
is just leaving its database alone. The cost is that cross-year analytics need extra work. I'd
revisit after about five years of data, or at the first cross-year report request.

**Q: How does authorization work?**
Two roles, admin and staff, enforced on the server with a `requireRole('admin')` middleware.
The UI hides admin buttons too, but only as a convenience, because the frontend can't be trusted.
The JWT only says who you are; on every request the server re-reads your role and status from
the database.

**Q: Why re-read the user on every request? Isn't that slow?**
It's one indexed read on a tiny collection: microseconds, at a handful of users. In return,
disabling someone, demoting an admin, or logging out takes effect immediately instead of when
the 12-hour token expires. At large scale I'd add a short cache, or move to short-lived
access tokens with refresh tokens.

**Q: How does logout work with stateless JWTs?**
Each user has a `tokenVersion` counter, copied into the token at login. Logout increments
it, so every older token stops matching. It signs you out on all devices, which I accepted for simplicity.

## Protecting the data

**Q: How do you stop data being wrongly changed?**
In layers. Whitelists decide which fields each route may write, so a spreadsheet import can
never set marks. Marks have a dedicated endpoint with range checks, all-or-nothing. Admin-only
actions are checked on the server. Every sensitive change goes into an audit log with who,
when, and the old and new values.

**Q: The free Atlas tier has no backups. What did you do?**
A nightly GitHub Action dumps every database into one file, encrypted with AES-256-GCM, and keeps
30 days of copies. I also tested that it restores, including a real restore of production data
into a throwaway database where every count matched. A backup you've never restored is a hope,
not a backup.

**Q: Why not just use mongodump?**
It's the standard tool, and I'd switch past a few hundred MB. My script uses the MongoDB driver
the app already has, so nothing extra to install, and it lets me test the round trip in my
automated test suite.

**Q: Tell me about a bug you found.**
Marks edited inline on the evaluation page appeared to save, but were silently discarded.
An earlier security fix had made the general edit route ignore mark fields, which was
correct, but the page still sent marks there and then displayed what it *sent*, not what the
server *stored*. I fixed it with a dedicated marks endpoint and by always rendering the
server's response. Lesson: tightening security can break a flow quietly, so the UI should
show the server's truth.

**Q: Another one?**
The evaluation-weights panel auto-saved 400 ms after any change, including on page load. On
a slow cold start, it could save the *default* weights before the real ones arrived, changing
every student's final mark. I replaced it with an explicit admin-only Save, and made the
server reject weights that don't sum to 100%.

## Failure cases and scaling

**Q: What happens if the database goes down?**
The API answers 503 immediately instead of hanging (Mongoose command buffering is off), and the
health endpoint reports "degraded" for uptime monitors.

**Q: What would you improve next?**
Soft delete with a recycle bin, an import preview showing exactly what will change, database
transactions for multi-step operations like group generation, and a "lock year" switch once
results are published. These are in `docs/PLAN.md`.

**Q: How would this scale to 50 colleges?**
Add a tenant (college) id to every collection, or keep database-per-tenant. Move to paid Atlas
with point-in-time recovery, put a cache in front of the user lookup, paginate every list, and
run imports as background jobs. I haven't built any of that, because it isn't needed today.
