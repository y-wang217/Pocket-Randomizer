GYMRUN Overnight Run: contentHash, AI Patch, Tutorial
Three branches, run in sequence, each merged to main before the next starts. Each branch ends by writing a handoff file that the next branch reads as its first step.
Current state: 4.6c, 4.7, Release C, R12 and the visual pass V0-V4 are merged. 4.8 is out of scope here and does not exist in the tree. The three features below were explicitly held out of 4.8 so they could each land on their own branch.
0. Handoff protocol (governs all three)
Every branch obeys this. It is how the loop survives one branch failing.
Branch naming. `claude/overnight-1-contenthash`, `claude/overnight-2-ai-priority`, `claude/overnight-3-tutorial`. Merge each to main on green before starting the next.
Handoff file. Each branch's last commit writes `docs/handoff/overnight-<n>-<name>.md` with exactly these sections:

1. `## Merged at` the main commit hash after merge.
2. `## Version axes` which of RUN_LOG_VERSION, contentHash, AI_VERSION, randomizerVersion moved, with before and after values. Say "none" explicitly for the ones that did not.
3. `## Baseline for the next branch` test count, `sim-report.json` sha256, SMOKE24 status, and the benchmark line: mean gyms cleared, seed prefix, seed count. Read down a prefix, never across.
4. `## Decisions taken` every default the prompt let the branch pick, and what it picked.
5. `## For the next branch` anything the next prompt's assumptions depend on that turned out differently.
6. `## Morning decisions` anything that needs a human or a real phone. Empty section if none.

Step 0 of every branch is: read the previous branch's handoff file, confirm the baseline (run the suite, hash the sim report, check the benchmark prefix), and report before writing code. If the baseline does not match, stop and report rather than proceeding on a moved floor.
Skip rule. Branch 2 depends on Branch 1's RunLog change. If `docs/handoff/overnight-1-contenthash.md` is absent, Branch 2 exits as a clean skip with a one-line report, exactly as V5 did when Release C was missing. Branch 3 is presentation only and depends on neither; it always runs from main.
Standing rules, unchanged. `core/` never imports from `ui/`. No `Math.random`. Every balance or copy number lives in `data/`. The Part 4 editorial rule from 4.5.1 governs all copy: attributes, never verdicts. UI comes last in every branch. Commit at each checkpoint and stop for review. Determinism, stream isolation, version guards and the suite gate absolutely. Balance does not gate: record the number and keep going.
BRANCH 1: contentHash
PROMPT
You are building the contentHash release of GYMRUN on branch `claude/overnight-1-contenthash`. Read `docs/spec/gymrun-seeds-and-mappability.md`, `docs/generation.md` (§9 specifically), `docs/reports/` for the Release 0.5 sweep report, and the existing `src/core/rng.ts`, `src/core/run.ts` and `src/ui/seed.ts` before writing anything.
The design has existed since 4.6a and has never been built. Everything you need is in the seeds doc. What has drifted is the list of what it hashes.
Step 0. Baseline report
There is no previous overnight handoff. Record the baseline yourself: test count, `sim-report.json` sha256, SMOKE24 status (expected xfail on the 4.7 map overflow), benchmark mean gyms cleared with prefix and seed count. Report it. This is what Branch 2 checks against.
Order of work, stop for review after each

1. Baseline report, plus the two investigations below.
2. Hash computation as a build-config artifact, with tests. No RunLog change yet.
3. RunLog `versions` block, replay guard on all axes, RUN_LOG_VERSION bump.
4. Seed string format, paste-time check, `previewRun` verification.
5. Sequential stream API deletion.
6. Docs: generation.md §9 rewritten, handoff file.

Two investigations, report before coding
1. Glob or explicit list. generation.md §9 contradicts itself, and the design doc's explicit list of 11 tables is stale: `hms` was deleted at 4.6c, and 11 balance-bearing tables that exist today are missing (abilityOverrides, moveOverrides, relics, capabilityTypes, capabilityMoves, capabilities, shop, gyms, partyTuning, speciesTypes, bandInfo). An explicit list is exactly the hand-maintained discipline the hash was meant to replace, so the default is glob over `src/data/**`. Report what is in `src/data/` today and flag anything under it that is not balance-bearing and should be excluded (a pure type file, a copy table like `bandInfo` if it carries no numbers). Exclusions live in one list in `build-config/`, with a comment per entry saying why.
2. What reads `randomizerVersion`. The seeds doc offers retiring it in favour of contentHash. Grep every reader. If the only readers are the replay guard and the sim report stamp, retire it and record the retirement in generation.md. If anything else reads it, keep it and report what.
The hash

