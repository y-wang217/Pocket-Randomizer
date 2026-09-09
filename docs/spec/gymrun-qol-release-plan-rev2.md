# GYMRUN: QoL Requirements, Release Plan, and Claude Code Prompts

Rev 2. Supersedes `gymrun-qol-release-plan.md` and `gymrun-patch-move-learning-qol.md`.

Current state: 4.6a and 4.6b both merged, 4.6b at `c6d730a`. 4.6c not started and currently blocked on two things (section 7).

---

## 1. What changed now that 4.6b is in

Four things in the merged 4.6b work land directly on this plan.

**A band tooltip already exists.** `src/data/bandInfo.ts` backs a `band` tooltip on reward cards. That means `src/ui/tooltips.ts` now hosts at least two mechanisms, the type wheel and the band tooltip, with the type wheel decision still unresolved. Release B has to inventory that layer before adding a third thing to it.

**The `-enditem` reader exists.** Berry consumption is already read off the protocol, so Release C's flag words get a berry-fired flag for almost nothing.

**The BAND badge sets a precedent Release A must match.** Reward cards show `BAND n` resolved through `bandOfMove`. Release A puts move cards on three new screens, and a replacement decision is now a band decision, so band has to render there too or the new screens are less informative than the card the player just clicked.

**The sim's move scorer has a known defect.** From the checkpoint 4 notes: reward cards are valued against the lead but applied to the best recipient. That is the exact code path Release A is changing. It means the current move take rate figures are not trustworthy, and it means Release A should fix the valuation to score against the recipient it would actually pick, since the recipient choice is now an explicit policy call.

---

## 2. Requirement register

| ID | Requirement | Kind | Lands in |
|---|---|---|---|
| R1 | Recipient screen shows each member's six stats, Atk and SpA legible without expanding | Display | Release A |
| R2 | Incoming move card pinned across recipient and replacement screens | Display | Release A |
| R3 | Cancel out of the learn flow, both screens, forfeits the reward | Logic, logged | Release A |
| R4 | Confirm overlay before a move is displaced | Flow | Release A |
| R5 | Gym rewards confirmed good, change nothing | None | No work |
| R6 | HMs are not permanent, treated as any other attack | Spec change | 4.6c amendment |
| R7 | Move tooltip on the party management screen | Display | Release B |
| R8 | Same move tooltip available during battle | Display | Release B |
| R9 | HP falls as a chunk, shadow fades over 0.5s | Polish | Release C |
| R10 | Attacking shows who acts first, first actor jiggles then second | Polish | Release C |
| R11 | Post-resolution flag words: STAB, super effective, contact, priority, status | Polish | Release C |

New in this rev, derived from the 4.6b merge rather than from playtest:

| ID | Requirement | Lands in |
|---|---|---|
| R12 | BAND badge renders on every move card, not only reward cards | Release A |
| R13 | Sim move-reward scorer values the card against the recipient it selects | Release A |
| R14 | Berry-fired flag word, off the existing `-enditem` reader | Release C |

Carried open items, not in this batch:

- **Type wheel decision.** Still unresolved, now competing with the band tooltip for the same layer. Release B forces it.
- **Gym currency pick rate.** Was 59.7 percent pre-4.6b and expected to close against a banded field. The notes do not report the new figure, and any figure taken before R13 is confounded by the scorer defect. Re-read it after Release A.
- **Berry clog at gym 6 plus.** 67.3 percent against a 50 percent target, recorded in `docs/balance.md` §11. Traced to short fights, not the berry table.
- **Fight length, README open question 1.** Now the root cause behind two separate carried misses. It has earned its own investigation.
- **Priority-blind and speed-blind AI.** Own pass, own `AI_VERSION` bump.
- **Party threat readout.** Types that threaten the party, minus types the party already answers.

---

## 3. Release plan

**Release 0. Docs into the repo.** One commit, no code.

Two problems, one fix. First, every stage prompt says to read `pokerun-build-spec.md` and `gymrun-seeds-and-mappability.md`, and neither is in the repo, so that instruction has silently done nothing for several stages. Second, the `gymrun-seeds-and-mappability.md` currently in the repo is a reconstruction written from a prompt description, never diffed against the real document.

Commit the real versions to `docs/spec/`, then diff the reconstruction against the real seeds doc and report any divergence before it gets built on. The keyed sub-stream derivation and the `contentHash` rules are load-bearing for Stage 5 seed sharing, and a reconstruction that drifted on either is a bug waiting for a daily seed to surface it.

