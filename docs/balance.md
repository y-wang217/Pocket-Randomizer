# Balance

What the simulator measured, what it changed, and what is still wrong.

`npm run sim -- --seeds 1000` plays a thousand full runs headless under two
policies and prints the report this document summarises. Stage 3 adds
`--policy tiers`, which is the question that stage exists to answer; see §6. The JSON goes to
`sim-reports/`, stamped with the randomizer version that produced it.

Ad-hoc reports are not committed, and do not need to be: the simulator is
deterministic given a seed prefix, so that one command regenerates the exact
report quoted below. The findings are what is worth keeping, and they are here.
**Benchmark** reports are the exception and live in `sim-reports/benchmarks/`;
§0 says why.

---

## 0. Balance is not a gate

**Standing policy, 2026-09-09. This overrides every "target" in the sections
below.**

The simulator keeps running and keeps reporting. **A completion rate outside
its target band no longer blocks a checkpoint, a commit or a merge.** Record the
number, note the direction, continue.

Two things follow from that, and both are rules rather than suggestions:

- **Do not retune between checkpoints.** A mid-stage tuning pass tunes against a
  curve that is about to move. Mechanics are landing faster than the table can
  settle, so a number chased today is a number re-chased next week, and the work
  in between is attributed to the wrong cause.
- **Do not move a target to make a miss disappear.** A target that follows the
  measurement is not a target. If a band is wrong, it gets changed deliberately,
  in its own change, with the reason written down — never as a side effect of
  missing it.

### What replaced the gate

A benchmark comparison at each major release: a pinned seed set and policy set,
run, and the report committed to `sim-reports/benchmarks/` stamped with
`RANDOMIZER_VERSION` and — once it exists — `contentHash`, then diffed against
the last recorded one. The question stops being "did we pass" and becomes "what
moved, and does the direction make sense given what changed".

The recorded points so far:

**The prefix is part of the stamp.** `--prefix` selects which 400 seeds get
played, and two prefixes are two populations that sit at different completion
rates for no reason but the draw. A comparison across prefixes measures nothing.
This was learned by making the mistake: a 3.2-point "regression" was attributed
to a move-pool change and written into the README before anyone noticed that
the two runs used `RETUNE` and `SIM`.

| stamp | prefix | completion | mean gyms | note |
|---|---|---|---|---|
| `randomizer-8`, 400 | RETUNE | 7.2% | 3.27 | Stage 4.6b, after the level-offset retune |
| `randomizer-9`, 400 | SIM | 4.0% | 2.94 | Cut and Flash admitted |
| `randomizer-10`, 400 | SIM | 4.0% | 2.82 | Cut and Flash removed |
| `randomizer-10`, 400 | RETUNE | 7.2% | 3.27 | same, matched to the v8 baseline |
| `randomizer-11`, 400 | RETUNE | see §12 | | Stage 4.6c relics |

Read down a prefix, never across. On `SIM`, admitting the two moves cost
nothing: same completion, 0.12 mean gyms of noise. On `RETUNE`, removing them
returned the exact v8 numbers to every digit, which is what byte-identical move
tables should do and is a decent check that the benchmark is measuring the game
rather than the weather.

Every row stays, including the ones produced by a bad comparison. A benchmark
that keeps only its good numbers measures nothing.

### What still gates, absolutely

Determinism. Stream isolation. The two version guards. The full test suite.
Those are correctness, and correctness is a gate. Balance is a number.

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
   than the full turn a switch spends. **Stage 4.5.1 made this lever reachable**
   — it was `partyTuning.reviveHpFraction`, read at module scope, so the number
   this paragraph blames was the one number a sweep could not vary. It is
   `tuning.reviveHpPercent` now and `--set reviveHpPercent=0.25` works. Still
   untried, but no longer untriable.
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

## 8. Stage 4.5 — the non-result, and why it is in this document

Stage 4.5 changed no balance number, and that is the finding rather than the
absence of one. It is written down here because "we did not intend to change
anything" and "nothing changed" are different claims, and only the second one
is checkable.

