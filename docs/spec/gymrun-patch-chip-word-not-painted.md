# GYMRUN patch: the chip floor was reading a word that is never painted

Filed 2026-10-05 on `claude/sleepy-mccarthy-crfmqt`. **Filed after the code, not
before it** — see "Protocol deviation" below.

## The brief, verbatim

Asked after the diagnosis was reported, as a choice between four scopes:

> Fix the instrument, file the gap

its option text, which is the scope:

> Read rendered text; type and category come off the text floor with the loss
> named in the list's own comment, as 47.3 did for band. Turns the chip leg
> green and files the glyph-contrast assertion as the open item. Test-only, no
> src change.

The diagnosis it followed was asked for as:

> Yes — read the artifact and diagnose

## What was found

Run 37205550086 failed eleven rows of the chip floor on `starter` and `locale`,
every one a type chip, as low as 1.99:1. None of it is contrast.

`typeChip` and `categoryChip` both append a `.chip__word` span carrying the
word, and `styles.css:1422` sets `.chip__word { display: none }` — the only rule
for that class in the tree, because Stage 5.0/1 retired the density modes and
left the word as markup that exists to be hidden. `wordForm`'s comment still
says *"Pocket renders the glyph alone, the other two render the word"*; there is
no other mode left to be the other two.

`chipsOn` read `node.textContent`, which **includes the text of a
`display:none` element**. So those chips read as worded, and the sampler
measured the colour their word would have had against the chip's own fill. On
the starter screen alone, **29 of 32 chips** report text that is not painted;
only `neutral` chips paint their words, because they set text on the node
directly rather than through `wordForm`.

This is section 47.3's finding arriving through the one door its fix left open.
47.3 covered `bandChip`, which sets no `textContent` at all. `type` and
`category` have `textContent` and no rendered text, which an empty-text skip
cannot see.

## What it does

- `chipsOn` reads `innerText` rather than `textContent`, so a word that is not
  painted reads as no word.
- `type` and `category` come off `VARIANTS` as the direct consequence, the way
  `band` did, with the cost named in the list's own comment. **It is a larger
  loss than `band`**: a type chip is the most common chip in the app.
- The assertion those chips actually need — a contrast floor between a filled
  mark and an empty one — is already filed as an open item in `docs/README.md`,
  and the `VARIANTS` comment already names it. This patch does not build it.

## Constraints

- Test-only. Nothing under `src/`, no version axis moves, no baseline
  re-recorded. `.chip__word` is **not** removed: it is dead markup on a
  player-facing component, so removing it is a `src/` change that
  `CLAUDE.md` routes through the design bible.
- The floor is not moved. `displayTuning.minChipContrastRatio` stays at 4.5.

## Protocol deviation

Protocol 1 and 7 require the prompt in `docs/spec/` **before** any work. This
one was written after the change was committed, in the same session. Recorded
here and in `../generation.md` rather than backdated, because a register whose
dates cannot be trusted is worse than one that admits a gap.
