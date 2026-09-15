# GYMRUN patch — sprites on every selection surface, an idle bob, and one motion per locale

Committed verbatim before any work began on it, per protocol 7 in
[`README.md`](README.md). Filed 2026-09-15 on `claude/vibrant-euler-2taoqk`.
The brief as issued, unedited.

Presentation only: no `core/` change beyond one pure helper, and no version
axis moves — `contentHash`, `RUN_LOG_VERSION`, `RANDOMIZER_VERSION` and
`AI_VERSION` all stand.

**Not edited to match what gets built.** Where the built work deviates, the
deviation is recorded in [`../generation.md`](../generation.md) with a dated
note, per protocol 4.

---

## The patch brief, as issued

okay new feature request: more sprites and make them bob up and down on idle
sprites on: learn move, pick starter, swap party, check party, events where the type matches the requirement
learn move, all the other pages where pokemon can be selected.
also, there's a backgroud in cave region that has a moving cart in the background. make all the other regions have some moving part e.g. waves on shore, firefly floats by in forest, city has flashing lights, badlands has smoke, etc.

make a plan for this. identify changes needed to be made, how to implement them with the resources we have or proposing added resources.

---

## The three questions the planning session asked, and their answers

Asked and answered before any code, after the exploration and before the plan
was finalised:

1. **The cave's moving part is a glowing spark crossing the screen (the shared
   drift element; there is no drawn cart). Keep it, or redraw it as a mine
   cart?** — *Keep as-is.* It reads well and is the reference the other seven
   are being brought up to.
2. **Should the two battle-stage sprites also bob when idle?** — *Selection
   surfaces only.* The stage actors carry the lunge, recoil and faint beats and
   their height is pixel-pinned; they are unchanged this patch.
3. **CSS two-frame bob on the static gen 5 sprites, or real animated GIF
   sprites from the same CDN?** — *CSS for this patch. Investigate what it
   would take to add animated GIF sprites and record the findings in the
   codebase.* The findings are in
   [`../engine-notes.md`](../engine-notes.md), under "Animated sprites through
   `@pkmn/img`: what it would take".

## The plan, as reported

The brief asked for a plan before code, which under `CLAUDE.md` Process is a
hard stop. This is the plan that was reported. It is kept here so the build
can be read against it.

### What the exploration established

- **The "cart" in the cave is the one shared drift element.** Every locale in
  `src/ui/theme/scenes/*.ts` already ships one `drift` SVG that
  `createWorldScene` in `src/ui/scene.ts` mounts as a single `.world__drift`
  on the mid layer, animated by one shared `@keyframes world-drift`: a
  32-second left-to-right crossing. The cave's is a 2x2 glow pixel with a
  trail, which reads as a cart rolling by. Shore has a boat, summit a bird,
  forest a leaf, city a lit window, ruins and marsh a wisp, badlands a
  tumbleweed, all on the same slow line, so most never register. The work is
  per-locale motion kinds, not new assets.
- **Everything is inline SVG strings, no rasters on disk.** `test/world.test.ts`
  enforces: only `var(--layer-fill)` and `var(--locale-glow)` fills, no image,
  href, url(), text or data: URI; exactly one `.world__drift` per locale; none
  under reduced motion; under 30 kB gzipped for all eight.
- **Sprites come from the Showdown CDN** through the adaptable entry of
  `@pkmn/img` in `src/ui/sprites.ts`, gen 5 static PNG, 96x96. Tests abort
  the CDN route, so a sprite is an invisible fixed box offline and layout
  measurements hold.
- **Hard layout gates**: Pocket density zero-scroll at 390x844 for every entry
  of `DECISION_SURFACES` (`test/visual-pocket.test.ts`); map and battle heights
  pixel-pinned in all three densities (`docs/visual/baseline/heights.json`);
  17 literal animation durations pinned (`test/visual-tokens.test.ts`), so every
  new `animation` value must be a `var()` or `calc()`; reduced-motion overrides
  must use selectors matched exactly to the rules they override.
