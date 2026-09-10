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
