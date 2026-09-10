# V5: battle stage composition

The stage that moves the sprites out of their box and into the scene. Prompt:
[`../../spec/gymrun-stage-v5-preflight-reconcile-execute.md`](../../spec/gymrun-stage-v5-preflight-reconcile-execute.md),
whose section 2 amends the V5 section of
[`../../spec/gymrun-visual-identity-plan.md`](../../spec/gymrun-visual-identity-plan.md).
The plan's V5 section is the requirements document; this file is the record of
running it.

The earlier [`V5.md`](V5.md) in this directory is the overnight loop's **skip**
marker, written when Release C did not exist. It stays as the record of that
night and is not edited to match this run.

---

## 0. Preflight

Run 2026-09-10 against `main` at `f5c84fe`. Report only; the two commits this
section carries are a spec archival and a gate repair, neither of them V5 work.

### 0a. Tree state

| | |
|---|---|
| Head of `main` | `f5c84fe` — *Merge pull request #17 from y-wang217/claude/band-badge-move-card-t02z1t* |
| R12 `866dcb2` | **ancestor** — *R12: BAND n on every move card, from one insertion point* |
| Release C `8675b88` | **ancestor** — reached `main` through `846975c` (PR #16), which also carries `fd0e1cd`, the merge of `main` into the Release C branch |
| V0–V4 `9296ba7` | **ancestor** — PR #13 |

The V5 branch is cut from `main` at `f5c84fe`, not from any other branch.

### 0b. The trim branch

**Every branch not merged to `main`**, with its ahead count. There are two, not
one.

| branch | ahead | behind | merge-base | what it is |
|---|---|---|---|---|
| `claude/strict-trim-startup-fix-46g74x` | **2** | 12 | `f0c53f2` (PR #15) | **the trim branch** |
| `claude/release-c-battle-feedback-ji40l7` | **1** | 3 | `846975c` (PR #16) | a Release C step-0 correction, unmerged |

**The trim fix has not merged.** Its two commits are `305e5b5` (the strict-trim
and restore-the-fold prompts, archived) and `fe75540` (*strict trim: the boot
failure was the instrument, not a module*), and neither is reachable from
`main`.

**The ten tests are not the trim fix.** R12 read 923 where Release C read 913,
and the difference is `test/pre-gym-confirm.test.ts` (**9 tests**) and
`test/pre-gym-browser.test.ts` (**1 test**), both added at `e974041` and carried
by **PR #15**, the 4.7 phone regression patch. Release C measured 913 on its own
branch; `fd0e1cd` then merged `main` into it, bringing PR #15's two suites with
it, and the merged tree read 923. The trim branch's own commit message records
its run as *68 files, 876 tests* on the pre-PR-#16 base, which is a different
tree again and not a contributor to either figure. Nothing trim-related landed
between the two counts.

**Overlap against the files V5 will touch: none in source.**

| V5 will touch | trim branch touches it |
|---|---|
| `src/ui/scene.ts` | no |
| `src/ui/theme/tokens.css` | no |
| the battle screen markup (`src/ui/screens/battle.ts`, `src/ui/styles.css`, `src/ui/flag-strip.ts`, `src/ui/battle-log.ts`) | no |
| `docs/visual/baseline/` | no |
| the Playwright harness (`scripts/visual/browser.mjs`, `scripts/visual/measure.mjs`) and `openApp` | **no** |
| — | `build-config/trim-sim-data.ts` is its only source file |

Its other five files are documentation: `docs/README.md`, `docs/engine-notes.md`,
`docs/generation.md`, `docs/spec/README.md`, and two new prompts under
`docs/spec/`.

**The trim branch does not touch the browser harness, so V5's tests need no
rebase fix against it if trim lands first.** That is the one-line answer the
definition of done asks for.

Two things found while verifying it, neither of them V5's to fix:

1. **`docs/generation.md` will conflict when trim merges, and not because of
   V5.** The trim branch appends a section numbered `## 13.` immediately after
   §12b, because its base predates R12 — and R12 has since put §12c in exactly
   that place. The conflict is between trim and R12; V5 adds a §12d only if it
   deviates from the plan (amendment A7), and a §12d after a §12c is the same
   append point.
2. **There is an unconsumed prompt on the trim branch that overlaps V5's
   budget.** `docs/spec/gymrun-patch-restore-the-fold.md` is a fold-reclamation
   patch for both guarded screens, and its step 3 — collapsing each panel's
   six-stat block to one row at narrow widths — says of itself: *"This is the V5
   budget brought forward; note it in the report so V5 does not redo it."* It is
   archived but not built, on a branch that is not merged, so **on this tree the
   cut is unspent and V5 takes it**. Recorded here so that whichever of the two
   lands second does not take it twice.

### 0c. Gate scoping

| gate | on this tree |
|---|---|
| Strict-trim **build** check | **gate. Green.** `GYMRUN_TRIM_STRICT=1 npm run build` exits 0. |
| Strict-trim **vitest** run | **excluded**, pre-existing red per open item 8. The trim fix is unmerged, so the boot failure stands. Spot-checked: `GYMRUN_TRIM_STRICT=1 vitest run test/pre-gym-browser.test.ts test/visual-release-c.test.ts` → 4 of 4 failed, every one at `openApp` waiting for `.starter`. **24 tests across six browser files** are in that blast radius now, where open item 8 recorded 22 across five — `visual-release-c` (3) and `pre-gym-browser` (1) joined since, and nothing was fixed. |
| SMOKE24 | **exit 0**, with **exactly one** `xfail`: *the offered nodes are fully visible without scrolling (cards end at y=869 of 844)*, the 4.7 map fold. `phoneCheckExpectedFail` has exactly one call site in `scripts/smoke.mjs`, so it is still the only one. Every battle-screen check passes, band badge and 44px target included. |
| `tsc --noEmit`, `eslint .` | clean |
| Suite floor | **72 files, 935 tests** — measured, not quoted. See below. |

**The suite floor came back red, and the red was on `main`.**
`vitest run` at `f5c84fe`: 72 files, 935 tests, **1 failed**, 640s.
`boundaries.test.ts` → *resolves every repo path they name* reported
`docs/generation.md:1043 heights.json`.

R12 added that line at `866dcb2`, inside §12c's quotation of the R12 prompt,
with the filename in inline code. The check reads a backticked token carrying a
known extension as a path, and this one resolves under none of the five house
spellings: nothing at the repo root, nothing beside `generation.md`, nothing
under `src/`, and the bare-basename fallback cannot see it either because the
basename index walks `docs/` for `.md` only. `visual/baseline/README.md` names
the same file eight times and never trips it, because `LIVE_DOCS` is
`docs/*.md` at the top level and does not descend.

Repaired at `efa4777`, before any V5 code, by dropping the inline-code markup
around the filename inside the quotation. **The quoted words are unchanged** —
the backticks are the quoting author's markup, not the prompt's text, so
protocol 4 is untouched. `NAMED_AS_ABSENT` was the alternative and is wrong
twice: the file is not absent, and that list is asserted to shrink and never
grow.

**The floor V5 measures against is 935 tests in 72 files, all green.** The only
suite that reads `docs/` is `boundaries.test.ts`, re-run green (21/21) after the
repair; the full suite is re-run at the first V5 checkpoint.

### 0d. Docs consistency

Three descriptions of V5's starting state, written at three times. **The
measurement wins, and the measurement is `heights.json`.**

`node scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json`
on `main` today: *guarded screen heights equal the baseline to the pixel.*

| field | measured today | prompt expected |
|---|---|---|
| `battle.decisionTop` | **681.5** | 681.5 ✓ |
| `battle.decisionBottom` | **947.5** | 947.5 ✓ |
| `battle.scrollHeight` | **1376** | 1376 ✓ |
| `battle.screenHeight` | 1182.5 | — |
| `battle.decisionCount` | 4 | — |
| `map.decisionTop` / `decisionBottom` | 614.5 / 728.22 | — |
| `map.screenHeight` / `scrollHeight` | 976.69 / 1170 | — |

Disagreements found, all of them prose going stale rather than a number being
wrong:

1. **`docs/README.md` section 4 names the head of `main` as `f0c53f2`.** It is
   `f5c84fe`, two merges later — PR #16 and PR #17 both landed after that
   sentence was written. Not corrected here: amendment A7 keeps section 4 out of
   this branch, and section 4 is explicitly a file "expected to go stale".
2. **`docs/README.md` open item 7 says the fourth move button ends at 946.5 and
   the budget is missed by 206.5px.** It ends at **947.5** and the miss is
   **207.5px**. R12's one pixel, recorded in `generation.md` §12c and in the
   baseline README's R12 correction, has not reached open item 7.
3. **The audit's 1290.5 is right for the tree it was taken on and is not the
   starting height.** It is an element-by-element sum at `9296ba7`, before
   Release C and R12. Release C's strip added 36 and R12's badge added 1, so the
   same sum on this tree is **1327.5** — which is what §12c predicts in its
   closing line, against the 1326.5 the R12 amendment named. Neither figure is
   `scrollHeight`; the document scroll height is 1376.

**Use `heights.json`.** V5.1 re-measures element by element anyway, as the plan
requires and as amendment A2 repeats.

### 0e. Open decisions that move the baseline

**Neither has been answered since the audit. V5 proceeds on the current font.**

- **V0.5 `--font-body`.** `src/ui/theme/tokens.css` still reads
  `--font-body: var(--font-mono-stack);` with the morning-decision comment above
  it intact. The only two commits to touch that file since the audit
  (`ac3bbda`) are Release C steps 2 and 3, and both add motion tokens.
- **V3.6 performance check.** `docs/visual/reports/V3.md` morning decision 1
  still asks for a trace on a real phone; nothing has been recorded against it,
  and there is no `docs/visual/state/V5.done`.

**`--font-body` remains a separate pass, before V5 or after it, never inside
it.** Swapping it widens every number and every label on both guarded screens,
which would land a font change and a layout change in one baseline re-record
with no way to attribute either.

---

## V5.1 Measure — the before table

Seed `SMOKE24`, first battle, headless Chromium at 390x844, pointer parked, the
same run and the same clicks `measure.mjs` takes. Every box from the top of the
document down. `.bench` is empty on this turn and `.panel__volatiles` is hidden
on both sides.

| # | Element | Top | Height |
|---|---|---|---|
| 1 | shell top padding | 0 | 24 |
| 2 | `header.header` (title 30, verbosity 26.5) | 24 | 64.5 |
| 3 | gap | 88.5 | 12 |
| 4 | `.shell__drawer-bar` | 100.5 | 32.5 |
| 5 | gap | 133 | 12 |
| 6 | `.battle__header` (title 25.5, blurb 19.5) | 145 | 47 |
| 7 | gap | 192 | 12 |
| 8 | **`.panel--foe`** | 204 | **239.25** |
| 9 | gap | 443.25 | 12 |
| 10 | **`.panel--me`** | 455.25 | **214.25** |
| 11 | gap | 669.5 | 12 |
| 12 | **`.moves`**, 2x2 | 681.5 | **266** |
| 13 | gap | 947.5 | 12 |
| 14 | `.bench` (empty this turn) | 959.5 | 0 |
| 15 | gap | 959.5 | 12 |
| 16 | **`.flags`**, the Release C strip | 971.5 | **24** |
| 17 | gap | 995.5 | 12 |
| 18 | **`.log`**, persistent, multi-line | 1007.5 | **320** |
| | **Total** | | **1327.5** |

`section.screen--battle` runs 145 → 1327.5, so `screenHeight` is **1182.5**.
Document `scrollHeight` is **1376** (1327.5 plus the shell's 48px bottom
padding, rounded up). Both agree with `heights.json` to the pixel, and 1327.5
is the figure `generation.md` §12c predicted this measurement would find.

Inside a panel, foe side: padding 11, header 46 (the name wraps under the
archetype chip on the foe side and does not on the player's — that is the whole
25px difference between the two panels), HP track 9, `.panel__meta` 20,
`.panel__traits` 18.5, `.stats` 89.75 as six rows of 18.69, padding 11.

Inside a move button: padding 11, `.move__name` 21, `.move__meta` **42 — two
lines**, `.move__tags` 13.5, `.move__pp` 16.5, padding. Buttons are 176 wide
with 150 of usable face, 130 tall, in two rows with a 6px gap.

**Are the four move buttons above the fold? No.** Row 1 is 681.5..811.5 and
fully visible; row 2 is 817.5..947.5 and is cut at 844, showing 26.5px of a
130px button. `decisionBottom` is **103.5px below the 844 fold** and **207.5px
below the 740 usable line**.

### The reading the budget forces: the panels overlay the scene

The plan's budget table lists the opponent panel (56), the scene with both
sprites (260) and the player panel (64) as three rows summing with the rest to
584. Read as three stacked bands the arithmetic does not close, and it fails on
the gate that matters rather than on the one that is cosmetic:

> stacked — `.battle__header` 47 + gap 12 + scene 260 + gap 12 + opponent 56 +
> player 64 + strip 36 + grid 128 = 615 inside the screen, and the grid then
> opens at y=632 and closes at **y=760**, past the 740 line the same table says
> it clears by 156.

Read as the plan's own sentence says — *"stat panels float over the scene with
no chrome"*, Reference B, text on a scrim rather than a card — the two panels
are **inside** the 260, not above and below it, and 56 + 64 = 120 of overlay
sits comfortably in it. Then:

> overlaid — `.battle__header` 47 + gap 12 + scene 260 + gap 12 + strip 24 +
> gap 12 + grid = **367 + grid** inside the screen, the grid opens at
> **y=512**, and both gates become one number.

**Both gates are the move grid, and they are 5px apart.** `screenHeight ≤ 600`
wants a grid at or under **233**; `decisionBottom ≤ 740` (amendment A3, gating
on `decisionTop` at or above 740 minus the grid) wants **228**. The fold is the
tighter of the two, so 228 is the number.

Recorded as a reading rather than a deviation because it is what the plan's
prose says; the budget table is a list of the heights those elements have, and
only the stacked reading turns it into a claim about how they are stacked.

### The cuts, by number, before they are made

| # | Cut | From | To | Saves |
|---|---|---|---|---|
| 1 | The persistent log leaves the flow. History moves behind a tap on the strip; the strip stays where Release C put it. | 320 + 12 gap = **332** | 0 | **332** |
| 2 | Both panels lose the six-row stat block and stop being boxes. Stat *stages* return as V2 chips; nothing else on either panel is dropped. | 239.25 + 214.25 = **453.5** | overlaid on the scene | **453.5** |
| 3 | The scene band arrives, with both sprites and the two panels floating on it. | 0 | **260** | **−260** |
| 4 | The `.bench` row and its two gaps leave the scene's flow with the panels. | **24** | 0 | **24** |
| 5 | The move grid tightens **by margin and gap only** (amendment A6): the 44px target and the two-line `.move__meta` are untouched. | **266** | **≤228** | **≥38** |

Net against `screenHeight` 1182.5: −332 −453.5 −24 −38 +260 = **−587.5**,
landing at **595** with the grid at 228, under the 600 the plan asserts. The
grid then runs 512..740 and **all four buttons finish on the 740 line**.

Cut 5 is the one with no slack. 38px off a 266px grid is 19 off each row, and
A6 forbids taking it from the button's height directly — so it comes from the
button's 11px vertical padding and the 6px row gap, and the tag row on the face
is the fallback if padding alone does not reach. The band badge sits on the
second line of `.move__meta` and must not overhang: R12's smoke check watches
exactly that, and it stays green through every step below.


## V5.2 Log collapse — the strip is Release C's strip

**Cut 1, taken in full: −332.** `screenHeight` 1182.5 → **850.5**,
`scrollHeight` 1376 → 1044. The decision point did not move: the log sat below
the move grid, so its 320px plus one 12px board gap came off the bottom of the
screen rather than out from under the buttons. 681.5 and 947.5 are V5.3's and
V5.4's to move.

### There is one strip, and Release C built it

Amendment A1, and Release C's own comment predicted the shape of this change:
*"V5 replaces the multi-line log with a one-line event strip and reuses this for
its content. Rendering through the V2 chip component now means that swap is a
change of container, not a restyle."* It was. The chips are byte-identical —
same `flagChip`, same `data-side` mark, same words out of `data/flagWords.ts` —
and `.flags` gained two children beside them:

| child | what | where its words come from |
|---|---|---|
| `.flags__event` | the most recent action, in one line | `src/ui/copy/events.ts` |
| `.flags__words` | Release C's flag chips, unchanged | `src/data/flagWords.ts` |
| `.flags__history` | the tap that opens the log | — |

**No second reading of the protocol.** The event line comes off a `TurnAction`
the group the strip is already showing already carries — the same object the
log renders from and the jiggle orders by, from the screen's one
`createFlagReader`. `boundaries.test.ts` still finds exactly one reader in
`screens/battle.ts` and none in the scene or the log.

**The copy is under `ui/`, not `data/`.** `src/ui/copy/events.ts`, beside V4's
`copy/summary.ts`, for the reason the visual plan's rule 2 gives: `contentHash`
is computed over `data/`, and a word changed here must not move a seed.
`data-digest.txt` is byte identical after this step, which is the check that the
rule was actually followed. Release C's `data/flagWords.ts` moved that digest
when it landed and its report writes that up for the `contentHash` release; V5
does not add a second instance of it.

### The group the strip reports grew one clause

Release C picked the last group with flags or residual. V5 keeps that exactly —
so every word the strip printed before this stage it still prints — and adds a
fallback for the turn where nothing was flagged at all: the last group with any
actions, which is **the jiggle's own rule**. On such a turn the panel that
twitches and the name in the line are the same side by construction. Release C
showed an empty band there; V5 has a sentence for it.

### One line, and truncation that tells the truth

`flex-wrap: nowrap` on the strip, `overflow: hidden` on the row, and
`min-width: 0` on both the sentence and the word row so a flex item's default
refusal to shrink below its content cannot push the history control off the
end. The sentence is written in full and clipped with an ellipsis; the sheet
has all of it. A wording cut to fit 390 would be cut on every viewport, so
nothing is shortened before it is written.

The band is still 24px — `--space-6`, one chip's line box, what Release C set.
The history control is sized to fit the band rather than setting it; left on
`.button--small`'s padding it measured 26.5 and made the strip 2.5px taller,
which would have been V5 spending its own budget on furniture.

### The history sheet

`src/ui/log-sheet.ts`, on the party drawer's recipe and deliberately not a
second set of metrics: a phone has one place an overlay belongs. The log
renderer is untouched — `createBattleLog` is handed the sheet's container and
does not know it moved.

**It never opens on its own.** `open` has exactly one caller, the strip's
control, and it is a click handler. The control sits outside `.moves`, which is
the sharp case `ui/drawer.ts` names: a move button is a submission, and a
trigger inside the grid would be one keystroke from spending a turn.

`.log-sheet[hidden]` carries its own `display: none`. Third occurrence of that
guard in the stylesheet, and the two before it are both recorded as having been
caught by `npm run smoke` rather than by a unit test — `hidden` is a UA style
and any `display` rule beats it, so an overlay toggled with `hidden` and laid
out with `display: flex` is an invisible scrim eating every tap on the board.

### The board is one column now

The two-column grid existed because the persistent log sat beside the scene on a
wide screen and under it on a phone, and Release C needed named areas so
auto-placement did not drop its strip into the log's column. With the log gone
there is no second column to name: `.board` is a flex column of scene and strip,
same reading order the DOM already had, every viewport.

### Tests

New, `test/event-strip.test.ts` (jsdom, 10) and `test/visual-v5.test.ts`
(Chromium, 3). The plan's V5.2 tests are the two named ones:

- **Opening the sheet does not submit a move or advance the turn.** Asserted
  against a real session: no choice reaches `onChoose`, the engine emits no
  protocol, `viewFor('p1').turn` does not move, and the scene's `outerHTML` is
  byte-identical across the open. Plus the structural half — the control is not
  inside `.moves` — because that is a property of where the trigger sits rather
  than of what it does.
- **The strip never exceeds one line.** Measured in Chromium at 390x844 after a
  resolved turn: the strip is 24px, `flex-wrap` is `nowrap`, and every child
  begins and ends inside the band.

**Three existing checks moved with the log, and each is recorded rather than
absorbed.**

1. **`test/band.test.ts`, the overlay allowlist.** `src/ui/log-sheet.ts` is a
   fourth file that builds a dialog, and the list grows one deliberate line. It
   is the drawer's kind, not the band's: it asks nothing, submits nothing and
   resolves no pending decision. *The band is still the one overlay that carries
   a decision.* The list's whole value is that a fourth overlay cannot arrive
   without somebody writing down why.
2. **`scripts/visual/contrast.mjs`, the V1 legibility instrument.** It reads
   `.log-entry` on the battle screen, and the log is now behind a tap, so the
   locator waited for an element that would never become stable. The instrument
   opens the sheet **for that one reading and last**, rather than dropping the
   selector: a style behind a tap still has to meet the contrast rule, and it is
   read for longer than anything on the board. Last, because the sheet lays a
   scrim over the board and every selector above it would otherwise have been
   photographed through a dim overlay — a contrast number for a surface no
   player ever reads. A visibility guard went in beside it so a present-but-
   unrendered target is skipped rather than timing the run out.
3. **One Release C assertion, and it was about the same thing.**
   `battle-feedback.test.ts` asserted `strip.root.children.length === 0` after
   a clear, written when the strip's only children were its chips and
   "cleared" and "empty of elements" were one sentence. The strip now has
   permanent furniture, so the question is asked directly instead: after a
   clear there is no word and no sentence to read. A control that came and
   went with the turn would be unreachable on the screen where the opening
   switch-ins are the only thing that has happened. `data-empty` still means
   what it has always meant — whether there were flag words — and still holds
   the band's height.

### Gates at V5.2

Full suite **74 files, 948 tests, all pass** — the 935 floor plus 13 new: 10 in
`test/event-strip.test.ts`, 3 in `test/visual-v5.test.ts`. `tsc` and `eslint`
clean. `npm run smoke` exits 0 with the 4.7 map fold as its
only `xfail`, and every R12 check green: four buttons in a 2x2 grid, the 44px
target at 130, `4/4 damaging` carrying a band, `0 overhanging of 4`. Baseline
re-recorded in this commit. The move grid is now reported above the fold by the
smoke script (`moves end at y=748`) because that check measures within the
scrolled view; `heights.json` is the absolute ruler and still reads 947.5.

## V5.3 Sprites into the scene, panels floating

**Cuts 2, 3 and 4 taken, cut 6 paid: −217.5 net.** `screenHeight` 850.5 →
**633**, `scrollHeight` 1044 → **844**, and the decision point moves for the
first time this stage: `decisionTop` 681.5 → **476**, `decisionBottom` 947.5 →
**742**. The battle screen no longer scrolls at 390x844 — `scrollHeight` and the
fold are the same number.

| what | from | to |
|---|---|---|
| both panels, in the column | 239.25 + 214.25 | 0 — absolutely positioned inside the band |
| the stage band, with both sprites | 0 | **260** |
| the empty `.bench` and the gap it earned | 12 | 0 |

### Two sprites stand in a place

`.stage__actor--foe` upper right, `.stage__actor--me` lower left, over the V3
world that was already drawn behind every screen. No container: the actors are
children of `.stage` and carry no surface, no outline and no elevation of their
own. `spriteImg` from V4 resolves them through `@pkmn/img`, so nothing raster
ships in the repo — the plan's asset rule.

`p1` wears the back sprite and `p2` the front, which are **the protocol's own
sides**, so nothing in the scene translates between two vocabularies. Both are
96x96, the Gen 5 sprite's own size, so nothing is scaled and the pixels stay
crisp — and both are the *same* size, which is the visual-weight rule: a larger
sprite would be a larger Pokemon and nothing on this board says that.

The band's height is a token and fixed. A stage that grew when an image
finished loading would move the move grid under a thumb already descending, and
in a sandbox with no route to Showdown's CDN the box holds and the layout is
identical — which is what the measurements in this report were taken on.

### The panels float, and the budget only closes that way

Absolutely positioned inside the band, on a scrim, with no border, no raised
surface and no left rule. Each runs from its own edge of the band to where the
sprite opposite it begins — `calc(var(--sprite-size) + var(--space-2))` rather
than a percentage — so a panel cannot overlap a sprite even if either number
changes, and the text gets every pixel the sprite does not want.

**One rule for both sides.** The scrim, the blur, the padding, the radius and
the type are a single declaration applying to both panels; the only thing that
differs is which corner each sits in. A browser test compares fifteen computed
properties across the two and requires the strings to be equal, not similar.

### What this stage takes away, stated plainly

**The six-row stat block leaves both battle panels.** It cost 89.75px a panel
and printed a number for every stat on every turn whether or not anything had
happened to it. In its place, stat *stages* render as V2 chips — `Atk +2`,
`Spe -1` — and only when they are not zero, so the row is empty until the
battle has something to say. `stageChip` gained an optional stat label, because
`+2` on a mixed row does not say +2 of what; it is still one chip at one weight,
and `badge--up`/`badge--down` carry the sign, not an emphasis.

The speed marker moved onto that row rather than leaving with the block. It was
the one thing on the six rows that answered a question rather than stating a
number, it is a fact about the board as it stands — the same kind of fact as the
live effectiveness marker, which is the one exception the copy rule names — and
Stage 4.5's prompt asks for it by name.

**The consequence, and it is a real one: the opponent's exact stats are no
longer on the battle screen.** The player's are still one tap away in the party
drawer, which is reachable in a battle; the opponent's are now read off the
archetype label alone. This is the plan's own budget — its panel line is "name,
level, gender, HP bar plus number, status chip, stage chips", and 89.75px of
rows cannot fit inside 56 — so V5 takes it rather than reinterpreting.

**It would cost the budget nothing to give back**, and that is worth stating
because it makes this a free decision rather than a trade. The panels are
overlaid now, so their height does not reach the total at all: a collapsed
one-row six-value readout would add about 19px to a panel inside a 260px band
that has room, and change neither gate. That is exactly the shape
`gymrun-patch-restore-the-fold.md` step 3 describes, on the unmerged trim
branch, and it is the obvious answer if a playtest misses the numbers.

### Release C's HP bar is untouched

The track, the shadow-before-fill ordering, `markHpChunk`, the band colours and
the jiggle are the same code. `test/battle-feedback.test.ts` runs **unchanged**
and passes, which is the plan's instruction for this checkpoint.

### Tests

New: `test/battle-stage.test.ts` (jsdom, 9) and three more in
`test/visual-v5.test.ts` (Chromium). The sprites are in the stage with no box
and face the right way; the actor does not re-request an image on a turn that
changed nobody; there is no `.stats` and no `.stat__label` left in a battle; a
stage chip names its stat; the speed marker survived; Release C's two HP
children are still in their order. In the browser: one scrim across both panels
with fifteen computed properties identical, both sprites 96x96 in opposite
corners with neither panel overlapping the sprite across from it, and an empty
bench taking `display: none`.

### One instrument goes quiet, and it is recorded rather than absorbed

`scripts/visual/contrast.mjs` reads `.stat__label` and `.stat__value` on the
battle screen, and after this step neither exists there. Its loop skips a
selector it cannot find, so those two readings simply stop — and the V1 contrast
test skips a label with no reading, so nothing goes red. **This is a hole the
instrument already had**: its `map` list names five `.panel*` selectors and the
map screen has no `.panel` at all, so three readings have been skipping since
before V5. Both styles are still live on the party and drawer surfaces, which
the table does not walk. Naming the hole rather than papering over it: the fix
is a `party` walk in that script, and it is its own patch rather than V5's.

### Gates at V5.3

Full suite **75 files, 960 tests, all pass** — 948 plus 12: 9 in
`test/battle-stage.test.ts` and 3 more in `test/visual-v5.test.ts`. `tsc` and
`eslint` clean. `npm run smoke` exits 0 with the 4.7 map fold as its
only `xfail`; every R12 check green (4/4 damaging moves carry a band, 0
overhanging, 44px target at 130); `the move grid is above the fold` now reads
`moves end at y=742 of 844` and, because the page no longer scrolls, that is the
absolute number rather than a scrolled one. Baseline re-recorded in this commit.

**Both gates now rest on the move grid alone**, which is V5.4:
`screenHeight` 633 wants 33 off it, `decisionBottom` 742 wants 2 off it against
the fold and 38 against the 740 line. One cut answers all three.

## V5.4 Move grid — the last cut, and both gates close

**Cut 5 taken: −38.** `screenHeight` 633 → **595**, `decisionBottom` 742 →
**704**. `decisionTop` and `scrollHeight` do not move: the screen already fitted
the viewport at V5.3, and everything this step removes is inside the grid.

| gate | target | measured |
|---|---|---|
| `battle.screenHeight` (plan test 1) | ≤ 600 | **595** |
| `battle.decisionBottom` (A3, the 740 line) | ≤ 740 | **704** |
| `battle.decisionTop` (A3 gates on this) | ≤ 740 − 228 = 512 | **476** |
| `scrollHeight` against the fold | ≤ 844 | **844** |
| move button height (44px target) | ≥ 44 | **111** |
| band badges overhanging their face (R12) | 0 | **0** |

### Tightened by margin and gap, and by nothing else

Amendment A6 names the failure mode exactly: the band badge sits on the second
line of `.move__meta`, so a grid squeezed by shrinking the button is a grid
where R12's smoke check goes red first. So the 38 came from the two things on
the control that carry no information —

| what | from | to | per button |
|---|---|---|---|
| `.move` vertical padding | `--space-2h` (10) | `--space-1h` (6) | −8 |
| the three gaps inside a button | 5 | `--space-h` (2) | −9 |
| the gap inside `.move__meta` | `--space-1h` (6) | `--space-1` (4) | −2 |
| the grid's own row gap | `--space-2` (8) | `--space-1h` (6) | −2 (once) |

— and a button reads 111 with its two-line meta intact.

**Scoped to `.moves`.** The reward offer and the replacement screen draw the
same component through `moveFacts` and are not under a vertical budget; a card
there losing 4px of air would be paying for a fold it is nowhere near. Part 5's
rule is that a move shows the same *facts* everywhere, and it still does — the
battle button already differs in carrying live PP and an effectiveness marker.

### The composition fix that came with it

Two panels at 145 do not fit in a 260 band, and at V5.3 they overlapped by 30px
— the player's panel sat on top of the opponent's lower corner and hid a chip.
Two things caused it and both are fixed here:

1. **The header wrapped.** `Opposing Mudbray Lv22 ♂` plus a `PHYS. ATTACKER`
   chip is wider than the 254 a floating panel gets, so every panel spent a
   second line on it. The archetype chip and the type badges are chips, and the
   panel has a row for chips: they moved there, in reading order — what it is,
   what it is built for, what it is carrying, what is happening to it, what the
   board has done to it. Fixed properties first, the turn's own facts last, so a
   row that grows mid-fight grows at the end.
2. **Stage 4.7's `@media` rule was still winning.** `.shell[data-phase='running']
   .panel { padding: …; gap: … }` is specificity (0,2,1) against `.stage
   .panel`'s (0,2,0), so the floating panels were quietly wearing 4.7's metrics
   — 10px padding and a 6px gap where the stage asks for 6 and 2. Its stated
   purpose was "so the two of them plus the move grid fit without scrolling",
   which is the question V5 has now answered a different way, and the rule
   beside it squeezed a `.stats` block that no longer exists in a battle.
   **Deleted, not narrowed**: a superseded rule is deleted, and a floating
   panel's metrics now live in one place.

Panels read **121** each with 18px of clear air between them.

### Test 4, as amendment A4 rewrites it

The plan asked for "an effectiveness chip renders on every button". The tree
deliberately does the opposite, and says so at the bottom of `renderMove`: *"a
row where every button carries a badge is a row where the badges stop being
read, and the 0x goes unread with them."* The audit found that collision; A4
resolves it as **sameness rather than presence**, and the neutral suppression
stays byte-for-byte unchanged.

Asserted in both places it can be:

- **jsdom** — Alakazam into Golem gives one of each reading: Psychic 1x
  (suppressed), Surf 4x, Thunderbolt 0x, Body Slam 0.5x. Three markers across
  three different bands, one class list between them
  (`chip chip--effect badge badge--effect`), no inline style, and `data-band`
  the only thing that differs — a hook, not a style.
- **Chromium** — every rendered marker has one computed font size, one weight,
  one box height and one colour, and each one's ink is measured against a
  neutral chip's on the same screen and is **not brighter**. Relative luminance,
  the same formula the V1 contrast instrument uses.

The `[data-ability="true"]` outline survives untouched: a 0x with no reason
attached reads as a bug, and tapping the marker still answers "because
Levitate".

### Gates at V5.4

Full suite **75 files, 965 tests, all pass** — 960 plus 5: 3 more in
`test/battle-stage.test.ts`, 2 more in `test/visual-v5.test.ts`. `tsc` and
`eslint` clean. `npm run smoke` exits 0 with the 4.7 map fold as its
only `xfail`; `move buttons meet the 44px touch target (111px)`, `every damaging
move button shows its band (4/4)`, `no band badge overhangs its move button (0
of 4)`, and `the move grid is above the fold (moves end at y=704 of 844)` — an
absolute number now, because the screen does not scroll. Baseline re-recorded in
this commit.

### The V0 marker came off, the way it was designed to

`test/visual-v0.test.ts` has carried `it.fails('ends both decision points above
y=740 at 390x844')` since V0, with a comment ending:

> the marker stays until something decides about the rows that predate the
> stage: the battle heading, the two Pokemon panels, and the move grid itself.
> The day the number reaches 740 vitest reports the `fails` as an error and the
> marker comes off. That is still the intended way to notice.

That is exactly what happened at V5.4. The full suite went red on a test that
was supposed to fail and did not, because the battle's fourth move button now
ends at **704** and the map's last offered card at **728.22**. It is a real
assertion from here, and open item 7 in `docs/README.md` is closed with the
numbers.

V5 spent all three rows the marker named: the battle heading is the only one
still standing, the log left the board at V5.2, the two panels left the column
at V5.3, and the grid tightened at V5.4.

**The SMOKE24 map `xfail` is a different check and stays.** It measures the
offered cards against the 844 fold in the scrolled view rather than against the
740 usable line, and still reports `y=869`. Release C's own note in
`docs/reports/release-c-battle-feedback.md` §0 is explicit that the two markers
are different findings waiting on different work, and V5 touched only the battle
screen.