The stage put six things on screen that the engine had been resolving all along
— move category, both sides' stats, stat stages, turn order, type
effectiveness, and what every condition does. Nothing it added draws from an
RNG stream, and the report is the proof:

```
npm run sim -- --seeds 1000     # before the stage, and again after it
```

**Every measured value is byte identical.** 47,802 bytes of results — clear
rates per gym, completion, causes of death, turns per battle, outlier seeds,
diversity, the whole risk gradient — match exactly. The 370-line human report
matches line for line.

Three things were normalised before comparing, and all three are named so the
claim can be audited rather than taken:

  - `generatedAt` and each sample's `durationMs`, which are wall-clock.
  - The progress counters and the output path in stdout.
  - Nothing else.

The `tuning` block is the one part of the report that *did* move, and it is not
a measurement — it is the report's echo of the configuration it ran with. It
gained exactly two fields and changed none:

```
tuning echo: 2 added, 0 removed, 0 changed
  + revealOpponentAbility = true
  + revealOpponentItem = true
```

It is reported separately rather than normalised away on purpose. Excluding the
tuning block quietly would have hidden a real balance change if one had crept
in; a *changed* or *removed* value there fails the comparison, and only an
addition passes.

The structural reason this held is worth keeping. `BattleUiView` is a second
projection, not a wider first one: the policy view in `core/types.ts` — the one
the greedy AI decides from, with `foe.ability` null — was not touched. Had the
stage taken the shorter route and widened it, the AI would have gained an
ability it has never seen, and every number in §7 would have moved for a
reason that had nothing to do with balance.

## 9. Stage 4.5.1 — putting prices back on things

Stage 4.5 changed no balance number and said so loudly. This stage changes
several on purpose, and the interesting part is that two of the three
investigations that opened it found the premise wrong rather than the number.

### 9.1 Two of the three opening questions had false premises

The stage began with three questions, each of which could have invalidated
every recorded seed. Two were answered "that is not what the code does":

1. **Does `tuning.allowSpeciesRewards` filter before the draw?** Yes — it
   removes entries from the pool `pickWeighted` sums weights over, so flipping
   it shifts every reward roll in every seed. **But it was already `true`**,
   flipped in Stage 4, so there was nothing to flip and no bump owed.
2. **Where is HP being restored between nodes?** Nowhere. `betweenNodes`
   already carried HP and PP untouched and revived only the fainted, at half.
   Measured rather than read: a party at 16/54 with 4 PP came out at 16/54 with
   4 PP, and the fainted member at exactly 25/50.

What was actually wrong was *where the number lived*. `reviveHpFraction` sat at
module scope in `data/partyTuning.ts`, read by a `reviveHpFor` that took no
tuning — so the single lever §7.6 spends three paragraphs blaming was the one
lever `withTuning` could not vary. It is `tuning.reviveHpPercent` now.

### 9.2 The rest-node cut, and why the direction needed measuring

Rest frequency was already fully exposed as tuning (`nodeWeights.rest`,
`minRestSteps`, `restEarliestStep`), so "expose it" was done and only the value
change remained.

The direction is not obvious. **A rest node that becomes a fight is a node that
pays a reward**, so cutting rests removes healing and adds rewards at the same
time, and the two pull opposite ways. 400 seeds, fixed prefix, `switch-aware`:

| rest weight | minRestSteps | completion | mean gyms |
|---|---|---|---|
| 2 | 2 | 12.0% | 3.44 |
| 2 | 1 | 11.0% | 3.29 |
| **1** | **1** | **11.3%** | **3.25** |
| 1 | 0 | 7.2% | 3.11 |

Healing wins, modestly. Halving both dials costs about a point of completion;
removing the floor costs five and reintroduces the failure `ensureRests` exists
to prevent — a seed that offers nowhere to heal at all, which is a run the
player had no hand in rather than a hard one. Shipped at weight 1, floor 1.

### 9.3 The gym clear still full-heals, and that is a decision

