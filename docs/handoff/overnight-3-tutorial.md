# Handoff: overnight Branch 3, the tutorial

Branch `claude/overnight-3-tutorial`, from
[`../spec/gymrun-overnight-contenthash-ai-tutorial.md`](../spec/gymrun-overnight-contenthash-ai-tutorial.md),
Branch 3. Deviations: [`../generation.md`](../generation.md) section 12h.

## Merged at

The branch's last code commit is `655d193`; this file is the commit
after it, and the merge is a fast-forward, so the integration branch's head
after the merge is the commit that added this file:
`git log -1 --format=%H -- docs/handoff/overnight-3-tutorial.md`. As for the
two branches before it, `main` was not pushed to by this session; the
integration branch `claude/overnight-infrastructure-8r4nd4` carries all three.

## Version axes

| axis | before | after |
|---|---|---|
| `RUN_LOG_VERSION` | `gymrun-run-13/gymrun-0.3.0` | **none** |
| `contentHash` | `b022fc4e…` | **none** — `data/tutorial.ts` is on the exclusion list; `npm run content-hash` prints the same value |
| `AI_VERSION` | `gymrun-ai-3-priority` | **none** |
| `randomizerVersion` | `gymrun-randomizer-13` | **none** |

## Baseline for the next branch

- **Step 0 confirmation of Branch 2's baseline:** the full suite on the merged
  Branch 2 head (`e996db4`) was **1216 passed, 8 failed** — the inherited
  nine less the `backpack` resume timeout, which passed on that run; it is
  load-dependent. Fixture sha256 matched (`62a47924…`).
- **Test count:** 1261 tests in 97 files (Branch 2 had 1224 in 95). The full
  suite on the branch at `4919315` was **1246 passed, 15 failed**, with four
  vitest worker RPC timeouts under load that failed no test. Seven of the
  fifteen were this branch's and are fixed in `655d193` — five by taking the
  tutorial control out of its own header row, two by a duration token and an
  overlay allowlist entry — each file re-run green (`band`, `visual-tokens`,
  `visual-v0`, `visual-v2`, `visual-v3`, `visual-v5`, `map-fold`,
  `tutorial-browser`). The eight left are `main`'s inherited failures, so
  **1253 passed, 8 failed** is what a clean re-run of this head should
  report. Build (`tsc` plus `vite build`) green; lint green.
- **`test/fixtures/sim-report.json` sha256:**
  `62a4792448b3c897e6b73d66cdfacc965f9eae4244ee90e0b29d254299d6edca`, unchanged
  from Branch 2, as it must be. The visual baseline's run records and battle
  are unchanged; its `data-digest.txt` now reads `contentHash` (deviation 4)
  and holds `b022fc4e…`.
- **SMOKE24:** **passed**, 47 checks in Chromium against the bundle built from `655d193`. The smoke script seeds its browser with the tutorial
  skipped, as the visual harness does; the tutorial's own browser test is the
  one that runs with it on.
- **Benchmark:** unchanged from Branch 2 — mean gyms cleared **4.873**, prefix
  **RETUNE**, **400** seeds, `greedy`, nodes `rest`. Not re-run: nothing under
  `core/` or `data/` that a run reads changed, which the fixture's byte
  identity is the proof of.

## Decisions taken

1. **Coach marks, not a scripted seed**, per the prompt's default.
2. **29 marks over eight screens**, at most six on any: starter 5, locale 2,
   map 5, battle 6, result 3, party 3, drawer 2, pre-gym 3. Anchored by
   `data-tutorial` attributes on the real elements; a mark whose anchor is not
   painted is skipped and the rest show.
3. **The flags live in `ui/settings.ts`** beside the verbosity toggle: one
   `skipped` bit and a per-screen `seen` list, persisted under the same key,
   never keyed to a seed. A screen replaced mid-marks counts as visited.
4. **"Skip tutorial" is on the first mark; "Show tutorial again" is in the
   header** beside the Detail toggle, and re-shows the screen on view at once.
5. **A tap anywhere on the panel advances.** The panel stops propagation, so
   nothing under it is chosen. No timers, no auto-advance.
6. **Placement**: below the anchor, else above, else the anchor scrolled to
   the top with the panel beneath and capped, else (an anchor taller than the
   screen) over its lower part with its top edge clear. The scroll is instant
   so the measurement is right; the panel has no position transition, because
   a gliding panel crossed its next target.