* Computed at build time by a script in `build-config/`, emitted as a constant the app imports. Never computed at runtime from bundled data, because the trimmed bundle is not the source of truth.
* Stable across machines: sort file paths, hash file contents not mtimes, normalise line endings. Two clean checkouts of the same commit produce the same hash. Test this by hashing twice with the file order shuffled.
* Changing one number in any included table changes the hash. Changing a comment in `src/core/` does not. Test both directions.
* First 6 hex characters is the display form. Full hash is what the log stores.

RunLog versions block
RunLog currently carries `version` and `randomizerVersion` as loose fields. Replace with one block:

```ts
versions: {
  runLog: number;
  contentHash: string;
  aiVersion: string;
}

```

* `aiVersion` is recorded now from the existing `AI_VERSION` constant. This closes the audit's "unguarded AI_VERSION" violation and, more importantly, means Branch 2 bumps `AI_VERSION` without touching the log schema. That is the whole point of doing the schema change here rather than there.
* Replay checks all three. Mismatch on any axis throws with a message naming the axis and both values. One guard, one message format.
* Bump RUN_LOG_VERSION. A pre-patch log throws.
* Seeded run output stays byte identical. contentHash changes what is recorded, not what is generated.

Seed strings
Per the seeds doc:

```
GYMRUN-<contentHash first 6>-<run seed>

```

* The seed display on the run start screen shows this form and it is copyable.
* Pasting a seed with a foreign hash is caught at paste time with copy stating that the seed was made on a different balance version and will not reproduce. The bare run seed still starts a fresh run. Copy lives in `data/`.
* A bare seed with no prefix still works, unchanged.
* Confirm `previewRun` from the 4.6a refactor takes `(seed, contentHash)` as the doc specifies. If it takes only `seed`, add the parameter and make it refuse a foreign hash the same way paste does.

Sequential stream API deletion
The audit found the old `rng.stream()` API still exported, with one src caller (`src/ui/seed.ts:35`) and four test callers. The seeds doc said to delete it because leaving both means someone uses the old one. Port the src caller to a key, delete the API, and handle the four tests: two are deleted outright and one is hollowed. Replace the hollowed one with an assertion that `rng.stream` does not exist, so the deletion itself is guarded.
Tests required

1. Hash is stable across file order and line endings, changes on any data edit, and ignores non-data edits.
2. RunLog carries the versions block; replay throws on each axis independently with a message naming the axis.
3. Version guard: a pre-patch log throws.
4. Seed string round-trips: display, copy, paste, identical run. Foreign hash rejected at paste with the stated copy.
5. `rng.stream` is absent from the module surface.
6. Determinism and stream isolation pass unchanged. Seeded output byte identical to the Step 0 baseline, SMOKE24 included.
7. All suites pass.

Docs
Rewrite generation.md §9 so it says one thing. Record the glob decision, the exclusion list, the versions block, and whether `randomizerVersion` was retired. Update the invariant register: the contentHash, sequential-stream and AI_VERSION-guard violations close here; note that the Math.random hole in `.mjs` and the "best rewards" copy at `run-map.ts:87` remain open and are not this branch's job.
Definition of done
A seed pasted from a different balance build is refused at paste time with a message the player can read. A log from a different AI version is refused at replay. Nothing about the generated run moved. And Branch 2 can bump `AI_VERSION` by changing one constant.
Handoff file
Write `docs/handoff/overnight-1-contenthash.md` per the protocol. In `## For the next branch`, state the exact name and location of the `AI_VERSION` constant and confirm it is read into the log at run creation.
BRANCH 2: Priority and speed aware AI
PROMPT
You are building the AI patch of GYMRUN on branch `claude/overnight-2-ai-priority`. Step 0: read `docs/handoff/overnight-1-contenthash.md`. If it does not exist, exit as a clean skip and report one line. Otherwise confirm its baseline and report before writing code.
Then read `src/core/battle/ai.ts`, `src/core/battle/driver.ts`, the `MoveView` and `BattleView` types, `docs/balance.md`, and the turn-order log work from the playtest round 2 patch.
This patch has been deferred three times, deliberately, so its balance effect stays separable. It is separable now. Every prior stage is merged and Branch 1 gave `AI_VERSION` a guard.
Scope, stated narrowly
The AI is priority-blind and speed-blind: `MoveView` carries no priority and `BattleView` carries no speed, so the greedy damage-max policy cannot know it is about to be outsped or that it holds a priority move. Fix that and nothing else.
Out of scope, explicitly. Switch logic. Status move valuation. Any weighting of secondary effects. Trick Room. Speed-affecting items and abilities beyond what the sim already resolves. Each of those is its own pass with its own `AI_VERSION` bump. The value of this patch is that its balance delta has one cause.
Order of work, stop for review after each

