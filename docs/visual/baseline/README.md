# Visual identity baseline

Recorded from the untouched tree before Stage V0, by three instruments. Every
visual stage diffs against this directory and never regenerates it.

| file | written by | what it holds |
|---|---|---|
| `runs/<seed>.json` | `scripts/visual/baseline.ts --write` | A headless run under the scripted greedy policy: decision log, outcome, every visit, every casualty, the final party. |
| `battles/GYMRUN01.json` | same | The determinism seed's battle protocol, nondeterministic lines stripped. |
| `data-digest.txt` | same | sha256 over every file under `src/data/`. Not `contentHash`, which is its own release. |
| `heights.json` | `scripts/visual/measure.mjs --out` | The two guarded screens at 390x844 on SMOKE24: layout height, scroll height, and the decision point's top and bottom edges. Detailed at the top level; Simple and Pocket under `modes` (density modes patch). |
| `bundle.json` | `scripts/visual/bundle.mjs --out` | Every file in `dist/`, raw and gzipped. |

`test/visual-baseline.test.ts` replays the runs and the battle under `npm test`
and fails on any byte that differs. Heights are compared by
`scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json` after
`npm run build`, and each stage's done marker records the delta from this file.

## Corrections

- **2026-09-25, patch 4.10.1, map node icons** (D46). `heights.json` alone;
  runs, the battle protocol and the digest are untouched because nothing under
  `core/` changed and no version axis moved.

  **The map grew one row: 705.72 to 743.97 in Detailed, 475.19 to 513.44 in
  Pocket, 38.25px in each.** That is the tier pips moving from the kind's label
  line to a row of their own beneath the mark, which is the prompt's one
  instruction about the tier, plus a 24px mark where a line of text stood.
  `decisionTop` is unmoved in Detailed (558) and Pocket (286.97);
  `decisionBottom` follows the row down (612.34 to 624.72, 333.31 to 345.69),
  and the Pocket no-scroll gate and the 740 line both still pass. **The battle
  screen fell 9.5px** in Detailed (595 to 585.5): the header's title is the
  same mark at 16 beside a name on a gym and alone otherwise, which is shorter
  than the two-word title it replaces.

  **The `modes` and `layouts` blocks had been stale since before this patch.**
  Measured on the unchanged tree first, the Detailed and Simple map rows under
  `layouts.columns` read 944.5 and 866.75 against a measured 705.72 and 657.66,
  and every Pocket row was off by more than a hundred pixels. The guard reads
  the top-level `map` and `battle` only, so nothing had failed. They are
  re-recorded here with the rest of the file rather than left, and the one
  test that would have caught it is open item for the next patch that touches
  the guard.

- **2026-09-18, the wild-encounter swap fix** (`ai-7-tiers-reach-the-app`).
  Re-recorded on the runs and the battle protocol, and the diff is **twelve
  lines, every one of them a version stamp**: `versions.ai` in six run files and
  the `aiVersion` inside each one's recorded log. Nothing else in this directory
  moved — not a decision, not a visit, not a casualty, not the protocol, not the
  data digest.

  That is the point of recording it. The patch removes `opponent:
  greedyAiPolicy` from the app's run options, so the shipped game stops playing
  `GREEDY_BASELINE` in every fight and starts reading the tier table; this
  script pins that same policy **deliberately**, because the baseline is a
  frozen record rather than a picture of what ships. So the fix cannot move a
  byte here, and it did not. `AI_VERSION` moves with it, which is the whole of
  the diff.

