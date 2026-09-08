# Balance

What the simulator measured, what it changed, and what is still wrong.

`npm run sim -- --seeds 1000` plays a thousand full runs headless under two
policies and prints the report this document summarises. Stage 3 adds
`--policy tiers`, which is the question that stage exists to answer; see §6. The JSON goes to
`sim-reports/`, stamped with the randomizer version that produced it.

Those JSON files are not committed, and do not need to be: the simulator is
deterministic given a seed prefix, so that one command regenerates the exact
report quoted below. The findings are what is worth keeping, and they are here.

---

## 1. Why this document exists before the UI does

The Stage 2 order of work was: randomizer, then simulator, then tune, then UI.
Not because the UI is unimportant, but because **you cannot balance a roguelike
by playing it.** Fifty runs is an afternoon and produces three memorable
anecdotes. A thousand runs is forty seconds and produces a distribution, and a
difficulty curve is a distribution — nothing else.

Every number in `data/scaling.ts`, `data/starters.ts` and `data/tuning.ts` is
the output of that loop. None of them is taste.

## 2. The Stage 2 numbers

**Superseded twice over — see §7 for the shipped figures.** Kept because the
findings in §3 are what produced the curve, and those still hold. The table
itself does not: it was recorded at `gymrun-randomizer-2` and Stage 3 shipped at
`-4` without re-running it, so the 5.2% below was already wrong before Stage 4
touched anything (§7.1). Stage 4 then raised `PARTY_SIZE` and invalidated the
rest.

1000 seeds, `greedy` battle policy, `rest` node policy, at
`gymrun-randomizer-2`:

| gym | leader | type | team | reached | clear rate | drop |
|---|---|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 963 | 92.4% | — |
| 2 | Marina | Water | 1 | 851 | 90.5% | -2pt |
| 3 | Volta | Electric | 2 | 735 | 81.0% | -10pt |
| 4 | Fern | Grass | 2 | 553 | 80.5% | -0pt |
| 5 | Cinder | Fire | 2 | 388 | 78.1% | -2pt |
| 6 | Solene | Psychic | 3 | 236 | 76.3% | -2pt |
| 7 | Vesper | Ghost | 3 | 132 | 69.7% | -7pt |
| 8 | Draven | Dragon | 3 | 78 | 66.7% | -3pt |

**Run completion 5.2%**, mean 3.33 gyms cleared of eight.

Against the Stage 2 targets:

| target | shipped |
|---|---|
| `greedy` clears gym 1 in ~90% of runs | 92.4% |
| `greedy` completes a run 5-15% of the time | 5.2% |
| `random` rarely gets past gym 3 | clears gym 3 in 24.1% of runs |
| `random` never clears gym 6 (the depth test) | 1.0% |
| no gym drops more than ~25 points | worst drop 10pt, at gym 3 |
| no species dominates | top species in 9.6% of runs |

`greedy` versus `random`, the crude measure of whether skill matters:

| policy | completion | mean gyms | gym 1 | gym 4 | gym 8 |
|---|---|---|---|---|---|
| greedy | 5.2% | 3.33 | 92.4% | 80.5% | 66.7% |
| random | 0.1% | 1.56 | 77.1% | 57.1% | 50.0% |

A fifty-fold gap in completion and a factor of two in depth reached. Move choice
matters.

### Diversity

635 distinct species and all 310 abilities across 13,877 encounters in the
greedy sample; 140 distinct starters chosen. The most common species appears in
9.6% of runs and the most common ability in well under 1% of encounters.

That is the number win rate cannot measure and the reason it is in the report.
A pool of forty species could produce every other table on this page and would
fail the thing Stage 2 is actually for.

## 3. The four findings that moved the numbers

### 3.1 Team size is a multiplier until you pay for it

The starting hypothesis — gyms 1-3 fielding one or two Pokemon, gyms 6-8
fielding three, the player healing between encounters — was the right *shape*.
The first cut implemented it with a flat gym level offset across the whole run,
and the report was unambiguous:

```
gym  team  clear rate  drop
1    1     95.5%       —
2    1     85.5%       -10pt
3    2     43.6%       -42pt
6    3      0.0%       -33pt
```

