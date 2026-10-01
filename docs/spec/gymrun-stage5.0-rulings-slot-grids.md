# Stage 5.0/5: the slot grids ruled, option 1

Filed **before the change it rules on**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/eloquent-heisenberg-383rnt`, mid-5.0/5. The 5.0/5
report ([`../visual/reports/5.0-stage5.md`](../visual/reports/5.0-stage5.md),
*For the reviewer*) put one question to the author. On most map backdrops the
outer three-option slots land off the painted ground on some rows. Narrowing
the grid would overlap the current step's cards: they are up to about 106px
wide, about 107px apart at 390 and 103px at 375. Three options were offered:

1. **Accept it** as a known difference. The nodes are ringed discs and read as
   tokens on a map. *Recommended.*
2. Narrow the grid per backdrop and let the current row's detail wrap to two
   lines.
3. Repaint the backdrops with a wider clearing.

---

## The author's reply, verbatim

> go with option 1

---

## What it rules

| Item | Ruling |
|---|---|
| Slot grids | **Option 1.** `BACKDROP_GRIDS` stays empty; every backdrop uses the default grid. Outer slots standing off the painted ground on some rows is a known, deliberate difference from the plan's *"nodes sit on plausible ground"*, recorded in `../generation.md` §92. |
| Reopening it | A repaint with a wider clearing (option 3) is how it reopens: a tuned grid is then one entry per backdrop, with the overlay script (`scripts/visual/slot-overlay.ts`) as the evidence. |