- **2026-09-17, the merge of the chip audit into the shop and moveset-variance
  patch.** `heights.json` re-recorded a second time that day, and the reason is
  an *interaction* rather than either patch: **neither branch moved the battle
  screen this far on its own.**

  On `main`, the chip audit added a type icon to the move buttons and did not
  move `heights.json` at all. On this branch, the moveset-variance change made
  the battle screen 5.5px *shorter*, because SMOKE24's lead draws different
  moves now and the names cost one line less. Merged, the new icons land on
  those different move names and the screen goes to **610.5**, +21 over this
  branch's own 589.5 and +15.5 over main's 595. A patch that re-recorded against
  either parent alone would have recorded a number the merged tree does not
  produce.

  **`decisionTop` is unmoved in every mode and every layout** — 472, 445.44,
  355.39 — and **the map did not move on any field**. `decisionBottom` follows
  the height down the column: 702.5 to 723.5 Detailed, 668.44 to 689.44 Simple,
  494.39 to 515.39 Pocket. Pocket's own gate is a document `scrollHeight` at or
  under 844 and is nowhere near it.

  **What this spends is budget headroom, and it is the number to watch.**
  `test/visual-v0.test.ts` holds both decision points at or above y=740. The
  battle screen's margin was 37.5px on this branch alone and is **16.5px** now
  (723.5 against 740); the map's is 52.44px. The assertion passes and is a real
  assertion — see open item 7 — but the next patch that adds a row to a move
  button will hit it, and this entry is where the next reader finds out why the
  slack went.

- **2026-09-17, the shop and moveset-variance patch** (`randomizer-18`,
  `contentHash` `fd9b5e`). Re-recorded on all three instruments, and the two
  halves are independent as usual.

  **Runs, the battle protocol and the digest moved wholesale**, which is the
  generation change rather than a layout one: the forced STAB slot now draws
  from its band *and the one above* (`MOVESET.stabWindow`), segments 0-2 stopped
  drawing from band 1 alone, and a shop shelf became a fixed list of guaranteed
  category slots. Every seed rolls different moves and every shop stocks
  different rows, so every recorded run differs.

  **`heights.json`: the battle screen fell 5.5px** in Detailed (595 to 589.5)
  and in Simple (577.44 to 571.94), with `decisionBottom` following it down
  (708 to 702.5, 673.94 to 668.44). **`decisionTop` is unmoved in every mode and
  every layout** — 472, 445.44, 355.39 — which is what the guard is for, and
  **the map did not move on any field**. Pocket did not move either. The 5.5px
  is content under the same layout: SMOKE24's lead draws a different move and
  its name costs one line less in the fact strip. It moves *toward* the 390x844
  budget rather than away from it, so `test/visual-v0.test.ts`'s 740 line is not
  at risk.

- **2026-09-15, Stage 4.9, the pool.** Re-recorded on all three instruments
  because the species pool was regenerated (`randomizer-16`: 635 to 900
  species with `Past` admitted, plus the evolution graph on every entry), so
  every seed rolls different Pokemon. **Every run file, the battle protocol
  and the digest moved wholesale**; that is the regeneration, not a layout
  change. **`heights.json`: `decisionTop` is unmoved in every mode and every
  layout** (558 / 513.44 / 278.89 on the map, 472 / 445.44 / 355.39 in
  battle), which is what the guard is for. What moved is content under the
  same layout: SMOKE24's map grew 67.88px in every mode (861.78 to 929.66
  Detailed) because the offered nodes' wild species and their text changed,
  and the battle screen moved with the new lead's move names. Re-recorded
  once more at the stage's curve commit (`randomizer-16`'s band-weighted,
  stage-gated, no-repeat draw and the 7-to-55 curve), the same way: runs,
  battle, digest and heights all moved as content, `decisionTop` unmoved in
  every mode and layout.

- **2026-09-14, the playtest patch** (event rewards and move card fields).
  Re-recorded on both instruments, and the two halves are independent.
  **`heights.json`: the battle screen fell 41px** in Detailed (595 to 554) and
  in Simple (577.44 to 536.44), with `decisionBottom` following it down (708 to
  667, 673.94 to 632.94) and **`decisionTop` unmoved in all three modes** — 472,
  445.44, 355.39. Pocket did not move on any field, and neither did the map.
  The height came off the move buttons: the band badge and the effectiveness
  marker left `.move__meta`, which wraps, for the fixed-column fact line, so
  the wrapped line they were causing is gone. **The runs and the digest moved by
  the version stamp and nothing else**: every decision in all six runs is byte
  identical, as are the outcomes, the gyms cleared, the currency and the relics
  held, and the recorded battle protocol is byte identical — the only key that moved
  in any run file is `log.versions`, carrying `runLog` `-15` and `randomizer`
  `-15`, and `data-digest.txt` moved with `contentHash` to `53145f`.
  `generation.md` section 15 has both tables and the reason the runs held still.

