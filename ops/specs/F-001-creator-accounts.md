# F-001: Creator accounts and Studio submissions

Status: **G2 approved (D-0009), built behind a flag, waiting for gate G4** (production: invite-only switch and consent wording).
Built so far: database (applied, tested, reversible), browser client (off). Screens built behind the flag: sign-in, send for review, delete my account. Moderation is the Supabase dashboard.
Override: this feature entered build under D-0004, which skips gate G1 only. G1 is not passed: the ledger is empty.

## 1. Problem, as far as the evidence goes

There is none yet. No creator has been interviewed, so nothing here is a finding. The feature rests on
the founder's belief that local guides and storytellers would write routes for the Studio. That is T0.
The experiment below exists to turn that belief into something measured.

## 2. What it is

A creator signs up with an email address, confirms it, writes a route draft in the Studio, and sends it
for review. Drafts live on the server, private to their author. A moderator (the founder) approves or
rejects each one. A creator can delete their account and everything they wrote.

Already in place: `supabase/migrations/0001` (tables, row level security, guard trigger, erasure
function), `supabase/migrations/down/0001` (the reversal), `app/backend.js` (client, switched on by
`app/config.js`). Not in place: sign-in screen, consent notice, Studio "send for review", account
deletion button, any moderation screen.

## 3. Hypothesis, pre-registered

> Of the creators the founder personally invites, at least 1 in 6 will create an account and send one
> draft for review within 6 weeks of the invitation.

- **Metric:** creators with at least one `creator_submissions` row with status `submitted`, divided by
  creators invited. Counted from the database. No browser analytics are needed, so
  `wire_analytics_into_pages` (ask-first) is not triggered.
- **Population:** creators the founder invites by name, one at a time. Not strangers, not a campaign.
- **Clock:** starts on each person's own invitation date; the read-out is 6 weeks after the last invite.

## 4. Kill rule, and how many people it takes

Rule of three in exact form: if none of N invited creators submits, a true rate above
`1 - 0.05^(1/N)` is ruled out with 95% confidence.

| invited (N) | zero submissions rules out a true rate above |
|---|---|
| 30 | 9.5% |
| 60 | 4.9% |
| 100 | 3.0% |
| 300 | 1.0% |

Proposed (the founder sets the numbers; these are defaults, not derived from evidence):

- **Invite N = 30.**
- **Remove** the feature (flag off, then the down migration) if **0 of 30** submit in 6 weeks.
  That rules out a rate above about 9.5%, well under the 1 in 6 hoped for.
- **Iterate** if 1 to 4 of 30 submit: read each one's reason for stopping before changing anything.
- **Keep** if 5 or more of 30 submit (16.7% or more, about 1 in 6). Report the rate with its interval,
  never alone. 5 of 30 has a 95% interval of about 7% to 34%, which is wide: keeping means "worth more
  work", not "proven".
- A rate measured on 30 people the founder knows is not a rate for strangers. Say so in the read-out.

Read-outs at 2 weeks and 6 weeks (the algorithm's Learn step). Remove the flag either way.

## 5. Security: threat model

| Threat | Mitigation | Where it is checked |
|---|---|---|
| Someone reads or edits another creator's drafts | Row level security, author-only policies | 12 database tests |
| An author approves their own work, rewrites the reviewer's note or reassigns a row | Policies reject `approved`; a trigger resets `review_note` and `author_id` unless the caller is the service role | database tests (each fails if the trigger is removed) |
| The browser key is abused | The anon key is public by design; the anon role has no access to either table or to the erasure function | tests, and live checks on the project (401 on both) |
| The secret key leaks | Never under `app/`; `.env*` ignored; a CI test fails on a secret under `app/`; a key scan runs in CI | CI |
| Stored drafts carry markup that runs in a moderator's browser | Any moderation view must escape draft content, never inject it as HTML. **Open: the moderation view is not built.** | to be tested when built |
| One account fills the database | 200 KB cap per draft is in place. **Open: no cap on the number of rows per author.** Proposed migration 0002: at most 50 rows per author | not built |
| Account spam or email enumeration | Email confirmation is on. **Open:** check the project's auth rate limits and its sign-up error messages in the dashboard | founder to check |
| An under-18 signs up | Sign-up refuses without an "18 or over" statement and records it in the account. The site cannot verify age | client tests |

## 6. Privacy (DPDP)

- **Collected:** email address, optional display name, the drafts the creator writes, and the
  statement that they are 18 or over. Nothing else; no browser analytics for this feature.
- **Where:** the Supabase project is in the Sydney region (`ap-southeast-2`, as the dashboard shows).
  **Open: whether storing Indian users' data there is acceptable is a question for counsel**, and the
  official DPDP text should be checked before launch.
- **Erasure:** `delete_my_account()` removes the account and, by cascade, every draft and profile.
- **Consent notice:** not written. It needs the founder's wording and review before any screen shows it.
- **Breach runbook (72 hours):** not written. It must exist before real creator accounts do.

## 7. Release and rollback

- Everything user-facing goes behind a flag, off by default, like the offline bundles.
- Rollback: turn the flag off; to remove the data, run `supabase/migrations/down/0001_creator_accounts.down.sql`
  (tested: it restores the database to its state before 0001, leaves sign-in accounts alone, and is safe
  to run twice). **It erases every creator submission and profile.**
- G4 (the founder approves production) applies: this is auth and personal data.

## 8. Decisions for the founder at G2

1. **Approve the hypothesis and the kill rule above, or change the numbers** (N, the 6 weeks, the thresholds).
2. **Erase or anonymise approved work when its author deletes their account.** The migration erases.
3. **Open sign-up or invite-only.** The project currently allows anyone to sign up, with email confirmation.
4. **The wording of the consent notice**, and what the "18 or over" statement should say.
5. **A cap on rows per author** (proposed 50) as migration 0002.
6. **Who moderates.** Proposed: the founder, from the Supabase dashboard, until a moderation screen exists.
7. **Whether Sydney is acceptable** for storing creators' data, or the project should move.

## 9. What happens on approval

Build behind the flag, tests first: sign-in and confirmation screen, consent notice, "send for review" in
the Studio, "delete my account" in My Journey, browser tests against a mock server (no real accounts), then
a moderation view with escaping tests. Code is written by the gateway against tests written first; auth and
row level security are reviewed line by line by Claude.
