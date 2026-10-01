# GYMRUN playloop diagnosis

**2026-10-01.** The report the research prompt
[`../spec/gymrun-research-playloop-diagnosis.md`](../spec/gymrun-research-playloop-diagnosis.md)
asked for. A mechanical diagnosis of the loop as it is played, not as it was
designed. Nothing here is implemented; section 8 is hypotheses, not a plan.

Tree: `contentHash` `715122`, `RANDOMIZER_VERSION` `gymrun-randomizer-22`,
`AI_VERSION` `gymrun-ai-7-tiers-reach-the-app`, `RUN_LOG_VERSION`
`gymrun-run-21`. Every number below is either read off the code, taken from
the pinned benchmark `sim-reports/benchmarks/2026-09-25T03-27-14-445Z-gymrun-randomizer-22-400.json`
(400 seeds, prefix `RETUNE`, `--ai table`, greedy player, nodes `rest`), or
produced in this session by playing runs headless through `playRun` with the
scripted baseline policy. Where a number is this session's, it says so, and it
is a smaller sample than the benchmark. Read down a prefix, never across.

## 0. The verdict in one paragraph

GYMRUN has stable rules, genuinely variable situations and a short re-entry.
What it mostly lacks is the middle of the cycle: the systems that vary do not
yet *interact* with the decisions the player makes, so variation arrives as
different opponents rather than as different problems, and the rewards that
arrive are almost all numeric. The run's identity is its party and nothing
else. Death is informative at the level of "a Water gym beat a Ground lead"
and uninformative at the level the rules are actually written at, because
every ability and move on every Pokemon is rolled off-species, so the thing a
Pokemon player already knows is wrong more often than it is right. The strongest
part of the loop is the capture offer, and it is strong for exactly the reason
the rest is weak: it is the one reward that changes what the next ten decisions
are about.

## 1. The real loop

### 1.1 State machine

```
SEED
  └─ STARTER        pick 1 of 3 (species, ability, 4 moves, all rolled; L15; no reroll)
        │
  ┌─────▼──────────────────────────────── SEGMENT s (s = 0..7) ──────────────┐
  │  LOCALE         pick 1 of 2–3 (fixes the wild type pool for this segment) │
  │  STEP 0..n      n = 4–5 / 5–6 / 6–7 by phase; each step = pick 1 of 2–3   │
  │    │            options of distinct kinds; tiers and payout shown,        │
  │    │            species hidden                                            │
  │    ├─ wild      battle (party vs 1–6 wild, AI easy) → win: capture offer  │
  │    │            of the lead you just beat (accept / decline / release)    │
  │    │            → 1 of 3 reward cards (no skip)                           │
  │    ├─ trainer   battle (AI medium, hard/elite tier → hard) → 1 of 3 cards  │
  │    ├─ rest      full HP, full PP, status cleared, any banked TM teachable  │
  │    ├─ shop      buy any subset of 5–6 shelf slots (TM, technique, berry,  │
  │    │            heal, item, relic from seg 3)                             │
  │    └─ event     pick safe / gamble / toll / attune(if relic); outcome tier │
  │                 pre-drawn, selected by the run's capability band          │
  │    every boundary: ITEM PLAN (holders, discards, teach banked TMs)         │
  │    every boundary: status cleared, fainted revived at 50%                  │
  │  LEAD           pick who leads the gym (a persistent reorder)              │
  │  GYM            vs capacity(s) Pokemon of the gym's type, AI hard          │
  │    ├─ loss or draw ─────────────────────────────────────────► RUN OVER     │
  │    └─ win: full heal → party level set to L(s+1) → evolutions (fork =      │
  │            choice) → 3 tutor cards (1 of 3) → 3 gym cards (1 of 3)        │
  │            → party capacity grows on schedule [2,3,3,4,4,5,5,6]            │
  └───────────────────────────────────────────────────────────────────────────┘
  any node where every member faints ────────────────────────────► RUN OVER
  gym 8 won ─────────────────────────────────────────────────────► VICTORY
  RUN OVER → summary (score, cause of death, graveyard) → new seed → STARTER
```

