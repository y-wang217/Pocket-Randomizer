# Patch: a taught move did not show until the player walked back to the map

Filed 2026-09-18 on `claude/learn-move-refresh`, **before any work on it**, per
[`README.md`](README.md) rule 7. It follows
[`gymrun-patch-update-sequence-audit.md`](gymrun-patch-update-sequence-audit.md),
which asked whether the stale-readout mechanism had other victims and answered
for the surfaces `onState` feeds. This one is the other half of the same
question, on the other clock: not what the *run* has done and not reported, but
what the *player* has decided and the screens have not drawn.

---

## The prompt, verbatim

> Double checking the learn move order. Once a move is learned, we need to
> refresh the visual, because we dont give any indication to the player that a
> move has been replaced - learn move pages should reflect at the moment the
> player clicks the move to replace. Currently, once the player returns to the
> map, the visuals reflect. Lets fix this

---

## What the report establishes on its own

- **The act is the click on the replaced move**, and that is where the report
  puts the refresh. Not the boundary, not the return to the map.
- **The player is given nothing else.** There is no confirmation, no toast, no
  before-and-after. A screen that still lists the displaced move is the only
  answer the player gets to "did that work", and it says no.
- **The lag is exactly one boundary.** The visuals do reflect, on return to the
  map — which is `applyItemPlan` folding the plan at the next node boundary and
  `onState` redrawing from what it produced.

It names no cause and no file. It does name an order — "the learn move order" —
which is the second half of the finding below, and which the report could only
have suspected.

## Scope

Presentation only. No `core/` transition moves, no decision changes shape, no
version axis moves, `contentHash` unmoved.

[`../generation.md`](../generation.md) section 41 is the account.
