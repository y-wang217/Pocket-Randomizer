# Reading a card battle log

For a Claude session that is given a GYMRUN card battle log and asked to read
it, discuss it, or design new scenarios, **without access to the repository**.
Everything needed is on this page. It describes engine `cards-0.2.0`, the
version that wrote the example log below.

Paste this whole file into that session first, then the log.

Contents: what a log is (1), the board (2), the units, cards and enemies (3),
how a round resolves (4), how to decode a log (5), a full worked translation
(6), what that run shows (7), how to write a scenario (8), and the changes
that are coming (9).

---

## 1. What a log is, and what it is not

The sandbox's **Copy log** button gives one JSON object:

```json
{"engineVersion":"cards-0.2.0","seed":"2APXPQJX","encounterId":"test","deckId":"puppeteer","actions":[ ... ]}
```

| field | meaning |
|---|---|
| `engineVersion` | The rules version. A log only replays on the exact version that wrote it. |
| `seed` | Fixes the deck shuffle, every reshuffle, and each enemy's starting step in its script. Nothing else in a battle is random. |
| `encounterId` | The scenario: where everyone starts and which enemies are there. |
| `deckId` | The player's deck. Today there is one, `puppeteer`. |
| `actions` | **Only the player's decisions**, in the order made. |

**The log does not contain the hands, the draws, the enemies' starting steps or
any outcome.** Those are reproduced by replaying the seed through the engine.
So from the log alone you can say *what the player chose*; you cannot say what
else was in hand or how much damage landed. For the full story, the repo has
`npm run cards:narrate -- <log.json>`, which prints a round-by-round account
like section 6. If you are working without the repo, ask for that output.

Enemies never make choices. Their scripts and tie-breaks are fixed rules, so
the seed plus the player's actions determine everything.

---

## 2. The board

Three lanes (rows) by six columns. **Lane 1 is the top lane. Column 1 is the
player's back edge; column 6 is the enemy's.** A tile is written `L{lane}C{col}`,
so `L2C4` is the middle lane, fourth column. In the log it is
`{"lane":2,"col":4}`.

```
            player backline  |  danger zone  |  enemy backline
              C1     C2      |   C3     C4   |   C5     C6
   Lane 1     .      A       |   .      .    |   e0     .
   Lane 2     .      B       |   .      .    |   e1     .
   Lane 3     .      C       |   .      .    |   e2     .
```

That is the starting layout of encounter `test`.

- **Reach.** Player units may stand in C1 to C4. Enemies may stand in C3 to
  C6. The danger zone, C3 and C4, is the only place both can stand.
- **Slash and Blast** cards can only be played from the danger zone. Strike and
  Pierce can be played from anywhere.
- One unit per tile. Nothing moves through another unit, friend or foe.

---

## 3. The pieces

### Units (deck `puppeteer`)

| id | name | HP | base shield | class | slots per turn | ability |
|---|---|---|---|---|---|---|
| `A` | Commander | 1 | 1 | special | 1 | Gains 1 MP at the start of each of its turns, turn 1 included. |
| `B` | Gunner | 2 | 1 | ranged | 2 | The card in B's first slot each turn turns a **Strike into a Pierce**, if B was at full HP when the turn began. Not on Target cards. |
| `C` | Sword dasher | 3 | 2 | melee | 3 | None. |

- **HP** at 0 means the unit **faints**: it leaves the board, and every card it
  owns leaves the battle (neutral cards stay). If all three faint, the battle
  is lost.
- **Base shield** soaks damage once and never comes back.
- **Shield** from cards soaks damage first and **clears at the start of the
  player's next turn**, so it lasts through exactly one enemy phase.
- Damage always comes off **shield, then base shield, then HP**.
- **MP** is per unit. Everyone starts at 0, every living unit gains **+1 at the
  end of each round**, the cap is **5**, and unspent MP carries over.
- **Slots**: how many cards a unit can play per turn. Unused slots do not carry
  over.

