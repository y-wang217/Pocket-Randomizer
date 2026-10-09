# GYMRUN Card Engine: Architecture and Test Battle Build Prompt

v0.1, 2026-10-08. Paste into the coding agent working in the `Pocket-Randomizer` repo. Commit this file verbatim to `docs/spec/` with a register row before doing anything else.

Canonical design doc (live): https://claude.ai/code/artifact/012e2bda-b0ee-40aa-9120-4e41e0ffb38a
The coding agent cannot read that link. Appendix A is a snapshot of every rule this build needs. Where the two disagree, stop and report.

Companion: `gymrun-card-battle-asset-pack-prompt.md`. The asset IDs in section 8 are a contract shared with that file.

---

## PROMPT

You are building the first slice of GYMRUN's own card battle engine: one fight, playable in the browser, reached through a hidden entry on the starter select screen. Read `docs/architecture.md`, `docs/generation.md`, the keyed RNG module, the screen router and the starter select screen before writing anything.

This is a sandbox. The shipped game does not change. The purpose of the slice is a fun test with playtesters, so the fight must feel instant and must never break.

### Rules that hold across every checkpoint

- `core/` never imports from `ui/`. No `Math.random`, no `Date`, no timers in `core/`.
- The card engine imports nothing from `@pkmn/*` and nothing from the Showdown battle code.
- **No version axis moves.** `contentHash`, `RANDOMIZER_VERSION`, `RUN_LOG_VERSION`, `AI_VERSION` all stay put. Seeded output byte identical, SMOKE24 included.
- Every rule number lives in data, never inline in a resolver.
- The engine never throws on any input. An illegal action returns a typed rejection and the same state object.
- No animation blocks input. Reduced motion resolves everything instantly.
- Stop for review at the end of every checkpoint.

### Report before you write any code

1. **contentHash inputs.** The hash is a glob over `src/data/**` with an exclusion list. Card data at `src/data/cards/` would move it. Report the smallest change that keeps the hash byte identical: adding `src/data/cards/**` to the exclusion list, or placing card data elsewhere. Do that, and prove the hash did not move.
2. **Keyed RNG.** Confirm `rng.at(key)` can be used from `src/core/cards/` with no new dependency, and report the exact import.
3. **Starter select key handling.** List every existing `keydown` handler that can fire on the starter select screen, including the tutorial coach layer and the seed stamp. Report whether Enter or an arrow key currently does anything there.
4. **Router.** Report how a screen that is not part of a run gets registered, and whether a lazy `import()` route keeps the main bundle and the bundle-size gate unchanged.
5. **Asset manifest.** Report the current shape of `src/ui/assets/manifest.ts` and how a missing asset falls back.

Stop and report all five.

### Order of work

1. Types, data tables, zones, legality with projection. Unit tests. No resolution yet.
2. `step`: deck and hand, keyword resolvers, unit abilities, events. Unit tests.
3. Enemy scripts, movement, telegraph, the encounter. Unit tests.
4. Random bot, invariant fuzz, performance gate, battle log and replay, playtest readout.
5. UI: sandbox route, hidden entry, phone layout, placeholder assets through the manifest.

UI comes last. Do not build it before checkpoint 4's fuzz run is green.

---

## 1. Shape of the engine

One pure reducer. Synchronous. JSON state in, JSON state out.

```ts
step(state: BattleState, action: Action, rng: KeyedRng): StepResult
legalActions(state: BattleState): Action[]
viewOf(state: BattleState): BattleView          // everything the UI draws
createBattle(encounterId, deckId, seed, rng): StepResult
```

```ts
type StepResult =
  | { ok: true;  state: BattleState; events: BattleEvent[] }
  | { ok: false; state: BattleState; reason: IllegalReason };   // same state reference

type Action =
  | { type: 'select';   card: CardIid; unit: UnitId; choice?: Choice }
  | { type: 'unselect'; planIndex: number }
  | { type: 'commit' };

type Choice = { unit?: UnitId; tile?: Pos };
type Pos = { lane: 1 | 2 | 3; col: 1 | 2 | 3 | 4 | 5 | 6 };
```

