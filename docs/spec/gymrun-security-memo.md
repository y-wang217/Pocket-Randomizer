# The security memo: private material, a public repo, and live servers

**Committed 2026-09-16 before any work, on `claude/determined-davinci-2bm0ch`.**
Verbatim. The owner's request, as it arrived, on the report for the daily stats
tracker ([`gymrun-patch-daily-stats.md`](gymrun-patch-daily-stats.md)); the two
questions asked before any file was written; and the answers. The memo itself is
[`../security.md`](../security.md); the invariants it produces are in
[`../../CLAUDE.md`](../../CLAUDE.md).

## The request

> so the big caveat for this plan is i need to have the database setup
> descriptions in the repo and base our development on that. this is a security
> risk, so I'd like to have a design and branch format for live servers to not
> include the docs and other ones I need to myself. make that part of the repo so
> that all future development follows this security memo

## The two questions, and the answers

Asked after one measurement: an unauthenticated request to the GitHub API for
this repository returns it, so the repository is public and every branch of it,
`claude/*` included, is readable by anyone. A branch cannot hide a file in a
public repository, which is what made the first question necessary.

**1. This repo is public, so no branch can hide a file. Where should the private
operational material (Supabase project ids, admin runbooks, abuse thresholds,
your own notes) live?**

- Private companion repo *(recommended)* — a second, private GitHub repo. This
  repo's security memo names it; a session that needs it attaches it. Nothing
  sensitive ever touches the public history.
- Encrypted `ops/` dir in this repo — git-crypt or sops+age; one repo, but a
  file added outside the pattern leaks, and every environment needs the key.
- Make this repo private.

> **Answer: Private companion repo.**

**2. What should stay public? Security that depends on the schema being secret
is broken by design; the anon key already ships in every player's browser, and
the RLS policies are what actually protect the table.**

- Schema, RLS and migrations public *(recommended)* — `supabase/migrations/*.sql`
  and `.env.example` stay in this repo so development and review work from them.
  Only keys, project ids, runbooks, thresholds and personal notes go private.
- Everything Supabase-related private.

> **Answer: Schema, RLS and migrations public.**
