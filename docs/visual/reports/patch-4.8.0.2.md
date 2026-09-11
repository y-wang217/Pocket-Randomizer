# Patch 4.8.0.2 — readability

The running report. Prompt:
[`../../spec/gymrun-patch-4.8.0.2-readability.md`](../../spec/gymrun-patch-4.8.0.2-readability.md),
the brief verbatim. Branch `claude/nice-einstein-up1ltb`, off `main` at
`1869ca9` (the merged overnight run: `RANDOMIZER_VERSION` 13,
`RUN_LOG_VERSION` 13, `AI_VERSION` `gymrun-ai-3-priority`).

**Presentation and copy only.** No `core/` change, no version axis moved,
`contentHash` `b022fc` before and after, the recorded runs and battle
protocol byte identical. One baseline file moved, `heights.json`, and section
2 says by how much and why.

Sections 0 and 1 are the report the brief asked for before any code. Sections
2 to 6 are one per step, in the order the work ran. Section 7 is the tracker
report, in the form it was handed back.

---

## 0. Status of the five, before any code

| # | complaint | what the tree did | cause |
|---|---|---|---|
| 1 | stats are bars, not numbers | `member-card.statBlock` rendered a number **and** a bar on every row; CSS hid the number in Simple only, so Detailed — the default — showed both | 4.7.2 ruling 3. Before it, Detailed was numbers only |
| 2 | pixel font distorted; `2` reads as `8` | all three face tokens on Pixelify Sans, body and every counter included | 4.7.2 step 1 took V0's "morning decision". No size in the scale was chosen against the face's grid — and section 2 shows it has none |
| 3 | "Give up" is not a button | it was an `<h3>` over the four current-move buttons, styled like every other section label | copy, since the screen was built at 4.5.2. Core has no decline for the replace question by design |
| 4 | "Requires X" events pay a random v1 event | resolution was correct; the content behind it was never written. `latent` aliased the v1 outcome table, `none` and `known` were one shared table each, hints were written for `latent`, the reveal was one label | 4.6c shipped the selector and no copy |
| 5 | gym move has no description | the gym's move is a grant, skips the reward screen, and lands on the recipient screen as `Tutor: Ice Beam` and nothing else | 4.8 item 2 Part A. The reward screen was the only surface that drew a tutor as a card |

The base gate on `1869ca9`: lint clean, typecheck clean, `measure --compare`
equal to `heights.json` to the pixel, `content-hash` `b022fc`. The full suite
was started on the untouched tree and then contaminated by this patch's own
edits — each browser test file builds from the working tree — so its two
height failures are not evidence of anything; the suite that counts is the
one in section 6.

## 1. The face, measured

Two instruments, because the question has two halves.

### 1.1 The outline: there is no pixel module

`fontTools` over the two woff2 files, drawing `2 8 0 1 I` and taking the GCD
of every coordinate delta and advance:

```
Regular  upm 1000  module 1
  2  adv 586  xs 60 151 161 423 433 525   ys -12 78 88 179 260 270 350 359 440 530 540 631
  8  adv 586  xs 60 151 161 423 433 525   ys -12 78 88 260 270 350 359 530 540 631
Bold     upm 1000  module 1
  2  adv 603  xs 61 149 188 414 453 542
```

Read the columns: a "pixel" is a rounded square about **90 units** wide with a
**10-unit gap** to the next (151→161), and the rows are 80 to 91 units tall.
Bold's gap is 39. The GCD is 1 because nothing repeats exactly. So the face is
a pixel *look* drawn as outlines, not a bitmap on a grid — and no CSS size at
any device pixel ratio can put both a 90-unit square and a 10-unit gap on
whole device pixels.

### 1.2 What Chromium paints

`scripts/visual/font-grid.mjs`, new: the digits `0123456789` on a canvas at
every size in the scale, at 1x, 2x and 3x, both weights, with and without the
stylesheet's `0.08em` tracking, counting how much of the ink is antialiased. A
face on the grid paints solid pixels and nothing between, so the number to
look for is 0.