`gymClearHealFraction` stays at 1. Part 1 of the stage prompt, read literally,
would have removed it — it is neither a rest node nor an explicit heal effect —
but it was kept deliberately, so attrition pressure lives entirely *within* a
segment's four-to-five steps, which is where the rest-versus-reward decision is
actually made.

That has a consequence worth stating plainly: **healing was never the binding
constraint on a run, and cutting rest nodes did not make it one.** The gym heal
is a larger source of recovery than every rest node in a segment combined. If a
later stage wants attrition to compound across segments, this is the number,
not `minRestSteps`.

### 9.4 A move reward can now leave you weaker

Stage 4.5's `replaceableSlot` refused to teach a move weaker than everything the
member knew. That clause bought an invariant — a move card could never make you
worse — and it is deliberately gone, because a rule that guarantees you never
lose is a rule that removes the decision.

The escape hatch moved rather than disappearing: it is the reward screen, where
the card was already chosen over two alternatives. The balance consequence is
that a card taken carelessly is now a real cost, and the simulator's greedy
policy takes that cost every time it takes a move card — its heuristic drops the
lowest-base-power damaging move without ever comparing it to the incoming one,
which is written down in `scripts/sim.ts` precisely because it will show up in
every report from here on.

### 9.5 The shipped numbers

`npm run sim -- --seeds 1000 --policy greedy`, `rest` node policy,
`PARTY_SIZE = 3`, `gymrun-randomizer-5`, seed prefix `s451`:

| gym | clear rate | drop |
|---|---|---|
| 1 | 94.5% | — |
| 2 | 85.1% | -9pt |
| 3 | 83.1% | -2pt |
| 4 | 81.0% | -2pt |
| 5 | 65.7% | -15pt |
| 6 | 77.0% | +11pt |
| 7 | 70.9% | -6pt |
| 8 | 77.5% | +7pt |

**Run completion 9.2%**, mean 3.19 gyms of eight.

The stage moved the curve twice, in opposite directions, and the intermediate
measurement is worth keeping because it separates the two:

| | completion | mean gyms |
|---|---|---|
| Stage 4.5, same prefix | 9.0% | 3.12 |
| after backpack, moves, gender, coverage | 10.0% | 3.26 |
| after the rest cut (shipped) | 9.2% | 3.19 |

So the mechanical changes were worth about a point of completion on their own —
the backpack means items reach Pokemon that want them rather than whoever the
card landed on — and cutting rests gave that point back. Both are inside the
5-15% band with room, and the worst drop is 15pt against a 25pt target.

**Every Stage 2 target passes, on both policies, for the first time.**

```
greedy                                     random
  ok  gym 1 clear rate 94.5%   (~90%)        ok  past gym 3 in 17.2%  (rarely)
  ok  completion 9.2%          (5-15%)       ok  clears gym 6 in 0.8% (~never)
  ok  steepest drop 15pt       (<=25pt)      ok  completes 0.0%       (~never)
  ok  top reward kind 43.1%    (<=50%)       ok  top species 8.8%     (<=25%)
  ok  shop broke 21.8/flush 17.0 (<=35%)
  ok  top species 15.5%        (<=25%)
```

Gym 1 is the one worth noting: §7.5 recorded it as the single MISS on the greedy
run at 95.0% against a band of 85-95%. It is 94.5% now, inside by half a point,
and nothing in this stage was aimed at it — the extra acquisition offers from
the rest cut are the likeliest cause. Half a point inside a band is not a
result, and it should not be treated as one; open question 3 stands.

### 9.6 The party fills much more often, and it is the rest cut that did it

The one number that moved a long way:

| | Stage 4.5 | shipped |
|---|---|---|
| acquisition offers per run | 2.33 | 3.33 |
| runs that filled the party | 51.8% | 65.4% |
| mean party at the losing battle | 2.23 | 2.46 |
| mean type coverage on the final party | 3.20 | 3.44 |

