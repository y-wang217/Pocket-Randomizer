# Sprites on every selection surface, an idle bob, and one motion per locale: the report

Prompt: [`../../spec/gymrun-patch-idle-sprites-and-locale-motion.md`](../../spec/gymrun-patch-idle-sprites-and-locale-motion.md).
Branch `claude/vibrant-euler-2taoqk`, cut from `main` at `3f97584` (PR #37).
Built 2026-09-15. Record: [`../../generation.md`](../../generation.md) section 19.

Every number here was measured on this tree after `npm ci && npm run build`,
headless Chromium at 390x844, seed `SMOKE24`, using the same
`scripts/visual/browser.mjs` driver the guarded measurement uses. The sprite
CDN is unreachable from the harness and is aborted in every test that reads a
figure, so a figure is measured as the fixed box it is with or without its
image.

---

## 1. Where a sprite now stands

| surface | host | figure size, Detailed / Simple / Pocket | phase |
|---|---|---|---|
| pick starter | `.starter`, top-right | 48 / 48 / 32 | card index |
| learn move | `.replace__owner`, right, centred on the line | 48 / 48 / 32 | 0 |
| party, drawer, pre-gym | `.party__member`, top-right | 48 / 48 / 24 | slot |
| recipient | `.party__member--target`, top-right, inside the button | 48 / 48 / 24 | slot |
| capture: offered, existing | `.party__member--offered`, `.party__member` | 48 / 48 / 24 | 0, slot |
| event gate at `latent` | `.figure-row` at the gate's right, one per holder, decked | 48 / 48 / 24 | slot |
| battle bench | `.bench__member`, right, centred on the row | 32 / 32 / 24 | protocol slot |
| run summary | `.summary__member-figure`, in flow, as V4 drew it | 96 | slot |

Not the battle stage's two actors, by the prompt file's second decision; not
the map's HUD strip or the locale screen's party strip, which are readouts
rather than selections. The figure is absolutely positioned in its host, so
it adds no flow height anywhere; the gutter that keeps a wrapped chip from
sitting under it is applied only where a card carries one, and in Pocket only
on the party and pre-gym screens (section 4).

## 2. The bob, as the browser reads it

`test/visual-sprites.test.ts`, on the gallery's party fixture:

| reading | Detailed | Pocket |
|---|---|---|
| `animationName` on every `.figure` | `figure-idle` | `figure-idle` |
| `animationDelay`, slot 1 vs slot 2 | differ | differ |
| figure width | 48 | 24 |
| `position` | `absolute` | `absolute` |
| under `prefers-reduced-motion: reduce`, on starter, replace, target, party | `none` | — |
| on a figure whose sprite the CDN did not have | `none` | — |

Two held frames over `--motion-idle` (1200ms), a lift of `--idle-rise` (2px,
1px in Pocket). No literal duration anywhere in an `animation` declaration:
`test/visual-tokens.test.ts` still counts **17**.

## 3. The eight motions

| locale | kind | element loop | mote loop | travels | what moves |
|---|---|---|---|---|---|
| cave | `cross` | 32s | — | yes | the V3 spark, unchanged |
| shore | `lap` | 7s | — | no | a foam line at the water's edge, in and out |
| summit | `soar` | 40s | 2s | yes | a bird right to left on an arc, two wing frames |
| city | `flicker` | — | 4s | no | six windows on the mid buildings, stepped |
| forest | `firefly` | 26s | 3s | yes | three motes blinking out of phase, floating by |
| ruins | `float` | 8s | — | no | the light hovering six pixels |
| marsh | `ripple` | — | 6s | no | two rings spreading, half a loop apart |
| badlands | `smoke` | — | 9s | no | three puffs rising eight vh and thinning |

`test/visual-v3.test.ts` reads every `animationDuration` under the element on
all eight locales: travelling kinds twenty seconds or longer on the element,
in-place kinds four seconds or longer on the element where it has a loop, and
two seconds or longer on every mote. Under reduced motion no element is
mounted, as before. The art stays inline SVG in the two legal fills and all
eight scenes gzip to under the 30 kB budget (`test/world.test.ts`).

The proxy trace, `scripts/visual/perf.mjs` at 4x CPU throttle over two
seconds of map scroll, re-run on every locale and written to
`v3-perf.json`:

| locale | frame work p95 (ms) | paint mean (ms) |
|---|---|---|
| cave | 4.12 | 0.16 |
| shore | 4.69 | 0.23 |
| summit | 4.58 | 0.19 |
| city | **6.30** | 0.26 |
| forest | 4.23 | 0.17 |
| ruins | 4.20 | 0.19 |
| marsh | 5.13 | 0.17 |
| badlands | 4.48 | 0.22 |

The gate is 16 and 4. `busiest` moved from forest to city, and the perf test
reads it from the file, so it now traces the city. Still a proxy: verify on a
phone, as V3.6 says.

## 4. What the measurements caught

Two things, both fixed before any commit carried them.

**The map moved 26 px.** The map's HUD cards wear `.party__member` too. The
Detailed and Simple header gutter re-wrapped their heads: `measure.mjs
--compare` reported `map.screenHeight` 887.78 against 861.78 in Detailed and
824.88 against 798.88 in Simple, with Pocket and the battle unmoved. The
gutter is now on `.party__member:has(> .figure)`, and the compare reads
**equal to the pixel** in all three densities and both move bar layouts.

**The capture block went to 872.** The first Pocket gutter for two-up cards
covered the capture block's comparison list as well as the party screen, and
put one more wrapped row on one of its cards: the Pocket gate read
`result-capture` at 872 against 844. The Pocket gutter is now on the party
and pre-gym screens only, where both took it; on the comparison list the slot
number ahead of the name keeps the corner clear at 24 px, and the gate reads
17 of 17.

## 5. Gates

| gate | result |
|---|---|
| `eslint .` | clean |
| `tsc --noEmit` | clean |
| `vitest run` | 123 files, 1652 tests, all passing; the one unhandled error is the reporter's `onTaskUpdate` timeout already recorded against both suite runs in `generation.md` section 15, and it is what makes `npm run check` stop before the strict-trim step, which was run on its own |
| `test/visual-tokens.test.ts` duration pin | **17**, unmoved |
| `test/visual-pocket.test.ts` | 17 of 17, every decision surface, both overlays, both archives |
| `scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json` | **equal to the pixel** in Detailed, Simple and Pocket, both move bar layouts; nothing re-recorded |
| `test/visual-v3.test.ts` | the vertical budget, the world, the motion floors on all eight, contrast on all eight, the perf gate on the busiest |
| `npm run build && npm run smoke` | passed, rematch seed `GYMRUN-53145f-SMOKE24` |
| `GYMRUN_TRIM_STRICT=1 vitest run` | 123 files, 1652 tests, all passing, run on its own; the same reporter timeout, and nothing else |

## 6. What was not done

- **Animated GIF sprites.** Investigated and recorded in
  [`../../engine-notes.md`](../../engine-notes.md); not built, by the third
  decision.
- **A bob on the battle stage's actors.** Not this patch, by the second
  decision. The figure's wrapper is designed so that it could be, without
  touching the beats.
- **A drawn mine cart.** The cave keeps its spark, by the first decision.
- **The excursion assertion.** The plan proposed asserting an in-place
  element's bounding box over a sampled second inside a 56 px box. The floors
  and the perf trace are asserted; the excursion is bounded by the keyframes
  themselves (six pixels, eight vh, two percent) and is read off the
  stylesheet rather than measured. Recorded here so the next reader knows the
  test does not hold it.