**Release A. Move learning flow.** R1 to R4, R12, R13.

First, and now a hard dependency rather than a preference. Under the R6 amendment, HM teaching in 4.6c is not a separate flow, it is the move reward flow. 4.6c cannot be specified until the shape of that flow, including decline, is settled.

**Release B. Move explanation layer.** R7, R8, plus the type wheel decision.

Opens with a data availability question that could turn this release into a build-config change, see the prompt.

**Release C. Battle feedback visuals.** R9 to R11, R14.

Presentation only, no core, no version bump, lowest risk, last.

**Then 4.6c**, after its two blockers are closed and the amendment in section 7 is applied.

**Version axes.** Release A bumps the run log version once. B and C bump nothing. `contentHash` does not move in any of the three, since no data table changes and no new draws. That makes "simulator output byte identical to the post-4.6b report" a valid regression test for all three. Seeds stay disposable through 4.6c, and the freeze is still at the end of 4.6c.

---

## 4. Release A prompt: move learning flow

Paste into Claude Code after Release 0.

### PROMPT

You are patching **GYMRUN**, on top of merged 4.6b. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md`, the Stage 4.5.1 prompt (Parts 4 and 6 specifically), and the existing `src/core/` and `src/ui/` before writing anything.

This patch fixes the move reward flow. Two items touch `core/` and the run log, four are display and flow. Read item 3 first, it retires a rule.

Existing rules hold. `core/` never imports from `ui/`. No `Math.random`. Every balance or copy number lives in `data/`. The Part 4 editorial rule governs all copy added here: the UI presents attributes, never verdicts.

**Order of work, stop for review after each**

1. Policy interface change for decline, run log version bump, headless test. No UI.
2. Sim scorer fix (item 6) and a fresh report against the post-4.6b baseline.
3. Recipient screen stats, pinned move card, band badge.
4. Confirm overlay on replacement selection.

**Item 1. Stats on the recipient screen**

Choosing a recipient for a Fire Punch is an Attack question and choosing one for a Flamethrower is a Special Attack question, and neither number is currently on screen.

- Each party member card shows the full six-stat block, using the party management stat component unchanged. Do not build a reduced variant.
- Atk and SpA must be readable without expanding anything, but show all six. Hiding four stats to emphasise two is a verdict in disguise.
- Each card also shows that member's current four moves, using the battle screen move card component unchanged, since one of them is about to be displaced.
- **Part 4 applies in full.** Do not sort the list by stat match, do not mark a better fit, do not colour the stat matching the incoming move's category, do not show projected damage. The player can see the move is Physical and that one member has 140 Atk. That is the whole job.

**Item 2. Pinned move card**

The incoming move must be visible continuously from the moment the reward is taken until the replacement is confirmed.

- It renders as a pinned card at the top of the recipient screen, showing type, base power, PP, category, and band.
- It stays pinned through the replacement screen and appears in the confirm overlay.
- On a 390x844 phone the pinned card plus at least one full recipient card must be above the fold. If that does not fit, the pinned card gets a compact height variant. It does not get dropped.

**Item 3. Cancel out of the learn flow**

This retires a rule. Stage 4.5.1 Part 6 says "There is no decline," reasoning that the player already chose this card over two alternatives. That reasoning was about strategy. This request is about misclicks. The escape hatch exists and it costs the reward.

- Cancel is available on the recipient screen and on the replacement screen. Both back out of the entire flow, not one step of it.
- **Declining forfeits the reward.** No refund, no re-offer, no return to the three cards.
- Cancel is confirmed, and the copy states the cost plainly: "Decline this move? You will keep your current moves and gain nothing from this reward." State the outcome, do not editorialise about whether it is wise.
- Delete the "no decline" rule from the 4.5.1 lineage rather than leaving it behind a flag, and record in `docs/generation.md` what replaced it and why.

```ts
chooseMoveRecipient: (offer, party, state) => Promise<number | 'decline'>;
chooseMoveToReplace: (member, incoming, state) => Promise<number | 'decline'>;
```

- Both serialize into the run log in order, decline included. Neither consumes RNG.
- **Bump the run log version.** A pre-patch log throws with a message naming the mismatch.
- `contentHash` does not move. No data table changes, no new draws.
- Simulator policies never decline. Document that beside the greedy heuristic so a decline rate of zero in every future report reads as expected, not as a bug.
- Build decline as a **parameter of the flow entry point**, not a property of the flow, defaulted on. Stage 4.6c teaching reuses this same flow and will set its own value.

**Item 4. Confirm the replacement**

Displacing a move is permanent, there is no relearner, and it currently happens on a single tap on a phone.

- Selecting a move to replace opens a confirm overlay, not a new screen.
- The overlay shows the outgoing and incoming move cards side by side, both full cards, same component, both showing band.
- Overlay cancel returns to the replacement screen with nothing selected. It does not exit the learn flow. Exiting is item 3's action, and the two must be visually distinct so a player changing their pick does not accidentally forfeit the reward.
- An empty move slot still skips the replacement screen entirely. No confirm on a free slot.

**Item 5. Band badge everywhere a move renders**

4.6b put a `BAND n` badge on reward cards, resolved through `bandOfMove`. Report first whether that badge lives on the shared move card component or only on the reward card. If it is only on the reward card, move it into the shared component.

A replacement decision is a band decision now. A player comparing an incoming band 3 against four current moves cannot make that comparison if only one of the five cards is labelled. Keep the existing `band` tooltip from `src/data/bandInfo.ts` attached, unchanged.

**Item 6. Fix the sim move scorer**

`docs/balance.md` records that the move reward card is valued against the lead but applied to the best recipient, and that the same failure was already logged once before. Recipient selection is now an explicit policy call, so fix the mismatch: the greedy policy scores each candidate recipient and takes the best pairing, and the value it reports is the value of the pairing it actually selects.

- Keep the heuristic deterministic and written down in a comment, per the standing rule.
- Rerun the report. Move take rate and gym currency share are both expected to move, and any pre-fix figure for either is confounded.
- This changes report numbers, not run outcomes. Byte-identical determinism still applies to the seeded run itself.

**Item 7. Gym rewards**

Confirmed working in playtest. Change nothing in `data/rewardPools.ts`.

**Tests required**

1. Headless `playRun` completes with a policy that declines at the recipient screen, and a second that declines at the replacement screen. Party moves unchanged in both, reward consumed in both.
2. Decline serializes and replays to identical state, including a save taken between the reward card pick and the decline.
3. An empty move slot skips both the replacement screen and the confirm overlay.
4. Version guard: a pre-patch log throws with a message naming the mismatch.
5. Band badge renders on every move card surface, asserted per surface, and resolves through `bandOfMove` in all of them.
6. Determinism and stream isolation pass unchanged. Seeded run output byte identical to the post-4.6b baseline, SMOKE24 included.
7. All existing suites pass, except those asserting decline is impossible, updated with a comment naming this patch rather than deleted.

**Definition of done**

On a phone: the incoming move stays visible from card pick to confirmation with its band, every recipient shows all six stats and its current four moves, backing out takes two taps and clearly says it costs the reward, no move is displaced on a single tap, and the report's move take rate is measured against the pairing the bot actually makes.

---

## 5. Release B prompt: move explanation layer

Paste after Release A is merged.

### PROMPT

You are patching **GYMRUN**. Read `src/ui/tooltips.ts`, `src/data/bandInfo.ts`, `build-config/trim-sim-data.ts`, and the existing move handling in `core/` before writing anything.

A player who misses with an 85 percent accuracy move has no way to know the move was ever inaccurate, so the miss reads as the game cheating. Same for a move that raises Speed, or one that needs a charge turn. The data exists in `@pkmn/dex` and none of it is on screen.

**Report before you write any code. Two questions.**

1. **What does the trimmed bundle still carry per move?** `build-config/trim-sim-data.ts` strips learnsets, which is what blocked `resolveCapability` in 4.6c. Confirm whether accuracy, priority, flags (contact, sound, charge, recoil, drain), secondary effect chance, boosts, and the short description all survive the trim. If any of them are stripped, this release needs a generated table the way 4.6c needs `hmLearnsets.ts`, and that changes its shape. Report the exact fields available and the bundle size cost of any table you would have to generate.
2. **What tooltip mechanisms currently exist?** At minimum the type wheel and the 4.6b band tooltip. List them all. The type wheel has an open decision with three options: keep it but remove the trigger from the two Pokemon panel type badges, delete it entirely, or leave as is. Option 1 was recommended. Resolve it now, state which you implemented, and do not add a third mechanism under any option.

Stop and report both. Do not proceed until reviewed.

**Order of work, stop for review after each**

1. The two report questions.
2. Type wheel decision, applied.
3. `describeMove` as a pure core function, with tests. No UI.
4. Surfaced in the party management screen and in battle.

**The core function**

```ts
describeMove(moveId: string): MoveExplanation
```

Pure, in `core/`, no RNG, no DOM. Returns **structured fields, not a prose blob**, so the UI renders and the function stays testable:

- Accuracy as a number, or an explicit never-misses marker. This is the single most important field in the patch.
- Base power, category, type, PP, band, priority bracket, target.
- Secondary effect: chance and what it does.
- Stat changes: which stat, how many stages, on which side.
- Behavioural flags: contact, sound, recoil, drain, charge or recharge turns, multi-hit range, protection-bypassing.
- The short dex description, last.

Band comes from `bandOfMove`, not from a second computation. Note that multi-hit banding happens in the generator on total power, so Population Bomb reads band 4 at 20 base power, and the explanation must show both numbers or a player will think the badge is broken.

Do not hand-roll any of this. Do not write a prose sentence in `core/`. Omit absent fields rather than rendering empty rows.

**Part 4 applies.** "Accuracy 85%" is correct, "risky" is not. "Raises Speed by 1 stage" is correct, "great for outspeeding" is not.

**Surfaces**

- Party management: every move on every member is tappable and opens the explanation.
- Battle: every move button opens the explanation without spending the turn. Tap to expand, not hover. Opening an explanation must never submit a move.
- Release A placed the move card component on the recipient screen, the replacement screen, and the confirm overlay. Wire the tooltip into the **component**, not into each screen. One insertion point. Report which surfaces it reaches and confirm the count.

**Tests required**

1. `describeMove` returns correct accuracy, priority, secondary chance, and boosts for a sweep of known moves including a never-miss move, a priority move, a stat-change move, a multi-hit move, and a recoil move.
2. A multi-hit move reports both its per-hit base power and its band, and they disagree without either being wrong.
3. `describeMove` is pure, identical input to identical output, and unreachable from `ui/` state.
4. Opening a move explanation during battle does not submit a move or advance the turn.
5. Exactly one tooltip mechanism exists after the type wheel decision is applied.
6. All suites pass. No log version bump, no `contentHash` change, seeded output byte identical.

**Definition of done**

A player who misses reads why they missed without leaving the battle screen, and the same explanation is reachable from the party screen before the fight starts.

---

## 6. Release C prompt: battle feedback visuals

Paste after Release B is merged.

### PROMPT

You are patching **GYMRUN**. Presentation only. No `core/` state changes, no version bump.

Four additions, all read-only renderings of information the battle protocol already carries.

**Rules that govern all of them**

- No animation blocks input. Every transition is skippable by tapping.
- Total added time per turn is a single number in `data/tuning.ts`. If a playtester says battles feel slow, that is a one-number change.
- Respect the OS reduced-motion setting. Under reduced motion every animation resolves instantly and every flag still displays.
- The headless path never runs any of this. Assert that `core/` contains no timers and that `playRun` completes under Node unchanged.

**Item 1. HP chunk and shadow**

When HP drops, the bar falls immediately to the new value and a shadow segment marks where it was, fading over 0.5 seconds. Duration is a tuning number. The point is that the player sees how much was taken, not only what remains.

**Item 2. Turn order jiggle**

When a turn resolves, the acting side jiggles first, then the other, in resolution order. This is the visual form of the turn order log line from the round 2 patch, so drive it from the same ordered data. Do not compute turn order independently.

Priority marking follows the existing log rule exactly: mark a move as bracket-driven only when the bracket decided it, and leave same-bracket turns unmarked. Two systems disagreeing about what counted as priority is worse than one.

**Report, do not fix here.** The AI is priority-blind and speed-blind. Once the player watches the wrong side jiggle first, misplays that currently read as noise will read as bugs. That fix has its own pass and its own `AI_VERSION` bump. Say in your report whether the jiggle makes it worse. Do not touch `core/battle/ai.ts`.

**Item 3. Flag words**

After a move resolves, short words surface what actually happened: STAB, super effective, not very effective, no effect, critical hit, missed, contact, priority, status inflicted.

- These are **post-resolution truths read off the protocol**, not predictions. They are a different thing from the pre-selection effectiveness marker on the move button, which is a forecast. Do not merge them and do not derive one from the other.
- Build a pure mapper from protocol lines to a flag list in `core/`, unit testable, with the UI rendering only.
- Keep them short and non-blocking. This is a glance, not a combat report.

**Item 4. Berry fired**

4.6b already reads `-enditem` off the protocol to remove consumed berries from run state. Add a flag word on the same signal, naming the berry and what it did. A berry that fires and is never seen firing is indistinguishable from a berry that did nothing, which is the worst possible reading of a one-shot item the player chose to carry.

**Tests required**

1. The protocol-to-flags mapper returns correct flags for a fixed set of recorded turns including a crit, a miss, a no-effect hit, a status infliction, and a berry consumption.
2. Jiggle order matches the log's resolution order for a fixed seed.
3. `core/` contains no timers and `playRun` completes headless unchanged.
4. Under reduced motion all flags still display and no animation delays input.
5. Seeded output byte identical, SMOKE24 included. All suites pass.

**Definition of done**

A player watching a turn can tell who moved first, how much HP was actually taken, whether a berry fired, and why the hit landed the way it did, without reading the log.

---

## 7. Amendment to the 4.6c prompt: HMs are ordinary moves

Apply before pasting Part C. Nothing to build now.

**The change.** HM moves are ordinary attacks. Delete the separate HM item class.

- Delete `data/hms.ts` and the HM item concept entirely, along with the default that HMs are permanent and free of backpack capacity.
- HM moves join `data/movePools.ts` and band through `bandOfMove` like every other move. Do not hardcode their bands in the prompt, read them off the table.
- Delete the rule "Do not add HM moves to the general move reward pools." It existed to protect the HM item path, and that path is gone.
- Acquisition is a preslotted starter, a normal move reward, or a shop move. No teaching screen, no separate flow.
- A displaced capability move is gone, exactly like any other displaced move. That is the whole meaning of "not permanent."
- Delete the special case "There is no decline once teaching is initiated." Release A's decline rule applies uniformly, since teaching is now the move reward flow.
- Simulator: `--policy hm-greedy` no longer means "teaches any HM it acquires." Restate as a policy that prefers capability moves when they appear in a reward offer.

**What survives.** The capability system. `resolveCapability` still returns `none`, `latent`, `known`, still pure. The map still reveals which capability an event needs and the party's band for it. Three band outcomes are still drawn at map generation.

**Two consequences, both data problems not code problems.**

1. **Capability value now correlates with move quality.** Surf is a move a player wants anyway, so Surf events resolve at `known` constantly. Cut and Flash are moves nobody keeps, so those resolve at `none` constantly. The premise that a utility slot is a real cost holds for Cut and collapses for Surf. Fix by distributing events unevenly across capabilities in `data/events.ts`, weighted toward the capabilities nobody would slot voluntarily. Do not fix it by nerfing Surf.
2. **`known` can occur without `latent`.** Under full move randomization a reward can hand Surf to a species that cannot legally learn it. That is consistent with the randomizer and should be allowed. Restate the property test from "teaching an HM always moves `latent` to `known`" to "slotting a capability move yields `known` regardless of prior band," and make `resolveCapability` check slots before legality rather than gating on legality first.

### The two 4.6c blockers, and a way to remove one

**Blocker 1: learnsets are stripped from the bundle.** `build-config/trim-sim-data.ts` strips learnsets, so `latent` cannot be a live dex query and needs a generated `data/hmLearnsets.ts` at roughly 14 kB.

Two options:

- **Generate the table.** 14 kB, faithful to gen 7 legality, one more build-config artifact to keep in sync.
- **Define `latent` by type instead of learnset.** A Water type is latent for Surf, a Flying type for Fly, a Rock or Fighting type for Rock Smash, and so on. No learnset dependency, no generated table, no build-config coupling.

I lean to the second. Move legality is already fiction in this game, since the randomizer hands moves to species that cannot learn them, so a legality-based `latent` is enforcing a rule the rest of the system ignores. Type-based is also the version a player can read off the map without a lookup, which matters because the map reveals the requirement and the band. The cost is that it is less faithful to the source games. Decide before 4.6c starts, because the whole capability system hangs off it.

**Blocker 2: `core/events.ts` cannot produce a battle outcome.** Band 3 requires an event to spawn an encounter, and the outcome union cannot express that today. This is a node model change and it is the real work in 4.6c, so scope it as its own checkpoint rather than as part of the events work.

The gate pass rate target still stands: if `known` fires in under about 5 percent of events, the mechanic is decoration. Expect the first report to split that figure hard by capability rather than showing one number.
