# Stage 5.0/4: the map backdrops

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/loving-darwin-lpx2r4`. The author brings the map
backdrops forward from 5.0/5 into 5.0/4, as the battle backdrops were brought
into 5.0/2 ([`gymrun-stage5.0-battle-backdrops.md`](gymrun-stage5.0-battle-backdrops.md)),
and asks for them in this stage's PR. Filed as written.

---

## The exchange, verbatim

The author:

> are you ready for the map background assets? i'd like to include them in this pr

The session answered with what it needed: one portrait image per locale
(`cave`, `shore`, `summit`, `city`, `forest`, `ruins`, `marsh`, `badlands`),
terrain with no painted paths, paintings welcome and converted as the battle
backdrops were.

The author, with five images attached:

> here are the 8 maps that correspond

---

## What arrived

Five of the eight, each a 1024x1536 painting in a pixel-art look, identified
by their scenes. The originals are kept in [`assets/`](assets/):

| Order | Locale | File |
|---|---|---|
| 1 | city | [`assets/stage5.0-map-backdrop-city.webp`](assets/stage5.0-map-backdrop-city.webp) |
| 2 | summit | [`assets/stage5.0-map-backdrop-summit.webp`](assets/stage5.0-map-backdrop-summit.webp) |
| 3 | shore | [`assets/stage5.0-map-backdrop-shore.webp`](assets/stage5.0-map-backdrop-shore.webp) |
| 4 | cave | [`assets/stage5.0-map-backdrop-cave.webp`](assets/stage5.0-map-backdrop-cave.webp) |
| 5 | marsh | [`assets/stage5.0-map-backdrop-marsh.webp`](assets/stage5.0-map-backdrop-marsh.webp) |

**Forest, ruins and badlands did not arrive** with the message that names
eight. They keep the placeholder until they do.

## What the session takes from them

- **Native size 272x408**, 2:3 as painted, in place of the spike's 216x432
  (1:2). At 2 CSS px an art pixel that is 544x816, which covers the map area at
  every plan size (the tallest, 1920x1080, is 816) with nothing cropped from
  the composition but the sides on narrow frames. Recorded as a deviation in
  `../generation.md`.
- **Anchored to the foot.** Each painting stands a building at the bottom, which
  is where the graph's entrance row and the player's trainer are.
- **Each painting has a broad clearing up its middle**, which is where the slot
  grid puts nodes; a locale whose nodes land on water or cliffs gets its own
  grid in `BACKDROP_GRIDS`.
