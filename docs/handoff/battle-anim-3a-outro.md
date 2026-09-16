# Handoff: battle animation run, Branch 3A, the gate and the outro

Branch `claude/busy-noether-jfszvi`, from
[`../spec/gymrun-overnight-battle-animation.md`](../spec/gymrun-overnight-battle-animation.md),
Branch 3, half A. Deviations: [`../generation.md`](../generation.md) section 23.
Report: [`../visual/reports/patch-battle-animation.md`](../visual/reports/patch-battle-animation.md)
sections 7 to 10.

**Taken out of order.** The prompt's branch order is 1, 2, 3. Branch 2 (the
abnormality vocabulary) is not started and this ran before it, under the
prompt's own skip rule: "the outro half depends on nothing". The reason is that
Branch 3A is the defect the playtest actually reported, and Branch 2 is the
largest of the three. Branch 3B, the abnormality beats, does depend on Branch 2
and is not started either.

## Merged at

Not merged. Code commit `758aca0`, pushed to
`origin/claude/busy-noether-jfszvi`. `main` was not pushed to by this session.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-15/gymrun-0.3.0` | **none** |
| `contentHash` | `b381d0…` | **none** — verified, unmoved |
| `AI_VERSION` | `gymrun-ai-3-priority` | **none** |
| `randomizerVersion` | `gymrun-randomizer-15` | **none** |

Branch 3A touches no file under `src/data/` or `src/core/` at all.

## Baseline for the next branch

- **Test count.** Non-browser: **104 files, 1493 tests, all passing** — 103 and
  1480 at Branch 1, plus `test/battle-outro.test.ts` (13). Browser: **22 files,
  182 tests** — 21 and 181, plus `test/visual-battle-outro.test.ts` (1).
  `lint`, `tsc --noEmit`, `npm run build` and `npm run smoke` green.
- **`test/fixtures/sim-report.json` sha256:**
  `72bd4b9d3571b66f0d7d206dc1229e108ba864f6ec7110d51d2aac4933d6487d`,
  unchanged from Branch 1, as it must be.
- **SMOKE24:** passed, all checks.
- **Benchmark:** unchanged and not re-run. Nothing a run reads was touched.

## Decisions taken

1. **The gate lives at `reviewBattle` and nowhere else.** It is the only path
   every battle completion takes, so one `await` covers won, lost, gym, trainer
   and wild with no branch in `core/`.
2. **`outroFor` is pure and exported**, so the decision is unit-tested directly
   rather than inferred from the stage. It reads `review.won` and
   `review.node.acquisition`, both already on `BattleReview`.
3. **An event node's capture is not a `caught`.** That offer comes from the
   chosen outcome's grant rather than from the node, and there may have been no
   fight at all; a ball closing over a gym leader's Pokemon because the event
   behind it paid a species would be a lie about what just happened.
4. **A lost fight is always `defeat`**, even at a node that offers a capture,
   because `core/run.ts` refuses an acquisition after a fight that was lost.
5. **The hold's length is read off `--motion-outro` at the moment of use**, not
   cached and not branched on `matchMedia`. That is what makes reduced motion,
   and a mid-run battle-speed change, work without re-registering anything.
6. **`outro()` resolves rather than rejects on cancel.** Its caller is
   `reviewBattle`, and a rejection there would surface an abandoned run as a
   broken one — the exact confusion `ui/pending.ts`'s `RunAbandoned` exists to
   prevent. This is why it does not use `Pending<T>`, which rejects by design.
7. **A recalled body shrinks, it does not travel.** See "For the next branch".

## For the next branch

- **Nothing in the outro may leave the box its body stood in, and `.stage`
  cannot clip.** The first cut translated a recalled sprite toward its
  trainer — outward, since the foe sits at `right: 0` — and that widens the
  document on a 390px phone, because a transform contributes to scrollable
  overflow. `overflow: hidden` on `.stage` is not available as a fix: the two
  panels are its children and overhang it deliberately. Direction is carried by
  `transform-origin` instead. **Branch 3B's abnormality beats will meet this
  same constraint**, and `scripts/smoke.mjs` cannot catch it, because neither
  the outro nor an abnormality beat runs in a smoke walk.
  `test/visual-battle-outro.test.ts` asserts `scrollWidth` at the outro frame;
  extend that rather than trusting smoke.
- **A test that waits a fixed fraction of the feedback budget and then reads the
  screen is assuming what the budget is for.** `playATurn`, in
  `visual-release-c` and `visual-v5`, used "still on the battle screen and the
  log grew" to mean "the fight survived". The gate made both true of a finished
  fight. Fixed by also requiring an enabled move button. Branch 3B should expect
  to break helpers the same way.
- **jsdom cannot assert the thing that matters.** It resolves no custom
  properties, so `--motion-outro` reads as zero and no hold ever runs. Every
  claim about what is *on screen when* belongs in the browser suite.
- **`--motion-swap` is still the whole budget, now 900ms**, and still unwatched.
  Carried from Branch 1.

## Morning decisions

1. **Watch a fight end.** Everything here is asserted structurally and in a
   browser, but nobody has looked at a recall or a capture on a phone. The
   hand-verification list is in the report. In particular: whether 900ms of hold
   after a fight is right, and whether the ball reads at 24px beside a 96px
   body.
2. **Branch 2 and 3B are not started.** The abnormality vocabulary is the
   largest piece of the run and the reported "wacky things" half of the brief is
   unaddressed.
3. **Merge to `main`.** This session pushed the branch only. Branch 1's own
   morning decisions still stand, including whether the one-time `contentHash`
   move is acceptable.
