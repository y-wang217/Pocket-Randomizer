# GYMRUN docs

Where things stand. Read [`../CLAUDE.md`](../CLAUDE.md) first for the rules that
do not change, then this for the ones that do.

This file is expected to go stale and to be corrected often. Sections 4 and 5
especially.

## 1. What this project is

GYMRUN is a seeded browser roguelike built over `@pkmn/sim`. There is no
overworld: a run is a starter, then a chain of node choices through eight
segments, each ending in a gym. The same seed and the same decisions reproduce
the same run exactly, and that property is the thing every other design decision
defers to.

## 2. Where to start reading

A session starting cold, in order:

1. [`../CLAUDE.md`](../CLAUDE.md), the invariants. Short by design.
2. This file, for what is merged, what is open, and which designs are dead.
3. [`spec/README.md`](spec/README.md), for the design lineage, the prompt
   register, and what you must commit before you start building.
4. [`generation.md`](generation.md), for what is drawn where and when.

Stop there unless you need a specific answer. The rest of the map is below.

## 3. The document map

One row per document. If a fact changes, exactly one of these files should need
editing.

| File | Authoritative for | Read it when |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | The invariants, and nothing else | Every session, first |
| `docs/README.md` (this file) | Current state, open items, design lineage | Every session, second |
| [`spec/README.md`](spec/README.md) | The prompt register, the archival rule, the parallel session protocol | Before starting any stage or patch |
| [`generation.md`](generation.md) | What each pass draws, from which stream, under which key. Levels, tiers, the band ceiling. Relics and capability gates. Versioning, and what `contentHash` covers and excludes | Adding or moving a draw |
| [`balance.md`](balance.md) | Every simulator figure, the standing policy that balance is not a gate, and the benchmark table | Reading or quoting any number |
| [`keyed-streams.md`](keyed-streams.md) | What the 4.6a stream refactor actually shipped, and the four requirements of its design that were not built | Working on RNG, seeds or replay |
| [`engine-notes.md`](engine-notes.md) | `@pkmn/sim` findings: browser viability, the Gen 3 lock, bundle and trim analysis | Touching the sim adapter or the bundle |
| [`spec/`](spec/) | The prompts and design documents themselves, verbatim | Its README says which are live |

### Where two files touch the same fact

The root [`../README.md`](../README.md) is the player-facing and
contributor-facing front door: quick start, scripts, and the per-stage
changelog. It also currently restates the architecture rules, bundle figures,
balance headlines and an open-questions list. **It owns none of those.**
`architecture.md`, `engine-notes.md`, `balance.md` and this file do,
respectively. Where the root README disagrees with one of them, the other one is
right. Trimming it to pointers is a pending follow-up.

[`architecture.md`](architecture.md) owns layers, seams, the policy interfaces
and run log structure. Where `CLAUDE.md` states an architecture invariant,
`architecture.md` carries the argument for it.

## 4. Current state

