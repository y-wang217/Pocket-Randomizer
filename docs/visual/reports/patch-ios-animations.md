# The iOS animations patch — a second engine, and what Bug B was not

Prompt: [`../../spec/gymrun-patch-ios-animations-webkit-harness.md`](../../spec/gymrun-patch-ios-animations-webkit-harness.md).
Branch `claude/awesome-noether-h6p8fj`, 2026-09-16, on top of PR #40 (`284c66f`).
Deviations: [`../../generation.md`](../../generation.md) section 27.

Presentation and test infrastructure only. No `core/` change, no version axis
moved, `contentHash` unmoved at `c3964b`.

---

## 0. The short version

The patch asked for five things and all five shipped. Two of them did not turn
out to be what the brief said they were, and this report is mostly about those
two, because being wrong about a cause is more expensive than being wrong about
a fix.

| item | what the brief said | what shipped |
|---|---|---|
| 1. WebKit in the harness | add the engine, expect the 22 to go red | added; **11 red**, seven of which were *this repo's instruments* and are fixed, four narrowed with a named reason |
| 2. Bug A, the CSS round trip | the parser only accepts `750ms` | the parser accepted both spellings already; **the round trip was still the bug**, and it is deleted |
| 3. Bug B, the motion system | "has never run on iOS", pick one of five causes | **does not reproduce.** All twelve animated classes start and move on WebKit. All five candidates ruled out by experiment. No CSS changed |
| 4. `backdrop-filter` | needs a `-webkit-` fallback | shipped, plus an opaque `@supports not` path |
| 5. reduced motion | the hold must not go to zero | shipped — **and it is the one configuration that reproduces the reported symptom exactly** |

---

## 1. The harness: binary, descriptor, and what it costs

**WebKit 26.6**, Playwright build **2359**, from `playwright@1.63.0`, on Linux.
Chromium is unchanged: the pinned `/opt/pw-browsers/chromium-1194`, version
`141.0.7390.37`.

**The descriptor** is Playwright's own `iPhone 14 Pro Max`, with its viewport
overridden back to this repo's pinned 390x844:

```js
export const IPHONE = { ...devices['iPhone 14 Pro Max'], viewport: PHONE };
```

so the WebKit leg runs with `hasTouch`, `isMobile`, the Mobile Safari user agent
(`…iPhone OS 16_0 like Mac OS X… Version/26.6 Mobile/15E148 Safari/604.1`) and
`deviceScaleFactor: 3` — the three properties the brief names, all present. The
width is the one thing held back, and generation.md section 27 deviation 4 is
the argument: 390 is the narrower of the two, every recorded number in
`docs/visual/baseline/` is pinned to it, and neither defect is width-dependent.
`test/visual-motion.test.ts` asserts the descriptor is actually in force rather
than trusting the config, so a harness that quietly stopped applying it fails.

**The axis is `GYMRUN_ENGINE`**, read once in `scripts/visual/browser.mjs`.
`npm run check` now runs `lint → tsc → vitest → test:webkit → trim-strict`, so a
WebKit failure fails the suite. `npm run test:browser` is the browser subset and
`npm run test:webkit` is that subset with the engine flipped.

**What it costs**, stated plainly because it is the reason to keep the browser
subset separate from the full run: the WebKit leg is 26 files and about
**6 minutes** of wall clock on this box, on top of the existing suite.

### The 3x density earned itself immediately

This is the best argument for using a real descriptor rather than a narrow
window, and it is an argument from evidence rather than from principle.

`test/visual-chips.test.ts` takes a full-page screenshot and indexes into it
with `getBoundingClientRect` coordinates. Those are CSS pixels; a screenshot is
device pixels. On the 1x desktop Chromium this suite has run in for its whole
life the conversion was the identity, so its absence was invisible.

At 3x, every box read a region a third of the way into the image and reported
the colour of whatever was there. It produced four confident contrast failures
naming ratios as low as **1.32:1** — against chips whose computed colours are
byte-identical on the two engines, which is how the instrument was caught rather
than believed:

```
chromium  {"text":"Ground","color":"color(srgb 0.906667 0.810196 0.567059)", …}
webkit    {"text":"Ground","color":"color(srgb 0.906667 0.810196 0.567059)", …}
```