7. **Every other browser context starts with the tutorial skipped**: the
   visual harness's `openApp`, the three tests that open their own contexts,
   and the smoke script seed the store, so a scripted click never lands on a
   mark. `openApp(..., { tutorial: true })` is the opt-in.
8. **The copy is written against Detailed mode**, per the prompt's default;
   the stat mark takes the first sentence of each stat tooltip from
   `data/statInfo.ts` rather than restating it.
9. **The forbidden list is data and has twelve words** (deviation 5).
10. **The visual baseline's digest reads `contentHash`** (deviation 4).

## For the next branch

- The pattern for a new screen: set `data-tutorial` on the real element,
  add marks under the screen's key in `data/tutorial.ts`, and mount the screen
  in `test/tutorial.test.ts`'s fixture switch; the test fails on a mark with
  no anchor and on a screen past six marks.
- Any new browser test that opens its own context should call
  `skipTutorialIn(context)` from `scripts/visual/browser.mjs`, or its clicks
  may land on a mark.
- `docs/README.md`'s current-state section names all three branches, per the
  morning checklist's item 4.

## Morning decisions

1. **Read the copy table, end to end.** This is the one review no test
   replaces. Every sentence is meant as an attribute; if one reads as advice,
   cut it in `data/tutorial.ts` and nothing else moves.
2. **Merge to `main`**: fast-forward `main` to the integration branch, or open
   one PR from it, then flip the overnight prompt's register row to `merged`.
3. **Pocket mode**, if and when it exists, wants its own pass over the marks
   (known gap, deviation note).
4. **Whether the `drawer` marks are wanted at all**: the drawer is a view, and
   its two marks restate what the party screen's three say. They cost nothing
   and are easy to delete.

### The copy table

### `starter` (5)

| mark | anchor | title | text |
|---|---|---|---|
| `seed` | `[data-tutorial="seed"]` | The seed | A seed is a short code that fixes the whole run: which Pokemon appear, which routes are offered, what each fight rolls. Two people with the same seed who make the same choices get the same run. The code shown here can be copied and pasted into this box on another day. |
| `starters` | `[data-tutorial="starters"]` | Three starters | A run begins by choosing one of these three Pokemon. Everything shown on a card — its stats, its types, its ability and its moves — is the whole basis for the choice. There is nothing hidden. |
| `stats` | `[data-tutorial="stats"]` | The six stats | HP is Hit Points: How much damage this Pokemon can take before it faints. Atk is Attack: Used for damage from PHYS moves only. Def is Defence: Reduces damage from PHYS moves only. SpA is Special Attack: Used for damage from SPEC moves only. SpD is Special Defence: Reduces damage from SPEC moves only. Spe is Speed: Decides which side moves first each turn. Tapping any of the six labels opens the same explanation later. |
| `types` | `[data-tutorial="types"]` | Types | A Pokemon has one or two types, shown here. Moves have a type too, shown on each move, and the two are different things: a Pokemon’s types decide what hits it hard, a move’s type decides what it hits hard. |
| `moves` | `[data-tutorial="moves"]` | Moves | Each Pokemon knows up to four moves. A move has a type, a base power in BP, and a number of uses in PP. A move marked Status has no base power: it changes something instead of dealing damage. |

### `locale` (2)

| mark | anchor | title | text |
|---|---|---|---|
| `regions` | `[data-tutorial="regions"]` | A region | Each part of the run is walked through one region. The region sets which wild Pokemon can appear and which events are available. It does not set how hard the fights are. |
| `gym` | `[data-tutorial="gym"]` | The gym at the end | Every region ends at a gym, and the gym’s type is shown here before the region is chosen. The gym leader’s Pokemon share that type. |

### `map` (5)

