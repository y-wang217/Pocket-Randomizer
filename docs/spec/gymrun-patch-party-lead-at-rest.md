# Patch: the Lead control is on the Team screen's face

2026-10-06, on `claude/party-lead-at-rest`, from `main` at `19722bd`. Filed
**before any change to `src/`**, verbatim, as [`README.md`](README.md) rule 7
asks. A bug report of one sentence, with no screenshot.

---

## The message, verbatim

> Bug report cant change party order in team view so no way to change lead

## The session's reading

Reproduced at 390x844 on `SMOKE24`: map, Team tab, a party of two. The
writable party screen opens on the *Stats* view with two cards, and the
only controls on screen are the three view tabs, the sort, a bare `+` on
each card, and *Back to the map*. The blurb above them reads *"Slot 1 leads."*

The reorder works. `Lead` and `Release` are drawn, but into the card's fold
(`.collapse__body`), below the stat block **and below the four move cards**,
so even after the `+` is pressed the control is off the bottom of a phone
screen. Pressing `+` on slot 2, scrolling, and pressing `Lead` moved the
member to slot 1 as it should. The fold was the density-modes ruling that
"a control on a card is one tap away"; in practice the tap is on a glyph the
collapse helper's own header says reads as *add*, and the control lands a
screen's height under it. The player was told slot order matters and given
no visible way to change it.

The fix: `Lead` comes out of the fold and sits at rest under each card on the
Team screen's *Stats* view, outside the party row component, the way the
pre-gym screen wraps its card in a slot. Disabled on slot 1, as it was.
`Release` stays in the fold: it is the irreversible one, and nothing in the
report asks for it.

No `core/` change. No version axis moves: a reorder was already a logged
`party` edit, and that path is unchanged.