- **2026-09-11, the density modes patch.** `heights.json` gained a `modes`
  axis: the same two screens, the same seed, in Simple and Pocket, under
  `modes.simple` and `modes.pocket`. **The Detailed entries did not move**:
  map 840.41 / 1033 / 558..672.72 and battle 599 / 844 / 472..712, to the
  hundredth, on every commit of the patch. The two mode columns were placed
  as copies of Detailed at step 2 (the rename, no layout) and re-recorded at
  step 4: Simple map 777.5 / 940, battle 581.44 / 844; Pocket map 586.95 /
  844, battle 481.89 / 844. `measure.mjs --compare` reads all three. Runs,
  the battle protocol and the digest are unchanged: the patch is
  presentation only and `test/density.test.ts` replays SMOKE24 in all three
  modes against one log.

- **2026-09-14, 4.8.0.3.** Re-recorded for two reasons at once, and they must
  not be confused. **The patch's own effect is −4px** on
  `battle.screenHeight` and `battle.decisionBottom` in all three modes, from
  the move fact strip and the band meter; `decisionTop` is unmoved in every
  mode, which is what the prompt gated on. **Four Pocket fields were already
  stale before the patch**: measured on merged main at `46b5978` with nothing
  applied, `modes.pocket.map.decisionTop` is 278.89 (file said 302.89),
  `modes.pocket.map.decisionBottom` 370.77 (394.77),
  `modes.pocket.battle.decisionTop` 355.39 (379.39) and
  `modes.pocket.battle.decisionBottom` 498.39 (522.39) — 24px out on each. That
  correction is its own commit (`46135b6`) so the two are not read as one. That
  drift belongs to whatever landed between the last recording and `46b5978`,
  not here. `generation.md` section 12n has both tables and how the two were
  told apart, which took three builds: a delta against a recorded file is not
  a delta against the tree.

- **2026-09-11, 4.8.0.1.** An independent confirmation of PR #24's re-record,
  not a second one: this branch was cut from `0712032`, found the same stale map
  entries and digest, re-recorded them, and PR #24 landed the same numbers on
  `main` first; the merge keeps `main`'s. 4.8 had pinned `map.screenHeight` 836.41, `scrollHeight`
  1029, `decisionTop` 556 and `decisionBottom` 669.72 on a tree without 4.7.2's
  font swap (12e) or chip floor (12f); `main` with both measures **810.72**,
  **1004**, **558** and **643.03**, and so does the 4.8.0.1 branch, to the
  hundredth. The digest is likewise 4.8's over a `src/data/` that 4.7.2's two
  tuning floors had changed. **The battle did not move**: `decisionTop` 472,
  `decisionBottom` 712, `screenHeight` 599, `scrollHeight` 844, on `main` and on
  the branch. Runs, the battle protocol and the casualty lists were byte
  identical throughout. `generation.md` section 12i has the table and the
  measurement method.

- **2026-09-10, V1.** `heights.json` `battle.decisionTop` corrected from 611 to
  612. The V0.0 recording left the pointer where the last click landed, on the
  first move button, whose hover state lifts it by one pixel. The driver now
  parks the pointer before every measurement, and the untouched V0.0 build
  re-measured with the parked pointer reads 612. No layout changed; the ruler
  did. Every other number re-measured identical.