**In flight: the bench carryover and the gym level column.** Branch
`claude/amazing-edison-1koyiy`, prompt
[`spec/gymrun-patch-bench-carryover-and-gym-levels.md`](spec/gymrun-patch-bench-carryover-and-gym-levels.md),
record [`generation.md`](generation.md) section 33. Two items from one playtest
report. `contentHash` moves from `fd9b5e` to `94c6c1`, by one column of
`data/scaling.ts`;
`RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all hold.

**"On a new seed, party is not reset" was a `<div>`.** The party was reset —
`createRun` returns `party: []` and nothing in `core/` has ever spanned two
runs. `renderBench` had its two empty cases the wrong way round, each carrying
the other's comment, and the half that mattered is a *party of one*: everything
the side has is on the field, so the panel is cleared, and it was not. The scene
is built once for the life of the page, so a new seed opened on whatever the
previous run had left under SWITCH. The fix is the two branches separated plus a
`Scene.reset()` that `attach` calls, beside the `log.clear()` that was already
there. No test had ever attached two fights to one screen.

**Gym teams are exactly the party's level, everywhere, and that column is no
longer a tuning number.** Stage 4.9 had it at `+0/+1` rising to `+2/+4`; the
report named the consequence rather than the number — a level raises Speed with
everything else, and Speed is read as a comparison, so a gym a level up takes
the first move in every tie the party would otherwise win and no team building
gets it back. Every other lever a gym has is a quantity and survives tuning;
this one is a threshold. The exam is unchanged otherwise: the player's own slot
count, one move band over the segment, the hard AI. Pinned in `opponentLevel`
rather than only in the table, so a later caller cannot reopen it through
`TIER_MODIFIERS`.

**Measured rather than predicted**: 400 seeds, mean gyms cleared **0.545 →
0.81** on the pinned control, completion unmoved at zero; gym 1 clears in 63.8%
of the parties that reach it against 48.3%. `balance.md` section 0 has the row.
The visual baseline was re-recorded — four of its six runs changed only in the
content hash, two changed outcome, and the determinism seed's battle protocol is
byte identical. One browser test was repaired rather than re-baselined: the
abnormality case walked a single seed and the gym column moved that seed's
fights, so it walks a list and fails only when no seed can produce a mark.

**Merged before it: the chip audit.** Branch `claude/serene-bohr-xn433h`, prompt
[`spec/gymrun-patch-chip-audit-and-move-type-icons.md`](spec/gymrun-patch-chip-audit-and-move-type-icons.md),
record [`generation.md`](generation.md) section 30, report
[`visual/reports/patch-chip-audit.md`](visual/reports/patch-chip-audit.md).
Presentation only: no `core/` change, no version axis moves, `contentHash`
unmoved.

Two audits and one small feature, and **both audits landed on decisions already
in the lineage**, so both were put to the author before any code rather than
rediscovered:

- **Patch 4.8.0.3 item 3 is superseded.** The archetype chip is on every surface
  that draws a Pokemon again, bars or no bars. The learn-move recipient was the
  one surface that had neither the chip nor the bars it was traded for.
- **The 2026-09-10 type wheel ruling is superseded for Pokemon type badges, and
  stands everywhere else.** It had been applied to every type chip in the app
  rather than the two it named, so the wheel was reachable from a battle move
  card and nowhere else. A gym leader's type, a locale's types, a threat's type
  and an item's boosted type stay inert.
- The ability is one focusable chip on all nine surfaces that show one. It was a
  real chip on two, a non-focusable `<span>` on two, bare text on one and absent
  on four.
- Battle move buttons carry a type watermark, `ui/theme/typeIcons.ts`.

**One objection is open rather than settled.** `scene.ts` carried a
playtest-derived argument — stronger than the ruling the question quoted — that
the wheel's *offensive* half is misleading beside a Pokemon whose moves are
drawn off-species. It is preserved verbatim in the source. The narrowing that
would close it, a Pokemon badge opening the defending half only, was not asked
for and is not built. See the report's Part 2.

**Merged before it: the victory-order patch.** Branch
`claude/victory-screen-battle-ui-p3op20`, prompt
[`spec/gymrun-patch-victory-order-and-battle-readouts.md`](spec/gymrun-patch-victory-order-and-battle-readouts.md),
record [`generation.md`](generation.md) section 29. Six items from one playtest
report. Three axes move: `RUN_LOG_VERSION` to `-17`, `RANDOMIZER_VERSION` to
`-17`, `contentHash` from `c3964b` to `73c1ee`. `AI_VERSION` holds.

**The headline is that a node offers its Pokemon before it asks who learns its
move.** That is invisible at every node but one — a wild fight that pays a TM
*and* offers its species — where the player spent the card while the member they
might have wanted to give it to was still standing on the far side of the field.
The capture resolves first now and both move questions are asked against the
party it produced. `resolveNode` folds the acquisition ahead of both cards to
match: the same index has to name the same member in both places, or the move
lands on somebody else, silently, and only at those nodes.

**A gym's guaranteed move may now be declined, and nothing else may.** It is the
one taught move in the game the player never chose over alternatives, which is
exactly the argument `chooseMoveToReplace` already makes from the other side for
why every *other* move has no decline. `DECLINED_MOVE` is refused where it was
not offered rather than trusted.

**The animation report was right about the symptom and wrong about the cause,
and that is the most useful thing in the patch.** "A Snubbull went before my
Sizzlipede and the animation for my attack went first" is not the lunges — those
are placed off the protocol and have been asserted against a real fight since
Release C. What had no order in it was the *bar*: both sides drew their chunk on
the frame the update arrived, so the damage the player dealt appeared
simultaneously with the damage they took, before either body moved. The chunk is
slotted now, to the same two slots the recoil uses, from the same reading. The
bar's number still does not wait for anything.

The missing assertion shipped too: nothing anywhere held that slot 2 is later
than slot 1 *on screen*. It is held now, on both engines, both directions, and
the exact two-beat ratio the four-slot budget is built from — and it passes,
which is what says the lunges were never the defect.

Also: the final segment's route always carries two consecutive wild-or-trainer
steps (it trades the rest *density* for them, never the rest guarantee); the
opposing panel carries how much of that side is left, withheld as `?` on a wild
encounter; and the caught-Pokemon card finally has its ability tooltip.

**Previously: the on-device diagnostic, and the artefact PR #41 did not ship.**
Branch `claude/hopeful-lovelace-w118jz`, prompt
[`spec/gymrun-patch-ios-diagnose-instrument.md`](spec/gymrun-patch-ios-diagnose-instrument.md),
record [`generation.md`](generation.md) section 28, report
[`visual/reports/patch-ios-diagnose-instrument.md`](visual/reports/patch-ios-diagnose-instrument.md).
On top of merged PR #41. Diagnostic tooling only: no `core/` change, no `ui/`
change, no version axis moves, `contentHash` unmoved, shipped bundle byte
identical.

**The PR #41 handoff told the reader to open `public/diagnose.html` on their
iPhone, and that file was never committed** — not on the PR #41 branch, not at
any commit on any branch. Everything else that handoff claims did land and is
gated; the one deliverable with no test behind it is the one that was not there.
The rule worth carrying: **an artefact that no test runs can be reported as
shipped and not be.**

**So the instrument arrives with a gate.** `public/diagnose.html` is standalone
— inline CSS and script, no import, nothing fetched at parse time — because the
device it is opened on may be one where the app's stylesheet or entry chunk is
what is broken. It loads the app's *real shipped* stylesheet at runtime, builds
the app's own stage markup under it, and reports seven sections: Reduce Motion,
the deployed build fingerprinted two ways, what this device's parser kept, every
motion token as it resolves here, all twelve beats as MOVES or STATIC by
pause-and-seek, a `calc()` duration through a custom property with two controls,
and the measured frame rate. `test/visual-diagnose.test.ts` runs it on both
engines under `npm run check` and holds that a known-good engine is reported as
healthy, that emulated Reduce Motion is named rather than reported as twelve
dead animations, and that the file makes no parse-time request of its own.

**And it answered the question. Reduce Motion was on.** The tester checked the
device and reported it, 2026-09-16, which closes the defect the whole iOS thread
was chasing: **there is no engine bug.** Section 27 called this "not proof that
the reporter had Reduce Motion on" and named it as the only configuration that
reproduces the reported symptom on the engine in question. It was right, and it
is now confirmed rather than inferred.

The instrument stays. It is what turned a standing suspicion into an answer, and
the next report of "no animations on a phone" is one page-open from being
settled instead of a patch away.

**Previously: the iOS animations patch — a second engine in the harness.** Branch
`claude/awesome-noether-h6p8fj`, prompt
[`spec/gymrun-patch-ios-animations-webkit-harness.md`](spec/gymrun-patch-ios-animations-webkit-harness.md),
record [`generation.md`](generation.md) section 27, report
[`visual/reports/patch-ios-animations.md`](visual/reports/patch-ios-animations.md).
On top of merged PR #40. Presentation and test infrastructure only: no `core/`
change, no version axis moves, `contentHash` unmoved at `c3964b`.

**The browser suite runs on two engines now.** `GYMRUN_ENGINE` selects
Chromium or WebKit, the WebKit leg uses Playwright's iPhone 14 Pro Max
descriptor — touch, the Mobile Safari user agent, 3x density, at this repo's
pinned 390x844 — and `npm run check` runs both, so a WebKit failure fails the
suite. `npm run test:webkit` is the second leg on its own. It needs
`npx playwright install webkit`; the box also needs
`npx playwright install-deps webkit`.

**Two of the patch's five items were not what the brief said they were**, and
both are worth knowing before reading the brief:

- **Bug A's stated mechanism was already false** — the parser took both `ms` and
  `s`, and WebKit returns `750ms` anyway. The round trip was still the bug, for
  the reason the brief's own last bullet gives: its failure path returned
  **zero**, and zero is not a short hold, it is the swallowed-last-turn defect
  restored silently. Deleted. `src/` now contains no `getComputedStyle` at all
  and `test/no-computed-timing.test.ts` holds that.
- **Bug B does not reproduce.** On real WebKit at the reported device's
  descriptor, all twelve animated classes on the stage start and move — the V5.5
  switch-out included — and all five candidate causes are ruled out by their own
  experiments. Following the brief's own instruction not to change CSS until a
  reproduction says which cause it is, **no CSS was changed for it**. What
  reproduces the reported symptom exactly, on *both* engines, is
  `prefers-reduced-motion`: zero animations and a hold of zero. That was item 5,
  and it shipped — the hold is `reducedMotionOutroMs` (120ms) now instead of
  being deleted.

**The instrument count is the thing to carry forward.** The first honest WebKit
run gave 11 failures, of which **seven were this repo's own test instruments**
rather than the app or the engine: a full-page screenshot indexed in CSS pixels
(invisible at 1x for the life of the suite, catastrophic at 3x), a motion helper
that got its timing wrong three separate ways, and a parallax case waiting a
fixed 150ms for a throttled frame. All fixed rather than quarantined. The
remaining four are narrowed or declined with a reason naming the engine and the
cause — one skip in total, the CDP-based frame timing.

**Previously: battle animations you can actually see.** Branch
`claude/busy-noether-jfszvi`, prompt
[`spec/gymrun-overnight-battle-animation.md`](spec/gymrun-overnight-battle-animation.md),
record [`generation.md`](generation.md) sections 22 to 25, report
[`visual/reports/patch-battle-animation.md`](visual/reports/patch-battle-animation.md),
handoffs in [`handoff/`](handoff/). **All four branches built, and Stage 4.9
merged into them rather than the other way round** — it landed on `main` while
this was in flight, and the two compose without a code change: `chooseEvolution`
runs after `reviewBattle`, so a gym clear now plays the outro, then the result
screen, then the evolution fork.

Branch 1 moved the three display numbers no `core/` file reads out of
`tuning.ts` into `data/displayTuning.ts` and onto the `contentHash` exclusion
list — closing open item 3 of
[`handoff/overnight-1-contenthash.md`](handoff/overnight-1-contenthash.md) and
the "open, small" item in section 9 — then took `battleFeedbackMs` from 500 to
**750** and `--lunge-distance` from 8px to 6px together, because the lunge
spends its whole distance in 10% of the budget and at 500 that was a
three-frame jump cut which duration alone would not have fixed. `ui/settings.ts`
gained `battleSpeed`, a third presentation axis. 3A gates the result screen
behind the last turn's beats and adds the recall/capture outro — the reported
defect. Branch 2 widened `FlagKind` from ten to seventeen, every kind measured
by `scripts/protocol-census.ts` first, which cut a whole class to zero and
refuted two predictions. 3B gives five classes one beat each, riding the causing
action's slot so a turn never gets longer.

**`contentHash` moved for the display split**, which the prompt said would not
happen — section 22 deviation 1 is the account, and the run payload regenerated
byte identical but for its own hash field, so generation did not move. Stage 4.9
then moved it properly. **Awaiting review and merge**, and the morning decision
that matters is to watch a fight: nothing here has been seen on a phone.

**In flight: Stage 4.9, levels, evolution, gated power, the wider roster and
harder gyms.** Branch `claude/charming-ride-q4ogfb`, prompt
[`spec/gymrun-stage4.9-levels-and-evolution.md`](spec/gymrun-stage4.9-levels-and-evolution.md),
record [`generation.md`](generation.md) section 21. The run starts at level 7
with a band-0 base form and levels to 55 across the eight gym clears; every
clear evolves the party along the dex's own thresholds, with synthetic
Kaizo-style levels for the methods the dex does not level, and a fork asked
as a new `evolve` decision on the gym's result screen. The species pool
admits the `Past` species (635 to 900) and carries the evolution graph;
species bands are a weighted distribution with a stage gate, teams draw
without repeats, a gym fields the player's slot count on the hard AI, and the
slot schedule is 2, 3, 3, 4, 4, 5, 5, 6. Three version axes move
(`RUN_LOG_VERSION` and `RANDOMIZER_VERSION` to `-16`, `contentHash`);
`AI_VERSION` holds. **The first pass sits at 0.46 mean gyms cleared against
the 4.92 baseline** — recorded in [`balance.md`](balance.md) section 0, not
chased; the gym level column and the roster rule are the levers left to the
user. The "+13 levels at gym 8" finding below is closed by construction.

**In flight: sprites on every selection surface, an idle bob, and one motion
per locale.** Branch `claude/vibrant-euler-2taoqk`, prompt
[`spec/gymrun-patch-idle-sprites-and-locale-motion.md`](spec/gymrun-patch-idle-sprites-and-locale-motion.md),
record [`generation.md`](generation.md) section 20. A figure with a two-frame
idle bob on the starter cards, the learn-move owner line, the member card
(party, drawer, pre-gym), the recipient buttons, the capture block, the
battle bench and the run summary; the event gate shows the members whose
type answers it at `latent`, through a new pure helper `capabilityHolders`
that `resolveCapability` now reads. Each locale's one moving element has its
own motion in place of the shared crossing: the cave unchanged, the shore
lapping, the forest's fireflies, the city's windows, the badlands' smoke, the
summit's bird, the ruins' light, the marsh's rings. The plan's twenty-second
floor is restated by kind and recorded as a deviation. Presentation only, no
version axis moves, the guarded heights held to the pixel, the Pocket gate
green. Animated GIF sprites were investigated and recorded in
[`engine-notes.md`](engine-notes.md) rather than built. Report
[`visual/reports/patch-idle-sprites-and-locale-motion.md`](visual/reports/patch-idle-sprites-and-locale-motion.md).

**In flight: the bar primitive and the battle beats.** Branch
`claude/kind-mccarthy-w3kml6`, prompt
[`spec/gymrun-patch-bar-primitive-and-battle-beats.md`](spec/gymrun-patch-bar-primitive-and-battle-beats.md),
record [`generation.md`](generation.md) section 17. Presentation only, no
version axis moves, both baselines held to the pixel. Release C's HP chunk
and shadow moved into one component, `ui/bar.ts`, that every bar in the game
now goes through; Release C's turn order nudge left the panel and became a
lunge on the sprite, with a recoil on the body whose bar drew a chunk and a
sink on a KO, four slots inside the one tuning number. The panel-nudge rule is
deleted and recorded as superseded. Report
[`visual/reports/patch-bar-and-beats.md`](visual/reports/patch-bar-and-beats.md).

**In flight: the map overlay, and the three overlays become windows.** Branch
`claude/hopeful-curie-5ah94f`, prompt
[`spec/gymrun-patch-map-drawer-window-overlays.md`](spec/gymrun-patch-map-drawer-window-overlays.md),
record [`generation.md`](generation.md) section 18. A `Map` button beside
`Party` in the same bar, opening the run map as a readout from every decision
surface — the second half of the standing rule the party drawer implements,
which was never built: the route was visible on exactly one screen, so a player
in a shop could not see whether a rest was two steps ahead. It renders nothing
of its own, calling the map screen's own `renderRail`, `renderHeading` and
`renderChain`, so it cannot reveal a fact that screen does not; and it calls
`renderChain` with no `onChoose`, so every node in it is structurally
unpressable and the map screen stays the single path by which a node is chosen.

The same patch extracted `ui/overlay.ts` and turned all three overlays — party
drawer, battle history, map — from bottom sheets into centred windows. The
history sheet gained Escape and a click-stop it had been missing; both gained
focus restore. **`test/band.test.ts`'s overlay allowlist went from five entries
to four while the app went from two overlays to three.**

Presentation only: no `core/` change, no version axis moves, seeded output
byte-identical, and the guarded screen heights equal `visual/baseline/heights.json`
to the pixel.

**In flight: the Carry on soft lock.** Branch
`claude/jolly-thompson-wume0n`, prompt
[`spec/gymrun-patch-carry-on-softlock.md`](spec/gymrun-patch-carry-on-softlock.md),
record [`generation.md`](generation.md) section 19. A playtest report on a
`53145f` build — this tree's own hash — found an event reveal whose **Carry on
did nothing**: the item plan the player left the party screen with was spent a
node after it was composed, the event's forced discard destroyed an item it
still named, `applyItemPlan` refused it, and a bare `catch {}` around `playRun`
swallowed the `RangeError`. `record` runs before the answer is applied, so the
refused plan was already in `localStorage` and a reload resumed straight back
into it. `reconcileItemPlan`, new in `core/items.ts`, brings a stale plan
forward onto the inventory that exists; `applyItemPlan` still refuses an
illegal one. No version axis moves.

**In flight: the playtest patch** (event rewards and move card fields). Branch
`claude/event-rewards-ui-bugs-z84mmb`, prompt
[`spec/gymrun-patch-event-rewards-and-move-card-fields.md`](spec/gymrun-patch-event-rewards-and-move-card-fields.md),
record [`generation.md`](generation.md) section 15. A playtest report on the
deployed build found **three effects an event drew and never paid**: a `T2` or
`T3` move was resolved to a name and dropped, a relic grant resolved to nothing
and applied nothing, and the HP a Toll charged was charged silently. The first
two were `applyEffect` returning the run untouched with a comment deferring the
work to a file that never did it — the third instance of the shape section 14
records twice — and together they are over half of what a Toll bought.
`RUN_LOG_VERSION` is 15, `RANDOMIZER_VERSION` is 15 and `contentHash` is
`53145f`. The same patch pinned the move card's fields to fixed columns, which
took **41px off the battle screen** in Detailed and Simple with `decisionTop`
unmoved in all three modes.

**In flight: patch 4.8.0.3, battle readout visuals.** Branch
`claude/focused-ride-vet50c`, prompt
[`spec/gymrun-patch-4.8.0.3-battle-readout-visuals.md`](spec/gymrun-patch-4.8.0.3-battle-readout-visuals.md).
Presentation only: stat stages print the multiplier the engine applies plus a
ladder, the move card face carries a fact strip of icons instead of a row of
word badges, and `BAND n` is four pips. Accuracy and evasion stages reach the
UI for the first time, on their own projection field. No `core/` state moves,
no version axis moves, `contentHash` is unchanged and every seeded output is
byte identical including SMOKE24. `battle.decisionTop` is unmoved in all three
density modes and the battle screen is 4px shorter; the numbers, two deviations
and a stale Pocket baseline the patch found are in
[`generation.md`](generation.md) section 12n.

**Merged:** everything through Stage 4.6c. Locales and capture (4.6a), base
power banding and berries (4.6b), and relics, capability events and band 3
encounters (4.6c). The benchmark for the current randomizer version is recorded
in `sim-reports/benchmarks/`.

**Head of `main`:** `f0c53f2`. The visual identity branch (V0 to V4) and Stage
4.7 both merged into it, as PR #13 and PR #12; PR #10 before them is the 0.5
verification release, PR #14 the V5 unblock audit, and PR #15 the 4.7 phone
regression patch. The three facts this section carried before 2026-09-10 were
all stale, and the audit
([`reports/v5-unblock-audit.md`](reports/v5-unblock-audit.md) divergence 1)
listed them; they are corrected here.

**Visual identity, V0 to V4: merged**, as PR #13 (`9296ba7`). An overnight run
under [`visual/OVERNIGHT.md`](visual/OVERNIGHT.md) built the first five stages
of [`spec/gymrun-visual-identity-plan.md`](spec/gymrun-visual-identity-plan.md):
tokens and the display face, locale palettes, world chrome, the scene layer,
and the run summary. Each stage's report in `visual/reports/` opens with its
morning decisions. V0.5's `--font-body` decision was taken at 4.7.2 and
**reversed at 4.8.0.2 on a measurement** — the pixel face has no pixel
module, so no size lands on a phone's grid, and the whole UI is the monospace
stack now (`generation.md` section 12j). V3.6's performance check is still
open and still wants a phone. V5 exited as a clean
skip because Release C was not merged.

**Merged since:** the 4.7 phone regression patch, as PR #15
([`spec/gymrun-patch-4.7-phone-regressions.md`](spec/gymrun-patch-4.7-phone-regressions.md)).
Presentation only, no `core/` change, no version bump. Its step 1 shipped — the
pre-gym screen had no control that submitted the current lead, so a party of one
could not leave it — and its steps 2 to 4 stopped on the prompt's own stop
condition, because the vertical budget they were to reclaim is missed by 100px
on trees that predate Stage 4.7 entirely.
[`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md)
has the three measurements; `generation.md` section 12b records the deviation.