Twelve decision kinds exist in the run log (`src/core/types.ts:720-877`):
starter, locale, node, battle (move or switch), reward, shop, event,
acquisition, items, lead, party edit, evolve. There is no in-battle item use,
no flee, no catch command, no XP, no grinding, no reroll, no skip. Everything
the map contains is drawn at `createRun` and nothing is drawn later.

### 1.2 Each stage as the player meets it

| stage | PLAYER STATE | CHOICE | CONSEQUENCE | NEW INFORMATION | REWARD | NEXT CHOICE |
|---|---|---|---|---|---|---|
| Starter | nothing | 1 of 3 kits | the only member for 1–3 nodes; its type sets the latent capability band for the whole first segment | the three kits are fully readable: stats, moves, ability | the Pokemon | locale |
| Locale | 1 member, 0 coins | 1 of 2–3 named regions | which four types the segment's wild captures and wild opponents draw from; nothing else (not difficulty, not payout) | the region's four types; its three possible events | none | step 0 |
| Step | party, HP fractions, bag, coins | 1 of 2–3 nodes of distinct kinds; tier, payout, AI tier and capability requirement visible; species hidden | commits to one battle, rest, shop or event | the opponent's species, ability, item and moves, only once inside | per node | next step |
| Wild battle | the party, as it is | move or switch, each turn | HP/PP spent; faints cost half a bar at the next node, nothing more | the opponent's kit, revealed on sight | coins (8 × tier × scale), capture offer, 1 of 3 cards | item plan |
| Capture | party vs capacity | decline / accept / release a member | a new member at party level, kit exactly as fought; a released member is gone and its item returns | none beyond the fight you just watched | the Pokemon | the card |
| Trainer battle | as wild | as wild, against a smarter bot | as wild | as wild | coins (14 × …), 1 of 3 cards | item plan |
| Reward card | the party | 1 of 3: item, coins, TM, tutor, technique, heal, relic | one of those; a move goes to the bag, not onto a Pokemon | which three were drawn (hidden until the fight is won) | the card | item plan |
| Rest | party, bag of TMs | none at the node; the item plan after it is where TMs can be taught | full heal; the only place besides a shop where a banked TM reaches a Pokemon | none | the heal and the teach window | next step |
| Shop | coins, shelf | any affordable subset | coins → items/TMs/heal/relic; teach window opens | the shelf and prices | what was bought | next step |
| Event | capability band (none / latent / known) | safe, gamble, toll, attune | T0–T3 outcome: HP, coins, berries, items, a move, a Pokemon, a relic | the required capability, the band, the toll's price; outcome tiers by archetype are stable rules | the outcome | next step |
| Item plan | everything held | holders, discards, which TM to whom replacing which slot | held items live in the sim; a replaced move is destroyed | none | none | next step |
| Lead | party vs the gym's type | a party slot | the lead persists into the next segment | the leader's type and team size are visible from run start | none | gym |
| Gym | party at ~90% HP on average | battle | loss ends the run; win heals, levels, evolves, grows capacity | the leader's actual species, abilities, items, moves, only on sight | 2 pages of 3 cards | locale |
| Death | — | — | summary with cause of death and graveyard | which species, which move, where | score | new seed |

### 1.3 Where the loop is strongest and where it is flat

**Strongest:** the wild node. One decision (which wild to walk into, species
hidden) feeds a fight that reveals a kit, which feeds a three-way capture
decision whose cost is explicit (a slot, or a named member), which feeds the
item plan and the lead choice, which feed the gym. It is the only stretch where
every column of the table above is non-empty and every decision changes the
next one.

**Flattest, in order:**

1. **The reward card.** Six kinds, five of them numeric. Measured take on the
   benchmark: tutor 24%, item 23%, relic 17%, currency 16%, TM 11%, heal 9%.
   A card changes the team's shape only when it is a move the player then
   chooses to teach, and the teach is deferred to the next rest or shop.
2. **The locale.** It changes which species the segment can draw and which
   three events can appear. The benchmark's bot picks it uniformly at random,
   every locale is picked at about its offer share (9.8% to 14.9%), and the
   doc's own reading is "the offer is flat" (`balance.md` §10.2). Nothing
   downstream reads the choice except the wild pool.
