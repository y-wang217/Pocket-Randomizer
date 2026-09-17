# GYMRUN specs

Canonical copies of the design documents and stage prompts, verbatim. Every
stage prompt in this project says to read `pokerun-build-spec.md` and
`gymrun-seeds-and-mappability.md`. For several stages those files were not in
the repo, so that instruction silently did nothing and sessions worked from
memory of a design they could not check. **Read from here, not from memory.**

This file says what each document is and whether it is live. It does not
summarise what any of them say.

- The invariants that hold across every prompt: [`../../CLAUDE.md`](../../CLAUDE.md).
- Current state, open items, and the design lineage in prose:
  [`../README.md`](../README.md).

## The register supersedes an archived instruction

**2026-09-10.** Several prompts here contain an instruction to *decide* an open
question. Some of those questions have since been decided, and protocol 4
forbids editing the prompt to say so. Both facts are correct and together they
re-litigate a settled decision every time a session opens the older document.

**The rule: where a decision appears in "Decisions, resolved" below, that
decision stands, and an instruction inside an archived prompt to make it again
is a record of when it was open — not a live instruction.** Implement what the
register says. If you believe the register is wrong, that is a new decision with
a new date, not a rediscovery.

**The current instance** is the type wheel.
[`gymrun-qol-release-plan-rev2.md`](gymrun-qol-release-plan-rev2.md) section on
Release B says "Resolve it now" and offers three options. It was resolved on
2026-09-10 — keep the wheel, drop the trigger from the two Pokemon panel type
badges — and the row below records it. Release B implements that. It does not
choose again.

## The register

One row per document. **Status is exactly one value:** `draft`, `active`,
`merged`, or `superseded`.

