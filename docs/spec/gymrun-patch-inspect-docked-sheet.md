# Patch: the inspect panel opens under the finger, and iOS selects the text instead

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.
The layer was read before the filing and nothing was built until after it.

2026-09-25, on `claude/ui-component-description-menu-wjbyxd`.

A playtest report from the author, in two messages. Both are filed as they
were written; the second arrived while the first was being read.

---

## The prompt, verbatim

Message 1:

> Okay one ux thing. The text is highlightable so holding down to get
> tooltips means i get the highlight and opens a tooltip too small. So for ui
> components the description should open a menu outside of the finger press.
> Ideally a permanent spot, that doesnt conflict with gameplay and can be
> closed if clicked/tapped away from

Message 2:

> Yea more importantly get the text to not be a text field? You know what i
> mean? On ios it highlights and once i highlight the text, it exits the menu
> bc it opens the hightlight text tooltip for copy etc

---

## What the report is

Three things, and message 2 puts the first one first:

1. **The text under a long press is selectable.** iOS treats the hold as a
   text-selection gesture, highlights the word, and raises its copy callout.
   The callout cancels the pointer, and `ui/tooltips.ts` closes the panel on
   `pointercancel`. So the explanation appears and is taken away by the
   platform, in that order, on every hold that lands on a word.
2. **The panel opens beside the trigger, under the finger**, and is sized to
   its content, which on a phone is a small box beside a thumb.
3. **Release closes**, so the panel cannot be read with the hand out of the
   way. The author asks for the opposite: a fixed spot, stays open, a tap
   anywhere else closes it.

Item 3 touches R5's *"Release closes"* and is an amendment, not a fix; the
bible's own process is followed in the same PR. Items 1 and 2 are
presentation defects under the rule as it stands.

---

## Scope

Presentation only. No `core/` change, no data table, no version axis moves —
`contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all
hold. The register is checked for an `active` prompt on the same surface
before work starts: [`gymrun-patch-inspect-hover-on-touch.md`](gymrun-patch-inspect-hover-on-touch.md)
is the previous patch on this layer and is built, not in flight.