- **The plan lives in engine state.** `select` and `unselect` edit `state.plan`. They draw no RNG. The UI holds no rules and no shadow copy of the board.
- **`commit` resolves the whole round in one call:** player moves, player cards, enemy actions, enemy moves, the next telegraph, and the next hand. It returns the full event list. There are no intermediate engine states for the UI to wait on.
- **Why this is instant.** The state is three units, three enemies and fifteen cards. A step is a few hundred object operations. The UI applies the new state at once and plays the events back as skippable beats, the same seam the current animation scheduler uses.
- **State is plain JSON.** No classes, no `Map`, no `Set`, no functions. It can be saved, diffed, logged and pasted into a bug report.

### Files

```
src/core/cards/
  state.ts      types: BattleState, UnitState, EnemyState, CardInstance, PlannedPlay
  create.ts     createBattle: build piles, roll start steps, first enemy move and telegraph, first hand
  step.ts       the reducer; the only function that changes battle state
  plan.ts       select and unselect, MP reservation, project(state): board after planned moves
  resolve.ts    commit: the fixed phase order in section 3
  keywords.ts   one resolver per implemented keyword
  zones.ts      zone of a tile, reach per side, blocking, patterns for Slash and Blast
  enemies.ts    script interpreter: move rules, act rules, telegraph
  legal.ts      legalActions and choicesFor, both built on project()
  view.ts       viewOf: the UI contract
  events.ts     the BattleEvent union
  log.ts        BattleLog, replay, summarize
  bots.ts       randomBot
  invariants.ts checkInvariants(state): string[]
src/data/cards/   (or the location chosen in report item 1)
  rules.ts      every R and E default from Appendix A as one typed object
  cards.ts      the Puppeteer deck
  units.ts      A, B, C
  classes.ts    slots per class
  enemies.ts    Drone, Lancer
  encounters.ts the first encounter
  types.ts      Fire, Plasma, Water (carried, unused by the slice)
```

---

## 2. Data is declarative

Cards, unit abilities and enemy scripts are typed unions, never callbacks. They serialize, they replay, and a bot can score them without running arbitrary code.

```ts
type Effect =
  | { k: 'strike' | 'pierce' | 'slash' | 'blast'; n: number }
  | { k: 'move'; n: number }
  | { k: 'shield'; n: number; to: 'self' | 'friendly' }
  | { k: 'target'; n: number }
  | { k: 'gainMp'; n: number }
  | { k: 'mpNextTurns'; n: number; turns: number }
  | { k: 'grantMove'; n: number }                    // Command
  | { k: 'drawNext'; n: number; filter: 'notOwner' } // Need Help
  | { k: 'stealth' | 'repair' | 'push' | 'pull'; n: number }; // reserved, no resolver yet

type CardDef = { id: string; name: string; owner: UnitDefId | 'neutral';
                 cost: number; type: TypeId; effects: Effect[]; once?: boolean };

type Ability =
  | { k: 'mpAtTurnStart'; n: number }                               // A
  | { k: 'firstCardConverts'; from: 'strike'; to: 'pierce'; while: 'fullHp' }; // B

type EnemyStep = { move: MoveRule; act: ActRule };
type MoveRule  = 'none' | 'hunt' | 'advance' | { if: Cond; then: MoveRule; else: MoveRule };
type ActRule   = { k: 'none' } | { k: 'strike' | 'pierce' | 'slash' | 'shield'; n: number }
               | { if: Cond; then: ActRule; else: ActRule };
type Cond      = 'slashInRange';
type EnemyDef  = { id: string; hp: number; baseShield: number;
                   script: { kind: 'cycle'; steps: EnemyStep[] } };
```

- `script.kind` is a union with one member today. A weighted pool is a second member later, not a rewrite.
- A data validation test fails the build if any shipped card uses a reserved effect with no resolver.
- A condition is evaluated once, in the enemy move phase, and the result is stored on the resolved intent. The act never re-evaluates it.

---

## 3. One round, in fixed order

`commit` runs these phases in order. Each emits events.

