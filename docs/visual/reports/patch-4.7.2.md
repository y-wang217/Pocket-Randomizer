# Patch 4.7.2 — font, stat bars, verbosity, move explanations

The running report. Prompt:
[`../../spec/gymrun-patch-4.7.2-font-stats-verbosity.md`](../../spec/gymrun-patch-4.7.2-font-stats-verbosity.md),
which carries the brief and the rulings on this report's first section, both
verbatim.

Branch `claude/cool-dijkstra-apme8u`, off `main` at `76b9550`.

One section per stop-for-review point, in the order the rulings set.

---

## 0. The pre-code report

The four questions the brief asked before any code.

### 0.1 The verbosity flag

**It exists and is complete.** `src/ui/settings.ts` — `Verbosity = 'simple' |
'detailed'`, persisted at `localStorage['gymrun.settings']`, `DEFAULT_SETTINGS =
{ verbosity: 'detailed' }`, guarded load and save, a module-level holder, and
`onSettingsChange` for live redraw. That is the Stage 4.5.1 Part 5 definition,
already built.

**Call sites that read the flag**, excluding the toggle control at
`app.ts:705-726`:

| site | reads | what it does |
|---|---|---|
| `src/ui/member-card.ts:155` | `showsNumbers()` | swaps `.stat__value` and `.stat__bar` by `hidden` |
| `src/ui/screens/threats.ts:114` | `showsNumbers()` | Detailed appends `hits 3 of 4, unanswered` per type |

Two. `gallery.ts:47` and `app.ts:64` call `initSettings()`, which is bootstrap
rather than a read.

Two findings beyond the question:

- **The re-render subscription reaches two screens.** `app.ts:568` re-renders
  the map and the party screen on change. The drawer, pre-gym, reward, summary
  and battle screens do not resubscribe, so a card already on screen keeps the
  mode it was drawn in. Ruling 4 puts this in scope.
- **The flag has no effect on the battle panel.** V5.3 deleted the six-row stat
  block from the panel (`scene.ts:490-513`; the retirement note is at
  `styles.css:2118`). Nothing the panel renders branches on verbosity.

### 0.2 The party screen stat bars

Rendered by **`statBlock` in `src/ui/member-card.ts:152-180`**
(`.stats.stats--party`), reached from three surfaces: the drawer, the party
screen and pre-gym.

Measured in the pinned Chromium at 390x844, on the real party screen, `SMOKE24`:

```
as loaded (Detailed):  valueText "94"  valueHidden false   barHidden true
after toggle (Simple): valueText "94"  valueHidden true    barHidden false
                       barBox 97.8x6   barBg  #090c13 (--bg-sunken)
                       fillInlineWidth "47%"   fillDisplay "inline"
                       fillBox 0x0     fillBg #78756e (--text-faint)
```

- **Values are passed.** `{ ...spec.baseStatsAtLevel, hp: member.maxHp }` yields
  all six — `baseStatsAtLevel` carries the five boostables and `maxHp` supplies
  HP — and every `STAT_ORDER` key resolves.
- **Fill width is computed.** `style="width: 47%"` and so on, against
  `STAT_BAR_CEILING = 200`. The arithmetic is right.
- **The component does branch on the flag**: `bar.hidden = detailed`,
  `value.hidden = !detailed`.

**None of the brief's three candidate causes is it.** The cause is a fourth:

> `.stat__bar-fill` is created as `el('span', …)` and `styles.css:622` never
> gives it a `display`. Width and height do not apply to a non-replaced
> **inline** box, so the fill computes to `0x0` and is never painted. The
> colour is correct and legible — `--text-faint` on `--bg-sunken` is about
> 4.9:1 — there is simply no box to paint it in.

That is why the row reads as a flat dark line: what is visible is the
`.stat__bar` track, 97.8x6 in `--bg-sunken`, with nothing inside it.
`.hp__fill` escapes the identical bug only because it is an `el('div', …)`.