### The deck: fifteen cards, `c0` to `c14`

A card's id is its position in this list. **The id is the card's identity for
the whole battle**: it does not change when the deck is shuffled, so `c14` is
always Attack.

| id | card | owner | MP | effect |
|---|---|---|---|---|
| `c0` | Call Medic | A | 1 | Shield 1 on an ally (any living unit, A included). |
| `c1` | Command | A | 1 | Another unit moves 1 tile. Uses A's slot **and** one of the ally's slots, none of the ally's MP. |
| `c2` | Focus | A | 1 | +1 MP at the start of each of A's next 2 turns. |
| `c3` | Moon Strike | A | 4 | Strike 2 on a chosen enemy, any range, any lane. |
| `c4` | Shoot | B | 0 | Strike 1. |
| `c5` | Resupply | B | 1 | +2 MP to B, usable next turn. |
| `c6` | Artillery | B | 4 | Blast 2 centred on a chosen enemy. Danger zone only. |
| `c7` | Fire! | B | 1 | Blast 1 on a chosen tile. Danger zone only. |
| `c8` | Dash | C | 1 | Move up to 2. |
| `c9` | Slash | C | 1 | Slash 1. Danger zone only. |
| `c10` | Need Help | C | 1 | Next hand gets 1 extra card, one not owned by C. |
| `c11` | Prep | C | 1 | Shield 2 on self. **Once per battle.** |
| `c12` | Move | neutral | 0 | Move 1. |
| `c13` | Dig In | neutral | 0 | Shield 1 on self. **Once per battle.** |
| `c14` | Attack | neutral | 1 | Strike 1. |

- A card can only be played by its owner. A **neutral** card can be played by
  any unit, which pays its MP and uses its slot. The log's `unit` field says who.
- Once-per-battle cards leave the game after use. Others go to the discard pile.
- Hand size is **5**. Unplayed cards are discarded at the end of the round, and
  a fresh 5 are drawn. When the draw pile runs out, the discard pile is
  shuffled back in.

### Damage keywords (player side)

| keyword | what it hits |
|---|---|
| **Strike** | The first enemy in the unit's lane, counted from the player's side. Any distance. |
| **Pierce** | Every enemy in the unit's lane. |
| **Slash** | The three tiles of the next column toward the enemy: the unit's lane and the lanes above and below. |
| **Blast** | A centre tile plus its four orthogonal neighbours. Without Target, the centre is any tile in the next two columns. |
| **Target** | The card hits the chosen enemy wherever it is (a Blast centres on it). |

A damage card is only playable if it would hit at least one enemy right now.
There is no friendly fire.

### Enemies

| id in log | type | HP | base shield |
|---|---|---|---|
| `e0`, `e1`, ... | numbered in spawn order; spawn order is also the order they act and move in | | |
| | **Drone** | 3 | 1 |
| | **Lancer** | 2 | 0 |

Each enemy runs a fixed **script**, one step per round, looping. **Which step it
starts on is rolled from the seed**, per enemy.

**Drone**, 6 steps:

| step | move | then act |
|---|---|---|
| 1 | hunt | Strike 1 |
| 2 | advance | nothing |
| 3 | if *slash in range*: stay, else hunt | if *slash in range*: Slash 1, else Strike 1 |
| 4 | stay | Shield 1 on self |
| 5 | hunt | Strike 1 |
| 6 | advance | nothing |

**Lancer**, 3 steps:

| step | move | then act |
|---|---|---|
| 1 | stay | Shield 1 on self |
| 2 | hunt | nothing |
| 3 | stay | Pierce 1 |

The vocabulary those scripts use:

- **hunt**: slide up or down its own column to a lane that holds a player unit,
  only through empty tiles. Prefers the nearest lane (its own lane counts as
  distance 0), then the lane whose front unit has the lowest HP, then the upper
  lane. With no reachable lane it stays.