**A rest node that becomes a wild node is a node that offers its Pokemon.**
Cutting rest frequency did not only remove healing; it added a third more
acquisition offers, and the party-fill rate went with them. §7.5 flagged 51.8%
as "half, not most" against the spec's "players fill the party in most runs".
It is most now, and nothing in this stage was aimed at that.

### 9.7 Switching still does not pay, and the gap widened

| 1000 seeds | completion | mean gyms |
|---|---|---|
| `switch-aware` | 9.2% | 3.19 |
| `no-switch` | 11.3% | 3.44 |

A 2.1-point gap in the wrong direction, against Stage 4's -0.9. Nothing in this
stage was aimed at switching, so this is a re-measurement rather than a
regression — but it is the third report in a row to say the same thing, and the
gap is now outside what §7.6 could call noise.

The one new thing this stage contributes to the question: the party fills in
65.4% of runs rather than 51.8%, so `switch-aware` now has a *fuller bench to
switch into* and still loses. That removes one of the explanations §7.6 left
open — it is not that the bot had nothing to switch to. The strongest remaining
lever is unchanged: the opponent outnumbers the player at every gym, so
switching to answer a matchup loses to a side with more answers.

### 9.8 The checklist was checking the wrong policy, in both directions

`npm run sim -- --policy switching` has been the headline command since Stage 4,
and it was printing three MISS lines every time:

```
MISS  random gets past gym 3 in 56.0% of runs (target: rarely)
MISS  random clears gym 6 in 23.6% of runs — the depth test (target: ~never)
MISS  random completes a run in 11.3% (target: ~never)
```

No random policy had been run. The checklist branched on `policy === 'greedy'`
and treated *everything else* as the random sample, so `no-switch` — a competent
bot — was being measured against "a random policy should almost never clear gym
6". Against a real `random` sample all three pass comfortably: 17.2%, 0.8%,
0.0%.

The mirror image showed up the moment that real sample was run. The curve and
economy targets were being applied to the random bot, which reaches gym 8 in
three runs out of a thousand and goes 0 for 3 — reported as a 57-point drop and
a balance failure, on a sample size of three. Same for "items are 51.8% of
picks" from a bot picking uniformly at random, and "broke on arrival 37.2%" from
a bot that never won a fight.

Both halves are fixed. Competent policies take the completion band and the
curve and economy targets; `random` takes the three depth tests; the gym-1
target stays `greedy`'s because it was written against that bot; species
diversity stays on for everything, because it is a property of the randomizer
rather than of play and a random bot samples it as well as any.

A report that cries wolf on its own headline is worse than one with no
checklist, and this one had been doing it in both directions since Stage 4.

## 10. Stage 4.6a — locales, capture, and the report's three new questions

Three systems land here and only one of them moves a number on purpose. Locales
decide *which* wild Pokemon a segment fields, capture decides *whether* you keep
one, and the keyed-stream refactor underneath both decides nothing at all — it
moves every draw in the game onto an independent sequence, which is why
everything below is measured fresh rather than diffed.

**1000 seeds, `greedy`, `randomizer-7`.** Same depth as §9.5 so the two tables
are comparable.

### 10.1 The headline, against Stage 4.5.1

| gym | leader | type | team | reached | clear rate | drop |
|---|---|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 950 | 97.7% | — |
| 2 | Marina | Water | 2 | 869 | 89.3% | -8pt |
| 3 | Volta | Electric | 3 | 754 | 78.9% | -10pt |
| 4 | Fern | Grass | 4 | 566 | 83.9% | +5pt |
| 5 | Cinder | Fire | 4 | 433 | 58.2% | -26pt |
| 6 | Solene | Psychic | 5 | 236 | 66.9% | +9pt |
| 7 | Vesper | Ghost | 5 | 148 | 66.9% | 0pt |
| 8 | Draven | Dragon | 5 | 94 | 75.5% | +9pt |

Run completion **7.1%**, mean **3.35** gyms of 8, against 4.5.1's 9.2% and 3.19.