The "no numbers" half is not a bug. It is Simple mode doing what it was
specified to do; the screen was in Simple. In Detailed the numbers render and
the bar is hidden instead. **In neither mode do both appear** — ruling 3
changes that.

Two conflicts with the brief were raised here and both were ruled on:

- "Use the same stat component the battle panel uses" — there is no such
  component, V5.3 deleted it. **Ruling 1: the brief was wrong;
  `member-card.statBlock` is the shared component, fix it in place.**
- Test 2 asked the flag to change the battle panel. Hiding the exact HP digits
  in Simple was proposed and **rejected by ruling 2**: exact HP is the most
  decision-relevant number on the screen. The battle panel does not branch on
  verbosity in this patch.

### 0.3 Font declarations

| where | count | value |
|---|---|---|
| `src/ui/styles.css` | 37 | `var(--font-body)` |
| `src/ui/styles.css` | 12 | `var(--font-display)` |
| `src/ui/styles.css` | 9 | `font: inherit` |
| `src/ui/theme/tokens.css` | 2 | `'Pixelify Sans'` — the two `@font-face` blocks |
| `src/ui/**/*.ts` | 0 | — |

**Every declaration already resolves through a named token. Nothing is inline,
in CSS or in TS.** `test/visual-tokens.test.ts:76-86` enforces it —
`font-family` must match `^var\(--font-[a-z-]+\)$` and `font` must be `inherit`
— and `:181` bans `fontFamily` assignment from any `.ts` under `src/ui/`.

So the V0 token already does what the brief asks for and gets extended rather
than replaced. `tokens.css:41-44` already names the swap as the pending morning
decision.

**Bundle cost: zero added.** Pixelify Sans is already self-hosted under
`public/fonts/` — 7,692 B regular plus 7,904 B bold, 15,596 B of latin-subset
woff2 — and already loading, because `--font-display` uses it. The swap adds no
request and no bytes. `--font-numeral` does not exist yet and is added by step 1.

### 0.4 Move data

**Confirmed reachable, and `describeMove` already exists.**
`src/core/battle/driver.ts:307`, pure, no RNG, no DOM, returning
`MoveExplanation` (`core/types.ts:371-415`) — the Release B field set, pulled
forward at Stage 4.7 Part 6. Verified with `GYMRUN_TRIM_STRICT=1`, which
replaces the trimmed tables with throwing proxies, over this sweep:

```
Swift            accuracy: true (never-misses)   band 2
Quick Attack     priority: 1                     band 1
Feint            priority: 2   bypassesProtect: true
Swords Dance     boosts [{atk,+2,self}]          band null
Flamethrower     secondary {chance:10,status:brn}
Icicle Spear     multiHit [2,5]   basePower 25   band 3
Population Bomb  multiHit [10,10] basePower 20   band 4
Double-Edge      recoil 0.33      Giga Drain drain 0.5
Solar Beam       chargeTurns 1    Hyper Beam rechargeTurns 1
flags: contact / sound / protect / slicing / heal …
shortDesc present on every one
```

Accuracy, priority, flags, secondary chance, boosts and `shortDesc` all survive
the trim with **no generated table**. The 4.7 finding holds. The never-misses
marker is the sim's own `accuracy: true` rather than a number, and `band`
already comes from `bandOfMove` — Population Bomb is the disagreement case, 20
base power at band 4.

**Not yet wired.** `moveCardData` (`ui/move-detail.ts:74`) already carries
`explanation` through to callers and nothing reads it. Wiring tap-to-expand into
`scene.moveCard` reaches **six surfaces**: the party screen, the party drawer
and pre-gym lead select (all three through `member-card.moveList`), the
move-replace incoming card, the move reward card, and the run summary.

Battle move buttons go through `moveFacts`, not `moveCard`, so they are
structurally out of reach — which is how "never submits a move" is satisfied by
construction rather than by care. The four *current* moves on move-replace are
also `moveFacts`. Both facts are recorded as open items 9 and 10 in
[`../../README.md`](../../README.md) and are not built here.