| size | 1x | 2x | 3x | 3x bold | 3x tracked |
|---|---|---|---|---|---|
| 11 | 0.776 | 0.572 | 0.411 | 0.343 | 0.450 |
| 12 | 0.781 | 0.550 | **0.426** | 0.224 | 0.409 |
| 12.48 | 0.737 | 0.544 | 0.406 | 0.292 | 0.406 |
| 13 | 0.766 | 0.519 | 0.287 | 0.288 | 0.295 |
| 14 | 0.739 | 0.405 | 0.350 | 0.282 | 0.352 |
| 17 | 0.728 | 0.433 | 0.278 | 0.179 | 0.286 |
| 24 | 0.550 | 0.270 | 0.227 | 0.130 | 0.227 |
| 44 | 0.354 | 0.148 | 0.134 | 0.084 | 0.131 |
| 56 | 0.292 | 0.157 | 0.084 | 0.069 | 0.083 |

At 12px on a 3x phone, **43% of the ink is antialiased**; below 44px it is
never under 20%. The crops in `patch-4.8.0.2/` show what that means:
`digits-Pixelify-Sans-12px@3x.png` is the `2` that reads as an `8`, beside
`digits-mono-stack-12px@3x.png` at the same size. At 24px
(`digits-Pixelify-Sans-24px@3x.png`) the shapes resolve, but no title size is
on the grid either — there is no grid.

The rule the plan set was: keep the face only at sizes that land; if no
uniform module exists, abandon it. Rule B. All three tokens point at the
monospace stack, the two `@font-face` blocks and the woff2 files are gone,
`scripts/visual/shots.mjs` no longer waits for a web font, and
`test/visual-tokens.test.ts`'s test 8 asserts the one face is `ui-monospace`.
`test/visual-font-grid.test.ts` asserts it on the page, element by element.

For a later identity pass that wants the look back: at 44px and above the
face reads, and the two summary numerals are the only text drawn there.

## 2. Pixels

The font swap at 4.7.2 shortened the map by 29.69px (`generation.md` §12e);
taking it back returned exactly that.

| | before | after | delta |
|---|---|---|---|
| `map.screenHeight` | 810.72 | 840.41 | +29.69 |
| `map.scrollHeight` | 1004 | 1033 | +29 |
| `map.decisionTop` | 558 | 558 | **0** |
| `map.decisionBottom` | 643.03 | 672.72 | **+29.69** |
| `battle.screenHeight` | 599 | 599 | 0 |
| `battle.decisionTop` | 472 | 472 | **0** |
| `battle.decisionBottom` | 712 | 712 | **0** |

The map's last offered card clears the 740 line by 67px; the fourth move
button by 28px, unmoved. `heights.json` re-recorded in the commit that moved
it; `generation.md` §12i is the deviation note. The stat rule (section 3), the
recipient card (section 5) and the event screen (section 6) draw on no
guarded screen and moved nothing.

### 2.1 The loaded board, and the one line that wrapped

The first full suite failed one layout assertion the guarded heights do not
cover: V5's loaded board — a status and a stage chip on both sides, gallery
seed `V5-LOADED-1` — measured **604.5 against its 600 ceiling**. Measured
against the same gallery built from `1869ca9`, row by row:

| | base | patched |
|---|---|---|
| battle screen | 591.5 | 604.5 |
| both panels | 121 each | 121 each |
| move grid, first row | 109.5 | **122.5** |
| move grid, second row | 117 | 117 |

