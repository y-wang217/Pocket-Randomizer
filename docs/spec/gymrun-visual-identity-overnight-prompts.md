GYMRUN Visual Identity: Overnight Prompts
Six prompts, V0 through V5, run sequentially and unattended. V6 audio is excluded; it is optional and cheap enough to do awake.
Each prompt implements the matching stage in `gymrun-visual-identity-plan.md`. The plan stays the spec. These prompts change only three things for overnight running: every "stop for review" becomes a written report, every gate is machine-checkable, and every prompt is safe to re-run.
How idempotency works
Every prompt follows the same protocol. Paste the preamble at the top of each stage prompt, or commit it to `docs/visual/OVERNIGHT.md` and make each prompt read it first.
PREAMBLE
You are running unattended. There is no one to answer questions. Where the plan says "stop for review", write the report and continue. Where the plan says "decide" or "report first", take the default named in the plan's flagged-defaults section, record it, and continue. Never wait.
State markers. Stage state lives in `docs/visual/state/`. On start:

1. If `docs/visual/state/VN.done` exists and `npm test` passes on the current tree, print `VN already complete at <hash>` and exit. Do nothing else.
2. If `docs/visual/state/VN.failed` exists, read it, delete it, and resume from the last green checkpoint commit it names. Do not redo completed checkpoints.
3. If `docs/visual/state/V(N-1).done` does not exist, for N greater than 0, print `VN blocked: V(N-1) not done` and exit. Do not start.

Branch and commits. Work on `visual/vN`, created from `main` if it does not exist, checked out if it does. Commit only on green. Each checkpoint commit message is `VN.k: <what>`. Never commit with a failing test. Never amend or rewrite a checkpoint that already exists.
Gates. After every checkpoint, run the full gate: `npm test`, the byte-identical seed check against `docs/visual/baseline/` (create the baseline from `main` in V0 if absent), the `core/` import and timer lint, and any stage-specific assertion. Green means commit and continue. Red means: revert the working tree to the last green checkpoint, write `docs/visual/state/VN.failed` containing the checkpoint reached, the failing test names, the last 50 lines of output, and your diagnosis as a hypothesis plus what to check, then exit non-zero. Do not retry more than twice per checkpoint. Do not weaken a test to pass it.
Done. When every checkpoint is green, write `docs/visual/state/VN.done` containing the final commit hash, the bundle size delta measured with `npm run build`, and the layout heights of the two guarded screens. Write `docs/visual/reports/VN.md` with every report the plan asked for and every default taken. Merge `visual/vN` into `main` with a merge commit, no squash. Exit zero.
Decisions that needed a human. Anything the plan says cannot be decided from a desktop, take the conservative default, implement it behind a single CSS variable or constant so the morning swap is one line, and list it under `## Morning decisions` at the top of the report.
PROMPT 1: V0 Tokens and Type
[PREAMBLE]
Implement Stage V0 of `gymrun-visual-identity-plan.md` exactly as written, with these overnight substitutions.
Baseline first. Before any change, on `main`, run the seeded run output for SMOKE24 and the standard determinism seeds and write the results to `docs/visual/baseline/`. Commit that to `main` as `V0.0: visual baseline`. Every later stage diffs against this directory. If it already exists, do not regenerate it.
Checkpoints.

* V0.1 Inventory report. Grep every hardcoded colour, font-family, font-size, radius, and spacing literal in `src/ui/`. Write the list to the report. Confirm the tooltip mechanism count in `src/ui/tooltips.ts`. If it is more than one, do not touch it; note it as a Release B regression in the report and continue.
* V0.2 `src/ui/theme/tokens.css` and the font. Pixelify Sans, latin subset, two weights maximum, OFL file beside it, README credit. Record byte sizes. Accent hue: take the plan's rule literally. Render all 18 type chips desaturated and outlined, then pick the accent as the first candidate from this ordered list that has a hue distance over 30 degrees from every type token: hot pink, acid lime, orange, cyan. Record the choice and its nearest type hue in the report.
* V0.3 Apply tokens to every screen and delete every literal from V0.1. Add the lint test that fails on any remaining literal.
* V0.4 Sibling card assertion and one-accent-per-screen assertion as tests.
* V0.5 Legibility gate. This needs a phone and you do not have one. Take the conservative default: Pixelify Sans for headings and labels, system monospace stack for numbers and body, controlled by one variable `--font-body` in `tokens.css`. Render the six-stat block and a 2x2 move grid at 390 width in headless Chromium and save screenshots to `docs/visual/reports/v0-legibility/`. List under `## Morning decisions`: swap `--font-body` to the display face if the screenshots read fine on a real phone.

