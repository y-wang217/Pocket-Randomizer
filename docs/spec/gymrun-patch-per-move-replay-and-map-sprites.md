# Patch: the turn plays move by move, and the map's nodes wear their sprites

2026-10-06, on `claude/eager-galileo-8vqf47`, after `dad2a03` (the defender map
backdrops patch). Filed **before any change to `src/`**, verbatim, as
[`README.md`](README.md) rule 7 asks. The author's go-ahead on the first of
the two open items the previous patch carried to `../README.md` section 5, and
a second ask on the map.

---

## The message, verbatim

> go ahead and build the per-move so can play test it.
>
> Also, add actual sprite cut outs to the map, so it doesn't just look like a bunch of grey nodes. especially since we no longer encounter 'wild' fights

## The session's reading

**The per-move replay.** The scene draws one view per turn batch, so the bar,
the number and the sprite stand at the turn's end state on the first frame and
only the shadow chunk and the lunges are slotted by stylesheet delays. The
second move's effect lands on the frame the first's does; a body that switches
in and faints in the same turn is set swapped and fainted on one update, rises,
and is snapped out of sight by the fainted rule with no sink. The fix is in
`ui/` alone: the batch's protocol is read per action, in the order
`readTurns` already gives, and the scene draws one step per action, holding
each for its beats, before the final view (the session's own facts) lands.
Nothing under `core/` changes; no version axis moves. Bible section 6 states
this order already.

**The sprites on the map.** A defender door is a trainer glyph on a grey disc,
and every door is the same disc. Since Stage 6.0 a challenger node wears the
record's own sprite in the glyph's slot (D106) and the battle header wears it
too (D104); a door's challenger has a class and no record. The ask is the
same treatment on every node that has a sprite to wear: the trainer's cutout
in the node glyph's slot, the glyph kept where there is none.
