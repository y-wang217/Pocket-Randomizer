# GYMRUN patch — the map drawer, and overlays become windows

Committed verbatim before any work began on it, per protocol 7 in
[`README.md`](README.md). Filed 2026-09-15 on `claude/hopeful-curie-5ah94f`.
The brief as issued, unedited.

Presentation only: no `core/` change, and no version axis moves —
`contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all
stand.

**Not edited to match what gets built.** Where the built work deviates, the
deviation is recorded in [`../generation.md`](../generation.md) with a dated
note, per protocol 4.

---

## The patch brief, as issued

overnight, do a quick feature design for a 'see map' button that's a mimic of the party button and lets the player see what the upcoming nodes look like. it should open up the same way the party button does. In fact, the better design for both would be that they appear as a 'window' overlay instead of a 'bottom' overlay. made the design then try it out

---

## The three questions the session asked before building, and their answers

The brief says "for both", and there were three bottom sheets in play once the
map one landed, so the scope of "both" was open. Asked and answered before any
code:

1. **How far does the window conversion go?** — *All three.* The party drawer,
   the battle history log sheet and the new map overlay. Leaving one bottom
   sheet behind is the same hand-copying the extraction exists to kill.
2. **What goes inside the See-map overlay?** — *Rail, heading and chain.* Not
   the party block or the wallet: the party drawer already carries those one tap
   away, and two readouts of one fact is two places for it to drift.
3. **Checkpoints on an overnight run?** — *Run straight through.* Commit at each
   checkpoint per `CLAUDE.md` Process, but do not stop for review between them.

## The design, as built

### Why the map overlay is the other half of a rule already written down

`src/ui/drawer.ts` carries a standing rule, and `docs/generation.md` §12 is
where future screens inherit it: **any screen that asks the player for a
decision must expose current party state without leaving the decision.** Before
Stage 4.7 the player picked a locale, a node, a reward, a recipient, a
replacement and a shop purchase, and on none of those screens could they see
their party. That was the party drawer's argument.

The map is the other half of that same argument and it was never built. A
player on the shop screen deciding whether to spend 40 coins cannot see whether
a rest is two steps ahead. A player in a battle picking a move cannot see
whether the next step offers a rest or another fight. **That information is
hidden by no rule** — the map screen shows all of it — it is merely unreachable
from the screen where the decision is being made. Which is, word for word, the
failure the party drawer exists to remove.

### The reveal rules hold by construction, not by care

`CLAUDE.md` forbids verdicts, rankings, and effectiveness against content the
player has not reached. The overlay satisfies that without a single new
judgement call, because it calls **the same render functions as the map
screen** — `renderRail`, `renderHeading` and `renderChain`, exported from
`ui/screens/run-map.ts` rather than reimplemented. It therefore cannot reveal a
fact the map screen does not already reveal, and there is no second place for
the reveal rules to drift.

`renderChain` is called **with no `onChoose`**. `renderNode` already computed
`const interactive = Boolean(onChoose)` before this patch, so a read-only chain
was already supported by the existing code; only `renderChain`'s own signature
had to widen. Every node in the overlay is a `div`, not a button. That is what
keeps `CLAUDE.md`'s Rewards rule true: a node completion has exactly one path,
and an overlay that could pick would be a second one.

### Why the window geometry changed, and why it was extracted first

Two bottom sheets existed, hand-copied from one recipe, and this patch would
have made a third. They had **already drifted**: `log-sheet.ts` had no Escape
handler and no click-stop on its sheet, and `drawer.ts` mirrored its open state
in a `let open` flag that could disagree with the DOM while `log-sheet.ts` read
`!root.hidden`. A third copy would have made the drift a pattern.

So the recipe is extracted once into `ui/overlay.ts`, the drift is fixed in that
one place, and the geometry changes there. Every element carries **both** the
shared class and its existing per-block one (`overlay drawer`,
`overlay__sheet drawer__sheet`), so every selector the test suite and the smoke
script already query keeps resolving.

The bottom anchoring was a Stage 4.7 decision for a 390x844 phone — "a bottom
sheet because that is where a thumb is". It is the wrong shape for the map,
whose content is a tall eight-gym rail plus a step chain. A centred window also
states the overlay's own premise more plainly than a bottom sheet did: the
Stage 4.7 rule kept `max-height: 90vh` so that "the strip of the screen
underneath is what says this is an overlay", and a window keeps that strip on
every edge rather than on one.

### What the map overlay deliberately does not carry

- **The party block and the wallet.** The party drawer is one tap away and
  already shows them.
- **The settings pickers.** They belong on the surface reachable from
  everywhere, which is the party drawer.
- **Any way to pick a node.** See above: one path, or it is not one path.
- **Tutorial marks.** The map screen's own marks already teach the chain, the
  kinds, the tier and the gate. A second set over the same content is a second
  thing to keep in agreement.
