# Handoff: overnight Branch 2, the priority and speed aware AI

Branch `claude/overnight-2-ai-priority`, from
[`../spec/gymrun-overnight-contenthash-ai-tutorial.md`](../spec/gymrun-overnight-contenthash-ai-tutorial.md),
Branch 2. Record: [`../balance.md`](../balance.md) section 15; the rule itself
is the header of `src/core/battle/ai.ts`.

## Morning decisions

**First, because the prompt asked for it on the first screen.**

1. **Keep, retune, or revert.** Mean gyms cleared, `greedy`, RETUNE, 400
   seeds: **4.960 → 4.873, delta −0.088**; completion 40.25% → 39.0%. The
   `random` bot went 2.198 → 2.263, so the **`greedy`−`random` gap narrowed
   by 0.15** rather than widening as the prompt expected — the rule is
   defensive, and a better-defended opponent taxes the competent player more
   than the random one. **The priority branch fired on 4.2% of AI-decided
   turns** (3.1% escapes, 1.1% priority kills) and changed the pick on 3.4%,
   above the ~2% line for "nearly inert". The definition of done holds: a
   slower AI with Quick Attack in hand no longer tackles into its own
   knockout, on the five fixed positions and in 3.1% of all turns. Nothing in
   `data/` moved, so "retune" here means a rule change, not a table change.
   Section 15.5 of `balance.md` lays out both cases without choosing.
2. **Merge to `main`.** As for Branch 1: the integration branch
   `claude/overnight-infrastructure-8r4nd4` carries this branch; `main` was
   not pushed to by this session.
3. **The twelve wrong speed forecasts in 2,262 bracket-0 turns (0.5%)** are
   the approximation's unmodelled layers — an item or ability touching Speed.
   Release C's report already named the fix for the turn reading oddly (a flag
   word for a Speed-decided turn). Whether 0.5% is worth that word is a phone
   decision, not a code one.

## Merged at

The branch's last code commit is `f03f73b`; this file is the commit
after it, and the merge is a fast-forward, so the integration branch's head
after the merge is the commit that added this file:
`git log -1 --format=%H -- docs/handoff/overnight-2-ai-priority.md`.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-13/gymrun-0.3.0` | **none** — asserted literally in `test/ai-priority.test.ts` |
| `contentHash` | `b022fc4e…` | **none** — asserted literally; the branch touched `core/battle/`, `scripts/`, `test/` and `docs/`, none of which is hashed |
| `AI_VERSION` | `gymrun-ai-2-switching` | `gymrun-ai-3-priority` — the one constant change; the Branch 1 guard refuses a `-2` log naming `aiVersion` and both values |
| `randomizerVersion` | `gymrun-randomizer-13` | **none** |

## Baseline for the next branch

Branch 3 is presentation only and must move none of these.

- **Step 0 confirmation of Branch 1's baseline:** the full suite on the merged
  Branch 1 head (`e0599b9`) was **1199 passed, 9 failed**, exactly the floor
  Branch 1's handoff predicted; the fixture sha256 matched
  (`fd91f8b7…`); the benchmark prefix is RETUNE at 400 seeds and the pre-patch
  run reproduced 4.96.
- **Test count:** 1224 tests in 95 files (Branch 1 had 1208 in 94). The full
  suite on this branch's head: **1215 passed, 9 failed**, the nine being the
  inherited floor below and nothing else, with four vitest worker RPC
  timeouts under load that failed no test. Build (`tsc` plus `vite build`)
  green; lint green.
- **`test/fixtures/sim-report.json` sha256:**
  `62a4792448b3c897e6b73d66cdfacc965f9eae4244ee90e0b29d254299d6edca`. Re-minted
  for this patch and annotated in `test/sim-fixture.test.ts`; it differs from
  Branch 1's because the opponent chooses differently, and Branch 3 must leave
  it byte identical.
- **SMOKE24:** **passed**, 47 checks in Chromium against the built bundle, seed bar `GYMRUN-b022fc-SMOKE24`, the run playing to its ending under the new opponent. No xfail marker exists; the prompt's "keep SMOKE24's
  xfail marker as is" has nothing to keep, as Branch 1 recorded.
- **Benchmark:** mean gyms cleared **4.873** (completion 39.0%), prefix
  **RETUNE**, **400** seeds, `greedy`, nodes `rest`. Read down RETUNE, never
  across. Report:
  `sim-reports/benchmarks/2026-09-11T01-51-12-604Z-gymrun-randomizer-13-ai-3-400.json`.
  `random` on the same population: 2.263.
- **The nine inherited failures** are unchanged from Branch 1's handoff and
  remain the floor: `backpack` (a resume test past its timeout on this
  machine), the four "vertical budget to the pixel" checks in `visual-v0` to
  `visual-v3`, `visual-verbosity`'s threat-readout toggle, and two summary
  world/locale checks in `visual-v1` and `visual-v3`.

## Decisions taken

1. **`baseSpeed` on `ActiveView` is `storedStats.spe` for both sides.** One
   fixed spread makes it equal to the species-and-level computation the facts
   layer uses for the foe (`test/stats.test.ts` holds the two together), so
   reading it off the foe leaks nothing; `BattleView.speed` is the helper's
   output for both sides.
2. **The helper applies stages, then paralysis**, the engine's own order, and
   reports an exact tie as `unknown`. The AI treats `unknown` as "assume I act
   second", the safe reading for an escape rule.
3. **"The opponent's highest expected damage move would KO"** is the existing
   `incomingDamage` bound (`risk >= 1` on the move evaluations), evaluated from
   the foe's side with the same `@smogon/calc` path — no second damage model,
   and the AI still does not read the foe's move list.
4. **Step 4 fires only when the greedy pick was not itself a priority
   knockout**, so the fire rate counts decisions the rule actually made.
5. **`decide()` is exported** alongside `greedyAiPolicy` (which is
   `decide(view).choice`), carrying the branch, the greedy alternative and the
   forecast order, so the simulator and the audit count without a second AI.
6. **The simulator counts on both sides.** `greedy` is the same AI for the
   player bot and the opponent, so the rate is over every AI-decided turn.
7. **The `random` comparison was run on both heads**, because the 4.8
   benchmark recorded `greedy` only and the gap needs both.
8. **The fixture battle and the data digest did not move**; only run records
   did, which is what an opponent-policy change should move.

## For the next branch

- Branch 3 must re-mint **nothing**: the sim fixture, the visual baseline and
  `heights.json` are all to stay byte identical. If a Branch 3 change moves
  any of them, it is not presentation only.
- Branch 3's `data/tutorial.ts` is copy read by `ui/` only and **must be added
  to the exclusion list** in `build-config/content-hash.ts` with a reason, or
  `contentHash` moves (Branch 1's handoff says the same).
- `scripts/priority-audit.ts` is the Release C interaction check and can be
  re-run at any prefix; the 20-seed figures are in `balance.md` 15.4.
- Suite timing: the full suite takes 14 to 17 minutes on this machine and
  three vitest worker RPC timeouts ("Unhandled Errors") appear under load
  without failing a test. They appeared on `main`'s baseline too.
