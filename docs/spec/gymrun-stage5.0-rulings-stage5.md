# Stage 5.0: the decisions before 5.0/5, ruled, and 5.0/5 begun

Filed **before any change to the bible or `src/`**, per [`README.md`](README.md)
rule 7.

2026-10-01, on `claude/eloquent-heisenberg-383rnt`, at `main`'s `0c78f5b`
(5.0/4 merged as #80, the type chip patch as #81).

The author asked what had to be decided before 5.0/5, *Art pass*, of
[`gymrun-stage5.0-visual-redesign.md`](gymrun-stage5.0-visual-redesign.md), and
asked that the art already delivered be acknowledged. The session answered
with the art already in and ten items, each with a recommendation, plus three
confirmations, reproduced below. The answer was one line. Filed as written.

---

## The prompt, verbatim

> okay stage 4 is done. let's do the decisions for stage 5 and acknowledge some art work has been done

## The session's answer, as asked (abridged to the items and recommendations)

**The art already in.** All seventeen backdrops are art: nine battle
backdrops (eight locales and the gym) brought forward into 5.0/2
([`gymrun-stage5.0-battle-backdrops.md`](gymrun-stage5.0-battle-backdrops.md)),
eight map backdrops brought forward into 5.0/4
([`gymrun-stage5.0-map-backdrops.md`](gymrun-stage5.0-map-backdrops.md)),
633,340 bytes together (147,633 battle, 485,707 map). These were the largest
class C slots. 5.0/4 found every node standing in a painted clearing on the
default slot grid, so `BACKDROP_GRIDS` is still empty, and 5.0/2 sheeted all
nine battle backdrops under all ten field states. What remains is **33 icon
slots**, every one a lettered placeholder: 6 node, 8 capability, 12 relic,
5 nav, 1 currency, 1 wordmark.

**Blocking.**

1. **Who makes the 33 icons.** The plan leaves it open. A painting
   area-averaged down to an 8px mark is mush. **Recommended:** the session
   draws all 33 on the native grid, starting from the existing SVG marks so
   M1.1's distinctions carry over; the author may replace any with a file drop.
2. **Native size and path for node, capability and currency art.** D61 ruled
   8px through `glyphNode`; the manifest still says node 16x16, and an unused
   `currency` key sits beside 5.0/3's `currency-coin` glyph. Only 8 scales by
   whole multiples to both 16 (header) and 24 (card). **Recommended:** 8px as
   ruled, the manifest's 16 recorded as a deviation; the three families' keys
   stay (test 3) but `glyphNode` reads their art and falls back to today's SVG
   mark, never a lettered chip. One coin, not two.
3. **The gym battle backdrop's Poke Ball emblem**, on its floor and banners,
   against the plan's *"no Poke Ball logo"*. **Recommended:** the session
   paints it out at native 224x136 with an original mark, and checks the other
   sixteen backdrops for the same.
4. **M1.1's check gates the mount**, as D61 ruled: a new mark that is not
   distinguishable from its family at 16px is redrawn before it mounts.

**Not blocking, decide or defer.**

5. **The battle backdrops as they are.** Their landmarks sit under the
   opponent's HP box (5.0/2's pipeline notes). **Recommended:** final as
   delivered; a known difference. A repaint is the author's call.
6. **Slot grids.** **Recommended:** a per-locale overlay sheet over several
   seeds and the worst case; a `BACKDROP_GRIDS` entry only where a node lands
   on water or a roof. An empty table is a valid outcome.
7. **Contrast.** **Recommended:** a measured browser test of everything drawn
   straight onto a battle backdrop, across 9 backdrops by 10 field states.
8. **Sprites stay 96px.** 192 leaves the HP boxes no room at 390. A deliberate
   difference from the reference.
9. **Bytes.** **Recommended:** report the added bytes and first-load impact,
   as the plan asks; no byte budget as a gate.
10. **The wordmark.** **Recommended:** a 96x16 original, in the desktop sidebar
    only; it does not replace the phone header's title.

**Confirmations.** No version axis moves; all of it lives under
`src/ui/assets/`. The player marker stays the stock trainer sprite. 5.0/5 is
one branch from `main` and one PR, and stops for review.

## The author's reply, verbatim

> go with your recommendations for all items

---

## What it rules

| Item | Ruling |
|---|---|
| The art already in | **Acknowledged.** Seventeen of fifty class C slots, every backdrop, were delivered by the author in 5.0/2 and 5.0/4. 5.0/5's first bullet is the 33 icons; its slot grid and contrast bullets are checks against art that is already in. |
| 1. Who makes the icons | **The session draws all 33** at native size on the grid, from the existing marks where a family has them. Any may be replaced by the author with a file drop and a manifest line. The plan's *"Open: who makes class C"* closes. |
| 2. Native size and path | **8px through `glyphNode`**, as D61 ruled, for node, capability and currency. The manifest's `node` native moves 16 to 8, recorded as a deviation. Their manifest keys stay; the renderer reads the art and falls back to the SVG mark. The unmounted `currency` placeholder becomes `currency-coin`'s art: one coin. |
| 3. The gym's emblem | **Painted out** at native size with an original mark; the other sixteen backdrops checked. |
| 4. M1.1's check | **Gates the mount**, as D61 ruled. |
| 5. Battle backdrops | **Final as delivered.** Their composition under the HP boxes is a known difference. |
| 6. Slot grids | **Overlay sheets per locale**; an entry only where a node stands on water or a roof. |
| 7. Contrast | **A measured browser test** over 9 backdrops by 10 field states. |
| 8. Sprites | **96px.** A deliberate difference. |
| 9. Bytes | **Reported, not gated.** |
| 10. Wordmark | **96x16, original, desktop sidebar only.** |
| Confirmations | No version axis moves. The player marker is unchanged. One PR, then stop for review. |

Then: begin 5.0/5, *Art pass*, as amended by these rulings.
