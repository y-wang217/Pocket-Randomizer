# Moveset pool validation

**2026-09-17.** Written against the brief in
[`../spec/gymrun-patch-shop-and-moveset-variance.md`](../spec/gymrun-patch-shop-and-moveset-variance.md),
which asks for this report *before* the patch it belongs to. Static analysis
only, by the brief's own answer to question 4: no simulator run, no benchmark,
nothing here gates anything.

Every figure comes from `npm run pool-report` (`scripts/pool-report.ts`), which
is committed with this document so the numbers can be re-derived rather than
remembered. Section 4's rolls are stamped with a seed count and a prefix,
`POOL`, and are read down that prefix and never across — `balance.md` §0.

Two questions were asked. The answer to the first is that the thing the brief
suspected is not a weighting problem but a structural one, and the answer to the
second is that the obvious lever for it makes the problem worse.

---

## 0. The two answers, up front

**"I have never seen a status move offered."** You cannot be. All four routes
that hand the player a move call `damagingInBands()`, which filters
`DAMAGING_MOVES`. There is no weight, price or table edit anywhere in `data/`
that could have produced a status move, because status moves are not in the
table those routes read. §2.

**"Are starter movesets all possible moves, or the species' learnable moves?"**
All possible moves. **There are no learnsets in this project at all** — the
bundle ships none and `data/capabilityTypes.ts` records that as permanent, not
as a gap. Any species can hold any move. The only filter is *type
plausibility*: slot 1 is forced to the species' own types, and 30% of the
remaining slots re-roll the same way. §3.

And the second answer is where the early game's problem is. Segments 0, 1 and 2
all draw from band 1 alone — 82 moves, for the player and for every opponent
through gym 2 — and band 1's per-type slices are thin enough that the forced
slot stops being a draw at all. **13 of the 191 starters have exactly one legal
first move**, and for four of them it is in the wrong attack category.

---

## 1. What the pool holds

397 damaging, 61 status. The move blacklist is empty (`data/blacklists.ts:113`),
so every one of them is drawable.

| band | damaging | | impact | status |
|---|---|---|---|---|
| 1 | 82 | | setup | 18 |
| 2 | 98 | | recovery | 15 |
| 3 | 122 | | pressure | 16 |
| 4 | 95 | | status | 12 |

Every band carries all eighteen types, which `test/randomizer.test.ts` already
asserts. **The status pool does not: Ice has none**, and the distribution skews
hard to Normal 21, Psychic 8, Grass 6, with eight types at exactly one.

Recorded, not fixed here. A status move is not coverage, so a type gap in that
pool is not the defect a type gap in a band would be — but it does mean that a
shop slot selling status moves will read as "mostly Normal", and that is the
number a later tuning pass moves. It belongs in `STATUS_BY_IMPACT`
(`scripts/gen-pools.ts:350`), which is a hand-picked list rather than a filter,
so widening it is a curation decision and not a code change.

## 2. Why a status move has never been offered

Four routes hand the player a move. All four read the same function.

| route | site | draws from |
|---|---|---|
| reward card | `core/rewards.ts:352` | `damagingInBands` |
| shop TM / tutor | `core/economy.ts:155` → `resolveRewardEntry` | same |
| event move grant | `core/events.ts:453` | same |
| gym clear move | `GYM_MOVE_ENTRY` (`data/rewardPools.ts:368`, `kind: 'tutor'`) | same |

`damagingInBands` (`core/randomizer.ts:389`) filters `DAMAGING_MOVES`, and
`DAMAGING_MOVES` cannot contain a status move by construction: the generator's
own filter returns false on one (`scripts/gen-pools.ts:324`).

`STATUS_MOVES` is built from the hand-picked `STATUS_BY_IMPACT` list and reaches
exactly one consumer — `STATUS_AVAILABLE` (`core/randomizer.ts:497`) — read only
by `rollMoveset`, which places one in the **last slot only**, with probability
`MOVESET.statusChance = 0.55` (`data/scaling.ts:376`).

**So the asymmetry is total, and that is why it went unnoticed.** Measured over
6000 real starter rolls, **55.1% of starters open holding a status move** —
matching `statusChance` to the digit, which is also a decent check that the
instrument is reading the real generator. The moves are on screen from the first
minute of every other run. They have simply never been for sale.

This is not a balance finding. Nothing was tuned wrongly; a whole category of
the move table was never wired to the offer system. The fix is a new reward
kind, not a new weight.

## 3. What a starter's moveset actually is

No learnsets exist. `rollMoveset` (`core/randomizer.ts:534`) fills four slots:

- **Slot 1** is `takeDamaging(true)` — a damaging move of one of the species'
  own types, drawn from the slot's band.
- **Slots 2 and 3** draw open coverage, except that each re-rolls as
  type-restricted with probability `MOVESET.stabBias = 0.3`.
- **Slot 4** is a status move with probability `statusChance = 0.55`, otherwise
  another attack.

