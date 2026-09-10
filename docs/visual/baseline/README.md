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
- **2026-09-10, later the same day.** `heights.json` battle entries re-recorded
  after the archetype chip lost 4.7's own `border` and took the `.chip` recipe
  (an inset shadow, which costs no layout): each battle panel header is 2px
  shorter, so `battle.screenHeight` 1149.5 → 1145.5, `scrollHeight` 1343 →
  1339, `decisionBottom` 950.5 → 946.5. The map did not move. Runs and the
  digest are unchanged.
