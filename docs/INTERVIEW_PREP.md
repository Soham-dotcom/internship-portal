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

**Q: How does soft delete work, and why in the model instead of the routes?**
Deleting sets `deletedAt` and `deletedBy`. A Mongoose query middleware on the Internship model adds
`deletedAt: null` to every find, count, update and aggregate, unless a caller explicitly opts in.
If each route had its own filter, the first route someone forgets would put deleted students
back into a report. Doing it once in the model makes forgetting impossible. My tests check
lists, counts, aggregates, group member lists and edits.

**Q: Why transactions? MongoDB is "schemaless", doesn't that skip all this?**
Generating groups writes to two collections. Without a transaction, a crash between the writes
left students marked as assigned to groups that didn't exist. With `withTransaction`, it's all
or nothing. I test it by forcing the second write to fail and checking the first one was rolled
back. The cost: transactions need a replica set, which Atlas always is.

**Q: How do you make a bulk import safe?**
Three things. A **preview**: the server computes exactly what would happen (new, changed field by
field, unchanged, invalid) and shows it before anything is written. **Safe defaults**: add-only
unless you opt in, blank cells never overwrite data, rows with errors block the import unless
explicitly skipped. And **undo**: each import stores what it inserted and every value it changed,
so undo can revert exactly that. It won't overwrite edits made after the import; it reports
them as conflicts instead.

**Q: Why record each import instead of snapshotting the collection before it?**
Restoring a snapshot would also wipe every unrelated change made after the import. The import
record lets undo touch only what that import did.

**Q: What bug are you proudest of catching?**
While building the import preview, I found the page's parser sent missing cells as empty strings,
and missing dates as *today's date*. Our real sheet has no date columns, so every re-import
silently reset every student's internship dates. The preview made it visible: every row showed
up as "changed". The fix: only send cells that actually have values.

**Q: How do you stop finished results being changed?**
An admin can lock the whole year, or a single marks component. One Express middleware refuses
every write to a locked year with HTTP 423 "Locked". It's default-deny, with a short explicit
list of read-only POSTs like exports and previews. Staff simply can't. An admin can, but only by
sending a reason in a header; the reason goes into the audit log. In the browser, an axios
interceptor turns that 423 into a "why are you changing this?" prompt and retries the request,
so no page needed lock-specific code.

**Q: Why 423 and not 403?**
403 means "you're never allowed to do this". 423 means "this resource is locked right now". The
frontend needs that difference: for a 423 that asks for a reason it prompts the admin; for a 403
it just shows the error.

**Q: How would you answer "who changed this student's mark"?**
Open the student's History: every edit, import and delete/restore, with who, when, old value,
new value, and the reason if locked data was overridden. It's assembled from the audit log and
the import records, so there's no separate "last edited by" field to keep in sync.

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
