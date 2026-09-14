# Event Rejig — step 1 report

Answers to the four report questions in
[`../spec/gymrun-patch-event-rejig.md`](../spec/gymrun-patch-event-rejig.md),
plus one finding the prompt does not ask about that changes the shape of the
patch more than any of the four. **Report only. No code written.**

Read against `src/core/events.ts`, `src/data/events.ts`, `src/core/capabilities.ts`,
`src/data/capabilities.ts`, `src/data/relics.ts`, `src/core/relics.ts`,
`src/data/rewardPools.ts`, `src/core/rewards.ts`, `src/core/encounters.ts`,
`src/core/run.ts`, `src/core/types.ts`, `src/data/eventCopy.ts`, `src/data/locales.ts`.

---

## 1. Choices survived. Bands layered on top of them, they did not replace them.

`EventInstance` still carries `choices: EventChoice[]` (`core/events.ts`), the
policy still asks `chooseEventOption(event, state): Promise<number>`
(`core/run.ts`), and every one of the eight entries in `data/events.ts` has two
or three authored choices. Nothing auto-resolves.

What 4.6c actually did was make each choice carry **three** outcomes rather than
one:

```ts
export interface EventChoice {
  label: string;
  hint: string;
  outcomes: Readonly<Record<CapabilityBand, EventOutcome>>;   // none | latent | known
}
```

So the shape today is `choice × band → outcome`, resolved by `outcomeAt(choice,
resolveCapability(run, event.requires))`. The player picks the choice; the run's
standing picks the column.

**Consequence for this patch: it is smaller than the prompt allows for.** The
menu exists, the policy hook exists, the UI screen exists
(`ui/screens/`, `test/event-screen.test.ts`). What changes is what an option
*means* — from "one of N authored buttons" to "one of four archetypes" — and the
band record collapses from a 3-wide selector to a 1-wide outcome plus a boolean
that decides whether the Attune option is on the menu at all.

One thing the prompt should know: the current choice count is **2 or 3**, and
`data/events.ts` documents "one choice is not an event, it is a cutscene" as the
floor. Part 2 raises the floor to 3 and the ceiling to 4. That is a real change
to the phone layout budget, not just to the data.

---

## 2. `resolveCapability` still returns three bands, and `latent` is not dead — it is the common case.

Live signature, unchanged from 4.6c (`core/capabilities.ts`):

```ts
export type CapabilityBand = 'known' | 'latent' | 'none';
export function resolveCapability(run: CapabilityContext, capability: Capability): CapabilityBand
```

- `known` — the run holds a **relic** granting the capability. This is the only
  way to reach it. `grantsCapability(run.relics, capability)`.
- `latent` — no relic, but some party member's **species type** is in
  `CAPABILITY_TYPES[capability]`. Fainted members count.
- `none` — neither.

`latent` is alive and it is load-bearing in a way the prompt's framing does not
anticipate. It is not a weak version of `known`; it is a different question
(party vs. run), and it is **the band most parties sit at most of the time**.
`data/capabilities.ts` records the measured miss rates for a party of four
random pool species: `cut` missed 30%, `strength`/`rockSmash`/`flash` missed
~41-42%, `surf`/`waterfall`/`dive`/`fly` missed 50%. So for a typical event a
party lands `latent` somewhere around half to two thirds of the time with no
relic at all.

That matters because `latent` is currently the band that pays the **authored**
outcome table — the one every event in `data/events.ts` was written against —
while `none` and `known` are shared tables. `latent` is the default reading of
an event, not an edge case.

**So Part 5's "if `latent` is dead under relics, collapse to a boolean and delete
the dead band" does not apply as written.** Nothing is dead. The choice the
patch actually faces is a design decision, and it is one of the two things I
want ruled on before step 2:

- **(a) Collapse anyway.** Attune keys on `known` only, `latent` and `none`
  become the same thing as far as events are concerned, and the party-type test
  stops affecting events entirely. This is the literal reading of Part 2
  ("Only when the event's relic is satisfied") and of the hard T3 rule. It
  deletes a real mechanic: a party that rolled a Water type currently gets a
  better Surf event, and after this patch it would not. `data/capabilities.ts`,
  `data/eventCopy.ts`'s `latent` copy, and the per-capability latent rate in the
  sim report all become event-irrelevant, though `latent` may still be read by
  the map readout.
- **(b) Keep three bands and give `latent` something smaller.** Attune stays
  `known`-only and T3 stays relic-gated, unchanged, but `latent` shifts a
  Gamble's distribution one notch toward T2 (or unlocks a fifth, weaker
  "Improvise" option). Keeps the type mechanic alive, costs one more column in
  the pools table, and does **not** violate the T3 rule.