1. Step 0 baseline. Pin the pre-patch benchmark: run the sim at the baseline prefix and seed count and write the figure into `docs/balance.md` as the pre-AI-patch line.
2. `MoveView.priority` and `BattleView.speed` for both sides, as pure reads off the sim. Tests, no AI change.
3. The AI rule, with tests against fixed positions. `AI_VERSION` bump.
4. Simulator run at the same prefix and count. Record the delta. Do not retune.
5. Report on whether the Release C jiggle now agrees with the AI's play.

The data

* `MoveView` gains `priority: number`, read from `@pkmn/dex`. The trim strips only learnsets, legality and GO data, so priority survives with no generated table. Confirm and report.
* `BattleView` gains `speed` for the active Pokemon on each side. Define it in one pure helper in `core/battle/`: base Speed stat after stat stages, with paralysis applied. That is an approximation and it must be documented as one in a comment: items, abilities and field effects that touch speed are resolved by the sim and are not modelled here. The helper never guesses ties. A tie is reported as `unknown`, not as either side.
* Nothing here changes what the sim resolves. These are views for the policy, not inputs to the battle.

The rule
Keep the greedy damage-max core. Add one layer in front of it, in this order:

1. Compute expected damage for every move as today.
2. Determine whether the AI acts first, second, or `unknown` this turn, from the speed helper, ignoring priority.
3. If the AI acts second or `unknown`, and the opponent's highest expected damage move would KO the AI this turn, then among the AI's moves with priority greater than zero, pick the one with the highest expected damage. If none exists, fall through.
4. If any priority move KOs the opponent, pick it over a non-priority move that also KOs. A guaranteed first KO beats a probable second KO.
5. Otherwise, the existing greedy pick.

That is the whole rule. Write it down in a comment at the top of `ai.ts`, per the standing rule that every policy heuristic is documented because it appears in every balance report from here on.
The opponent's expected damage in step 3 uses the same `@smogon/calc` path the AI already uses for its own moves, evaluated from the opposing side. Do not add a second damage model.
`greedy` in the simulator is this same AI, so the player-side bot improves too. That is intended: the gap between `random` and `greedy` is the skill measure, and it should widen.
Versioning

* Bump `AI_VERSION`. Under Branch 1, that is the one constant change and the replay guard picks it up. Confirm a pre-patch log throws naming `aiVersion` and both values.
* RUN_LOG_VERSION does not move. contentHash does not move. randomizerVersion, if it still exists, does not move.
* Seeded run output is not byte identical to the baseline and must not be. Opponent choices change. Determinism still holds within the build: same seed, same log, same run, twice. Test that directly. Update the byte-identical regression fixture to the new output with a comment naming this patch, and keep SMOKE24's xfail marker as is.

Simulator

* Rerun at the pinned prefix and seed count. Record mean gyms cleared, per-gym clear rate, and the `random` versus `greedy` gap, beside the pre-patch line in `docs/balance.md`. Do not retune anything. The number is the deliverable.
* Add to the report: how often the AI's pick differed from the pre-patch greedy pick, and how often the priority branch fired. If the branch fires in under about 2 percent of turns, say so; the rule may be correct and still nearly inert, and that is worth knowing before anyone builds on it.

The Release C interaction
Release C's turn-order jiggle shows the player which side acted first. Its report was asked to say whether that makes AI misplays read as bugs. Now that the AI can see speed, report the reverse: pick 20 seeds, find turns where the priority branch fired, and confirm the jiggle order agrees with what the AI expected. Any disagreement is a bug in the speed helper, not in Release C, because Release C reads the protocol and the helper is an approximation.
Tests required

