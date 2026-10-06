# Defender Mode v0, step 7: the bible read, and the amendments it needs

Prompt: [`../spec/gymrun-defender-mode-v0-fun-test.md`](../spec/gymrun-defender-mode-v0-fun-test.md),
step 7, "UI on existing components". Filed 2026-10-05 on
`claude/eager-turing-0059br`, after steps 2 to 6. **No file under `src/ui/` has
changed for step 7.**

## Why this stops before code

CLAUDE.md: a stage that touches a player-facing surface reads the design bible
first and reports which of its rules it touches. Work that finds it needs a
sentence at rest, a second explanation mechanism, **a new glyph family** or
**a third move-card call site** stops and files an amendment before building.
Bible section 10.3 says the same.

I read the bible (Rev 23) in full. Step 7 needs **a fourteenth glyph family**:
Fire's highlighted slot and its next-use crit chance, Psychic's revealed action
and Flying's fifth move each need a mark, and no existing family means any of
them. It also needs **six surfaces section 4 does not budget** and **seven
attributes section 3 has no row for**. So this is a hard stop.

Below, every surface the mode adds is listed with the rules it touches. Each
amendment is proposed in the shape the bible's D rows take, with a recommended
option. Everything is built from existing components wherever one fits.

---

## 1. Surfaces, and the rules each one touches

| # | Surface | Built from | Rules touched | Needs |
|---|---|---|---|---|
| S1 | Mode choice at run creation (attacker or defender) | The intro sheet's / seed bar's existing controls | R2, section 4 | **A budget row (A2)** |
| S2 | Gym type select: Fire, Psychic, Flying | The locale screen's three-card pick (`locale-select.ts`): a card per type, its type chip at rest | R2, R5, R12, C2, section 4 | **A budget row and a "Badge" encoding row (A1, A2)**. C2: what a badge does changes the pick, so it must be one press away |
| S3 | Draft, three picks of three, and the recruit draft | The starter screen and starter card (`starter-select.ts`) unchanged, once per pick | R1, R6, R13, section 4's *Starter card* and *Starter detail panel* rows | Nothing new **except** the Fire highlight on a move chip (A1). C2: under Fire, which slot is highlighted changes the pick |
| S4 | The door: two challengers, class and tier | The map screen's node card on the step being chosen from (`run-map.ts`): trainer glyph, tier pips, payout, AI tier | R1, R2, C2, section 4's *Map node card* row (budget 1) | **A ruling (A2)**: the class name beside the trainer glyph, as a gym's leader name sits beside the badge, and the class's types as type chips |
| S5 | The intermission | The shop screen and the party screen's teach panel, unchanged | none new | Nothing |
| S6 | Pre-boss: team size and level, not species | The pre-gym screen (`pre-gym.ts`), whose budget row is "leader name, type chip, Choose lead" | section 4's *Pre-gym screen* row, R2 | **A budget row variant (A2)**: no leader and no type chip, so the team size and level take those slots |
| S7 | Fire on the battle button: the highlighted slot and its next-use crit chance | `renderMove`, the battle button call site, unchanged | R1, R2, R3, R4, section 2 | **The new family (A1)**. A bare percentage with no mark would read as accuracy |
| S8 | Psychic: the opponent's committed action, before the player chooses | The opposing battle panel, carrying a move chip (name, type chip, category, BP), or the incoming species on a switch | C1, R8, R3, section 4's *Pokemon battle panel* row | **The new family and an encoding row (A1)**. C1 is not touched: it is a fact about the present board, not a recommendation. R8 is not touched: R8 forbids the *effectiveness* forecast on the opponent panel, and this is not effectiveness |
| S9 | Flying: the fifth button outside the 2x2 grid, and Speed at 1.1x | `renderMove` for the button, rendered once more in its own slot. The stat block's Speed cell | R1, section 5's *Move card* "a third call site is an amendment", R13, D98 | **A ruling (A4)** that the fifth button is the battle button call site, not a third. **An extension of D98 (A1)** so the Speed cell carries the engine's number under the badge |
| S10 | Reward card: a consumable, and a trade | `renderRewardCard` | section 3, section 5's *Reward card* row, R2, C2 | **Two encoding rows (A3)** |
| S11 | Bag: consumables listed, and used by two taps | The Bag screen and D97's two-tap swap | R13 (a carried item's name and effect line at rest), D94, D97 | **A ruling (A3)** that a consumable is a carried item under R13, and that "use" is D97's two taps with a member as the target. In a battle the Bag is the readout (D94), which is also the prompt's "never in battle" |
| S12 | The decision feed for the six new decisions | `decision-feed.ts` | R11 (the feed carries every kind the run log records) | Copy only, in `docs/copy.md`. Run Info is unbudgeted |
| S13 | Trainer class sprites at the door | none | D61: trainer sprites are the player's marker only | **No change proposed**: no new art, so the class shows as its name. D61 holds |

---

## 2. Proposed amendments

Numbered D99 onward, following Rev 23's D98.

### A1, D99: the fourteenth glyph family, **Badge**

**Recommended.** One family, three marks, one per gym type, each drawn only for
a party member carrying the gym type in a defender run:

