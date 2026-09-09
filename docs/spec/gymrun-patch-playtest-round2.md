# GYMRUN Patch: Playtest Feedback Round 2

Paste into Claude Code in the existing repo. This is a patch, not a stage. It sits on top of whatever stage is currently merged.

---

## PROMPT

You are patching **GYMRUN** against a round of playtest feedback. Read `pokerun-build-spec.md`, `docs/generation.md`, and the existing `src/core/` and `src/ui/` before writing anything.

All eleven items below came from one session. Most are readability and feedback problems, not mechanics problems. Two of them may already be implemented and only invisible, so verify before you build.

The existing rules still hold. `core/` never imports from `ui/`. No `Math.random`. Every balance or copy number that a tuning pass would touch goes in `data/tuning.ts`. Determinism tests must still pass at the end.

### Order of work, stop for review after each

1. **Verification pass.** Items A and B below are diagnosis, not implementation. Do these first and report what you find before writing code for them.
2. **Battle readability:** turn order display, priority display, switch indication, per-move effectiveness hints.
3. **Run flow:** post-battle result screen, gym clear reward.
4. **Mobile pass:** move selection, map visibility, stat visibility, stat display on pick screens.
5. **Copy fixes:** the HP percentage wording.

---

## A. Priority moves: verify before implementing

**Feedback:** "Priority doesn't exist, implement priority moves."

**Hypothesis:** priority is already fully implemented, because `@pkmn/sim` resolves turn order natively including priority brackets, and we do not compute turn order ourselves. What is missing is that the player cannot see it happen, so a Quick Attack going first reads as a bug or as random.

**What would disconfirm this:** write a test that sends a slower Pokémon using Quick Attack against a faster one using Tackle, and assert against the raw battle protocol that the Quick Attack move message comes first. If it does, this is a display problem and it is fixed by item C, not by new mechanics. If it does not, something in the battle driver is overriding or reordering the protocol stream, and that is the real bug. Report which one you find.

Also check the reverse case: confirm the AI in `core/battle/ai.ts` is not selecting moves in a way that ignores priority when computing expected damage. A greedy damage-max policy that does not know it is about to be outsped by a priority move will misplay obvious situations. If the AI is priority-blind, say so and propose the fix separately. Do not silently rewrite the AI inside this patch.

## B. Effectiveness hints: they are reading the wrong thing

**Feedback:** the "will not do anything for" tip is not helpful because it should reflect the moveset, not the Pokémon's typing.

**Hypothesis:** the hint is computed from the defending Pokémon's type against the attacker's *species* types, not against each *move's* type. With randomized movesets that is close to meaningless: a Pokémon's STAB types tell you almost nothing about what its four moves actually do.

Fix: compute the hint per move, at the point the move buttons are rendered.

- Each move button carries its own effectiveness marker against the current opposing Pokémon: no effect, not very effective, neutral, super effective.
- Derive it from the move's type and category, not the user's types. Status moves get no effectiveness marker at all, since the concept does not apply.
- Use `@pkmn/dex` type chart data for this. Do not hand-roll a type chart.
- Keep this in a pure helper in `core/` (a function from move plus defender to an effectiveness enum) so it is unit testable and so the UI stays a renderer. Property test it against a handful of known matchups including a zero-effect case such as Ground versus Flying and an immunity from an ability if abilities are visible to the player.

Remove the old species-level tip entirely. Two competing hint systems is worse than one wrong one.

## C. Turn order and switch indication

**Feedback:** indicate who went first, and indicate when a Pokémon switches.

The information is already in the battle protocol. This is a rendering job.

- The battle log entry for each turn must make the sequence unambiguous. A turn header, then the first actor's action, then the second actor's. If a move went first because of priority rather than speed, mark it in the log line. One short marker is enough, something like a priority tag next to the move name.
- Keep it fast to read. This is not a combat replay feature. A player should get the sequence at a glance without expanding anything.
- Opponent switches get their own log line and a brief visual beat on the sprite swap. Same constraint: simple and fast. Player switching does not exist until Stage 4, so build the log line generic over which side switched rather than hardcoding the opponent.
- Do not add animations that block input. Any transition must be skippable by tapping.

## D. Post-battle result screen

**Feedback:** there is no result screen after wins that carry no reward.