- **2026-09-10, after PR #10 and PR #12 merged into the branch.** Every file
  re-recorded from the merged tree with no visual change on top (the same
  thing V0.0 did). `main` moved seeded output (the keyed-stream port) and
  `src/data/` (`tierInfo.ts`, 4.7's display tables), so the runs and the
  digest differ from the first recording. **The guarded heights moved too,
  and it is 4.7's layout, not the visual stages':** the drawer bar above every
  decision surface and the archetype chip on every panel put the map's
  decision point at 614.5..728.22 (was 570..654.03) and the battle's four move
  buttons at 681.5..950.5 (was 612..840). The move grid now ends 106px below
  the 844 fold. The plan's vertical budget, "four move buttons above the
  fold", does not hold on this tree, and V5's before table starts from here.
- **2026-09-10, Release C item 3.** `heights.json` battle entries re-recorded in
  the commit that moved them, which is the one that added the flag strip:
  `battle.screenHeight` 1145.5 → 1181.5 and `scrollHeight` 1339 → 1375. The
  whole 36px is the strip's own band (`--space-6`, held whether or not the turn
  had anything to report) plus one `.board` gap. **The decision point did not
  move**: `decisionTop` 681.5 and `decisionBottom` 946.5 are unchanged, because
  the strip is placed under `.scene` in the board grid and the move buttons are
  inside `.scene`. V5's fold budget starts from the same numbers it did before.
  Runs, the battle protocol and the map are all unchanged.

  `data-digest.txt` moved one commit earlier, when `src/data/flagWords.ts` was
  added. Nothing else in the baseline moved with it — seeded output is byte
  identical — and the fact that a pure display table moves a digest computed
  over `src/data/**` is written up in
  [`../../reports/release-c-battle-feedback.md`](../../reports/release-c-battle-feedback.md)
  for the `contentHash` release.

- **2026-09-10, later the same day.** `heights.json` battle entries re-recorded
  after the archetype chip lost 4.7's own `border` and took the `.chip` recipe
  (an inset shadow, which costs no layout): each battle panel header is 2px
  shorter, so `battle.screenHeight` 1149.5 → 1145.5, `scrollHeight` 1343 →
  1339, `decisionBottom` 950.5 → 946.5. The map did not move. Runs and the
  digest are unchanged.

- **2026-09-10, R12.** `heights.json` battle entries re-recorded in the commit
  that moved them, which is the one that put the `BAND n` badge on every move
  card: `battle.screenHeight` 1181.5 → 1182.5, `scrollHeight` 1375 → 1376,
  `decisionBottom` 946.5 → 947.5. **The decision point did not move**:
  `decisionTop` is 681.5, and `decisionCount` is still 4.

  One pixel, and the reason it is one and not twenty-four: `.move__meta` was
  already wrapping to two lines before this stage, so the badge joined the
  second line rather than starting a third. Measured at 390x844 on SMOKE24, a
  move button is 176 wide with 150 of usable face; line one holds the type
  chip, the category badge and `NN BP` in about 126 of it, and the band chip is
  45.9 wide and 19 tall against the 17 and 18.5 of the chips beside it. That
  0.5 is the whole delta — twice, once per grid row — and it lands on the move
  grid alone: `.moves` 265 → 266, each button 129.5 → 130, and the flag strip
  and log below simply shift down with it.

  Nothing else was touched. The 44px minimum target is untouched at 130, the
  2x2 grid still fills the width at two 176-wide columns, and the badge is
  absent from the fourth button on this turn because that move is a status
  move with no bracket. **The map did not move**, on any of its five fields.
  Runs, the battle protocol and `data-digest.txt` are byte identical — R12
  changed no file under `src/data/`, and the projection field it added
  (`MoveUiView.powerBand`) is not recorded by `baseline.ts`, which serializes
  run state and protocol rather than the view.

