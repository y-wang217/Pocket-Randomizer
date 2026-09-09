# GYMRUN Stage 4.6c: Capability Events and Relics

Supersedes Part C of `gymrun-stage4.6-claude-code-prompts.md` and section 7 of `gymrun-qol-release-plan-rev2.md`. Paste into Claude Code after the `docs/spec/` commit lands.

This is the third and final version of the capability design. Read the supersession notice below before anything else, because both earlier versions are in the repo docs and both are now wrong.

---

## Supersession notice

The capability system has been designed three times.

1. **HMs as items** (original 4.6c). A separate item class, permanent, free of backpack capacity, taught into a move slot. Retired because it needed a teaching flow, a legality table, and a build-config artifact.
2. **HMs as ordinary attacks** (qol rev2 §7). Capability moves join the general move pools and band normally. Retired because it made capability value correlate with move quality: Surf is a move a player wants anyway so Surf events resolve at the top band constantly, and Cut is a move nobody keeps so Cut events resolve at the bottom band constantly. The premise that a utility slot is a real cost holds for one and collapses for the other.
3. **Capabilities as relics** (this document). A capability is granted by a permanent run-scoped passive object. No move slot, no backpack capacity, no teaching, no legality query.

Version 3 is chosen deliberately, and not only because it is simpler. Accumulating passives that are not always applicable are the thing that makes a roguelike run feel like it is building toward something. A relic that does nothing in six fights and wins the seventh is a better object than a move slot that is dead weight in every fight.

**Both blockers named in qol rev2 §7 are closed.** Blocker 1 (learnsets stripped from the bundle) disappears entirely, since nothing here queries a learnset. Blocker 2 (`core/events.ts` cannot produce a battle outcome) was closed by the band 3 mechanism at `316cb6a`.

---

## Report before you write any code

Four questions. Stop and report all four. Do not proceed until reviewed.

1. **What is the shape of the acquisition union after `316cb6a`?** Band 3 introduced an event-spawned encounter whose offer rides on the chosen outcome and is read by `acquisitionOffered`. Report the exact union members and where `resolveNode` applies them, because a relic grant is a new acquisition-shaped thing and it should go through the same path rather than beside it.
2. **Is `resolveCapability` or `core/capabilities.ts` stubbed anywhere in the tree?** Two prior designs specified it. Report whether any of it was built, and whether any test asserts the learnset-based `latent` definition. If a stub exists under the old semantics, say so before overwriting it.
3. **How does `data/rewardPools.ts` key entries after the 4.6b rekey and the 4.5.1 gym pool?** A relic is a new reward kind and it needs a home in that structure without a fourth axis. Report the current key shape and where a kind that should only appear at elite and gym would sit.
4. **Does anything still read `data/hms.ts`, `tuning.allowSpeciesRewards`, or an HM branch in the reward or teaching flow?** Both were slated for deletion in earlier passes. Report what actually remains so this stage deletes rather than layers.

---

## Order of work, stop for review after each

1. `core/relics.ts` and `core/capabilities.ts` as pure functions, with tests. No events, no UI.
2. Relic acquisition through the existing reward and acquisition paths, with log and determinism tests.
3. Three-band event outcomes wired to `resolveCapability`, drawn at map generation.
4. Simulator: gate pass rate per capability, relic acquisition rate, `--policy relic-greedy`.
5. UI: capability requirement and band on the map, event screen bands, relic display.

UI comes last, as in every prior stage.

---

## What a relic is

```ts
type RelicId = string;

type Relic = {
  id: RelicId;
  name: string;
  grants: Capability;
  passive: RelicPassive;
  playerDescription: string;
};
```

Rules:

- A relic is acquired once and held for the rest of the run. It cannot be discarded, swapped, sold, lost on a faint, or removed by any path.
- It does not occupy backpack capacity and does not interact with `tuning.backpackCapacity` in any way.
- It is not held by a Pokemon. It belongs to the run, not to a party member. `RunState` gains `relics: RelicId[]`.
- A relic is never offered twice. Offer generation filters against relics already held. Because offers are drawn at map generation and acquisition happens during play, the filter runs at offer resolution, not at draw time, so that filtering does not shift a draw. If every relic in a pool is already held, the offer slot falls back to the pool's ordinary contents.
- Exactly one capability per relic. Multi-capability relics are a later idea.

`data/relics.ts` holds the table. Eight capabilities, so start at eight to twelve relics, with at least one per capability.

### The passive

Each relic grants a capability and one small always-on effect. The capability is what gates events. The passive is what makes the relic feel like a relic rather than a key.

**Passives in this stage are run-layer only, expressed as a declarative typed union**, same posture as event outcomes:

```ts
type RelicPassive =
  | { kind: 'nodeHeal', percent: number }        // heal on entering each node
  | { kind: 'nodeCurrency', amount: number }     // currency per completed battle node
  | { kind: 'backpackSlots', count: number }     // raises effective capacity
  | { kind: 'reviveBonus', percent: number }     // adds to tuning.reviveHpPercent
  | { kind: 'shopDiscount', percent: number }
  | { kind: 'none' };
```

