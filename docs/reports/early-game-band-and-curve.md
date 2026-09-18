# The early-game band recut and the level curve

**2026-09-17.** Written against
[`../spec/gymrun-patch-band-recut-and-level-curve.md`](../spec/gymrun-patch-band-recut-and-level-curve.md),
which asks for a report before any code and treats it as a hard stop. This is
that report, and it is also the **decision record**: every number the patch moves
is here with the measurement that chose it and the user's answer that settled it,
so a later reading of `balance.md` can find out where these values came from
rather than inferring them.

Nothing here gates anything. `balance.md` §0 still stands: balance is not a gate.

Two instruments produced these figures, both throwaway and neither committed —
every one is re-derivable from the description beside it:

- A band census over `DAMAGING_MOVES`, reproducing `gen-pools.ts`'s
  `effectivePower` multi-hit correction exactly (it reproduces all 397 emitted
  bands with zero mismatches).
- A learnset walk over `@pkmn/sim`'s gen-9 dex. **This is a new kind of evidence
  for this project.** [`moveset-pool-validation.md`](moveset-pool-validation.md)
  records that there are no learnsets in the bundle at all and that this is
  permanent — which is true of the *shipped game* and does not stop the dex from
  being read at analysis time. The ramp has never had an external reference
  before; it has one now.

---

## 0. The answers, up front

**"Having t2 band moves means early battles are a huge swing."** True, and worse
than the tables say. Segments 0-2 are written as `{1: 4, 2: 1}` — 80/20 — and
measured over 600 seeds gym 1 actually fields **61% band 1 / 34% band 2 / 5%
band 3**. Two channels leak: `MOVESET.stabWindow = 1` lets the forced STAB slot
read its band *and the one above*, and `rollMoveset`'s
`take(from) ?? take(inBand) ?? take(pool.all)` fallback reaches the whole pool
when the type filter empties. §1.

**"Move the threshold for what is considered t1 vs t2."** Right instinct,
wrong direction on its own. At level 7 the super-effective one-shot line sits at
about 60 BP — which is exactly where the old cut already was. Raising the t1
ceiling to 65 without anything else would have *admitted* Ancient Power, Rock
Tomb, Stone Axe, Spark and Shock Wave into gym 1 at 100% instead of 36%. What
makes the recut work is that it is paired with closing the window. §2.

**"Check what the real games track as available moves."** Done, 900 species, 0
failures. The existing gym-1 weights are almost exactly right and the *late* game
is the under-specified end. §3.

**"Raise levels."** Justified — but on evolution pacing, not on swing. Raising
levels makes gym 1 *more* lethal, not less, and this report says so plainly
because the earlier conversation implied the opposite. §4, §5.

---

## 1. Where band 2 comes from, and it is not the weights

`40dbb0b` (2026-09-17, the shop and moveset-variance patch) moved segments 0, 1
and 2 from `moveBandWeights: { 1: 1 }` to `{ 1: 4, 2: 1 }`. That change is not
mentioned in the commit message, which describes the `stabWindow` addition landed
alongside it. `starters.ts:106` still says "segments 1-2 draw band 1 only", stale
since that commit.

Measured per-slot band mix, 600 seeds per cell, damaging slots only:

| | b1 | b2 | b3 | b4 |
|---|---|---|---|---|
| seg 0-2, normal/hard | ~58% | ~36% | ~5.5% | — |
| seg 2, elite | — | 58% | 37% | 4.8% |
| Gym 1 (Garnet, Rock) | 61% | 34% | 5.1% | — |
| Gym 2 (Marina, Water) | 57% | 37% | 6.0% | — |
| Gym 3 (Volta, Electric, +1) | — | 61% | 33% | 5.6% |

Gym 3's eight most common draws are Zing Zap 80, Wild Charge 90, Thunder Cage 80,
Spark 65, Discharge 80, Thunderclap 70, Shock Wave 60, Overdrive 80. Elite does
not exist before segment 2 (`tierBands` gives it weight 0 through segment 1), so
segment 2 is the first place the 37%-band-3 nodes appear.