- **2026-09-10, Stage 4.8 step 2.** `runs/` and `data-digest.txt` re-recorded.
  **Not a visual stage, and that is the whole reason this entry exists.** This
  file's rule is that every visual stage diffs against this directory and never
  regenerates it, because a presentation change cannot move these bytes. Stage 4.8
  item 1 is a content change that moves them on purpose: party slots became a
  function of gyms cleared, `scaling.expectedPartySize` reads that schedule as its
  cap, and opponent team sizes are a function of the result — so seeded output
  moves and `RANDOMIZER_VERSION` goes to `gymrun-randomizer-13` in the same
  commit. The precedent is the PR #10/#12 entry above, where `main` moving seeded
  output was handled the same way.

  **Three of the six runs changed only the version stamp, and that is the finding
  rather than a footnote.** `SEED-B` clears no gyms, `GYMRUN01` and `SEED-A` clear
  one; the first slot unlock is at gym 2, so the schedule cannot reach them — and
  it did not, to the byte. The three that moved all clear three or four gyms:

  | run | gyms | party before | party after |
  |---|---|---|---|
  | `SEED-B` | 0 | 1 | 1 (version stamp only) |
  | `GYMRUN01` | 1 | 3 | 3 (version stamp only) |
  | `SEED-A` | 1 | 3 | 3 (version stamp only) |
  | `RESULT-1` | 3 | 3 | 4 |
  | `SMOKE24` | 4 | 3 | 5 |
  | `RESULT-0` | 4 | 3 | 5 |

  Re-recorded once more in the same step after `EXPECTED_PARTY_SIZE`'s last row
  came down from 6 to 5 — see `../../generation.md` section 7b: a curve that
  assumed the engine's own six-a-side limit left the tier clamp no headroom and
  flattened every tier onto one team size at the final segment. The run figures
  above are the shipped ones.

  `test/fixtures/sim-report.json` says the same thing independently: of its three
  seeds, `FIXTURE-BRAVO` dies at gym 1 and is byte identical, and the two that
  clear past gym 2 field five where they fielded three. Two instruments, the same
  boundary.

  `data-digest.txt` moves because `src/data/partyTuning.ts`, `scaling.ts` and
  `tuning.ts` all changed. **`heights.json` is not re-recorded and must not be**:
  step 2 is a no-UI step and the one thing it touches on a screen is the party
  header reading live slots instead of a constant, which at the opening width is
  the same `3 / 3` it printed before. The map's next-unlock readout item 1 asks
  for is step 7's, with the rest of the UI. `bundle.json` is not re-recorded
  either, per this file's own rule.

- **2026-09-10, Stage 4.8 step 3.** `runs/`, `battles/` and `data-digest.txt`
  re-recorded again, same reasoning as the step 2 entry above: a content stage that
  moves seeded output on purpose, under the same `gymrun-randomizer-13`.

  Two changes reach the draws. Item 2 makes a gym pay a guaranteed move *and* a
  two-card choice from the one gym stream, so every gym's roll moves; item 3 makes
  `stepsPerSegment` a per-segment curve, so the number of steps — and therefore
  every node after the first — moves from segment 2 on. `RESULT-1` drops from three
  gyms to one, which is the curve: a longer segment 2 is more nodes to survive
  before gym 3, and this run does not.

  `heights.json` is again **not** re-recorded. Step 3 is a no-UI step; the taller
  map is item 3's UI work, in step 7, and that is where the guarded heights move.
  `bundle.json` is not re-recorded either, per this file's own rule.

- **2026-09-10, Stage 4.8 steps 4 and 5.** `data-digest.txt` re-recorded; the runs
  moved only by gaining nicknames. Two new files under `src/data/` — `scoring.ts`
  (the score weights) and `nicknames.ts` (the name pool) — so the digest over
  `src/data/**` moves even though neither changes a draw. That a pure table moves
  this digest is the same note Release C made about `flagWords.ts`, and it is on the
  `contentHash` release's list.

  The runs themselves change because every Pokemon now carries a nickname, which
  `baseline.ts` serializes as part of the final party. **No draw moved for it**: the
  nickname key is new, so it shifts no other key's output, and that is the property
  the keyed refactor was built to buy. `heights.json` and `bundle.json` are not
  re-recorded; neither step touches a pixel.