I read Part 2's "Present: only when the event's relic is satisfied" and the
"whole payoff of the relic system" line as pointing at (a). I would take (b),
because the measurement in `data/capabilities.ts` says half the time the player
has a party fact that would otherwise stop meaning anything. Either is a
one-table difference at step 2 and neither is a code-shape difference. **Your
call.**

---

## 3. Of the six outcome kinds named, three are missing outright and two more are misshapen.

The live union (`core/events.ts`):

```ts
export type EventOutcome =
  | { kind: 'currency'; amount: number }
  | { kind: 'damage'; percent: number }
  | { kind: 'heal'; percent: number }
  | { kind: 'item'; item: string }
  | { kind: 'acquisition'; offer: AcquisitionOffer }
  | { kind: 'nothing' };
```

| Part 1 needs | Status | Detail |
|---|---|---|
| HP loss | **Present, party-only** | `damage` hits **every** non-fainted member (`damageParty`). "15 to 25 percent HP off the lead" is not expressible — needs a target field. |
| Gold loss | **Present, no floor** | `currency` with a negative amount, clamped at 0. "`max(floor, fraction of current gold)`" is not expressible — the amount is a fixed number drawn at generation, not a fraction of a value that only exists at resolution. |
| Forced backpack discard | **Missing** | Discards exist only inside `ItemPlan.discards`, which is a *player* decision applied by `core/items.ts`. Nothing can take an item the player did not choose to drop. |
| Granted move | **Missing** | `tm`/`tutor` exist on `Reward` (`core/rewards.ts`), not on `EventOutcome`. Granting one also drags in the move-slot replacement decision, which is a logged decision the event path does not currently ask. |
| Granted relic | **Missing** | `{ kind: 'relic', relic, alternates, fallback }` exists on `Reward`, with an already-held filter and a fallback. Not on `EventOutcome`. |
| Spawned encounter | **Present, but it is not an encounter** | `acquisition` is a Pokemon **offered with no fight in front of it** — `generateEventAcquisition`, drawn on the node's `capture` sub-stream, surfaced through `acquisitionOffered` and applied by the existing `resolveNode` capture step. |

Two of those rows need a ruling, not just code:

