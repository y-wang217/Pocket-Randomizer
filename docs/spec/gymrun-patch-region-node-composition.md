# Patch: no double rest, no double shop, and no trivial path

**Filed 2026-09-19**, on `claude/t2-berry-inventory-gating-7gvcye`, before any
work. It arrived mid-session, while the Toll price gate was finishing, and is
filed as it was written.

**It asks for research before code, and section 2 is therefore a hard stop.**
The brief names a constraint and then, in the same breath, asks what the
current limit *is* and what the alternatives are — so the constraint is a
proposal to be weighed, not an instruction to implement. `CLAUDE.md`, Process:
"Where a prompt says to report before writing code, that is a hard stop."

## The brief, verbatim

> Also make it impossible to encounter 2 rest/shop nodes in 1 region. Max 2 rests and max 2 shops also. Before the change find out what is the current limit and then weigh the possible node manipulations we can do to ensure theres no trivial paths in a region. Double rest/shop definitely feels bad tho

## What it does not settle, and the report must

Four things, all of which change what gets built:

1. **What "region" means.** A segment, a locale route within a segment, or one
   walkable path through a segment. The three are different objects and only
   one of them is what a player experiences as "a region".
2. **Whether "max 2 rests and max 2 shops" is per region or per run.** Read
   against the first sentence it is a second, looser bound on the same object;
   read on its own it is a run-wide budget.
3. **Whether the bound is on what is *generated* or on what is *walkable*.**
   The keyed-stream discipline draws every branch, including ones the player
   never visits, so a rule about a *path* is a rule about a walk rather than
   about a draw.
4. **"No trivial paths"** names a property the brief does not define. The
   report has to say what a trivial path is in measurable terms before it can
   say whether one exists.

## The invariant it runs into

`CLAUDE.md`, Randomness: everything structural is drawn at map generation in
one pass, keys are never derived from anything that varies with player
behaviour, and RNG consumption must not depend on how the run went. A
rejection-sampling rule ("redraw until no two rests are adjacent") consumes a
variable number of draws, and a rule applied at node entry is a lazy draw.
Both are barred. Whatever is built has to be a *fixed-cost* construction.

---

# The report. 2026-09-19. **Hard stop: no code written.**

Measured with a scratch census over `generateSegment`, 400 seeds x 8 segments
= 998 routes per segment (250 seeds for the second table). The instrument is
not in the repo; every number below is reproducible from `DEFAULT_TUNING` at
`contentHash` `d4e080`.

## 1. What the current limit is

**There is no ceiling anywhere. Only floors.** The question has three answers
because "region" has three readings, and they are not the same object:

| object | rule today | where |
|---|---|---|
| one **step** (the 2-3 options at one point on the route) | at most one rest and at most one shop, already | `tuning.distinctKindsPerStep: true` |
| one **route** (a locale's road through a segment) | **no cap at all.** Floors only: >=1 event, >=1 wild step, >=`restFloorForRoute` rests | `encounters.enforceComposition` |
| one **run** | no cap, and no counter exists | — |

A route's kinds are drawn per step by `sampleWeighted` off
`nodeWeights { wild: 5, trainer: 3, rest: 1, shop: 1.5, event: 2.5 }`, with no
memory of what earlier steps drew. Then `enforceComposition` **adds** kinds to
meet floors and never removes one.

## 2. The double rest is not a bad roll. It is guaranteed.

`restFloorFor` is `max(minRestSteps, floor(steps / restStepsPerGuarantee))` =
`max(1, floor(steps / 3))`. Segments 5 and 6 draw 6-7 steps, so their floor is
**2**, and `enforceComposition` converts options until it is met.

| seg | steps | rest floor | routes offering >=2 rests | >=3 | shops >=2 | >=3 | rests/route | shops/route (max) |
|---|---|---|---|---|---|---|---|---|
| 0 | 4.51 | 1 | 17.0% | 0.8% | 31.8% | 6.0% | 1.18 | 1.14 (4) |
| 1 | 4.51 | 1 | 16.2% | 1.8% | 32.1% | 6.6% | 1.18 | 1.15 (4) |
| 2 | 5.51 | 1-2 | 61.7% | 7.8% | 47.0% | 13.5% | 1.70 | 1.47 (5) |
| 3 | 5.48 | 1-2 | 61.2% | 7.2% | 45.2% | 14.4% | 1.69 | 1.47 (5) |
| 4 | 5.52 | 1-2 | 62.6% | 7.4% | 47.7% | 15.5% | 1.71 | 1.50 (5) |
| 5 | 6.49 | **2** | **100.0%** | 12.7% | 60.1% | 25.6% | 2.14 | 1.83 (5) |
| 6 | 6.52 | **2** | **100.0%** | 14.3% | 55.4% | 23.5% | 2.16 | 1.73 (5) |
| 7 | 6.51 | 1 | 18.2% | 1.8% | 32.9% | 6.9% | 1.20 | 1.14 (4) |

Segment 7 reads like segment 0 because `placeBattlePair` claims two steps and
`restFloorForRoute` drops that route back to the guarantee of 1.

**So "make it impossible to encounter 2 rest nodes in one region" is not a cap
being added on top of the current rules. It is a direct contradiction of
`restStepsPerGuarantee`, which mandates the second rest in segments 5 and 6.**
One of the two has to go, and that is a decision rather than an implementation
detail. Adjacent rest-offering steps (a rest at step *n* and at *n+1*) occur in
44% of segment 5-6 routes, which is likely the shape that "feels bad".

Shops are worse in one specific way and better in another: no floor forces
them, but nothing caps them either, so **a single route can offer five shops**
(seen at segments 2-6), and 1 route in 4 at segment 5 offers three or more.

## 3. What a trivial path is, measured

The brief names the property and does not define it. Three candidate
definitions, all measurable, and the numbers differ sharply:

| definition | segments 0-1 | segments 2-4 | segments 5-6 | segment 7 |
|---|---|---|---|---|
| steps where **every** option is a fight (forced fights) | 1.35 of 4.5 | 1.43 of 5.5 | 1.55 of 6.5 | 3.33 of 6.5 |
| steps where **no** option is a fight (a step that cannot be fought) | 0.29 | 0.42 | 0.48 | 0.29 |
| steps offering *some* non-fight option (the skippable walk) | 3.2 of 4.5 | 4.1 of 5.5 | 5.0 of 6.5 | 3.2 of 6.5 |

The third row is the real finding, and it dwarfs the double rest. **A player
who always takes the non-fight option fights 1.4 times in a 5-step region.**
Run-wide, a player who picks the route with the most rest+shop and takes every
one of them walks a mean of **14 rests and 16 shops**, and **33.5 of 46 steps
without a fight**. That is the trivial path, and capping rests at 1 per region
removes at most 6 of those 33 steps.

Note the second row: 26-42% of routes contain at least one step where *no
option is a fight*. Those steps are not a choice at all — they are a corridor —
and they are the cheapest thing on this list to remove.

## 4. The constraint every option has to satisfy

`CLAUDE.md`, Randomness. Whatever is built must draw a **fixed** number of
values, eagerly, at generation, with no key derived from player behaviour. That
bars the two obvious implementations outright:

- **Rejection sampling** ("redraw the step until the route has no second
  rest") — a variable number of draws.
- **A check at node entry** ("this rest is spent, show something else") — a
  lazy draw, and it would also make the map lie about itself.

The file has a further local discipline worth respecting: `assignTiers`
documents that its draw count "depends only on how many fights the step has,
never on what was drawn". `ensureKind`'s conversion loop already breaks that
mildly (one draw per conversion, count depends on the roll). A new pass should
not deepen it.

## 5. The five manipulations, weighed

### A. Weighted exclusion during the draw — *the cheapest and the one I recommend*

Carry an allowance per kind down the route and zero a kind's weight in
`sampleWeighted` once the route has spent it. One draw per pick, exactly as
today, so **the draw count does not move at all** — only the values do.

- Cost: reshuffles every recorded map. `RANDOMIZER_VERSION` bumps. That is
  unavoidable for every option on this list.
- Risk: a step late in a route can run out of allowed kinds and fall back to
  a narrow menu (wild/trainer), which is *good* for trivial paths and needs a
  test that no step ever empties.
- It composes with the floors only if the floor is lowered first — see §6.

### B. A ceiling pass after the floors

Mirror `enforceComposition`: walk the route, convert surplus rests/shops to
something else. Honest and legible, reuses `ensureKind`'s shape.

- Cost: one draw per conversion, so the draw count depends on what was drawn —
  it deepens exactly the dependency §4 flags. Worse than A for no gain.

### C. Adjacency only — no two consecutive steps offer the same kind

Directly targets "double rest feels bad" if what feels bad is back-to-back
(44% of segment 5-6 routes). Keeps the rest density, so it does not contradict
`restStepsPerGuarantee` and needs no balance decision.

- Cost: weakest of the five. A route can still offer three rests at steps
  0, 2, 4.

### D. A forced-fight floor — *the one that actually answers "no trivial paths"*

A new `minBattleStepsPerRoute`, the way `wildStepsPerSegment` already works:
*n* steps per route where every option is a fight. `placeBattlePair` is this
rule already, hardcoded to segment 7 and to two adjacent steps — so the
machinery exists and would be generalised rather than invented.

At `floor(steps / 2)` the 5-step region goes from 1.4 forced fights to 2, and
the 6-step from 1.5 to 3. This is the lever that moves the 33-of-46 number; the
rest/shop caps barely touch it.

- Cost: a real difficulty change, so it needs a benchmark row. It is also the
  one that could over-correct: at `floor(steps/2)` segment 5 starts to read
  like today's segment 7 gauntlet.

### E. A combined {rest, shop} class budget per region

"At most two service nodes per region, in any mix." Simpler to state than two
separate caps and closer to what a player perceives — they read both as "a step
where nothing fights me".

- Cost: needs the same allowance machinery as A; it is A with one counter
  instead of two.

## 6. The collision that has to be decided before any of it

**A cap of 1 rest per region cannot coexist with `restStepsPerGuarantee: 3`.**
Segments 5-6 are 6-7 steps, the density floor is 2, and the brief's first
sentence says 1. Three ways out, and this is a design call:

1. **Drop the density floor to the guarantee** (`restStepsPerGuarantee` out, or
   set so high it never binds). Every region offers exactly one rest. This is
   the largest single difficulty increase on the table — segments 5-6 lose a
   guaranteed heal in the longest regions of the run.
2. **Cap at 2, floor at 1.** Nothing contradicts; the double rest becomes
   possible-but-not-mandatory rather than impossible. This is what the brief's
   *second* sentence says if "max 2" is per region.
3. **Cap at 1 and let the floor win where they disagree** — i.e. cap = 1
   everywhere except where the density floor demands 2. Self-defeating: the
   exception is precisely segments 5-6, which is where the complaint came from.

## 7. What I need answered before writing code

1. **"Region"** — a segment, or one route through a segment? (A segment offers
   2-3 routes; capping the segment means the caps interact across roads the
   player will never walk, which is strange but cheap. Capping the route is
   what a player experiences.)
2. **"Max 2 rests and max 2 shops"** — per region, or per run? Per region it
   contradicts sentence 1 (which says max 1); per run it is a budget of 2 rests
   across 8 regions, which is far harsher than anything here.
3. **The collision in §6** — which of the three.
4. **Trivial paths** — is option D in scope now, or is this patch the caps
   alone with D filed for its own prompt and its own benchmark?

Nothing is built until these are answered. **This is the hard stop.**
