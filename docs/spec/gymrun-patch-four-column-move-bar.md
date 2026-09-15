# GYMRUN Patch: the four-column move bar

The fourth item of the playtest report
([`gymrun-patch-event-rewards-and-move-card-fields.md`](gymrun-patch-event-rewards-and-move-card-fields.md)),
built on its own after the first three shipped. Filed before any work began.

---

## PROMPT, verbatim

The report's own words, and then the go-ahead:

> If theres this many fields, we can try a 4-column view to compare readability bc this is too overwhelming

> okay lets make a patch to fix it

---

## What was already built, and what is left

The playtest patch read "4-column" as the *fields* and pinned them to four
fixed columns on the fact line, which stopped the band and the accuracy
wrapping onto a different row on each button. That shipped.

What is left is the other reading, and the one the word "compare" points at:
**the four move buttons as four columns instead of a 2x2 grid**, so the same
field on all four moves sits on one line and is read across.

## The measurement, taken before any code

At 390x844, Detailed, on SMOKE24. `.moves` is **358px** wide in all three
density modes, and the 2x2 grid gives each button **176px**, of which 150px is
content.

Four columns give **85px** per button, and 61px of content after the button's
own 12px side padding. Against that:

| line | fields | width it needs |
|---|---|---|
| identity | type 50.4 + category 43.1 + power 33.1 + gaps | **138.6px** |
| facts | band 38.4 + accuracy 40.3 + contact 17.1 + two empty columns + effectiveness 28.1 + gaps | **~155px** |
| footer | `PP 64/64` 53 + `?` 21.1 + gap | **78.1px** |

**None of the three fits 61px, and the font is already at the legibility
floor** — `--fs-sm` is the floor `test/visual-chips.test.ts` and
`tuning.minChipContrastRatio` hold, so shrinking type is not available.

So a four-column bar is not a re-flow of the current face. It is a different
face, and the patch has to say what leaves it.

## What this patch does about that

1. **A layout setting, not a replacement.** `moveBar: 'grid' | 'columns'` beside
   the density setting, presentation only, never read by `core/`. The report
   asked to *try* a four-column view to *compare*; a setting is what makes both
   halves of that sentence true, and it is what makes the experiment reversible
   without another deploy.
2. **Column mode stacks the face into fixed slots**, one field family per line,
   in the same order on every button — which is what makes a field readable
   across the four rather than within one.
3. **What leaves the face in column mode goes one tap away, and nothing is
   removed from the game.** The `?` panel already prints every field. This is
   the rule Pocket density already runs under: secondary facts may cost a tap,
   primary facts stay on screen. Effectiveness is primary and stays — it is the
   one live fact about the board and the single exception `CLAUDE.md` carves
   out of the no-verdicts rule.
4. **Both layouts are measured and both numbers are recorded**, in all three
   density modes, so the choice is made against heights rather than against
   taste.

## The rule this supersedes

`test/visual-v5.test.ts` asserts `grid.columns` is 2, with the words "still
2x2, never a column of four". That is a design ruling and this patch reverses
it for one of two layouts. Per `CLAUDE.md`, the superseded rule is deleted from
the lineage and recorded with a dated note in `docs/generation.md` rather than
left behind a flag, and the assertion becomes mode-aware rather than being
dropped.

## Gates

Unchanged, and the two that bite here: the 44px minimum touch target on every
move button in both layouts, and `scrollHeight <= 844` on the battle screen in
both layouts in all three density modes.
