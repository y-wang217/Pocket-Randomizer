# The daily stats tracker: prompt, decisions, and scope report

**Committed 2026-09-16 before any work, on `claude/determined-davinci-2bm0ch`.**
The prompt verbatim, then the four questions asked before any design and their
answers, then the scope report the owner asked to have written into the repo.
The security requirement that arrived on this report is its own prompt,
[`gymrun-security-memo.md`](gymrun-security-memo.md), and governs everything
below through [`../security.md`](../security.md).

Line references in the report were read at `1b45c4c`. `main` took Stage 4.9
(PR #39, 106 files) before this file was committed, so a line number is where
to start looking, not where the thing is.

## The prompt

> help me scope the lift for creating a global stat tracker that resets daily:
> which pokemon are used most
> which moves
> and what's least
> and where is the average player's completion
> which items most/least

## The four questions, and the answers

**1. A global tracker needs a server, and GYMRUN has none today (static bundle,
no fetch calls, no CI). Where should the aggregation service live?**
Options offered: Cloudflare Worker + D1 (recommended), Supabase, the same host
as the site.

> **Answer: supabase bc we can do player accounts using that architecture.
> validate my assumption for that and include in your report to write to the
> repo**

**2. What should "moves used" count?** Options: moves selected in battle,
resolved to ids via replay (recommended); moves on the party at run end.

> **Answer: Moves selected in battle.**

**3. Which runs make up "today"? There is no daily seed yet (architecture.md
lists it as Stage 5, unbuilt).** Options: all runs finished that UTC day
(recommended); only a shared daily seed.

> **Answer: all runs for now. extend to daily seed come stage 5**

**4. CLAUDE.md forbids "ordering that implies ranking" on player-facing copy. A
most/least-used list is a popularity ranking. Where may the stats screen be
reached from?** Options: summary screen only (recommended); also from the
header / starter screen.

> **Answer: Summary screen only.**

---

## Scope report

### What exists today, and why the feature is bigger than it looks

GYMRUN is a static bundle with no backend, no CI, no `fetch` anywhere in `src/`,
and no `Date` anywhere in `src/`. Persistence is one run log in `localStorage`
(`src/ui/storage.ts`, key `gymrun.lastRun`), cleared at run end.
`docs/architecture.md` says that is the entire extent of persistence by design,
and lists daily seed, run history and unlocks as Stage 5, unbuilt.

So this feature is:

- **the project's first network call**, and its first server;
- **a new pure summary layer in `core/`**, because the run log deliberately
  stores only indices (`src/core/types.ts`, `RunDecision`): a reward decision is
  an index into an offer the seed reconstructs, not the item taken, so nothing
  can be counted from the log without the run state;
- **the first server setup in the repo**, which is what the security memo governs.

### The Supabase assumption, validated

The owner chose Supabase to grow into player accounts. The assumption holds.

Supabase gives Postgres plus PostgREST (`/rest/v1/<table>`, `/rest/v1/rpc/<fn>`)
and GoTrue Auth: email and password, magic link, phone, OAuth (Google, Apple,
GitHub, Discord) and **anonymous sign-ins**. `signInAnonymously()` yields a real
`auth.users` row; it is later upgraded in place with `updateUser({ email })` or
`linkIdentity({ provider })` and keeps the same `auth.uid()`. Rows keyed on that
uid survive the upgrade with no migration. RLS policies read `auth.uid()`. So
keying runs on an anonymous uid now is the seed of player accounts later, at no
extra cost.

What it costs:

- The anon (or `sb_publishable_…`) key is public by design: it ships in every
  player's browser. RLS is the entire security model. The `service_role` key
  must never appear anywhere in this repo.
- Free tier: two projects, 500 MB, and a project with no API traffic for seven
  days is **paused** and restored by hand from the dashboard. The client must
  treat that as "unavailable", silently.
- Anonymous sign-ins are rate limited per IP (default 30/hour), which bounds
  sock puppets but not a patient adversary. The stat is advisory and
  non-competitive, which caps the payoff.
- `@supabase/supabase-js` is on the order of 40 KB gzipped against the 3.5 MB
  chunk limit in `vite.config.ts`. `npm run measure` reports it.

### Design decisions

1. **Hook, not replay.** Add an observation-only
   `onBattleChoice?: (view: BattleView, choice: Choice, node: NodeSpec) => void`
   to `PlayRunOptions` in `src/core/run.ts`, fired inside the `recording` policy
   in `playNode`, the one place a `BattleView` (with `moves[].id` and `slot`)
   meets the player's `Choice`. It fires for live, resumed and replayed choices
   alike, so a mid-run reload loses nothing. A full replay at run end was
   costed and rejected: the benchmarks put a scripted run at 0.3 to 0.85 s in
   Node, a human run is longer, phone JS is slower, and there is no worker, so
   the estimate is 2 to 8 s of main-thread jank at the moment the summary
   appears. Replay is kept as the determinism *test* only.
2. **Canonical id is the Showdown dex id.** Items already are (`ItemId`),
   `MoveView.id` already is, species display names normalise via `toId` in
   `src/data/blacklists.ts`. No new `data/` file, so `contentHash` holds.
3. **No clock in `src/`.** The RPC defaults `day` to
   `(now() at time zone 'utc')::date` server-side. `Date` stays at zero uses.
4. **Anonymous Supabase auth session** via `@supabase/supabase-js`, rows keyed
   on `player_id uuid null default auth.uid()`. The cut if the lift must
   shrink: bare anon insert, no SDK.
5. **Aggregate filtered by `content_hash = current build`**, passed by the
   client, so a table edit does not mix populations.
6. **Failed submits are dropped**, not queued: `submitted_at` is a server
   default, so a queued flush lands on the wrong day. `keepalive: true` on the
   fetch covers tab close.
7. **No version axis moves.** No logged decision changes, no draw, no `data/` edit.

### Phases and lift

Total **9 half-days**, about four and a half working days. The memo is its own
patch and merges before any Supabase file exists on `main`.

| phase | what | lift |
|---|---|---|
| S | the security memo, its `CLAUDE.md` section, `.env.example`, `.gitignore`, `test/security.test.ts` | 1 half-day, own PR, first |
| 0 | this file and its register row | 0.5 |
| 1 | `core/`: the `onBattleChoice` hook; `src/core/runSummary.ts` with `RunSummary`, `createRunRecorder`, `speciesIdOf`; `test/run-summary.test.ts` (headless `SMOKE24`, replay equality, resume equality, pool id check, purity regex, `RUN_LOG_VERSION` unchanged) | 1.5 |
| 2 | Supabase, public: `supabase/migrations/0001_runs.sql`, `supabase/README.md`. Table `runs` with check constraints (`gyms_cleared` 0..8, array caps, `^[a-z0-9,]*$` charset, victory implies 8), `day` generated in UTC, index `(day, content_hash)`, `daily_seed boolean` unused until Stage 5. RLS: insert only for `authenticated` with `player_id = auth.uid()`, no select/update/delete. A `before insert` trigger reads a per-uid daily cap and a global cap from a one-row `public.limits` table **seeded by the private repo**, so the migration is public and the thresholds are not. RPC `daily_stats(content_hash, day default utc today)`, `security definer`, pinned `search_path`, returning runs, mean gyms, a nine-bucket distribution, and most/least 5 for species, moves and items. "Least" is the smallest non-zero count among things that appeared that day | 1.5, includes creating the project |
| 3 | `ui/` transport: `src/ui/stats/client.ts`, the only file in `src/` allowed `fetch`, `import.meta.env` or `@supabase/`; submit at the run-end hook in `app.ts` after the summary renders and before `clearRunLog()`, fire and forget, discarded on abandonment; `shareStats` toggle in `settings.ts` default on; typed env keys; keys absent means no button and no call. Tests: `test/stats-client.test.ts` with an injected fetch; `test/boundaries.test.ts` gains an allowlist of size one and a `Date` ban across `src/` | 1.5 |
| 4 | the stats screen: `src/ui/screens/stats.ts`, `'stats'` on `ScreenName` and nowhere in `DRAWER_SURFACES`/`MAP_SURFACES`, a fifth hollow button on the summary hidden when disabled, names resolved in `ui/` from `SPECIES_POOL`, `describeMove` and `itemById`. Counts only: no "top", "popular", "meta", "best", no highlighting of the player's own picks. `test/stats-screen.test.ts` mirrors `test/scoring.test.ts`: no decision surface imports it, `showScreen('stats')` appears exactly once | 2 |
| 5 | docs: `architecture.md` persistence section and "Deliberately absent"; a dated `generation.md` section; `docs/README.md`; the root README's quick start | 1 |

### Risks

- **Ranking against the copy invariant.** Held by summary-only reachability
  plus the wording test, the way score is. Fallback if read strictly: dex-order
  lists with counts and no most/least split.
- **Spam and poisoning.** Shape checks, per-uid and global caps from `limits`,
  the IP rate limit on anonymous sign-in. Not mitigated: many IPs. Say so.
- **A secret in a prompt.** The verbatim protocol and the memo conflict exactly
  once, and the memo wins with a recorded redaction.
- **The companion repo drifting from the migrations.** The `limits` table is
  the one seam: the public migration defines it, the private repo seeds it.
- **Population mixing across builds.** Filtered by `content_hash`; the stat
  restarts from zero the day a table edit ships.
- **Rematch inflation.** "Rematch this seed" counts as a run; `seed` is stored
  so it is analysable later. Deduping is a policy decision not asked for.
- **Free-tier pause.** The client renders "unavailable" and never blocks the summary.
- **Anonymous user growth.** Cleanup orphans `player_id`, hence nullable with
  `on delete set null`.
- **Resume correctness.** The hook fires for replayed decisions inside
  `resumeRun`; the Phase 1 resume test is the guard.
