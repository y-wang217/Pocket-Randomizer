# Stage 4.7 phone regressions: measured, and the cut not made

Working from
[`../../spec/gymrun-patch-4.7-phone-regressions.md`](../../spec/gymrun-patch-4.7-phone-regressions.md).

Step 1 shipped. **Step 2 hit its own stop condition and steps 3 and 4 did not
run.** The prompt's instruction is the reason, quoted rather than paraphrased:

> If the pre-PR-#10 number is already above 740, say so and stop; the regression
> is older than 4.7 and needs a different diagnosis.

It is. The number is below.

## Step 2: the fourth move button, on three trees

390x844, seed `SMOKE24`, `scripts/visual/measure.mjs` — the same instrument
[`merge-4.7.md`](merge-4.7.md) used, run against each tree's own `dist/`. The
two older trees have no `scripts/visual/`, so the current measurer was copied
in and they were built against this tree's `node_modules`; nothing else about
them was touched. All three lockfiles pin `@pkmn/sim` 0.10.11, `@pkmn/protocol`
and `@pkmn/view` 0.7.3 and `@smogon/calc` 0.11.0, so the shared install is the
install each tree would have got. The bot reaches the first map and the
first battle, both of which are many nodes before any gym, so the pre-gym change
in step 1 cannot move these numbers — and does not: the gate re-measures `main`
at 946.5 after it.

| tree | commit | fourth move button, y of bottom | vs 740 |
|---|---|---|---|
| before PR #10 | `2468769` | **840** | 100 below the fold line |
| `main` after PR #10 | `4343fe3` | **840** | 100 below the fold line |
| `main` now | `9296ba7` | **946.5** | 206.5 below the fold line |

The map's offered nodes, from the same runs, since they were measured anyway:
654.03, then 683.72, then 728.22.

## What the three numbers say

**The fold miss is older than Stage 4.7, and older than PR #10.** The battle
screen's decision point has never ended above 740 on any tree measured here. On
the tree *before* PR #10 the fourth move button already ended 100px below the
line, with the decision point starting at 612 — so 4.7 is not what put it there,
and no amount of 4.7 rollback reaches 740.

**PR #10 changed the battle screen by exactly nothing.** Both battle rows are
identical field for field — 612 and 840, screen height 1083.5, scroll height
1232. PR #10 is the 0.5 verification release: stream keys, boundary tests, and
`data/tierInfo.ts`. Its only layout effect is on the map, +29.69, which is the
tier copy growing a node card's detail line from two lines to four.

**Stage 4.7 did not arrive in PR #10.** It arrived in PR #12
(`claude/gymrun-4-7-legibility-n5j360`), whose UI checkpoint is `0b88321`, and
reached `main` through PR #13 with the visual identity branch. `src/ui/drawer.ts`
and `src/ui/screens/pre-gym.ts` are added by that commit and exist on no earlier
tree. [`merge-4.7.md`](merge-4.7.md) attributes the stage to "PR #10 and PR #12"
and the +106.5 to 4.7; **the attribution of the stage to PR #10 is wrong**, and
the itemisation is measured against `0aa2391` (the V4 branch tip) rather than
against the pre-4.7 `main`. The itemised rows themselves — drawer bar 44.5, foe
header wrap 25, tag rows 37 — are not in dispute. What the numbers here add is
that removing all three lands at 840, not at 740.

## Why that means stop rather than cut anyway

The three cuts in step 3 are worth about 106.5px between them and the gap to 740
is 206.5px. Taking all three, in the order given, and stopping "as soon as the
fourth move button ends at or above 740" would run out of cuts with 100px still
to find — so the prompt's stopping rule never fires and its instruction not to
cut past 740 never binds. That is the shape of a budget being spent against the
wrong cause.

The 100px that predate 4.7 are in rows the prompt does not name: the battle
heading, the two Pokemon panels at 239.25 and 214.25, and the 2x2 move grid
itself. A diagnosis that reaches 740 has to decide something about those, and
deciding it as a side effect of a 4.7 rollback would put the decision in the
wrong stage's report.

## Step 4: the assertion stays `it.fails`

`test/visual-v0.test.ts` marks the y=740 budget as an expected failure so the
gate stays green for the right reason. Flipping it now would turn the gate red
on a tree where the assertion cannot pass. It flips the day the number reaches
740, which is what its comment already says; the comment's account of *why* it
does not hold is what these measurements correct.