- **Flame**, on the Fire badge's highlighted move slot, on every move card and
  move chip that shows that member's moves: the draft and recruit cards, the
  party row, the battle button. On the battle button only, the next use's crit
  chance sits beside the flame as a bare percentage (12, 50, 100). Default:
  absent. Inspect: the streak rule and the next stage.
- **Eye**, on the opposing battle panel, beside the opponent's committed action
  for this turn: a move chip for a move, or the incoming species' name for a
  switch. Default: absent, including on a forced replacement. Inspect: what the
  badge reveals and when.
- **Wing**, on the fifth button, and in the Speed cell of the player's stat
  block when the badge applies. Default: absent. Inspect: 1.1x Speed, and the
  once-per-battle move.

The family takes R7's exposure labels like every family. Section 2's count
becomes fourteen, and its section 9 row ("Thirteen glyph families is the right
size") is updated.

**The Speed cell, extending D98.** The cell already shows "the number as the
stage makes it". Recommended: under the Flying badge it shows the number the
engine reads (the stored stat, the stage, then 1.1x, as `getStat` does), with
the wing in place of a stage count when there is no stage. The prompt's "the
multiplier is never contradicted on screen" then holds on the one surface where
it could have been contradicted.

**Section 3 rows added:** Badge (gym select card), Fire highlight, Fire next-use
crit chance, Foe intent, Fifth move, Badge Speed.

**Section 9 rows added (the bets):**

| Rule | Disconfirmed if | Then |
|---|---|---|
| The eye reads as the opponent's action, not a hint | A tester says the game told them which move to use, or reads the revealed move as their own | The move chip goes and the move name alone stays, behind the eye's press |
| The crit percentage reads as a chance, not accuracy | A tester reads it as hit chance | The percentage moves to the flame's press, and the flame alone stays at rest |

Alternative: **no family, and everything on inspect.** That fails C2 at the
door and the draft: under Fire, which slot is highlighted is a fact that changes
the pick, and it would sit behind a press on a surface with no other way in.

### A2, D100: four surface budgets

| Surface | Budget | Words that survive |
|---|---|---|
| Mode choice | 2 | The two mode words, one per control |
| Gym type select screen | 4 | The instruction, as the locale screen's 4. Each card is a type chip and the badge's mark: zero words. What the badge does is the card's inspect, from a new excluded copy file |
| Map node card, defender door | 1 plus the class name | AI tier as today. The class name sits beside the trainer glyph and is identity, as a gym's leader name is (D46). The class's types are type chips at rest on the step being chosen from; an untyped class shows none |
| Pre-gym screen, defender boss | 4 | "Choose lead". In place of the leader name and type chip: the team size as a bare number beside the gym glyph, and the level as the party row writes a level |

Alternative for the door: the class name on the node glyph's press only. That
fails C2: the prompt makes the class "something the player acts on", and the
class is the only fact separating two challengers of the same tier.

### A3, D101: two reward card faces, and consumables in the Bag

- **Consumable card**: the item sprite from the same Showdown sheet (Potion,
  Super Potion and Hyper Potion each have one), as section 3's *Held item* row.
  Budget 0. Name and effect line ("Heals 20 HP.") are inspect, from a new
  excluded copy file.
- **Trade card**: two sprites in fixed slots, the offered mon on the left and
  the member asked for on the right, each with its species name. Species names
  are proper nouns, so the budget is 0. **C2**: the offered mon's moves, stats
  and ability change the decision, so its inspect opens the starter card (the
  existing component, its third mount) and the member's opens its party row.
- **Bag**: consumables are a carried item under R13, so each is listed at rest
  with its name and effect line. Use is D97's two taps, the item then a member.
  It is refused at the same layer the run refuses it: on a fainted member, a
  full-HP member, or in a battle, where the Bag is the readout (D94).

### A4, D102: the fifth button is the battle button's call site

**Recommended ruling:** the fifth button mounts `renderMove` exactly as the
four do. It sits in its own fixed slot outside the 2x2 grid, and the flying
mark tells it apart. That is one call site rendered five times, not a third
call site, so section 5's "two call sites is the accepted shape" holds. The
once-per-battle limit is the PP glyph's own "1, max dimmed" and needs no new
encoding.

Alternative: rule it a third call site, which section 5 names as an amendment
anyway.

---

## 3. What can be built without a ruling

These have no presentation content, and could land now if wanted:

- The UI's `RunPolicy` answers for `chooseGymType`, `chooseDraftPick`,
  `chooseDoor` and `chooseRecruit`, routed to the screens above.
- The resume path passing the saved log's mode to `resumeRun`.
- The decision feed's copy for the six new decisions, which R11 already
  covers, recorded in `docs/copy.md`.

I have not built them. Splitting the step this way would put half a UI on
`main`'s code path for a mode nobody can reach yet.

---

## 4. Asking

Rule on A1 to A4 (recommended, alternative, or your own), and say whether the
bible should be amended to Rev 24 in this branch. The bible's section 10.1
requires a playtest observation for **changing** a rule. These are additions
under author directive, as D91 to D98 were, so `playtest-log.md` would record
them that way. Once ruled, step 7 builds to it.