- **advance**: one column toward the player, never past C3. Waits if blocked.
- **slash in range**: the enemy is in C3 or C4 and a player unit is on its
  slash tiles.
- **Enemy Strike** hits the player unit **furthest forward** in that lane (the
  one nearest the enemy). A unit in front shelters the ones behind it.
- **Enemy Pierce** hits every unit in the lane.
- **Enemy Slash** hits the next column toward the player, its lane and both
  neighbours.
- **Enemy Shield** clears when that enemy next acts.

---

## 4. How a round resolves

During planning the player sees every enemy's **telegraph**: what it will do and
which tiles it will hit. Then:

1. **The player's cards resolve in the order they were selected.** Moves
   included. Moving first and then attacking, or attacking and then moving, is
   the player's call and part of the strategy.
2. A card whose target has gone (already killed by an earlier card) **fizzles**;
   its MP is still spent.
3. **Win check.** If every enemy is dead, the battle ends here and no enemy acts.
4. **MP**: every living unit gains 1 (cap 5).
5. **Enemies act**, in spawn order, on the tiles they telegraphed, **against the
   board as it stands now**. A unit that moved off the lit tiles is missed; a
   unit that moved onto them can be hit instead. That is how a tank intercepts a
   Strike meant for someone behind it.
6. **Enemies move**: each advances one step in its script and performs that
   step's move.
7. **Enemies telegraph** the new step's act. This is what the player sees next
   round.
8. **Next round**: player shields clear, A gets its +1 MP, Focus pays out, the
   hand is discarded, five cards are drawn, Need Help's extra card is added.

At battle start, steps 6 to 8 run once on each enemy's rolled step, so round 1
opens with every intent already lit. A battle still going after round 30 is a
loss.

---

## 5. Decoding the actions

There are three action types.

```json
{"type":"select","card":"c8","unit":"C","choice":{"tile":{"lane":2,"col":3}}}
{"type":"unselect","planIndex":0}
{"type":"commit"}
```

- **`select`**: put a card into the plan. `card` is the card id (section 3),
  `unit` is who plays it and pays for it, `choice` is what it is aimed at.
- **`unselect`**: take a planned card back out. `planIndex` is zero-based.
- **`commit`**: End Turn. The plan resolves.

**Split the actions on `commit`.** Everything up to the first commit is round
1's plan, up to the second is round 2's, and so on. The order of the selects
(after any unselects) is the order the cards resolved.

What `choice` holds, by card:

| card | `choice` | read as |
|---|---|---|
| Move, Dash | `{"tile":...}` | where the unit moves to |
| Fire! | `{"tile":...}` | the Blast's centre |
| Moon Strike, Artillery | `{"unit":"e2"}` | the enemy targeted |
| Call Medic | `{"unit":"B"}` | the ally shielded |
| Command | `{"unit":"C","tile":...}` | which ally moves, and where to |
| everything else | absent | no choice needed |

So `{"type":"select","card":"c1","unit":"A","choice":{"unit":"C","tile":{"lane":2,"col":4}}}`
reads: *A plays Command, moving C to L2C4.*

---

## 6. Worked example: seed `2APXPQJX`, encounter `test`, a win on round 9

### The short form: decisions only

This is everything the log itself says.

| round | plan, in resolution order |
|---|---|
| 1 | B Shoot · A Attack |
| 2 | C Dash to L2C3 · A Command, C to L2C4 · B Resupply |
| 3 | C Slash · A Dig In |
| 4 | B Attack · A Focus · C Prep |
| 5 | A Moon Strike on e0 · C Dash to L1C3 |
| 6 | A Call Medic on B · C Need Help |
| 7 | C Slash · B Attack · B Shoot · A Moon Strike on e2 |
| 8 | A Command, C to L1C4 · C Dash to L3C4 |
| 9 | A Attack — **won** |

### The full form: replayed

The output of `npm run cards:narrate` on this log. *Telegraphs* is what each
enemy will do at the end of that round.