**Completion fell two points and mean depth rose.** Those pull in opposite
directions and the reason is one change: the guaranteed wild step. A segment now
contains one fight the player cannot decline, so every run takes more attrition
per segment — that costs the tail, where a run is limping — while the same
guarantee fills the party faster, which is worth more in the middle where a run
is still healthy. The middle gyms are where it shows: gym 3 fell 83.1% to 78.9%
and gym 5 fell 65.7% to 58.2%, while mean depth went *up*.

Both numbers are inside the 5-15% completion band, so nothing here is a fix to
make. It is stated because the next stage retunes, and a retune that treats 7.1%
as a regression rather than as the price of a composition guarantee will
"correct" it by weakening the thing that fills the party.

### 10.2 Every locale is reachable, and the offer is flat

| locale | share of picks | share of offers |
|---|---|---|
| Forest | 13.2% | 12.6% |
| City | 12.8% | 12.5% |
| Cave | 12.7% | 12.5% |
| Summit | 12.7% | 12.8% |
| Badlands | 12.6% | 12.5% |
| Ruins | 12.1% | 12.4% |
| Shore | 12.1% | 12.2% |
| Marsh | 11.7% | 12.5% |

Eight locales, an even eighth is 12.5%, and the offer column is inside 0.3
points of it everywhere. The pick column is wider because the sim's locale
policy is a uniform draw over a two-or-three card offer, so it inherits the
offer's noise and adds its own.

The two questions this table exists to answer:

- **Is any locale unreachable?** No. Neither the never-offered nor the
  never-picked list has anything in it, and `test/locales.test.ts` asserts the
  stronger property directly: across 300 seeds, **100%** of runs are offered all
  eight.
- **Does the no-consecutive rule starve anything?** No. A run walks a mean of
  **3.59 distinct locales** before it dies, against a mean of 3.35 gyms cleared
  — so a run essentially never repeats a region.

### 10.3 Capture: offered eight times a run, taken not quite half

| | value |
|---|---|
| capture offers per run | 7.99 |
| offers taken | 46.5% (3713 of 7992) |
| party entering gym 1 | 2.69 of 3 (curve assumes 1) |
| party entering gym 2 and after | 3.00 of 3 |

Eight offers per run against one guaranteed wild step per segment is the
composition guarantee showing up in the measurement.

**A 46.5% take rate is the number that says capture is a decision.** The bot
declines the majority of what it is offered, because the party is full from gym
2 onward and taking something then costs a member. Compare Stage 4's first
baseline, where a 94.5% take rate said supply was the constraint rather than
appetite (§7.3): that failure is inverted now, and the constraint is the slot.

The party is **ahead of the curve** at gyms 1 to 3 — 2.69 against an assumed 1,
then 3.00 against 2 — and exactly on it from gym 4. `EXPECTED_PARTY_SIZE`'s
early rows are now conservative: opponents in the first three segments are sized
for a smaller party than the player actually has. That is a 4.6b item and it is
listed in §10.6.

### 10.4 Parties diversify, and gym 8 is where it shows

Ninety-four parties reached Draven. Between them they carried **152 distinct
species**, a mean of **4.32 distinct types** each, and the most common single
species — Slaking — held 4.3% of the slots.

That is the number the locale system is judged on and it is deliberately the
hardest one to make look good: it counts distinct species *across every party
that got there*, so a system that funnelled every run into the same handful
would report a small number no matter how well spread each individual party was.
152 species across 94 parties of three is 152 of a possible 282.

The type spread is flatter than the species spread and that is expected: Ground
and Water lead at 10.1% each against an even eighteenth of 5.6%, because both
appear in two locales and in a lot of species besides.

### 10.5 The catch pair, and what it actually measured

`--policy catching` runs two bots that differ in exactly one rule. At 200 seeds:

| policy | completion | mean gyms | capture take rate |
|---|---|---|---|
| `catch-greedy` | 0.0% | 1.68 | 100% |
| `catch-averse` | 0.0% | 1.42 | 0% |
| `greedy` (for scale) | 7.1% | 3.35 | 46.5% |

The spec's expectation was that the gap between the two would measure whether
capture does anything. It does — always catching beats never catching by 0.26
gyms, about 18% — and the third row is the more interesting result.