| Document | Kind | Status | Superseded by | Merged at |
|---|---|---|---|---|
| [`pokerun-build-spec.md`](pokerun-build-spec.md) | spec | `active` | | |
| [`gymrun-seeds-and-mappability.md`](gymrun-seeds-and-mappability.md) | design note | `active` | | keyed streams at `94040e9`; `contentHash`, seed strings, `previewRun` and the unkeyed-API deletion at Branch 1 of the overnight run, 2026-09-11 |
| [`gymrun-qol-release-plan-rev2.md`](gymrun-qol-release-plan-rev2.md) | release plan | `active` | section 7 only, by the relics prompt | |
| [`gymrun-stage1-claude-code-prompt.md`](gymrun-stage1-claude-code-prompt.md) | stage prompt | `merged` | | `b20aa26` |
| [`gymrun-stage2-claude-code-prompt.md`](gymrun-stage2-claude-code-prompt.md) | stage prompt | `merged` | | `9a62547` |
| [`gymrun-stage3-claude-code-prompt.md`](gymrun-stage3-claude-code-prompt.md) | stage prompt | `merged` | | `e2f312b` |
| [`gymrun-patch-playtest-round2.md`](gymrun-patch-playtest-round2.md) | patch prompt | `merged` | | `8a7897d` |
| [`gymrun-stage4.5.1-claude-code-prompt.md`](gymrun-stage4.5.1-claude-code-prompt.md) | stage prompt | `merged` | | `42c6961` |
| [`gymrun-stage4.6-claude-code-prompts.md`](gymrun-stage4.6-claude-code-prompts.md) | stage prompt | `merged` | Part C only, by the relics prompt | `dfa18dc` (A), `c6d730a` (B) |
| [`gymrun-stage4.6c-relics-claude-code-prompt.md`](gymrun-stage4.6c-relics-claude-code-prompt.md) | stage prompt | `merged` | | `4b63528` |
| [`gymrun-visual-identity-plan.md`](gymrun-visual-identity-plan.md) | release plan | `active` | | V0 to V4 built on the overnight branch; **V5 built** on `claude/zen-mayer-9sp9bn`, deviations in `../generation.md` section 12d; V6 not started |
| [`gymrun-visual-identity-overnight-prompts.md`](gymrun-visual-identity-overnight-prompts.md) | stage prompt | `active` | | V0 to V4 done; V5's overnight text was skipped on the night and the stage ran later from its own prompt below, see `docs/visual/reports/` |
| [`gymrun-patch-4.7-phone-regressions.md`](gymrun-patch-4.7-phone-regressions.md) | patch prompt | `active` | | step 1 built; steps 2-4 stopped on the prompt's own stop condition, see `../generation.md` section 12b |
| [`gymrun-release-c-battle-feedback-amended.md`](gymrun-release-c-battle-feedback-amended.md) | stage prompt | `merged` | supersedes section 6 of the QoL release plan | `846975c` (items 1-4); R12 and V5 are its named follow-ons, R12 with its own row below |
| [`gymrun-patch-r12-band-badge-move-card.md`](gymrun-patch-r12-band-badge-move-card.md) | patch prompt | `active` | | section 1 built; section 2 amends the V5 prompt, consumed by the V5 prompt below |
| [`gymrun-stage-v5-preflight-reconcile-execute.md`](gymrun-stage-v5-preflight-reconcile-execute.md) | stage prompt | `active` | | the V5 run: preflight, the seven amendments to the plan's V5 section, then the plan's own step order. All six steps built; report `../visual/reports/v5-battle-stage.md`, deviations `../generation.md` section 12d |
| [`gymrun-stage4.8-claude-code-prompt.md`](gymrun-stage4.8-claude-code-prompt.md) | stage prompt | `merged` | | `e5243d7` (PR #21). Committed 2026-09-10 before its report, `../reports/stage-4.8-report.md`; all eight steps built, `RANDOMIZER_VERSION` 13 and `RUN_LOG_VERSION` 12, the second a recorded deviation (`../generation.md` section 7c) |
| [`gymrun-patch-4.7.2-font-stats-verbosity.md`](gymrun-patch-4.7.2-font-stats-verbosity.md) | patch prompt | `merged` | | `0712032` (PR #22). Brief plus the rulings on its report, both verbatim. All five steps built on `claude/cool-dijkstra-apme8u`; report [`../visual/reports/patch-4.7.2.md`](../visual/reports/patch-4.7.2.md), deviations `../generation.md` sections 12e and 12f |
| [`gymrun-overnight-contenthash-ai-tutorial.md`](gymrun-overnight-contenthash-ai-tutorial.md) | stage prompt, three branches | `active` | | committed 2026-09-11 before any work. All three branches built the same night on `claude/overnight-1-contenthash`, `claude/overnight-2-ai-priority` and `claude/overnight-3-tutorial`, merged in order into the integration branch; handoffs in `../handoff/`. Flips to `merged` when the integration branch reaches `main` |
| [`gymrun-patch-4.8.0.1-species-stays-the-label.md`](gymrun-patch-4.8.0.1-species-stays-the-label.md) | patch prompt | `active` | | committed 2026-09-11 before its report. The ruling on the report de-prioritised nicknames past what the prompt asks — species on every label, the graveyard and share text included — recorded in `../generation.md` section 12i rather than by editing the prompt |
| [`gymrun-patch-4.8.0.2-readability.md`](gymrun-patch-4.8.0.2-readability.md) | patch prompt | `active` | | committed 2026-09-11 before any work, on `claude/nice-einstein-up1ltb`. Presentation and copy only: no `core/` change, no version axis moved. Status report, lift and the tracker report in [`../visual/reports/patch-4.8.0.2.md`](../visual/reports/patch-4.8.0.2.md) |
| [`gymrun-patch-4.8.0.3-battle-readout-visuals.md`](gymrun-patch-4.8.0.3-battle-readout-visuals.md) | patch prompt | `active` | | committed 2026-09-14 before any work, on `claude/focused-ride-vet50c`. Presentation only: no `core/` change, no version axis moves. Arrived in two parts: the first paste stopped mid-sentence in item 2's last bullet, the remainder landed after the four-question report and completes it. Filed verbatim in both halves. The report's one blocker — accuracy and evasion stages never reach the UI — is answered by the prompt itself: out of scope bars `statViews` and `BOOSTABLE_STATS`, test 2 names a new field, so the two stages ride their own projection field rather than a widened stat block |
| [`gymrun-patch-4.8.0.3-closeout.md`](gymrun-patch-4.8.0.3-closeout.md) | closeout prompt | `active` | | committed 2026-09-14 before any work, on `claude/focused-ride-vet50c`. Verification, one commit split and one deferred file — it closes 4.8.0.3 rather than extending it, and adds no feature. Filed under the same protocol as a build prompt: a closeout that changes the tree is work, and work starts from a filed prompt |
| [`gymrun-patch-4.8.0.3-seed-stamp-tap-hazard.md`](gymrun-patch-4.8.0.3-seed-stamp-tap-hazard.md) | patch prompt | `active` | | committed 2026-09-14 before any work, on `claude/focused-ride-vet50c`. **A named exception to the closeout's own scope rule**, and the only one: carried item B is a standing hazard 4.8.0.3 exposed rather than created, and the closeout forbade touching the stamp or the shell, so fixing it needed its own authorisation. Option (a) of the three the item filed |
| [`gymrun-patch-mobile-seed-bar.md`](gymrun-patch-mobile-seed-bar.md) | patch prompt | `active` | | committed 2026-09-11 before any work. Supersedes the 4.5.2 phone rule that hid the seed bar for the whole run; the collapsed bar is recorded in `../generation.md` section 12k |
| [`gymrun-patch-density-modes.md`](gymrun-patch-density-modes.md) | patch prompt | `active` | | committed 2026-09-11 before any work, on `claude/bold-clarke-xcwko1`; all seven steps built the same day on that branch, every gate green, awaiting merge (flip to `built` then). Replaces the two valued 4.7.2 verbosity flag with a three valued density setting. Presentation only: no `core/` change, no version axis moves. Report [`../visual/reports/patch-density-modes.md`](../visual/reports/patch-density-modes.md); the six rulings on it are appended to the prompt file verbatim and their corrections recorded in `../generation.md` section 12l |
| [`gymrun-patch-ai-tiers.md`](gymrun-patch-ai-tiers.md) | patch prompt | `active` | | committed 2026-09-11 before any work, on `claude/friendly-heisenberg-6m0986`. Opponent AI tiers plus the player-side sim policy ladder. Adds `src/data/ai.ts`, so it moves `contentHash`. (The row's original claim that it would bump `RUN_LOG_VERSION` was written from the prompt and is wrong: see the correction at the end of this cell.) Built the same day: the report, then the ability fix, the scorer refactor, the tier table, the knowledge and item flags, tier assignment and the UI readout. Six rulings on the report changed what it built — `fullDamageModel` withdrawn, `fullKnowledge` cut, `--policy heuristic` never built, `RUN_LOG_VERSION` held still — all recorded in `../generation.md` section 13 rather than by editing the prompt. **Closes the register's "`AI_VERSION` is guarded nowhere" scope correction below: that correction is stale, `aiVersion` has been guarded since the `contentHash` release, and this patch's bump was one string** |

| [`gymrun-patch-event-rewards-and-move-card-fields.md`](gymrun-patch-event-rewards-and-move-card-fields.md) | patch prompt | `draft` | | committed 2026-09-14 before any work, on `claude/event-rewards-ui-bugs-z84mmb`, with the screenshot it arrived with. A playtest report, so it is filed as it was written rather than as a brief: two of its four items are named gamebreaking and the fourth is offered as an experiment ("we can try"), and that framing is part of the record. It moves three version axes — `RUN_LOG_VERSION` to `-15`, `RANDOMIZER_VERSION` to `-15`, `contentHash` to `53145f` — and `../generation.md` section 15 is the account, including the one deviation: a relic grant names its fallback in the table rather than drawing one from the tier's other entries |
| [`gymrun-patch-bar-primitive-and-battle-beats.md`](gymrun-patch-bar-primitive-and-battle-beats.md) | patch prompt | `active` | Release C item 2's panel nudge, by the sprite lunge | committed 2026-09-15 before any work, on `claude/kind-mccarthy-w3kml6`. Presentation only: no `core/` change, no version axis moves. The three decisions it rests on were taken in the planning session and are in the file |
| [`gymrun-patch-event-rejig.md`](gymrun-patch-event-rejig.md) | patch prompt | `draft` | retires three rules named in its Part 5: the 4.6c "events pay at every band" floor, bands as the outcome selector, and the 4.6c capability-weighting note | committed 2026-09-14 before any work, on `claude/zealous-lovelace-srtimh`. Step 1 reported ([`../reports/patch-event-rejig-step1.md`](../reports/patch-event-rejig-step1.md)); step 2 built. Five rulings on that report are recorded in `../generation.md` section 14 rather than by editing the prompt, and two of them change the prompt: Part 4's rarity column comes out, since rarity scales the payout and no longer names the event, and an event Pokemon never costs a fight at any tier |
| [`gymrun-patch-map-drawer-window-overlays.md`](gymrun-patch-map-drawer-window-overlays.md) | patch prompt | `draft` | | committed 2026-09-15 before any work, on `claude/hopeful-curie-5ah94f`. A map readout reachable from every decision surface, and the three overlays — party drawer, battle history sheet, map — become centred windows on one extracted shell (`src/ui/overlay.ts`) rather than three hand-copied bottom sheets. Presentation only: no `core/` change, no version axis moves. The brief's "for both" was open on scope, so three questions were asked and answered before any code and are recorded in the prompt file under its verbatim text rather than in the brief itself. The map overlay calls the map screen's own `renderRail`/`renderHeading`/`renderChain`, so it cannot reveal a fact the map screen does not — the `CLAUDE.md` reveal rules hold by construction rather than by care |
| [`gymrun-patch-carry-on-softlock.md`](gymrun-patch-carry-on-softlock.md) | patch prompt | `draft` | | committed 2026-09-15 before any work, on `claude/jolly-thompson-wume0n`, with a transcription of the three screenshots it arrived with. A playtest report, so it is filed as it was written: it asks for the cause and names no fix, and that framing is part of the record. The build in the screenshot is stamped `53145f`, this tree's own `contentHash`, so unlike the relics report it was met on the build it describes. Two defects, one hiding the other: a stale `ItemPlan` spent a node after it was composed, and a bare `catch {}` around `playRun` that turned the resulting `RangeError` into a frozen screen. Moves no version axis; `../generation.md` section 19 is the account |
| [`gymrun-stage4.9-levels-and-evolution.md`](gymrun-stage4.9-levels-and-evolution.md) | stage prompt | `active` | the Stage 2 starter rule (fully evolved, 490+), the "team size is paid for in levels" gym rule in `scaling.ts`, the "no evolution" rule in `items.ts`, and the `isNonstandard === null` pool cut in `gen-pools.ts` | committed 2026-09-15 before any work, on `claude/charming-ride-q4ogfb`. A planning conversation filed as the prompt: the opening request, four picker answers and two rulings on the plan, all verbatim. Moves three axes: `RANDOMIZER_VERSION` to `-16`, `RUN_LOG_VERSION` to `-16`, `contentHash` by every data table it touches; `AI_VERSION` holds. `../generation.md` section 21 is the account |
| [`gymrun-patch-idle-sprites-and-locale-motion.md`](gymrun-patch-idle-sprites-and-locale-motion.md) | patch prompt | `active` | | committed 2026-09-15 before any work, on `claude/vibrant-euler-2taoqk`. A sprite with a two-frame idle bob on every surface where a Pokemon is chosen or inspected, and one signature motion per locale in place of the single shared drift. Presentation only: no `core/` change beyond one pure helper (`capabilityHolders`), no version axis moves. The brief asked for a plan before code, so the plan was reported and is kept in the file under the verbatim brief, with the three questions asked and answered before it was finalised: the cave stays as it is, the battle actors do not bob, and animated GIF sprites are investigated and recorded in `../engine-notes.md` rather than built |
| [`gymrun-overnight-battle-animation.md`](gymrun-overnight-battle-animation.md) | stage prompt, three branches | `active` | supersedes `ui/theme/motion.ts`'s "nothing waits for this" rule at one seam, `reviewBattle` | committed 2026-09-16 before any work, on `claude/busy-noether-jfszvi`. A playtest report, so it is filed as it was written: it arrived in two messages, the second widening one patch into an overnight run, and both are verbatim in the file with the three planning answers under them. Three defects, only the first of which the brief names — the last turn of every fight has its animation swallowed by the screen swap, the beats are 125ms because four had to fit in one budget, and there is no vocabulary for battle abnormalities. Branch 1 frees `battleFeedbackMs` from `contentHash` (closing the "`tuning.ts` display fields" item filed at `../generation.md`) and retunes; Branch 2 widens `FlagKind`; Branch 3 gates the result screen and adds the outro. **All built**, in the order 1, 3A, 2, 3B — 3A ran before 2 under the prompt's own skip rule, because it is the defect the playtest reported. Presentation only throughout, and one axis moved against that claim: `contentHash`, once, by the display split — with the six baseline run records re-recorded byte identical but for their hash field, which is the proof generation did not move. **Stage 4.9 then merged into this branch rather than the other way round**, moving `RUN_LOG_VERSION` and `RANDOMIZER_VERSION` to `-16` and `contentHash` again; the two features compose without a code change, since `chooseEvolution` runs after `reviewBattle` and a gym clear therefore plays the outro, then the result screen, then the evolution fork. Deviations in `../generation.md` sections 22 to 25; handoffs in `../handoff/battle-anim-*`. Two invariant tensions were settled in the prompt rather than mid-build — the "nothing waits" rule's one exception, and how "more impactful" reconciles with the absolute ban on flag emphasis (every abnormality gets its own identity and the same weight) |
| [`gymrun-patch-ios-animations-webkit-harness.md`](gymrun-patch-ios-animations-webkit-harness.md) | patch prompt | `active` | the "reduced motion zeroes the outro token" rule of Branch 3A, and the "nothing reads a duration out of CSS" direction it reverses | committed 2026-09-16 before any work, on `claude/awesome-noether-h6p8fj`, on top of merged PR #40 (`284c66f`). Presentation and test infrastructure only: no `core/` change, no version axis moves, `contentHash` unmoved at `c3964b`. **Two of its five items are not what the brief says they are, and both are recorded rather than quietly re-scoped.** Bug A's stated mechanism (a parser taking only one spelling of a duration) was already false — the parser took both, and WebKit 26.6 returns `750ms` anyway — but the round trip it asks to delete *was* the bug, for the reason the brief's own last bullet gives: the failure path returned zero, and zero is not a short hold but the swallowed-last-turn defect restored silently. Bug B **does not reproduce at all**: on real WebKit at the reported device's descriptor every animated class on the stage starts and moves, the V5.5 switch-out included, and all five candidate causes are ruled out by their own experiments — so, following the brief's own "do not change CSS until a reproduction tells you which one it is", no CSS was changed for it. What does reproduce the reported symptom exactly, on both engines, is `prefers-reduced-motion`, which zeroed both the animations and the hold; that is item 5, and it shipped. The harness's first honest WebKit run gave 11 failures of which **seven were this repo's own instruments** — a screenshot indexed in CSS pixels at 3x density, a motion helper that got its timing wrong three separate ways, a parallax case waiting a fixed 150ms for a throttled frame — all fixed rather than quarantined; the remaining four are narrowed or declined with a reason naming the engine and the cause. Report [`../visual/reports/patch-ios-animations.md`](../visual/reports/patch-ios-animations.md), deviations `../generation.md` section 27 |
| [`gymrun-patch-ios-diagnose-instrument.md`](gymrun-patch-ios-diagnose-instrument.md) | patch prompt | `active` | | committed 2026-09-16 before any work, on `claude/hopeful-lovelace-w118jz`, on top of merged PR #41 (`5a13d6b`). The closing handoff of the PR #41 session, filed as it was written, **because what it claims shipped did not**: it tells the reader to open `public/diagnose.html` on their iPhone and no file by that name exists at any commit on any branch. Everything else that handoff claims did land — the WebKit harness, the twelve-beat motion suite, the Bug A round-trip deletion, the reduced-motion hold — so the gap is exactly one artefact, and it is the one the session's whole conclusion depends on being runnable. This patch builds it, to the handoff's own six-section specification, and validates it against both engines with Reduce Motion emulated. Ships in `public/`, so it is copied verbatim into `dist/` and enters no bundle: the instrument must still run on a device where the app's own stylesheet or entry script is what is broken. Presentation and diagnostic tooling only: no `core/` change, no `ui/` change, no version axis moves, `contentHash` unmoved, shipped bundle byte identical. The instrument arrives with `test/visual-diagnose.test.ts`, which runs it on both engines under `npm run check`, because the rule this patch is a case of is that **an artefact no test runs can be reported as shipped and not be**. Report [`../visual/reports/patch-ios-diagnose-instrument.md`](../visual/reports/patch-ios-diagnose-instrument.md), deviations `../generation.md` section 28. **Closed the same day: the instrument reached the device and the tester reported Reduce Motion on**, which ends the iOS thread — there is no engine bug, and section 27's hedged hypothesis is confirmed rather than inferred |
| [`gymrun-patch-victory-order-and-battle-readouts.md`](gymrun-patch-victory-order-and-battle-readouts.md) | patch prompt | `draft` | | committed 2026-09-17 before any work, on `claude/victory-screen-battle-ui-p3op20`. A playtest report, filed as it was written: six items in one message, three of them open on scope. Those three were put to the author and answered before any code, and the answers are in the file under the verbatim brief — the opponent readout is a readout and not a team-size change, the caught Pokemon is a legal recipient for the move asked after it, and the final segment's two battle steps are guaranteed rather than merely permitted. Moves three axes: `RUN_LOG_VERSION` to `-17` (items 1 and 3 share one bump), `RANDOMIZER_VERSION` to `-17` (item 6), and `contentHash` by the tuning knob; `AI_VERSION` holds |

`gymrun-seeds-and-mappability.md` stays `active` rather than `merged` because
it is a design note and not a stage prompt: its requirements are all built as
of the overnight run's Branch 1, with one deliberate difference —
`randomizerVersion` was kept beside `contentHash` rather than retired.
[`../keyed-streams.md`](../keyed-streams.md) records what shipped.

The visual identity plan and its overnight prompts were pasted into the
session that ran them and committed here on 2026-09-10 before that run began.
Neither was in the repo before that. The working copies the overnight runner
reads live under `docs/visual/`; these two files are the record.

The relics prompt sat at the repo root until 2026-09-10 and was moved here.
Rule 1 below was always satisfied for it: it was committed at `47d4d0e`, before
its first implementation commit at `3764e89`. Only the location was wrong.

### Prompts that were never recovered

Not in this directory, so they get no register row, but recorded rather than
omitted: **Stage 0**, **Stage 4**, and **Stage 4.5**. The last is referenced by
the 4.5.1 prompt and by the QoL plan. If a prompt here tells you to read one of
them, say so in your report instead of proceeding on an assumption about what it
contained.

**Do not reconstruct any of the three.** The seeds document is the cautionary
case: a reconstruction written from a prompt's description of it was built on
for a whole sub-stage before the real document arrived and turned out to specify
something else. A reconstruction is indistinguishable from a source once it is
committed, and this project has already paid for that once.

What Stage 4.5 *delivered* is not lost, and it is recorded in live documents
rather than restated here — **derived from what those documents say, not from
the prompt, which nobody has read since**:

- [`../architecture.md`](../architecture.md) — the battle screen's projection
  seam, rule 5, and the four things the stage needed out of `@pkmn/sim`.
- [`../balance.md`](../balance.md) section 8 — "the non-result": the stage
  changed no balance number, deliberately, and the section explains why that is
  a finding worth a section.
- [`../../README.md`](../../README.md), "What Stage 4.5 added" — the
  player-facing half.

That is enough to work against. It is not a substitute for the prompt and is
not to be treated as one.

## Resolving a path an archived prompt names

Every prompt here opens by naming documents to read. Ten of those names do not
resolve as written: nine are bare filenames from a time when the documents sat
at the repo root, one is a source path that moved under `screens/`, plus one
prompt that was never recovered.

**They are not corrected, and that is protocol 4 working rather than failing.**
A prompt is a record of what was asked. Editing one to match where a file ended
up would make it a description of what exists, which is the one thing it must
not become. So the archive gets a lookup table instead, and the automated check
in `test/boundaries.test.ts` deliberately excludes this directory — a test that
went red on a document nobody may edit would be deleted, and the live half of
the invariant would go with it.

If a prompt tells you to read something below, read the right-hand column.

| Named in a prompt as | Actually |
|---|---|
| `pokerun-build-spec.md` | [`pokerun-build-spec.md`](pokerun-build-spec.md), here |
| `gymrun-seeds-and-mappability.md` | [`gymrun-seeds-and-mappability.md`](gymrun-seeds-and-mappability.md), here |
| `gymrun-stage4.6-claude-code-prompts.md` | [`gymrun-stage4.6-claude-code-prompts.md`](gymrun-stage4.6-claude-code-prompts.md), here |
| `data/movePools.ts`, `data/rewardPools.ts`, `data/scaling.ts`, `data/events.ts` | `src/data/…` — the `data/` shorthand for `src/data/` |
| `core/events.ts` | `src/core/events.ts` — same shorthand |
| `data/hms.ts` | **Deleted at 4.6c.** Capabilities are relics; there is no HM table and there will not be one |
| the Stage 4.5 prompt | **Unrecoverable.** See "Prompts that were never recovered" above. Do not reconstruct it |
| `src/ui/reward.ts` around line 61 | `src/ui/screens/reward.ts:61` — the reward screen moved under `screens/` at Stage 4.5.1, item D. The line number is right in the new location: `bandBadge` is there |

The `data/` and `core/` shorthand is used consistently across every document
and is not a defect, merely shorter than the tree. The first three rows exist
because those documents moved into this directory at `47d4d0e`, which is later
than every prompt that names them — the prompts are not wrong, they are older
than the layout.

## The archival rule

**Every prompt is committed to `docs/spec/` verbatim before any work begins on
it.** Not after, not at merge time. The commit that adds the prompt is the first
commit of the stage.

Three things this buys:

1. **The repo is the source of truth.** An instruction to read a design document
   that is not in the repo does nothing, and nobody can tell.
2. **Parallel sessions cannot diverge.** Two sessions on the same tree read the
   same committed prompt. A prompt that exists only in one context window is
   invisible to the other, and the first that session hears of it is a merge
   conflict in a file it did not know was in scope.
3. **Supersession becomes visible.** A design that changes three times leaves
   three documents. Without a status column the fourth reader cannot tell which
   one is live, and this project has already produced exactly that situation.

### The protocol

1. Before starting a stage or patch, commit its prompt to `docs/spec/` verbatim.
   **Do not edit it to match what you intend to build.**
2. Add its row to the register with status `draft`, and flip to `active` when
   work starts.
3. Naming: `gymrun-stage<N>-<slug>.md` for stages, `gymrun-patch-<slug>.md` for
   patches. Dotted stage numbers, matching the cross-references already in the
   docs.
4. Where the built work deviates from the prompt, **do not edit the prompt.**
   Record the deviation in [`../generation.md`](../generation.md) with a dated
   note naming the prompt and the reason. The prompt is a historical record of
   what was asked, not a description of what exists.
5. On merge, flip the row to `merged` and fill the commit.
6. When a later design replaces an earlier one, flip the earlier row to
   `superseded` and fill the pointer. **Do not delete the document.**
7. A session must not begin implementation work from a prompt that is not in
   `docs/spec/`. If one is pasted that is not there, commit it first, then start.

## Parallel session protocol

- One branch per prompt, named for it.
- A session declares scope by the prompt it is working from. **Two sessions must
  not be `active` on prompts that touch the same data tables at the same time**,
  because `contentHash` moves for both and neither report is attributable.
- Before starting, read the register and check nothing overlapping is `active`.
- Documentation commits are always safe to land in parallel. **Data table
  commits are never safe to land in parallel.**

## Decisions, resolved

These four were carried here as open. All four are now closed, recorded with the
evidence that closed them.

| Decision | Resolution |
|---|---|
| **Type wheel** in `src/ui/tooltips.ts` | **Keep it, drop the trigger from the two Pokemon panel type badges.** Decided 2026-09-10. Not yet implemented: it is UI work and belongs to Release B. |
| **`latent` definition** | **Type-based**, not a generated learnset table. Shipped in `src/data/capabilityTypes.ts`, whose header records the measurement and the three reasons. No `hmLearnsets.ts` exists or will. |
| **Band 3 encounters** | **Node transition**, Option A. Shipped, covered by `test/band3.test.ts` and `test/event-bands.test.ts`, described in [`../generation.md`](../generation.md) section 10. |
| **Keep, retune or revert the priority AI** | **Keep.** Decided 2026-09-11 by the AI tiers patch, which folds the priority layer in as the `takeTheKo` flag — it is what `TRY_TO_FAINT` is in every reference implementation. `balance.md` section 15 keeps its delta as the record of what it cost. |
| **Priority-blind and speed-blind AI** | **Not a blocker.** Its own pass and its own `AI_VERSION` bump, deliberately outside 4.6. Carried in [`../README.md`](../README.md) section 5. **That pass also owns the unguarded `AI_VERSION`, and it is not the cheap fix the `8c3bff8` audit implies** — see below. |

## Scope corrections

**`AI_VERSION` is guarded nowhere, and guarding it is a log-version bump.**
**Closed 2026-09-11 by the AI tiers patch, and it was already wrong when it was
written down.** The `contentHash` release put `aiVersion` in the run log's
`versions` block and into `VERSION_AXES`, so the guard existed and the schema
change had already been paid for; the AI tiers patch's bump was one string and
`RUN_LOG_VERSION` did not move. The original text is kept below because a
scope correction that turned out to be stale is worth seeing, and because the
lesson is the one this file already teaches: check the tree, not the note.

Recorded 2026-09-10, Release 0.5. The `8c3bff8` audit lists "`AI_VERSION` is
stamped onto reports but never guarded at replay" beside four one-line defects,
which reads as a one-line fix. It is not. `RunLog` in `core/types.ts` has no
`aiVersion` field at all, so there is nothing for `assertReplayable` to compare
— adding the guard means adding the field, which changes the decision schema and
forces `RUN_LOG_VERSION`. It stays homed to the priority-blind and speed-blind
AI pass, which already bumps `AI_VERSION` and already produces its own balance
report, and which should scope it as a schema change rather than a null check.