- **2026-09-10, Stage 4.8 step 7.** `heights.json` **map** entries re-recorded, in
  the commit that moved them, which is the one that closed the map's fold `xfail`:
  `map.screenHeight` 976.69 → **819.19**, `scrollHeight` 1170 → **1012**,
  `decisionTop` 614.5 → **513.5**, `decisionBottom` 728.22 → **627.22**.
  `decisionCount` is still 2. **The battle did not move**, on any of its five
  fields — step 7 touches nothing inside a fight.

  101 pixels off the decision point, and they came from two places rather than from
  shaving a margin:

  - **The steps already taken collapse to one line** instead of one card each. That
    is worth more than its pixel count, because it changes the *shape* of the
    problem: the current step no longer moves down the page as a segment is walked,
    so the fix holds at item 3's longest segment rather than only at today's length.
  - **The map's party cards lost their move lists and abilities** and went into a
    two-column grid. Item 1 took the roster to six, which had made that panel 697px
    of a 844px screen; it measures ~320px now. PP and abilities are one tap away in
    the drawer, which is reachable from this screen and every other.

  This is the event `test/visual-v0.test.ts` and `scripts/smoke.mjs` were both
  waiting on since Release C — the map's rows being taken back. The smoke check
  reports `cards end at y=768 of 844` at its own deeper point in the run, and its
  `xfail` marker is removed rather than moved, per the prompt. `bundle.json` is not
  re-recorded, per this file's own rule.

- **2026-09-11, Stage 4.8 review follow-up.** `runs/` re-recorded. `Casualty` gained a
  `level` field, captured at faint time from the specs the battle was built with, and
  `baseline.ts` serializes each visit's casualties whole — so every run that lost a
  Pokemon gains one number per death. **No draw moved**: the level is read off a spec
  the battle already had, it consumes no RNG, and the decision logs are byte identical.
  `data-digest.txt`, `heights.json` and `bundle.json` are unchanged — the change is in
  `src/core/`, touches no file under `src/data/`, and moves no pixel.

- **2026-09-10, V5.2.** `heights.json` battle entries re-recorded in the commit
  that moved them, which is the one that took the persistent log off the board:
  `battle.screenHeight` 1182.5 → **850.5** and `scrollHeight` 1376 → **1044**.
  **The decision point did not move**: `decisionTop` is 681.5, `decisionBottom`
  947.5, `decisionCount` 4, all unchanged, because the log sat *below* the move
  grid and removing it takes height off the bottom of the screen rather than out
  from under the buttons. The fold is V5.3's and V5.4's to move.

  332 exactly, and it is the log's 320 plus the one `.board` gap that separated
  it from the strip. The strip itself is unmoved at 24 (`--space-6`, one chip's
  line box): the history control it gained is sized to the band rather than
  setting it, which is deliberate — a control that made the strip 26.5 tall
  would have been V5 spending its own budget on furniture. The board went from a
  two-column grid to a one-column flex column in the same change, because with
  the log gone there is no second column to name.

  **The map did not move**, on any of its five fields. Runs, the battle protocol
  and `data-digest.txt` are byte identical: V5.2 changed no file under
  `src/data/`, and the one new copy module is `src/ui/copy/events.ts`, which is
  under `ui/` for exactly that reason.

- **2026-09-10, V5.3.** `heights.json` battle entries re-recorded in the commit
  that moved them, which is the one that put the sprites in the scene and the
  panels on top of it: `battle.screenHeight` 850.5 → **633**, `scrollHeight`
  1044 → **844**, `decisionTop` 681.5 → **476**, `decisionBottom` 947.5 →
  **742**. `decisionCount` is still 4. **This is the first recording in which
  the battle screen does not scroll**: 844 is the viewport, so `scrollHeight`
  and the fold are now the same number.

  Where the 217.5 came from, and it is three things rather than one. The two
  panels left the column and became absolutely positioned inside a 260px stage
  band, so their 239.25 and 214.25 stopped contributing anything to the flow
  (−453.5, +260 for the band). The six-row stat block left both panels with
  them. And the empty `.bench` took `display: none`, which took the flex gap it
  was still earning (−12).

  **The decision point moved for the first time in this stage**, by 205.5, and
  every pixel of it is above the move grid rather than inside it: `.moves` is
  still 266 tall and its four buttons still 130. V5.4 is the one that touches
  the grid.

  **The map did not move**, on any of its five fields. Runs, the battle protocol
  and `data-digest.txt` are byte identical.

