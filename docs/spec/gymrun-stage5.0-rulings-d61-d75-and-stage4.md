# Stage 5.0: D61, D63, D64, D72 and D75 ruled, and 5.0/4 begun

Filed **before any change to the bible or `src/`**, per [`README.md`](README.md)
rule 7.

2026-09-30, on `claude/loving-darwin-lpx2r4`, branched from `main` at `b4c8e7b`
(5.0/2 merged as #78).

The author asked what had to be decided before 5.0/4, *Map*, of
[`gymrun-stage5.0-visual-redesign.md`](gymrun-stage5.0-visual-redesign.md). The
session answered with seven items, each with a recommendation, reproduced
below as the question the ruling answers. The answer was one line. Filed as
written.

---

## The prompt, verbatim

> alright. time to start stage 4 of version 5 update. what are decisions first

## The session's answer, as asked (abridged to the items and recommendations)

**Blocking.**

1. **D63, what a node on the graph shows.** The register recommended the full
   map node card on every node. 5.0/0 measured that it does not fit: at
   390x844 there is room for one extra line under a node, at the desktop's
   71px pitch none. **Recommended:** the next-step row, the only row that is a
   decision, carries the full card. Later rows carry the mark, tier pips and
   capability glyph, and the rest is on the long press. A section 5 Map node
   card amendment, close to R1's "compact variant", named as needing an
   explicit ruling. Test 7 reads *"only next-step nodes commit; every node
   inspects."*
2. **D64, capability held or not held.** **Recommended option 1:** keep the
   three-state chevron (none, latent, known); "held" is `known`.
3. **D72, the locale card.** **Recommended option 1:** the gym stays in the
   rail, once. The backdrop crop replaces the swatch, a section 5 amendment.
   Type badges are type chips (D62).
4. **D75, node positions.** **Recommended option 1:** each node takes a slot by
   its option index in the step. No hash, no CLAUDE.md note.

**Not blocking, decide or defer.**

5. **D61, node art.** **Recommended option 1:** art enters through `glyphNode`
   at 8px native; trainer sprites for the player marker only. 5.0/4 keeps
   today's SVG marks and fixes only their size on the graph.
6. **Map backdrops.** Supply paintings now, as for the battle backdrops, or
   ship the placeholder (a flat locale tint). **Recommended:** placeholders,
   unless paintings are supplied.
7. **Below 390x844.** **Recommended:** a pitch floor; past it, rows above the
   next step compress to the mark alone.

**Confirmations.** The commit behaviour stays: one tap on a next-step node
commits, no confirm step; long press inspects (D52). 5.0/4 runs before 5.0/3,
which still waits on D65 to D71.

## The author's reply, verbatim

> go with your recommendations for all items

---

## What it rules

| Row | Ruling |
|---|---|
| D61 | **Option 1.** Class C node and capability art enters the glyph sheet as glyph entries drawn by `glyphNode`, native 8px, the six named marks kept, M1.1's colour-blind check re-run before 5.0/5 mounts art. Trainer sprites are the player marker only. 5.0/4 draws the existing SVG marks. |
| D63 | **Neither option as written; the session's hybrid.** The next-step row mounts the full map node card with every fact at rest. Rows past the next step, and the rows already passed, carry the mark, tier pips and capability glyph with its chevron; every other fact is on that node's long press. Every node inspects; only next-step nodes commit. Bible section 5's Map node card row amended. |
| D64 | **Option 1.** The band chevron stays, three states. "Held" is `known`. |
| D72 | **Option 1.** The gym stays in the rail, once. The locale card is the locale name, four type chips and a crop of the locale's map backdrop, which replaces the palette swatch. Section 5's Locale card row amended. |
| D75 | **Option 1.** A node's position is its option index within its step, placed against the backdrop's slot grid. No hash; CLAUDE.md unchanged. |
| Map backdrops | **Placeholders.** Eight portrait map backdrops ship as flat locale tints through the manifest. Painted art is 5.0/5's, or an asset delivery like [`gymrun-stage5.0-battle-backdrops.md`](gymrun-stage5.0-battle-backdrops.md). |
| Pitch floor | **Taken.** Below the pitch the next-step card needs, the rows other than the next step compress to the mark alone, their facts on the long press. |
| Commit | **Unchanged.** One tap on a next-step node commits. Long press inspects any node. |
| Order | **5.0/4 before 5.0/3.** |

Then: begin 5.0/4, *Map*, as amended by these rulings.
