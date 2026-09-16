# GYMRUN Patch: iOS Animations and a WebKit Test Harness

Filed verbatim, 2026-09-16, on `claude/awesome-noether-h6p8fj`, before any
work began, per the Process rule in `../../CLAUDE.md`. The paste's own header
line — "Paste into Claude Code in the existing repo, on top of merged PR #40
(`284c66f`)" — is kept because it names the tree the brief was written against.

---

new patch to address ios animations GYMRUN Patch: iOS Animations and a WebKit Test Harness
Paste into Claude Code in the existing repo, on top of merged PR #40 (`284c66f`).
PROMPT
You are patching GYMRUN. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md` §22 to §26, `docs/visual/reports/patch-battle-animation.md`, the handoffs in `docs/handoff/battle-anim-*`, and the existing `src/ui/scene.ts` and browser test harness before writing anything.
PR #40 shipped the battle animation work. It renders correctly in desktop Chrome and does not render at all on iPhone 14 Pro Max in either Safari or Chrome. Those are the same engine, so this is one platform, not two browsers. The diagnosis in the report splits it into two independent bugs plus a test-coverage hole that let both through.
This patch closes all three, in one pass, plus two items the report flagged as worth doing regardless.
Existing rules hold. `core/` never imports from `ui/`. No `Math.random`. Every timing or balance number a tuning pass would touch lives in `data/tuning.ts`. The Part 4 editorial rule governs any copy added here: the UI presents attributes, never verdicts.
This is presentation and test infrastructure only. No `core/` state changes. No run log version bump. `contentHash` does not move. Seeded output stays byte identical, SMOKE24 included, and that is a regression gate on every commit in this patch.
Order of work
No stop-and-report gates. Commit at each checkpoint and keep going.

1. WebKit in the test harness, with the existing 22 tests running green or failing honestly against it.
2. Bug A: delete the CSS round trip for the end-of-fight hold.
3. Bug B: diagnose against real WebKit, fix, and write down what it actually was.
4. `backdrop-filter` fallback.
5. Reduced motion keeps the outcome.

Item 3 is the only one whose fix is unknown before item 1 lands. Items 2, 4 and 5 are fully specified today and do not depend on the harness, so if WebKit turns up something ugly in item 3, the other four still ship.
Item 1. A real WebKit in the harness
The suite currently verifies that animations are wired in the one engine where they already work. All 22 browser tests pin a Chromium binary: no engine parameter, no device descriptor, no CI matrix. The "phone" runs are desktop Chromium at 390px wide, with no touch, no Safari user agent and no 3x pixel density. Both of this patch's bugs sat inside that blind spot, one of them for two releases.
Playwright is already a dependency. Only the browser binary is missing.

* Add WebKit to the harness as a second engine, parameterised, not forked. One test body, two engines. If a test genuinely cannot run on both, mark it with a reason string naming the engine and the cause, not a bare skip.
* Add a real device descriptor for the failing device rather than a viewport width. Touch, the Safari user agent and 3x device pixel ratio are all part of the reproduction and a 390px desktop window is not.
* Keep the existing Chromium runs unchanged. This adds an axis, it does not replace one.
* Wire both engines into whatever CI entry point `npm run check` uses, and into the browser smoke path that owns SMOKE24. A WebKit failure must fail the suite, not print a warning.
* Expect the existing 22 tests to go red against WebKit before any fix lands. That is the harness working. Do not quarantine failures to get a green board. Land the harness with the real failures visible in the same commit, then fix them in items 2 and 3.
* Record the binary version and the descriptor used in the report, since a WebKit difference between machines is the thing that will make this hard to reason about later.

Assertion strength matters here. A test that asserts a class is present would have passed on iOS throughout both bugs. Assert that motion actually occurred: listen for `animationstart` and `animationend`, or sample a computed transform mid-flight, or compare screenshots at two points inside the window. At least one test per animated class must assert observed motion rather than wiring.
Item 2. Bug A: the hold reads its duration out of the stylesheet
Confirmed by observation, no device needed.
The end-of-fight hold is JavaScript, and it reads its duration back out of the stylesheet. On any engine that does not return exactly `"750ms"` from that lookup, the parse fails and the function returns zero, meaning no hold at all. So iOS runs the pre-fix behaviour verbatim: the result screen appears instantly and the last turn of every fight is swallowed again. WebKit is entitled to return `0.75s` or a normalised form, and a parser that only accepts one spelling is the bug.

* Delete the round trip. The number already exists in JavaScript. Make `data/tuning.ts` the single source and have CSS read it, not the other way round, by setting a custom property from the tuning value at mount.
* Grep for every other place that reads a duration, delay or dimension back out of computed style and drive animation timing from it. Convert each one the same way, or say in the report why it is safe. This is a pattern bug, not a single site.
* If any parse of a style value must survive, it accepts both `ms` and `s` spellings, and on failure it falls back to the tuning default. It never returns zero. Zero means "no hold", which is silently indistinguishable from the bug it caused. Add an assertion or a dev-mode warning on the fallback path so a future engine difference is loud instead of invisible.
* Add a test that a hold of zero is unreachable from an unparseable or absent style value.

Item 3. Bug B: the CSS motion system has never run on iOS
The switch-out animation shipped broken at V5.5 and has never worked on mobile. It uses the same pattern as everything else, so the whole motion system is implicated. This is pre-existing and is not a PR #40 regression.
Diagnose it against real WebKit now that item 1 gives you one. Five plausible causes produce identical symptoms and three of the five fixes are wrong for the others, so do not change CSS until a reproduction tells you which one it is. Candidates worth ruling in or out explicitly:

* A custom property used inside a keyframe. WebKit will not interpolate an unregistered custom property, so a keyframe animating `var(--x)` can resolve to a static value with no error.
* An element whose `display` or layout type makes it non-animatable for the property being animated.
* A class added and removed inside one frame, where WebKit's style recalc timing differs from Chromium's, so the animation never starts.
* Compositing and layer promotion differences, including a parent that forces a new stacking context and drops the child's animation.
* Shorthand or prefix parsing, where WebKit discards the whole declaration on one unrecognised token and the rest of the rule goes with it.

Deliverable: the actual cause, named, with the evidence that distinguished it from the other four, written into `docs/generation.md` and the patch report. Then the fix. If the cause turns out to be systemic rather than per-animation, fix it at the system level once rather than patching each class.
Regression-test the specific animation that was broken since V5.5, on WebKit, with an observed-motion assertion.
Item 4. `backdrop-filter` needs a `-webkit-` fallback
The `backdrop-filter` on the battle panels has no `-webkit-` prefix and sits directly over the animated sprites. On WebKit an unprefixed declaration can be dropped, and a dropped backdrop can change compositing under the sprites, which is a plausible contributor to item 3 as well as a visual defect on its own.

* Add the prefixed property alongside the standard one.
* Check what the panel looks like when the filter is unsupported entirely. A transparent panel over moving sprites is unreadable, so the no-filter path needs an opaque or solid-tinted fallback rather than nothing.
* Check whether the prefix changes item 3's symptoms. If it does, say so, because that reorders the diagnosis.

Item 5. Reduced motion must keep the outcome, not just drop the movement
Under Reduce Motion the hold is currently zeroed entirely, which means anyone with that accessibility setting on still gets the original swallowed-last-turn bug. The standing rule is "remove the movement, not the outcome", and here the pacing is the outcome: without the hold, the final turn never paints.

* Under reduced motion, animations resolve instantly and every flag still displays, as before. The hold does not go to zero. It shortens to a reduced-motion value in `data/tuning.ts`, large enough to guarantee a paint of the final turn before the result screen swaps in.
* Both the hold and the reduced value are tuning numbers. A playtester saying battles feel slow stays a one-number change.
* Verify the reduced-motion rule wins on specificity, not source order. The report already caught one rule in this patch's lineage that worked by source order only, and Stage 4.9 shipped the same shape. Assert it, do not eyeball it.
* Test on both engines with the emulated reduced-motion media feature: the last turn paints, every flag renders, and no animation delays input.

Tests required

1. The full browser suite runs against both Chromium and WebKit, on a real device descriptor with touch and 3x pixel density, and both engines gate CI.
2. At least one test per animated class asserts observed motion, not class presence. A test that would pass with animations entirely dead is not a test.
3. The final turn of a battle paints before the result screen, on both engines, and specifically in the one-turn case.
4. The end-of-fight hold is never zero, including when the style lookup is absent, unparseable, or returns a `s`-spelled value.
5. No animation timing anywhere is derived from a computed style read. Assert this structurally if you can, by grep test or lint rule, not only by inspection.
6. The V5.5 switch-out animation runs on WebKit, with an observed-motion assertion.
7. Under reduced motion, on both engines: the last turn paints, all flags display, and no animation blocks input.
8. `core/` contains no timers and `playRun` completes headless under Node unchanged.
9. Seeded output byte identical, SMOKE24 included. `contentHash` unmoved. No version axis moves on any of the four. All existing suites pass.

Definition of done
On a real iPhone: a fight's last turn is visible, a one-hit KO animates, sprites lunge at a readable speed, switch-outs move, panels are legible over the sprites, and a player with Reduce Motion on sees the outcome of every turn. In the repo: the suite runs on two engines, the WebKit failures that existed before this patch are fixed rather than quarantined, no animation timing is read back out of CSS, and `docs/generation.md` names what Bug B actually was.
Out of scope
Any change to `core/battle/ai.ts`. The priority-blind and speed-blind AI work, which has its own pass and its own `AI_VERSION` bump. Stage 4.9's balance regression at 0.46 mean gyms cleared, which is a table problem and not this patch's. New animations, new flag kinds, new classes. Anything that moves `contentHash` or a version axis.
Report at the end
One section in the patch report covering: the WebKit binary version and device descriptor used, the list of tests that went red against WebKit before the fixes and their state after, the named cause of Bug B with the evidence that ruled out the other candidates, every site converted off a computed-style duration read, and whether the `backdrop-filter` prefix changed anything about Bug B's symptoms.
