# GYMRUN Card Engine: rulings on the pre-code report

The author's rulings on the five-item report that
[`gymrun-card-battle-engine-prompt.md`](gymrun-card-battle-engine-prompt.md)
required before any code, 2026-10-08, verbatim. The report itself was given in
the session that filed this file; its proposals are summarised under
"What the report proposed" so "go with your proposal" has a referent.

## The rulings, verbatim

> go with your proposal for the issues, except on rng. rng should be less important in this version, since we're not drawing encounters. this is MVP, so it shouldn't even disrupt any of the existing code.
> make adjustments that the architecture this round should not move rng in any way and seeds shouldn't be affected since this is a different system entirely. validate my answers, and if no futher conflicts, go ahead with checkpoint 1
>
> OH draw rng. yes. every reshuffle requires a new rng draw. go with least effort rng so far. regardless, nothing touches seed.
>
> all work done in this card battler mvp does not follow the bible. since it's a different new battle screen, we need to write entirely new bible at every stage later.
>
> Need help does not reshuffle. it draws a card from the deck, and if none is available, it simply fizzles. lanes currently can only be blocked by other units. so no, no unit can occupy a cell another unit is already
>
> units are unique positionally, so no, no 2 drones at the same cell.
>
> cards are explicitly typed. incoming

Sent with it: the author's hand-written Puppeteer card sheet,
[`assets/card-battle-puppeteer-card-sheet.jpg`](assets/card-battle-puppeteer-card-sheet.jpg).

## What the report proposed, and so what "your proposal" adopts

1. Card data lives outside `src/data/`, at `src/cardData/`, so `contentHash`
   cannot move. The exclusion list cannot take it: it lists files, not globs,
   and `test/content-hash.test.ts` refuses an excluded file that `core/`
   imports.
2. (RNG: superseded by the ruling above.)
3. The hidden key listener is attached when the router shows starter select
   and removed when it leaves, because screens are toggled, never unmounted.
   `#test` is read before `start()` rewrites the hash.
4. The sandbox is a full-frame layer over the shell, not a router screen, with
   its module behind one lazy `import()`. `test/encounter-registry.test.ts`'s
   dynamic-import allowlist gains that one file. "Main bundle unchanged" is
   read as a main-chunk delta under 1 kB, measured and reported, since there is
   no numeric bundle gate.
5. A separate card-battle manifest, same asset and placeholder shapes, globbing
   `.svg` under `src/ui/assets/cardbattle/`, imported only from the lazy chunk.

## How the rulings are read

- **RNG.** The sandbox has its own seed string. Its draws come from
  `createRng(sandboxSeed)` opened under one key, drawn sequentially, with a
  draw counter held in battle state so `step` stays a pure function of its
  input. Every reshuffle is a new draw. No run seed, no run stream, no stream
  key a run opens, and no version axis is touched.
- **The bible.** The card battler is outside the design bible's scope. It
  writes its own presentation document at a later stage. The bible is not
  edited by this ruling.
- **Need Help.** At the next hand, after the normal draw, the first card not
  owned by C in the draw pile is drawn. The draw pile is never reshuffled for
  it. None there: the effect fizzles.
- **Hunt.** Only units block. A lane the enemy cannot reach along its column
  through empty tiles is not a candidate, and with no candidate the enemy
  stays.
- **Starting steps.** The answer addressed cells. The question was whether two
  enemies of one kind may roll the same starting step in their cycle; they
  roll independently, so they may.
- **Card types.** Pending. Each card carries `type: null` until the types
  arrive; the slice reads no type.