**A selective catcher reaches roughly twice as deep as an indiscriminate one.**
`catch-greedy` is the spec's own definition: always catch, replace the
lowest-*level* member when full. `greedy` catches when the offer beats its worst
member on a crude value estimate and declines otherwise. Same map, same battle
AI, same node policy, and 1.68 gyms against 3.35.

So the value in the capture system is not in the catching. It is in the
declining — an always-take policy is *punished*, and the punishment is losing a
Pokemon you earned to one you merely met. That is also the strongest available
answer to the objection that a guaranteed capture is a free reward: it is only
free if you take everything, and taking everything is the worst policy measured
here.

`catch-averse` completing 0% on a party that only ever grows through reward
cards is the same finding from the other end, and it re-confirms §7.3's death
spiral: you need a party to survive.

### 10.6 What this stage did not measure, and should not have

Nothing here retunes anything. No level, band, weight or price moved in 4.6a,
deliberately: three systems landed at once and a retune on top of them would
leave the next report unable to say which change moved which number. Two items
are flagged for 4.6b, which *is* a retune:

1. **`EXPECTED_PARTY_SIZE`'s early rows are low** (§10.3). The player carries
   2.69 members into gym 1 against an assumption of 1, and 3.00 into gyms 2 and
   3 against an assumption of 2.
2. **Gym 5 is still the cliff**, now at 58.2% with a 26-point drop into it. It
   has been the cliff in every report since Stage 2 and it is the oldest open
   item in this document.

And one thing that is *not* an item: the two points of completion in §10.1. They
are the price of the guaranteed wild step, which is the thing that fills the
party, and "fixing" the completion rate by removing it would trade a system for
a number.

## 11. Stage 4.6b — the ramp, and the retune it forced

The stage's claim is one sentence: **a run starts with Tackle and Growl and
ends with something that hits like a truck.** Everything below is that sentence
measured, and the retune it cost.

**400 seeds, `greedy`, `randomizer-8`.**

### 11.1 The fresh targets

The spec asks for new targets rather than a diff, because 4.6b moved every
number the Stage 2 targets were written against. These are minted from this
report and are checked by `npm run sim` from here on:

| target | value | why |
|---|---|---|
| full run completion | 5-15% | unchanged: the band is a shape, not a number |
| gym 1 clear rate | ~90% | unchanged, and `greedy`'s alone |
| move band entering gym 5 | >= 2.0 | the spec's own test for whether the ramp ramps |
| band-1 share at gym 5 | <= 55% | a mean alone hides the shape |
| berries eaten in segment 6 | <= 0.05/run | they are meant to have faded by then |
| gym 6+ parties carrying a berry | <= 50% | a bag still full of them is a pool that offered nothing better |

### 11.2 The headline, and the retune

| gym | leader | type | team | reached | clear rate | drop |
|---|---|---|---|---|---|---|
| 1 | Garnet | Rock | 1 | 374 | 95.2% | — |
| 2 | Marina | Water | 2 | 348 | 86.8% | -8pt |
| 3 | Volta | Electric | 3 | 301 | 76.4% | -10pt |
| 4 | Fern | Grass | 4 | 223 | 78.5% | +2pt |
| 5 | Cinder | Fire | 4 | 170 | 61.2% | -17pt |
| 6 | Solene | Psychic | 5 | 97 | 75.3% | +14pt |
| 7 | Vesper | Ghost | 5 | 68 | 58.8% | -16pt |
| 8 | Draven | Dragon | 5 | 37 | 78.4% | +20pt |

Run completion **7.2%**, mean **3.27** gyms, worst drop **17 points** — against
4.6a's 7.1%, 3.35 and 26 points. The stage lands where it started and the curve
is *smoother* than it was, which is the honest summary: the ramp is a
redistribution of difficulty rather than an addition of it.