An instrument that reads the wrong pixels does not fail. It answers. Fixed by
scaling the boxes by `devicePixelRatio`; all 23 chip cases pass on WebKit.

---

## 2. The 11 WebKit failures, before and after

The brief said to land the harness with real failures visible and not to
quarantine them. That happened — the first honest run is `11 failed | 196
passed`. What it did not predict is that **seven of the eleven were defects in
this repository's own test instruments**, not in the app and not in WebKit.

| # | test | before | cause | after |
|---|---|---|---|---|
| 1-4 | `visual-chips` contrast, four variants | red | **instrument**: screenshot indexed in CSS pixels at 3x | **fixed**, green |
| 5 | `visual-motion` custom-property interpolation | red | **instrument**: sampled at two instants, landed before WebKit had started | **fixed**, green |
| 6-9 | `visual-v0/v1/v2/v3` heights to the pixel | red | `heights.json` is a Chromium *recording*; WebKit's text metrics give 944.36 against 944.5 | **narrowed**: within 1px on WebKit |
| 10 | `visual-v2` seed stamp clipboard | red | `clipboard-write` is not a permission WebKit has | **narrowed**: copy and `data-copied` still asserted on both |
| 11 | `visual-v3` throttled map scroll frame timing | red | measured through CDP, which WebKit has no equivalent of | **declined**, `skipOn` with the reason in the title |
| — | `visual-v3` parallax layers | *flaked* on the second run | **instrument**: fixed 150ms wait for a rAF-throttled transform, under full-suite load | **fixed**, waits for the condition |

**Final: `206 passed | 1 skipped`, 0 failed**, on the WebKit leg. The one skip is
row 11 and it carries its reason into the runner output.

The lesson worth keeping is the ratio. Adding a second engine found **one**
genuine engine difference that mattered (§4, WebKit starts an
attribute-triggered animation about a frame later than Chromium) and **seven**
places where this project's instruments were measuring something other than what
they claimed. That is the usual return on a second engine and it is worth
saying, because the brief expected the opposite distribution.

---

## 3. Bug A: the round trip, which was the bug for a different reason

The brief's mechanism is wrong in one detail and right in every way that
matters, so it is worth separating.

**What the brief said:** the parser only accepts `"750ms"`, so an engine
returning `0.75s` fails the parse and the function returns zero.

**What was there:**

```ts
const raw = getComputedStyle(root).getPropertyValue('--motion-outro').trim();
const ms = raw.endsWith('ms') ? Number.parseFloat(raw)
         : raw.endsWith('s')  ? Number.parseFloat(raw) * 1000 : NaN;
return Number.isFinite(ms) && ms > 0 ? ms : 0;
```

It already took both spellings. And measured on the engine in question,
`--motion-outro` resolves to exactly `"750ms"` on WebKit 26.6 — same as
Chromium — so the specific failure the brief describes does not occur here.

**The brief's instruction was still exactly right**, for the reason its own last
bullet gives rather than the one its first gives. The defect is not which
spellings the parser takes. It is `: 0`.

- The number being recovered had been written into that property by
  `ui/theme/motion.ts`, in the same process, out of `data/displayTuning.ts`. The
  round trip's *best* case was to return a number JavaScript already held.
- Its worst case was zero, and **zero is not a short hold, it is no hold** —
  byte-for-byte the swallowed-last-turn defect the outro exists to fix, restored
  silently, with no exception and no failing assertion.
- And that worst case was **reachable**, just not by the route the brief
  guessed: `@media (prefers-reduced-motion: reduce) { :root { --motion-outro: 0ms } }`
  fed the parser a zero on purpose. See §5.

So: `data/displayTuning.ts` is the source, `ui/theme/motion.ts` publishes the
token, CSS reads it, **nothing reads it back**.

### Every computed-style read, accounted for

The brief calls this a pattern bug and asks for a sweep. The sweep found exactly
one site in shipping code:

| site | what it read | disposition |
|---|---|---|
| `src/ui/scene.ts:315` | `--motion-outro`, to time the hold | **deleted** — the whole of the fix |
| `scripts/visual/contrast.mjs` | `color` of a text node | **safe, and must stay.** An instrument, does not ship, and reading rendered colour is its entire job |
| `scripts/visual/band-range.mjs` | `--accent`, `color`, `backgroundColor` | **safe**, same reason |
| `scripts/smoke.mjs:1027` | `gridTemplateColumns` | **safe**: an instrument, and a column count is not a timing |