## Step 1: the pre-gym softlock, closed

`src/ui/screens/pre-gym.ts` built its decision entirely out of *change*
controls. Slot 0's button is inert because slot 0 already leads; a fainted
member's is inert because `core/run.chooseLead` refuses the slot. On a party of
one that is every button on the screen, so nothing on it submitted anything and
the run stopped there permanently.

The fix is a confirm in a new `.pre-gym__actions` row, carrying the screen's one
accent, labelled with the member it sends (`Send Snorlax in`) so the control
that leaves the screen says who is going in. It submits `defaultLeadSlot(party)`
— the lowest living slot, which is exactly the member `battleMembersFor` would
send first, so confirming it is a reorder the battle would have performed anyway
and is never a slot `chooseLead` refuses. That last part matters when the party
walked out of the previous node with its lead down: submitting 0 there would
throw.

Both bots answered this screen by handing the lead to the lowest *enabled* slot,
which is a choice neither headless runs nor a player leaving the default alone
would make; both now confirm instead, so the browser run and a headless run walk
the same party order. `scripts/smoke.mjs` had a fallback for the solo case that
force-clicked slot 0's disabled button — a disabled button dispatches no click,
force or not, so that path stalled for the full timeout rather than leaving the
screen.

Tested at both ends:

- `test/pre-gym-confirm.test.ts`, jsdom. The screen on a party of one has an
  enabled control and it submits slot 0; the confirm submits the current lead at
  every party size 1 to 6; with slot 0 fainted it submits slot 1 and
  `leadRefusal` accepts it; a sweep over every size and every fainted pattern
  short of a wipe asserts `defaultLeadSlot` never names a refused slot and always
  names the member the battle sends. Plus the headless half: a run declining
  every acquisition keeps its party at the starter, so every gym on seed `SOLO-1`
  is faced by a party of exactly one, and answering `chooseLead` the way the
  confirm answers it clears five of them with a `battle` logged straight after
  every `lead`.
- `test/pre-gym-browser.test.ts`, Chromium at 390x844. The same run in the built
  app on `SMOKE24`: declines captures to gym 1, asserts one slot and zero enabled
  per-slot controls — the exact shape that could not be left — then clicks the
  confirm and asserts the battle screen with its move buttons.

The browser half is not jsdom on purpose. "Disabled" is the whole defect, and a
test that calls the handler directly cannot see it.

## Gate

Green at `sh scripts/visual/gate.sh`: lint, typecheck, 876 tests across 68
files, build, and the guarded screen heights equal to
`docs/visual/baseline/heights.json` to the pixel. `heights.json` is unchanged —
the map and the first battle are reached before any gym, so the pre-gym change
cannot move them, and it does not.

`npm run smoke` plays its full run and its rematch, so the pre-gym screen is
answered by the confirm end to end in the built app, and reports one failure:

```
FAIL the offered nodes are fully visible without scrolling (cards end at y=869 of 844)
```

**Not this patch's, and worth recording rather than mentioning.** The same run
on `9296ba7`, this branch's base, fails identically at the same 869 — checked
rather than assumed. It is the map's half of the fold miss above, over the
scrollable 844 rather than the 740 line, which makes it the second instrument
saying the vertical budget is missed on `main` today.

### Strict trim is red on `main`, and this patch adds one row to it

`CLAUDE.md` names strict trim an absolute gate. It is not currently green, and
that is not this patch's doing either:

| tree | `GYMRUN_TRIM_STRICT=1 vitest run` |
|---|---|
| `9296ba7`, the base | 5 files, 22 tests failed |
| this branch | 6 files, 23 tests failed |

Every failure in both columns is a *browser* test file — `visual-v0` through
`visual-v4`, and now `pre-gym-browser` — and every one of them fails in the same
place, `openApp` timing out on `waiting for .starter to be visible`. **The app
does not boot at all under strict trim**, because something in the bundle reads
the trimmed `learnsets`/`legality` tables at start-up and the strict proxy
throws instead of returning empty. Nothing in this patch touches data or the
adapter; the one added row is the new browser test joining the five files
already there, for their reason.

That is its own defect and its own patch — the trimmed read has to be found and
either removed or made lazy. It is recorded here rather than worked around,
because the alternative is to write the one new browser test differently from
the five beside it in order to make a red gate look one row shorter.