**A separate leak, larger and on the player's side.**
`rewardMoveBand(0, 'elite', GYM_MOVE_BAND_BONUS)` resolves to band 4:
`segmentMoveBand(0)=1` + `REWARD_BAND_OFFSET.elite=2` + the gym's own +1, clamped
at the ceiling. Confirmed 300/300 — gym 1 hands out Fire Blast 110, Cross Chop
100, Sacred Fire 100, Overheat 130. The player leaves the first gym at level 14
holding a top-band move.

## 2. The recut, and why these four cuts

`POWER_CUTS = [60, 75, 90, 110]`.

| band | range | moves | share |
|---|---|---|---|
| 1 | ≤60 | 117 | 29.5% |
| 2 | 61-75 | 63 | 15.9% |
| 3 | 76-90 | 114 | 28.7% |
| 4 | 91-110 | 58 | 14.6% |
| 5 | 111+ | 45 | 11.3% |

**Zero moves have effective power in 91-94 or in 111-119.** The cuts land in the
dex's own empty ranges, so no move is reclassified by an arbitrary edge. Band 5
is coherent on inspection rather than only by count: Close Combat, Flare Blitz,
Draco Meteor, Overheat, Boomburst, Head Smash, Gigaton Hammer, Volt Tackle —
recoil, stat-drop and signature moves, which is what the prompt guessed it would
be.

**What the recut buys that a relabel would not:** band 1 goes from 82 moves to
117, and its per-type slices stop being degenerate. Types whose entire band-1
pool is one attack category drop from 6 to 3; types with fewer than three band-1
moves drop from 4 to 2. That is what makes closing `stabWindow` affordable —
the window exists precisely because band 1 held one Psychic move and one Dragon
move.

**Three type gaps are opened and accepted.** Band 2 has no Dragon, band 4 no Bug,
band 5 no Dark. `test/data-tables.test.ts` asserts every band holds all 18 types;
it is relaxed to "every band is non-empty" plus a pinned list of these three, so
a future regeneration surfaces any change to the set. A Dragon species drawing
band 2 falls back off-type and loses STAB for that slot. The user accepted this
on the same terms as the Psychic case below.

**Band 1's remaining thin types, with the window closed:** Psychic holds exactly
one band-1 move (Confusion 50, special), Steel two (Metal Claw, Bullet Punch,
both physical), Fairy three (Draining Kiss, Disarming Voice, Fairy Wind, all
special). Every Psychic species' forced first slot is therefore Confusion,
deterministically — the exact defect `stabWindow` was added to fix. The user
accepted it, in these words: *"psychic is a strong typing and needs investment to
win."*

## 3. The learnset validation