1. `MoveView.priority` is correct for a sweep including Quick Attack, Extreme Speed, a negative-priority move, and a status move.
2. The speed helper orders a faster versus slower pair correctly, applies stages, applies paralysis, and reports a tie as `unknown`.
3. Fixed positions: (a) AI slower, facing a KO, holding a KO-range priority move, picks it. (b) Same position, priority move does not KO, still picks it over the higher-damage non-priority move. (c) AI faster, identical moves, picks the higher-damage move as before. (d) Two KO moves, one priority, picks the priority one. (e) No priority moves at all, output identical to the pre-patch AI.
4. Version guard: a pre-patch log throws naming `aiVersion`.
5. Within-build determinism: same seed, same log, twice.
6. RUN_LOG_VERSION and contentHash unchanged, asserted.
7. All suites pass, with the byte-identical fixture updated and annotated.

Definition of done
A slower AI with Quick Attack in hand no longer tackles into its own KO. The benchmark moved by a recorded amount with one cause. Nothing else in the run changed.
Handoff file
Write `docs/handoff/overnight-2-ai-priority.md` per the protocol. Branch 3 does not depend on this file, but the morning does: put the benchmark delta and the priority-branch fire rate in `## Morning decisions` so the question "keep, retune, or revert" is on the first screen.
BRANCH 3: Tutorial
PROMPT
You are building the tutorial of GYMRUN on branch `claude/overnight-3-tutorial`, from main. Step 0: read any `docs/handoff/overnight-*.md` files that exist and confirm the baseline of the most recent one. This branch depends on neither of the others and runs regardless.
Then read `src/ui/tooltips.ts`, the verbosity toggle from 4.5.1 Part 5, the shell-level party drawer trigger from 4.7, the settings store, and `docs/spec/README.md` for the Part 4 editorial rule.
This is presentation only. No `core/` change, no version bump on any axis, seeded output byte identical, headless `playRun` unchanged.
Why this exists
The design framework named two gaps. One is that a player with zero Pokemon knowledge cannot begin to interact with the game, accepted as a demographic constraint and mitigated with a tutorial. This is that mitigation. The bar is: a player who has never seen a Pokemon game can read every screen and understand what it is asking, not that they play well.
The shape, and the defaults it rests on
The tutorial is first-run coach marks, not a scripted tutorial seed. Reasons, in order: a scripted seed needs a run mode in `core/` and a version bump, which breaks the presentation-only constraint; the game already defaults to Detailed mode on first launch so the help layer exists and only needs an entry point; and coach marks compose with any seed, including a daily seed, which a fixed tutorial run does not.

* Trigger. First launch, detected by a flag in the same persisted store as the verbosity toggle. Never keyed to a seed.
* Replay. A "Show tutorial again" control in settings resets the flag. A "Skip tutorial" control on the first mark dismisses all of them.
* Per-screen, on first visit. Each screen shows its marks the first time it is reached in the tutorial run, then never again. The flag is per screen, so a player who skips the map marks still gets the battle marks.
* Marks are anchored to real elements, pointing at the actual stat block, the actual move card, the actual tier badge. They never render a mock of the element. If the element is not on screen, the mark does not show.
* One mark at a time, advanced by tap. No timers, no auto-advance. Respect reduced motion.
* Copy in `data/tutorial.ts`, keyed by screen and mark id, one file. No tutorial string lives in a component.
* View mode. Marks render in all three modes but are written against Detailed, because that is the first-launch default and the mode where every abbreviation is on screen to be pointed at. Do not write mode-specific copy in this pass. If Pocket is implemented before this merges, marks in Pocket point at the same anchors and the copy is allowed to name things not visible in that mode; record this as a known gap.

