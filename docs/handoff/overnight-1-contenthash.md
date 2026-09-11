# Handoff: overnight Branch 1, `contentHash`

Branch `claude/overnight-1-contenthash`, from
[`../spec/gymrun-overnight-contenthash-ai-tutorial.md`](../spec/gymrun-overnight-contenthash-ai-tutorial.md),
Branch 1. Record: [`../generation.md`](../generation.md) section 9.

## Merged at

`<<MERGED_AT>>`

Merged into the integration branch `claude/overnight-infrastructure-8r4nd4`,
which is the branch this session was told to push to. **`main` was not pushed
to by this session.** The integration branch is a fast-forward of `main`
(`0712032`) plus the three overnight branches in order, so a morning merge of
it into `main` is a fast-forward with no conflicts to resolve. Every later
"merged at" in this file and the next two names a commit on that branch.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-12/gymrun-0.3.0` | `gymrun-run-13/gymrun-0.3.0` — the `versions` block is a changed log shape |
| `contentHash` | did not exist | `b022fc4e4fdd36cb235a58b23d4690180da9488da9081726fc25ea705a66bebf`, display `b022fc` |
| `AI_VERSION` | `gymrun-ai-2-switching`, unguarded | **none** — the constant did not move; it is now recorded into every log and checked at replay |
| `randomizerVersion` | `gymrun-randomizer-13` | **none** — kept, not retired; now an axis of the `versions` block |

## Baseline for the next branch

Every number below is from this branch's head, after step 5, on this machine.

- **Test count:** `<<TEST_COUNT>>`. `<<TEST_FAILS>>`
- **`test/fixtures/sim-report.json` sha256:** `fd91f8b7e6e1fb9924b14e6b62f13c37f751834c332deb916b16c1ed705c8715`.
  Its diff from `main` is two header lines (`version` and a new `contentHash`);
  every run in it is byte identical. Branch 2 changes opponent choices, so
  Branch 2 re-mints it and this hash is the one it must *differ* from.
- **SMOKE24:** `<<SMOKE>>`. There is no xfail marker on it: Stage 4.8 step 7
  closed the map fold miss and deleted the marker helper, so the prompt's
  "expected xfail on the 4.7 map overflow" is stale. The smoke is pass or fail.
- **Benchmark:** mean gyms cleared **4.96** (completion 40.25%), prefix
  **RETUNE**, **400** seeds, policy `greedy`, nodes `rest`. Run on this branch
  before any code was written; identical to the digit to the 4.8 row in
  `docs/balance.md` section 0 and section 14. Read down RETUNE, never across.
  The report is `sim-reports/2026-09-11T00-53-54-238Z-gymrun-randomizer-13-400.json`,
  not committed (ad-hoc reports are not; the 4.8 benchmark file carries the
  same numbers).
- **`main` was not green at the start.** At `0712032`: `tsc --noEmit` failed
  in `src/ui/screens/summary.ts` (fixed as this branch's first commit, `56aba89`),
  and the full suite was 1155 passed, 11 failed in 8 files:
  `visual-baseline` and `summary` on a stale `data-digest.txt` (fixed here by
  re-recording), and nine in `backpack`, `visual-v0`, `visual-v1`, `visual-v2`,
  `visual-v3` and `visual-verbosity` that this branch did not touch — the
  "vertical budget to the pixel" checks against `heights.json`, a
  threat-readout toggle check, two world/locale checks on the summary, and a
  resume test that runs past its 60s timeout on this machine. Those nine are
  the floor Branch 2 and 3 inherit; a branch that adds to them has broken
  something, a branch that matches them has not.

## Decisions taken

1. **Glob, with an exclusion list, and a mechanical exclusion rule.** The hash
   is over `src/data/**`; a file is excluded only if nothing under `src/core/`
   imports it at any depth, and `test/content-hash.test.ts` walks the import
   graph to hold that. Ten files are excluded, each with a reason, in
   `build-config/content-hash.ts`. Four copy-shaped files stay hashed because
   `core/` reaches them (`archetypes`, `moveCopy`, `data/moveTags`,
   `abilityEffects`).
2. **`tuning.ts` is hashed whole**, display fields included. Release C's
   recommendation to move `battleFeedbackMs` and `maxMoveTagsOnFace` out is
   recorded as open and small, not taken, because it changes what the simulator
   sweeps.
3. **`randomizerVersion` kept.** Readers beyond the guard and the sim stamp:
   `ui/stamps.ts`, `scripts/visual/baseline.ts`, the sim fixture header, the
   benchmark filename. And it names draw composition, which the hash cannot see.
4. **The `versions` block has four axes, and `runLog` is a string.** The prompt
   wrote three axes and `runLog: number`. Four because of decision 3; a string
   because `RUN_LOG_VERSION` composes the engine version into itself and a
   number would lose that half. Recorded in `generation.md` section 9 as a
   deviation.
5. **The hash is a virtual module, not a generated file.** Served by a Vite
   plugin in `build-config/` under `virtual:gymrun/content-hash`, so it cannot
   be stale and there is nothing to regenerate. `src/core/contentHash.ts` is
   the one importer.
6. **Seed strings render the hash lowercase**, as the seeds document's example
   does, and parse case-insensitively. A foreign string is refused in the seed
   bar with the bare seed left in the box; a foreign string arriving by URL
   starts the bare seed and shows the same refusal.
7. **`previewRun` was built**, since it did not exist to verify. It is
   `createRun` behind a hash check, in `core/preview.ts`.
8. **The fixture battle moved once.** Deleting the unkeyed sequence ported the
   sim-seed fallback in `driver.ts` to `FIXTURE_BATTLE_KEY`; the Stage 0
   fixture battle in `docs/visual/baseline/battles/` changed with it. No run
   record moved.
9. **The simulator's bots draw through `SIM_POLICY_KEY`**, declared in
   `core/streamKeys.ts` with the other keys. This moves the `random` bot's
   picks; the benchmark policy is `greedy`, which draws nothing.
10. **The stale `data-digest.txt` was re-recorded** with the rest of the visual
    baseline rather than left red.
11. **The prompt was committed to `docs/spec/` first**, as one file for all
    three branches, per the archival rule.

## For the next branch

- **`AI_VERSION`** is `export const AI_VERSION = 'gymrun-ai-2-switching';` in
  `src/core/battle/ai.ts`, line 69. It is read into the log at run creation:
  `currentVersions()` in `src/core/run.ts` builds the block from the four
  constants and `makeLog` writes it, so a bump of that one constant is recorded
  on every new log and refused on every old one by `versionMismatch`, with the
  message `RunLog version mismatch on aiVersion: the log was recorded on
  <old>, this build is <new>. ...`. `test/versions.test.ts` asserts the axis
  refuses independently; Branch 2's "a pre-patch log throws naming aiVersion"
  test is a literal-string version of the same case.
- **Three recordings must be re-minted by Branch 2 and must differ:**
  `test/fixtures/sim-report.json` (`GYMRUN_WRITE_FIXTURE=1 npx vitest run
  test/sim-fixture.test.ts`), the visual baseline (`npx vite-node
  scripts/visual/baseline.ts --write`, whose `runs/*.json` carry the decision
  log and outcome), and `heights.json` is *not* one of them — it is layout.
  Branch 3 must re-mint none of them.
- **A new file under `src/data/` is hashed unless it is on the exclusion
  list.** Branch 3's `data/tutorial.ts` is copy read by `ui/` only; it needs an
  entry in `build-config/content-hash.ts` with a reason, or the hash moves and
  the branch has moved a version axis. The test will refuse the entry if
  `core/` ever imports the file.
- **The prompt's picture of the tree is stale in three places**, recorded in
  `generation.md` section 9: Stage 4.8 is merged (all eight steps, PR #21),
  SMOKE24 has no xfail marker, and `main` did not typecheck.
- **`RUN_LOG_VERSION` and `contentHash` must not move in Branch 2.** Assert
  `gymrun-run-13/` and `b022fc4e…` literally; Branch 2 touches `core/battle/`
  and `docs/`, neither of which is hashed.
- The smoke script's seed check now strips the `GYMRUN-xxxxxx-` prefix; a
  branch that changes the seed bar's display should read the note at
  `scripts/smoke.mjs` before the seed check.

## Morning decisions

1. **Merge to `main`.** This session pushed the three overnight branches and
   the integration branch, not `main`. Fast-forward `main` to the integration
   branch, or open one PR from it.
2. **Stamp the freeze, or not.** `contentHash` exists (`b022fc`). The seeds
   document says the freeze is the act of stamping one as the first shareable
   baseline; that is a decision, and it is not taken here.
3. **`tuning.ts` display fields.** Move `battleFeedbackMs` and
   `maxMoveTagsOnFace` out of `Tuning` into a display-only module (which would
   then go on the exclusion list), or accept that a shadow-duration edit
   refuses shared seeds. Open, small, its own patch.
4. **The nine pre-existing failures on `main`** listed under the baseline.
   None is this branch's; the vertical-budget ones look like `heights.json`
   wanting a re-record after 4.7.2's font swap, which is a phone decision.
