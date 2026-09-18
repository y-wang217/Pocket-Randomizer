# Teach now or store, and a nuzlocke level spread for gyms

Filed 2026-09-18 on `claude/great-curie-99l9fm`, before any work.

A playtest brief in one message, filed as it was written. It carries two items
that look unrelated and are not: both are the early game being starved of power
at the point where the run has least of it. The second item asks for research
before code and names the reference to check, which makes the research a hard
stop in the `CLAUDE.md` sense.

---

## 1. The brief, verbatim

> not being able to teach TMs immediately makes progression much harder earlier on.
>
> let's give the option to the player upon acquisition: teach now, or store as TM
>
> Also, early gyms are super punishing, so we can shave 1 level offthe gym mons
> or something like that. Check out the nuzlock level caps and gym levels for
> comparison. what are their early gym level cap to player level cap ratios?
> research first and plan before changing code

---

## 2. The research the brief asked for, and what it found

**The question was the early-gym-level to player-level-cap ratio in nuzlocke
convention. The answer has two parts and the second is the one that matters.**

**The cap rule is universal: the level cap equals the gym leader's ACE.**
Nuzlocke University lists caps as "the level of their highest-levelled Pokémon".
pChal's rulebook: a Pokemon "must not exceed the highest level of the next gym
leader's Pokémon until the gym battle is initiated."

So **ace over player cap is 1.00, at every gym, in every game.** The early-game
slack is not there.

**It is in the rest of the team.** Only the ace reaches the cap; every other
member sits below it.

| | gym 1 | gym 2 | gym 3 | gym 4 | gym 5 | gym 6 | gym 7 | gym 8 |
|---|---|---|---|---|---|---|---|---|
| FireRed cap (= ace) | 14 | 21 | 24 | 29 | 43 | 43 | 47 | 50 |
| FireRed team mean over cap | 0.93 | 0.93 | 0.88 | 0.94 | 0.91 | 0.92 | 0.91 | 0.90 |
| Emerald cap (= ace) | 15 | 19 | 24 | 29 | 31 | 33 | 42 | 46 |
| Emerald team mean over cap | 0.90 | 0.89 | 0.90 | 0.89 | 0.92 | 0.92 | 0.99 | 0.93 |
| **GYMRUN today** | **1.00** | **1.00** | **1.00** | **1.00** | **1.00** | **1.00** | **1.00** | **1.00** |

Reference mean over both games and all sixteen gyms: **about 0.91**. The ratio
is flat. Early gyms are not softer than late ones by level, which means the
brief's "shave 1 level off the gym mons" is not what the reference does either.
What makes an early gym survivable is the *shape*: Emerald's gym 1 is a Geodude
at 12 beside a Nosepass at 15, against a player capped at 15.

**GYMRUN's player curve is already a stretched Emerald.** `data/scaling.ts`
says so in its own header: vanilla `[15,19,24,29,31,33,42,46]` became
`[15,20,26,32,38,44,50,58]`. So the game took Emerald's *cap* numbers for the
player, which is right, and then gave every gym Pokemon ace status. **That is
the divergence and it is the whole finding.**

One further note from the same research, which belongs to item 1 rather than
item 2: the convention of raising the first two gyms' caps one level above the
ace exists, in the sources' own words, "to make a wider variety of strategies
possible in the limited early game and reduce the reliance on encounter RNG".
The early game is coverage-starved, and the community's fix was aimed at the
early game specifically rather than at a global nerf.

Sources: `nuzlockeuniversity.ca/2022/01/18/hardcore-nuzlocke-level-caps-by-generation/`,
`nuzlockewiki.com/hardcore-nuzlocke/`,
`tcgstacked.com/pokemon/nuzlocke/firered/gyms`,
`tcgstacked.com/pokemon/nuzlocke/emerald/gyms`.

## 3. The measurement item 1 already had

Item 1 is not a new finding. It was measured at the inventory-TM stage and
filed unfixed at `docs/generation.md` section 40.3 and `docs/README.md`
section 5:

| | |
|---|---|
| runs that ever hold a TM | 174 of 400 (43.5%) |
| runs that ever reach a boundary where one can be spent | **53 (13.3%)** |
| boundaries holding a TM where teaching was legal | 74 of 687 (10.8%) |

That filing named three answers — widen `canTeachAt`, let a composed teach wait
for the next legal boundary, or pay TMs nearer to rests — and called all three
balance decisions. **The brief takes a fourth that was not on the list**: ask at
the moment the move arrives.

---

## 4. The three questions put to the author, and the answers

Asked after the research and before any code, because each changes what is
built.

**Question 1.** *GYMRUN puts every gym mon at parity where the reference games
average 0.91. How should we close that?* Four options: a nuzlocke spread at all
eight gyms, the same spread early only, a flat minus one everywhere, or leave
levels alone and spend the other levers.

**Answer: nuzlocke spread, all 8 gyms.** The ace stays at parity and the
non-ace members draw below it. A flat minus one was declined implicitly by the
choice: it puts the ace below the player, which no reference game does.

**Question 2.** *The inventory stage chose rest and shop only. Adding
teach-on-acquisition reverses it. What happens to TMs the player stores?*
Three options: keep the rest/shop gate for stored TMs, widen `canTeachAt` to
every node, or keep the gate but never drop a composed teach.

**Answer: keep rest/shop for stored TMs.** Teach-now is the only new window.
The bag stays a bank and the now-versus-later decision the inventory stage was
built for survives.

**Question 3.** *The two items move different version axes, so shipped together
a balance row cannot say which one moved the gym clear rate. How should they be
sequenced?* Three options: two patches with a benchmark between, one patch and
one benchmark, or levels first.

**Answer: two patches, one branch, benchmark between.** TMs first, then levels.

---

## 5. What this supersedes

**The "rest and shop nodes only" rule**, from
[`gymrun-stage-moves-as-inventory-tms.md`](gymrun-stage-moves-as-inventory-tms.md)
section 5, answer 1. It is narrowed rather than deleted: it remains the rule for
a **stored** TM, which is every TM the player chose not to spend on arrival. The
two rules that came with it are untouched — a replaced move is still destroyed
rather than banked, and a TM is still consumed by teaching it.

**The pinned gym parity rule**, `src/data/scaling.ts` under `levelOffset`,
recorded there on 2026-09-17 and carried by
[`gymrun-patch-bench-carryover-and-gym-levels.md`](gymrun-patch-bench-carryover-and-gym-levels.md).
Its argument survives and is the reason this patch moves `min` and not `max`: a
level *advantage* is the one gym difficulty lever that deletes Speed as a build
axis instead of scaling it, because Speed is read as a comparison rather than a
quantity. Holding `max` at zero keeps that. What the rule got wrong is the other
end — it pinned the whole team where the reference pins only the ace.

## 6. Named non-goals

- **The gym roster rule.** A gym fields the player's own slot count
  (`opponentTeamSize`). Measured against the reference that is close enough —
  GYMRUN's `[2,3,3,4,4,5,5,6]` against Emerald's `[2,3,4,4,4,5,4,5]` — and it is
  not this patch's to move.
- **`GYM_MOVE_BAND_BONUS`, the gym held-item ladder, and the hard AI tier.** All
  three are the levers `scaling.ts` names as the ones to spend instead of level.
  None is touched here, so the benchmark rows read against one change each.
- **Widening `canTeachAt`.** Explicitly declined by the answer to question 2.