`src/` now contains no `getComputedStyle` call at all.
`test/no-computed-timing.test.ts` asserts that structurally over the whole
directory — and asserts the *inverse* too, that `motion.ts` still explains the
round trip it no longer makes, so the rule cannot be satisfied by deleting the
account of why it exists.

### The conditional with the empty antecedent

The brief says: *if any parse of a style value must survive*, it takes both
spellings and never returns zero. **None survives in `src/`**, so that clause has
nothing to attach to. The guarantee it was asking for is provided instead by
`outroHoldMs`, which floors every path at `reducedMotionOutroMs`:

- no `matchMedia` → the *full* hold, not the short one — the safe direction is
  more of the last turn, not none of it
- a budget of `0`, `NaN`, `Infinity`, negative, or `0.0001` → the floor
- a battle speed that is not one of the three → the floor

`test/motion-hold.test.ts` is twelve cases asking that one question from every
direction. And the `if (ms <= 0) return Promise.resolve()` branch in `scene.ts`
is **gone** rather than made unreachable: an unreachable branch that restores a
bug is worse than no branch.

### The test that had written the bug down as correct

`test/battle-outro.test.ts` contained:

> `it('resolves at once when the duration token is zero')`

with a comment explaining that jsdom resolves no custom properties, so the hold
is zero, *and calling that the reduced-motion path*. It was true, it passed, and
it was Bug A — pinned as intended behaviour. Nothing in the suite could report
the defect because the defect was the fixture. Rewritten to assert the length,
on fake timers; the file goes from 21 cases to 23.

---

## 4. Bug B: named, with the evidence that ruled out the other four

**The brief states Bug B as fact** — "the CSS motion system has never run on
iOS", "the switch-out animation shipped broken at V5.5 and has never worked on
mobile" — and asks which of five causes it is, instructing: *do not change CSS
until a reproduction tells you which one it is.*

**There is no reproduction, so no CSS was changed for it.** Against Playwright
WebKit 26.6 on the iPhone descriptor, every animated class on the battle stage
starts and moves — the V5.5 switch-out included:

```
✓ moves for the lunge          ✓ moves for the recall
✓ moves for the hit            ✓ moves for the capture
✓ moves for the faint          ✓ moves for a prevented abnormality
✓ moves for the switch-out, broken since V5.5     ✓ … stage  ✓ … trait
✓ moves for the switch-in      ✓ … volatile       ✓ … field
✓ runs a beat to completion on its own clock, start and end
✓ interpolates the custom properties its keyframes are built out of
```

17/17 on both engines, by observed motion rather than by wiring.

### The five candidates, each ruled out by its own experiment

Ruled out by experiment rather than by the absence of a failure, because "the
tests pass" is not evidence about a cause.

**1. A custom property inside a keyframe.** *Ruled out, twice.* A seven-case
isolation page put each `calc()` shape through a keyframe and, as a control,
through a static declaration:

| form | Chromium (mid-flight) | WebKit (mid-flight) |
|---|---|---|
| `calc(var(--d) * var(--dir))` | `5.00025` | `5.2` |
| `calc(var(--d) * -1 * var(--dir))` | `-5.00025` | `-5.2` |
| `calc(var(--d) * -0.5 * var(--dir))` | `-2.50012` | `-2.6` |
| `translate(calc(…), calc(…))` two-arg | `5.00025, -2.50012` | `5.2, -2.6` |
| `var()` whose own value is a `calc()` | `2.50012` | `2.6` |
| parenthesised group | `-2.50012` | `-2.6` |
| literal `-3px` (control) | `-2.50012` | `-2.6` |

Every form interpolates, and the two engines agree to the sample interval. And
in the built app, `actor-lunge` — the most `var()`-dependent keyframe in the
file, reading `--lunge-distance` and `--beat-direction` — reaches **5.95px of
its 6px peak** on WebKit:

```
webkit  matrix(1,0,0,1,0,0) → 4.008 → 5.948 → 5.615 → 3.922 → 1.700 → 0.227 → none
```