A starter draws from `flatPool(STARTER_MOVE_BANDS)` = band 1 only
(`data/starters.ts:110`). And every opponent through gym 2 draws from band 1
too — segments 0, 1 and 2 all carry `moveBandWeights: { 1: 1 }`
(`data/scaling.ts:174, 182, 190`).

### 3a. Band 1 by type, which is the table the whole early game rests on

| type | b1 | b2 | b3 | b4 | band-1 split |
|---|---|---|---|---|---|
| Normal | 17 | 13 | 12 | 8 | 13P / 4S |
| Grass | 8 | 6 | 10 | 6 | 6P / 2S |
| Poison | 8 | 4 | 5 | 2 | 4P / 4S |
| Water | 5 | 7 | 12 | 5 | 1P / 4S |
| Fighting | 5 | 7 | 6 | 9 | 4P / 1S |
| Bug | 5 | 2 | 8 | 1 | 3P / 2S |
| Rock | 5 | 4 | 3 | 3 | **5P / 0S** |
| Electric | 4 | 7 | 6 | 9 | 1P / 3S |
| Ghost | 4 | 5 | 2 | 3 | **4P / 0S** |
| Fire | 3 | 7 | 9 | 10 | 1P / 2S |
| Ice | 3 | 8 | 4 | 4 | 1P / 2S |
| Ground | 3 | 3 | 4 | 4 | 1P / 2S |
| Flying | 3 | 5 | 2 | 6 | 2P / 1S |
| Fairy | 3 | 1 | 5 | 2 | **0P / 3S** |
| Dark | 2 | 9 | 10 | 1 | 1P / 1S |
| Steel | 2 | 2 | 3 | 9 | **2P / 0S** |
| **Psychic** | **1** | 5 | 15 | 4 | **0P / 1S** |
| **Dragon** | **1** | 3 | 6 | 9 | **0P / 1S** |

**Six types' band-1 pool is entirely one attack category.** Psychic, Dragon and
Fairy are special-only; Rock, Ghost and Steel are physical-only.

### 3b. The forced slot, measured

Across all 191 starters:

| STAB window | mean options | deterministic | ≤3 options | both categories available |
|---|---|---|---|---|
| **band 1 — today** | **6.8** | **13 (6.8%)** | **49 (25.7%)** | **83.8%** |
| bands 1–2 | 14.5 | 0 | 0 | 99.0% |
| bands 1–3 | 25.3 | 0 | 0 | 100% |

The thirteen with no choice at all:

| species | types | the only legal first move |
|---|---|---|
| Abra, Drowzee, Spoink, Chingling, Munna, Gothita, Solosis, Elgyem | Psychic | Confusion (Special 50) |
| Dratini, Bagon, Axew, Goomy, Jangmo-o | Dragon | Twister (Special 40) |

**Every Psychic starter opens with Confusion. Every Dragon starter opens with
Twister.** On the headline slot of the run's opening position there is no draw.

And for five of them the forced move is in the wrong category. Checked against
the dex rather than assumed:

| species | Atk | SpA | forced slot 1 |
|---|---|---|---|
| Axew | **87** | 30 | Twister, Special 40 |
| Bagon | **75** | 40 | Twister, Special 40 |
| Dratini | **64** | 50 | Twister, Special 40 |
| Jangmo-o | **55** | 45 | Twister, Special 40 |
| Drowzee | **48** | 43 | Confusion, Special 50 |

Axew is the sharp case: base Attack 87, base Special Attack 30, and a guaranteed
40 BP special move in the slot the design calls its headline. That is a dead
slot handed out deterministically, and it lands on the pseudo-legendary base
forms that Stage 4.9's starter rule went out of its way to admit.

### 3c. What a real starter roll looks like

6000 rolls, 2000 seeds, prefix `POOL`:

| | |
|---|---|
| mean distinct attacking types | 2.73 |
| one attacking type or fewer | 4.8% |
| carries a Normal-type attack | **37.4%** |
| carries a status move | 55.1% |
| mean damaging moves | 3.45 |

**Breadth is not the problem.** 2.73 distinct attacking types out of 3.45
damaging moves is close to the ceiling. What is thin is the *quality* of the
forced slot and the *kind* of the coverage: better than a third of all starters
carry a Normal-type attack, which is the worst coverage type in the game —
resisted by Rock and Steel, and doing nothing at all to a Ghost.

## 4. The lever that does not work, and why

The obvious response to "coverage is oppressive" is to loosen `MOVESET.stabBias`
so fewer slots are type-restricted. **That is the wrong lever, and this is the
finding most worth writing down**, because it is cheap to reach for and it makes
the game worse in a way a breadth statistic would not show.

Normal's share of each band:

| band | Normal | of | share |
|---|---|---|---|
| 1 | 17 | 82 | **20.7%** |
| 2 | 13 | 98 | 13.3% |
| 3 | 12 | 122 | 9.8% |
| 4 | 8 | 95 | 8.4% |

