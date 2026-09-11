4.8 update: GYMRUN Stage 4.8: Stakes and Progression
Paste into Claude Code in the existing repo, after 4.7.1 is merged.
PROMPT
You are building Stage 4.8 of GYMRUN. Read `docs/spec/pokerun-build-spec.md`, `docs/generation.md`, `docs/balance.md`, and the existing `src/core/` before writing anything.
4.7 made the run legible. 4.8 makes it feel like it accumulates. The player's roster grows on a visible schedule, gym clears pay the largest reward in the game, later regions are physically bigger, and the run ends with a score and a record of what died on the way.
This patch adds no new mechanics to combat and changes no encounter difficulty. It is progression, economy and readout only. That separation is deliberate: encounter difficulty and the revive economy are backlogged so that when they land, their effect on the benchmark is separable from everything here.
The framework this patch is sorted against
Two axes govern the project now.

* Enjoyable. A challenge the player can learn and improve at. Generator and mechanics work.
* Ease. Communication, UI/UX, making good moments satisfying and deaths regrettable.

Items 1 to 3 below are Enjoyable. Items 4 to 7 are Ease. Where the two conflict in this patch, Ease wins, because the mechanics are deliberately frozen while playtest feedback matures.
Rules that hold, unchanged

* `core/` never imports from `ui/`. No `Math.random`.
* Every balance or copy number a tuning pass would touch lives in `data/`.
* The Part 4 editorial rule from Stage 4.5.1 governs all copy added here: the UI presents attributes, never verdicts. No recommendations, no "best" markers, no ordering that implies ranking. The one standing exception remains live type effectiveness against the Pokemon currently on the field.
* UI comes last.
* Commit at each checkpoint and stop for review.

Report before you write any code
Four questions. Each one can change the shape of an item below.

1. Are relics currently drawable as a reward, or only granted through the 4.6c capability path? Item 2 offers a relic against gold at gym clear. If relics are capability-only today, report what it would take to make one drawable from a pool, and whether `data/relics.ts` already carries enough metadata to render a reward card.
2. Where does party size actually live, and how many call sites derive from it? Report the current value, every read site, and specifically how `tuning.backpackCapacity` derives from it, since that value moves with item 1.
3. What is `tuning.stepsPerSegment` today, a scalar or already a per-segment lookup? Report the shape before item 3 changes it, and report which composition guarantees from 4.6a are enforced against it.
4. What does the run state retain about a faint today? Item 5 needs a death record. Report whether faints are observable in run state after the fact, or whether they are only visible in the battle protocol at the time they happen.

Stop and report all four. Do not proceed until reviewed.

Order of work, stop for review after each

1. The four report questions. Report, do not code.
2. Party slot unlocks (item 1) through every call site. Tests. No UI.
3. Gym clear reward (item 2) and later-region node counts (item 3). Generation and composition tests. No UI.
4. Score function (item 4) as a pure core function with tests. No UI.
5. Death records and nicknames (item 5). Tests.
6. Party threat readout (item 7) as a pure core function with tests.
7. All UI, including the result screen, the shareable artifact (item 6), and the taller map.
8. Benchmark run, recorded against the pinned figure. Do not stop to retune.

Item 1: Party slots unlock on gym clears
Today the party is whatever size it starts at. That makes gym clears structurally identical to any other node completion, and it makes the whole first half of a run play at the same roster width as the second half.

* Party capacity is a function of gyms cleared, read from a `slotUnlockSchedule` table in `data/partyTuning.ts`. Report the current starting size first, then propose a schedule that reaches a maximum by roughly gym 6, leaving the last two gyms as a wide-roster endgame rather than a growth phase.
* The unlock is automatic and visible, not a reward card. It is granted alongside the gym reward offer, not instead of part of it.
* `tuning.backpackCapacity` continues to derive from current party capacity, so it grows on the same schedule. Confirm this reads live capacity and not a value captured at run start.
* Every call site that assumes a fixed party size must read current capacity. Grep the capture flow, the full-party replacement path, the party drawer, the pre-gym lead selection, and the sim policies. A slot unlock that does not reach the capture flow means a player is told they have room and then asked to replace someone.
* The map or result screen states the next unlock plainly. "Party slots: 4. Next slot at Gym 4." is an attribute readout. Do not editorialise about whether the player should save a slot.

Determinism. Capacity is derived from gyms cleared, which is derived from the decision log. It is not a new logged decision and it consumes no RNG. Do not store capacity in the log.
Item 2: Gym clear reward
Gyms currently pay a segment-keyed pool that is strictly better than elite. That stays true, but the shape changes: a gym clear now pays twice.
Part A, guaranteed and automatic. A move at one band above the segment's current band, matching the +1 band that gym leaders themselves draw at in `data/scaling.ts`. Read that same number, do not introduce a second one. It routes through the existing move learning flow: recipient selection, then replacement, then whatever decline behaviour is current in the tree at the time you build this. Do not build a second move-granting path.
Part B, a choice of two. A relic, or a currency lump. Exactly two cards, not three.