**2. A `display` or layout type that is not animatable.** *Ruled out.*
`display: inline` and `display: table-cell` both animate on WebKit in the
isolation page. The actor is `display: block; position: absolute` regardless.

**3. A class added and removed inside one frame.** *Ruled out in the app, and the
code was already right.* `beats()` deletes both attributes, forces a reflow with
`void actors.me.root.offsetWidth`, then re-sets them, with a comment saying why:
"re-setting an attribute an element already carries does not replay a CSS
animation".

This is nonetheless where the **one genuine engine difference** lives: WebKit
begins an attribute-triggered animation roughly a frame later than Chromium. It
is a latency, not a failure — nothing in the app removes and re-adds inside a
frame — and the only thing it broke was this patch's own first instrument, twice
(§6).

**4. Compositing and layer promotion.** *Ruled out.* A box inside a
`backdrop-filter` parent — the exact shape of the stage, where the panels carry
the filter and the sprites animate beneath — starts and interpolates on WebKit
identically to one with no such parent.

**5. Shorthand or prefix parsing.** *Ruled out for the motion rules* — all twelve
keyframes start, so no motion declaration is being discarded — **and confirmed
for the one property item 4 is about.** `backdrop-filter` is the only unprefixed
modern property on the battle stage. See §7.

### What does reproduce the reported symptom, exactly

**Reduce Motion.** With `prefers-reduced-motion: reduce` emulated, on *both*
engines:

```
webkit  reducedMotion=no-preference  --motion-outro="750ms"
        animations started: ["world-cross","actor-lunge","sprite-recall","ball-catch","hp-chunk","figure-idle"]
webkit  reducedMotion=reduce         --motion-outro="0ms"
        animations started: []
```

Zero animations, and a hold of zero. That is "the animations do not render at
all" **and** "the last turn of every fight is missing", together, from one
operating-system setting.

It also fits the report's own shape better than an engine bug does. The reporter
saw it work in desktop Chrome and fail on an iPhone in *both* Safari and Chrome,
and read that as "same engine, one platform". The same evidence fits "same
*operating system*, one accessibility setting" at least as well: Reduce Motion is
a system toggle both iOS browsers honour, and one that neither desktop Chrome nor
this repo's test suite had ever had on.

**This is not a claim that the reporter had Reduce Motion on**, and it should not
be read as one. It is the only configuration found that reproduces the reported
symptom on the engine in question, and the fix for it was already item 5 of this
same brief.

### What is honestly out of reach here

Stated rather than glossed, because a future session will otherwise read "ruled
out" as stronger than it is. **Playwright's WebKit on Linux is not iOS Safari.**
It is the same engine and a different graphics stack, and three things a real
device has are not modelled at all:

- **the iOS compositor**, where layer promotion and memory pressure behave
  differently from the Linux port;
- **Low Power Mode**, which throttles and can suspend CSS animation outright and
  has no emulation in Playwright;
- **any Safari older than the bundled 26.6** — and an iPhone 14 Pro Max may well
  be on iOS 16 or 17, which is precisely why §7 is fixed on documented support
  history rather than on a measurement.

If the defect survives this patch on a real device, those three are where to look
next, and none of them is diagnosable from this harness.

---

## 5. Item 5: reduced motion keeps the outcome

The hold no longer goes to zero. It shortens to `reducedMotionOutroMs`, a new
number in `data/displayTuning.ts` — **not** `tuning.ts`, which the brief names,
because `tuning.ts` is inside the `contentHash` glob and the same brief forbids
moving the hash twice over. generation.md §27 deviation 2 records it.

**120ms: about seven frames at 60Hz.** It has one job — guarantee the final turn
is *painted* before the screen changes — so it is a frame count, not a feel, and
it is deliberately not derived from `battleFeedbackMs`. Scaling it with a budget
the player set for animation they have switched off would be deriving an answer
from an unrelated question. The hold proper is still `battleFeedbackMs`, so "a
playtester saying battles feel slow stays a one-number change" holds as asked.

```
webkit  reducedMotion=reduce  --motion-outro="120ms"
        animations started: []          ← the movement is still gone
```

### Specificity, asserted rather than eyeballed

The brief asks to verify the reduced-motion rule wins on specificity rather than
source order, and notes one rule in this lineage that worked by source order
alone. **There were three**, and this patch deleted the third:

1. **The HP chunk.** `@media … { .hp__shadow { animation: none } }` did not
   override `.hp__shadow[data-fading]`. The chunk went on fading for everyone
   who had asked it not to.
2. **The species swap.** A bare `.sprite` lost to
   `.stage__actor[data-swapped='true'] .sprite:not(.sprite--ghost)` — `:not()`
   carries its argument's specificity. Latent until Stage 4.9's seed put a
   send-in on the measured turn.
3. **The outro token.** `:root { --motion-outro: 0ms }` did not *lose* — it won,
   by coming later in the bundle than `tokens.css`, which is source order and
   not specificity. A bundler that ordered the two files the other way would
   have silently changed behaviour. **Deleted**; `ui/theme/motion.ts` owns the
   number now.

Three failures is a pattern, and a convention that has failed three times is not
a convention. `test/reduced-motion-specificity.test.ts` parses the stylesheet and
asserts that every rule starting an animation has a cancel **naming that same
selector** — which settles specificity by construction, since equal selectors
cannot lose to each other.

Two things that test had to learn, both of which produced a green board first:

- **"Any cancel specific enough" is not the question.** The first draft asked
  whether *some* cancel in the block outranked each animated rule. The block is
  full of specific cancels, so replacing the swap's three selectors with a bare
  `.sprite` still passed. Specificity only decides a contest between two rules
  matching the same element.
- **`display: none` is a stronger cancel and had to be taught.** The ambient
  world drift is removed from the layout rather than animation-cancelled, so 17
  perfectly safe rules read as the largest hole in the stylesheet.

Verified by reintroducing each of the three historical bugs in turn and
confirming the suite goes red for each. It does.

---

## 6. The rule this patch paid for three more times

Section 23 recorded it once. This patch's own observed-motion helper got it
wrong three times in one afternoon, and each wrong version produced a
*confident* answer about WebKit:

1. **A fixed 220ms window.** Four of the twelve beats carry an
   `animation-delay` — the hit's second slot starts at `--motion-beat * 3`,
   562ms at the shipped budget. It was asking whether an animation had started
   before it was due to, and called the hit dead on WebKit on a 200ms event
   against a 220ms deadline. A coin toss, not a finding.
2. **The window read off the element, sampled at two instants.** WebKit starts
   about a frame later, so a sample near the start of a 187ms window lands
   before the engine has begun and reads the 0% keyframe. It called the lunge
   dead while the lunge was reaching 5.95px of its 6px peak.
3. **A dense poll across the window.** Right in principle, still racy: under the
   full 26-file suite the polling loop starves and a 187ms window can pass with
   one sample in it.

**The form that works does not race.** It asks the element for its `Animation`
objects, **pauses and seeks** them across the active window, and reads the
computed style at each point — the same interpolated values the engine would
paint, with no dependence on scheduling. Paired with one
`animationstart`/`animationend` assertion, which is the half that says the engine
really *runs* what it created.

Two traps alongside it, both of which turn a broken animation into a passing
test:

- **`transform: none` and `matrix(1, 0, 0, 1, 0, 0)` are the same rendering and
  different strings.** Comparing the strings counts the switch from rest to the
  0% keyframe as motion. This is what a keyframe whose `var()` failed to resolve
  looks like — the animation runs, the element does not move — so it is exactly
  the case the test exists for, passing.
- **`getAnimations()` returning a name proves the cascade applied**, not that
  anything moved.

`visual-v3`'s parallax case had the same disease and is fixed the same way: it
waited a fixed 150ms for a `requestAnimationFrame`-throttled transform and failed
only under full-suite load. It waits for the condition now.

---

## 7. Item 4: `backdrop-filter`

```css
-webkit-backdrop-filter: blur(var(--panel-blur));
backdrop-filter: blur(var(--panel-blur));
```

Prefixed first so an engine understanding both takes the standard one — the
cascade's rule, not a preference expressed here.