### 0.5 The floors, measured before the work

Both floors the brief asks for fail on `main` today.

**Below 11px:** `.type`, `.band`, `.badge--category` and `.badge--tag` at
`--fs-xs` (10px); `.tier` at `--fs-2xs` (9px); `.badge--tag` again at 9px under
`@media (max-width: 420px)`. Only `.badge` and `.badge--effect` (11px) and the
gate chips (`--fs-gate`, 12.48px) clear it.

**Chip text contrast** against its own fill, computed from the `--chip-*` mix
over `--bg-raised`, five of nineteen under 4.5:1:

| chip | ratio on `--bg-raised` |
|---|---|
| dragon | 4.07 |
| dark | 4.15 |
| fighting | 4.20 |
| ghost | 4.34 |
| poison | 4.35 |

Ruling 5 accepts the baseline churn and requires `decisionTop` and
`decisionBottom` before and after. Ruling 6 lifts `--chip-text` once, globally.

---

## 1. Font tokens

**Three tokens, all Pixelify Sans, one line each to swap.** `tokens.css`:

```css
--font-mono-stack: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
--font-display: 'Pixelify Sans', var(--font-mono-stack);
--font-body:    var(--font-display);   /* was var(--font-mono-stack) */
--font-numeral: var(--font-display);   /* new */
```

Nothing inline, in CSS or in TS — that was already true and stays true.
`test/visual-tokens.test.ts` gains **test 8**: it resolves every `--font-*`
token a rule actually uses through to a terminal family list and asserts they
all name the same first family. The fallback stack is deliberately not counted
as a second face; what the test forbids is two *chosen* faces.

Confirmed applied rather than assumed — the computed `font-family` on `body` in
the built app is `"Pixelify Sans", ui-monospace, …` and `document.fonts` reports
both weights `loaded`.

### 1.1 Tabular figures: the face has none

Measured on the real element at 100px, advance width per digit:

```
normal      0:58.61  1:40.41  2:58.61  3:58.61  4:58.61
            5:58.61  6:58.61  7:58.61  8:58.61  9:58.61   spread 18.20
tabular-nums  … identical, every digit …                  spread 18.20
```

**`font-variant-numeric: tabular-nums` measures identically to not asking for
it, so there is no `tnum` feature in the face.** The answer to the ruling's
question is no.

The useful half of that measurement is the shape of the miss: **every digit is
the same advance except `1`, which is 31% narrower.** The face is accidentally
tabular in nine glyphs out of ten, so the reflow is not the general wobble a
proportional face usually causes — it is one glyph.

There is one now-inert `font-variant-numeric: tabular-nums` in the stylesheet,
on `.stat__value`. It is **kept, with its comment rewritten to say it is inert**
rather than deleted: it costs nothing and becomes correct the moment
`--font-numeral` points at a face that has the feature, which is what that token
is for. The old comment claimed tabular figures were what stopped the panel
reflowing, and that claim is now false — leaving it would have been the more
expensive choice.

### 1.2 Counter jitter at 390x844

Every counter that rewrites in place now reads `--font-numeral`: the battle
panel's HP text, a move's PP, the six stat numbers, the pick-screen stat row,
the shop wallet, and the contribution counts. `.move__pp` was split out of the
rule it shared with `.move__category` and `.move__power` — those two are facts
about a move and never change; PP is the one of the three that counts down.

**Measured in a real fight**, `SMOKE24` at 390x844:

| counter | drift across turns |
|---|---|
| `.panel__hp-text`, player | **4.84px**, left edge pinned, right edge moves |
| `.panel__hp-text`, foe | **4.84px**, same |
| `.move__pp` | **0** |

