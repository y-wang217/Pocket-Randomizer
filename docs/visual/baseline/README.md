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