A solo Pokemon does not beat three at its own level; it beats one and loses to
the second. Team size was not a difficulty step, it was a wall with a number on
it.

The fix is that **each step up in team size is paid for with a step down in
level**: one Pokemon at the player's level, two around nine levels below, three
sixteen to twenty-one below. That turns team size into texture — more matchups,
more PP spent, longer fights — rather than a multiplier on the opponent's total
HP. The 42-point cliff became a 10-point step.

### 3.2 The player's kit was frozen at segment 1 and the opponents' was not

This one read as a level-curve problem for three tuning passes.

The first cut rolled the starter's moves from segment 0's move band — obviously
correct, and a trap. There is no XP, no move relearner and no rewards until
Stage 3, so the player keeps that kit for all eight segments while every
opponent's climbs to band 3. The player was fighting segment 8 with segment 1's
moves.

What made it visible was not the win rate. It was the per-node death counts:
**two thirds of runs ended at wild and trainer nodes, not at gyms.** A curve
problem shows up at gyms; this showed up everywhere, which is what a kit problem
looks like.

`STARTER_MOVE_BANDS` in `data/starters.ts` now draws the starting kit from the
whole run's range. Strong at segment 1, ordinary by segment 8 — the correct
shape for a resource the player cannot upgrade. Stage 3 is where it can go back
to being weak, because rewards will give the player a way to fix it.

### 3.3 Attrition across eight segments was a countdown, not pressure

With the kit fixed, ordinary fights still ended 5% of runs each. The diagnostic
that settled it: of the runs that died at an ordinary node, **80% entered that
node already damaged and half of those below 40% HP.** Not blowouts — attrition.

Eight segments of four or five steps is roughly forty nodes on one Pokemon, and
every segment started poorer than the last. The run was decided somewhere around
segment 3 regardless of play, which is the opposite of what a roguelike wants.

`gymClearHealFraction` in `data/tuning.ts` restores HP and PP when a gym falls.
Each segment becomes its own attrition budget instead of one eight-segment
budget, which is also what the genre this borrows from does — you clear a gym,
you visit the Pokemon Center. Rest nodes still carry the *within*-segment
tension, which is where a choice between two nodes can be interesting.

Completion went from 2.5% to 4.9%.

### 3.4 A flat level offset gets harder for a reason nobody chose

A flat `-8` is 27% of the player's level at segment 1 and 11% of it at segment
8. Every offset column in `data/scaling.ts` widens as the run goes on for that
reason alone. It moved the per-fight death rate from 9% to 4% on its own.

Segment length moved too: six to eight steps was sized for Stage 1's *single*
segment, and eight of those is a sixty-node run. Four to five puts a full run at
around forty nodes.

## 4. What is still wrong

**Fights are short early.** 1.6 turns per battle in segment 1, rising to 3.1 by
segment 8. Late-game fights have a shape; early ones are an exchange. The cause
is structural rather than tuneable and was already named in Stage 1: no EV or IV
spreads, so bulk is at its floor, and one Pokemon a side, so there is no switch
to make and no reason to set up. Stage 4's party slots address the second
directly.

**`random` clears gym 3 in a quarter of runs.** The spec's target was "rarely
gets past gym 3". It is not rare. Tightening the early gyms to fix it would push
`greedy`'s completion below the 5% floor, so the trade was declined — and the
claim that actually matters, that a random policy never clears gym 6, holds at
1.0%. The early game is forgiving on purpose; the depth test passes.

**The blacklist is still nearly empty**, which is the correct state after one
tuning pass but not a permanent one. Nothing in the report showed a single
species, ability or move dominating an outcome distribution, so nothing earned a
line. `Shedinja` is excluded for a mechanical reason (one max HP means the run's
central resource does not apply to it), not a measured one.

## 6. Stage 3 — the risk gradient

`npm run sim -- --seeds 1000 --policy tiers`, at `gymrun-randomizer-4`. Both
policies use the Stage 0 greedy battle AI and the same rest-and-shop preamble,
so the only variable between them is **which fight they pick**.