**PP does not jitter at all**, and not by luck: `.move__pp` is a block filling a
fixed 150px button, so the text reflows inside a box the layout has already
committed to. Its intrinsic width does vary (38.25px for `PP 1/40` to 46.7px for
`PP 40/40`) and none of that reaches the layout.

**HP jitters, and the worst case is bigger than the observed one.** Measured on
an element carrying the real class at its real 12px:

| string | width |
|---|---|
| `888 / 888 · 100%` | 90.13 |
| `111 / 111 · 100%` | 77.03 |
| `94 / 94 · 100%` | 76.06 |
| `11 / 94 · 12%` | 64.67 |
| `1 / 94 · 1%` | 52.78 |

**13.1px between two strings of identical digit count** — all-1s against all-8s
— which is the `1` glyph and nothing else.

**What that actually moves.** The HP text's left edge is pinned, so the digits
do not slide under the reader; what moves is the right edge, and `.panel__meta`
is a flex row with the status chip next in it. So a status chip can shift up to
13px as HP changes. **Not reserved, deliberately**: that row already moves far
more than 13px whenever a status chip appears or clears at all, so reserving
width there would buy nothing and would cost about 25px of a 390px phone to
hold three-digit space for a two-digit Pokemon.

**Reserved where the layout genuinely depends on it**, which is `.stat__value`:
`min-width: 3ch; text-align: right`. From step 4 the bar sits *beside* the
number rather than instead of it, and six bars whose left edges moved with the
digit count in front of them would defeat the only thing six bars are for. `3ch`
is three `0`-advances, the widest a stat number gets, and in `ch` so it tracks
the face instead of needing a new number next time.

### 1.3 Bundle delta

| | before | after | delta |
|---|---|---|---|
| JS | 3,594,559 B | 3,594,559 B | **0** |
| CSS | 57,104 B | 57,287 B | **+183 B** (gzip 10.05 → 10.09 kB, +40 B) |
| fonts | 15,596 B | 15,596 B | **0** |

**Zero, as expected, on everything but the comments.** Pixelify Sans was already
self-hosted and already loading because `--font-display` used it; the swap adds
no request and no bytes. The +183 B of CSS is the new token, the six
`--font-numeral` rules, the split PP rule and their comments.

### 1.4 The guarded screens moved, upward

Reported here because the font swap moves pixels whether or not the ruling
attached that requirement to step 2.

| | before | after | delta |
|---|---|---|---|
| `map.screenHeight` | 976.69 | 947 | −29.69 |
| `map.scrollHeight` | 1170 | 1140 | −30 |
| `map.decisionTop` | 614.5 | 614.5 | **0** |
| `map.decisionBottom` | 728.22 | 698.53 | **−29.69** |
| `battle.screenHeight` | 587 | 587 | **0** |
| `battle.scrollHeight` | 844 | 844 | **0** |
| `battle.decisionTop` | 472 | 472 | **0** |
| `battle.decisionBottom` | 700 | 700 | **0** |

**The battle screen did not move on any field.** The map got shorter, every
number moved *up*, and `decisionTop` is unmoved on both. The stop condition —
the decision point dropping below the fold — is not met and is not close: the
map's last offered card cleared the 740 line by 11.78px before and clears it by
41.47px now. `../baseline/heights.json` re-recorded, and the whole thing written up as a
dated deviation at [`../../generation.md`](../../generation.md) section 12e,
because a reader diffing it against V5's report needs to know which patch moved
the map.

### 1.5 Suite

`test/visual-v0.test.ts` (both budget assertions), `test/visual-v2.test.ts`,
`test/visual-v3.test.ts`, `test/visual-baseline.test.ts` and
`test/visual-tokens.test.ts` all pass, including the byte-identical baseline
re-recording check.

---

## 2. The chip legibility floor

### 2.1 The two numbers

`data/tuning.ts`, beside `maxMoveTagsOnFace` and `battleFeedbackMs`, the two
display numbers already living there:

```ts
minChipFontSizePx: 11,
minChipContrastRatio: 4.5,
```