Bundle delta and guarded screen heights go in the done marker. Heights must equal `main` to the pixel.
PROMPT 2: V1 Locale Palettes
[PREAMBLE]
Implement Stage V1 of `gymrun-visual-identity-plan.md` exactly as written.
Checkpoints.

* V1.1 Report where the UI reads the current locale and whether it survives save and reload. If it does not survive reload, that is a UI projection bug; fix it in `ui/` only, add the test, and note it. If fixing it would require `core/`, do not fix it, write the report, and exit non-zero with `V1 blocked: locale projection needs core`.
* V1.2 `src/ui/theme/locales.css`, exactly three token overrides per locale, stylesheet parse test that asserts the count.
* V1.3 `data-locale` on `<html>`, set on segment start, updated per segment, removed on summary. Save and reload test.
* V1.4 Body gradient, horizon band, locale watermark, locale select swatch strip. Contrast measurement: render every node card and text style over the darkest and lightest locale in headless Chromium, compute contrast ratios, assert they meet the V0 baseline ratios recorded in `docs/visual/reports/V0.md`. If any locale fails, lower the watermark opacity for that locale only until it passes, and record the final opacity per locale.
* V1.5 Locale select cards identical computed styles except swatch colours, as a test.

Vertical delta must be 0. Screenshots of all eight locales on the map screen at 390x844 go to `docs/visual/reports/v1-locales/`.
PROMPT 3: V2 World Chrome
[PREAMBLE]
Implement Stage V2 of `gymrun-visual-identity-plan.md` exactly as written.
Checkpoints.

* V2.1 Report every modal, overlay, sheet, and confirm in `src/ui/` and the DOM pattern each uses. If they do not share a helper, extract one first, with a test that no screen builds its own overlay. Commit that extraction as its own checkpoint before restyling anything.
* V2.2 Modals as dim bands through the shared helper. Accent primary plus hollow secondary. Measure the band's y-range at 390x844 and assert the Release A pinned move card is outside it. If it is not, shift the band, never the card.
* V2.3 Numbered slots for party and backpack, position order only, item icons through `@pkmn/img`, berries and held items styled identically. Test that reordering state reorders slots identically.
* V2.4 Corner stamps, absolutely positioned in safe-area insets, `pointer-events` on the seed stamp only. For every screen, compute the bounding box of flow content at 390x844 and the bounding box of each stamp. Any collision drops that stamp on that screen via a per-screen class. Record which stamps were dropped where.
* V2.5 One chip component for tier, band, capability, capability band, status, and stat stages, neutral style; type chips coloured, outlined, desaturated. Move the `BAND n` badge onto it without changing where it renders. Run the Release A band-badge-per-surface test unchanged.

Guarded screen heights must equal V1 to the pixel. Seed stamp copies the full `GYMRUN-xxxxxx-nnnnnnn` string; test it.
PROMPT 4: V3 Scene Layer
[PREAMBLE]
Implement Stage V3 of `gymrun-visual-identity-plan.md` exactly as written. This stage mounts new DOM and has a performance gate you cannot run on a phone. Use the proxy below and flag it.
Checkpoints.

* V3.1 Performance baseline. In headless Chromium at 390x844 with 4x CPU throttling, record a performance trace while scrolling the map screen under V2. Extract p95 frame time and mean paint time. Write both to the report. This is the proxy for the mid-range Android measurement.
* V3.2 `.scene` container in `scene.ts`, fixed, full viewport, `pointer-events: none`, three layers, one locale, no motion. Test that it mounts once and survives navigation by node identity. Test that every interactive element on every screen remains tappable over it.
* V3.3 All eight locales as inline SVG silhouettes under `src/ui/theme/scenes/`, flat single-colour generic shapes only, no Pokemon, no Pokeball, no landmark. Record per-locale bytes and gzipped total. If the total exceeds 30 kB gzipped, simplify the largest silhouettes until it does not.
* V3.4 Parallax at 0.2, 0.5, 1.0 via `translate3d` from a passive scroll listener, one drifting keyframe element per locale on a 20 second or longer loop, reduced-motion static with the drifting element not rendered. Test the reduced-motion branch.
* V3.5 Contrast over every locale's scene against the V0 baseline ratios, with the scrim fix from the plan where needed. Record per-locale scrim opacity.
* V3.6 Performance check. Re-run V3.1's trace on the busiest locale. Pass if p95 frame time is under 16ms and mean paint under 4ms. If it fails, implement the canvas fallback from section 1 of the plan as its own checkpoint V3.7, re-measure, and record both sets of numbers. Either way, list under `## Morning decisions`: verify on a real phone; the 4x throttled trace is a proxy.