```
seed 2APXPQJX  encounter test  deck puppeteer  engine cards-0.2.0
enemy starting steps (rolled from the seed): e0 step 3 of 6, e1 step 3 of 3, e2 step 5 of 6

ROUND 1
  A Commander at L1C2  HP 1/1  base shield 1  MP 1
  B Gunner at L2C2  HP 2/2  base shield 1  MP 0
  C Sword dasher at L3C2  HP 3/3  base shield 2  MP 0
  e0 Drone at L1C5  HP 3  base shield 1  telegraphs: Strike 1 on L1C4 L1C3 L1C2 L1C1
  e1 Lancer at L2C5  HP 2  base shield 0  telegraphs: Pierce 1 on L2C4 L2C3 L2C2 L2C1
  e2 Drone at L3C5  HP 3  base shield 1  telegraphs: Strike 1 on L3C4 L3C3 L3C2 L3C1
  hand: c4 Shoot, c14 Attack, c11 Prep, c7 Fire!, c0 Call Medic
  plan, in the order it resolves:
  1. c4 Shoot by B Gunner
  2. c14 Attack by A Commander
  what happened:
    B Gunner plays c4 Shoot
      Gunner ability: the Strike becomes a Pierce
      e1 Lancer takes 1: HP -1
    A Commander plays c14 Attack
      e0 Drone takes 1: base shield -1
    e0 Drone acts: strike 1
      A Commander takes 1: base shield -1
    e1 Lancer acts: pierce 1
      B Gunner takes 1: base shield -1
    e2 Drone acts: strike 1
      C Sword dasher takes 1: base shield -1
    e2 Drone advances L3C5 -> L3C4

ROUND 2
  A Commander at L1C2  HP 1/1  base shield 0  MP 2
  B Gunner at L2C2  HP 2/2  base shield 0  MP 1
  C Sword dasher at L3C2  HP 3/3  base shield 1  MP 1
  e0 Drone at L1C5  HP 3  base shield 0  telegraphs: Shield 1 (self)
  e1 Lancer at L2C5  HP 1  base shield 0  telegraphs: Shield 1 (self)
  e2 Drone at L3C4  HP 3  base shield 1  telegraphs: waits
  hand: c10 Need Help, c8 Dash, c12 Move, c5 Resupply, c1 Command
  plan, in the order it resolves:
  1. c8 Dash by C Sword dasher -> L2C3
  2. c1 Command by A Commander -> moves C Sword dasher to L2C4
  3. c5 Resupply by B Gunner
  what happened:
    C Sword dasher plays c8 Dash
      C Sword dasher moves L3C2 -> L2C3
    A Commander plays c1 Command
      C Sword dasher moves L2C3 -> L2C4
    B Gunner plays c5 Resupply
      B Gunner +2 MP
    e0 Drone shields itself
    e1 Lancer shields itself
    e2 Drone stays put (no lane to hunt into)

ROUND 3
  A Commander at L1C2  HP 1/1  base shield 0  MP 3
  B Gunner at L2C2  HP 2/2  base shield 0  MP 3
  C Sword dasher at L2C4  HP 3/3  base shield 1  MP 1
  e0 Drone at L1C5  HP 3  base shield 0  shield 1  telegraphs: Strike 1 on L1C4 L1C3 L1C2 L1C1
  e1 Lancer at L2C5  HP 1  base shield 0  shield 1  telegraphs: waits
  e2 Drone at L3C4  HP 3  base shield 1  telegraphs: Strike 1 on L3C4 L3C3 L3C2 L3C1
  hand: c3 Moon Strike, c9 Slash, c6 Artillery, c2 Focus, c13 Dig In
  plan, in the order it resolves:
  1. c9 Slash by C Sword dasher
  2. c13 Dig In by A Commander
  what happened:
    C Sword dasher plays c9 Slash
      e0 Drone takes 1: shield -1
      e1 Lancer takes 1: shield -1
    A Commander plays c13 Dig In
      A Commander gains shield 1
    e0 Drone acts: strike 1
      A Commander takes 1: shield -1
    e2 Drone acts: strike 1
      misses: nobody on the lit tiles
    e0 Drone advances L1C5 -> L1C4
    e2 Drone advances L3C4 -> L3C3
    (discard pile shuffled back into the draw pile)

ROUND 4
  A Commander at L1C2  HP 1/1  base shield 0  MP 5
  B Gunner at L2C2  HP 2/2  base shield 0  MP 4
  C Sword dasher at L2C4  HP 3/3  base shield 1  MP 1
  e0 Drone at L1C4  HP 3  base shield 0  telegraphs: waits
  e1 Lancer at L2C5  HP 1  base shield 0  telegraphs: Pierce 1 on L2C4 L2C3 L2C2 L2C1
  e2 Drone at L3C3  HP 3  base shield 1  telegraphs: waits
  hand: c11 Prep, c2 Focus, c6 Artillery, c5 Resupply, c14 Attack
  plan, in the order it resolves:
  1. c14 Attack by B Gunner
  2. c2 Focus by A Commander
  3. c11 Prep by C Sword dasher
  what happened:
    B Gunner plays c14 Attack
      Gunner ability: the Strike becomes a Pierce
      e1 Lancer takes 1: HP -1
      e1 Lancer is defeated
    A Commander plays c2 Focus
    C Sword dasher plays c11 Prep
      C Sword dasher gains shield 2

ROUND 5
  A Commander at L1C2  HP 1/1  base shield 0  MP 5
  B Gunner at L2C2  HP 2/2  base shield 0  MP 4
  C Sword dasher at L2C4  HP 3/3  base shield 1  MP 1
  e0 Drone at L1C4  HP 3  base shield 0  telegraphs: Strike 1 on L1C4 L1C3 L1C2 L1C1
  e2 Drone at L3C3  HP 3  base shield 1  telegraphs: Slash 1 on L2C2 L3C2
  hand: c1 Command, c9 Slash, c8 Dash, c4 Shoot, c3 Moon Strike
  plan, in the order it resolves:
  1. c3 Moon Strike by A Commander -> on e0 Drone
  2. c8 Dash by C Sword dasher -> L1C3
  what happened:
    A Commander plays c3 Moon Strike
      e0 Drone takes 2: HP -2
    C Sword dasher plays c8 Dash
      C Sword dasher moves L2C4 -> L1C3
    e0 Drone acts: strike 1
      C Sword dasher takes 1: base shield -1
    e2 Drone acts: slash 1
      B Gunner takes 1: HP -1
    e0 Drone stays put (blocked)
    (discard pile shuffled back into the draw pile)

ROUND 6
  A Commander at L1C2  HP 1/1  base shield 0  MP 4
  B Gunner at L2C2  HP 1/2  base shield 0  MP 5
  C Sword dasher at L1C3  HP 3/3  base shield 0  MP 1
  e0 Drone at L1C4  HP 1  base shield 0  telegraphs: waits
  e2 Drone at L3C3  HP 3  base shield 1  telegraphs: Shield 1 (self)
  hand: c0 Call Medic, c10 Need Help, c12 Move, c7 Fire!, c2 Focus
  plan, in the order it resolves:
  1. c0 Call Medic by A Commander -> on B Gunner
  2. c10 Need Help by C Sword dasher
  what happened:
    A Commander plays c0 Call Medic
      B Gunner gains shield 1
    C Sword dasher plays c10 Need Help
      next hand gets +1 card not owned by this unit
    e2 Drone shields itself
    e2 Drone hunts L3C3 -> L2C3
    (Need Help: extra card c1 Command)

ROUND 7
  A Commander at L1C2  HP 1/1  base shield 0  MP 5
  B Gunner at L2C2  HP 1/2  base shield 0  MP 5
  C Sword dasher at L1C3  HP 3/3  base shield 0  MP 1
  e0 Drone at L1C4  HP 1  base shield 0  telegraphs: Slash 1 on L1C3 L2C3
  e2 Drone at L2C3  HP 3  base shield 1  shield 1  telegraphs: Strike 1 on L2C4 L2C3 L2C2 L2C1
  hand: c5 Resupply, c9 Slash, c4 Shoot, c3 Moon Strike, c14 Attack, c1 Command
  plan, in the order it resolves:
  1. c9 Slash by C Sword dasher
  2. c14 Attack by B Gunner
  3. c4 Shoot by B Gunner
  4. c3 Moon Strike by A Commander -> on e2 Drone
  what happened:
    C Sword dasher plays c9 Slash
      e0 Drone takes 1: HP -1
      e0 Drone is defeated
    B Gunner plays c14 Attack
      e2 Drone takes 1: shield -1
    B Gunner plays c4 Shoot
      e2 Drone takes 1: base shield -1
    A Commander plays c3 Moon Strike
      e2 Drone takes 2: HP -2
    e2 Drone acts: strike 1
      B Gunner takes 1: HP -1
      B Gunner FAINTS; its cards leave the battle (c6 c5 c7 c4)
    e2 Drone stays put (at its advance limit)
    (discard pile shuffled back into the draw pile)

ROUND 8
  A Commander at L1C2  HP 1/1  base shield 0  MP 3
  B Gunner: fainted
  C Sword dasher at L1C3  HP 3/3  base shield 0  MP 1
  e2 Drone at L2C3  HP 1  base shield 0  telegraphs: waits
  hand: c8 Dash, c0 Call Medic, c1 Command, c10 Need Help, c9 Slash
  plan, in the order it resolves:
  1. c1 Command by A Commander -> moves C Sword dasher to L1C4
  2. c8 Dash by C Sword dasher -> L3C4
  what happened:
    A Commander plays c1 Command
      C Sword dasher moves L1C3 -> L1C4
    C Sword dasher plays c8 Dash
      C Sword dasher moves L1C4 -> L3C4
    e2 Drone hunts L2C3 -> L1C3
    (discard pile shuffled back into the draw pile)

ROUND 9
  A Commander at L1C2  HP 1/1  base shield 0  MP 4
  B Gunner: fainted
  C Sword dasher at L3C4  HP 3/3  base shield 0  MP 1
  e2 Drone at L1C3  HP 1  base shield 0  telegraphs: Strike 1 on L1C4 L1C3 L1C2 L1C1
  hand: c14 Attack, c12 Move, c2 Focus, c3 Moon Strike, c10 Need Help
  plan, in the order it resolves:
  1. c14 Attack by A Commander
  what happened:
    A Commander plays c14 Attack
      e2 Drone takes 1: HP -1
      e2 Drone is defeated
    WON

card engine cards-0.2.0  seed 2APXPQJX  encounter test
outcome            won on round 9
danger zone rounds A 0, B 0, C 8
telegraphs         1 dodged, 7 taken
cards per round    2 3 2 3 2 2 4 2 1
no-choice rounds   none
Moon Strike casts  rounds 5 7
neutrals by unit   A 3, B 2, C 0
```

