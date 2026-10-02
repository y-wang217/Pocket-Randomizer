# Stage 5.0: D60 confirmed, D62 ruled, and 5.0/2 begun

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/wizardly-wright-cum8e0`, rebased onto `main` at
`b543f48` (5.0/0 and 5.0/1 merged as #77).

The author's answer to the follow-up after
[`gymrun-stage5.0-rulings-d56-d60.md`](gymrun-stage5.0-rulings-d56-d60.md),
which asked for a confirmation of how D60 was read and flagged D62 as touching
the battle screen. It arrived with one screenshot, the 5.0/1 battle screen on
a 1498x862 desktop, kept as
[`assets/stage5.0-d60-battle-inside-frame.png`](assets/stage5.0-d60-battle-inside-frame.png).
Filed as written.

---

## The prompt, verbatim

> d60 so as shown in the screenshot, the battle should exist inside the UI, with the background happening behind all the text and mon sprite. the backdrop is still the backdrop - as is. does that make sense?
> d62 use an icon/chip - if it doesn't already exist, add that to the work needed done
>
> otherwise, start on stage 2

---

## What it rules

| Row | Ruling |
|---|---|
| D60 | **The reading is confirmed.** The battle lives inside the game frame, with its scene backdrop behind the panels, the text and the sprites. The World behind the frame (the screenshot's cave layers either side of the frame) stays as it is. Bible Rev 16's *Scene backdrop* row stands. |
| D62 | **Option 1, everywhere, not only on the battle screen.** A type is an icon in a chip, never a genre word badge. The type chip already exists (`ui/theme/glyphs.ts`, section 2's type family) and is mounted on the panel and the move card; any 5.0 surface that shows a type mounts it. If a surface is found that has no chip, building one is part of the work. |

Then: begin 5.0/2, *Battle screen*, of
[`gymrun-stage5.0-visual-redesign.md`](gymrun-stage5.0-visual-redesign.md), as
amended by the rulings on D56 to D60 and D62 and recorded in
`../generation.md` §88.