| | tier-averse | tier-greedy |
|---|---|---|
| completion | **7.0%** | **6.6%** |
| mean gyms cleared | 2.90 | 2.66 |
| died before gym 2 | 24.0% | 32.2% |
| full clears (of 1000) | 70 | 66 |
| median coins at run end | 142 | 144 |

Gym clear rates, tier-averse: 91 / 86 / 79 / 83 / 75 / 82 / 72 / 80. Steepest
drop 9 points, against a target of 25.

### 6.1 The headline is a MISS, and it is the honest result

**`tier-greedy` does not beat `tier-averse`.** 6.6% against 7.0% at 1000 seeds
is 66 clears against 70 — a tie inside the noise. Risk is *real*: greedy dies
before gym 2 a third of the time against averse's quarter. It simply does not
pay.

The stage began far worse than that. The first measurement, before any tuning,
read 0.3% for both with greedy dying before gym 2 in **52%** of runs — risk
that was purely a tax. Getting to parity took the whole pass below. But parity
is not the spec's bar, and this section says so rather than rounding up.

### 6.2 Why it is hard, which is the useful part

**Risk compounds and rewards saturate.** A run is roughly thirty nodes, so a
per-node survival penalty multiplies: three points a segment is `0.97^7`, a
quarter of the run's completion gone. The reward is one card per fight,
whatever the tier — and at `PARTY_SIZE` 1 almost every card has a ceiling:

- **Items saturate at one.** A Pokemon holds one item. The second Leftovers a
  run is offered is worth nothing.
- **Moves saturate at one too**, which was the surprise. The greedy battle AI
  uses its single highest-damage move every turn, so a second move upgrade only
  matters if it beats the first. Four slots do not mean four upgrades.
- **Only consumables scale** — healing and money — and those are the rewards
  that do the least to change how a fight goes.

So the elite path buys a permanent advantage that caps out after one good card,
against a risk that recurs at every node. That is a structural fact about
`PARTY_SIZE` 1, not a number that was set wrong, which is why five separate
reward-pool shapes were tried against it and none of them cleared the bar:
items-heavy, tutor-heavy, heal-and-money-heavy, elite-without-a-second-Pokemon,
and elite-as-a-pure-stat-check.

**The two fixes that would work are both out of Stage 3's scope.** Either the
offer itself scales with tier — more cards, or a guaranteed premium card, which
the spec's "always a choice of 3" rules out — or Stage 4's party slots make item
and species rewards stop saturating, because a second Leftovers goes on a
second Pokemon. The second is the one to revisit; this is left as the stage's
open question rather than tuned into a number that flatters it.

### 6.3 What the pass actually changed

Completion went from **1.5% to 7.0%**, which is the other done-condition and is
now inside the 5-15% target. Five findings moved it.

**A three-Pokemon ordinary node.** `teamAdvantage.trainer` was 1 in segments
5-7, and it stacked with `elite`'s own `team: 1` to produce a *three*-Pokemon
fight at an ordinary node — a gym without the reward. Per-segment survival read
62% there and 85%+ everywhere else, which is as clean a signal as the simulator
has produced. Fixing it alone took completion from 1.7% to 5.3%. The rule it
settled into: **the segment sets level and stat quality, the tier sets team
size**, and only a gym breaks both at once.

**`elite` was paying for its second Pokemon at the wrong price.** It began at
`+1` level; it ships at `-8`. Two Pokemon *above* the curve is a wall, and the
Stage 2 lesson — every step up in team size is paid for with a step down in
level — applies at node scale exactly as it was written down.

**One `band` number moved two windows.** `TierModifier.band` shifted the species
pool and the move pool together, so `hard` landed a base-stat jump and a
move-power jump at once — at segment 0 that is the largest single difficulty
step in the game, sitting on the first tier a player ever meets. It is
`speciesBand` and `moveBand` now: hard is a stat check, elite is a damage check
plus a body.

**`STARTER_MOVE_BANDS` narrowed from `[1,2,3]` to `[1,2]`,** exactly as
`data/starters.ts` predicted it would when rewards arrived. A starter holding
band-3 moves has a best attack no reward can beat, so every TM and tutor in the
game was a dead card — taken 2-3% of the time, which the report read as "nobody
wants a TM" when it was really "nobody can be offered an upgrade".