- Sprites render today in exactly two places: the battle actors and the run
  summary. None of starter pick, learn-move owner, party screen, drawer,
  pre-gym lead, item target, catch, event gate or battle bench shows one.

### Part A. Sprites with an idle bob

**A1. One figure component**, in `src/ui/sprites.ts`: `spriteFigure(species,
{ phase, side? })` returns a `span.figure` wrapping the existing `spriteImg`.
The figure is `aria-hidden` (the adjacent name says who it is; the battle
actors' convention); the img keeps `alt = species`. The phase is the caller's
slot or card index, written as `--idle-phase`, never drawn from RNG. The bob
lives on the wrapper and never on `img.sprite`, because `sprite-hit`,
`sprite-sink` and `sprite-rise` own `transform` and `animation` on
`.stage__actor .sprite` and the beats tests read `animationName` there. A
`.figure` never appears inside `.stage__actor`.

**A2. CSS.** Tokens beside the motion block in `src/ui/theme/tokens.css`, with
a comment that idle is not per-turn feedback and so is not derived from
`--motion-duration`: `--motion-idle: 1200ms` (two held frames), `--idle-rise:
2px` (1px in Pocket), `--figure-size: 48px` (32px in Pocket; 24px on member
cards). The figure is absolutely positioned in the host's corner so it costs
zero flow height in every density; hosts get `position: relative`. Keyframe
`figure-idle` is a two-step `translateY` hop with `steps(1, end)`, a negative
`animation-delay` from the phase so a row of six is not in lockstep, and no
literal durations. Reduced motion: `.figure { animation: none }` in the
existing block, plus a rule that an empty (missing-sprite) box does not bob.

**A3. Surfaces**, pattern: append `spriteFigure(species, { phase: index })` to
the host.

| surface | file | host | size D/S/P |
|---|---|---|---|
| pick starter | `screens/starter-select.ts` | `.starter` card, top-right | 48/48/32 |
| learn move (owner) | `screens/move-replace.ts` | `.replace__owner`, right, centred by a negative margin rather than a transform | 48/48/32 |
| check party, swap party, pre-gym lead | `member-card.ts` (shared by party, drawer, pre-gym) | `.party__member`, top-right inside the header line | 48/48/24 |
| item, TM, tutor target | `screens/item-target.ts` | `.party__member--target` | 48/48/24 |
| catch: offered and existing | `screens/acquisition.ts` | `.party__member--offered`, `.party__member` | 48/48/24 |
| event gate, type matches | `screens/event.ts` | `.event__gate`, a figure row at the right, one per matching member, overlapped as a deck | 48/48/24 |
| battle bench (switch) | `scene.ts` bench | `.bench__member`, right, centred | 32/32/24 |
| run summary | `screens/summary.ts` | wrap the existing sprite so it bobs; size unchanged | 96 |

Out of scope, deliberately: the battle stage actors (own beat grammar), the
run-map HUD strip and the locale-select strip (readouts, not selections; map
is pixel-pinned). **The bench is conditional**: battle height is pinned in all
three densities, so step one is a height compare on battle; if any height
moves, the bench is cut and the cut recorded, rather than re-baselined.

**A4. Event screen: who matches.** `resolveCapability` in
`src/core/capabilities.ts` returns only the band and `hasType` is
module-private. Add one pure helper with no new imports,
`capabilityHolders(run, capability)`, returning the party members whose
species carries a type in the capability's set, in slot order, and have
`resolveCapability` read its length so the two cannot disagree. The event
screen shows the holders' figures only at band `latent`, in slot order (a
position, not a rank, so an attribute and not a verdict); `known` is answered
by the relic and `none` has nobody.

### Part B. One signature motion per region

**B1. Data shape.** `SceneArt` in `src/ui/theme/scenes/index.ts` gains
`motion: { kind, at? }` with `WORLD_MOTION_KINDS = ['cross', 'soar', 'lap',
'firefly', 'flicker', 'smoke', 'float', 'ripple']`. `drift` stays a string and
may now hold several sibling motes. `SCENES` is a record over every locale, so
a locale without a motion is a compile error.