**Merged since that, and ahead of Stage 4.8:** the pre-gym screen's *second*
softlock. 4.7's phone patch gave that screen a control that submits a lead; it
did not give the screen's detour a way back. The party screen's Done was
`showScreen('map')` for both of its entrances, and from the gym the map arms no
node row and never arms `nodePick`, so the way out of the party screen led to a
screen with no control that advances the run and a `leadPick` nothing could
resolve — a reload was the only recovery. `showParty` now takes and remembers its
return screen, the pre-gym screen is redrawn on the way back rather than revealed
as it was left (the lead is a slot index and a release shifts every slot behind
it), and the Done button's label names where it actually goes. Presentation only,
no `core/` change, no version bump. Found while surveying the tree for Stage 4.8,
and the regression cases are the two added to
[`../test/pre-gym-browser.test.ts`](../test/pre-gym-browser.test.ts) — in
Chromium, because the bug is in `src/ui/app.ts`'s wiring between two screens and
a test that mounts either screen alone cannot see it.

The same branch cleared the one failure the suite was carrying, in
[`../test/boundaries.test.ts`](../test/boundaries.test.ts)'s doc path check.
That failure was the check being wrong rather than a document: the file it
called unresolvable is really at `docs/visual/baseline/heights.json`, and the
index of bare filenames walked `docs/` for Markdown only while `looksLikePath`
accepted seven extensions. The suite is 935/935 from here.