* This deliberately retires the "exactly 3 distinct options" rule for gym offers only. Every other offer in the game stays at 3. Record the exception and the reason in `docs/generation.md` next to the existing reward entries, so a future reader does not read it as a bug and normalise it back.
* The relic pool and the currency amount both live in `data/rewardPools.ts`, keyed by segment index, consistent with how the gym pool has been keyed since the round 2 patch.
* The currency lump must be priced against what `data/shop.ts` actually sells at that segment. Gym currency already took 59.7 percent of picks against the old field. If it dominates again here it is a pricing problem in `shop.ts`, not a pool problem, and this is a two-card choice so a 60 percent split is much less alarming than it was against three.
* Both draws happen at map generation, from the `rewards` key, same rule as every other offer. Nothing draws at gym completion.

Item 3: Later regions have more nodes
A segment is the same length at gym 8 as it was at gym 1, so the run does not physically grow.

* `tuning.stepsPerSegment` becomes a per-segment curve, shortest early and longest late. Put the curve in `data/tuning.ts` as a table, not a formula, so a tuning pass edits numbers rather than logic.
* Every 4.6a composition guarantee holds at every length. Exactly one reachable wild encounter per segment, at least one event offered, at least one reachable rest. Where a guarantee was expressed as a fixed count, restate it as a function of segment length. In particular, one rest node across a long late segment is a different amount of recovery than one rest across a short early one, so express the rest guarantee as a floor per N steps and put N in `tuning.ts`.
* The wild encounter placement rule from 4.6a is unchanged: it is either the only option on its step, or present on every option of that step.
* Generation still happens in one pass at run creation, including routes for every offered locale.

Determinism. This changes what existing keys produce, so `randomizerVersion` bumps. Draw order under keyed sub-streams does not shift, but the values do, and every seed in circulation dies with this patch. That is expected and acceptable: seeds remain disposable until the freeze.
Map overflow. SMOKE24 is currently marked xfail for map overflow at 4.7. Longer segments make the map taller and turn that from cosmetic into a real failure. The UI checkpoint must close SMOKE24, not re-mark it. If the vertical chain cannot fit the longest segment on a 390x844 phone with the decision point above the fold, that is the constraint the map redesign has to satisfy, and it is the reason this item's UI is not a trivial pass.
Item 4: The score
The run currently ends in a binary: eight gyms or dead at gym N. There is no readout of how well the run went, which is the single clearest answer to "am I doing well" and the thing a leaderboard will eventually read.

```ts
scoreRun(state: RunState): ScoreBreakdown

```

Pure, in `core/scoring.ts`, no RNG, no DOM. Returns a breakdown with a component list and a total, never a bare number.
Components to compute. Gyms cleared. Hard nodes taken. Elite nodes taken. Party members surviving at run end. Captures made. Relics held. Turns taken, recorded as a component.
Weights live in `data/scoring.ts`. Every component is computed and displayed regardless of weight. Weights start with gyms cleared dominant, hard and elite nodes paying a visible amount, survivors paying a small amount, and turns weighted at zero. Recording turns without scoring them means the data exists for a later decision about pace without this patch taking a position on fight length, which is explicitly out of scope.
The reason risk components carry weight at all: a score that pays only for clearing gyms teaches players to route around every hard node, which is the opposite of the intended experience. Score is the game telling the player what to chase, so it must pay for the thing the run is built around.
Part 4 applies, with a specific prohibition. Do not display projected score on node cards, tier badges, or reward cards. A node card reading "+30 score" turns the risk decision into a scoreboard hint and is a verdict about a future decision, not an attribute of the present board. Score surfaces on the result screen and nowhere else in this patch. Flag this as a deliberate default in your report if you disagree.
Simulator. Report mean and median score alongside mean gyms cleared. Do not replace the benchmark metric: mean gyms cleared stays the pinned figure, per the standing rule, and score joins the report as a second column.
Item 5: The graveyard
A death is currently a state transition with no memory. The run ends and the player cannot reconstruct what they lost or when.

* Run state records a death entry each time a party member faints and is not recovered: the member, its nickname, species, level, the segment and node where it fell, the opposing species, and the move that landed the kill. Report question 4 covers whether this is reconstructable today; the 4.7 damage attribution work had to reconstruct victims from `-damage` lines, so expect the same shape here.
* Nicknames. Every party member gets one on acquisition, derived deterministically from a keyed stream and a name table in `data/nicknames.ts`. Player-typed nicknames are out of scope: they would be a logged decision and a run log bump, and they add a text input to a mobile flow. Derived names cost one new key and no schema change.
* Nicknames appear everywhere a party member renders: party drawer, battle panel, recipient selection, capture card, result screen. A death entry is unreadable if the name only exists on the tombstone.
* The result screen shows the graveyard in run order. Factual entries only. "Bramble, Weepinbell, Lv31, fell at Gym 5 to Arcanine, Flare Blitz." No commentary, no "unlucky", no counterfactual.

Determinism. Death records are derived from replay, not logged decisions. They must reconstruct identically from a replayed log. The nickname draw is a new key under the keyed derivation, so it shifts nothing.
Item 6: The shareable result
The result screen becomes the artifact of the run.

