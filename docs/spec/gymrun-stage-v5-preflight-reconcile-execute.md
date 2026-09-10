GYMRUN V5: Preflight, Reconcile, Execute
Paste into Claude Code on `main` after R12 (`866dcb2`) is merged. V5 is defined once, in `docs/spec/gymrun-visual-identity-plan.md`. This prompt does not restate it. It checks the tree matches what V5 assumes, applies the amendments that landed after the plan was written, then runs V5 as written.
PROMPT
You are building V5, battle stage composition, of the GYMRUN visual identity pass. This is the stage that moves sprites out of their box and into the scene.
Read, in this order: `CLAUDE.md`, `docs/README.md` sections 4 and 5, `docs/spec/README.md` (to confirm which V5 text is live), the V5 section of `docs/spec/gymrun-visual-identity-plan.md`, `docs/reports/v5-unblock-audit.md`, `docs/reports/release-c-battle-feedback.md`, the R12 report and `docs/visual/baseline/README.md`, and `docs/generation.md` §12b and §12c. Then `src/ui/scene.ts` in full.
The V5 section of the plan is the requirements document. Every requirement in it holds unless section 2 below overrides it. Do not reinterpret, do not extend.
Section 1. Preflight. Report, do not code.
1a. Tree state. Head of `main`, hash and message. Confirm R12 (`866dcb2`) and Release C (`8675b88` lineage) are both ancestors. Confirm V0 through V4 (`9296ba7`) are ancestors.
1b. The trim branch. There is ongoing work on the strict trim fix (open item 8 in `docs/README.md`: `GYMRUN_TRIM_STRICT=1 vitest run` red at `openApp`). Earlier reports stated no conflicts with presentation work. Verify rather than trust:

* List every branch not merged to `main` with its ahead count. Identify the trim branch.
* Report whether the trim fix has merged. R12's suite count came in at 923 before its change against Release C's 913, and both seeded-output instruments passed under `GYMRUN_TRIM_STRICT=1`, which suggests something landed in between. Name what the ten tests were and which PR carried them.
* If trim is still unmerged: diff its touched files against the files V5 will touch (`src/ui/scene.ts`, `src/ui/theme/tokens.css`, the battle screen markup, `docs/visual/baseline/`, the Playwright harness and `openApp`). Report overlap. If it touches the browser harness, say so, because V5's tests are written against whatever harness is on `main` today and will need a rebase fix if trim lands first.
* Do not branch off the trim branch. Branch off `main`.

1c. Gate scoping. State which of these apply on this tree:

* Strict-trim build check: gate.
* Strict-trim vitest run: gate if the trim fix is merged, otherwise excluded as pre-existing red per open item 8. Say which.
* SMOKE24: exit 0 with the one marked `xfail` (4.7 map fold). Confirm that is still the only xfail.
* Suite floor: the current count on `main` before your first change. Do not use 913 or 935 from prior reports; measure.

1d. Docs consistency. Three places describe V5's starting state and they were written at different times. Report any disagreement between them and say which is right by measurement:

* `docs/README.md` section 4 and open item 7 (the vertical budget).
* The audit report's measurement (1290.5 before Release C).
* `docs/visual/baseline/heights.json` on `main` today. Expected: `battle.decisionTop` 681.5, `battle.decisionBottom` 947.5, `battle.scrollHeight` 1376. Confirm and use these, not the numbers in any prose.

1e. Open decisions that move the baseline. V0.5's `--font-body` and V3.6's performance check are still open and want a phone. V5 moves both guarded baselines. Confirm neither has been answered since the audit. If either has, stop and report, because it changes the baseline you are about to re-record. If neither has, proceed with the current font and note in the report that `--font-body` remains a separate pass, before or after V5, never inside it.
Stop and report all of 1a through 1e before writing code.
Section 2. Amendments to the V5 section of the plan
These are the only deviations from the plan. Each one is a consequence of work that landed after the plan was written.
A1. The event strip already exists. Release C added a 36px flag strip under the scene, rendered through the V2 chip component, with side marking reusing the log's vocabulary. The plan's "log collapses to a one-line event strip" is that strip. Collapse the log into it. Do not build a second strip. Do not add a second reading of the protocol: Release C's flags mapper and the log's ordered turn data already come from one read in the battle screen.
A2. Starting height and budget. The plan's budget table (opponent panel 56, scene 260, player panel 64, event strip 36, move grid 128, margins 40, total 584, target at or above y=740) stands. The event strip line is already spent by A1. Starting height on this tree is `battle.scrollHeight` 1376 with the fourth move button at 947.5. Re-measure at your step 1 as the plan requires, then state the cuts by number before making them.
A3. Decision point means `decisionTop`. Per R12's baseline note and `generation.md` §12c. The fold target is `battle.decisionTop` at or above 740 minus the move grid height, so that all four buttons finish above the fold. Report both edges but gate on `decisionTop`.
A4. Test 4 rewrite. Replace the plan's "an effectiveness chip renders on every button" with: every rendered effectiveness marker is the same size and weight, and no marker is brighter than the neutral state. Neutral suppression at `scene.ts:610` (line may have moved; find it by behaviour) stays exactly as it is.
A5. Test 5 assumes R12. The badge is on the shared move component via `moveBandChip` in `scene.ts`. V5 does not touch band resolution. If any V5 change alters where `moveBandChip` is called from, the R12 per-surface test must still pass unchanged.
A6. The move grid constraint. `.move__meta` wraps to two lines at 390 wide and the band badge sits on the second line, between base power and the effectiveness marker. If the grid is tightened by reducing button height, the badge is the first thing that overhangs and R12's smoke check will go red. Tighten by margin and gap, not by shrinking the 44px target or the two-line meta.
A7. Docs hygiene. Do not rewrite `docs/README.md` section 4 in this branch. It has conflicted on every recent merge. Put V5's state in `docs/visual/reports/v5-*.md` and add a single line to `docs/README.md` section 4 pointing at it. Same rule for `generation.md`: append a dated §12d note only if V5 deviates from the plan; otherwise leave it.
Section 3. Execute V5
Run the V5 section of the plan as written, with the amendments above, in the plan's own step order, stopping for review at each of the plan's checkpoints. Presentation only. No `core/` change, no version axis moves, seeded output byte identical by both instruments, baseline re-recorded in the same commit that moves it, one commit per plan step, the spec commit first per `docs/spec/README.md` protocol 1.
Every colour, duration and size goes through `tokens.css`. The token grep and the `PRE_RELEASE_C_DURATIONS` pin stay at their current counts unless V5 adds a duration, in which case the pin moves up by exactly that number in the same commit with a comment naming it.
Attributes, never verdicts, extended to visual weight: sprite placement, panel opacity and strip rendering carry no emphasis that ranks one side or one move over another. The accent stays on `.primary-action`.
Definition of done
The plan's own definition of done for V5, plus: the preflight report is committed as the first section of the V5 report, the trim overlap finding is recorded, the suite floor is the measured number, and the report states in one line whether the trim branch will need a rebase fix against V5's harness changes.