**Merged since that:** Release C, PR #16 (`846975c`), **battle feedback
visuals**. Presentation only — the HP chunk and its
shadow, the turn order jiggle, post-resolution flag words off a new pure reader
in `core/battle/flags.ts`, and the berry flag off the `-enditem` reader 4.6b
already had. No `core/` state change, no version axis moved, seeded output byte
identical by both instruments. It is the last hard blocker in front of V5.
Report: [`reports/release-c-battle-feedback.md`](reports/release-c-battle-feedback.md).

**The two branches agree about the map's 25px overflow, from opposite
directions**, which is worth recording because they were written independently:
the phone patch stopped on it as a budget miss that "predates Stage 4.7
entirely", and Release C measured the same check reporting the same number on a
tree with 4.7 in and no visual pass on top. Neither release owns it. Release C's
smoke marker is the countdown; see `reports/release-c-battle-feedback.md` §0.

**Working branch:** `claude/band-badge-move-card-t02z1t`, **R12: the band badge
on every move card**
([`spec/gymrun-patch-r12-band-badge-move-card.md`](spec/gymrun-patch-r12-band-badge-move-card.md)).
Display only, one commit, no version axis moved, seeded output byte identical by
both instruments. `bandChip` had one caller — the reward screen, which resolved
the band itself and hung the badge off its own name line — so `BAND 3` was
readable on the offer and absent from the four moves the player was comparing it
against. It now renders on all eight surfaces that draw a move, through one
insertion point (`moveBandChip` in `ui/scene.ts`) and one resolution path
(`bandOfMove`, read once in the adapter). **The badge fits on the battle button
at 390 wide**: `.move__meta` was already wrapping, so the whole cost is 1px on
the move grid and the decision point does not move. Deltas and the measurement
are in [`visual/baseline/README.md`](visual/baseline/README.md); `generation.md`
section 12c records the one-pixel reading of the prompt's height rule.

**Still unblocked by Release C, and now by R12:** V5, whose test 5 assumes R12
is on `main`. Its prompt needs the four amendments in section 2 of the R12
document applied before it is pasted — the event strip Release C already built
is V5's strip and must not be built twice, the 36px it costs is already spent
against V5's budget, test 4 becomes a same-weight rule rather than a
chip-on-every-button rule, and the open V0.5 `--font-body` decision has to be
answered before V5 or after it, never inside it. Both R12 and V5 are named in
[`spec/gymrun-release-c-battle-feedback-amended.md`](spec/gymrun-release-c-battle-feedback-amended.md).

**V5 is running now**, on `claude/zen-mayer-9sp9bn`, and its state — preflight,
measurements, cuts and gates — is in
[`visual/reports/v5-battle-stage.md`](visual/reports/v5-battle-stage.md) rather
than in this section.

**Stage 4.8, all eight steps: merged**, as PR #21 (`e5243d7`), and patch
4.7.2 after it as PR #22 (`0712032`). The "In flight" section below was
written while 4.8 was open and is kept as the record of what it found;
`RANDOMIZER_VERSION` is 13 and the run log is at 13 after the release below.

**The `contentHash` release: built**, as Branch 1 of the overnight run
([`spec/gymrun-overnight-contenthash-ai-tutorial.md`](spec/gymrun-overnight-contenthash-ai-tutorial.md)),
on `claude/overnight-1-contenthash`, handoff
[`handoff/overnight-1-contenthash.md`](handoff/overnight-1-contenthash.md).
All four of the things it bundled: `contentHash` over `src/data/**` at build
time with one exclusion list, seed strings in the `GYMRUN-<hash>-<seed>` form
refused at paste time when foreign, `previewRun(seed, contentHash)`, and the
unkeyed stream API deleted. The run log carries a `versions` block over four
axes and one guard checks them all; `RUN_LOG_VERSION` is 13.
`randomizerVersion` was kept, not retired. Seeded output is byte identical.
`generation.md` section 9 is the record, including the three places the
prompt's picture of the tree was stale.

**The priority and speed aware AI: built**, as Branch 2 of the overnight run,
on `claude/overnight-2-ai-priority`, handoff
[`handoff/overnight-2-ai-priority.md`](handoff/overnight-2-ai-priority.md).
`MoveView` carries the dex priority bracket and `BattleView` carries both
sides' Speed from one pure helper (`core/battle/speed.ts`: stat, stages,
paralysis, ties `unknown`); one layer in front of the greedy pick takes a
priority move when the AI is slower and facing a knockout, or when a priority
move knocks out where a slower one also would. `AI_VERSION` is
`gymrun-ai-3-priority`; `RUN_LOG_VERSION`, `contentHash` and
`RANDOMIZER_VERSION` did not move. The benchmark moved by a recorded amount
with one cause and was not retuned: [`balance.md`](balance.md) section 15.