Every node resolution ends on a result screen, whether or not a reward is granted. Currently the reward screen is doing double duty as the result screen, so a rewardless win drops the player straight back to the map with no confirmation that anything happened.

- Route every battle completion through a single result screen. Reward cards, when present, render inside it rather than replacing it.
- Contents: outcome, the party's HP and PP state after the battle, currency earned if any, and a continue action.
- This hangs off the existing `resolveNode` hook. Do not add a second path by which a node completes.

## E. Gym clear reward

**Feedback:** clearing a gym should offer a big reward.

Gyms currently pay nothing, which makes the hardest fight in the segment the least rewarding node in it.

- Add a gym reward pool in `data/rewardPools.ts`, keyed by segment index rather than tier, since gym nodes carry no tier by design.
- Same shape as every other offer: exactly 3 distinct options, one pick, no skip, no reroll.
- Entries are strictly better than elite node rewards. If a gym reward looks like an elite reward, the clear does not feel earned.
- Draw the offer at map generation from the `rewards` stream, same rule as every other offer. Do not draw at gym completion.
- The simulator must pick these up automatically through the existing `chooseReward` policy hook. Add gym reward take rate to the report so a tuning pass can see whether one entry dominates.

## F. Mobile pass

The build is being played on a phone. Treat mobile as the primary target for these four items, not as a later responsive sweep.

**Move selection.** The current layout is not intuitive on a touch screen. Requirements: four move buttons in a 2x2 grid filling the width, each showing move name, type, category, PP remaining out of max, and the per-move effectiveness marker from item B. Minimum touch target 44px. No hover-dependent information anywhere, since hover does not exist on a phone. Anything currently revealed on hover moves onto the button face or into a tap-to-expand row.

**Map visibility.** The player cannot see the map on mobile. Diagnose before redesigning: it is most likely a horizontal chain wider than the viewport with no scroll affordance. Fix by rendering the chain vertically on narrow viewports, scrolling to the current step on mount, and keeping completed, current, and upcoming states visually distinct at small sizes. The offered node cards for the current step must be fully visible without scrolling, since that is the decision point.

**Stat visibility in battle.** Stats are hard to see. Both Pokémon show name, level, HP as both a bar and a number, status, and any non-zero stat stages. Stat stages need a compact readable form, not tiny icons. Nothing important may sit below the fold during a battle.

**Stats on pick screens.** Starter select and any reward card that offers a species currently show a sprite and a name and little else. Add base stats, types, ability, and moves to each option. A pick with no visible stats is a coin flip, and coin flips are exactly what the spec says this game should not have.

## G. HP percentage copy

**Feedback:** "You are 11% down" is not clear after you heal.

The phrasing describes a delta but reads as a state, and after a heal it contradicts what the player just watched happen.

- Replace it with current state, not change: current HP over max, plus the percentage remaining.
- Healing gets its own explicit line naming the amount restored.
- Put every player-facing HP string in one place so wording is a one-file change. If copy is currently inline in components, extract it.

---

## Tests required

1. Priority: a slower Pokémon using a priority move acts first, asserted against the battle protocol, not against internal state.
2. Effectiveness helper: unit tests over known matchups including immunity, and a property test that status moves never return an effectiveness value.
3. Turn order log: for a fixed seed, the log lines appear in resolution order and a priority-driven turn is marked as such.
4. Every battle node completion reaches the result screen, including wins with no reward.
5. Gym clear produces an offer of exactly 3 distinct options, drawn from the `rewards` stream at map generation.
6. Determinism: same seed, identical map, identical reward offers including the new gym offer, twice.
7. Stream isolation: the gym reward draw does not shift map, battle, or randomizer output for a fixed seed.
8. Version guard: bump the run log version, and a pre-patch log throws on replay with a message naming the mismatch.
9. All existing suites pass unchanged.

## Definition of done

On a phone: the map is readable and scrolls to the current step, move buttons show PP and per-move effectiveness, the battle log makes turn order and priority obvious, every win lands on a result screen, clearing a gym offers three strong rewards, and no HP message contradicts what just happened on screen.

## Working method

Verification pass first, then core logic with tests, then UI. Commit at each checkpoint and stop for review. If any item turns out to be a data or copy change rather than a code change, say so and make the smaller change.
