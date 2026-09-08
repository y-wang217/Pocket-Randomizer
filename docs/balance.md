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

## 2. The shipped numbers

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

## 5. Running it yourself

```sh
npm run sim                              # 200 seeds, both policies
npm run sim -- --seeds 1000              # the report above
npm run sim -- --seeds 1000 --policy greedy
npm run sim -- --nodes all               # compare node-choice playstyles
npm run sim -- --set stepsPerSegment.min=6 --set stepsPerSegment.max=8
npm run sim -- --help
```

The balance levers are `src/data/scaling.ts` (the curve),
`src/data/starters.ts` (what the player begins with), `src/data/tuning.ts` (map
shape and recovery) and `src/data/blacklists.ts` (exceptions). If a tuning pass
ever needs to edit `src/core/randomizer.ts`, the split between logic and data is
wrong and that is the bug to fix first.

**Changing any of those changes what every recorded seed produces.** Bump
`RANDOMIZER_VERSION` in `src/core/randomizer.ts` when you do, or a shared seed
quietly becomes a different run.