**Why it matters more here than anywhere else in the app:** `--panel-scrim` is
translucent by design (V5.3's "a scrim, not a card"), and what is behind it is
two sprites that move. A dropped backdrop is not a cosmetic difference, it is HP
numbers read against a lunging Pokemon.

**Measured support**, which is also the only place candidate 5 was confirmed:

| | `backdrop-filter` | `-webkit-backdrop-filter` |
|---|---|---|
| Chromium 141 | ✓ | ✗ |
| WebKit 26.6 | ✓ | ✓ |

Safari carried the feature behind the prefix until **Safari 18**, so the
unprefixed-only form is dropped on iOS 16 and 17 — which an iPhone 14 Pro Max may
well be running. That part is the documented support history, **not** a
measurement taken here: the bundled WebKit is 26.6 and has both, so this harness
cannot see the failure. Labelled rather than implied.

**And the no-filter path**, which the brief asked about separately:

```css
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .stage .panel { background: var(--panel-scrim-solid); }
}
```

`--panel-scrim-solid` is `--bg` — the same scrim at full opacity, so the panel
stays the panel rather than becoming a card again. V5.3 removed the card and
none of it comes back. `@supports` rather than a JavaScript feature test, so it
answers itself on the engine and a page that never runs `ui/` still renders a
legible panel. `test/visual-motion.test.ts` asserts the panel's background is
never `transparent` on either engine.

**Did the prefix change Bug B's symptoms?** No — asked directly, because the
brief says a change here would reorder the diagnosis. Candidate 4 was tested
with a `backdrop-filter` parent present and the child animated identically on
both engines; and all twelve classes were green on WebKit both before and after
the prefix landed. The two are independent.

---

## 8. Gates

| gate | result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint .` | clean |
| `npm run content-hash` | **`c3964b`, unmoved** — verified by `git stash`, hashing, unstashing, hashing again |
| `RUN_LOG_VERSION` / `RANDOMIZER_VERSION` / `AI_VERSION` | all still |
| browser suite, Chromium | green |
| browser suite, **WebKit** | `206 passed, 1 skipped, 0 failed` |
| `npm run build` | green |
| `npm run smoke` (SMOKE24, 390x844) | passed — move grid ends at y=688, no horizontal overflow at 390px |
| `npm run test:trim-strict` | green on a clean run; see the contention note below |
| seeded output | `test/fixtures/sim-report.json` unchanged on disk, `test/sim-fixture.test.ts` and `test/visual-baseline.test.ts` (six recorded runs, byte-for-byte) both green |

Full run, Chromium leg: **1772 tests, 134 files, green**. WebKit leg: **26
files, 207 passed, 1 skipped, 0 failed** — the skip is the CDP frame timing and
it carries its reason in its title.

### One contention flake, named rather than absorbed

Section 26 records that the visual harness is fragile under load: it runs
concurrent vite builds and browsers, and a screen can be measured before it has
settled. **This patch adds a 23rd browser file and a second engine**, so it
raises that pressure again, and it saw the symptom once:
`test/visual-v0.test.ts`'s "one accent" case reported `battle has no primary
action` on one full `test:trim-strict` run and passed on the same commit run on
its own, and on the re-run.

It is named here rather than quietly re-run away, because the failure mode is
precisely the one that sends a future session hunting a layout bug that is not
there. It is also not this patch's to fix: the real answer is a concurrency cap
on the visual suite, which is a change to shared config. Three of the eleven
WebKit failures in §2 were this same class, and those *were* this patch's,
because the tests in question were making timing assumptions of their own — so
the ones that could be fixed here have been.

`contentHash` could not have moved: the only `src/data/` file touched is
`displayTuning.ts`, which is on the exclusion list and is there for exactly this.

### What did not change

No `core/` file. No `data/` table that enters the hash. No new animation, no new
flag kind, no new class — the twelve this patch asserts motion for are the twelve
that already existed. `core/battle/ai.ts` untouched. Stage 4.9's balance
regression at 0.46 mean gyms cleared is untouched and is still a table problem.

### Still open, and honestly so

**The definition of done is "on a real iPhone", and this patch cannot reach
one.** What it can say is that on the engine that iPhone runs, at the density
and with the input model that iPhone has, all twelve beats move, the last turn
paints, the hold is never zero, the panels are legible, and a player with Reduce
Motion on sees the outcome of every turn. What it cannot say is anything about
the iOS compositor, Low Power Mode, or Safari 16 and 17. If the report survives
this patch, §4's closing list is where to look, and the harness this patch
added is what makes the next attempt cheaper than this one was.
