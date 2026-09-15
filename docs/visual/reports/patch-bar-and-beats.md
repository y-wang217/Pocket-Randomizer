# The bar primitive and the battle beats: the report

Prompt: [`../../spec/gymrun-patch-bar-primitive-and-battle-beats.md`](../../spec/gymrun-patch-bar-primitive-and-battle-beats.md).
Branch `claude/kind-mccarthy-w3kml6`, cut from `main` at `321d4f9` (PR #34).
Built 2026-09-15. Record: [`../../generation.md`](../../generation.md) section 17.

Every number here was measured on this tree after `npm ci && npm run build`,
headless Chromium at 390x844, seed `SMOKE24`, using the same
`scripts/visual/browser.mjs` driver the guarded measurement uses.

---

## 1. The answer to the prompt's question

Both features shipped in Release C (PR #16, `846975c`). The jiggle was on the
panel, not the sprite, because sprites reached the battle screen at V5.3,
after Release C. The HP bar was deliberately not animated: it snaps and leaves
a fading chunk, which is the effect the prompt then proposed. So this patch
did not add the chunk; it gave the chunk a component, and gave the jiggle the
body it was always describing.

## 2. What the tree looks like after

| surface | before | after |
|---|---|---|
| battle panel HP | track, shadow and fill built in `createSidePanel`; chunk logic in `markHpChunk` | `createBar({ shadow: true })`; `set` returns whether a chunk was drawn |
| bench HP | hand-built `hp hp--slim` | `createBar({ variant: 'slim' })` |
| party member card, item target, acquisition, run map | four copies of the same five lines and band ternary | `createBar().set(fraction)` |
| the side that acted | `.panel[data-jiggle]`, 2px on X, `panel-nudge` | `.stage__actor[data-acted]`, an 8px lunge toward the opponent, `actor-lunge` |
| the side that was hit | nothing | `.sprite` under `[data-hit]`, 4px back and an opacity dip to 0.55, `sprite-hit`, iff the bar drew a chunk |
| a KO | the sprite stood at full opacity until replaced | `sprite-sink` on `[data-fainting]`, held at its end state by `[data-fainted]` |
| tokens | `--motion-jiggle`, `--jiggle-distance` | `--motion-beat`, `--lunge-distance`, `--hit-recoil`, `--hit-dip` |

DOM shape and class names are unchanged at every bar site. The panel no longer
carries any beat attribute.

## 3. The timeline, as the browser reads it

`test/visual-release-c.test.ts` reads these off computed style after a real
turn on `SMOKE24`, with `battleFeedbackMs` at its shipped 500:

| element | `animationDuration` | `animationDelay` |
|---|---|---|
| `.stage__actor[data-acted="1"]` | 0.125s | 0s |
| `.stage__actor[data-acted="2"]` | 0.125s | 0.25s |
| `[data-hit="1"] .sprite` | 0.125s | 0.125s |
| `[data-hit="2"] .sprite` | 0.125s | 0.375s |
| `.panel--foe .hp__shadow` | 0.5s | — |

The last slot ends at 0.5s, where the shadow's fade ends. Under
`prefers-reduced-motion: reduce` every actor and sprite reads `animationName:
none`, the shadow's opacity is `0`, the acted and hit marks are still on the
actors and the flag strip still prints its words.

## 4. Gates

| gate | result |
|---|---|
| `eslint .` | clean |
| `tsc --noEmit` | clean |
| `vitest run` | 119 files, 1579 tests, all passing; the one unhandled error is the reporter's `onTaskUpdate` timeout already recorded against both suite runs in `generation.md` section 15 |
| `test/visual-tokens.test.ts` duration pin | **17**, unmoved; every new length is a `calc` over `--motion-beat` |
| `npm run build && npm run smoke` | passed, rematch seed `GYMRUN-53145f-SMOKE24` |
| `scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json` | **equal to the pixel** in Detailed, Simple and Pocket, and in both move bar layouts; nothing re-recorded |
| `GYMRUN_TRIM_STRICT=1 vitest run` | see section 5 |

## 5. Strict trim

Open item 8 records the gate as red on `main`: the app does not boot under the
strict proxy, and every browser test fails at `openApp`. This patch touches
nothing the proxy guards. The count on this tree is recorded below so the next
reader can tell whether it moved.

**Green on this tree.** `GYMRUN_TRIM_STRICT=1 vitest run`: 119 files, 1579
tests, every one passing, including all five browser files that open item 8
names as failing at `openApp`. The only error is the reporter's `onTaskUpdate`
timeout, the same one the unstrict run carries. Open item 8's count was taken
on `9296ba7`; whatever made the strict proxy throw at start-up is no longer in
the bundle at `321d4f9`, and this patch did not touch it. The item is not
closed here — that is a reading of the tree, not a fix with a commit to name —
but its number is stale and the next reader should re-measure before treating
the gate as red.

## 6. What was not done

- `.stat__bar-fill` stays on its own `120ms` width transition. Open item 16.
- The `neutral` bar variant ships with one rule and no consumer.
- No screenshot. The beats are motion, and a still frame of a lunge is a
  sprite 8px out of place; the browser timing table above is the evidence.
