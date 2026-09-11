# Visual identity baseline

Recorded from the untouched tree before Stage V0, by three instruments. Every
visual stage diffs against this directory and never regenerates it.

| file | written by | what it holds |
|---|---|---|
| `runs/<seed>.json` | `scripts/visual/baseline.ts --write` | A headless run under the scripted greedy policy: decision log, outcome, every visit, every casualty, the final party. |
| `battles/GYMRUN01.json` | same | The determinism seed's battle protocol, nondeterministic lines stripped. |
| `data-digest.txt` | same | sha256 over every file under `src/data/`. Not `contentHash`, which is its own release. |
| `heights.json` | `scripts/visual/measure.mjs --out` | The two guarded screens at 390x844 on SMOKE24: layout height, scroll height, and the decision point's top and bottom edges. |
| `bundle.json` | `scripts/visual/bundle.mjs --out` | Every file in `dist/`, raw and gzipped. |

`test/visual-baseline.test.ts` replays the runs and the battle under `npm test`
and fails on any byte that differs. Heights are compared by
`scripts/visual/measure.mjs --compare docs/visual/baseline/heights.json` after
`npm run build`, and each stage's done marker records the delta from this file.

## Corrections

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
