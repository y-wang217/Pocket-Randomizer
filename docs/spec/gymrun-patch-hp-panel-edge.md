# GYMRUN patch: an HP panel edge for the one backdrop its fill cannot carry

Filed 2026-10-05 on `claude/sleepy-mccarthy-crfmqt`, **before any work**, under
protocol 1 and 7 of [`README.md`](README.md). Section 104 records the previous
patch's prompt arriving after its code; twice would make the register's dates
worthless rather than merely gapped.

## The brief, verbatim

> The other half of main's red is the new backdrop test: `cave` panels at
> max(border 1.34, fill 2.88) against a floor of 3. Do you want that too?

answered:

> Diagnose and propose a token fix

its option text, which is the scope:

> Go further and propose a specific border or fill change to clear 3:1, reading
> the design bible first since it governs presentation.

## What is failing

`test/visual-backdrop-contrast.test.ts` asserts the HP box **reads as a panel on
a painting** — WCAG 2 1.4.11's 3:1, the dominant colour in a 6px ring of art
outside the box against the box's border and fill, **whichever is better**. It
is Stage 5.0/5's art pass, third bullet: *"Check HP box and text contrast
against every battle backdrop."*

Nine backdrops, both panels, on `main` and reproduced locally:

```
cave     foe/me  rgb(92,100,116)  border 1.34  fill 2.88   FAIL
marsh    me      rgb(132,116,84)  border 1.03  fill 3.75
badlands foe     rgb(196,100,68)  border 1.11  fill 4.28
city     foe     rgb(172,164,156) border 1.81  fill 6.96
forest   foe     rgb(140,180,76)  border 1.85  fill 7.13
ruins    me      rgb(188,172,148) border 2.00  fill 7.71
...
summit   foe/me  rgb(204,220,236) border 3.18  fill 12.24
```

## The measurement that decides the fix, and the guess it replaced

**Cave is the darkest art of the nine** (luminance 0.127; summit, the lightest,
is 0.701). Both panel colours are constants —
`--panel-scrim` → `--bg-raised` → `--base-surface: #151c27`, and
`--border-heavy: #737880`; `locales.css` overrides `--locale-*`, never
`--base-surface`. So the dark fill separates beautifully from eight light
paintings and collapses against the one dark one.

That rules out the obvious fix. Against cave's stone:

| fill | ratio |
|---|---|
| `#151c27`, today | 2.88 |
| `--base-deep #0b0f17` | 3.22 |
| **`#000000`** | **3.53** |

**Pure black is the ceiling, and it is 3.53.** There is no darker fill to reach
for, the margin would be 0.5 on a floor of 3, and the panel would read as a hole
rather than a window.

The border is the other half of `max(border, fill)` and today contributes
nothing anywhere: a fixed mid-grey scoring 1.03 to 3.18. Giving it a **light**
value inverts its failure direction relative to the fill, so the two cover each
other: the fill carries every light backdrop, and the border carries cave.

The value is chosen as the **darkest** one that clears with real margin, because
every backdrop pays for it visually and only cave benefits:

| border | vs cave |
|---|---|
| `#737880`, today | 1.34 |
| `#a79f90`, `--cream-dim` | 2.27 |
| `#b4bac4` | 3.05, a bare pass |
| **`#d2d8e2`** | **4.15** |
| `#efe6d2`, `--cream` | 4.79 |

`#d2d8e2` is the pick: 38% of headroom over the floor, cool rather than warm so
it sits with the panel's own `#151c27`, and materially less loud than cream on
the eight backdrops that did not need it.

This was arrived at backwards twice before the probe ran — first as "the fill is
locale-derived and co-varies with the art" (it is a global constant), then as
"cave is the lightest art so a light border must clear the darkest" (cave *is*
the darkest, and the binding rule is per-backdrop `max`, not a global floor on
one colour). Both are recorded in `../generation.md` section 105 rather than
quietly dropped, because the shape of the error — reasoning about a measurement
instead of taking it — is the same one sections 47, 57 and 104 are about.

## What it does

- A new token beside `--panel-scrim`, used only by the `.stage .panel` rule.
  **Not** a change to `--border-heavy`, which `styles.css` uses at eight other
  sites; this is a question about one component standing on painted art.
- Nothing else in that rule changes: the fill, padding, radius and width stay.

## The bible

`CLAUDE.md` routes a player-facing surface through
[`../design/design-bible.md`](../design/design-bible.md) before code. Rows
touched: **D60**, which makes the *Scene backdrop* the painted art inside the
frame and a sibling of *World*; and section 5's Pokemon panel row. Stage
5.0/1's own note in `styles.css` is the governing intent — *"a solid window, the
plan's GBA HP box"*, superseding V5.3's *"a scrim, not a card"* — and a GBA HP
box is a defined edge around a field. Strengthening an edge that rule already
puts there is within it.

**No amendment is filed**: this adds no visual device, it gives an existing
border a value that does its job. A *second* edge colour would be a new device
and would stop for an amendment first.

## Constraints

- `NON_TEXT_FLOOR` is not touched. Moving a floor to clear a miss is what
  CLAUDE.md's gates section forbids.
- `src/ui/` only. `contentHash` covers `src/data/**` and must not move.
- **The visible consequence is stated rather than buried**: every HP panel on
  every backdrop gains a light outline. That is nine screens changing
  appearance to fix one, and it is the cost of a border that cannot be dark,
  given the fill cannot be darker.