The whole 13px is one line: Swords Dance's status readout, `Raises Attack by
2 stages`, is 25 characters, and at 10px the monospace face sets it at about
150.5px against a 150px button face. The pixel face set the same string at
129px. So the readout took a third line on the two status moves in that row,
and nothing else on the board moved by a pixel.

The fix is one declaration on `.move__effect`: `margin-inline` of one negative
step, so the readout line alone runs 166px wide — 27 characters, the count the
old face fitted — and no other line on the button moves. The loaded board
reads **591.5, identical to the base**, and the guarded heights are unchanged
to the pixel.

### 2.2 A walker stall, same class as 4.7.2's, and the base was one chip away

The second full suite failed two walks to the summary on `SEED-B`, in
`visual-v1` and `visual-v3`, each giving up after 900 steps on the battle
screen. Reproduced alone, so not load: on that seed's first battle the
walker's hardest move is Electroweb, and under the monospace face's wider
chips the button's geometric centre sits on its **band chip** — a tooltip
trigger that stops the event by design. The walker dismissed the tooltip
and clicked the same point, 900 times.

4.7.2 §2.5 met this exact defect on the item-target and move-replace screens
and fixed it by aiming at the card's name line instead of its centre; the
battle case was the one it did not reach. `scripts/visual/browser.mjs` now
clicks `.move__name` on the battle button too, which is always present and
never a trigger, and the walk reaches the summary in 87 steps on both this
build and the base's. A bot fix, not a product change: a player aims at a
button, not at its centroid.

One more assertion of the same shape moved with the map: `visual-v3`
compared the parallax layers' transforms as strings, and 0.2 of the map's
new scroll height is `37.800000000000004` in JS where the browser writes
`-37.8`. Compared as numbers now.

## 3. Stats: Detailed is numbers, Simple is bars

One rule beside 4.7.2's two:

```css
:root[data-verbosity="simple"] .stat__value { display: none; }
:root[data-verbosity="simple"] .threats__count { display: none; }
:root:not([data-verbosity="simple"]) .stat__bar { display: none; }
```

`:not(simple)` rather than `detailed`, so a missing attribute reads as
Detailed too. `statBlock` still renders both and the stylesheet still
decides, the fill still paints, and the mode is still the attribute — the
three things 4.7.2 fixed underneath stay fixed. What went back is ruling 3.

`test/visual-verbosity.test.ts` now asserts numbers without bars in Detailed
and bars without numbers in Simple, on the party screen, the drawer and
pre-gym; `test/visual-stat-bars.test.ts` keeps its toggle into Simple, which
is the mode with a bar to measure, and its header says why again.

## 4. The heading

`move-replace.ts:61`: `Give up` → `Currently knows — tap one to replace`. An
`<h3>` still. The four cards under it were always the control and each still
announces `Replace <move>`. `test/band-badge.test.ts` gains the assertion that
no heading on that screen reads `Give up` and every current move is a button
whose click submits its slot.

Not built, recorded: a decline for the **gym** grant. 4.8 Part A hands a move
over unconditionally, so a party of four-move members must displace one. A
decline is a `core/` change and a `RUN_LOG_VERSION` bump.

## 5. The recipient screen draws the move

`screens/item-target.ts` takes the run's tuning and, for a TM or a tutor,
appends `moveCard(moveCardData(describeMove(reward.move), tuning))` under the
title — the two lines `screens/reward.ts` already used. No holder, so no STAB
tag, which is the documented rule for a card nobody has been picked for. The
card carries the type chip, the category chip, base power, band, PP, the face
tags and `Explain`, whose Category row is `categoryInfo`'s copy; the member
cards below already carry the archetype chip.

`test/visual-move-cards.test.ts` counts `target` as the seventh surface and
test 10 covers it — the card sits above the member buttons, not inside one.
`test/item-target.test.ts` (jsdom) holds the card's facts, that opening
`Explain` picks nobody, and that the members still pick.

Same shape, not done here: the shop shelf shows `Tutor: X` with no card.

## 6. Events say what the standing bought

`src/data/eventCopy.ts`, new, on the `contentHash` exclusion list with a
reason, read by `ui/` only:

- the capability and band label tables, moved out of `run-map.ts` and
  `party.ts` where they were duplicated;
- per event, per band: a hint per choice at `none` and `known` (the authored
  hint is the `latent` hint and stays in `events.ts`), and a conclusion per
  choice at all three bands — 17 + 17 + 51 = 85 sentences;
- `KNOWN_WITHOUT_OFFER`, for the `known` band whose drawn encounter was empty.

`screens/event.ts` shows the map card's two gate chips under the title, the
band's hint on each choice, and the conclusion above the outcome label after
the pick. The decision is unchanged, `{ kind: 'event', index }`; the payout
tables are unchanged; `content-hash` prints `b022fc` before and after.

Every sentence is linted against `TUTORIAL_FORBIDDEN_WORDS`
(`test/event-copy.test.ts`), which also holds the table to the events table:
every id, every band, one conclusion per choice. `test/event-screen.test.ts`
is the screen's first test: at each band, for every event and every choice,
the chips, the hint, the conclusion, the outcome label, the locked buttons,
and that `Carry on` — not the pick — resolves.

Not built, recorded as a follow-up that moves `RANDOMIZER_VERSION`: `latent`
as its own payout table, the held item on the `known` encounter and
decline-yields-item (both promised by the 4.6c prompt and never shipped), any
byte of `events.ts`.

## 7. Where the patch landed

**101 test files, 1284 tests, green** (735s, no other load). Lint and
typecheck clean. `measure --compare` equal to the re-recorded `heights.json`
to the pixel; `baseline --check` byte identical across all 8 files, the
digest included, because it reads `contentHash` and the one new `data/`
file is on the exclusion list; `content-hash` `b022fc` before and after;
`npm run smoke` passes on the built app.

Three full runs to get there, and each earlier one is worth a line: the
first was contaminated by this patch's own edits landing mid-run; the second
found the loaded board (§2.1), two doc paths that named a file two files
share, the parallax string comparison and the walker stall (§2.2); the third
is the one above.

### The brief, item by item

| asked | state |
|---|---|
| stats back to numbers | Detailed shows the number alone, Simple the bar alone; asserted on the party screen, the drawer and pre-gym |
| a different px size or no pixel font | measured: no size exists, because the face has no pixel module. Removed from every token, files deleted; asserted on the tokens and on the page |
| "Give up" is not a button | relabelled as the heading it is; the four cards under it asserted as the control |
| events say what the requirement bought | gate chips, band-correct hints and a conclusion on the event screen, at every band for every event and choice, from a file the hash does not see |
| the gym move has a description | the reward screen's card on the recipient screen, with category and `Explain`; the seventh surface |

### Not built, recorded

`docs/README.md` open items 11 to 13: the event payout tables
(`RANDOMIZER_VERSION`), a decline for the forced gym move
(`RUN_LOG_VERSION`), and a move card on the shop shelf.

## 8. Tracker report

**GYMRUN patch 4.8.0.2 — readability.** Presentation and copy only; no version
axis, no `core/`, seeded runs byte identical, `contentHash` unchanged.

| item | status before | cause | fix | lift |
|---|---|---|---|---|
| Stat bars instead of numbers | Regression from 4.7.2 | Ruling 3 put a bar beside every number in Detailed | Detailed = numbers, Simple = bars (the 4.5.1 definition). One CSS rule | XS |
| Pixel font distorted on phone | Regression from 4.7.2 | Body and numerals moved onto Pixelify Sans; the face has no pixel module, so no size lands | Measured, then removed. Monospace stack everywhere; font files deleted | S |
| "Give up" does nothing | Copy bug since 4.5.2 | A section heading over the four tappable moves | Relabelled. No decline added (core design; a log-version bump) | XS |
| "Requires X" events pay a random v1 event | 4.6c shipped the selector, not the content | Hints written for latent; the reveal was one label | ui-only copy table, 85 sentences: gate chips on the event screen, band-correct hints, a conclusion naming what the standing bought | M |
| Gym move has no description | Gap since 4.8 item 2 | The grant skipped the reward card | The reward screen's move card on the recipient screen, with category and Explain | S |

Follow-ups recorded, not built: the event payout tables (`RANDOMIZER_VERSION`),
a decline for the forced gym move (`RUN_LOG_VERSION`), a move card on the shop
shelf.