**Getting there took one lever, and it was not a band.** Banding alone took
completion from 7.1% to **0.8%** and mean depth from 3.35 to 2.07, because the
starter dropped two bands (`[1,2]` old numbering is `[2,3]` new) while opponents
in the opening segments were already at band 1 and did not move. The player lost
a large early advantage that every number in this document had been tuned
around.

Three passes, each measured:

1. **The segment-to-band table**, which the spec explicitly marks "to be moved
   by the report". Shifted one segment later and softened at the top: 0.8% ->
   1.7%, depth 2.07 -> 2.16.
2. **Move reward frequency**, doubled in every pool. It moved the take rate by
   *under a point*, which was the finding rather than the fix — see §11.4.
3. **The level offsets**, widened by 3 for wild and trainer nodes and 2 for
   gyms. 2.5% -> 7.2%, depth 2.3 -> 3.27.

The third is the whole retune. Base power and level are the two things damage
is made of, and 4.6b cut the player's base power by roughly 40% at the opening;
compensating in the other term is the change that keeps the *shape* of every
other table intact. Nothing in `data/tuning.ts`, `data/rewardPools.ts` band
structure, or the tier modifiers moved for balance reasons.

### 11.3 The ramp ramps

| entering gym | mean band | still band 1 |
|---|---|---|
| 1 | 1.03 | 97% |
| 2 | 1.32 | 85% |
| 3 | 1.59 | 74% |
| 4 | 1.95 | 57% |
| 5 | 2.09 | 50% |
| 6 | 2.33 | 40% |
| 7 | 2.58 | 32% |
| 8 | 2.89 | 26% |

A run opens holding almost nothing but band 1 and arrives at Draven holding
almost three times the base power. Both targets pass at gym 5 — 2.09 against
2.0, and 50% against 55% — but only just, and that is worth saying plainly: the
spec's test is "still on band 1 at gym 5", and half the player's moves still
are. The climb is real and it is slower than the opponents', which is what makes
the back half hard.

**And it is faster on the risky path**, which is the stage's stated done
condition. `tier-greedy` against `tier-averse` at 120 seeds: 2.35 mean gyms
against 1.84, carrying 2.39 mean band into gym 5 against 2.18. Same seeds, same
battle AI, opposite appetite for risk.

### 11.4 The two findings that were about the instrument

Both are the same shape as §7.2's — the largest error in a tuning pass turning
out to be a premise — and both were caught by a number refusing to move.

**Move rewards were valued against the wrong Pokemon.** `valueOfReward` scored
a TM by what it did for the *lead*, while `greedyMoveRecipient` hands it to
whoever gains most. With one Pokemon those were the same number; with three they
are not, and from 4.6b moves are the primary power axis. The symptom was
doubling every `tm` and `tutor` weight in the pools and watching the take rate
move by under a point. Scoring against the real recipient took move take from
23% to 33% and completion from 1.7% to 2.5% with no data change at all.

**Berries were indistinguishable from gear.** `valueOfItemFor` returned a flat
50 for every non-type item, so an Oran Berry scored the same as a Leftovers: the
bot neither used them nor discarded them, and the first report showed 88% of
late parties carrying one. That read as berries clogging the bag; it was the bot
unable to tell them apart. `ITEM_VALUE` now covers them, valued below every held
item and above nothing, which is the design stated as a policy.

Neither is a balance change and both moved balance numbers. That is the standing
hazard of this document: the simulator is the instrument *and* a player, and a
number that will not move is as often the instrument as the game.

### 11.5 Berries fade, and one target misses

| segment | eaten per run |
|---|---|
| 1 | 0.09 |
| 2 | 0.19 |
| 3 | 0.09 |
| 4 | 0.06 |
| 5 | 0.04 |
| 6 | 0.01 |
| 7 | 0.00 |
| 8 | 0.01 |

The fade is exactly the shape the design asks for: consumption peaks in segment
2 and is gone by 6. **The carrying number misses**: 67.3% of parties reaching
gym 6 still hold at least one berry, against a 50% target, at a mean of 1.09
each.

