# Handoff: battle animation run, Branch 1, the timing

Branch `claude/busy-noether-jfszvi`, from
[`../spec/gymrun-overnight-battle-animation.md`](../spec/gymrun-overnight-battle-animation.md),
Branch 1. Deviations: [`../generation.md`](../generation.md) section 21.
Report: [`../visual/reports/patch-battle-animation.md`](../visual/reports/patch-battle-animation.md).

## Merged at

Not merged. The branch's code commit is `2bf7e68`, pushed to
`origin/claude/busy-noether-jfszvi`; this file is the commit after it. `main`
was not pushed to by this session.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-15/gymrun-0.3.0` | **none** |
| `contentHash` | `53145f…` | **`b381d0b728f8a28d4ef2941d1c9f2754634e3bc45ee2d8625f9dfe1465ab55b6`** — moved, see below |
| `AI_VERSION` | `gymrun-ai-3-priority` | **none** |
| `randomizerVersion` | `gymrun-randomizer-15` | **none** |

**`contentHash` moved and the prompt said no axis would.** Section 21 deviation
1 is the account. The short form: `contentHash` globs `src/data/**`, so taking
three fields *out* of `tuning.ts` changes that file and therefore the hash —
necessarily, for any version of this work, so the prompt's "if it moves, the
split is wrong" check could never have passed.

**Generation did not move, and this is proved rather than argued.** Six recorded
runs in `docs/visual/baseline/runs/` were re-recorded and diffed: every
differing line in all six is a `contentHash` field, and the count of differing
non-hash lines is **zero**. No party, node, logged decision, casualty or battle
protocol changed. `test/fixtures/sim-report.json` likewise differs by one line.

**And the move was unavoidable regardless of the split.** This branch exists to
change `battleFeedbackMs`, and changing it in place would have moved the hash
too — and again on every future retune. The split pays once. `battleFeedbackMs`
at 900 and at 1234 now hash identically.

**What this costs a player:** a seed string minted before 2026-09-16 is refused
at paste time, with the copy `data/seedCopy.ts` already carries. Visible and
recoverable; the bare run seed still starts a fresh run.

## Baseline for the next branch

- **Test count.** Non-browser: **103 files, 1480 tests, all passing** (5
  skipped). Browser: **21 files, 176 tests, all passing**. Strict trim
  (`GYMRUN_TRIM_STRICT=1`): **103 files, 1480 tests, all passing**.
  `npm run lint`, `tsc --noEmit` and `npm run build` green.
- **`test/fixtures/sim-report.json` sha256:**
  `72bd4b9d3571b66f0d7d206dc1229e108ba864f6ec7110d51d2aac4933d6487d`. Moved
  from `62a47924…` by the one `contentHash` line and nothing else.
- **SMOKE24:** **passed**, all checks, against the bundle built from `2bf7e68`.
  No `xfail` this run. The battle screen's stat panels end at y=460 and its move
  grid at y=697 of 844, both unchanged — a patch that writes one custom property
  should move no pixel, and does not.
- **Benchmark: not re-run, and does not need to be.** Nothing under `core/` or
  `data/` that a run reads changed, and the six byte-identical baseline
  recordings are the proof — the same argument, on the same instrument, that
  overnight Branch 3's handoff made. The last recorded figure stands: mean gyms
  cleared **4.873**, prefix **RETUNE**, **400** seeds, `greedy`, nodes `rest`.
  Read down a prefix, never across.

### One measurement artifact, so the next session does not chase it

A first full-suite run reported four failures. Three —
`test/tutorial-browser.test.ts`, `test/map-fold.test.ts`,
`test/gym-pays-twice.test.ts` — each ran **670 to 690 seconds** and were
timeouts rather than assertions: an orphaned `vitest` process from an earlier
stopped run was still resident and the two together held about 70% of RAM.
Killed and re-run in isolation, all three pass in seconds. The fourth,
`test/summary.test.ts`'s data digest, was real and is the hash move.

`EXIT=1` on a strict-trim run with `1480 passed` is the vitest reporter's
`[vitest-worker]: Timeout calling "onTaskUpdate"`, already recorded in
`generation.md` sections 15 and 17 against both suite runs. It fails no test.

## Decisions taken

1. **Three fields moved, not the two the filed item named.**
   `battleFeedbackMs`, `minChipFontSizePx` and `minChipContrastRatio`.
   `maxMoveTagsOnFace` stayed: `core/battle/view.ts` reads it, an excluded file
   may not be a `core/` dependency, and taking it would have disqualified the
   exclusion for all four. Section 21 deviation 2.
2. **`battleFeedbackMs: 900.`** A beat is 225ms, up from 125ms. Judged by the
   ratio the tree already contained: the swap reads at 2.8px per 100ms, the
   lunge did not at 12.8, and 225ms puts it at 3.6.
3. **The four-slot partition is kept.** 225ms reads without decoupling
   `--motion-beat` from `--motion-duration`, so the cheaper answer was available
   and the recorded rationale in `tokens.css` is not superseded. **The budget is
   still one number.** Do not re-open this without watching it first.
4. **Distances unchanged.** `--lunge-distance: 8px` and `--hit-recoil: 4px`
   stand. Duration was the lever that was short, and the tokens' own comments
   constrain the distance more tightly than the duration.
5. **The speed setting is three multipliers, not three durations.** `swift` 2/3,
   `even` 1, `patient` 3/2, on top of `displayTuning`'s one number. `even` is
   exactly `1` so the default reproduces the shipped value bit for bit.
6. **Reduced motion stays in the stylesheet** and is not a fourth speed. The
   media query re-answers itself when the OS setting changes mid-session; a
   value written into the settings store at startup would not.

## For the next branch

- **`--motion-swap` is now 900ms**, because it derives from the budget by
  design — "the same kind of event" as the shadow. Nobody has watched a swap at
  900ms yet. It is flagged rather than pre-emptively special-cased: if it reads
  as sluggish, that is a reason to revisit the derivation, not to add a second
  constant.
- **The three hash pins are `test/ai-priority.test.ts`,
  `test/fixtures/sim-report.json` and `docs/visual/baseline/`** (the digest plus
  six run records, each carrying a `versions` block twice). All four caught this
  move. A branch that moves the hash again must update all of them, and should
  diff the run records rather than blind-re-record — that diff is what proves
  generation held.
- **Branch 3's gate has its seam ready.** `applyMotion(root, speed, ms)` is
  parameterised and re-applied on every settings change, and `motion.ts`'s
  header already documents the one exception to "nothing waits for this" that
  Branch 3 will build. The rule's supersession is written; the code is not.
- **Branch 2 is untouched.** `core/battle/flags.ts` still reads ten kinds.

## Morning decisions

1. **Whether the `contentHash` move is acceptable now.** It is a one-time cost
   that buys a permanently movable display number, and it refuses seed strings
   minted before today. If shared seeds from before 2026-09-16 matter more than
   a readable beat, this branch is the one to revert — but note that any retune
   of `battleFeedbackMs` moves the hash with or without it.
2. **Whether 900 is right**, and whether `swift`/`even`/`patient` are the right
   three. Both are judgements made by reading the ratio rather than by watching
   a fight on a phone, because this session has no phone. The hand-verification
   list is in the report.
3. **Merge to `main`.** This session pushed the branch only.