- **2026-09-10, V5.4.** `heights.json` battle entries re-recorded in the commit
  that moved them, which is the one that tightened the move grid:
  `battle.screenHeight` 633 → **595**, `decisionBottom` 742 → **704**.
  `scrollHeight` is unchanged at **844** because the screen already fitted the
  viewport at V5.3; `decisionTop` is unchanged at **476** and `decisionCount` is
  still 4.

  38 exactly, and none of it came off the touch target. `.moves` is 228 and a
  button is 111 — the 44px minimum is untouched, `.move__meta` still wraps to
  two lines and the band badge still sits on the second of them with nothing
  overhanging. What came out is 8px of vertical padding, 9px across the three
  internal gaps and 2px inside the meta row, per button, plus 2 off the grid's
  own row gap. Amendment A6's rule, followed literally.

  A second thing moved in the same commit and did not change any of the five
  numbers: the archetype chip and the type badges left the panel header for the
  panel's chip row. On a floating panel 254 wide the header wrapped to a second
  line, and both panels grew to 145 — enough that they overlapped each other
  inside the 260 band. They read 121 now, with 18px of clear air between them.
  Stage 4.7's `@media` rule holding both battle panels at its own padding and
  gap was retired at the same time; it was winning on specificity over the
  floating panel's own metrics, and the rule beside it referred to a `.stats`
  block that no longer exists in a battle.

  **The map did not move**, on any of its five fields. Runs, the battle protocol
  and `data-digest.txt` are byte identical.

**Both guarded assertions now hold on the battle screen for the first time in
this project's history**: layout height 595 against the plan's 600, and all four
move buttons ending at 704 against the 740 usable line, on a screen whose
`scrollHeight` equals the 844 viewport.

- **2026-09-10, V5.6.** `heights.json` battle entries re-recorded a fourth and
  last time in this stage: `battle.screenHeight` 595 → **587**, `decisionTop`
  476 → **472**, `decisionBottom` 704 → **700**. `scrollHeight` stays at
  **844** and `decisionCount` at 4.

  Eight pixels, both of them margins, and they were found by the *loaded* board
  rather than by SMOKE24. `gallery.html#screen=battle` drives a battle until
  both panels carry a status and a stage — the state the plan's closing
  assertion names and the smoke bot cannot ask for — and that board measured 602
  against the plan's 600. The two gaps between the battle heading, the board and
  the strip went from 12 to 8. Nothing moved closer to a thumb: both sit above
  the move grid.

  One defect went with them, also found by the loaded board: two long flag words
  on one turn (`Paralysed` and `Badly poisoned`) wrapped *inside* their chips
  and made the strip 35px. `flex-wrap: nowrap` stops a row breaking between
  chips and says nothing about a chip breaking inside itself. The strip is one
  24px band again.

  **The map did not move**, on any of its five fields, at any point in V5. Runs,
  the battle protocol and `data-digest.txt` are byte identical to `main` at
  `f5c84fe` — `git diff origin/main -- src/core src/data` is empty, so no
  version axis moved and no seed changed.

  `bundle.json` is **not** re-recorded, per this file's own rule: it is the
  pre-V0 baseline and each stage states its delta against it. V5's own delta,
  measured against `main` rather than against V0, is **+3,598 raw / +633
  gzipped**.

- **2026-09-11, patch 4.8.0.2.** `heights.json` map entries re-recorded in
  the commit that moved them, which is the one that took the pixel face off
  every token: `map.screenHeight` 810.72 → 840.41, `scrollHeight` 1004 →
  1033, `decisionBottom` 643.03 → 672.72. Exactly the −29.69 that 4.7.2's
  swap onto the face recorded in `docs/generation.md` §12e, back. `decisionTop`
  and every battle field are unchanged. Runs, the battle protocol and the
  digest are byte identical. `bundle.json` is not re-recorded per the rule
  above; the patch's delta against it is −15,596 B of font files and the
  licence beside them.

## The data digest is `contentHash`

**2026-09-11, overnight Branch 3.** `data-digest.txt` was a plain sha256 over
every file under `src/data/`; it is now the value `core/contentHash.ts`
carries, computed by `build-config/content-hash.ts` over the same directory
minus the exclusion list. A presentation stage moves it exactly when it moves
the version axis, and never for a reworded tooltip or a new coach mark.
`docs/generation.md` section 12g.
