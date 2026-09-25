# Patch brief: no resist berry on a gym page, and "pick a berry" as a gym reward

Filed 2026-09-25 on `claude/berry-gym-rewards-gz15ms`, **before any work on
it**, per [`README.md`](README.md) rule 7.

One message from the author, filed as written. It opens with "Also", so it is
a follow-on to a conversation that is not in this repository; the message is
the whole of what this branch was given.

---

## The message, verbatim

> Also berries that reduce a super effective hit are not good gym reward items.
> Instead, it could be "pick a berry" for a gym reward

---

## What the tree says at filing (not part of the prompt)

Recorded here so the next session does not re-derive it.

- **No gym reward page can offer a berry on `main` at `da2a601`.** The gym
  pool in `src/data/rewardPools.ts` (`GYM`) holds three kinds: `relic`,
  `currency`, and an `item` entry over `PREMIUM_ITEM_IDS` (Choice items join
  from segment 3). `BERRY_IDS` is referenced by the `NORMAL` pool only. The
  gym's first page is three moves (`GYM_MOVE_ENTRY`).
- Where a resist berry *can* reach a player: the normal node pool (weight 5
  through segment 2, weight 2 after), the shop's `berry` category
  (`src/data/shop.ts`), and event consolations (`src/data/eventPools.ts`).
  A gym *leader* never holds one: `GYM_ITEM_BANDS` in `src/data/items.ts`
  admits Sitrus alone, in the top band.
- No open PR and no unmerged branch adds berries to the gym pool.

So the first sentence of the message asks for a removal that has nothing to
remove. The second sentence is the buildable part, and it is a new reward
kind rather than a table edit:

- a `berryPick` (working name) card on the gym's second page, which when
  chosen asks the player which berry they want, from the whole `BERRIES`
  table, at the result screen;
- the pick is a player decision, so it serializes into the run log and
  consumes no RNG (CLAUDE.md, Randomness). Adding a logged decision bumps
  `RUN_LOG_VERSION`; adding an entry to the gym pool changes draw
  composition and bumps `RANDOMIZER_VERSION`;
- the card is a player-facing surface, so the build reads the design bible
  first and its report names the rules it touched. A choice among fifteen
  berries is a new selection surface and may need an amendment before it is
  built (the bible's component canon).

Whether it is that, or a "pick a berry" that draws three berries and offers
them as a three-card page, or something else, is the author's call and is
not decided here.