1. **Player moves.** Every planned play that contains a Move, including a Move placed by Command, in the order selected.
2. **Player cards.** Every other planned play, in the order selected. A play whose chosen target is gone fizzles: the card is still used and its MP is not refunded.
3. **Win check.** If no enemy remains, the battle ends here. Dead enemies never act.
4. **MP gain.** Each living player unit gains 1 MP, capped by `rules.mpCap`.
5. **Enemy actions,** in spawn order. An enemy's own Shield from its previous action clears first. Then its telegraphed action resolves against the board as it now stands. Loss check after each.
6. **Enemy moves,** in spawn order. Each enemy advances its cycle by one step and performs that step's move rule.
7. **Enemy telegraph.** Each enemy resolves that step's act rule into an intent with its lit tiles.
8. **Next hand.** Round counter up. Player Shield clears. Start-of-turn MP lands (A's ability, the unnamed mana card). Unplayed hand cards go to discard. Draw 5, plus any pending extra draws.

Battle start runs 6, 7 and 8 once, after rolling each enemy's starting step.

### Legality is checked against the projected board

Slash and Blast are danger-zone only, and moves resolve first. So a unit standing in the backline may plan a Move into the danger zone and then a Slash in the same turn. `project(state)` returns the board after all planned moves. Every zone check, range check and choice list reads the projection, never the raw board. This is the rule most likely to be built wrong, so it gets its own tests.

Unselecting a play also removes every later play that is no longer legal on the new projection, and emits an event naming each one. The plan is always legal as a whole.

### MP

- MP is reserved at `select` and released at `unselect`. A plan can never exceed a unit's MP at the start of the turn.
- MP gained from a card (Resupply) lands when the card resolves, so it is spendable next turn.

### Shield and damage

- A unit has three pools: temporary `shield`, one-time `baseShield`, and `hp`. Damage drains them in that order.
- Player `shield` clears at phase 8. Enemy `shield` clears at the start of that enemy's next action. `baseShield` never refreshes and never clears.
- A player unit at 0 HP faints: it leaves the board and its cards move from every pile to `removed`. Neutral cards stay.

### Piles

`draw`, `hand`, `discard`, `spent` (Once cards after use), `removed` (a fainted unit's cards). When `draw` runs out mid-draw, shuffle `discard` into `draw` and continue. Card count across the five piles is constant for the whole battle.

---

## 4. Enemy interpreter

- **Hunt.** Candidate lanes are those that hold a player unit and that the enemy can reach by moving along its own column through empty tiles. Pick by `rules.huntTieBreak`: nearest lane, then the lane whose front player unit has the lowest HP, then the upper lane. Distance 0 counts, so an enemy already facing a player unit stays.
- **Advance.** One column toward the player side, never past column 3. If the tile is occupied, wait.
- **slashInRange.** True when the enemy stands in column 3 or 4 and a player unit stands on one of the 3 tiles of the next column toward the player.
- **Strike.** Hits the first player unit in the enemy's lane, counted from the enemy's side. Other enemies do not block it.
- **Pierce.** Hits every player unit in the lane.
- **Slash.** Hits every player unit on the 3 tiles of the next column toward the player.
- **Telegraph.** The intent stores the action, its number, and the tiles it will hit from the enemy's current position. Enemies do not move between telegraph and action, so the lit tiles are exact.
- Enemies obey the one-unit-per-tile rule and resolve their moves one at a time in spawn order.

---

## 5. Determinism, logging, replay

- RNG is used in exactly three places: the opening shuffle, each reshuffle, and each enemy's starting step.
- Keys: `cards:{battleId}:shuffle:{ordinal}` and `cards:{battleId}:enemy:{spawnIndex}:start`. `battleId` derives from the seed and the encounter id. The shuffle ordinal is a counter held in state. No key contains a round number, an HP value or anything else a player choice can change directly.
- Every tie-break is a fixed rule, never a roll.

```ts
type BattleLog = { engineVersion: string; seed: string; encounterId: string;
                   deckId: string; actions: Action[] };
replay(log, rng): { state: BattleState; events: BattleEvent[] }
summarize(log, rng): PlaytestReadout
```

- The log is every action in order. Replaying it reproduces the final state and the full event stream exactly.
- `CARD_ENGINE_VERSION` is a new constant, separate from the four existing axes. It is stamped on every log. Replay with a mismatched version fails loudly with both values named.
- The sandbox writes nothing into the run save. If it stores anything, it uses its own `localStorage` key.

### Playtest readout

`summarize` turns a log into the numbers the fun test asks about. No judgement, only counts.

| Readout | Fun test question it answers |
| --- | --- |
| Rounds to finish, and outcome | Is a fight 4 to 7 rounds? |
| Rounds each unit spent in the danger zone | Do players step in on purpose? |
| Telegraphed hits dodged against hits taken | Do players read telegraphs? |
| Cards played per round, and rounds with no choice | How many turns were automatic? |
| Moon Strike casts and the round of each | Does banking pay off? |
| Neutral cards played, by unit | Is the Neutral choice contested? |

---

## 6. Reliability and speed gates

These are tests, not aspirations.

| Gate | Threshold |
| --- | --- |
| Invariants hold after every step of 2,000 random-bot battles | 0 violations |
| Every random-bot battle ends inside the round cap in `rules.ts` | 0 non-terminating seeds, failing seed printed |
| Every action from `legalActions` is accepted | 100 percent |
| Random malformed and illegal actions | rejected, same state reference, no throw |
| 1,000 random-bot battles, headless under Node | under 5 seconds |
| Same seed and log, run twice | deep-equal state, identical event stream |

Invariants checked: one unit per tile, every unit inside its side's reach, 0 <= HP, 0 <= MP <= cap, slots used <= slots, reserved MP <= MP, constant card count across piles, no card in two piles, no planned play that `legalActions` would refuse.

---

## 7. The UI contract

`viewOf(state)` returns everything the screen draws. The UI computes nothing about rules.

```ts
type BattleView = {
  round: number; phase: 'plan' | 'won' | 'lost'; canCommit: boolean;
  tiles: TileView[];        // 18, each: pos, zone, occupant, telegraphedBy[], planGhost?
  units: UnitView[];        // hp, shield, baseShield, mp, mpCap, slots, planned[], fainted
  enemies: EnemyView[];     // hp, shield, baseShield, intent: { icon, n, tiles[] }
  hand: HandGroupView[];    // grouped by owner, neutrals last; each card: playable, reason, needs
  piles: { draw: number; discard: number };
};
choicesFor(state, card, unit): { units: UnitId[]; tiles: Pos[] }
```

`needs` is `'none' | 'unit' | 'tile' | 'unitThenTile'` and drives the tap flow. `reason` is a typed code for why a card is unplayable (no MP, no slot, wrong zone, no target, once used), shown through inspect.

### Input

1. Tap a card. An owned card is assigned to its owner. A Neutral card asks which unit plays it.
2. If the card needs a choice, the legal units or tiles light up. Tap one.
3. The play appears in that unit's next slot. Tap a filled slot to remove it.
4. Tap End Turn. `commit` runs, the new state applies at once, events play back as skippable beats.

Long-press or the inspect button shows the full card. Opening inspect never plays a card.

### Layout at 390x844, no scroll

| Region | Size | Holds |
| --- | --- | --- |
| Top bar | 390 x 40 | Round, draw and discard counts, exit |
| Board | 192 x 384, centred | 3 lanes wide, 6 rows tall, 64px square tiles. Enemy backline at the top, player backline at the bottom. |
| Left gutter | 99 x 384 | Enemy panels beside the enemy rows: HP, shield, intent |
| Right gutter | 99 x 384 | Player unit panels beside the player rows: HP, shield, MP pips, slot squares |
| Hand | 390 x 110 | 5 cards at 72 x 101 with 6px gaps. A 6-card hand shrinks to 60 x 84. |
| Action row | 390 x 52 | End Turn, undo last selection |

Total is about 610px, which leaves room for mobile browser chrome. If a region does not fit, report what gives. Do not add scroll.

Every touch target is at least 44px. Nothing depends on hover.

### Hidden entry

- On the starter select screen, the key sequence **ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter** opens the `test` battle.
- One capture-phase `keydown` listener, attached when the screen mounts and removed when it unmounts. A wrong key resets the sequence. Keys typed into an input, textarea or contenteditable are ignored.
- On the completing Enter only, call `preventDefault` and `stopImmediatePropagation`, so Enter never also picks a starter.
- **Second entry for phones:** the URL hash `#test` on load opens the same battle. A phone has no arrow keys, and the layout target is a phone.
- The entry is invisible. No button, no hint, no change to the starter select layout, its heights or its visual baseline.
- The test battle module loads through a lazy `import()`, so the main bundle does not grow.

### Sandbox screen extras

The seed shown small, a Restart button (same seed), a New Seed button, and Copy Log, which copies the `BattleLog` JSON. `npm run cards:replay -- <file>` replays a pasted log headless and prints the playtest readout.

---

## 8. Asset contract

The UI asks the manifest for these IDs and nothing else. Until the pack arrives, every ID resolves to a placeholder of the correct size. Dropping the pack into `src/ui/assets/cardbattle/` and pointing the manifest at it is the whole integration.

File path is always `{group}/{id}.svg`. Icons use `currentColor` and are tinted by the UI. Everything else has its colours baked.

| Group | ViewBox | Render size | IDs |
| --- | --- | --- | --- |
| tiles | 64 x 64 | 64px | `tile-player-backline`, `tile-danger-zone`, `tile-enemy-backline`, `tile-overlay-selectable`, `tile-overlay-selected`, `tile-overlay-telegraph`, `tile-overlay-unavailable` |
| cards | 240 x 336 | 72 x 101 compact, 240 x 336 full | `card-frame-compact`, `card-frame-full`, `card-overlay-selected`, `card-overlay-unavailable`, `card-badge-corner` |
| ui | varies | stretch | `panel-frame`, `pill-badge`, `bar-track`, `bar-fill`, `pip-empty`, `pip-filled`, `slot-empty`, `slot-filled`, `button-default`, `button-pressed`, `button-unavailable` |
| icons | 24 x 24 | 16px and 24px | `icon-hp`, `icon-shield`, `icon-mp`, `icon-strike`, `icon-pierce`, `icon-slash`, `icon-blast`, `icon-move`, `icon-target`, `icon-stealth`, `icon-repair`, `icon-once`, `icon-draw`, `icon-hunt`, `icon-wait`, `icon-class-special`, `icon-class-ranged`, `icon-class-melee`, `icon-type-fire`, `icon-type-plasma`, `icon-type-water`, `icon-inspect`, `icon-confirm`, `icon-cancel`, `icon-end-turn`, `icon-deck`, `icon-discard` |
| markers | 64 x 64 | 48px token on a 64px tile | `marker-player-base`, `marker-enemy-base`, `marker-unit-commander`, `marker-unit-gunner`, `marker-unit-dasher`, `marker-enemy-drone`, `marker-enemy-lancer`, `marker-ring-selected`, `marker-ring-destination`, `marker-reticle` |

How view state maps to assets:

| View state | Asset |
| --- | --- |
| Tile zone | one of the three `tile-*` bases |
| Tile in an enemy intent | `tile-overlay-telegraph` |
| Tile is a legal choice right now | `tile-overlay-selectable` |
| Tile chosen, or planned move destination | `tile-overlay-selected`, `marker-ring-destination` |
| Tile not choosable while a choice is pending | `tile-overlay-unavailable` |
| Unit or enemy token | its `marker-unit-*` or `marker-enemy-*`, falling back to the base |
| Unit being assigned a card | `marker-ring-selected` |
| Unit is a legal target | `marker-reticle` |
| Hand card | `card-frame-compact` plus `card-badge-corner` holding the owner's token |
| Card selected, card unplayable | `card-overlay-selected`, `card-overlay-unavailable` |
| Inspect | `card-frame-full` |
| MP, slots | `pip-*`, `slot-*` |
| Enemy intent | `pill-badge` with the keyword icon, `icon-hunt` or `icon-wait`, and a number drawn as text |

Numbers and names are always text drawn by the UI. No asset contains text.

---

## Tests required

1. One test per implemented keyword: Strike hits the first enemy in lane, Pierce hits all, Slash and Blast shapes clipped at the board edge, Move blocked by units and by the reach limit, Shield absorbs before base shield before HP, Target lands at any range.
2. Projection: Slash is illegal from the backline, legal after a planned Move into the danger zone, and illegal again when that Move is unselected.
3. Every Puppeteer card and both unit abilities, one test each, against the table in Appendix A. Include: Command uses a slot of the ally and none of its MP, Need Help draws a card that is not C's on the next hand, Once cards cannot be played twice, B's Pierce applies only at full HP and only to its first card.
4. Drone and Lancer walk their full cycles on fixed boards. Hunt tie-breaks. A blocked advance waits. The Drone's Slash fires only in range. A telegraphed Strike misses when the player moves out of the lane.
5. Shield timing for both sides, and base shield never refreshing.
6. Faint removes the unit's cards from every pile and leaves Neutrals.
7. All six gates in section 6.
8. Replay: a log saved mid-plan, reloaded and continued, reaches an identical final state. A mismatched `CARD_ENGINE_VERSION` throws naming both values.
9. Boundary: `src/core/cards/` has no `ui/` import, no `@pkmn/*` import, no `Math.random`, no `Date`, no timers.
10. Non-interference: `contentHash` and all four version axes unmoved, seeded output byte identical, SMOKE24 included, starter select heights and visual baseline unchanged, main bundle size unchanged.
11. Hidden entry: the sequence opens the battle, a wrong key resets it, typing in an input is ignored, the completing Enter does not pick a starter, `#test` opens the battle.
12. Fit: the test battle at 390x844 has no scroll and every touch target is at least 44px.
13. Every asset ID in section 8 resolves, and a missing file renders the placeholder at the correct size.
14. All existing suites pass unchanged.

## Out of scope

Statuses, Stealth, Repair, Push, Pull, junk cards, type-restricted effects, objectives, rewards, deck building, any run-layer integration, a greedy bot, balance, audio, and deleting anything from the Showdown path.

## Definition of done

A playtester opens the build on a phone with `#test`, or on a laptop with the key sequence, and plays the Puppeteer deck against 2 Drones and a Lancer to a win or a loss. Every tap answers at once. Copy Log produces a file that replays to the same result under Node and prints the playtest readout. The shipped game, its seeds and its CI are untouched.

## Defaults I am taking, flagged for review

- `#test` as a second entry, because the key sequence cannot be typed on a phone.
- Card data is excluded from `contentHash` for now. It gets its own content axis when the engine joins the run layer.
- The plan lives in engine state and the log records every select, not only commits.
- B's ability converts Strike only. Fire! and Artillery are unaffected.
- A Neutral or owned Shield with no stated target shields the unit that plays it.
- Call Medic may target A itself.
- The unnamed mana card ships with the placeholder name "Focus".
- R11 to R15 in Appendix A are engine-forced defaults added today. Each is one value in `rules.ts`.

---

## Appendix A: Rules snapshot, 2026-10-08

### Board

3 lanes by 6 columns. Columns 1 to 2 are the player backline, 3 to 4 the shared danger zone, 5 to 6 the enemy backline. Players reach columns 1 to 4. Enemies reach columns 3 to 6. One unit per tile. No unit moves through another.

### Classes

| Class | Slots per turn |
| --- | --- |
| Special | 1 |
| Ranged | 2 |
| Melee | 3 |

Slots do not carry over. Every card played uses one slot of the unit that plays it. MP is per unit, starts at 0, and gains 1 after each turn.

### Keywords in this slice

| Keyword | N | Rule | Zone |
| --- | --- | --- | --- |
| Strike | Damage | First enemy in the unit's lane, any distance | Anywhere |
| Pierce | Damage | Every enemy in the lane | Anywhere |
| Slash | Damage | The 3 tiles of the next column | Danger zone only |
| Blast | Damage | A chosen tile in the next 2 columns plus its 4 neighbours | Danger zone only |
| Move | Spaces | Up to N orthogonal steps, each into an empty tile | Uses a slot |
| Shield | Shield | Absorbs damage before base shield and HP | Anywhere |
| Target | Units | The card's damage keyword lands on N chosen units at any range. Blast centres on the chosen unit. | Follows the damage keyword |

### Units

| Unit | Role | Class | Slots | HP | Base shield | Ability |
| --- | --- | --- | --- | --- | --- | --- |
| A | Commander | Special | 1 | 1 | 1 | +1 MP at the start of each turn, including turn 1 |
| B | Gunner | Ranged | 2 | 2 | 1 | Its first card each turn resolves Strike as Pierce while B is at full HP |
| C | Sword dasher | Melee | 3 | 3 | 2 | None |

### Cards

| Owner | Card | Cost | Engine reading |
| --- | --- | --- | --- |
| A | Call Medic | 1 | Shield 1 on a chosen friendly unit |
| A | Command | 1 | Choose another friendly unit with a free slot and a destination within Move 1. Uses A's slot and one of that unit's slots. That unit pays no MP. Resolves in the move phase. |
| A | (unnamed) | 1 | A gains +1 MP at the start of each of its next 2 turns |
| A | Moon Strike | 4 | 2 damage to one chosen enemy, any range |
| B | Shoot | 0 | Strike 1 |
| B | Resupply | 1 | B gains 2 MP when the card resolves |
| B | Artillery | 4 | Danger zone only. Blast 2 centred on one chosen enemy, any range. |
| B | Fire! | 1 | Danger zone only. Blast 1 on a chosen tile. |
| C | Dash | 1 | Move 2 |
| C | Slash | 1 | Slash 1 |
| C | Need Help | 1 | Next hand draws 1 extra card not owned by C, the first such card from the top of the draw pile. None there means no extra card. |
| C | Prep | 1 | Shield 2 on C. Once. |
| Neutral | Move | 0 | Move 1 |
| Neutral | Dig In | 0 | Shield 1 on the unit that plays it. Once. |
| Neutral | Attack | 1 | Strike 1 |

Hand is 5, refreshed every round. Neutral cards play in any unit's slot and spend that unit's MP. Once means once per battle.

### Enemies

Each enemy plays its steps in order, one per round, then loops. The starting step is rolled per enemy.

**Drone, 3 HP, 1 base shield**

| Step | Move | Telegraphed action |
| --- | --- | --- |
| 1 | Hunt | Strike 1 down its lane |
| 2 | Advance | None |
| 3 | Stay if slashInRange, otherwise Hunt | Slash 1 if slashInRange, otherwise Strike 1 |
| 4 | None | Shield 1 |
| 5 | Hunt | Strike 1 down its lane |
| 6 | Advance | None |

**Lancer, 2 HP, 0 base shield**

| Step | Move | Telegraphed action |
| --- | --- | --- |
| 1 | None | Shield 1 |
| 2 | Hunt | None |
| 3 | None | Pierce 1 down its lane |

### First encounter

Enemies in column 5: Drone in lane 1, Lancer in lane 2, Drone in lane 3. Player in column 2: A in lane 1, B in lane 2, C in lane 3.

### Rule defaults, all in `rules.ts`

| ID | Rule | Value |
| --- | --- | --- |
| R2 | MP cap | 5 |
| R3 | Player Shield | Clears at the start of the player's next turn |
| R4 | Reach of Strike and Pierce | Any distance in lane |
| R5 | Slash and Blast shapes | As in the keyword table |
| R6 | Target on friendly keywords | Picks friendly units |
| R10 | Faint scope | This battle only |
| R11 | Base shield | One-time cushion, never refreshes, never clears |
| R12 | MP gained from cards | Usable next turn |
| R13 | Target on a pattern keyword | Lands on the chosen unit at any range |
| R14 | Friendly fire | None |
| R15 | Move shape | Orthogonal steps, any direction, inside the side's reach |
| E1 | Hunt tie-break | Nearest lane, lowest-HP target, upper lane |
| E2 | Hunt distance | Any number of lanes, stopping before a blocker |
| E3 | Enemy Slash range | Next column, danger zone only |
| E4 | Advance | 1 column, wait if blocked, never past column 3 |
| E5 | Enemy Shield | Lasts until the start of that enemy's next action |
| E6 | Starting step | Rolled per enemy |

R1, R7, R8 and R9 concern pricing, Push, statuses and the Fire debuff. None is used by this slice.
