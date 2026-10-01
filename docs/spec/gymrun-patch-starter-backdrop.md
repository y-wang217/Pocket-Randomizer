# Patch: the starter screen's backdrop

Filed **before any change to `src/`**, per [`README.md`](README.md) rule 7.

2026-10-01, on `claude/sleepy-dijkstra-tp2176`, after the R22 feedback patch
([`gymrun-patch-r22-stats-at-rest-and-map.md`](gymrun-patch-r22-stats-at-rest-and-map.md))
and in the same PR. Filed as written.

---

## The message, verbatim

> Add this asset to starter page

One image: [`assets/stage5.0-starter-backdrop.webp`](assets/stage5.0-starter-backdrop.webp),
kept as delivered (a 1024x1536 PNG, stored as WebP like the other originals).

## What arrived

A 1024x1536 painting in a pixel-art look, 2:3 like the map backdrops: a
grassy clearing in the foreground between two low stone walls with a red and
a yellow banner on wooden posts, opening on a misty valley, and beyond it the
whole world in the distance: a lake and coast, a city, ruins on a cliff, red
badlands, a cave mouth, snowy peaks under a morning sky.

## The session's reading

The starter screen gets a scene backdrop, the same component the battle stage
and the map draw (bible section 5, *Scene backdrop*), converted to the map
backdrop's native grid (272x408) by `scripts/visual/backdrops.py`, behind the
screen inside the frame. The starter cards and the detail panel stay opaque
over it. Section 5's Scene backdrop row names its call sites, so the starter
screen joining them is a bible amendment (Rev 20, D87), in the same PR.
