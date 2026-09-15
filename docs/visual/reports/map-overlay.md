# The map overlay, and the three overlays as windows

Branch `claude/hopeful-curie-5ah94f`. Prompt:
[`../../spec/gymrun-patch-map-drawer-window-overlays.md`](../../spec/gymrun-patch-map-drawer-window-overlays.md),
filed 2026-09-15 before any work. Record:
[`../../generation.md`](../../generation.md) section 17.

Screenshots in [`map-overlay/`](map-overlay/), at 390x844 and 1280x900.

## What shipped

A **Map** button beside **Party** in the same bar, opening the run map as a
readout from every decision surface. And all three overlays — party drawer,
battle history, map — are centred windows on one extracted shell rather than
three hand-copied bottom sheets.

## The measurements

Taken in a real Chromium through `scripts/visual/browser.mjs`, on `SMOKE24`,
with the overlay opened from the surface named.

### Geometry

| overlay | 390x844 | 1280x900 | gutters | window? |
|---|---|---|---|---|
| party drawer | 366x820 | 544x876 | 12px every side (phone), 12/368 (desktop) | yes |
| battle history | 366x233 | 544x214 | 12px every side | yes |
| map, from a battle | 366x690 | 704x610 | 12px every side | yes |
| map, from a shop | 366x617 | 704x573 | 12px every side | yes |

"Window" means a strip of the screen underneath is visible on **all four**
sides. The bottom sheet had one, capped at `90vh` by a phone rule which is now
retired — the window is **820px of an 844px phone against the old 760**, so it
is more room and not less.

The map overlay is the wide one (`--overlay-width-wide`, 44rem) because its
rail and chain are horizontal; the other two keep a reading width (34rem). On
a phone neither is reachable and both are the viewport less its gutters.

### The four properties, per surface

| property | battle | shop | map screen |
|---|---|---|---|
| clickable nodes in the overlay | 0 | 0 | trigger hidden |
| buttons anywhere in the chain | 0 | 0 | — |
| Escape closes | yes | yes | — |
| focus returns to the trigger | yes | yes | — |

`0 clickable nodes` is the one that matters. `renderChain` is called with no
`onChoose`, and `renderNode` renders a div rather than a button when none is
passed, so the map screen stays the single path by which a node is chosen.
`test/map-drawer.test.ts` asserts it per surface rather than once.

### Content

Both readouts populate from real run state: the eight-gym rail with all 8 gyms,
the segment heading (`Gym 2 of 8 — Marina`, type, team size, steps to the gym,
leader blurb), the region line with its four types, and the step chain with
taken steps collapsed, upcoming kinds, tier badges and event gates.

The desktop shop shot is the feature's own argument: the player is standing in
a shop carrying 131 coins and can see two more shops and a rest ahead of them.
That is the decision the overlay exists to inform, and before this it was one
screen away.

## Gates

| gate | result |
|---|---|
| `npm run lint` | green |
| `tsc --noEmit` | green |
| `npm run build` | green |
| `npm run smoke` | green, including "the party drawer is reachable in a battle (1 triggers)" — the map trigger has its own attribute and does not pollute that count |
| `scripts/visual/measure.mjs --compare` | **guarded screen heights equal `baseline/heights.json` to the pixel** |

The height comparison is the one worth naming. Overlays are `position: fixed`,
so a moved number would have meant something leaked into the document flow.
Nothing did.

`npm run smoke` is the gate this patch most needed. The `[hidden]` /
`display: flex` trap is recorded three times in `styles.css` — once per
hand-copy — and the smoke script caught it all three times, because jsdom has
no pointer-event model and every unit test passed while an invisible scrim ate
every click. This patch rewrote exactly that rule set. It is guarded once now.

## Two findings worth recording

### The baseline was green, and two "pre-existing" failures were this patch's

The first two baseline runs were started before the working tree was clean of
in-flight edits and were contaminated by them. Re-run at `5d0bd18` in an
isolated worktree, **the suite is fully green**, and both failures the
contaminated runs reported — `band.test.ts` and `tutorial-browser.test.ts` —
turned out to belong to this patch. Both are fixed.

The lesson is procedural: a baseline taken in the tree you are editing is not a
baseline.

### `docs/README.md` section 5's strict-trim note is stale

That section records strict trim as red, with "22 browser tests fail under
`GYMRUN_TRIM_STRICT=1`" and the app not booting under it.

**Measured at `5d0bd18` in the clean worktree: 118 files, 1554 tests, all
passing.** Whatever fixed it is not this patch — the run predates every `src/`
change here — so the note is simply out of date, and section 5 is corrected
rather than repeated.

This is the second thing in one night that was believed red and was not. Both
came from taking a recorded state as current instead of measuring it.

## What this moves

Nothing. No `core/` change, no version axis moves — `contentHash`,
`RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and `AI_VERSION` all stand — no draw
moves, and seeded output is byte-identical. Balance is not a gate and no
balance number was touched.