Never a callback. Passives must serialize into the log and the simulator must be able to score them without executing arbitrary code.

**In-battle passives are deliberately out of scope for this stage.** A relic that changes damage, speed, or status resolution has to reach into the battle driver and the sim spec, and that is a separate pass with its own balance report. `{kind: 'none'}` exists so a relic can ship as pure capability until that pass lands. Say in your report how many relics you gave a real passive and how many are `none`.

Application is centralised: one pure function `applyRelicPassives(state)` that folds the held relics into the run-layer numbers. Do not scatter `if (hasRelic(...))` through the run loop.

---

## Capabilities

```ts
type Capability = 'cut' | 'surf' | 'strength' | 'rockSmash' | 'fly' | 'waterfall' | 'dive' | 'flash';
type CapabilityBand = 'none' | 'latent' | 'known';
resolveCapability(state: RunState, cap: Capability): CapabilityBand
```

- **`known`** if the run holds a relic granting that capability.
- **`latent`** if any party member's species has a type in the capability's type set. Type sets live in `data/capabilities.ts`, for example Surf is satisfied by Water, Fly by Flying, Rock Smash by Rock or Fighting.
- **`none`** otherwise.

Latent is defined by **type, not by learnset**. Move legality is already fiction in this game, since the randomizer hands moves to species that cannot learn them, so a legality-based band enforces a rule the rest of the system ignores. Type is also the version a player can read off the map without a lookup, which matters because the map reveals the requirement and the band.

Note the signature change from earlier drafts: it takes `RunState`, not `party`, because `known` is now a run property rather than a party property. Keep it pure and free of RNG. `core/capabilities.ts`.

Property tests: a Water type in the party resolves at least `latent` for Surf; a party with no matching type and no relic resolves `none`; acquiring the relic yields `known` regardless of the party's prior band, including from `none` and including with an empty-ish party.

---

## Event bands

Every event names exactly one required capability and carries three outcome sets. All three are drawn at map generation from the `rewards` key and selected at resolution time, so RNG consumption is identical regardless of which band applies. This rule is unchanged from the original 4.6c and it is what keeps party state from moving the streams.

- **`none`.** A minor payout: a berry, a small heal, or a little currency. The event still resolves and still pays. A player with nothing is unrewarded, not punished.
- **`latent`.** A real payout: a larger heal, a held item, a move one band above the segment's current band, or a large currency lump. The party can improvise the job.
- **`known`.** The band 3 encounter built at `316cb6a`. A Pokemon holding a good item, capture offered on victory, and declining the capture still yields the item alone.

**Event distribution across capabilities is a data lever, in `data/events.ts`.** Under the relic design the correlation problem from version 2 is gone, since capability no longer rides on move quality. A weaker version survives through `latent`: Water and Flying types are common, Ghost and Dragon are not, so capabilities keyed to common types will resolve at `latent` more often. Weight event counts against that, and do it in the table rather than by adjusting type sets.

---

## Acquisition

Three paths, no teaching screen and no separate flow:

1. **Reward pools.** Relics appear at elite and gym tiers only. Never normal, never hard. A relic is the payoff for the risky path.
2. **Shops.** A relic appears in shop stock occasionally, priced high. Stock is generated at map generation from the `rewards` key, same rule as everything else.
3. **Event payouts at `latent`.** Optional, and only if the report in question 3 shows a clean place for it. Do not force it.

There is no starter path. The preslotted-HM starter from the original design is deleted along with the rest of that lineage, because a relic does not sit in a move slot and there is nothing to preslot.

Taking a relic from a reward offer is an ordinary card pick. It introduces **no new logged decision**, which is the main reason this stage is cheaper than the two designs it replaces.

---

## What gets deleted

Delete, do not leave behind a flag:

- `data/hms.ts` and the HM item class entirely, if question 4 shows anything remains.
- The rule "Do not add HM moves to the general move reward pools," and the opposite rule from the rev2 amendment. Neither applies. HM-named moves are ordinary moves in the pools and band through `bandOfMove` like anything else, and they have **no relationship to capabilities**. A Pokemon knowing Surf does not grant the Surf capability. Only the relic does.
- Any `latent` definition that queries a learnset, and any generated `hmLearnsets.ts` or plan for one.
- The special case "There is no decline once teaching is initiated," which was already retired by Release A's uniform decline rule and now has no flow to attach to.

Record the supersession in `docs/generation.md` with a dated note, in the same style as the §8 correction, naming all three designs and why the first two were retired. A future reader will find both earlier versions in `docs/spec/` and needs the pointer.

---

## The map reveals the requirement

An event node on the map shows which capability it needs and the run's current band for it. It does not show the reward.

This sits inside the Part 4 editorial rule. "Requires Cut. Your run: latent." is an attribute readout. "Take this, you will do well" is a verdict. Revealing the requirement is what makes routing a plan rather than a lottery, and it is what makes a relic feel like it changed the map rather than the character sheet.

---

## Determinism and versioning