Gen-9 level-up learnsets for all 900 pool species, pre-evolution chains walked
(an evolved form inherits its pre-evo's level-up moves), TM and tutor moves
excluded to stay conservative. Scored two ways; the second is the honest one,
because a Pokemon carries four moves and not its whole history.

**Best move in the 4 most recently learned, scored against the new bands:**

| gym | lvl | median BP | b1 | b2 | b3 | b4 | b5 |
|---|---|---|---|---|---|---|---|
| 1 | 15 | 60 | 58% | 18% | 13% | 2% | 9% |
| 2 | 19 | 65 | 48% | 26% | 17% | 2% | 7% |
| 3 | 24 | 70 | 29% | 34% | 30% | 2% | 5% |
| 4 | 29 | 80 | 17% | 29% | 44% | 4% | 6% |
| 5 | 31 | 80 | 14% | 25% | 48% | 5% | 8% |
| 6 | 33 | 80 | 11% | 20% | 51% | 8% | 11% |
| 7 | 42 | 90 | 5% | 7% | 43% | 16% | 29% |
| 8 | 46 | 100 | 5% | 4% | 34% | 19% | 38% |

Two findings:

1. **The gym-1 weights were never the problem.** Real games give 58/18 at level
   15; the table says 80/20. The gap between 80/20 and the *measured* 61/34 is
   the leak in §1, not the weighting.
2. **The late game is under-specified, not over.** Real gym 8 is 38% band 5. The
   old table topped out at old-band-4 and had nothing above it. Band 5 has a job.

The per-segment weights are fitted to this table:

| seg | gym | lvl | b1 | b2 | b3 | b4 | b5 | modal | gym pays |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 1 | 15 | 4 | 1 | | | | 1 | 2 |
| 1 | 2 | 20 | 3 | 2 | | | | 1 | 2 |
| 2 | 3 | 26 | 2 | 3 | 2 | | | 2 | 3 |
| 3 | 4 | 32 | 1 | 3 | 4 | | | 3 | 4 |
| 4 | 5 | 38 | | 2 | 5 | 1 | | 3 | 4 |
| 5 | 6 | 44 | | 2 | 5 | 1 | 1 | 3 | 4 |
| 6 | 7 | 50 | | | 4 | 2 | 2 | 3 | 4 |
| 7 | 8 | 58 | | | 3 | 2 | 4 | 5 | 5 |

Note the recut **silently reinterprets every pre-existing weight** — old band 3
(76-95) splits across new bands 3 and 4 — so all eight rows had to be rewritten
whatever the fit said. There was no option to leave the late rows alone.

## 4. The level curve, and the two goals the dex will not give

Evolution reachability over the 191-line starter pool, against the baked
`evoLevel` table:

| curve | gym 2 stage 1 | gym 4 full | gym 6 full | gym 7 full |
|---|---|---|---|---|
| goal, as stated | most | two-stage done | **all** | **pseudos too** |
| current `[7,14,20,27,33,40,47,55]` | 1% | 14% | 84% | 91% |
| Emerald verbatim `[15,19,24,29,31,33,42,46]` | 17% | 17% | 38% | 88% |
| **stretched `[15,20,26,32,38,44,50,58]`** | **20%** | **36%** | **89%** | **97%** |

**Emerald verbatim is worse than the status quo through the whole midgame.** Its
gyms 4/5/6 sit at 29/31/33 — four levels across three segments — while the dex's
final-evolution mass is at 30-36 (median 35, p75 36). The curve parks under the
entire cluster for three gyms. It also ends at 46, below every pseudo-legendary's
final threshold, so Garchomp 48, Metagross 45 (reachable), Salamence 50,
Tyranitar 55 and Dragonite 55 could never finish in any run.

The stretched curve keeps the gym-1 anchor at 15, keeps Emerald's early shape,
removes the flat middle, and ends at Emerald's own Champion level. Gym 8 at 58 is
also barely a move from today's 55, so the top of the curve stays comparable.

**Two stated goals are not met, and are recorded rather than closed:**

- *"First evolutions by gym 2"* reaches 20%. Dex stage-1 levels cluster at 16-30;
  a majority needs gym 2 at about level 26, which makes the opening a sprint.
- *"Late bloomers by gym 7."* Gym 7 is fought at level 50, so Gengar (50),
  Machamp (50) and Golem (42) already land there under the stretched curve. **The
  only miss is Alakazam at 55**, which is a synthetic threshold and is lowered to
  50. Tyranitar and Dragonite at 55 are *real dex levels*;
  `evolutionThresholds.ts` forbids itself from raising those ("Kaizo changes
  methods, not levels") and they finish at gym 8 — which is the Dragon gym, and
  arguably where they belong.

## 5. The finding that runs against the plan's intent

**Raising levels does not soften the swing. It sharpens it.**

The damage formula's level term is `floor(2L/5) + 2` — 4 at level 7, 8 at level
15, a clean doubling. HP is `floor((2B+31)L/100) + L + 10` — median 26 at level
7, 44 at level 15, a factor of 1.69. Damage outgrows HP, because the flat `+10`
dominates HP at very low level and stops mattering by 15.

Expected chance a STAB super-effective hit one-shots, per damaging slot, averaged
over every drawable move × every starter-pool defender:

| config | OHKO rate |
|---|---|
| today, gym 1 @ L7, measured mix | 14.2% |
| gym 1 @ L7, new cuts + window closed | **11.3%** |
| **proposed, gym 1 @ L15, new cuts + window closed** | **22.3%** |
| proposed, gym 1 @ L15, band 1 only | 13.2% |
| proposed, gym 2 @ L20 | 26.9% |
| proposed, gym 3 @ L26 | 42.1% |

The band work does what it was asked to do — 14.2% → 11.3%, a fifth off. The
level raise then takes it to 22.3%. **Net, gym 1 gets more swingy, not less.**

Three things bound how bad that is:

- Neutral-damage OHKO rate is 0.0-0.6% at every level and every config. All of
  the swing is super-effective hits. "Early battles are a huge swing" is
  precisely "type advantage one-shots", which is ordinary Pokemon and is the one
  forecast the UI is already allowed to show (`CLAUDE.md`, the live
  type-effectiveness exception).
- HP spread does not improve with level either: coefficient of variation is 7% at
  level 7 and 9% at level 32; p90/p10 goes 1.17× to 1.22×. Bulk never becomes a
  differentiator at any level on this curve. **If bulky-versus-frail should
  register as a choice, level is not the lever** — that is a live open question
  this patch does not answer.
- The level raise is justified on §4 and nothing else. It is not a swing fix.

The user accepted the rise, with the design reading that goes with it:

> this shouldn't feel as bad as it does. players are just desperate to find a
> type advantage against gym 1, which is fine. since starters are now not
> guaranteed to be better than wild mons, catching and strategizing for gym 1
> actually becomes gameplay important. i'd lke to try these changes before
> refining further

That is the intended outcome, not a tolerated cost: Stage 4.9 made the starter a
band-0 base form, so the counterplay to a type-advantaged gym is the guaranteed
wild encounter the segment already contains. Whether it lands is a playtest
question, and this row of `balance.md` is where the next reading goes.

> **Added after the build, because the benchmark disagreed with this section and
> the report is not edited to hide that.** The per-slot arithmetic above is
> right — the one-shot rate does rise from 14.2% to 22.3%. The *outcome* went the
> other way: gym 1 clears 56.4% against 48.3%, and mean gyms 0.545 to 0.56.
>
> What this section did not price is that closing the STAB window is the larger
> effect. Gym 1 now fields 83% band 1 / 17% band 2 / no band 3, where the leak in
> §1 was producing 61/34/5. A player meeting fewer band-2 moves and no band-3
> moves wins more often even though each individual super-effective hit is
> likelier to kill. Those are two different measurements and this section
> conflated them.
>
> The lesson worth keeping: a per-slot damage statistic is not a win rate, and
> this report reached for the first because it could compute it without running
> the game. `generation.md` §33.7 and the `randomizer-19` row of `balance.md`.

## 6. The gym reward, and a rule that is deleted

The gym clear paid `segment + 3` (§1). It now pays `segment + 1`, which for gym 1
is band 2 and for gym 8 is band 5.

That breaks a stated invariant. `rewardPools.ts` argues the gym offer must be
"strictly better than elite", and an elite node pays `+2`. The user's resolution
does not preserve the band ordering — it replaces the axis the comparison is made
on:

> gym already pays +1 move and relic/gold, which is strictly better than +2 move.
> elites are also just the move, while gyms also unlock a level up to the next
> tier. elites being better rewards/harder than a gym is also not terrible. the
> player makes that decision going in. Instead, give gyms a choice between 3 +1
> moves and the relic and the gold, then elites +2 move pales in comparison.

So the gym clear becomes **two pages**: three moves at segment +1, then three
cards from relic/gold. A gym pays more than an elite by volume and by the level
step it unlocks, not by band. Per `CLAUDE.md` the superseded rule is deleted from
the lineage rather than left behind a flag, and recorded in
[`../generation.md`](../generation.md) section 36 and the invariant register in
[`../README.md`](../README.md).

Both pages are exactly three options, which is the rewards invariant the old
two-card gym offer did not satisfy.

## 7. What to read next

- The benchmark row this patch is measured by: [`../balance.md`](../balance.md),
  read down the `RETUNE` prefix and never across. The row above it is
  `randomizer-18` · `fd9b5e`, 400 seeds, 0.545 mean gyms.
- What was built and where it deviated: [`../generation.md`](../generation.md)
  section 36.
- The prompts, verbatim:
  [`../spec/gymrun-patch-band-recut-and-level-curve.md`](../spec/gymrun-patch-band-recut-and-level-curve.md).
- The report this one follows, and whose §3 finding this patch reverses:
  [`moveset-pool-validation.md`](moveset-pool-validation.md).

**Two numbers to check at the next playtest**, because they are the ones this
report is least sure of: whether 22.3% at gym 1 reads as "find a type advantage"
or as "unwinnable", and whether the 24 evolved species that become drawable at
gym 1 under the new curve (the stage gate widens implicitly when `level.min` goes
from 4 to 15) make the first gym a different fight than intended.
