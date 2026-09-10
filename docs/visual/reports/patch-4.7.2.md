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
