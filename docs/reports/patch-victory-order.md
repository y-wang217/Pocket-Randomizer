# Victory-order patch: report

Branch `claude/victory-screen-battle-ui-p3op20`, 2026-09-17. Prompt:
[`../spec/gymrun-patch-victory-order-and-battle-readouts.md`](../spec/gymrun-patch-victory-order-and-battle-readouts.md).
Full account: [`../generation.md`](../generation.md) section 29.

Six items from one playtest report. All six built.

## What moved

| axis | from | to | why |
|---|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-16` | `gymrun-run-17` | the question order, and the gym-move decline |
| `RANDOMIZER_VERSION` | `-16` | `-17` | three draws added to the final segment's shape pass |
| `contentHash` | `c3964b` | `73c1ee` | `data/tuning.ts` gained `battlePairFromSegment` |
| `AI_VERSION` | — | — | unchanged; nothing here touches opponent policy |

## Item by item

**1. The capture comes before the move.** Built. `playRun` resolves the
acquisition first and asks both move questions against the party it produced, so
the Pokemon that just joined is on the recipient list. `resolveNode` folds the
acquisition ahead of both `applyReward` calls on both branches to match.

**2. The animation order.** *The report was right about the symptom and wrong
about the cause, and the investigation is the deliverable.* The lunges were
already correct — placed off the protocol the engine resolved, asserted against a
real Snorlax/Jolteon fight since Release C. What had no order in it was the HP
chunk: both sides drew theirs on the frame the update arrived. That is now
slotted to the same two slots the recoil uses. The assertion that was missing —
that slot 2 is later than slot 1 *on screen* — shipped as well, on both engines.

**3. Skip the gym reward move.** Built, and only there. `DECLINED_MOVE` is
refused at every other taught move rather than trusted not to appear.

**4. Ability tooltip on the caught-Pokemon card.** Built. One missing
`data-tip` on `screens/acquisition.ts`.

**5. The opposing side's remaining count.** Built. `3/4 left` for a trainer or a
gym, `1/? left` for a wild encounter, marks plus the number, one row to ten. The
battle header's fixed `N Pokemon` came out with it — it was the same question
answered two ways and its answer was the one a wild node withholds.

**6. The final segment's battle pair.** Built, and guaranteed rather than
permitted.

## The four things worth disagreeing with

**The decline's sentinel is a widened field, not a new decision kind.** A
declined move records `{ kind: 'target', index: -1 }`. The alternative was a new
kind, which would have been a schema change for a value that fits in the field
that already exists. Either is defensible; this one keeps the log's shape fixed,
which is what the replay cursor depends on.

**The reward entry stayed where it was.** Item 1 moves only the acquisition. The
`reward` index is still recorded below the gym's Part A `target`, per Stage 4.8
item 2. Moving it as well would have been a second reordering with nothing asking
for it.

**The battle pair costs the rest density.** A six-step route has four steps
claimed before the rest pass runs, so the density target and the pair cannot both
be had. The pair wins and a paired route drops to `minRestSteps` — the guarantee
that a route has somewhere to heal never moves, and `hasBattlePair` refuses to
place at all on a route without room for it. If the trade is the wrong way round,
the knob to turn is `battlePairFromSegment`, not the floor.

**The header lost its team-size line.** That is a small removal with a real
consequence: the opponent's team size is now a live readout on the panel and is
withheld on a wild node. If the fixed count is wanted back for trainers, it
belongs on the panel row, not the header.

## What the fixture proves, and what it does not

`test/fixtures/sim-report.json` was re-minted. Its three seeds die in segments 0
and 1, so:

- **It proves the reorder changed nothing but the order.** `FIXTURE-CHARLIE`'s
  decision kinds moved from `reward target replace acquisition` to
  `acquisition reward target replace` at three nodes; every decision *value*, and
  every node, party, HP and outcome, is byte identical.
- **It proves the early segments did not move**, which is the half
  `RANDOMIZER_VERSION` makes a claim about.
- **It does not exercise the battle pair at all**, because no fixture seed reaches
  segment 7. That is covered by `test/node-curve.test.ts` and
  `test/locales.test.ts` instead, over 24 and 80 seeds respectively.

## The visual baseline was re-recorded, and one run really did change

`docs/visual/baseline/` is the presentation-only guard, and this patch is not a
presentation patch — two generation axes moved — so a re-record is the honest
action rather than a way around the gate. What moved, read before re-minting:

- **Five of the six runs moved `versions` and `log` only.** The log moved because
  the questions are in a different order; every answer and every outcome is the
  same.
- **`SEED-B` also moved `party`, and it is the one finding worth carrying.** It
  ends holding the same two items on the same two members, swapped. Its decisions
  went `reward acquisition items` to `acquisition reward items`, so the captured
  Pokemon's Lum Berry reaches the backpack before the reward card's Silk Scarf,
  and `defaultItemPlan` walks the bag in order. Same nodes, same outcome, same
  species, same moves.
- **The recorded battle protocol is byte identical.** Nothing about how a fight
  resolves moved, which is the half `ENGINE_VERSION` would have had to answer for.

## Balance: recorded, not chased

400 seeds, `RETUNE`, `greedy` pinned, both rows in
[`../balance.md`](../balance.md) section 0.

| | completion | mean gyms |
|---|---|---|
| parent (`a8db385`), `randomizer-16` · `c3964b` | 0.0% | 0.46 |
| this patch, `randomizer-17` · `73c1ee` | 0.0% | **0.47** |

**The parent was measured too, and that is the point of quoting both.** The
nearest row already in the table is at `2eea4c`, a different hash again, so
reading this patch against it would be reading across a yardstick that moved in
between — the mistake section 0 says was already made once and written into the
README.

**+0.01 mean gyms is noise.** Gym clear rates are 42.5 → 43.2 at gym 1 and
identical at gyms 2 through 5; the gym 6 column swings 100% → 0% on a sample of
one run.

**The battle pair is not in this number at all.** No seed in this population
reaches segment 7, which is the only segment it touches — so the patch's one
deliberate difficulty change is unmeasured here and will first appear in a
population that gets that far. It is expected to lower mean gyms when it does.
The reorder and the decline are both in the number and moved nothing, which is
what they should do: the scripted baseline never declines, and the reorder
changes which party a target index resolves against rather than what the bot
answers.

## Gates

`npm run check` green end to end — lint, typecheck, 135 files on Node, 27 files
on WebKit (216 passed, 2 skipped), and the strict-trim leg's 135 again. `npm run
build` and `npm run smoke` green separately. WebKit needed
`npx playwright install-deps webkit && npx playwright install webkit` on this
box; it was not present at session start.