| mark | anchor | title | text |
|---|---|---|---|
| `options` | `[data-tutorial="options"]` | The current step | A run through a region is a chain of steps. At each step there are two or three options, and the options on the numbered step here are the decision. Exactly one of them is taken. |
| `kinds` | `[data-tutorial="kinds"]` | What an option is | Wild is a fight against a wild Pokemon, which can be caught. Trainer is a fight against a trainer’s team. Rest restores the party’s HP and PP and pays nothing. Shop sells items for coins. A question mark is an event. Gym is the leader at the end of the region. |
| `tier` | `[data-tutorial="tier"]` | Normal, hard, elite | A fight carries a tier. Hard is a harder fight than normal and pays a larger reward; elite is harder again and pays more again. The tier is shown on every step that can still be seen. |
| `gate` | `[data-tutorial="gate"]` | An event’s requirement | An event names a capability it asks for and shows the party’s standing for it: known, if a relic grants it; latent, if the party’s types could manage it; or none. The standing decides which of the event’s outcomes applies. |
| `chain` | `[data-tutorial="chain"]` | Above and below | Steps already taken sit above the current one and the steps still to come sit below it. They are context. Only the current step is being asked about. |

### `battle` (6)

| mark | anchor | title | text |
|---|---|---|---|
| `move` | `[data-tutorial="move"]` | A move button | Each button is one move. Its type chip and its Physical, Special or Status chip say what it is: a Physical move is resolved with Attack against Defence, a Special move with Special Attack against Special Defence, and a Status move deals no damage. |
| `effectiveness` | `[data-tutorial="move"]` | The effectiveness marker | A marker on a move button is a forecast against the Pokemon on the field right now. Super effective means double damage, and four times against two matching types. Not very effective means half, and a quarter against two. No effect means none at all. No marker means normal damage. |
| `pp` | `[data-tutorial="pp"]` | PP | PP is the number of uses a move has left. A move at zero PP cannot be chosen until it is restored. |
| `status` | `[data-tutorial="status"]` | Status | A condition on a Pokemon — burned, paralysed, poisoned, asleep, frozen — is shown as a chip on its panel here, and tapping the chip says what it does. |
| `flags` | `[data-tutorial="flags"]` | What just happened | After each turn the strip here and the log beneath the board say what happened: which side moved first, what hit, whether it was super effective, a critical hit, a miss. |
| `fainting` | `[data-tutorial="hp"]` | Fainting | A Pokemon whose HP reaches zero faints. Fainting is not death: a fainted Pokemon stays in the party and can be revived. The run ends only when every member of the party has fainted. |

### `result` (3)

| mark | anchor | title | text |
|---|---|---|---|
| `rewards` | `[data-tutorial="rewards"]` | Three cards | A fight that is won pays a reward: three cards, and exactly one is taken. There is no skipping and no redrawing. Each card says what it is. |
| `capture` | `[data-tutorial="capture"]` | A capture | Every win against a wild Pokemon offers to add it to the party. Declining costs nothing. Accepting when the party is full means one member has to be released. |
| `coverage` | `[data-tutorial="coverage"]` | The coverage line | The coverage line lists the types the party can hit for extra damage, as it stands and as it would stand with this Pokemon in it. |

### `party` (3)

| mark | anchor | title | text |
|---|---|---|---|
| `items` | `[data-tutorial="items"]` | Held items | A Pokemon can hold one item, and this screen is where items are given and taken back. Items are locked during a battle. |
| `backpack` | `[data-tutorial="backpack"]` | The backpack | Items nobody is holding sit in the backpack, which has a capacity. The count here is how many it holds against how many it can. |
| `relics` | `[data-tutorial="relics"]` | Relics | A relic belongs to the run rather than to a Pokemon. It is permanent for the run, it takes no backpack space and no item slot, and it cannot be given away or lost. |

### `drawer` (2)

| mark | anchor | title | text |
|---|---|---|---|
| `party` | `[data-tutorial="drawer-party"]` | The party drawer | This drawer shows the whole party from any screen: each member’s stats, moves, PP, status and held item. It is a view. Items are given and taken back on the party screen, and are locked during a battle. |
| `relics` | `[data-tutorial="drawer-relics"]` | Relics | The run’s relics are listed here. A relic is permanent for the run and takes no slot. |

### `pre-gym` (3)

| mark | anchor | title | text |
|---|---|---|---|
| `gym` | `[data-tutorial="gym-counter"]` | The gym | A gym is the end of a region. Beating its leader finishes the region and begins the next one; losing ends the run. |
| `type` | `[data-tutorial="gym-type"]` | The gym’s type | Every gym has a type identity, shown here, and the leader’s Pokemon share it. |
| `lead` | `[data-tutorial="gym-lead"]` | Who leads | The Pokemon chosen here is the one sent out first. A gym that is beaten pays a larger reward than an ordinary fight: a move every time, and then a choice of cards. |

