# Stage 5.0: the author's rulings on D56 to D60, opening 5.0/2

Filed **before any change to the bible or `src/`**, per [`README.md`](README.md) rule 7.

2026-09-30, on `claude/wizardly-wright-cum8e0`, which continues
`claude/hopeful-shannon-kch3gw` (5.0/0 and 5.0/1).

The author's answer to the five rows the 5.0/1 report named as blocking 5.0/2
([`../visual/reports/5.0-stage1.md`](../visual/reports/5.0-stage1.md), "Next").
Each line answers one row, in the register's order. Filed as written.

---

## The prompt, verbatim

> d56: ability is v important. we keep it all like today
> d57: keep the full move card, restyled
> d58: yes go 1
> d59: yes go 1
> d60: yes, the backdrop should stay as is, the battle and the map are in the 'game screen' which sits in a container, and the original backdrop stays as is

---

## How each line reads against the register

| Line | Row | Reading |
|---|---|---|
| 1 | D56 | Option 1. The HP box is the Pokemon panel restyled, not a new component. Every fact the panel carries today stays: name, level, gender, HP bar and number **on both sides**, status chips, volatile chips, **the ability name** (the author singles it out), the item sprite, the priority chevron, type chips, the foe's roster marks, and the long press to the six base stats. |
| 2 | D57 | Option 1. The plan's list was illustrative. The button mounts the full move card (`renderMove`), restyled: name, type chip, category glyph, base power, PP, band pips, accuracy, priority, the fact strip, and the effectiveness marker with the field's factor folded in (D49). |
| 3 | D58 | Option 1. The battle header stays its own row above the stage, the same component, with the turn header in it. The flag strip's new position keeps each flag on its target's side (R8). |
| 4 | D59 | Option 1. D26 stands: the log keeps its glyph handle and pull. The secondary row under the grid carries Switch alone; there is no Info button. A forced switch opens the bench by itself. |
| 5 | D60 | **Neither option as written.** The World (the locale's three layers and drift) stays as it is, behind the game frame. The painted backdrops belong to the game screen: the battle stage and the map sit in the frame, and the backdrop is theirs. So there are two layers with two jobs, not one component twice: the World is the page behind the frame, the backdrop is the scene inside it. The weather wash and terrain tint sit on the battle backdrop, which is where 5.0/1 already put them (`../generation.md` §87 item 12). Stage 5's contrast check covers every battle backdrop under every field state. |
