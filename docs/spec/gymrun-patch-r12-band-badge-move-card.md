# GYMRUN R12: Band Badge on Every Move Card, plus V5 Amendments

Paste R12 into Claude Code on main after Release C
(`claude/release-c-battle-feedback-ji40l7`) is merged. Apply the V5 amendments
in section 2 to the V5 prompt before pasting it.

## 1. R12 PROMPT

You are patching GYMRUN on top of merged Release C. Display only. One commit.
No version axis moves, seeded output byte identical by both instruments.

Read `docs/reports/v5-unblock-audit.md` section 4, `src/ui/chip.ts`,
`src/ui/reward.ts` around line 61, `src/data/bandInfo.ts`, and every surface
that renders the shared move card or move button.

### The change

`bandChip` has one caller, the reward card. Move it into the shared move
component so `BAND n` renders wherever a move renders, resolved through
`bandOfMove` in every case. Keep the `band` tooltip from `bandInfo.ts`
attached, unchanged, through the one tooltip layer. Do not add a second
computation and do not add a second tooltip mechanism.

### Report before code

List every surface that renders a move today, by file and line. Expected at
minimum: reward card, battle move button, party drawer, and any recipient or
replacement screen if Release A has landed since the audit. This list is the
assertion list for test 1.

### Rules

* Same chip variant, same size, same weight on every surface. A band 4 chip is
  not brighter or larger than a band 1 chip. The accent stays on
  `.primary-action`.
* The chip resolves through `tokens.css`. The V0 hardcoded-value grep and the
  Release C duration pin both stay at their current counts.
* The move button on the battle screen has a 44px minimum touch target and a
  2x2 grid filling the width. The badge fits on the face without either
  changing. If it does not fit at 390 wide, report the measurement and stop
  rather than shrinking the target.
* Re-record `docs/visual/baseline/` in the same commit that moves it. Report
  the height delta per surface from `heights.json`; the battle decision point
  must not move.

### Tests

1. Band badge renders on every surface in the report list, asserted per
   surface, and every one resolves through `bandOfMove`.
2. Chip weight rule: identical size and weight across bands and across
   surfaces, extending the Release C weight test.
3. Token grep and duration pin unchanged.
4. Guarded heights: battle decision point unmoved; any other delta recorded in
   the commit.
5. Seeded output byte identical, SMOKE24 exit 0 with the one marked `xfail`,
   full suite green at 913 plus the new tests.

### Definition of done

A player comparing an incoming band 3 against four current moves sees five
labelled cards, and the label looks the same on all five.

## 2. V5 amendments

Apply to the V5 prompt before pasting.

**The event strip already exists.** Release C added a 36px flag strip under the
scene, rendered through the V2 chip component, with side marking reusing the
log's vocabulary. V5's "log collapses to a one-line event strip" is that strip,
not a second one. Collapse the log into the Release C strip: the strip holds the
ordered turn events and the flag words together. Do not build a second strip.
Do not add a second reading of the protocol; C's mapper and the log's ordered
turn data already come from one read.

**Budget.** The audit measured 1290.5 before Release C. Release C added 36 for
the strip, so the starting height is 1326.5. V5's budget line for the strip
(36) is already spent, which means the three cuts the plan names must clear 36
more than the audit's 754.5 calculation assumed. Re-measure at V5 step 1 rather
than reusing the audit figure.

**Test 4 rewrite.** Replace "an effectiveness chip renders on every button"
with: every rendered effectiveness marker is the same size and weight, and no
marker is brighter than the neutral state. Neutral suppression at
`scene.ts:610` stays.

**Test 5.** Assumes R12 merged. If R12 is not on main, V5 cannot start.

**Baseline.** V5 moves both guarded baselines. The open V0.5 `--font-body`
decision moves them too. Answer it before V5 or after V5, never inside it.