**The AI tiers patch: built**, on `claude/friendly-heisenberg-6m0986`, prompt
[`spec/gymrun-patch-ai-tiers.md`](spec/gymrun-patch-ai-tiers.md), report
[`reports/ai-tiers-report.md`](reports/ai-tiers-report.md), numbers
[`balance.md`](balance.md) section 16, deviations
[`generation.md`](generation.md) section 13. One flag-gated scorer with three
opponent tiers — `Rookie`, `Seasoned`, `Ace` — assigned by node kind, node tier
and segment in `data/ai.ts`, so **node tier now changes how a fight plays and
not only what it pays**. Noise at every tier, drawn from a sequence derived
from each battle's own sim seed; no keyed stream opened, no structural draw
moved. `seenKnowledge` gives medium and up what the battle has actually shown
them, forgotten on a switch out. `AI_VERSION` is `gymrun-ai-5-tiers`;
`RUN_LOG_VERSION` did not move; `contentHash` moved because `data/ai.ts`
landed.

Three findings out of it are worth more than the patch. **The AI was never the
max-damage picker the brief assumed** — full `@smogon/calc` estimate,
matchup-scored send-ins, voluntary switching, all since Stage 4 or earlier.
**One step of lookahead costs 0.21 mean gyms** on our game where the published
ladder puts it at +222 Elo, and the reading that fits is that it spends its
gain on switching, which section 7.6 measured as worth nothing. And **the
player arrives at every gym at 93% HP and, by gym 8, thirteen levels above
it** — a scaling shape, visible in one table, and deliberately not touched
here.

**The tutorial: built**, as Branch 3 of the overnight run, on
`claude/overnight-3-tutorial`, handoff
[`handoff/overnight-3-tutorial.md`](handoff/overnight-3-tutorial.md), which
carries the full copy table for the morning review. First-run coach marks,
not a scripted seed: 29 marks over eight screens in `data/tutorial.ts`,
anchored by `data-tutorial` attribute to the real element, one at a time,
advanced by tap, per-screen flags in the settings store beside the verbosity
toggle, "Skip tutorial" on the first mark and "Show tutorial again" in the
header. Presentation only: no `core/` change, no version axis moved, the sim
fixture and the visual baseline's runs byte identical. The visual baseline's
data digest now reads `contentHash`, so a copy file on the exclusion list moves
nothing; `generation.md` section 12h records that and the other four
deviations.

**Patch 4.8.0.2, readability: built**, on `claude/nice-einstein-up1ltb`,
prompt
[`spec/gymrun-patch-4.8.0.2-readability.md`](spec/gymrun-patch-4.8.0.2-readability.md),
report [`visual/reports/patch-4.8.0.2.md`](visual/reports/patch-4.8.0.2.md).
Five playtest complaints, presentation and copy only, no version axis moved,
`contentHash` unchanged. Two reverse 4.7.2: Detailed shows stat numbers alone
again (Simple shows the bars), and the pixel face is gone from every token
because it has no pixel grid to land on. Three close older gaps: the
move-replace heading that read `Give up` is a label again; the recipient
screen draws the gym's granted move as the same card the reward screen draws,
with its category and `Explain`; and a capability event now shows its
requirement and the run's standing, a band-correct hint, and a conclusion
naming what the standing bought — from `data/eventCopy.ts`, which `core/`
never reads. `generation.md` section 12j and the dated note in section 10.

**Blocked:**

- **The freeze** is no longer blocked on `contentHash` existing; it is blocked
  on someone deciding to stamp one. The current hash's display form is in the
  handoff file above.
- **Re-reading the gym currency pick rate** is blocked on R13, the simulator's
  move-reward scorer defect, in Release A. Any figure taken before that fix is
  confounded.
- **The type wheel change** is decided but unbuilt, and lands in Release B.

**No longer blocked.** Release A was a hard dependency of 4.6c under the HM
design, because HM teaching was going to be the move reward flow. Relics removed
teaching entirely, so that dependency dissolved and 4.6c shipped ahead of it.

### Stage 4.8, all eight steps (written while in flight; merged since, see above)

PR #21 (`e5243d7`), from `claude/intelligent-fermat-hzt2gb`, prompt
[`spec/gymrun-stage4.8-claude-code-prompt.md`](spec/gymrun-stage4.8-claude-code-prompt.md),
step 1's report [`reports/stage-4.8-report.md`](reports/stage-4.8-report.md).
4.7.2 merged after it as PR #22 (`0712032`). Detail for every item is in
[`generation.md`](generation.md) sections 7b, 7c and 7d.

**Merged on top of both: 4.8.0.1, species stays the label**
([`spec/gymrun-patch-4.8.0.1-species-stays-the-label.md`](spec/gymrun-patch-4.8.0.1-species-stays-the-label.md)).
Presentation only, no `core/` state change, no version axis moved, seeded output
byte identical. 4.8's nicknames rendered in place of the species on every surface
that names a Pokemon; the ruling on the patch's report went further than the
prompt and de-prioritised them everywhere: species on every label, the graveyard
and share text included, and the battle text relabelled to match. The nickname
is still drawn, still on the spec and still the sim's battle name — the option is
kept, unread. `generation.md` section 12i has the ruling, the surface list, what
its gates found on `main` and PR #24 fixed first, and the two `core/` follow-ups
it leaves.

**Both version axes moved, which the prompt did not expect.**
`RANDOMIZER_VERSION` is `gymrun-randomizer-13` and `RUN_LOG_VERSION` is
`gymrun-run-12`. The prompt states that the run log does not bump and gives four
correct reasons — capacity, nicknames, death records and the score are all derived,
and all four still are. It does not cover item 2 Part A, which hands over a
guaranteed move at every gym through the existing move-learning flow: a `target`
and sometimes a `replace` after every gym win, which is a changed question
sequence. Recorded as a deviation in `generation.md` section 7c rather than by
editing the prompt.

**Three findings worth carrying forward, none of them predicted:**

- **The engine's six-a-side limit fixes the top of the difficulty curve.** A curve
  assuming a full six left `opponentTeamSize`'s clamp no headroom and flattened
  normal, hard and elite onto one team size at the final segment — Stage 3's risk
  gradient gone at the end of a run. `test/tiers.test.ts` was the only thing that
  caught it. The slot schedule still reaches six; the curve's assumption stops one
  short, written as `EXPECTED_PARTY_SIZE[last] < MAX_TEAM_SIZE`.
- **The vitals cache collided on nickname.** `describeSpecCard` keyed on species,
  ability, moves, level and item. Free while no spec had a name; with item 5 naming
  every Pokemon, two identical Pidgeys would have rendered under one name on every
  surface at once, from a single cache hit.
- **The map's fold miss was closed by bounding, not shaving.** The `xfail` had sat
  since Release C. Taken steps collapse to one line, the map's party cards lost
  their move lists and went to three columns, and a step's options stopped wrapping.
  Offered cards end at 737 of 844; `heights.json`'s `map.decisionBottom` went 728.22
  to 669.72 and the battle did not move.

**What the prompt asked for that was already built:** item 7. `partyThreats` shipped
before this stage, more richly than the prompt specifies, and was on the map as well
as the party screen. Step 6 therefore had no core work; the map placement was removed
in step 7, with the three smoke checks that existed to protect it.

**Working branch:** `claude/gymrum-mobile-buttons-mr12we`, **the mobile seed bar
patch** ([`spec/gymrun-patch-mobile-seed-bar.md`](spec/gymrun-patch-mobile-seed-bar.md)).
Presentation only, no `core/` change, no version axis moved, `heights.json`
unchanged to the pixel. 4.5.2's phone pass hid the seed bar for the whole
running phase, and the phase is `running` from page load, so on a phone Start
run, New seed and Resume saved run were unreachable from the starter screen to
the summary. The bar now collapses under a Seed toggle on the header's Detail
row and returns on a tap. `generation.md` section 12k records the superseded
rule; report and screenshots in
[`visual/reports/patch-mobile-seed-bar.md`](visual/reports/patch-mobile-seed-bar.md).