4.5 is WCAG AA for normal-size text, which is what a chip is — the large-text
relaxation to 3:1 starts at 18px and nothing is close.

### 2.2 What was under the size floor, and what it cost

| rule | was | now |
|---|---|---|
| `.type` | `--fs-xs` 10px | `--fs-sm` 11px |
| `.band` | `--fs-xs` 10px | `--fs-sm` 11px |
| `.badge--category` | `--fs-xs` 10px | inherits `.badge`, 11px |
| `.badge--tag` | `--fs-xs` 10px | inherits `.badge`, 11px |
| `.tier` | `--fs-2xs` 9px | `--fs-sm` 11px |
| `.rail__gym .type` | `--fs-2xs` 9px | inherits `.type`, 11px |
| `.log-entry__priority` | `--fs-2xs` 9px | inherits `.badge`, 11px |
| `.badge--tag` under 420px | `--fs-2xs` 9px | **rule deleted** |

The 420px rule is deleted rather than raised, per ruling 5. It made text smaller
on the device every visual stage is measured at.

**Two chip surfaces the pre-code report missed**, both found by the sweep:

- **`.rail__gym .type`** overrode the type chip down to 9px for the gym rail's
  sake. The rail is not a reason to print a chip the player cannot read.
- **`.log-entry__priority`**, the battle log's `FIRST` marker, was **a chip
  built by hand** — V2's entire recipe (`--chip`, the fill, the text mix, the
  inset outline) copied into a stylesheet rule, on an `el('span', …)` that never
  went near `ui/chip.ts`. It survived V2's "one chip component" rule because
  `test/chip.test.ts` scans for chips assembled in *TypeScript* and this one was
  assembled in CSS. It now goes through `neutralChip` with its legacy class as
  `extra`, so every selector and every layout-only rule still resolves and the
  duplicate recipe is gone.

### 2.3 Contrast: `--chip-text` 70% → 60%, once

Worst case per hue, label against its own fill over `--bg-raised`:

| hue | at 70% | at 60% |
|---|---|---|
| dragon | **4.07** | **4.81** |
| dark | 4.15 | 4.89 |
| fighting | 4.20 | 4.94 |
| ghost | 4.34 | 5.09 |
| poison | 4.35 | 5.10 |

Five of nineteen were under the floor; all nineteen clear it now, worst at 4.81.

**Confirmed, as ruling 6 asks: the desaturation lands on the label and not the
fill.** `--chip-text` is read by exactly one declaration, the `color` in `.chip`.
The fill is `--chip-fill`, untouched at 16%, and the outline is `--chip-line`,
untouched at 55%. A Dragon chip's *background* is the same colour it was; its
*text* moved 10% further toward the cream. Lifted once rather than per hue
because five hand-tuned values would be five to re-derive the first time a chip,
a surface or a base colour moved, and the sixth hue to fall under the line would
be the one nobody re-checked.

### 2.4 The sweep

`test/visual-chips.test.ts`, 23 assertions, all passing. Both floors read off
`DEFAULT_TUNING`, asserted **per variant** — eleven variants × two floors, plus
one assertion that the set of variants actually seen equals the set `ui/chip.ts`
can build, so a run that stops reaching one fails rather than passing quietly.

Contrast is measured **off rendered pixels**, not computed properties: a chip's
fill is `color-mix(… transparent)` over whatever it sits on, which on the map is
a gradient with a locale glow and a watermark through it. `ratio` is imported
from `scripts/visual/contrast.mjs` rather than reimplemented.

Two things the sweep had to learn, both worth recording because both were wrong
in the obvious first version:

- **One screenshot per screen, not per chip.** A chip-at-a-time sweep did not
  finish in fifteen minutes. A full-page shot plus N box reads off one
  `ImageData` does the same work in seconds.