Two things in that output that are easy to misread:

- Round 2's Command moves C again *after* C's own Dash, because it was selected
  second. In the other order Command would move C one tile from L3C2, and
  L2C4 would not have been a legal choice.
- In round 7 the hand has six cards: five drawn plus Need Help's extra.

---

## 7. What this run shows

Readings of the replay, not rules. Useful for scenario design and for a bot.

- **Interception works and decided the fight.** Round 5: C dashed into L1C3,
  in front of A (1 HP, no shields left), and took e0's Strike on its base
  shield. An enemy Strike hits the furthest-forward unit in the lane.
- **Leaving a lane dodges.** Round 2's Dash took C out of lane 3; e2 then had
  no lane it could reach (its column was blocked) and its round 3 Strike on
  lane 3 hit nobody.
- **Hunting can be steered.** Round 8: C stepped out of L1C3, which unblocked
  e2's path into lane 1, and e2 hunted toward the lowest-HP front unit, A.
  That pulled it into A's lane, where A's Attack finished it in round 9. It
  worked because A got to act first; e2's Strike was aimed at A.
- **The one loss of a unit.** Round 7: B stood at 1 HP, no shield, in lane 2,
  where e2 had telegraphed a Strike. B attacked instead of being covered, and
  fainted, taking four cards out of the battle with it.
