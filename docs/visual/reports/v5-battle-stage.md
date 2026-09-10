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