**Money was being printed and not spent.** Payouts ran nearly twice as high;
19-24% of shop arrivals were *flush* with a median 170 coins unspent at the end
of a run. A risk-greedy player earning 2.2x of a currency nobody can spend is
earning nothing. Base payouts came down before the tier multiplier went up.

### 6.4 What the new report rows say

**Reward take rate.** Items 42-46%, currency 39%, healing 11-13%, moves 3-5%.
No kind is over half, which is the spec's target — a kind that were always
correct would make the choice of three decorative.

**Conditional completion is dominated by survivor bias, and the table says so.**
Runs that took a TM complete 24-27% against a 7% baseline. That is not a TM
being worth 20 points; it is that only a run which is already going well gets
deep enough to be offered one. Every figure prints its `n` for this reason.

**Currency curve.** Median held walking into a shop climbs 51 → 109 → 155 → 222
→ 270 → 317 → 368 → 463 across the eight segments, with spend tracking it.
Broke on arrival 3-4%, flush 10-15%. Neither extreme, which is what the prices
are tuned for.

**Choice items are not a trap.** The open question from `data/items.ts`: with
`PARTY_SIZE` 1 and no switching, a Choice lock lasts a whole battle. The answer
is +23 to +25 points of completion for Choice Band and Choice Specs, consistent
across both policies at n=52-91. Correlational and thin — they only appear in
the late elite pool — but nowhere near the negative a trap would show. **They
stay in the pool**, and the note in `data/items.ts` can be closed.

**Diversity holds.** 634 distinct species across the sample; the most common
appears in 10-11% of runs, against a target of 25%.

### 6.5 What is still wrong

1. **The risk gradient is at parity, not ahead.** §6.1 and §6.2. The stage's
   headline done-condition is not met, and the diagnosis says why.
2. **Move rewards are still rarely picked** — 3-5%, even after narrowing the
   starter window. The greedy AI's single-best-move habit is most of it, and a
   battle policy with any notion of coverage would value them differently.
3. **Median 142 coins is left on the table at the end of every run.** Not a
   failure — a player cannot know which fight is their last — but it is a
   quarter of a late-game item, and a reroll or a sell-back would recover it.
4. **`--policy tiers` is a slow way to ask this question.** Two 1000-seed
   samples is about six minutes. Fine for a checkpoint, painful for a bisect.

## 7. Stage 4 — the party, and every number before it

Raising `PARTY_SIZE` from 1 to 3 changes the difficulty of every encounter in
the game, so **nothing in §2 through §6 carries forward.** Those numbers
describe a different game. This section is the re-baseline.

### 7.1 The Stage 3 numbers in §2 were already stale, and that is worth knowing

The spec's first instruction was to run the new code at `PARTY_SIZE = 1` and
confirm it reproduces the Stage 3 report — because if it does not, switching
broke something before a single balance number moved. It did not reproduce.
The new code measured **14.5%** completion; §2 above says 5.2%.

The code was not the problem. Running the simulator on the Stage 3 commit
itself measured **14.7%**. §2 was recorded at `gymrun-randomizer-2` and Stage 3
shipped at `-4`; two tuning passes moved the game and the table was never
re-run. The check passed against the *code* and failed against the *document*.

| measured, 1000 seeds, `greedy`/`rest` | completion |
|---|---|
| §2 as written (randomizer-2) | 5.2% |
| Stage 3 commit, re-run today | 14.7% |
| Stage 4 code at `GYMRUN_PARTY_SIZE=1` | 14.5% |

Switching broke nothing. `GYMRUN_PARTY_SIZE=1` exists for exactly this
comparison and is documented in `data/partyTuning.ts`.

### 7.2 The largest error was a premise, not a number

The first baseline at `PARTY_SIZE = 3` produced an **inverted** curve: 74% clear
at gym 1 rising to 96% at gym 8, mean 1.90 gyms of eight.

`opponentTeamSize` sized every opponent as `PARTY_SIZE + advantage`. But a run
does not start with a full party — it starts with one Pokemon and acquires the
rest. The entire curve was aimed at a player who does not exist for the first
third of the run: a lone starter against three, and a full party against three.

Mean party size walking into a battle was **1.54**.