- **First visit is not enough.** Sampling only each screen's first render
  collected eight variants of eleven and reported `stage`, `flag` and the gate
  chips as never rendered — a stat stage needs a turn that moved a stat, a flag
  word needs a turn that resolved into one, and the gate chips need a gated node.
  None exists on the frame a screen first opens. The trigger is now "this screen
  is showing a variant I have not measured", and it stops once all eleven are in.

### 2.5 A pre-existing bot defect this uncovered

The `visual-v0` failure reported at step 1 as a suspected flake **was not a
flake**, and it cost two full-suite runs to say so properly.

`stepOnce` clicks a card's geometric centre. On the item-target screen that
centre is a member card's archetype chip; on the move-replace screen it is a
move card's type or category badge. **A chip is a tooltip trigger, and
`ui/tooltips.ts` calls `stopPropagation` on a trigger click by design** — so
tapping a chip explains the chip instead of choosing the option it sits on. For
a bot aiming at centres, that means the click opens a panel and selects nothing,
forever. A traced run sat on `replace` from step 20 to step 600 opening and
closing the same tooltip.

**It reproduces against `main`'s stylesheet, so it predates this patch.** Fixed
in the shared bot, two ways, both in `scripts/visual/browser.mjs`:

- `dismissTooltip` presses Escape before each step. Playwright hit-tests before
  dispatching and *refuses* to click through the panel, so the tap that would
  have dismissed it never happens — where a real player's next tap dismisses it.
- The `target` and `replace` cases now click the card's **name line**, the one
  part of either card guaranteed present, non-empty and never a trigger. The
  click bubbles to the button exactly as a tap on it would.

The walk went from a 15-minute timeout to **13.6s**, and now reaches eleven
screens instead of eight: `event`, `pre-gym` and `shop` were being visited by no
visual test at all.

### 2.6 The guarded screens

| | main | after §12e | now | vs main |
|---|---|---|---|---|
| `battle.decisionTop` | 472 | 472 | **472** | **0** |
| `battle.decisionBottom` | 700 | 700 | **712** | **+12** |
| `battle.screenHeight` | 587 | 587 | 599 | +12 |
| `map.decisionTop` | 614.5 | 614.5 | 616.5 | +2 |
| `map.decisionBottom` | 728.22 | 698.53 | 701.53 | **−26.69** |

**The stop condition is not met.** The fourth move button ends at 712 against
the 740 line, clearing it by 28px; the map's last card ends at 701.53, clearing
it by 38px. `battle.decisionTop` is unmoved. The +12 is three chip rows on a
move button going from 10px to 11px — bought, not lost. Recorded as a dated
deviation at [`../../generation.md`](../../generation.md) section 12f.

### 2.7 The digest moved and nothing else did

The two floors are `Tuning` fields, so they are under `src/data/` and the
baseline's digest is a glob over it. Of the **eight** files in
`visual/baseline/`, exactly one changed:

```
data-digest.txt  1bfa3d97…a82356  →  e07a4528…7c1a6
```

Every recorded run, every casualty list and the recorded battle protocol for
`GYMRUN01` are byte identical. Two players on one seed holding different copies
of `tuning.ts` play the identical run.

This is the third instance of what `generation.md` §9 calls "the awkward case",
after `flagWords.ts` and `battleFeedbackMs`, and it behaved exactly as Release C
recorded. **The per-field split of `tuning.ts` remains the `contentHash`
release's decision and is deliberately not pre-empted here.**

---

## 3. The stat bars, and the guard for the class of bug

### 3.1 The fix

One declaration:

```css
.stat__bar-fill {
  display: block;          /* ← this */
  height: 100%;
  ...
}
```

**On the rule and not on the tag**, deliberately. The alternative was changing
`el('span', …)` to `el('div', …)` in `member-card.ts`, which would have worked
and would have left the rule still asking for a width it could not guarantee
means anything. The rule is the thing that asks, so the rule is the thing that
has to make the ask valid — and a component that later swaps the element cannot
reintroduce the bug.

