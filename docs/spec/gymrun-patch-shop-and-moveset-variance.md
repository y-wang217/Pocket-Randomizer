# Patch: the shop shelf, status moves as a thing you can buy, and early moveset variance

Filed 2026-09-17, before any work, on `claude/intelligent-newton-5ftz3j`.

A playtest report plus a design brief, filed as it was written. It arrived in
two messages: the first asks for a shop update and names the validation report
as the thing that has to come first, the second opens a second investigation
into what a starter's moveset actually is and asks for more variance early.
Both are verbatim below, followed by the four questions that were put to the
author before any code and their answers.

**The brief asks for a report before the patch, so that is a hard stop** —
`CLAUDE.md`, Process. The report is [`../reports/moveset-pool-validation.md`](../reports/moveset-pool-validation.md).

---

## The brief, verbatim — first message

> help me validate the moveset pool. i have never seen status moves being
> offerred. they shold be offerred in the shop pool, if not learned.
>
> gameplay wise, wild/player encounters should give good battle moves since you
> need coverage to win. but shops should give options for the user. each shop
> should also have more types of things to buy.
>
> e.g. in slay the spire, shops have card removal, relics, potions and cards,
> and special colorless cards
>
> mapped directly, battle moves are cards
> remove is heal
> status moves are like colorless cards
> we have relics for sale
> Potions are consumables, and we should offer berries for sale
>
> let's plan a shop update patch, with the moveset pool validation report to
> start so we cna make the correct balance decision

## The brief, verbatim — second message

> The other moveset investigation i'd like to know is what are starter mon
> movesets? is it all possible moves a la randomizer or is it all possible
> learnable mvoes on that mon?
>
> both within band.
>
> i'd like the moves to be more randomized too, so that lack of coverage is less
> opressive early and more variance is introduced to starter and gym 1

---

## The four questions, asked before any code, and their answers

**1. "remove is heal" — a mapping, or a request for a move-removal service?**

> Mapping only — heal covers it.

Heal is already stocked at two fractions in both shop bands. No move-removal
service is built, and the patch spends itself on status moves, berries, the
shelf shape and early variance instead.

**2. How literally should the Slay the Spire shelf shape be copied?**

> Guaranteed slot per category.

A shelf always holds one row of each category — battle move, status move, berry,
heal, item, and a relic from segment 3. The weighted walk over one table goes
away; the draw becomes per-category.

**3. Should status moves be shop-exclusive?**

> Shop + rare elite card.

Shop-primary, plus a low-weight entry in the elite reward pool only, so a risk
path can pay in options instead of power. Normal, hard, gym and event move
grants stay damaging-only.

**4. How deep should the report go before any code?**

> Static analysis only.

Pool composition and the exclusion trace, no simulator run. The report answers
"why have I never seen one" completely and proposes numbers; it does not
measure what adding them costs. Balance is not a gate (`CLAUDE.md`), so the
benchmark row is recorded after the patch rather than gating it.

---

## What this patch moves

| axis | moves | why |
|---|---|---|
| `RANDOMIZER_VERSION` | yes, to `gymrun-randomizer-18` | draw composition changes twice over: the STAB slot's pool widens, and a shop shelf becomes a fixed slot list rather than a drawn count |
| `contentHash` | yes | `data/scaling.ts`, `data/shop.ts`, `data/rewardPools.ts`, `data/tuning.ts` |
| `RUN_LOG_VERSION` | **no**, holds at 17 | a technique asks the same `target`/`replace` pair in the same two places a shop TM and a reward card already do. No new question in a new place — `generation.md` section 7c. Verified against `test/versions.test.ts` and `test/run-replay.test.ts` rather than asserted |
| `AI_VERSION` | no | opponent policy is untouched |