- **Value left on the table.** Round 4's Focus was played with A already at
  the 5 MP cap, so the first of its two +1s was lost. Round 6's Call Medic
  shielded B in a round when nothing attacked B. Round 3's Slash only stripped
  the shields the enemies had just put up.
- **Round 1 cost every base shield.** All three telegraphs landed and every
  unit lost its base shield on turn one; nobody had MP for anything else.
- C spent eight of nine rounds in the danger zone; A and B never entered it.

---

## 8. Writing a scenario

A scenario today is one **encounter**: a deck, where each unit starts, and
which enemies start where. Spawn order matters: it sets the enemy ids (`e0`,
`e1`, ...) and the order they act and move in. The seed then decides each
enemy's starting step and the shuffle.

Please write scenarios in this shape, so they go straight into the engine:

```
Scenario: <short name, becomes its id>
Idea: <one or two lines: what it tests, what makes it hard>
Deck: puppeteer
Units: A L1C2, B L2C2, C L3C2          <- or "placed by the player in the home area", see section 9
Enemies, in spawn order: drone L1C5, lancer L2C6, drone L3C4
New enemy types, if any:
  <name>: HP <n>, base shield <n>
  steps: 1. <move> / <act>   2. ...
What a good line looks like: <optional, how you expect it to be beaten>
```

