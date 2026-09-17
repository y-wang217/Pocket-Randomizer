# Patch: the band recut and the level curve

Committed 2026-09-17 before any work, on `claude/admiring-euler-dhn536`.

The prompts below are the user's, verbatim and in order, across the three turns
that produced this patch. They are **not** edited to match what was built. Where
the built work deviates, the deviation is recorded in
[`../generation.md`](../generation.md) section 33.

The analysis that came back between turns — the band census, the learnset
validation, the OHKO measurement and the evolution-reachability table — is not
here. It is the report, filed before any code and treated as a hard stop:
[`../reports/early-game-band-and-curve.md`](../reports/early-game-band-and-curve.md).

---

## Turn 1 — the complaint and the question

> now the balance of early gyms is askew.
>
> having t2 band moves means that early battles are a huge swing. with such
> little hp, high bp moves overwhelmingly favour the higher speed mon. so all
> decisions move to optimizing for speed, prio, and ability to kill the opponent
> quickly. this also favours a bot enemy whose decision making tree becomes
> trivilaly optimal.
>
> let's reveal all the t2 moves added and readjust to only have t1 moves early,
> but move the threshold for what is considered t1 vs t2. tell me the currently
> t-bands and what types of moves are available in gyms 1-3

---

## Turn 2 — the proposed bands, the learnset ask, and the level curve

> let's try this band:
> 1 is <=60
> 2 is 61-75
> 3 is 76-90 and then 4 is 95-110 and 120+ can be a newer tier, which as far as
> I know are mostly legendary/competition level moves.
>
> what does that buy us and is it reasonable?
>
> also, check what the real pokemon games track as avilalbe moves, using a real
> pokedex learn moves per level and validate it against ours. we don't need to be
> accurate, we just need it to feel like an even playing field.
>
> for the weights, we'll keep the weights for a randomized feel but raise levels
> to level 10 base gym 1 and rescale the rest up accordingly (the progression
> should still feel good)
> what good means: early mons are still somewhat swingy, but we get first
> evolutions by gym 2 and full evolutions by gym 4 and everything should be
> highest evolution by gym 6 except really crazy mons like gengar, alakzam, and
> pseudo legendaries get final evolutions by gym 7. That level should be more
> favorable for the player.
> here's the list based on emerald nuzlocke Pokémon Emerald
> Gym 1: Lv 15
> Gym 2: Lv 19
> Gym 3: Lv 24
> Gym 4: Lv 29
> Gym 5: Lv 31
> Gym 6: Lv 33
> Gym 7: Lv 42
> Gym 8: Lv 46
>
> Elite Four 1: Lv 49
> Elite Four 2: Lv 51
> Elite Four 3: Lv 53
> Elite Four 4: Lv 55
>
> Champion: Lv 58
>
> Meteor Falls: Lv 78
>
> we want gym 8 to feel like an epic conclusion.
>
> yes, close the stabwindow
>
> yes, i already mentioned recutting the bands
>
> yes remove the possible case where gym 1 teaches a t4 move.
>
> summarize my decisions, what you expect the outcomes to be, then report back
> before writing code

---

## Turn 3 — the four answers

> 1. use the stretched so i can playtest
> 2. yes accept the deterministic. psychic is a strong typing and needs
>    investment to win
> 3. yes go with your suggestion
> 4. this shouldn't feel as bad as it does. players are just desperate to find a
>    type advantage against gym 1, which is fine. since starters are now not
>    guaranteed to be better than wild mons, catching and strategizing for gym 1
>    actually becomes gameplay important. i'd lke to try these changes before
>    refining further
>
> you can make a plan to implement these changes now

The four questions those answers are against, restated so the numbers are not
orphaned:

1. **Level curve.** Emerald verbatim ending at 46, or the stretched
   `[15, 20, 26, 32, 38, 44, 50, 58]`? Emerald verbatim misses all four
   evolution goals and leaves pseudo-legendaries permanently unevolvable.
2. **`stabWindow`.** Per-segment (0 through segment 2, 1 after), or hard 0
   everywhere and accept deterministic Confusion on every Psychic species?
3. **Gym-clear reward.** Segment band +1 for every gym, so gym 1 pays band 2 and
   gym 8 pays band 5?
4. **The 22% OHKO rate** — accept it as the price of evolution pacing, or pull
   gym 1's `levelOffset` down so the leader sits below the player?

---

## Turn 4 — two clarifications taken during planning

**On the gym offer**, asked because `GYM_OFFER_SIZE` is 2 and the gym paid one
guaranteed move plus a choice of two cards:

> yea 2 pages: 1 page with 3 moves then 1 page with gold/relic

**On the three type gaps the new cuts open** (band 2 has no Dragon, band 4 no
Bug, band 5 no Dark), asked because `test/data-tables.test.ts` asserts every band
holds all 18 types:

> Accept and pin the gaps

**On provenance**, sent mid-plan:

> also track these decisions in a doc so that future reports understand where
> these changes came from

That instruction is what this document and the report beside it are.

---

## What the prompt does not settle, and was decided in the report

Three things the prompts above ask for turned out to conflict with the dex's own
numbers, and the report is where each is resolved with evidence rather than
taste:

- **"raise levels to level 10 base gym 1"** (turn 2) is superseded within the
  same turn by the Emerald list, which puts gym 1 at 15. 15 is what was built.
- **"4 is 95-110 and 120+ can be a newer tier"** leaves 111-119 unnamed. No move
  in the pool has effective power in 91-94 or 111-119, so the cuts were written
  as `[60, 75, 90, 110]` — which places every move exactly where the prompt asks
  and leaves no empty range in the table.
- **"full evolutions by gym 4 and everything should be highest evolution by gym
  6"** is not reachable at Emerald pacing; the dex's final-evolution mass sits at
  30-36 with a median of 35. The stretched curve reaches 89% by gym 6 and the
  gap is recorded rather than closed.