### 3.2 Verified red first

Both new tests were run against the tree with `display: block` removed, and both
fail in the terms the bug actually presented:

```
× paints a fill with non-zero width and height on every row with a non-zero stat
× paints each bar at the share the component asked for
× never leaves an element with an inline width or height as an inline box
    + "party   span.stat__bar-fill { width: 54.5% } is display: inline"
    + "party   span.stat__bar-fill { width: 44.5% } is display: inline"   … ×6
    + "pre-gym span.stat__bar-fill { width: 54.5% } is display: inline"   … ×6
```

Two things worth reading off that output. The guard names the **element, the
declared width and the screen**, so the failure tells you what to fix rather
than that something is wrong. And it found the bug on **two** surfaces — the
party screen *and* pre-gym — where the report had only named the party drawer.

With the declaration restored, all seven pass.

### 3.3 Three tests, three different questions

Split rather than merged, because each would let the others' failures through:

| test | environment | asks |
|---|---|---|
| `party-stats.test.ts` | jsdom | are the six numbers **this member's**, checked against `describeSpecCard` |
| `visual-stat-bars.test.ts` | Chromium | is the fill **painted**, and at the share the component asked for |
| `visual-inline-box.test.ts` | Chromium | is **anything** given an inline width left as an inline box |

- A browser test alone would compare on-screen text against on-screen text and
  never touch `describeSpecCard`, so a card populated from the wrong member
  would satisfy it perfectly. Hence the jsdom half, with an Alakazam at level 42
  whose six stats are all different — a row read off the wrong key fails rather
  than coinciding.
- A jsdom test alone is exactly what the broken build would have passed.
- **The guard is the one that matters for next time.** "The stat bar paints" is
  a fact about one component; "a width that is set must be a width that can
  paint" is the property the bug was an instance of, and it is checked over
  every `[style]` element on every screen the run reaches. Replaced elements —
  `img`, `svg`, `canvas`, `input` and the rest — are listed as the exception the
  spec itself carves out, rather than left to trip a rule they do not violate.

### 3.4 Pixels

`node scripts/visual/measure.mjs --compare` reports **guarded screen heights
equal to the baseline to the pixel.** Giving a zero-sized box its real size
changes no layout: the fill sits inside a track that already had its own height
and width, and painting into it displaces nothing.

**What is still swapped rather than shown together is Detailed.** At this step
`bar.hidden = detailed` still holds, so the browser test measures Simple — the
only mode with a bar on screen — and says so in its header. Ruling 3 is step 4.

---

## 4. Verbosity

### 4.1 Ruling 3: Detailed shows both

`statBlock` no longer asks what mode it is in. It renders the label, the number
and the bar on every row, in every mode, and `[data-verbosity]` decides what is
shown. The `hidden` swap that made the two mutually exclusive is gone.

```css
:root[data-verbosity="simple"] .stat__value  { display: none; }
:root[data-verbosity="simple"] .threats__count { display: none; }
```

**Detailed appears in no rule**, deliberately: it is the mode that shows
everything, so it is the absence of a rule rather than a selector to keep in
sync with one.

### 4.2 Ruling 4: one subscription, and why it is an attribute

The ruling asks for "one subscription that re-renders the active screen" and
forbids "per-screen subscriptions a future screen can forget". **In this shell
those pull against each other**, and the conflict is worth stating rather than
picking a side of quietly.

Screens are mounted once and toggled (`screens/router.ts`); each is drawn by a
`<screen>.render(...)` call whose arguments are captured at the point it is
shown — `resultScreen.render(review, offer, state, cb)`, and so on for eleven
screens. A shell-level redraw has nothing to re-invoke unless every screen hands
it a thunk. **That is a per-screen registration, and a future screen can forget
it exactly as the ruling says.**

So the mode is an attribute on `<html>`, written by one subscription in
`mountApp`:

```ts
applyVerbosity(initSettings().verbosity);
onSettingsChange((settings) => applyVerbosity(settings.verbosity));
```

That is the same shape as `theme/locale.ts`, which has projected the locale onto
`<html>` for the stylesheet since V1 — an existing seam, not a new mechanism.

What it buys over a redraw:

- **Nothing registers, so nothing can forget.** A screen written next year is
  correct because the attribute is on an ancestor of everything: the router's
  screens, the drawer, the tooltip layer.
- **It reaches surfaces that are already open**, without rebuilding them — so a
  drawer keeps its scroll position and a stat bar keeps its 120ms transition
  instead of restarting it.
- **Fewer readers, not more.** It replaces two `showsNumbers()` call sites with
  one writer and one reader (the stylesheet). `showsNumbers()` stays exported
  for the settings control and for `test/verbosity.test.ts`.

**The seam for a third mode** is the attribute value plus a CSS block.
`theme/verbosity.ts` names neither `simple` nor `detailed` — it writes whatever
`Verbosity` it is given — so a third mode adds a union member and its rules and
branches nothing.

### 4.3 What changed in the components

| | before | after |
|---|---|---|
| `member-card.statBlock` | read `showsNumbers()`, swapped `value.hidden`/`bar.hidden` | renders both, always |
| `screens/threats.renderThreat` | took `detailed`, omitted the count span in Simple | renders the count, always |
| `app.ts` | subscription redrawing the map and the party screen | one subscription writing the attribute |
| `gallery.ts` | `initSettings()` | writes the attribute too, or every captured card would ignore the stored preference |

The threat readout's `aria-label` already carried the detailed reading in both
modes — its own note says Simple is "a shorter readout, not a different one" —
so always rendering the count makes the spoken and the visible versions agree by
construction rather than by two code paths matching.

### 4.4 Tests

`test/visual-verbosity.test.ts`, five assertions in a browser, all passing.
Browser rather than jsdom because "is this number on screen" is now a
computed-style question and jsdom has no stylesheet to ask.

- **Detailed is the first-launch default** — the attribute reads `detailed`.
- **The party screen changes, and changes back.** Detailed: bars and numbers,
  equal counts. Simple: numbers 0, bars unchanged. Back: both restored. Neither
  mode renders a row with neither, which is the assertion the shipped build
  would have failed in the other direction.
- **The threat readout changes, and changes back.** Simple drops the counts and
  keeps every type chip — shorter, not different.
- **pre-gym takes the change while it is open**, without navigating away. It
  draws member cards, is neither the map nor the party screen, and the old
  subscription never redrew it.
- **The drawer shows the current mode every time it opens.** Ruling 4's live
  case is not reachable there and that is a property of the app rather than a
  gap in the test: the drawer is `aria-modal="true"` with a scrim over the
  viewport and the toggle sits in the header underneath it, so Playwright
  refuses the click for the same reason a thumb would miss it. What is asserted
  is the case that exists — open in Detailed, close, toggle, reopen in Simple,
  and back — which is ruling 4's own "re-render on drawer open", and for a modal
  surface is the whole of the case rather than a fallback.

**The battle panel is not asserted, per ruling 2.**

One existing test was **rewritten rather than deleted**, per test 12:
`test/threat-readout.test.ts`'s two verbosity cases asserted that Simple omitted
the count span from the DOM. They now assert the data is present and identical
in both modes, with a comment naming this patch and pointing at where the
visibility half moved.

`test/verbosity.test.ts` passes unchanged — the flag is still unreachable from
`core/`, and a run still replays byte identical in both modes.

### 4.5 Pixels

`--compare` reports **guarded screen heights equal to the baseline to the
pixel.** Detailed gained a bar per row and lost nothing: the bar takes the
`flex: 1` remainder of a row whose height was already set by its text, and
`.stat__value`'s reserved `3ch` from step 1 is what stops the six bars starting
at six different x positions now that they share the row with a number.