**The "spawned encounter" gap.** Part 1 says a T2 Pokemon comes "via a spawned
encounter and capture" and Part 8's test 8 says "spawns an encounter, victory
offers the capture". There is no fight today. 4.6c's band 3 is a fightless
offer, and `core/events.ts` argues for that explicitly — an event is a node with
no battle in it, and `tuning.eventDamageFloor` exists so an event can never end a
run. Adding a real battle to an event node changes that invariant and adds a
second way a node can complete, which Part 4 of CLAUDE.md forbids ("Every node
completion routes through the single result screen"). **I propose keeping the
fightless offer and treating Part 1's wording as describing the 4.6c mechanism
rather than asking for a new one** — which is also what "reuse the 4.6c band 3
encounter spawn ... unchanged. Do not add a second acquisition path" says two
sentences later. Flagging the contradiction rather than silently picking.

**Gold tolls need a resolution-time fraction.** `max(floor, fraction of current
gold)` cannot be a number drawn at generation, because current gold is not known
until the player arrives. This does **not** break determinism — it is arithmetic
on state, not a draw — but it does mean the toll outcome carries `{ floor,
fraction }` and `applyEventOutcome` computes it, and that the UI cannot print
the exact price until the event screen renders. Part 2 says "a stated, exact
price paid up front", which it still is; it is just computed on arrival rather
than at generation. Same for percent-of-max-HP tolls, which already work this
way.

---

## 4. The logged event decision is an **index**, and the house rule says it should stay one.

`core/types.ts`:

```ts
| { kind: 'event'; index: number }   // "Which event option was taken."
```

Recorded at `core/run.ts` as `record({ kind: 'event', index })`, replayed by
`chooseEventOption` returning `decision.index`, and range-checked twice.

So yes — Part 6's schema change is real if we take it. But before we do, the
reason every other decision in that union is an index is worth putting in front
of you, because it cuts against Part 6:

> A log storing `{kind:'item', item:'leftovers'}` would keep replaying happily
> after a pool edit and hand the player an item their run never offered.
> — `core/types.ts`, on the reward index

Every decision in `RunDecision` is an index precisely so that a table edit makes
replay **fail loudly** instead of silently reinterpreting. `locale` is an index
rather than `'marsh'` for exactly this reason.

And the failure Part 6 names does not actually occur. The presented option list
varies with relic state, but **relic state is itself reconstructed by replay** —
relics arrive through logged reward decisions, in order, before the event node is
reached. A replay that is in step has the same relics, hence the same option
list, hence the same index. The save-mid-event case in test 3 is the same story:
the save carries the run state, which carries the relics.

Three options, and this is the second thing I want ruled on:

- **(a) Keep the index.** No `RUN_LOG_VERSION` bump for this. Consistent with
  every other decision. Relies on the option list being a pure function of
  `(seed, relics)`, which it is.
- **(b) Log the archetype tag** — `'safe' | 'gamble' | 'toll' | 'attune'`. A
  stable identity that is *not* derived content: it names which of four fixed
  roles was pressed, and the set is closed and will not drift the way an item
  pool does. Replay resolves tag → option, and a log naming `attune` on a run
  that replays without the relic **fails loudly**, which is the behaviour the
  index rule exists to produce. Bumps `RUN_LOG_VERSION`.
- **(c) Log a per-event option ID string**, as Part 6 asks. Also bumps
  `RUN_LOG_VERSION`, and is the one option that re-opens the failure mode the
  house rule was written against: an ID that survives a `data/events.ts` edit
  replays into an option the run never offered.

**I recommend (b).** It gets Part 6's stability property, keeps the loud-failure
property the index rule exists for, and does not create a string identity that
outlives the table it names. It costs the bump Part 6 already budgets for.

---

## 5. Not asked, and the biggest problem in the patch: pool exhaustion against 24 events does not fit the map.

Part 3 says an event drawn once is removed from that run's pool, and reasons
from "roughly one event per segment" — about 8 events consumed against a table
of 24.

**A run does not generate 8 event nodes. It generates 39 to 55.** Measured over
five seeds on current `main`, counting `kind === 'event'` across every node of
every offered locale route in all eight segments:

```
event nodes generated per map: 42, 42, 55, 39, 51
per segment (seed COUNT-0):     6, 4, 3, 7, 8, 4, 6, 4
```

The player *walks* about one per segment. The map *contains* five or six times
that, because every segment offers two or three locales and generates the full
route behind each one, and every step offers two or three options. CLAUDE.md is
unambiguous that this cannot be narrowed: "Everything structural is drawn at map
generation, in one pass, including branches the player will never visit."

So a 24-event pool with removal-on-draw is **exhausted somewhere in segment 4**,
and every event node after that has nothing to draw. Layer Part 4's locale rule
on top — three events per locale — and it is worse: a single segment's route
through Cave can contain 3+ event nodes on its own, and Cave has exactly three
events in the table.

This is not a tuning number. It is a structural mismatch, and it needs a
decision before step 2 because it determines what `data/eventPools.ts` and the
generation pass look like. Four ways out:

- **(a) Exhaust per segment, not per run.** The pool resets each segment.
  Deterministic, behaviour-independent, no repeat *within* one segment's
  branches. A run can see the same event in segment 2 and segment 6. Cheapest,
  and it fails Part 3's stated goal only in the mild case.
- **(b) Exhaust along the walked path only.** Gives exactly the property Part 3
  wants — no repeat in a run — and is **forbidden**: the pool state would vary
  with player routing, which makes a draw depend on player behaviour. Named
  here only to rule it out explicitly.
- **(c) Exhaust per run across all generated nodes, and refill when empty.**
  Honest, deterministic, and means the table is fully consumed by mid-run and
  the back half repeats anyway. Strictly worse than (a) for the same cost.
- **(d) Grow the table.** 24 → ~56 (seven per locale) would make per-run
  exhaustion work as written. That is the prompt's Part 4 rewritten, and it is a
  lot of copy for a payoff (a) mostly delivers.

**I recommend (a), with a sub-recommendation:** exhaust per segment *per
locale*, so that with three events per locale a route through Cave draws each of
Cave's three exactly once before repeating, and a player who walks Cave in
segments 2 and 7 can meet the same event twice. That is the strongest
no-repetition guarantee that is compatible with generating unvisited branches,
and Part 3's underlying worry — "repetition inside one run is the thing most
likely to make the system feel small" — is mostly about *consecutive* repeats,
which this eliminates.

Related, and cheap to state now: **events are not currently locale-filtered at
all.** `generateEvent` does `stream.pick(EVENTS)` with no locale argument, and
the comment at `core/encounters.ts` pass 4 deliberately declines the locale
filter for the event's *Pokemon* offer. The node's locale is available — it is
baked into the node id, `s{segment}-{locale}-{step}-{option}`, and `buildNode`
already takes it — but `NodeSpec` does not store it. Part 4's locale rule
therefore needs a small plumbing change (a `locale` field on `NodeSpec`, or
threading it through pass 4), which is the right place to note that Part 4
describes this as following "the 4.6a rule" — 4.6a applied that rule to wild
species pools, never to events.

---

## What I need before step 2

1. **Q2:** collapse `latent` out of events (a), or keep it with a smaller effect (b). I lean (b).
2. **Q4:** index (a), archetype tag (b), or per-event option ID (c). I lean (b).
3. **Q5:** exhaustion scope. I lean per-segment-per-locale.
4. **Q3 ruling:** confirm the T2 Pokemon stays the fightless 4.6c offer rather than a real spawned battle.

Everything else in the patch reads as buildable as written.
