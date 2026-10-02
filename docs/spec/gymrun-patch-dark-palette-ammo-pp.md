# Patch: the dark palette back, and an ammo mark for PP

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/dark-palette-ammo-pp`, from `main` at `9f8f45c`,
against production on an iPhone. Three messages from the author in one
session, filed as written, with the screenshot the first arrived with
([`assets/patch-dark-palette-starter.png`](assets/patch-dark-palette-starter.png)).

---

## The messages, verbatim

> Also the old color scheme was much nicer

Asked which scheme was meant (the whole app back to the dark palette Stage
5.0/1 turned over; keep light and darken some surfaces; a setting; or log it
only), the author answered:

> Whole app back to dark

And separately:

> Also the symbol for pp is a water droplet which makes no sense. Its essentially ammo, so use an ammo symbol

## The session's reading

1. **The palette.** "The old color scheme" is the dark one Stage 5.0/1
   replaced: a near-black frame, a dark panel and cream ink (`tokens.css`
   base values `#0b0f17`, `#151c27`, `#efe6d2`, `#a79f90`, V0 to 4.11). It
   returns on every screen. What 5.0 added on top of the palette stays: the
   shell nav, the window shapes, the heavy borders, the solid HP boxes, no
   drop shadows. Those tokens that were written for a light frame (the heavy
   border, the nav fill, the band bar track, the starter's toned panels, the
   overlay dim, the accent's ink) are re-derived for a dark one rather than
   left reading as light-on-light inverted. The type colours, status colours,
   HP colours and field tokens do not move.
2. **The PP glyph.** The drop becomes a cartridge: one round, side on, a
   casing and a tip. It keeps the PP family's id, label, slot and size; only
   the drawing changes. The bible's section 2 row says *"Small PP glyph"* and
   names no shape, so no rule moves.
3. **No bible amendment.** Neither the palette nor the PP glyph's drawing is
   a rule of the bible. The observation is logged in
   [`../design/playtest-log.md`](../design/playtest-log.md) because the log
   is where what the author saw goes, with the Amendment column saying none
   was needed.

Presentation only: no `core/` change, no version axis moves.