What the engine can do without new code:

- Any number of Drones and Lancers anywhere enemies can stand, one per tile.
- **New enemy types**, as long as they are built from the script vocabulary in
  section 3: moves `stay`, `hunt`, `advance`, and acts `nothing`,
  `Strike n`, `Pierce n`, `Slash n`, `Shield n`, with `if slash in range`
  as the only condition. HP and base shield are free numbers.
- Any starting tiles for the three units inside the player's reach.

What would need new engine work (still fine to propose, just mark it as new):

- An enemy Blast, a heal, a summon, a push or pull, stealth, a new condition
  (for example *if hurt*), anything that is not in the vocabulary above.
- Win conditions other than *defeat every enemy*: survive N rounds, protect a
  unit, reach a tile.
- Enemies that arrive mid-battle.
- A different deck or different units.

Difficulty levers worth knowing:

- Enemies in C3 and C4 can Slash; enemies further back cannot.
- Lancers Pierce whole lanes, so stacking units in one lane is punished.
- A Drone two lanes away from every unit, behind a blocker, cannot hunt.
- A has 1 HP. Anything that reaches A early is a real threat.
- Starting steps are rolled, so a scenario plays differently per seed. If a
  scenario only works with a particular opening, say so.

---

## 9. Changes coming, not built yet

The author has asked for these. **None is in engine `cards-0.2.0`.** Their exact
shape is still being decided, so a scenario written now should say which of
them it assumes.

- **Placing units.** The player will place their units anywhere in the home
  area (the player backline) before round 1, instead of a fixed start.
- **A wider danger zone.** The middle zone grows to three columns, so it is
  harder to cross. How the board grows to fit it is open.
- **Varied enemy spawns.** Enemies will not always start one per lane in the
  same column; each scenario sets its own spawn.
- **A bot** that plays scenarios competently with a defensive style (cover
  fragile units with high-HP and shielded ones, keep every unit alive), and
  that improves its positioning by playing many times and keeping what wins.

When these land, the engine version changes and older logs stop replaying, by
design. This page will be updated with them.