## 5. Open items

One line each. The analysis lives where the pointer goes, not here.

0. **Fight length.** Early fights are an exchange rather than a shape. It is now
   the root cause behind two separate carried misses, below, and has earned its
   own investigation. `balance.md`, and open question 1 in the root README.
   Stage 4.9 moved it the other way at the start — 3.7 turns in segment 1 at
   level 7 — and the stage's benchmark row is where the next reading is.
0. **Stage 4.9's first pass is a wall at gym 1** (42.5% clear, 70% of deaths)
   and the run is not completed by the greedy bot on any of 400 seeds. The
   levers deliberately left to the user: the gym level column in
   `data/scaling.ts` and the "gym fields the slot count" rule. Two
   pre-existing phone-layout limits surfaced by the wider roster are carried
   here too: a Fighting- or Electric-type chip wraps the move button's meta
   row at 390px, and a two-row party plus a two-card step pushes the map's
   offered cards below the fold (the pre-change build did it on other seeds).
   `generation.md` section 21.
2. **Berry clog past gym 6.** Above target. Traced to short fights rather than
   to the berry table or backpack capacity, so item 1 is the fix.
   `balance.md` section 11.
3. **Gym currency pick rate.** `balance.md` section 11.6 records it as closed
   against a banded field. The QoL plan reopens it: any figure taken before R13
   is confounded by the scorer defect, so it needs re-reading after Release A.
   Treat it as open with a closed-looking number.
4. **Priority-blind and speed-blind AI. Closed**, Branch 2 of the overnight
   run, `AI_VERSION` `gymrun-ai-3-priority`. What stays open is the morning
   decision its handoff carries — keep, retune or revert, against the delta in
   [`balance.md`](balance.md) section 15 — and the out-of-scope passes the
   patch names: switch logic, status valuation, secondary effects, Trick Room,
   speed modifiers beyond stat, stage and paralysis.
   [`spec/gymrun-stage4.6-claude-code-prompts.md`](spec/gymrun-stage4.6-claude-code-prompts.md).
5. **The type wheel. Decided, not yet built.** Keep it, and drop the trigger
   from the two Pokemon panel type badges. It is UI work and belongs to
   Release B. Recorded in [`spec/README.md`](spec/README.md).
6. **Party threat readout. Shipped.** Carried as open in the QoL plan, which
   predates the merge. It is live on the party screen and the map, and covered
   by `test/threat-readout.test.ts`. The plan is a historical record and is not
   edited to match; this row is the deviation note.
7. **The 390x844 vertical budget. Met at V5.4, and the marker came off.** The
   visual plan asks both decision points to end at or above y=740. This was
   carried as a 206.5px miss that was *not* Stage 4.7's to give back — the same
   measurer puts the fourth move button at 840 on the commit before PR #10 — and
   the row said reaching 740 was a decision about the battle heading, the two
   Pokemon panels and the move grid. V5 is that decision and it spent all three:
   the fourth move button ends at **704** and the map's last offered card at
   **728.22**, so `test/visual-v0.test.ts`'s `it.fails` reported its expected
   failure as an error and is a real assertion from here. Numbers per step:
   [`visual/reports/v5-battle-stage.md`](visual/reports/v5-battle-stage.md).
   History: [`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md).
   **The SMOKE24 map `xfail` is a different check and stays**: it measures the
   offered cards against the 844 fold in the scrolled view, not against the 740
   usable line, and still reports y=869.
8. **Strict trim was red and is not any more. Closed 2026-09-15**, by
   measurement rather than by a patch. The item recorded 22 failures across the
   five browser test files on `9296ba7`, every one at `openApp` waiting for the
   starter screen, on the reading that something in the bundle read the trimmed
   `learnsets`/`legality` tables at start-up and the strict proxy threw.

   Re-measured at `5d0bd18` in a clean worktree, with no `src/` change of any
   kind: **`GYMRUN_TRIM_STRICT=1 vitest run` is 118 files and 1554 tests, all
   passing.** Something between `9296ba7` and here fixed it and the item was
   never revisited, so the entry outlived the failure by an unknown number of
   patches.

   **Kept as a closed entry rather than deleted**, because the useful part is
   not the bug: an open item that names a hard gate as red is read by every
   session that opens this file, and a stale one is believed. This one was
   believed on the night the map overlay was built, and the plan for that patch
   was written around working past a red gate that was green.
   History: [`visual/reports/phone-regressions-4.7.md`](visual/reports/phone-regressions-4.7.md),
   measurement: [`visual/reports/map-overlay.md`](visual/reports/map-overlay.md).

9. **R8 needs its own move-card insertion point. Closed** by the density
   modes patch: the battle button carries a `?` chip on its PP line
   (`scene.ts`, `renderMove`), its own insertion point, opening the same
   rows the card's expander opens. The history: Release B's "one insertion
   point" rule is `scene.moveCard`, and the battle move buttons do not go
   through it — `renderMove` calls `scene.moveFacts` directly, because
   `test/boundaries.test.ts` holds `scene.ts` to the battle projection. So a
   tap-to-explain wired into `moveCard` reaches six surfaces and *not* the
   battle bar. R8 is a separate insertion point, not a wider version of this
   one. Recorded by patch 4.7.2, branch `claude/cool-dijkstra-apme8u`.
   [`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md).