Vertical delta must be 0. Screenshots of all eight locales on the map and battle screens go to `docs/visual/reports/v3-scenes/`.
PROMPT 5: V4 Run Summary as Payoff
[PREAMBLE]
Implement Stage V4 of `gymrun-visual-identity-plan.md` exactly as written.
Checkpoints.

* V4.1 Report. List every fact the run summary can read from run state and the decision log today, and every fact the design needs that it cannot. Anything in the second list that is derivable in `ui/` from state plus the log, derive it there. Anything that would need `core/`, drop from the design and record it. Do not add to `core/`.
* V4.2 Static layout and copy. Outcome word, gyms cleared, tier table with copy in `src/ui/copy/summary.ts`. Assert no file under `data/` changed and `contentHash` is identical to baseline. Bolded row test for every value 0 to 8.
* V4.3 Data as decoration. The route as a path across locale-coloured bands, one dot per logged node decision, gyms larger, death point marked; test the dot count against the decision log for SMOKE24. Final party through V2 slots and the shared move card. Coverage as an 18-spoke wheel from `offensiveCoverage`, read only. Cause of death as a V2 band, absent on victory.
* V4.4 Actions: rematch as the one accent button, copy seed hollow. One-accent test.
* V4.5 Post-battle result screen restyle only. Assert reward cards and a capture offer are above the fold at 390x844 for a three-card offer with a capture present.

Screenshots of a victory summary and a gym 5 defeat summary go to `docs/visual/reports/v4-summary/`.
PROMPT 6: V5 Battle Stage Composition
[PREAMBLE]
Implement Stage V5 of `gymrun-visual-identity-plan.md` exactly as written.
Extra precondition. V5 depends on Release C. Check that the protocol-to-flags mapper and the HP chunk-and-shadow exist and their tests pass. If Release C is not merged, print `V5 blocked: Release C not merged` and exit zero without a failed marker. This is a skip, not a failure.
Checkpoints.

* V5.1 Measure. Height of every battle screen element at 390x844 and the total, and whether the four move buttons are above the fold. Write it to the report as the before table.
* V5.2 Log collapse. Event strip of one line holding the latest event plus Release C flag words, bottom sheet for history opened by tap only. Test that opening the sheet does not submit a move or advance the turn. Test that the strip never exceeds one line.
* V5.3 Sprites into the scene, panels floating with a scrim and no box, stat stages through the V2 chip. HP bar behaviour from Release C untouched; run its tests unchanged.
* V5.4 Move grid restyle through the existing component. Test that effectiveness chips on all four buttons have identical computed size and weight regardless of value.
* V5.5 Species swap animation, scene-aware, duration from the single `data/tuning.ts` number, skippable, reduced-motion instant. Test it fires only on switch and adds zero time to a turn with no switch.
* V5.6 Measure again. Assert total layout height at or under 600 with a full status and stage chip row on both sides, and four move buttons plus the strip above the fold. Write the after table beside the before table.

Bundle delta and both height tables go in the done marker and the report. `playRun` headless must complete unchanged; assert it.
Runner note
Run them in order, one process each, sequential. A shell loop is enough:

```
for n in 0 1 2 3 4 5; do
  claude -p "$(cat docs/visual/prompts/V$n.md)" || break
done

```

Each prompt exits zero on done, zero on a clean skip, non-zero on a failed marker, and the loop stops at the first failure. Re-running the loop in the morning resumes from the failed checkpoint and skips everything already done. Read `docs/visual/reports/` in order; every report opens with its morning decisions.
