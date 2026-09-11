# Density modes: the report before any code

Prompt: [`../../spec/gymrun-patch-density-modes.md`](../../spec/gymrun-patch-density-modes.md).
Branch `claude/bold-clarke-xcwko1`, cut from `main` at `4a01fb0` (PR #29), which
carries the tutorial (overnight Branch 3), V5, 4.7.2, 4.8.0.1, 4.8.0.2 and the
mobile seed bar. Written 2026-09-11. **No code has been written.** The four
questions below are the hard stop the prompt names.

Every number here was measured on this tree after `npm ci && npm run build`,
headless Chromium at 390x844, seed `SMOKE24`, pointer parked, using the same
`scripts/visual/browser.mjs` driver the guarded measurement uses. The one-off
script that walked the unguarded screens is not committed; it added nothing to
the driver and the numbers are reproducible by playing the seed.

---

## 1. The screens

**The router has twelve, not eleven.** `src/ui/screens/router.ts` still opens
with "Eleven screens" — stale since Stage 4.7 added `pre-gym`. The `ScreenName`
union and the record `app.ts` hands `createRouter` both have twelve entries.

| # | screen | file | reached by the bot on SMOKE24 |
|---|---|---|---|
| 1 | `starter` | `src/ui/screens/starter-select.ts` | yes |
| 2 | `locale` | `src/ui/screens/locale-select.ts` | yes |
| 3 | `map` | `src/ui/screens/run-map.ts` | yes, guarded |
| 4 | `battle` | `src/ui/screens/battle.ts` (+ `scene.ts`, `flag-strip.ts`, `battle-log.ts`) | yes, guarded |
| 5 | `result` | `src/ui/screens/result.ts` (+ `reward.ts`, `acquisition.ts` as a block inside it) | yes |
| 6 | `target` | `src/ui/screens/item-target.ts` | yes |
| 7 | `replace` | `src/ui/screens/move-replace.ts` | yes |
| 8 | `party` | `src/ui/screens/party.ts` (+ `threats.ts`, `member-card.ts`) | **no** — the bot never taps Manage |
| 9 | `pre-gym` | `src/ui/screens/pre-gym.ts` | yes |
| 10 | `shop` | `src/ui/screens/shop.ts` | yes |
| 11 | `event` | `src/ui/screens/event.ts` | yes |
| 12 | `summary` | `src/ui/screens/summary.ts` | reached at run end; `smoke.mjs` waits for it, `measure.mjs` never gets there |

`stepOnce` in `browser.mjs` has eleven `case` arms, and the eleven it drives are
the twelve minus `party`. That is where the estimate's "eleven" comes from.

**Overlays the shell mounts, over any screen:**

| overlay | file | mounted where | carries facts? |
|---|---|---|---|
| party drawer | `src/ui/drawer.ts` | `shell`, `position: fixed`, own scroll | yes — every member card, relics |
| battle log sheet | `src/ui/log-sheet.ts` | inside the battle screen root | yes — the turn history |
| tooltip layer | `src/ui/tooltips.ts` | `shell`, one delegated listener, eleven `data-tip` kinds | yes, and it is Pocket's "one tap" destination |
| coach-mark layer | `src/ui/tutorial.ts` | `shell` | copy only; forced Detailed by Part 5 |
| seed bar | `src/ui/seed-bar.ts` | `shell`, above the router; collapses on the phone during a run | the seed |
| corner stamps | `src/ui/stamps.ts` | `shell`, fixed, out of flow | none new (texture, by its own header) |
| header + Detail toggle | `src/ui/app.ts` `createHeader` / `createVerbosityToggle` | `shell` | the toggle itself |

Not screens: `src/ui/gallery.ts` (a separate `dist-gallery/` entry that renders
`summary`, `result`, `result-capture`, `result-both` and a loaded `battle` from
a scripted run; useful as the coverage test's fixture host, not a thing the
shell routes to), and `screens/acquisition.ts` (a block inside `result` since
4.6a).

**The count the coverage test should key to: fourteen.** Twelve router screens
plus the two overlays that carry facts of their own and have a layout to spend
— the drawer and the log sheet. The tooltip layer is excluded on purpose: in
Pocket it is where a fact goes, so it must read the same in every mode or the
fact has moved twice. The coach layer is excluded by Part 5. The seed bar,
stamps and header are chrome shared by every screen; they scale with the chrome
tables but are not a "screen with nothing to say".

Two of the fourteen are early findings, flagged now rather than at the test:

- **`log-sheet`** is a list of protocol lines with no labels, no descriptions
  and no stat block. Simple and Pocket may have nothing honest to change beyond
  the shared chrome scale. Candidate for "the setting is two valued here" unless
  the short-form copy pass reaches the log formatter's line templates in
  `battle-log.ts`.
- **`target`** (pick a member for an item) renders its own member buttons in
  `item-target.ts` with no stat block, no description and one question. It has
  prose and chrome to spend and nothing to put behind a tap, so its Pocket and
  Simple may be the same thing. Same candidate status as the log sheet.

---

## 2. Where the flag lives and who reads it

**Store.** `src/ui/settings.ts`: `Settings.verbosity: Verbosity`,
`type Verbosity = 'simple' | 'detailed'`, persisted under `localStorage`
key `gymrun.settings` beside `tutorial: { skipped, seen[] }`.
`DEFAULT_SETTINGS.verbosity` is `'detailed'`. `readSettings` accepts only the
two literals and drops anything else, so a stored value the new union does not
know lands on the default — which is the migration behaviour Part 1 asks for,
and the reason the migration test must assert `simple → simple` explicitly
rather than trusting the fallback.

**Writers.** One: `setVerbosity`, called from the header toggle in
`src/ui/app.ts` `createVerbosityToggle` (line 857). Tests call it directly.

**Read path.** Since 4.7.2 ruling 4 there is exactly one: `app.ts` line 88–89
calls `applyVerbosity(initSettings().verbosity)` once and again on every
`onSettingsChange`, and `src/ui/theme/verbosity.ts` writes it as
`data-verbosity` on `<html>`. `gallery.ts` line 51 does the same for its
entry. **No component reads the value.** `getVerbosity()` has one caller (the
toggle's own paint) and `showsNumbers()` has none outside tests. The only
consumer of the mode is three rules in `src/ui/styles.css` lines 772–774:

```css
:root[data-verbosity="simple"] .stat__value { display: none; }
:root[data-verbosity="simple"] .threats__count { display: none; }
:root:not([data-verbosity="simple"]) .stat__bar { display: none; }
```

**What that reaches.** `.stat__value` / `.stat__bar` are rendered only by
`memberCardContents` in `src/ui/member-card.ts`, which is used by the party
screen, the pre-gym screen and the drawer. `.threats__count` is rendered only
by `screens/threats.ts`, which is used by the party screen. So the toggle
changes, today:

| surface | what changes |
|---|---|
| `party` | six stat rows number ↔ bar; threat readout drops its per-type counts |
| `pre-gym` | six stat rows on every member card, number ↔ bar |
| drawer (overlay) | six stat rows on every member card, number ↔ bar |

Nothing else. The battle panels lost their stat block at V5.3 (4.7.2 ruling 2
records that the panel does not branch). The starter cards render their own
stat row (`starter-select.ts` line 120, the `stats` tutorial anchor) and do
not use the member card. Reward cards, the map, result, target, replace, shop,
event, locale and summary carry no `.stat__*` and no `.threats__count`. The
prompt's "three screens out of thirteen" is two router screens and one
overlay; the count of untouched router screens is ten.

`test/visual-verbosity.test.ts` asserts exactly those three surfaces in a
browser (party, threats, drawer, and "takes effect on pre-gym while open").

**The 4.5.1 core-unreachable test.** `test/verbosity.test.ts` exists and passes
on this tree: 8 tests, including the static grep of every file under
`src/core/` for `/\bshowsNumbers\b/`, `/\bgetVerbosity\b/`, `/\bsetVerbosity\b/`
and `/\bverbosity\b/i`, and the behavioural guard that plays seed `VERBOSITY`
in both modes and compares the logs byte for byte. Extending it is a pattern
list edit plus a third mode in the replay loop.

Other places the old name is spelled, all of which the rename must touch:
`test/party-stats.test.ts`, `test/threat-readout.test.ts`,
`test/tutorial.test.ts` (a comment), `test/visual-stat-bars.test.ts` and
`test/visual-phone-seed-bar.test.ts` (click `.verbosity__toggle`),
`scripts/visual/browser.mjs` line 359 and `scripts/smoke.mjs` line 95 (both
seed `{ verbosity: 'detailed', tutorial: { skipped: true } }` into storage —
harmless after the rename because unknown fields are dropped, but they should
say `density` or the fixture is lying about what it sets), and the stale
comment in `settings.ts` that says the reward cards read the flag. They do
not.

---

## 3. Current heights

**`heights.json` guards two screens, not every screen.** `measure.mjs`
measures `map` and `battle` only, and `docs/visual/baseline/heights.json` has
only those two entries. Re-measured on this tree:

```
guarded screen heights equal docs/visual/baseline/heights.json to the pixel
```

| screen | screenHeight | scrollHeight | decisionCount | decisionTop | decisionBottom |
|---|---|---|---|---|---|
| `map` | 840.41 | 1033 | 2 | 558 | 672.72 |
| `battle` | 599 | **844** | 4 | 472 | 712 |

**Battle is 844, not 1376.** The prompt's figure is from before V5. V5 landed
on this tree (`docs/visual/state/V5.done`: `battle.scrollHeight 1376 → 844,
-532`) by moving the 320px log into the sheet and overlaying the panels on the
scene. The sequencing note's premise — Pocket first, V5 inherits the budget —
is the reverse of what happened. Consequences, for review:

- Detailed battle already has zero scroll at 390x844: `scrollHeight` equals
  the viewport exactly. The "roughly 530px over" is already spent, and the
  region breakdown Part 3 asks for before cutting is not needed to hit the
  Pocket gate on this screen. It is still needed for Simple and Pocket to be
  *distinct* on battle, which is the coverage gate's ask, not the height gate's.
- The map is the guarded screen that is over: 1033, 189px past the fold.

**The unguarded screens**, measured on the same seed at the first moment the
run reaches each one. These are samples of one run state, not worst cases: a
party of six on `party` or `pre-gym` is taller than the party SMOKE24 had.

| screen | screenHeight | scrollHeight | over 844 by |
|---|---|---|---|
| `starter` | 889.5 | 1083 | 239 |
| `locale` | 624.5 | 844 | fits |
| `map` (guarded) | 840.41 | 1033 | 189 |
| `battle` (guarded) | 599 | 844 | fits |
| `result` | 803.73 | 997 | 153 |
| `target` | 360.5 | 844 | fits |
| `replace` | 648 | 844 | fits |
| `event` | 481.56 | 844 | fits |
| `pre-gym` | 2415.19 | **2608** | **1764** |
| `shop` | 472.34 | 844 | fits |
| `party` (via Manage from the map) | 1445.06 | **1638** | **794** |
| `summary` | 3352.25 | **3741** | **2897** |
| drawer (overlay, from battle) | fixed; sheet 759 client / 845 scroll | document stays 844 | 86 internal |
| log sheet (overlay, from battle) | sheet 232 | document stays 844 | fits |

The hard cases for Pocket are **pre-gym, summary and party**, not battle.
Pre-gym at three screens tall is the lead pick over full member cards; the
uniform rule (all cards collapse together) applies and looks feasible. Summary
at four and a half screens is the roster, the graveyard and the share text;
fitting it in 844 without moving whole sections behind a tap is not obviously
possible, and "a section behind a tap" needs a uniform rule of its own before
step 4 touches it. Both are flagged now as the places step 4 is most likely to
have to stop and report under Part 3's last bullet.

Two definitions the Pocket gate needs before it is written:

- **Overlays.** The drawer is `position: fixed` with its own scrolling sheet,
  so `document.scrollHeight` is 844 whatever it holds. The gate for an overlay
  has to be the sheet's own `scrollHeight <= clientHeight`, or the drawer passes
  by construction while scrolling 86px today.
- **Fixture state.** `scrollHeight` on `party` and `pre-gym` scales with party
  size. The gate should measure a six-member party (the gallery can build one
  the way V5.6 built the loaded battle), or it measures whichever party
  SMOKE24 happened to have.

---

## 4. Tutorial geometry

**Live geometry, at show time, every mark.** `src/ui/tutorial.ts`:

- `anchorFor` resolves each mark's `anchor` (a `[data-tutorial="…"]` selector
  in `src/data/tutorial.ts`) by `querySelectorAll` the moment `showFor` runs,
  and keeps only elements `present()` says are painted — `isConnected`, no
  `[hidden]` ancestor, and `checkVisibility()` in a browser.
- `place` scrolls the anchor into view instantly, reads
  `getBoundingClientRect()` on the anchor and on the panel, and picks below /
  above / anchor-at-top-with-capped-panel / bottom-45%. No mark carries an
  offset, a coordinate or a size: `TutorialMark` is `id`, `anchor`, `title`,
  `text`.

So Pocket does not move an anchor out from under a mark. **The silent break is
a different one:** a fact Pocket puts behind a tap is `display: none` until
tapped, `present()` returns false for it, and the mark is dropped from the
queue without a trace — the tutorial gets shorter, not wrong. Anchors that are
exactly the things Part 4 collapses:

| anchor | element | screen | at risk in Pocket |
|---|---|---|---|
| `stats` | the starter card's stat row | starter | yes, if the row becomes a bar row with numbers on tap the row survives but the copy names numbers |
| `pp` | `.move__pp` on a battle move button | battle | yes — Pocket keeps PP on the card per Part 4, so survives; flagged because it is inside the move card the rule reshapes |
| `items` | the held-item line in a member card | drawer, party, pre-gym | yes, if the member card collapses |
| `backpack`, `relics` | party screen sections | party | yes, if sections move behind a tap |
| `move` (twice), `hp`, `status`, `flags` | battle scene / strip | battle | flags stay by definition; the rest depend on the battle Pocket layout |
| the other 17 | headers, cards, chains, badges | all | survive any padding change |

Count confirmed: **29 marks** across 8 tutorial screens (`starter`, `locale`,
`map`, `battle`, `result`, `party`, `drawer`, `pre-gym`); the `grep -c` of
`anchor:` says 30 because one is the interface field. `showFor` is called from
three places in `app.ts` (each router show, drawer open, drawer re-open).

**So Part 5 is the right fix and it is small**, as the prompt predicted for
the live-geometry case: force `detailed` at the one write site
(`applyVerbosity` in `app.ts`) while the tutorial is live, and restore the
stored mode after. One definition it needs, flagged for the ruling: the
tutorial is not one contiguous session. It is first-visit marks on eight
screens spread across a run — `pre-gym` fires before the first gym, `drawer`
fires the first time the drawer opens, which a player may never do. "For the
duration of the tutorial" therefore has to mean *until every tutorial screen
is in `seen` or `skipped` is set*, and the mode picker is offered at that
moment. A player who never opens the drawer stays in Detailed until they press
Skip. That is the reading I will build unless ruled otherwise.

---

## Two things the gates need decided before step 3

1. **What "output" the coverage test compares.** Since 4.7.2 ruling 4 the mode
   is an attribute and components render the whole readout in every mode. In
   jsdom the DOM of a screen is *identical* across modes by design; only
   computed style differs. The short-form copy (Part 4) will change DOM text,
   but chrome and padding will not. So the per-screen "three modes differ"
   assertion must compare rendered output — a screenshot hash or the set of
   bounding boxes — in the browser, from the gallery as fixture host. A DOM
   diff would pass only on screens with prose and fail honestly on none. I will
   write it as a browser test unless told to make density re-render the DOM.
2. **The fixture.** One seed, one run state, per screen, six-member party, held
   fixed for both gates. The gallery already builds the loaded battle and three
   result variants; it needs the other eleven.

No code until this is reviewed.

---

## The patch as built (steps 2 to 7)

**2026-09-11, branch `claude/bold-clarke-xcwko1`, commits `c05855a` to
`7de7f0e`.** The four questions above were answered, six rulings were
recorded (the prompt file's appendix, `generation.md` section 12l), and the
seven steps were built in the prompt's order. What follows is the done
condition, measured.

### The Pocket gate, and the coverage gate

Every surface, on its worst-case fixture (ruling 3), at 390x844, in all
three modes. Document `scrollHeight`; the drawer's sheet `scroll/client`; the
summary's outcome edge (the bottom of `.summary__actions`, ruling 4); the
log sheet's bottom. The Detailed column is the **before** column the prompt
asked for, on the fixture the gate now runs against, and it is what a
Detailed player sees on that state.

| surface | Detailed | Simple | Pocket |
|---|---|---|---|
| starter | 1038 | 927 | **844** |
| locale | 955 | 844 | **844** |
| map | 1304 | 1152 | **844** |
| battle | 1169 | 1087 | **844** |
| result | 1015 | 846 | **844** |
| result-capture | 2040 | 1753 | **844** |
| target | 1368 | 1245 | **844** |
| replace | 844 | 844 | **844** |
| party | 8120 | 7202 | **844** |
| pre-gym | 4959 | 4562 | **844** |
| shop | 844 | 844 | **844** |
| event | 844 | 844 | **844** |
| drawer (sheet) | 4881 / 759 | 4500 / 759 | **750 / 750** |
| summary (outcome edge) | 950 | 809 | **745** |
| log sheet (sheet bottom) | 844 | 844 | **844** |

`test/visual-pocket.test.ts` holds the Pocket column: twelve decision
surfaces at or under 844, the drawer's sheet at or under its own client
height, the two archive surfaces' outcome block above the fold. Green.
`test/visual-coverage.test.ts` holds that every surface paints differently
in every pair of modes, by full-page screenshot hash: **fifteen of fifteen
differ in all three pairs**, so the two-valued exemption ruling 5 allowed
(the log sheet, the target screen) was not needed — the chrome scale is one
global axis and it shows on a sheet's padding and a member button's as on
everything else. `TWO_VALUED_SURFACES` is an empty list with the equality
assertion kept behind it.

The guarded Detailed heights (`heights.json`, map and battle on SMOKE24) are
**unchanged to the pixel**; the file grew a `modes` axis with Simple and
Pocket columns, re-recorded at step 4:

| mode | map screen / scroll / decision | battle screen / scroll / decision |
|---|---|---|
| detailed | 840.41 / 1033 / 558..672.72 | 599 / 844 / 472..712 |
| simple | 777.5 / 940 / 513.44..609.31 | 581.44 / 844 / 445.44..677.94 |
| pocket | 586.95 / 844 / 302.89..394.77 | 481.89 / 844 / 379.39..522.39 |

### Where Pocket's height came from, in the order it was spent

1. **Chrome** (the prompt's first ask): about 130 padding, margin and gap
   declarations in `styles.css` became `calc(token * --density-pad|gap)`,
   and `data/densityTuning.ts` sets the three scales (Simple 0.75 / 0.75 /
   0.9, Pocket 0.5 / 0.5 / 0.8 for pad / gap / title). That alone took the
   party screen from 7824 to 2444 and the drawer's sheet from 4654 to 1090.
2. **The stat block and the move cards**, as the definition writes them:
   six bars in a row with the number on the row's tap; name, type, band, PP
   and the effectiveness marker on a move, the rest behind the card's
   expander or the `?` chip on a battle button.
3. **Folds** (`ui/collapse.ts`): every member card's body, every backpack
   row's controls, the relics list, all together per surface. The card's
   head keeps who, level, types, lead mark, HP bar, status and held item.
4. **Layout**: two-up cards on the party, pre-gym, compare and target lists;
   the map's HUD two-up with the wallet on the header line; the result
   screen's slot row off screen while the capture block, which repeats it,
   is up.
5. **One more number behind a tap**: the member card's HP line, on the bar
   (`hpTip`). The last 30px per card that nothing else could give.

The region breakdowns at each pass are in the commit messages and the
scratch measurements; the deviations from the prompt's words, each with its
measurement, are `generation.md` section 12m.

### The tutorial (Part 5, ruling 6)

`ui/density-guard.ts`: Detailed on the root while a screen's unseen marks
are up, applied before the marks resolve their anchors, released when they
finish or Skip fires; per screen, not per run. **Measured without the guard
on the worst-case fixtures, Pocket leaves every one of the 29 anchors
painted** — the party's `items` row and the starter's stat line are inline
in Pocket, and the seed's second anchor is the stamp — so the guard is the
one-line safeguard the prompt anticipated ("if Pocket happens to work, say
so"), and it still holds the copy to the layout it was written for. The
assertion ruling 6 asked for is `test/visual-tutorial-guard.test.ts`: on
every surface with marks, the count the layer shows equals the count of
marks with an anchor on the page, so a dropped mark fails loudly.

### The picker (Part 6)

Three options in the drawer, the one surface reachable from every screen
of a run: "Detailed — Full labels and full prose", "Simple — Short labels
and fewer words", "Pocket — Fits every screen without scrolling". One line
each rather than the two-line descriptions first written, because the
drawer is under the Pocket gate too and three wrapped lines put its sheet
over by 25px. The header's two-valued toggle is gone. The mid-run switch
case: two switches on an open pre-gym screen leave the same screen, the
same saved log and the same party on it.

### The tests the prompt named

| # | the prompt's test | where |
|---|---|---|
| 1 | coverage, per screen, all three modes | `test/visual-coverage.test.ts` |
| 2 | Pocket height, every guarded screen | `test/visual-pocket.test.ts` |
| 3 | Detailed and Simple budgets unchanged | `measure.mjs --compare`, `test/visual-v0/v4/v5` |
| 4 | density unreachable from `core/` | `test/density.test.ts` |
| 5 | store migration | `test/density.test.ts` |
| 6 | mode switch mid-run preserves run state | `test/visual-density.test.ts` |
| 7 | tutorial runs in Detailed and restores the mode | `test/density-guard.test.ts`, `test/visual-tutorial-guard.test.ts` |
| 8 | uniform omission, asserted as the group | `test/visual-density.test.ts` |
| 9 | byte-identical seeded output | `test/density.test.ts`, `test/visual-baseline.test.ts` |
| 10 | the two-valued suites updated, named, not deleted | `generation.md` 12m, item 10 |

Gates on the final tree: lint, `tsc`, the build, the full suite, the
guarded heights to the pixel. Numbers stamped SMOKE24 throughout.