The fix is `EXPECTED_PARTY_SIZE` in `data/scaling.ts` — what the curve assumes
the player has *at that segment* — and `teamAdvantage` goes back to meaning what
its name says. The simulator prints the measured party beside the assumed one
every run, so the premise cannot quietly drift again:

| segment | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| assumed | 1 | 2 | 2 | 3 | 3 | 3 | 3 | 3 |
| measured | 1.31 | 1.82 | 2.34 | 2.72 | 2.87 | 2.95 | 2.97 | 2.98 |

The third column is why gym 3 was the only cliff left after the first repair —
72% against 83% and 89% on either side. Nothing about that gym was harder; the
curve was a whole Pokemon ahead of the player. Correcting the assumption removed
the cliff (72% → 84%) without touching a single difficulty number.

### 7.3 Acquisition supply, not appetite

The same baseline said the party almost never filled:

| | first cut | shipped |
|---|---|---|
| offers per run | 0.78 | 2.27 |
| offers accepted | 94.5% | 91% |
| runs that ever filled the party | 17.7% | 51% |
| completion, filled | 67.9% | 28.7% |
| completion, never filled | 2.0% | 0.3% |

A 94.5% take rate says the bot was refusing almost nothing — supply was the
constraint, not the join-level penalty or the release cost. And 2.0% against
67.9% is not a difficulty curve, it is a death spiral: you need a party to
survive and you need to survive to be offered one.
`ENCOUNTER_ACQUISITION_RATE` went from 0.25/0.4/0.6 to 0.55/0.7/0.85.

### 7.4 Two tiers were priced against a party of one

Both are the same arithmetic mistake, and both *inverted* what they were meant
to express.

**`elite`** bought its extra Pokemon with eight levels below the curve. At party
size 1 that `+1` was a second body against a lone player — a 100% increase in
the opposition. At 3 it is a fourth against three, a 33% increase, while eight
levels went on costing the same. `test/tiers.test.ts` measured elite at **84% of
hard's encounter power**: an "elite" node strictly *easier* than the `hard` one
beside it, paying from a better reward pool. Scaled by what it now buys,
`-8 x (1/3) ≈ -3`.

**Gym level offsets** were the same story one level up. A gym fielding three
against a solo player is a 3x advantage and was paid for with up to 23 levels;
fielding five against three is 1.67x and was still being paid 23. Gyms 4-8
cleared at 92-96% while gym 3 cleared at 79%. The offsets are roughly half what
they were.

### 7.5 The shipped numbers

`npm run sim -- --seeds 1000 --policy switching`, `rest` node policy,
`PARTY_SIZE = 3`, `gymrun-ai-2-switching`:

| gym | clear rate | drop |
|---|---|---|
| 1 | 95% | — |
| 2 | 83% | -12pt |
| 3 | 76% | -7pt |
| 4 | 85% | +9pt |
| 5 | 74% | -11pt |
| 6 | 72% | -2pt |
| 7 | 74% | +2pt |
| 8 | 72% | -2pt |

**Run completion 9.7%**, mean 3.24 gyms of eight.

| target | shipped |
|---|---|
| completion back inside 5-15% | 9.7% |
| no gym drops more than ~25 points | worst drop 12pt |
| players fill the party in most runs | 55% |
| median switches per battle above 0, below ~1 | mean 0.32, median 0, 22% of battles |
| `switch-aware` beats `no-switch` by a visible margin | **not met — see §7.6** |

Two of those deserve their caveat rather than a tick. **55% is "half", not
"most"** — though a run that dies at gym 1 never had the nodes to fill anything,
so the figure is part survivorship. And **the median is 0 rather than above
it**: the mean sits in the band the spec asks for, but most individual battles
contain no switch at all. Both are honest reads of a mechanic that, per §7.6,
is not yet paying for itself.

### 7.6 Switching does not pay, and the honest answer is to say so

This is the stage's headline done-condition and it is not met.

| 1000 seeds | completion | mean gyms |
|---|---|---|
| `switch-aware` | 9.7% | 3.24 |
| `no-switch` | 10.6% | 3.31 |