What it teaches, and what it does not
This is the design content. Everything below is an attribute explanation. Part 4 applies in full: a mark may say what a thing is and what it does, and never what to pick.
Run start. What a seed is. That two people with the same seed and same choices get the same run. That a starter is chosen from three and that the stats, types, ability and moves shown are the whole basis for the choice.
Starter and party cards. HP, Atk, Def, SpA, SpD, Spe: one sentence each, reusing the abbreviation tooltips from 4.5.1 rather than restating them. That a Pokemon has types and moves have types, and they are different things. That a move is Physical, Special, or Status and which stat that uses.
Locale select. That the region sets which wild Pokemon can appear and which events are available, and does not set difficulty. That the gym's type is shown here.
Map. What a step is. What normal, hard and elite mean: harder fight, better reward, in that order. That rest restores and pays nothing. What the wild, trainer, event, shop and gym icons are. That an event shows a required capability and the party's band for it. That the current step's options are the decision and the chain above and below is context.
Battle. That the effectiveness marker on a move button is a forecast against the Pokemon currently on the field, and what the four bands mean as multipliers. That PP is uses remaining. That a status is shown on the panel. That the log and the flag strip say what happened. That fainting is not death, and that the run ends only when every party member has fainted.
Result screen. That rewards are a pick of three with no skip. That a capture is offered on every wild win and declining costs nothing. What the coverage line on a capture card means: the types the party can hit for extra damage, before and after.
Party drawer. That items are reassigned here and locked during battle. That the backpack has a capacity. That a relic is permanent for the run and takes no slot.
Gym. That the gym is the end of the segment, has a type identity, and that beating it offers a stronger reward.
Not taught. Anything about which choice is good. Nothing about the tier gradient beyond its literal meaning. Nothing about which stat matters for a given move beyond the Physical/Special/Status fact. No "try to", no "usually", no "a good idea". If a sentence could be read as advice, cut it.
Aim for roughly 25 to 35 marks total across all screens. If a screen needs more than six, the screen is the problem and the extra marks are cut, not the screen redesigned.
Order of work, stop for review after each

1. Step 0 baseline. Inventory every screen and list the anchorable elements on each, with their existing ids or data attributes. Add stable `data-tutorial` attributes where none exist. Report the anchor list before writing copy.
2. `data/tutorial.ts` with all copy, keyed by screen and mark. Report it in full for review. This is the checkpoint most likely to need a human.
3. The mark renderer: one component, anchored positioning, tap-to-advance, skip, reduced motion. Wired to the persisted flags.
4. Settings controls: replay and skip.
5. Phone check at 390x844: every mark's target and its text are both visible without scrolling, or the mark is repositioned.

Tests required

1. Every mark id in `data/tutorial.ts` resolves to an anchor present in the corresponding screen fixture. A mark with no anchor fails the test.
2. Copy lint: no mark contains any word from a short forbidden list in `data/tutorial.ts` (best, should, try, recommend, good, bad, better, worse, strong, weak). The list is data so it can grow.
3. First-launch flag: marks show on a fresh store, do not show on a returning store, show again after the settings reset.
4. Per-screen flags: skipping one screen's marks does not suppress another screen's.
5. Tapping a mark never submits a move, picks a node, or advances the run. Assert against the run log: it is unchanged across a full tutorial pass.
6. `core/` contains no tutorial import, no timers.
7. Seeded output byte identical to the baseline, SMOKE24 marker unchanged, headless `playRun` unchanged. All suites pass.

Definition of done
A person who has never played Pokemon opens the game, and every screen tells them what it is asking and what each thing on it means, one tap at a time, without once telling them what to do. A returning player never sees it unless they ask.
Handoff file
Write `docs/handoff/overnight-3-tutorial.md` per the protocol. `## Morning decisions` must carry the full copy table for review, since tutorial wording is the one thing in this whole run that a test cannot judge.
Defaults I am taking, flagged for review

* Coach marks rather than a scripted seed. Reversible, but a scripted seed is a `core/` change and would need its own branch.
* Written against Detailed mode. Pocket mode copy is a follow-up once Pocket exists.
* 25 to 35 marks, six per screen ceiling. Cut before redesign.
* The forbidden word list is a lint, not a full Part 4 check. The morning copy review is the real check.
* No tutorial for the simulator or the seed preview page. Those are not first-run surfaces.

Morning checklist
In this order, from the three handoff files:

1. Branch 1: did `randomizerVersion` get retired, and what is in the exclusion list.
2. Branch 2: benchmark delta and priority-branch fire rate. Keep, retune, or revert.
3. Branch 3: read the copy table end to end. That is the one review no test replaces.
4. Confirm main is green and `docs/README.md` current-state section names all three.