A coverage slot that `stabBias` does *not* restrict draws uniformly from its
band, so the chance it comes back Normal is exactly Normal's share of that band.
**Every slot handed back to open coverage at band 1 is a one-in-five chance of a
Normal move.**

The arithmetic, anchored on the measured baseline above. With 3.45 damaging
moves of which one is the forced STAB slot, a starter has ≈2.45 coverage slots,
of which `1 - stabBias` are open:

| `stabBias` | open coverage draws | P(no Normal) = 0.793^n | carries a Normal attack |
|---|---|---|---|
| **0.30 — today** | 1.72 | 0.67 | **37.4%, measured** |
| 0.15 | 2.08 | 0.62 | ≈ 43% |
| 0.00 | 2.45 | 0.57 | ≈ 48% |

So loosening `stabBias` to zero buys about half a distinct attacking type and
raises the Normal rate by ten points. It trades a moveset that is narrow and
*typed* for one that is broad and *beige*, and it does nothing whatever about
the thirteen starters with no first-slot draw, because that slot is forced by
`stabSlots`, not by `stabBias`.

**`stabBias` is declined.** Recorded here with the number so that the next
session reaching for it finds this paragraph first.

## 5. The confound to name before any benchmark is read

**There are two replacement heuristics, not one, and they behave differently.**
Worth stating plainly because they are easy to confuse and only one of them is
what a benchmark measures.

- `defaultMoveReplacement` (`core/run.ts:2388`) returns
  `weakestSlot ?? statusSlot ?? 0`. It displaces the weakest *damaging* move and
  reaches a status slot only when the member holds no damaging move at all — so
  it **never** discards a status move in practice. This is the reference
  heuristic `scriptedRunPolicy` uses, which means the **tests**, not the
  simulator.
- `greedyMoveToReplace` (`scripts/sim.ts:1243`) is what the **simulator**
  actually runs. It drops the first status move when a member holds *more than
  one*, and otherwise the weakest damaging move.

So the confound is real but narrower than "the bot hoards status moves": the sim
will shed a spare, and will otherwise pay for a technique with an attack slot
every single time. Since the sim's battle policy is a one-turn damage maximiser,
a move whose value lands on the *next* turn scores zero on the turn it is
offered while its cost is immediate and visible. **Any post-patch figure on
technique demand is measuring those two policies at least as much as the move.**

Named rather than fixed: changing either is a change to what the baseline bot
*is*, and `balance.md` §0 is explicit that the yardstick does not move in the
same patch as the thing it measures.

## 6. What this report recommends

### Status moves are sold, not dropped

A new reward kind rather than a new weight, because §2 says the problem is
structural. Shop-primary with a guaranteed shelf slot, plus a low-weight entry
in the elite reward pool only — the brief's answer to question 3. Normal, hard,
gym and event grants stay damaging-only, so the brief's own split holds: battles
pay coverage, shops pay options.

**All four impacts, unrestricted.** `CLAUDE.md`'s blacklist discipline is
explicit that a curated list starts near-empty and is populated from simulator
evidence, never from a feeling that something is strong. The entry ships an
`impacts` field anyway, so a later pass that *does* have evidence has the lever
without a code change.

### The forced STAB slot gets a band window

`MOVESET.stabWindow = 1`: the slot draws from its band **and the one above**.
From §3b that is 6.8 → 14.5 mean options, 13 deterministic starters → 0, and
six single-category types → one (Steel).

**It costs no extra randomness.** `take()` is one `pick` whatever the pool size,
so the number of times the stream is read is unchanged and stays a function of
`MOVESET.slots` alone — the property `rollMoveset`'s own docblock exists to
protect. This is the whole reason to prefer it over widening the band itself.

### Segments 0–2 stop being band 1 alone

`moveBandWeights` `{1: 1}` → `{1: 4, 2: 1}`. Band 2 is a minority, so the ramp
survives; but it is 13.3% Normal against band 1's 20.7%, so it dilutes the beige
problem from both directions at once. It applies to the player and to every
opponent equally, which is what gives gym 1 variance rather than giving the
player an advantage.

### Two levers deliberately not pulled

- **`stabBias`**, per §4.
- **`STARTER_MOVE_BANDS` `[1]` → `[1,2]`.** It would work, and it breaks the
  symmetry `data/starters.ts:110` argues for at length: the starter opens at
  band 1 *because its opponents do*. Left as a one-line lever if the two above
  under-deliver.

### What this report does not claim

Nothing here measures what any of it costs. The brief asked for static analysis
and this is static analysis. The benchmark row goes in `balance.md` §0 after the
patch, read against `randomizer-17 · 73c1ee` (0.0% completion, 0.47 mean gyms),
and it is **recorded, not chased** — balance is not a gate, and a population
that dies at gym 1 cannot see a segment-3 shop at all.
