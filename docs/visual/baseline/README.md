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
