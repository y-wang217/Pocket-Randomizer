# Card run shapes: the runthrough

2026-10-11, on `claude/card-run-shapes`, from `main` at `cf496bd`
(`cards-0.5.0`, `cardrun-0.1.0`). Prompt:
[`../spec/gymrun-card-run-shapes-prompt.md`](../spec/gymrun-card-run-shapes-prompt.md).

This plans the work and builds nothing. The prompt asks for a runthrough, and
four of its readings change the rules enough to need the author's answer
first (section 7).

## 1. Where the run stands

- **Bench.** `npm run cards:run -- 20 CRUN` reproduces `balance.md`'s row:
  20 of 20 runs won, a mean of 13.30 fights won, 3.00 bosses. Decks end at 16
  to 20 cards from a starting 15, with 8 to 15 upgrades.
- **HP probe** (a throwaway script, not committed; the same bot, the same 20
  seeds). Across 266 battles the bot loses a mean of **0.80 HP per battle out
  of a team total of 6** (Commander 1, Gunner 2, Dasher 3). Units fainted 75
  times, mostly the 1 HP Commander. 32 battles cost 3 HP or more. Summed over
  each act's battles, quests included, it loses **3.95, 4.90 and 1.85 HP**.
  Act 3 is low because the run stops at the last boss and has fewer quests.
- **Why it is easy.** Every battle starts at full HP, so damage never
  accumulates. In the wave rules, MP and base shield reset when a wave
  arrives, and the units are placed again (`RULES.betweenWaves`).

## 2. Does carrying HP close the gap?

**Yes, and carried across a whole act it would overshoot.**

- **Three waves per fight node, HP carried.** The bot would lose about
  3 × 0.8 = 2.4 of 6 HP per node, and a Commander who faints in wave 1 stays
  out for waves 2 and 3, because a faint lasts the whole battle (R10). That is
  a real jump in difficulty from one rule.
- **HP carried across the act's three fights, no heal.** The probe's 4 to 5
  HP per act is most of the team. With no heal the bot would usually reach the
  boss with one unit or none. A heal valve is needed: Patch Up (repair), a
  City rest, or a heal after each node.
- **The counterweight.** Carrying MP works the other way. Wave 2 opens with
  every unit at up to 5 MP and a fresh hand, so the ults are online on turn 1.
  Carrying MP but not HP would make waves 2 and 3 easier. Carrying both means
  a unit that spent its MP finishing wave 1 starts wave 2 empty, and that is
  the tension the message wants.
- **The bot is the measuring stick.** Group B's effects mean nothing to the
  guard bot until its evaluation knows them. Without that the bench would
  show the bot ignoring them, not what the cards are worth.

## 3. The big movers, ranked

1. **HP as a run resource** (section 2). The one change that makes every
   other decision cost something.
2. **Deck size discipline.** The no-skip rule (`CLAUDE.md`, Rewards, read as
   applying to the run in 125r) means every Town quest adds a card, so decks
   only grow, and a shape can never become consistent. Proposed: a card
   reward **replaces** a card the player picks (a basic, typically). The deck
   stays at 10 to 12, every reward is still exactly 3 options with no skip, and
   the basics are shed as the shape forms. The Shrine and the camp stay as the
   other ways to thin the deck.
3. **Boss upgrades become talents that pick a shape.** Today a boss gives +1
   slot, HP, shield or MP. A talent changes how a unit plays: the Gunner's
   pierce is the first one. Two or three talents per unit, drawn at
   generation like today's boosts, are what turn one deck into four shapes.
   Plain stat boosts can stay as one of the three options.
4. **Enemy scaling.** One table: HP added per act, and a "veteran" script per
   enemy that hits harder or more often from act 2. A second boss so the
   Colossus is not all three. All data; the resolvers already read scripts.
5. **Shape-aware offers.** A Town's three cards are drawn one per shape (or
   one per unit) at generation, so a player chasing a shape usually sees a
   card for it. Still drawn up front, with nothing read from the player's
   deck, so the keyed-stream rules hold.

## 4. The basic deck

Ten cards that do nothing fancy. The Puppeteer's fifteen become rewards: it
is one end state, not the start.

| Card | Owner | Cost | Effect | Note |
|---|---|---|---|---|
| Baton | Commander | 1 | Strike 1 | new, a basic hit |
| Brace | Commander | 0 | Shield 1 self | new, Dig In for one owner |
| Shoot | Gunner | 0 | Strike 1 | exists |
| Brace | Gunner | 0 | Shield 1 self | |
| Slash | Dasher | 1 | Slash 1 | exists |
| Brace | Dasher | 0 | Shield 1 self | |
| Move ×2 | Neutral | 0 | Move 1 | exists |
| Attack | Neutral | 1 | Strike 1 | exists |
| Dig In | Neutral | 0 | Shield 1 self, Once | exists |