It is a miss and it is not the one it looks like. Consumption is low in absolute
terms everywhere — 0.19 per run at its peak — because most berries fire on a
condition (below half HP, a status landing) that a short fight never reaches.
That is README open question 1, "fights are short early", showing up in a new
place rather than a berry problem: a berry that is never *triggered* is also
never *spent*, so it sits in the bag looking like clutter.

The fix is therefore not backpack capacity and not the berry table. It is
whatever makes early fights longer, and that is a question for a stage with EV
and IV spreads in it. Recorded, not acted on.

### 11.6 What else the report says

- **Capture take fell to 29.0%** from 4.6a's 46.5%, on the same 7.97 offers per
  run. The bot is choosier because a captured Pokemon now competes against a
  *banded* kit rather than against whatever the starter happened to roll —
  which is the capture system and the ramp interacting exactly as intended.
- **Gym 8 diversity holds**: 37 parties carrying 92 distinct species, mean 4.46
  types each.
- **The depth tests pass unchanged.** `random` completes 0.0% of runs, clears
  gym 6 in 0.8%, and gets past gym 3 in 21.0%.
- **Reward take by kind**: currency 29.8%, item 29.0%, tutor 19.3%, tm 12.3%,
  heal 9.7%. The open item from 4.5.2 — gym currency taking 59.7% of picks —
  **is closed**: currency is under a third of all picks and no kind dominates.
  The stage's own prediction was that currency had been winning against a weak
  field, and a banded field is what it was measured against.

## 5. Running it yourself

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --seeds 1000 --policy greedy
npm run sim -- --nodes all               # compare node-choice playstyles
npm run sim -- --set stepsPerSegment.min=6 --set stepsPerSegment.max=8
npm run sim -- --seeds 1000 --policy switching   # Stage 4's headline pair
npm run sim -- --seeds 1000 --policy catching    # Stage 4.6a's headline pair
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


## 12. Stage 4.6c — relics, and what the report now measures

**Benchmarked on mean gyms cleared, not completion rate.** Completion is a
rare-event statistic sitting at a few percent, and it throws away every run
that died at gym 3 — which is most of them. Mean gyms uses the whole sample and
moves on changes completion cannot see. Completion stays in the report; it is
no longer the number a change is judged on.

Every figure below is stamped with its seed prefix and count, in the table,
next to the number. Reading across prefixes has already produced one false
finding in this project (see §0) and the stamp is what stops it happening
twice.

### What the report gained

- **Gate band per capability.** The share of events resolving `none`, `latent`
  and `known`, broken out per capability rather than as one number, because it
  splits hard and the split is the point. If `known` fires in under about 5% of
  events across the sample, relics are too rare and the mechanic is decoration;
  the report prints that verdict itself.
- **Relic acquisition rate**, and the distribution of how many relics a run
  ends holding.
- **A never-offered check**, in the same spirit as the locale UNREACHABLE line:
  a relic that never appears on a card anywhere in the sample is named.
- **Mean gyms, holders against non-holders.** Correlational and confounded —
  relics come from elite and gym nodes, so a holder already survived the risky
  path — and printed with both sample sizes and a line saying so. A flag, not a
  finding.
- **`--policy relics`**, running `relic-greedy` against `tier-greedy`. Same
  node appetite, same seeds; the only difference is whether the pick is spent
  on the relic. It exists because `valueOfReward` prices a relic at a flat
  guess — the bot cannot see whether an event needing that capability is still
  ahead of it — and a guess should not be the only measurement of the thing it
  guesses at.

### First readings, 120 seeds, prefix RELICS

| measure | value |
|---|---|
| relic offers per run | 1.17 (greedy) / 2.52 (relic-greedy) |
| mean relics held at run end | 1.07 / 2.32 |
| events resolving `known` | 10.8% / 19.1% |
| events resolving `latent` | 35.3% / 31.8% |
| relics never offered | none |

`known` clears the 5% decoration threshold on both policies. The
per-capability spread is real and is the input to weighting `data/events.ts`,
which is not yet done — every capability is named by exactly one event today.

Not acted on, per §0. Recorded, direction noted, moving on.