3. **The item plan.** Asked at every boundary where anything is held, which is
   most of them. Almost every answer is "nothing changes".
4. **The rest node.** The scripted and benchmark bots both take a rest
   whenever one is offered and the benchmark names that policy `rest`. A full
   heal plus full PP plus the teach window, against a wild that pays 8 coins
   and a berry card, is not a decision.

## 2. What is already working, and the mechanic responsible

- **Captures are the game's one transformative reward.** The offer is the
  lead you just fought, kit intact, so the player has already watched it
  work. It costs a slot or a member. The benchmark records 6.0 offers per run
  and 44% taken; parties entering gym 8 carry 5 non-starters of 6 and the
  starter survives to gym 8 in half of them (`balance.md` §10.4, this
  session's 200-seed run: starter still alive 50%). The run is being built,
  not inherited. Mechanic: `acquisition.ts` offering the encounter lead;
  capacity schedule `[2,3,3,4,4,5,5,6]`; release as a logged, permanent edit.
- **Capacity grows with gyms and the gym fields exactly that capacity.** Gym 1
  is 2 v 2, gym 8 is 6 v 6. The gym is always as wide as the player can be and
  never wider, so a thin party is a choice the player made. Mechanic:
  `scaling.ts:1001` reading `partyCapacityAfter`.
- **The gym type is known from the first screen and the lead is a decision in
  front of it.** The rail shows all eight types from run start. Choosing a
  lead against a known type, with the party's types on screen and no verdict
  drawn, is a real matchup decision (`run.ts:1806-1824`). In the TRACE-1 run
  below, the bot led Hoppip (Grass/Flying) into the Water gym and Mantyke's
  Air Slash removed it in two turns; a player would have led Cubone.
- **Capability bands are a quiet emergent chain.** A party member's *type*
  sets the band (`latent`) that selects an event's outcome tier, and a relic
  sets `known`, which unlocks the fourth option. So a Rock capture in segment
  0 improves every Strength and Rock Smash event for the rest of the run
  without anyone announcing it. Benchmark: Attune available at 38.8% of
  events once relics accumulate (`balance.md` §17.2); this session, 17.6%
  on a population that died earlier. Mechanic: `core/capabilities.ts:78-102`.
- **Events have a readable menu and no dominant option.** Toll is taken
  roughly half the time, safe and gamble a fifth each, attune 33–45% when
  shown (`balance.md` §17.3; this session 49 / 25 / 20 / 33%). Toll prices
  are typed (lead HP, party HP, coins, a berry, a bag discard), so which toll
  is cheap depends on the run's state. Mechanic: `eventPools.ts:598-664`,
  the four archetypes with per-band tier draws.
- **The road can kill, and does.** This session, 150 runs under the scripted
  baseline: 81 deaths at a gym, 69 on wild or trainer nodes. The benchmark's
  derived split is 75 road deaths in segment 0 against 49 at Garnet. A wild
  node is not filler.
- **Moves as inventory with a deferred teach window.** A move card is a TM
  in a bag that shares capacity with items; it reaches a Pokemon only at a
  rest, a shop, or the node that paid it, and teaching into four moves
  destroys one. This creates a real holding decision (carry three TMs and
  no berries, or the reverse) and a real replacement decision. Mechanic:
  `run.ts:440-480`, `items.ts:172-184`, `party.ts:398-486`.
- **Battle length ramps.** Mean turns per battle 3.2 in segment 0 to 13.1 in
  segment 7 on the benchmark. Late fights are long enough for status, setup,
  weather and switching to matter mechanically, even if the bots do not use
  them.

## 3. Where the loop becomes weak

### 3.1 Repetitive decisions

- **Item plan at every boundary.** The question is asked whenever anything
  is held. In the TRACE-1 run it was asked after four of the first five
  nodes and three of those answers were "assign one berry to whoever is
  empty".
- **Rest when offered.** See 1.3. A rest is also the only ordinary route to
  teaching a banked TM, which makes it even more dominant: the player who
  took a tutor card at the last trainer *needs* the rest.
- **The three-card reward against a party of one.** In segment 0 the party is
  one or two Pokemon, so "type item for a type you do not have" and "heal at
  full HP" are frequent dead cards; the benchmark bot values both at zero.

### 3.2 Inconsequential RNG

- **Abilities are rolled from the full pool of 310 regardless of species, and
  moves from a learnset-free pool.** This is the single biggest driver of
  "different outcome, same decision". A Cubone with Ice Body, a Maschiff with
  Overgrow, a Finneon with Teravolt (TRACE-1's starters) differ from each
  other by type and stats, which the player can read, and by abilities that
  do nothing for any of them. The ability draw is 310-wide and most of the
  pool is situational or dead on a random holder, so most of the variance it
  adds is noise the player cannot plan around. The same is true of the
  opponent's ability, revealed on sight.
- **Gym moves are off-type coverage at random.** In TRACE-1, Marina's Dewott
  carried Incinerate and killed the player's Pawniard (Dark/Steel) with it.
  The player chose a lead against "Water" and died to Fire. The information
  needed to make the lead decision correctly does not exist before the fight.
- **Gender, nicknames, the shuffled relic order, the shop's extra slot** are
  pure texture.

### 3.3 Obvious dominant choices

- Rest over anything (1.3).
- Toll at events with coins in hand: a known price for a guaranteed T2.
- Accept every capture while there is room (the scripted baseline does this
  and it is the benchmark's "floor on competent play").
- Lead the member whose type beats the gym type. Correct, and a solved
  problem the moment the player reads the type chart.
- Hold the one good item on the carry. The benchmark measures the top
  member at 65–69% of a run's damage and 60% of runs as a single carry
  (`balance.md` §13.5; this session 68.9% / 60.3%). Items that boost one
  Pokemon go on that one.

### 3.4 Rewards that do not alter strategy

Of the seven reward kinds, five are "+N": currency, heal, type item (×1.2 on
one type), modest and good items, and most berries. The relics are nine
passives of the shape "+4 coins per node", "heal 4% per node", "+1 bag slot",
"revive at 65% instead of 50%", "12% shop discount", plus one capability
each. None of them changes how a fight is played or which Pokemon is worth
catching. The relic's one strategic effect is the capability band on events,
which is real but small (an event pays T2 instead of T1, about 1.2 to 3.3
times a run).

The two rewards that do alter strategy are a Pokemon (captures, event T2/T3)
and a move the player then teaches. A move alters strategy only to the extent
the player can see what it does for the recipient, and the recipient is
chosen later, at a rest.

### 3.5 Weak reward cadence

- **Encounter to encounter:** a card every battle, a capture offer every wild.
  Dense. Mostly numeric.
- **Gym to gym:** full heal, +5 to +8 levels for the whole party, possible
  evolutions, two card pages, a bigger party cap. This is the strong beat,
  and it is also a full reset of HP, PP and status. Every segment starts the
  same way: full party, fresh bar.
- **Whole run:** the party. Nothing else accumulates in a way the player
  feels: relics are small, coins are spent, levels are a table.
- **Across runs:** nothing. `storage.ts:5-6` says "Unlocks and run history
  are later stages' problems". The spec's Stage 5 (unlocks, daily seed,
  history) is unbuilt. `getStarterPool(unlocked)` exists and `LOCKED` is
  empty.

The longest stretch without a strategic change is inside a segment: from the
locale pick to the lead pick, the party's composition changes only if a wild
capture is accepted, the moveset changes only at a rest or shop, and the held
items change only through the plan. On the benchmark a segment is 4 to 7
nodes and the party changes on fewer than half of them.

### 3.6 Failure that teaches little

A death screen names the segment, the killer species, the killing move, and
the score. From that the player can learn:

- that the party was too thin or too low on HP (true in most road deaths);
- that the lead was the wrong type (true in a visible fraction of gym deaths);
- that gym N's type is X (already known from the rail).

What the player cannot learn, because it is not stable: that species X does
Y, that a gym leader's Pokemon will carry move Z, that an ability will be on a
holder it suits. Every one of those facts is rerolled per seed. The rules that
*are* stable (the type chart, the level table, the capacity schedule, the
event tier rules, the AI tier labels) are the ones the game does not teach
through failure, because they are not what killed you.

The benchmark's gym 3 (Electric) is the highest-killing gym node at 54 of
400, and Garnet's segment the highest-killing segment overall at 124, 75 of
them on the road with a party of one or two. A death in the first four nodes
with a single starter is 20–30% of all runs on this session's sample. That
death teaches "the first segment is a coin flip until you catch something",
which is not a strategic lesson.

### 3.7 Runs that converge

The scripted baseline, the benchmark bot and a competent human all converge
on the same shape: catch the first two things offered, rest when you can,
put the type item on the carry, lead by type at the gym, buy heals. There is
no build to pursue because there is no build-defining reward. Two runs differ
by which species were caught; they do not differ in *what the player was
trying to do*.

## 4. Existing emergent interactions, with examples seen this session

- **Weather ability + Weather Ball.** TRACE-4's capture offer was a Cranidos
  with Drizzle and Weather Ball: it sets rain on entry and Weather Ball
  becomes a 100-power Water move. That is a kit a player would recognise and
  catch for. It exists because abilities and moves are both rolled and the
  sim honours both.
- **Acrobatics + a held item.** TRACE-1's default item plan put Mystic Water
  on Hoppip, whose only strong move was Acrobatics, which halves in power
  when the holder has an item. A real anti-synergy a player can avoid and
  the plan's default walks into.
- **Party type → capability band → event tier.** Described in section 2. A
  Rock capture makes Strength and Rock Smash events pay better for the rest
  of the run; a Water capture does the same for Surf, Waterfall and Dive.
- **A capture's type → the gym lead.** A Ground capture in the Cave of
  segment 0 is also the answer to Volta in segment 2.
- **Berry + weakness.** A Passho Berry on a Rock lead against Marina is one
  free turn, and it was eaten in TRACE-1's gym 2 to no effect because the
  holder was already dead to Incinerate.
- **Choice items + a locked slot + switching.** Present in the data; the sim
  honours the lock; the benchmark measures voluntary switching as worth
  nothing (`balance.md` §7.6), so the interaction is live and unused.
- **Priority + speed + the KO.** The AI's priority layer fires on 4.4% of
  decided turns (this session). Accelerock, Jet Punch and Water Shuriken are
  among the top killing moves on both populations.
- **Evolution forks as a real choice.** Poliwhirl, Kirlia, Slowpoke, Snorunt,
  Eevee and others ask the player to pick a branch at a gym clear, in dex
  order, keeping the moveset. The moveset was rolled for the base form, so
  a Kirlia with Psychic moves evolving into Gallade is a mismatch the
  player sees coming.

## 5. Missing interaction opportunities, using systems already in the tree

Each of these is a seam that exists in `core/` or `data/` and is not read by
anything that would make it matter.

- **The locale is read by exactly one consumer (the wild pool).** The route's
  events are drawn from the locale's three, but nothing about the gym, the
  trainers, the shop shelf or the field (weather, terrain) depends on it. A
  locale that set a default weather for its fights, or weighted its shop,
  would make the pick a decision. `data/locales.ts:67-76` already carries a
  type set per locale; `BattleFacts` already carries weather and terrain.
- **Abilities are known to the sim and to the display, not to the draw.** The
  randomizer picks an ability uniformly from all 310 for every Pokemon.
  `data/abilityEffects.ts` already classifies abilities for the type badge.
  Nothing weights the draw toward abilities a holder's types or moves can
  use, so the Drizzle + Weather Ball kit is a lottery, not a thing the
  locale or tier makes more likely.
- **Moves are rolled without learnsets and without reading the holder's
  stats.** `archetype.ts` already computes physical vs special from base
  stats; the moveset roller does not read it, so a Special Attacker rolls
  physical STAB half the time. Reading it would make "this species is a
  special attacker" a stable, learnable fact again.
- **Trainers have no identity.** A trainer node is a wild team with a better
  bot and twice the payout; its species draw admits anything. The gym
  mechanism (a type filter plus allow/deny lists, `gyms.ts:19-46`) already
  exists and could give a trainer a theme the player could read on the card.
- **Status moves are 55% of last slots and the AI is only `hpAware`.** The
  sim has every status, screen and hazard; the opponent's scorer rates them
  only through damage, and the player's bots never use them. Stealth Rock
  appears once in this session's indirect-death table. The mechanic is
  wired and no decision depends on it.
- **Switching is live and worthless.** `balance.md` §7.6 and §16.2 measure
  it; the stated binding constraint is that the opponent always fields at
  least as many Pokemon as the player, so a switch to answer a matchup is
  answered back. The capacity schedule is the lever that exists.
- **Relics grant capabilities, capabilities gate only events.** The
  `requires` field exists on an event; nothing on a node, a route or a shop
  reads a capability. `generation.md` and the relics prompt call these HM
  gates and no HM gate is on the map.
- **The graveyard records every faint with killer and move** and nothing
  reads it back into the run or across runs.
- **`coverage.ts` computes the set of types the party hits super-effectively**
  and is used only to draw a strip; no reward, shop or event reads the gap.
- **Evolution is level-only, at gym clears.** Items, trades and friendship are
  all synthetic levels. A stone in the shop or an event that evolves a
  member now, mid-segment, is a reward that would change the next five
  fights and the data for it (`evolutionThresholds.ts` method table) already
  distinguishes the methods.

## 6. Run identity

Two runs are strategically different today only through the party. What
diverges them, in order of effect:

1. **Which wild leads were offered and taken.** The locale sets the type pool;
   the offer is the fought lead. This is the whole of build.
2. **The starter's type**, which decides the first two gyms and the latent
   band for segment 0.
3. **Which moves were banked and taught**, which is real but invisible: the
   benchmark's "ramp" row shows the party's move bands climbing 1.15 to 4.0
   across gyms, which is power, not shape.
4. **Which relics were held**, which is coins, heal and one event option.

What does *not* diverge runs: the level table (identical every seed), the gym
order and types (identical), the capacity schedule (identical), the shop
categories (identical), the item set (38 items, same every run, all
numeric), the event rules (same four archetypes with the same tier odds).

So the honest answer to "has this run become something" is: it has become
*these six Pokemon*, and nothing about the run's rules, route or economy
became anything. A player will remember a run by a capture, never by a
decision.

## 7. Progression map

| axis | present? | what carries it |
|---|---|---|
| In-run power | yes | the level table (15 → 58, set per segment), the move band ramp through cards and tutors, held items, evolutions at gym clears, party capacity 2 → 6 |
| In-run breadth | partly | captures widen the party's types (mean 3.5 distinct types on the final party); nothing widens the moveset's *roles* |
| Between-run unlocks | no | `LOCKED` is empty; no daily seed; no history |
| Between-run numeric power | no, by design | none, and the seed contract (same seed, same run) argues against it |
| Player knowledge | partly | the type chart, the gym order, the capacity schedule, the tier labels, event archetype rules, the rest-and-teach rule, the carry-plus-berry pattern are all learnable; species knowledge is not, because abilities and movesets are rolled off-species |
| Difficulty / mastery progression | no | one difficulty; the benchmark's greedy bot clears 2.2 gyms in 8 and 3% of runs; the random bot clears 0.32, so skill is measured as real (a 7× gap) but the ceiling is low and there is no ladder above it |

Replayability today is carried almost entirely by in-run power plus the
capture lottery. Between-run progression is absent and player knowledge is
capped by the off-species rolls.

## 8. Design hypotheses

Testable, in the form the prompt asked for. None is a recommendation; each
names the measurement that would decide it.

1. **If abilities were drawn from a holder-aware subset rather than all 310,
   player species knowledge would transfer between runs, because the fact
   "this ability does X on this body" would be stable.** Test: a `--policy`
   that reads abilities against a pinned opponent, before and after; the
   gap between it and `greedy` is the value of the knowledge.
2. **Captures carry the run's identity because they are the only reward with
   a shape; every other reward is a scalar.** Test: run the benchmark with
   captures disabled (`allowEncounterAcquisitions: false`) and compare party
   diversity, and separately with heal and currency cards removed from the
   pools and compare mean gyms; the first should move diversity a lot and
   the second should move almost nothing.
3. **The locale has no strategic consequence because only the wild pool
   reads it.** Test: `--nodes` locale policies (type-covering vs random)
   should produce identical mean gyms today; any change that makes the
   difference measurable has given the locale a consequence.
4. **Rest is dominant because it is a full heal and the only teach window,
   and that keeps attrition from ever binding.** Test: `--set
   restHpFraction=0.5` and a teach window at every node; if mean gyms barely
   move but node choice diversity rises, rest was a forced choice rather
   than a load-bearing one.
5. **The free 50% revive and status clear between nodes remove most of the
   consequence of a faint, which is why switching and preservation do not
   pay.** Test: `--set reviveHpPercent=0.25` and `clearStatusBetweenNodes:
   false` on the switching pair (`--policy switching`); the gap should open
   if the hypothesis holds. `balance.md` §7.6 flagged exactly this and it
   remains untried.
6. **Gym deaths are lead-choice deaths more often than party-strength
   deaths.** Test: `--policy lead-swap` vs `lead-static` by gym; where the
   gap is largest, the gym's kill is the lead decision, and where it is zero,
   the gym kills on numbers.
7. **Segment 0 kills a third of runs because a party of one plays four nodes
   before the first guaranteed capture lands, and that death is not
   decision-bearing.** Test: deaths before the first capture, by node index,
   on the benchmark's log; and the same with `wildStepsPerSegment: 2` for
   segment 0 only.
8. **A reward that changes a fight's rules (a stone, a status TM, a weather
   setter, a hazard) would alter strategy more than any held item in the
   current pool.** Test: tag each reward by "scalar" vs "rule" and measure
   the change in the player's move distribution in the three fights after
   it is taken; scalars should leave the distribution unchanged.
9. **Trainers do not read as a different decision from wilds because the
   only thing that differs is the bot and the payout.** Test: the `--nodes`
   `wild` vs `trainer` policies already exist; today their mean gyms differ
   by less than the sample error, which is the null this hypothesis predicts.
10. **Relics are decoration as a build element because their passives are
    scalars and their one rule effect is gated behind an event roll.**
    Test: `--policy relics` (relic-greedy vs greedy) on mean gyms, and
    separately on Attune-availability; if the first is flat and the second is
    not, the relic's value is entirely the event option.
11. **The move-replacement decision would carry the most build identity of
    any decision if the recipient's stats and ability were read at the
    moment of teaching.** Test: a move policy that teaches by archetype
    (special moves to special attackers) vs `defaultMoveReplacement`, on
    mean gyms and on the ramp row.
12. **Battle length under seven turns makes status, setup and switching
    mechanically irrelevant regardless of AI, so the first three segments
    cannot teach them.** Test: per-segment counts of status moves used and
    boosts applied, from the protocol census already in the tree; if they
    are near zero through segment 2 and rise with turn count, the early
    game's flatness is a length problem before it is a reward problem.

## 9. Method, and what this report did not measure

- Four full runs were traced decision by decision under the scripted
  baseline (`scripts/` was not changed; the trace lived in the session's
  scratch directory), two with the gym battles printed turn by turn.
- 200 seeds were played under `--policy all --prefix RETUNE --ai pinned`
  (greedy 1.55 mean gyms, random 0.32) and 150 under the scripted baseline
  with a rest-first node policy to count deaths by node kind and segment.
  These are smaller than the benchmark and were used for direction, not for
  numbers that appear in section 0 of `balance.md`.
- No human playtest was run. The one recorded full playthrough is the
  author's (`design/playtest-log.md`), and the log's rows are presentation
  observations, not loop observations. Every claim about what a player
  learns is inferred from what the rules make stable.
- The simulator's bots do not use status moves, setup or deliberate
  switching, so every number about those is a number about the bots.