**B2. Mount.** Still exactly one `.world__drift`, still absent under reduced
motion. `data-motion` carries the kind; `at` sets `--drift-x` / `--drift-y`.

**B3. CSS.** The element reads its animation name, period, size and easing
from custom properties; each kind sets them on `[data-motion=...]`. One
`@keyframes world-<kind>` per kind; motes inside an in-place kind get
staggered delays. Transform and opacity only, so the perf gate holds.

**B4. The eight motions** (four as requested, four proposed):

| locale | today | new kind | what moves | period |
|---|---|---|---|---|
| cave | glow spark crossing ("the cart") | `cross` | unchanged, the reference | 32s |
| shore | boat crossing | `lap` | a foam line on the mid layer slides in and back, fading at the turn (waves) | 7s |
| forest | leaf crossing | `firefly` | a glow dot drifts on a wandering path while blinking; three motes out of phase | 18s |
| city | one lit window crossing | `flicker` | window rects over the far skyline blink in stepped opacity, plus one slow beacon pulse | 4s |
| badlands | tumbleweed crossing | `smoke` | three puffs rise from the right rock stack, grow and fade, staggered | 9s |
| summit | bird crossing | `soar` | bird crosses right-to-left high with a slow arc and a two-frame wing flap | 40s |
| ruins | mote crossing | `float` | the light hovers in place, a few px vertical, with a slow pulse | 8s |
| marsh | wisp crossing | `ripple` | rings expand and fade on the water, two out of phase | 6s |

Any blinking mote caps at 0.6 of the glow and in-place excursion stays within
twice `--drift-size`, so nothing flashes at full brightness or leads the eye to
a control.

**B5. The 20-second rule.** The visual identity plan says the loop is 20
seconds or longer and never draws the eye toward any UI element, enforced by
`test/visual-v3.test.ts`. That floor was written for a traversal, where loop
length is crossing speed. For in-place kinds what protects the spirit is
frequency and excursion, not length. The test is restated as two floors keyed
on `data-motion`: travelling kinds at 20s or longer; in-place kinds at 4s or
longer with the bounding box over a sampled second inside a 56px box (except
`lap`, which is wide by design and is asserted on height). Recorded as a dated
deviation from the plan in `docs/generation.md`, not an edit to the plan.

### Part C. Investigation only: animated GIF sprites

Recorded in `docs/engine-notes.md`. Not built this patch.

### Tests

- `test/capabilities.test.ts`: `capabilityHolders` slot order, fainted
  included, empty on no match, `resolveCapability` agrees with it.
- `test/event-screen.test.ts`: one figure per holder at `latent`, none at
  `known` or `none`.
- New `test/sprites.test.ts` (jsdom): figure shape and phase; one figure per
  Pokemon on every surface above; zero figures inside `.stage__actor`; a tree
  grep that every `img.sprite` is built by `spriteImg`.
- `test/world.test.ts`: every locale's kind is a known kind, `data-motion`
  matches it, and a keyframe exists in the stylesheet for every kind; the
  existing one-drift, fill, raster and gzip assertions unchanged.
- `test/visual-v3.test.ts`: the per-kind floors, all eight locales.
- A Chromium case: the figure's `animationName`, two figures on one surface
  differing in delay, reduced motion giving none.
- Must stay green untouched: the Pocket gate, the pinned heights, the beats
  tests, the token pin, the boundaries, the contrast sweep.

### Docs, last

`docs/generation.md` section 19; a report under `docs/visual/reports/` in the
shape of the bar-and-beats report; the `docs/README.md` current-state entry;
this register row flipped on merge.

### Resources

Nothing new. All art stays inline SVG in the locale's two legal fills; sprites
keep coming from the existing CDN dependency.

### Checkpoints

1. This file and its register row, and the engine note.
2. Core helper, figure component, tokens and CSS, with tests.
3. Surfaces, with the battle height compare first.
4. World motions, with the perf sweep.
5. Docs and the report.
