# Security: private material, a public repo, and live servers

The memo every session follows before it commits a file that names a server.
The invariants it produces are in [`../CLAUDE.md`](../CLAUDE.md) under
"Secrets and private material"; this file carries the argument and the
procedure. The mechanical half is `test/security.test.ts`.

Prompt: [`spec/gymrun-security-memo.md`](spec/gymrun-security-memo.md).

## 1. Every branch of this repository is public

An unauthenticated request to the GitHub API for this repository returns it.
So every branch, every tag, every `claude/*` working branch and every commit
that was ever pushed is readable by anyone, now and after it is deleted, by
anyone who fetched in between.

The consequence is one rule with no exceptions: **nothing private is committed
on any branch, ever.** A "private branch" of a public repository does not
exist, a release branch that strips files still has the files in the history it
was cut from, and a `.gitignore` entry protects a file only until someone adds
it with `-f`. The mechanism is not a branch format. It is that private material
has a different home, section 3.

## 2. Three tiers, and where each lives

| tier | what it is | examples | lives in |
|---|---|---|---|
| **public** | anything that is safe in the open and that review needs | source, `supabase/migrations/*.sql`, every RLS policy, `.env.example`, every document under `docs/` | this repository |
| **configuration** | not a secret, but not committed: it names an instance rather than the code | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env.local` on a developer machine; the static host's environment variables for a deploy |
| **private** | anything that grants access, and anything the owner keeps to themself | the `service_role` key, the database password, dashboard credentials, the project ref written in prose, admin SQL, the abuse thresholds and caps, runbooks, incident notes, backup notes, the owner's own notes | the private companion repository, section 3 |

Two things in that table are deliberate and will look wrong to a first reader.

**The schema and the RLS policies are public.** Security that depends on the
schema being secret is broken by design. The anon key ships in every player's
browser, so anyone can read the table's surface through PostgREST anyway; what
stops them writing what they like, or reading rows at all, is row level
security, and RLS is code that should be reviewed in the open. Hiding the
migrations would block review and protect nothing.

**The anon key is configuration, not a secret.** It is the `anon` role's
credential and it is in the bundle by design. It is still not committed,
because it names one project and a repository names none: a fork, a second
deploy and a test project all want a different value in the same place.

## 3. The companion repository

Private material lives in a second, **private** GitHub repository:
`y-wang217/pocket-randomizer-ops`. The owner creates it; this repository only
names it.

What goes there: everything in the private row of the table above, plus the
seed values for `public.limits` (section 5), the dashboard steps taken on the
project, the admin SQL, and the runbooks.

How it relates to this repository:

- This repository may **name** it, here and nowhere else. It never
  **references** it: not as a git submodule, not by a relative path, not by a
  symlink, not as a build input, not as a test input. `npm run check` passes on
  a clean clone of this repository alone, with the companion absent.
- A session that needs the private material attaches the companion repository
  with the session's own repository tool. It reads from it; it does not copy
  from it into this repository.
- The one seam between the two is data, not files: a public migration defines a
  table, the private repository holds the statement that seeds it.

## 4. Live servers get `dist/` and nothing else

The deploy is the static bundle `npm run build` writes to `dist/`, and only
that. Vite bundles what `src/` imports plus the contents of `public/`; nothing
under `docs/`, `supabase/`, `test/` or `scripts/` reaches the artifact, and no
markdown, SQL or `.env*` file ever appears in it. This was true by accident
before the memo; `test/security.test.ts` asserts it now, so it stays true on
purpose.

Configuration reaches a deploy through the host's environment variables at build
time, never through a committed file.

## 5. Server-side security is RLS, never secrecy

For every table this repository's migrations create:

- Row level security is enabled.
- `anon` and `authenticated` get the narrowest grant that the client needs, and
  no more. For the stats table that is insert only, with `player_id = auth.uid()`
  checked, and no select, update or delete policy at all. Reads go through one
  `security definer` function that returns an aggregate and never a row.
- Every `security definer` function pins `search_path`.
- Abuse limits are enforced in the database, not in the client, and the
  numbers are **data in a one-row table** that the private repository seeds.
  The trigger that reads them is public; the values are not.

## 6. Secrets never enter this repository through any door

Not `src/`, not `docs/`, not a prompt filed under `docs/spec/`, not a handoff,
not a sim report, not a screenshot, not a test fixture, not a commit message,
not a pull request body. `.env.example` carries variable **names** with empty
values and nothing else. `test/security.test.ts` scans every tracked text file
for the shapes secrets take.

**The one exception to the verbatim-prompt protocol.** `docs/spec/README.md`
requires every prompt to be committed verbatim before work begins. A prompt
that arrives carrying a secret is the one case where the two rules collide, and
the memo wins: the secret is replaced in the filed copy by
`[REDACTED: what it was]`, and the register row records that a redaction was
made. The prompt is otherwise untouched.

## 7. If a secret lands in history

1. **Rotate it first.** In the dashboard, the moment it is noticed. A leaked
   key that no longer works is not a leak.
2. **Then purge**, if it is worth the disruption: rewrite the history, force
   push, and tell anyone with a checkout. This is hygiene, not a fix. It
   assumes nobody fetched in between, and on a public repository that
   assumption is unverifiable.
3. Record it in `docs/README.md` section 5 as an open item until the rotation
   is confirmed, then close it with a dated note.

## 8. What this memo does not cover

Player data. The stats tracker stores no identity beyond an anonymous auth uid
and no free text; the schema's check constraints are what keep that true. When
player accounts arrive (Stage 5), a privacy section is added here before the
first table that stores an email is migrated, not after.