* Contents: seed, score with its component breakdown, gyms cleared, final party with nicknames and species, the graveyard, relics held, and the locales the run passed through.
* A single copy action puts a plain-text version on the clipboard, formatted to survive a paste into Discord or a message thread without a monospace assumption. Keep it short enough to read without scrolling in a chat client.
* No image generation, no canvas render, no share sheet integration in this patch. Text on the clipboard is the whole feature.
* The seed in the copied text is the bare seed. When contentHash ships as its own feature, this is where the versioned seed string replaces it, so keep the seed rendering in one function.

Item 7: Party threat readout
A factual readout of what the party is exposed to.

```ts
partyThreats(party: PokemonState[]): TypeName[]

```

Pure, in `core/`, alongside `offensiveCoverage`. Returns the set of types that hit at least one party member super effectively, minus the types the party's current damaging movesets already hit super effectively.

* Same treatment as the coverage one-liner: a factual set, rendered as a list. "Watch for: Ground, Ice." is correct. "Your party is weak to Ground" is a verdict and so is any colour coding that implies danger levels.
* Surfaces on the party drawer only in this patch. Do not put it on the map, the locale select screen, or the pre-gym screen: against a known gym type identity it becomes a routing recommendation.
* The function is pure and RNG-free so it can be lifted into the simulator later. Do not wire it into the simulator here.

Version axes

* `randomizerVersion` bumps once. `tuning.stepsPerSegment`, `data/rewardPools.ts`, `data/partyTuning.ts` and `data/scoring.ts` all move, and the nickname key is new.
* Run log version does not bump. Nothing in this patch adds, removes or reorders a logged decision. Party capacity is derived, nicknames are derived, death records are derived, score is derived. If you find yourself needing to log any of them, stop and report before bumping, because it means something in the derivation is not actually deterministic.
* `contentHash` does not exist yet and is out of scope. Do not build a partial version of it.
* The freeze that was nominally due at the end of 4.6c has not happened. Do not stamp one here either. State plainly in your report that seeds remain disposable.

Tests required

1. Party capacity follows `slotUnlockSchedule` exactly, and every call site including the capture flow reads live capacity rather than a start-of-run value.
2. `backpackCapacity` grows with party capacity, over a full run, at every unlock boundary.
3. A gym clear produces exactly one guaranteed move at segment band +1 and exactly two choice cards, over many seeds and every segment index.
4. Both gym draws come from the `rewards` key at map generation, and stream isolation passes: the gym draws shift no other key's output.
5. Every 4.6a composition guarantee holds at every segment length in the new curve, over many seeds: one reachable wild encounter, at least one event, and at least the required rest floor.
6. `scoreRun` is pure, identical input to identical output, and its total equals the weighted sum of its components. A component weighted zero contributes zero and still appears in the breakdown.
7. Score is unreachable from node card, tier badge and reward card rendering. Assert per surface.
8. A death record reconstructs identically from a replayed log, including the killing move and the segment it happened in.
9. Nicknames are deterministic for a fixed seed and identical across a save, reload and replay.
10. `partyThreats` returns correct sets over known cases including a party with no super-effective coverage and a party that answers every threat, and is pure.
11. SMOKE24 passes on the longest segment length in the curve, on a 390x844 viewport, with the decision point above the fold. The xfail marker is removed, not moved.
12. Determinism and stream isolation pass unchanged. Run log version unchanged, asserted.
13. All existing suites pass, except those asserting a fixed party size, a three-card gym offer, or a scalar `stepsPerSegment`, which are updated with a comment naming this patch rather than deleted.

Out of scope
Encounter difficulty changes. Revives, or any change to faint recovery. Any redefinition of run length beyond the node count curve. Permadeath. The fight-length investigation. contentHash. The priority-blind and speed-blind AI. Tutorial or onboarding of any kind. Rarity-weighted scoring against a field of other players. Leaderboards, daily seeds, and anything that transmits a result off the device. Image rendering of the result. Player-typed nicknames. Move storage, box storage, selling to shops, reward rerolls.
Definition of done
A player clears gym 2 and is told they now carry another Pokemon, then takes a strong move and picks a relic over the gold. Segments get visibly longer as they go, and the map still fits on a phone. When the run ends they see a score with its parts shown, a list of everything that died and what killed it, and one tap puts the whole thing on the clipboard. The benchmark is recorded against the pinned figure, whatever it says, and the patch moves one version axis.
Defaults I am taking, flagged for review

* Score does not appear during the run. Only on the result screen. A projected score on a node card is the most natural place to put it and the most direct violation of the attributes-never-verdicts rule.
* Turns are recorded at weight zero. The data exists for a later pace decision without this patch taking a position on fight length.
* Nicknames are derived, not typed. Player-typed names would force a run log bump and add a text input to a mobile flow.
* The gym offer is two cards, not three. This is the only offer in the game that breaks the three-option rule, and it is broken deliberately because a relic-versus-gold decision is a cleaner choice than a padded third option.
* The threat readout lives on the party drawer only. On the map or the pre-gym screen it becomes routing advice.
* double check before finishing that we caught the bug where gym lead selection screen goes to party and clicking back to map leads to softlock and cant return to gym