- **The Gunner's ability comes off.** "First card each turn becomes Pierce at
  full HP" becomes a Gunner talent, Marksman (section 5).
- **Removal floor.** `RUN_RULES.minDeck` drops from 10 to 8, so the Shrine
  can still thin a fresh deck.
- **Leaner hands.** Hand size 5 against a deck of 10 means the hand cycles
  every two turns.

## 5. The four shapes, and what each still needs

Slash and Blast only fire from the danger zone (`RULES.keywordZone`), which is
what makes "move the Gunner forward" a real decision rather than flavour.

| Shape | Plan | Exists | Needs |
|---|---|---|---|
| **Puppeteer** | the Commander moves and shields the others | Command, Orders, Call Medic, Fortify, Need Help, Focus | nothing, becomes rewards |
| **Bodyguard and battery** | Dasher tanks and blocks; the Commander only nukes and banks mana | Moon Strike, Focus, Guard Up, Prep | **cover** (new effect: the Dasher takes hits aimed at an adjacent ally), a Commander nuke (Overcharge: Strike 3, cost 3), talents Bodyguard (Dasher) and Battery (Commander, +1 MP a turn) |
| **Escort artillery** | the Commander walks the Gunner into the danger zone, the Dasher guards him, he lays Blasts | Command, Orders, Artillery, Fire, Volley, Rally | Barrage (Gunner ult, Blast 3), a Dasher shield for an ally, talent Siege Mode (Gunner, Blast +1 in the danger zone) |
| **Control and sweep** | the Gunner runs equipment and crowd control, the Dasher sweeps with area hits | Cleave, Grenade, Flare, Harpoon's pin | Group B push and pull, **stun** (Harpoon's pin for a non-boss), Whirlwind, talents Quartermaster (Gunner, equipment draws a card) and Sweep (Dasher, Slash hits one more column) |

New rules this needs beyond Group B: **cover** and **stun**. Both are rules,
not data, so they need the author's yes (Q5).

Group A and B as rewards land like this. Whirlwind goes to Control.
Rally goes to Puppeteer or Escort. Mark Target and Overcharge go to
Bodyguard. Suppress goes to Escort. Second Wind and Flashbang are Neutral.
Shove, Grapple and Smoke go to Control. Patch Up is the heal valve, and any
shape can take it.

## 6. Build order

Each checkpoint is headless first, adds its tests, records its bench row in
`balance.md` (recorded, not chased), and stops for review. UI comes last.

1. **Waves carry.** The chain reading from Q1, the `betweenWaves` rule as
   ruled, versions to `cards-0.6.0` and `cardrun-0.2.0`. The save key drops an
   old save loudly, as it does today.
2. **The basic deck.** Ten cards, the Puppeteer's fifteen into the reward
   pools, the Gunner's pierce off, `minDeck` to 8, replace-on-reward if Q4
   says so.
3. **Group A** into the pools. Data only.
4. **Group B.** Resolvers for push, pull, repair and stealth, their previews,
   the guard bot's evaluation of each, and then the cards.
5. **Shapes.** Talents replace the boss boosts. Cover and stun if ruled,
   the shape cards, shape-aware Town offers.
6. **Enemy scaling.** Per-act HP and veteran scripts, a second boss.
7. **Screens.** Faces for the new cards (a missing art id already draws a
   placeholder), the talent pick, the replace pick, HP carried across waves
   on the strip, a wave arriving without placement.

## 7. Questions for the author

- **Q1. What does "3 encounters" chain?**
  - (a) Each fight node is three waves back to back, HP carried inside it,
    full HP at the next node. **Recommended.** It is the message's "new
    enemies spawn once the last enemy of the prior wave is defeated", it
    reuses the engine's waves, and section 2 says it adds about 2.4 HP of
    pressure per node without the wipe.
  - (b) HP carries across the act's three fights, with the stops in between.
  - (c) Both.
- **Q2. When a wave arrives, do the units stay where they stand?** Recommended:
  yes, no placement phase, the next wave spawns at once. The new wave still
  opens under grace, so a Fast enemy does not hit before you can act. Card
  shield follows R3 as now. A base shield already spent stays spent.
- **Q3. Where does HP come back?** Recommended for (a): full HP at each new
  node, plus Patch Up for inside one. If (b) or (c), a City gets a rest option
  that heals for supplies.
- **Q4. Rewards replace a card instead of adding one?** Recommended: yes,
  section 3.2.
- **Q5. Cover and stun as new rules?** They are what make Bodyguard and
  Control work. Without them those two shapes are thin.
