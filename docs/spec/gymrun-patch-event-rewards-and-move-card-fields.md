# GYMRUN Patch: event rewards that never land, and the move card's moving fields

A playtest report from the deployed build, filed verbatim under the protocol in
[`README.md`](README.md) rule 1 before any work began on it.

Build on the reporter's screen: `GYMRUN-1e6f02-Z8HE3NMU`, `0.3.0 · R14`, on a
phone at 390 wide. The screenshot is
[`assets/event-rewards-ui-bugs-battle-screen.png`](assets/event-rewards-ui-bugs-battle-screen.png).

---

## PROMPT, verbatim

> Two gamebreaking bugs:
> Still no rewards in ? Event rooms
> I picked minus hp for T2
> Didnt get hp hit and didnt get the reward move.
> Also the like breaks for the band and the accuracy etc must be consistent for the user to remember what they mean.
> If theres this many fields, we can try a 4-column view to compare readability bc this is too overwhelming

---

## What the report names

Four items, and the first two are one defect seen twice.

1. **No rewards in a question mark room.** The previous round of this same
   report was answered by the `resolveNode` backpack fix recorded in
   `../generation.md` section 14 ("The bug the risk predicted"). The word
   "still" says that fix did not close it.
2. **A Toll paid for `T2` delivered neither half.** The reporter took the
   priced option — a stated HP price for a guaranteed `T2` — and observed
   neither the HP charge nor the move the tier paid.
3. **The fields on a move card move.** The band pips and the accuracy sit on a
   different line on each of the four buttons, because the row wraps against
   its own content. A field the player has to re-find on every card is a field
   they never learn.
4. **A four-column view, offered as a thing to try.** The reporter's own words
   are "we can try" and "to compare readability" — it is an experiment about
   comparison across the four moves, not a settled instruction.

## Standing rules this patch is held to

Named here rather than rediscovered mid-work.

- `CLAUDE.md`, Randomness: a draw that depends on player state draws **every**
  outcome at generation and selects at resolution. Nothing new may draw at
  resolution.
- `CLAUDE.md`, Versioning: a run log version bumps when a logged decision is
  added, removed, reordered or reshaped, and a mismatch fails loudly naming
  the axis.
- `CLAUDE.md`, Rewards: there is never a second path by which a node completes.
- `CLAUDE.md`, Player-facing copy: attributes, never verdicts. The one
  exception is live type effectiveness against what is on the field.
- `CLAUDE.md`, Gates: determinism, stream isolation, version guards, type
  check, lint, build, strict trim, smoke run, and the full suite.