A 0.9-point gap in the *wrong* direction, which at a thousand seeds is inside
noise. The honest summary is that switching is currently worth nothing to the
player — not that it is harmful, but that a run played with the bench visible
and a run played without it end the same way.

It was worth much less than nothing at first. The original scoring compared a
switch against a move **on a one-turn horizon**, which a switch can never win —
it deals no damage and takes a free hit, so the only thing that could justify it
was a large penalty bolted onto staying. Across twelve combinations of that
penalty and the switch cost, `switch-aware` lost by 1.2 to 2.8 points every
time. Not a badly tuned cost: a model that cannot express the benefit.

Replacing it with `matchupQuality` — how many turns a body survives against how
many it needs to win, so a switch is worth the *difference between two races* —
flipped the sign to +2.0 points in isolation. It did not survive contact with
the full policy at the shipped difficulty.

Three things are worth writing down before the next attempt:

1. **The opponent fields more Pokemon than the player at every gym.** Switching
   to answer a matchup is a losing trade when they have more answers than you
   have; they simply bring in the next one. Dropping gyms from five to four
   narrowed the gap from -4.8 to -2.0, which is the clearest evidence that this
   is the binding constraint rather than the cost.
2. **Partial free revival makes preservation cheap to skip.** A fainted member
   comes back at half HP for nothing at the next node, so losing one costs less
   than the full turn a switch spends. `partyTuning.freeRevive` exists to
   measure this; setting `reviveHpFraction` lower is the untried lever.
3. **Comparing across `switchCost` values is not a controlled experiment.** The
   opponent runs the same AI, so raising the cost strengthens the opponent in
   *both* arms and closes the gap without switching helping anyone. Only the
   comparison at a fixed weight is meaningful. This caught out an earlier
   reading of the same table.

The switch *cost* is not a lever: it is Showdown's, and inventing a discounted
switch would make every number here describe a game nobody is playing.

### 7.7 Party size: ship 3, and the metric says do not test 4 yet

The spec's condition for testing four slots was the party-composition metric —
where losses happen.

| members standing when the losing battle began | share of losses |
|---|---|
| 3 alive | 43% |
| 2 alive | 24% |
| 1 alive | 33% |

**43% of losses happen with a full, standing party.** Those runs were beaten by
a single wall, not by running out of Pokemon, and a fourth slot would not have
saved one of them. That is the spec's own "the fix is elsewhere" reading, so 3
ships and 4 waits.

Type coverage is the other half of the same picture: a final party averages 3.23
distinct types, and completion climbs steeply with it. That correlation is
mostly party *size* wearing a disguise — three Pokemon carry more types than one
— so it is not yet evidence that coverage is a skill.

## 5. Running it yourself

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --seeds 1000 --policy greedy
npm run sim -- --nodes all               # compare node-choice playstyles
npm run sim -- --set stepsPerSegment.min=6 --set stepsPerSegment.max=8
npm run sim -- --seeds 1000 --policy switching   # Stage 4's headline pair
GYMRUN_PARTY_SIZE=1 npm run sim -- --policy greedy  # reproduce the Stage 3 game
npm run sim -- --help
```

Party size is a module constant rather than a `--set` field, because the whole
difficulty curve is a function of it. `GYMRUN_PARTY_SIZE` is a measurement lever
and not a game setting; see `src/data/partyTuning.ts`.

The balance levers are `src/data/scaling.ts` (the curve, including
`EXPECTED_PARTY_SIZE`), `src/data/starters.ts` (what the player begins with),
`src/data/partyTuning.ts` (slots, join level, what a faint costs),
`src/data/rewardPools.ts` (payouts and acquisition rates), `src/data/tuning.ts`
(map shape and recovery) and `src/data/blacklists.ts` (exceptions).
`AI_WEIGHTS` in `src/core/battle/ai.ts` is a lever too, and changes to it move
win rates as much as data does — which is why the report stamps `aiVersion`
beside `randomizerVersion`. If a tuning pass
ever needs to edit `src/core/randomizer.ts`, the split between logic and data is
wrong and that is the bug to fix first.

**Changing any of those changes what every recorded seed produces.** Bump
`RANDOMIZER_VERSION` in `src/core/randomizer.ts` when you do, or a shared seed
quietly becomes a different run.