- **`contentHash` moves.** `data/relics.ts` is new, `data/capabilities.ts` is new, `data/rewardPools.ts` and `data/events.ts` change. Seeds do not survive this stage, which is expected and accounted for: the freeze is still at the end of 4.6c.
- **`RANDOMIZER_VERSION` bumps once**, to 11. Reward pool composition changes, so every reward roll moves.
- **`RUN_LOG_VERSION` does not bump.** No new logged decision. Relic acquisition is an ordinary reward card pick, capability resolution is derived from state, and passives are applied deterministically from the held set. If you find yourself needing a bump, stop and report why, because it means something added a decision that this design says should not exist.
- Note for the version guard message: `RANDOMIZER_VERSION` and `RUN_LOG_VERSION` are both currently 10, so a mismatch message must name which axis moved and both values. If it currently prints only a number, fix that as part of this stage.
- No new RNG streams. Relic offers draw under the existing `rewards` key. The already-held filter runs at resolution, not at draw, so a relic acquired mid-run cannot shift a later draw.

---

## Simulator

Balance is not a gate on progress here. Record the numbers, note anything that looks broken, and keep going. Report against the pinned benchmark rather than stopping to retune.

**Benchmark on mean gyms cleared, not completion rate.** Completion rate is a rare-event statistic at a few percent and it discards every run that died at gym 3. Mean gyms uses the whole sample and moves on changes that completion rate cannot see. Keep completion in the report, benchmark on mean gyms.

Every benchmark figure must be stamped with its seed prefix and seed count, in the file, next to the number. Reading across prefixes has already produced one false finding.

Add to the report:

- Gate pass rate per capability: the share of events resolving at `none`, `latent`, and `known`. Expect this to split hard by capability rather than showing one number. If `known` fires in under about 5 percent of events across the whole sample, relics are too rare and the mechanic is decoration.
- Relic acquisition rate, and the distribution of how many relics a run holds at gym 8.
- `latent` rate per capability, which is the direct measurement of the common-type skew described above and the input to weighting `data/events.ts`.
- Mean gyms for runs holding at least one relic against runs holding none. Correlational and confounded, since relics come from elite nodes and elite-taking policies differ. Print sample sizes and treat it as a flag, not a finding.
- Add `--policy relic-greedy`: always takes a relic when one is offered. Its mean gyms against `tier-greedy` is the crude measure of whether relics are worth their offer slot.

---

## Tests required

1. `resolveCapability` over known cases at each band, plus a property test that holding the relic yields `known` from any prior band, including `none`.
2. A relic is never offered when already held, over many seeds, and the fallback fills the slot.
3. A relic cannot be discarded, swapped, or destroyed: assert there is no path from backpack discard, item swap, faint, or party replacement that removes an id from `state.relics`.
4. Relic passives fold deterministically: `applyRelicPassives` is pure and identical input gives identical output, including with duplicate-adjacent passives from two relics.
5. Backpack capacity is unaffected by relics except through an explicit `backpackSlots` passive.
6. All three band outcomes are drawn at map generation and RNG consumption is identical regardless of which band resolves. Two runs on the same seed with deliberately different parties, asserted on draw counts.
7. A `known` band event spawns the encounter, victory offers the capture, and declining still grants the item. This is the `316cb6a` mechanism, so extend its fixture rather than writing a second one.
8. Event outcomes serialize and replay to identical state under the three-band shape, and a saved run replayed with the same decision log resolves the same band.
9. Determinism and stream isolation pass unchanged under the keyed streams.
10. Version guard: a pre-stage log throws with a message naming which axis mismatched and both values.
11. All prior suites pass, except those asserting an HM item, a teaching flow, or a learnset-based `latent`, which are updated with a comment naming this stage rather than deleted.

---

## Definition of done

A player looks at a fork, sees an event that requires Surf and that the run is at `latent` for it, and routes toward it knowing roughly what they will get. Two segments later they take an elite node instead of a safe one, get the relic, and the same class of event starts paying out an encounter. A different player who never took an elite node reads the same map, understands exactly why their band is lower, and still gets a berry out of the event.

---

## Defaults I am taking, flagged for your review

- **`latent` is type-based, not learnset-based.** This is the load-bearing choice and it removes the 14 kB generated table and the build-config coupling. It is less faithful to the source games. Say so if that matters more than I think it does.
- **In-battle relic passives are deferred.** Relics in this stage change run-layer numbers only. This keeps the stage off the battle driver and out of a balance argument, at the cost of relics feeling thinner than Slay the Spire relics do. Their own pass, after the AI fix.
- **Relics are elite and gym only.** Making them reachable from normal nodes would decouple them from the risk gradient, which is the thing Stage 3 exists to protect.
- **Knowing a capability-named move grants nothing.** Only the relic grants `known`. This is what keeps version 2's correlation problem from coming back in through the side door, and it means Surf-the-move and Surf-the-capability are unrelated systems that share a name. If that reads as confusing in playtest, rename the capabilities away from the HM names rather than reconnecting them.
- **The priority-blind and speed-blind AI stays out**, as it has since 4.6 was split, so its effect on the table stays separable. It is next after this stage.