10. **The move-replace screen explains the incoming move and not the four it is
   compared against.** Same cause as item 9: the incoming card is a `moveCard`
   and the four current moves are `moveFacts` submit buttons. The asymmetry
   lands on the one screen whose entire purpose is that comparison, and is
   worse than neither side explaining. Release A's to fix, with R8. Recorded by
   patch 4.7.2, branch `claude/cool-dijkstra-apme8u`.
   [`spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](spec/gymrun-patch-4.7.2-font-stats-verbosity.md).
11. **The capability event payout tables are the 4.6c placeholders.** `latent`
   is the v1 outcome table verbatim, `none` and `known` are one shared table
   each, and the top band's declined capture pays nothing — the 4.6c prompt's
   held item never shipped. 4.8.0.2 fixed what the screen *says*; what it
   *pays* moves `RANDOMIZER_VERSION` and is its own patch. `generation.md`
   section 10, the dated note.
12. **The gym's granted move cannot be declined.** 4.8 Part A hands it over
   unconditionally, so a party of four-move members must displace one. A
   decline is a `core/` change and a `RUN_LOG_VERSION` bump. Surfaced by
   4.8.0.2, which relabelled the heading that was being tapped as one.
13. **The shop shelf shows `Tutor: X` with no card. Closed 2026-09-17** by the
   shop and moveset-variance patch, which had to touch every move row on that
   shelf anyway and would otherwise have shipped a third move kind with the
   same defect. The rows go through `scene.moveCard` over `moveCardData` now —
   the reward screen's own insertion point, so the two cannot drift — with no
   holder passed, because a shelf move is unassigned until the purchase asks
   who learns it.

   **It costs height, and the Pocket gate is what said so.** At 390x844 a
   segment-0 shelf shows two and a half rows above the fold in Detailed where it
   used to show four: five guaranteed categories instead of three or four drawn
   ones, two of them carrying a card. Detailed and Simple scroll and always
   could. **Pocket may not** — `test/visual-pocket.test.ts` holds every decision
   surface to a document `scrollHeight` at or under 844, "a hard gate, no
   exemptions" — and the shop came out at 864. So Pocket hides the shelf's move
   cards, in CSS rather than by a branch in the screen, because a screen that
   reasoned about density in JS would not re-render when the mode is switched
   live and `test/density.test.ts` greps for that mistake. The name, the
   category and the price are on the row in every mode.

   If a later pass wants the card back in Pocket, the lever is a disclosure
   rather than a shorter shelf: the shelf's shape is the feature.
   `generation.md` section 31.
14. **The density modes patch is built, on `claude/bold-clarke-xcwko1`, and
   awaits review and merge.** All seven steps, every gate green, the
   guarded Detailed heights unchanged to the pixel. On merge the register
   row flips to `built`. What it leaves: the member card's HP line is on
   the bar's tap in Pocket (a rule the prompt did not write; `generation.md`
   12m item 4), and `data/densityTuning.ts` sits outside `contentHash` by
   a reasoned exclusion rather than inside `tuning.ts` (item 1).
   [`visual/reports/patch-density-modes.md`](visual/reports/patch-density-modes.md).

15. **A decision-schema or fold-shape change is not walked through its
   readers, and nothing catches it.** **The standing risk, logged 2026-09-14
   after it fired twice inside one patch.** Both halves of each defect were
   individually correct and both typechecked; what was wrong sat in the gap
   between them, and the gap is invisible to `tsc` by construction.

   - `ui/storage.ts`'s `isRunDecision` validates a `RunDecision` structurally,
     from `unknown`. When the event decision became an archetype it kept
     checking for a numeric `index`, so every saved run that had passed an
     event failed to load — silently, with `loadRunLog` returning null.
   - `core/run.ts`'s `resolveNode` read `party` and `currency` off
     `applyEventOutcome` and dropped `backpack`. That one had been live since
     **Stage 4.5.1** (`0b450d2`), the patch that moved an event's item from the
     lead into the bag: the fold was correct and its unit tests passed for four
     stages while every item an event paid went into a value nobody read.

   **Why it keeps happening:** a structural validator reads `unknown`, and a
   partial destructure of a returned state is valid TypeScript. Neither end is
   wrong on its own, so unit tests of the fold pass and the type system is
   satisfied. Only a test at the *seam* sees it — `test/storage.test.ts`'s
   "whatever kinds it holds", which plays a real run, and
   `test/event-inventory.test.ts`, which asserts at `resolveNode` rather than
   at `applyEventOutcome`.

   **What to do about it, until something better exists:** when a fold's return
   shape or a logged decision's shape changes, grep every reader and destructure
   whole rather than field by field (`({ party, currency, backpack } = after)`),
   and add the assertion at the seam rather than at the function. The two
   suites named above are the pattern. This is logged as a risk rather than
   written into `CLAUDE.md`, because `CLAUDE.md` holds rules that have held —
   this one has been broken twice and is a thing to watch.

16. **The stat block's bar is the one bar not built by `ui/bar.ts`.**
   `.stat__bar-fill` in `member-card.ts` is a magnitude over a 200 ceiling,
   not a fraction, and carries a pre-Release-C `120ms` width transition that
   `test/visual-tokens.test.ts` counts among its 17. Moving it onto the bar's
   `neutral` variant — which shipped with the bar and beats patch and has no
   consumer yet — retires that duration and takes the pin to 16. One small
   patch; `generation.md` section 17.

### Closed: the missing sprite's alt text

**2026-09-17, fixed.** A broken `<img>` with alt text is not a replaced element,
so CSS `width` did not apply and the box grew to fit the species name — 84px for
`Hippopotas` inside a 48px figure, which pushed a 390px page to 401px.
`visibility: hidden` had been hiding it while keeping it in the flow, and
`display: inline-block` now gives it back the size the stylesheet already
specifies — `display: none` was tried first and stopped every stage animation,
which `reviewBattle` waits on. Predates the chip audit by three patches and
was exposed by it; `generation.md` section 32 is the account, and
`test/visual-sprites.test.ts` holds the figure's box.

### Carried out of the sprite patch

**`visual-v0`'s "one accent" walk reads the screen and the count in two round
trips.** Filed, not built.

It failed twice across four full-suite runs on 2026-09-17, with two different
messages — once `summary has a primary action: expected 0 to be 1`, once
`battle has no primary action: expected 1 to be 0` — and passed standalone every
time, on this branch and on `main`.

Both messages have one explanation. The walk calls `openScreen(page)` for the
screen's name, then `count()` for the number of visible `.primary-action`
elements, and those are two separate round trips to the page. If the app
transitions between them — battle to result, say — the count belongs to a
different screen than the name, and `seen.set(screen, Math.max(...))` makes that
sample permanent. Under full-suite load the gap between the two calls widens and
the straddle gets likelier.

**The fix is to read both in one `page.evaluate`**, so the pair is taken from a
single layout. That is a change to a gate, on a branch whose diff is one CSS
declaration, so it is filed rather than smuggled in. The first of the two
failures had a real cause underneath it — the bench-row dead tap — which is why
this was not filed sooner: the race and a genuine defect produced the same red.

### Carried out of the chip audit

**The horizontal-overflow guard covers three screens out of twelve, and nothing
asserts that list is complete.** Filed, not built.

The chip audit broke `.replace__owner` — the ability chip ran off the right edge
at 390 and pushed the sprite out of the viewport — and it was found by
screenshotting the surface, not by a gate. That is worth a line here because the
guard that should have caught it **exists and works**:

- `scripts/smoke.mjs` asserts `documentElement.scrollWidth <= innerWidth` on
  exactly three surfaces: the locale screen (line 909), the map (line 928) and a
  battle (line 1110).
- `test/visual-battle-outro.test.ts` asserts it for the outro and the
  abnormality beats; `test/visual-phone-seed-bar.test.ts` for the seed bar.
- Nothing asserts it on `replace`, `target`, `party`, `acquisition`, `result`,
  `summary`, `shop`, `event`, `pre-gym` or `starter`.

**It would have caught this one.** No ancestor of a screen clips horizontally —
`body`, `.shell` and `.screen` set no `overflow`, checked — so an overflowing row
does push `documentElement.scrollWidth` past 390. The check was simply not
pointed at the screen that broke.

The shape of the fix is already in this repo. `test/visual-chips.test.ts`
asserts that the set of chip variants its sweep *saw* equals the set
`ui/chip.ts` can build, so a variant the walk stops reaching fails the test
rather than passing quietly. The overflow guard has no such claim: its three
surfaces are a hand-picked list, and a screen added tomorrow joins nothing.

Two things make this more than a one-off:

- **Five hosts carry an absolutely positioned `.figure` at their right edge**
  (`.starter`, `.party__member`, `.replace__owner`, `.event__gate`,
  `.bench__member`), and a row that overflows under one of those is overlapping
  a sprite rather than merely being wide. Four now reserve a gutter off
  `--figure-size`; **`.bench__member` reserves none**, and in Detailed and
  Simple it is `flex-direction: column`, so each child is full width with the
  32px figure floating over whatever sits at the vertical centre. It is the
  most exposed of the five and the least watched.
- The gutters on `.party__member`, `.starter` and `.event__gate` are scoped
  `:root:not([data-density="pocket"])`, deliberately and with a reason in the
  stylesheet. So Pocket is the mode with the fewest gutters and the narrowest
  columns, and no overflow assertion runs in it at all — the smoke walk's three
  surfaces are walked in one density.

**Not built here on purpose.** A sweep over every screen in every density is a
gate change, it will find pre-existing overflows that are nobody's fault in this
patch, and triaging those is its own piece of work rather than a line item on a
patch whose brief said "this is a small qol patch". `generation.md` section 30d
records the defect this came out of.

### Carried out of patch 4.8.0.3

Three, filed rather than built. The closeout prompt
([`spec/gymrun-patch-4.8.0.3-closeout.md`](spec/gymrun-patch-4.8.0.3-closeout.md))
asks for the first; the other two are things verifying it turned up.

**A. An always-hits marker on the move fact strip.** A never-miss move renders
no accuracy icon. `describeMove` reports it as `accuracy: true` rather than as
`100`, and the two mean different things — a 100% move is still checked and an
evasion stage can make it miss, a never-miss move is not checked at all — so
one icon reading `100` for both would collapse the distinction. That call
stands.

Its consequence is that absence on that icon now means two things: the field
does not apply, and the field applies without limit. **That collides with item
1 of the same patch.** A player can now see an evasion boost as a multiplier,
and a never-miss move is exactly the case where that boost does nothing — so
the one reading the strip most needs to support is the one it is silent about.
A distinct always-hits marker reads better than nothing. The `neverMisses` tag
says it in words one tap away in the meantime. Not a blocker for merge.

**B. The corner seed stamp eats taps on scrolling content. Closed 2026-09-14**
by [`spec/gymrun-patch-4.8.0.3-seed-stamp-tap-hazard.md`](spec/gymrun-patch-4.8.0.3-seed-stamp-tap-hazard.md),
option (a), under a named exception to the closeout's scope rule. The stamps
sit behind the screens (`z-index: -1`) and the screens' own boxes take no
pointer events, so content wins the tap where the two overlap and the stamp
takes it everywhere else — structurally, not positionally. The one cost is
recorded on `test/visual-v2.test.ts`: the stamp is no longer universally
clickable, so its copy test taps it on the locale screen, where the corner is
measurably free, rather than on the starter screen, where a `.starter` card
covers it and now correctly wins. The description it closes follows.

**B (as filed).** `.stamp--seed` is
`position: fixed`, `z-index: 20`, `pointer-events: auto`, and at 390x844 it
occupies a 121x9 band at (6, 829) — permanently over the party screen's scroll
region, which is 1630px against an 844px viewport. Any interactive control
whose centre passes under it is unreachable.

`test/visual-v3.test.ts` asserts that every visible control is what a tap at
its centre lands on, and it passes on `main` **by positional luck rather than
by construction**: no control happened to sit there. 4.8.0.3 added controls to
the party screen's move cards and one does. Measured, not inferred — see the
patch report; and re-rolling the layout only changes *which* control is caught,
which was verified rather than assumed.

Every real fix is outside what that patch touched, which is why it is filed
here: (a) let content win the tap where the two overlap — the stamp below the
shell, the shell's own box made transparent to pointers with its interactive
descendants opted back in; (b) end the scroll region above the stamp band in
the app shell; (c) drop the stamp's copy affordance on phone, where the seed
bar already carries one. (a) is the smallest that removes the hazard class
rather than moving its victim. Whichever is taken must keep
`test/visual-v2.test.ts`'s "copy the full seed string from the seed stamp",
which taps the stamp on the starter screen at 390x844.

**C. `◎100` on nearly every move card.** The strip prints accuracy whenever
`describeMove` returns a number, which is the patch prompt's instruction —
"accuracy stays as a number and stays on the face". The face's previous rule
was narrower: the `accuracy` tag rendered only when the move could actually
miss. So a number that is identical on four buttons out of four is now on all
four, which is the shape the tag rule was written to avoid.

The narrower rule was tried during closeout and reverted, because the only
strong argument for deviating from the prompt was that it fixed item B, and
measurement showed it did not — it moved the caught control from the accuracy
chip to the contact chip. Changing spelled-out behaviour on an aesthetic
preference alone is not this patch's call, so the observation is filed instead.
It is the same decision as A and should be taken with it: what the face says
about accuracy at 100, at below 100, and at never-miss is one question.

### The invariant register

Five audit findings, where the tree did not satisfy an invariant in
`CLAUDE.md` when that file was written (`8c3bff8`), **plus anything found
since**. Each closes in its own patch, and the row says which.

The count in that first sentence is the audit's, not the table's. The verdict
strings row below is the first addition: found 2026-09-14 by a grep that
widened past the one word `8c3bff8` named, so it is the same class of finding
without being one of the five.

| finding | status |
|---|---|
| `contentHash` does not exist | **closed**, Branch 1 of the overnight run. `build-config/content-hash.ts`, `generation.md` section 9 |
| the sequential stream API is still exported and drawable | **closed**, Branch 1. A named stream is `at(key)`, `keys` and `totalDraws`; `test/determinism.test.ts` and `test/stream-keys.test.ts` group 5 guard the deletion |
| `AI_VERSION` is stamped onto reports but never guarded at replay | **closed**, Branch 1. `aiVersion` is an axis of the log's `versions` block and `versionMismatch` checks it |
| `Math.random` survives in `scripts/measure-bundle.mjs` | **open**. Not this branch's job; the lint rule now covers every extension and the boundary test walks `src/` only |
| four verdict strings remain in player-facing copy | **open, found 2026-09-14** by the closeout's check-1 grep, which widened the search past the one word the audit named. Four live strings, each rendered: `src/data/categoryInfo.ts` line 48 — "Worth it when you can survive the reply", on the move category tooltip; `src/data/statusInfo.ts` line 125 — "usually better than rolling the dice three times", on the paralysis tooltip; `src/data/statusInfo.ts` line 242 — "so it is strongest into a wall", on the crit tooltip; `src/data/bandInfo.ts` line 68 — "A risky node reaches here before the segments do", on the band tooltip. Each tells the player what an option is worth rather than what it is, which is the Part 4 rule. **Filed, not fixed**: 4.8.0.3 is a presentation patch that had already closed the one violation the register tracked, and rewriting four more strings on my own reading is a copy pass, not a closeout. All four files are outside `contentHash`, so the fix is cheap when it is scoped |
| one "best" marker remains in player-facing copy | **closed, 2026-09-14, patch 4.8.0.3 item 3.** The audit's line, `run-map.ts:87`, lost its marker at `6351009` when the tier copy moved into `data/tierInfo.ts`. The last one, `data/statusInfo.ts`'s Disable advice ("Usually your best move, by design"), is now the attribute it was describing: Disable always takes the move just used. The patch's prompt named `run-map.ts:87` from the stale audit line; the marker had already moved, and the fix went where the marker actually was. No "best" marker remains in player-facing copy |

## 6. The design lineage, briefly

The repo contains superseded designs. They are kept, not deleted, because a
prompt is a record of what was asked. **Only `spec/README.md` can tell you which
version is live**, so check it before building on anything in `spec/`.

**The capability system, designed three times.** This is the one that will
catch a reader out, because two dead designs are still sitting in the specs.

1. **HMs as items.** A separate permanent item class, free of backpack capacity,
   taught into a move slot. Retired: it needed a teaching flow, a legality table
   and a build-config artifact. Part C of
   [`spec/gymrun-stage4.6-claude-code-prompts.md`](spec/gymrun-stage4.6-claude-code-prompts.md).
2. **HMs as ordinary attacks.** Capability moves join the general move pools and
   band normally. Retired: it made capability value track move quality, so a
   move a player wants anyway resolves at the top band constantly and a move
   nobody keeps resolves at the bottom. Section 7 of
   [`spec/gymrun-qol-release-plan-rev2.md`](spec/gymrun-qol-release-plan-rev2.md).
3. **Capabilities as relics. Live.** A capability is granted by a permanent,
   run-scoped, passive relic. No move slot, no backpack capacity, no teaching,
   no legality query. Knowing a capability-named move grants nothing: the move
   and the capability are unrelated systems that share a name.
   [`generation.md`](generation.md) section 10 describes what shipped.

**Three smaller supersessions,** all recorded in `spec/README.md`:

- **Species rewards are gone.** Removed from the pools in 4.6b. Capture, from
  4.6a, is the acquisition path.
- **Decline exists in the move learning flow.** Release A retires the "there is
  no decline" rule from Stage 4.5.1.
- **The seeds document was reconstructed, then replaced.** 4.6a was built from a
  prompt's description of a design document that was not in the repo. The real
  one now sits at
  [`spec/gymrun-seeds-and-mappability.md`](spec/gymrun-seeds-and-mappability.md)
  and the reconstruction was re-homed to [`keyed-streams.md`](keyed-streams.md)
  as the record of what was actually built. Where they disagree, the spec is the
  design and `keyed-streams.md` is the truth about the code. This is the whole
  case for the archival rule in one incident.
