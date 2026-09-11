# Stage 4.8, step 1: the four report questions

**Date:** 2026-09-10. **Branch:** `claude/intelligent-fermat-hzt2gb`.
**Prompt:** [`../spec/gymrun-stage4.8-claude-code-prompt.md`](../spec/gymrun-stage4.8-claude-code-prompt.md),
committed at `dbfa2ff` before this report was written, per protocol 1.

**Nothing is built.** No file under `src/` or `test/` is touched by this commit.
The prompt's step 1 is a hard stop and this is the stop.

Read first, because three of them change an item's shape: §5 (item 7 is already
built, and already on a surface the prompt forbids), §6 (item 5's trigger
condition cannot fire at the shipped tuning), §7 (the softlock, located).

---

## 0. Two corrections to the prompt's premises

**There is no 4.7.1.** The prompt says "paste in after 4.7.1 is merged". What is
merged is Stage 4.7, then Release C items 1-4 (`846975c`), then R12 section 1
(`f5c84fe`, the band badge). R12 section 2 amends the V5 visual prompt and is
unconsumed; the 4.7 phone-regression patch shipped step 1 only and stopped on its
own stop condition. Taking "4.7.1" to mean `f5c84fe`, head of `main`, which is
what this branch is cut from.

**Seeds remain disposable.** Stated plainly as the prompt asks: the freeze
nominally due at the end of 4.6c did not happen, `contentHash` does not exist,
and nothing here stamps one.

**One pre-existing suite failure, on HEAD, before any 4.8 work.**
`test/boundaries.test.ts > documentation paths` fails on
`docs/generation.md:1043 heights.json` — a bare filename inside a *quoted excerpt
of the R12 prompt* that the path checker reads as a repo path. 934 of 935 tests
pass. It is not mine and not 4.8's, but test requirement 13 says all existing
suites pass, so it has to be cleared or excluded at some checkpoint. It is a
one-line fix to the checker's ignore list; I propose clearing it at the step 2
checkpoint rather than leaving a red suite as the baseline every later step is
measured against.

---

## 1. Are relics drawable as a reward today?

**Yes. Fully drawable, already in the gym pool, and item 2 Part B needs no new
plumbing — only a change to how many cards an offer has.**

The 4.6c work did not stop at the capability path. `RewardEntry` carries
`{ kind: 'relic'; weight: number }` (`data/rewardPools.ts:104`), and it is in both
the `ELITE` and `GYM` bands already — `GYM` at weight 5 in both rows
(`rewardPools.ts:336`, `:345`), the heaviest single entry in the gym pool.

The resolution mechanism is the part worth knowing, because it is subtler than a
pool entry and item 2 inherits it for free. A relic card is drawn **abstract** at
map generation and made concrete at offer time:

```ts
| { kind: 'relic'; relic: RelicId; alternates: readonly RelicId[]; fallback: Reward }
```

`drawReward` shuffles the whole relic table into `alternates` and draws one
ordinary card from the same pool's non-relic entries as `fallback`
(`core/rewards.ts:284-302`). `concreteReward` then walks `relic` then `alternates`
for the first id the run does not already hold, and falls back to the ordinary
card if every relic is held (`:362-367`). `resolveOffer` is the single resolution
point (`:379`), called from `run.ts:1312`.

Two properties of that design matter for item 2:

- **The shuffle and the fallback are drawn whether or not they are needed**, so
  acquiring a relic mid-run shifts no later seed. A two-card gym offer inherits
  this unchanged.
- **Resolution consumes no RNG and is idempotent.** So "a relic or a currency
  lump" can be two cards drawn at generation and collapsed at the gym with no new
  determinism surface.

`data/relics.ts` carries more than enough to render a card: `id`, `name`,
`grants: Capability`, `passive: RelicPassive` (six declarative kinds), and a
player-facing description field. `rewardLabel` already renders a relic card by
name (`rewards.ts:553-557`), and `applyReward` already folds one into
`state.relics` with a double-add guard (`:473-486`). Ten relics across eight
capabilities.

**Consequence for item 2 Part B.** The only real work is `OFFER_SIZE`.
`core/rewards.ts:112` is `export const OFFER_SIZE = 3`, and `drawGymOffer`
(`:209-237`) loops it and **throws** if the pool yields fewer than three distinct
options. The gym offer becomes its own size constant, and the throw's message
changes with it. The prompt's "relic **or** currency" is narrower than what the
current gym pool pays — today a gym can pay an item or a tutor too — so Part B is
a *restriction* of the gym pool to exactly those two kinds, not an addition to it.
I will flag at the step 3 checkpoint that this deletes the premium-item and
Choice-item entries from the gym pool, which is a balance change the prompt does
not call out. `PREMIUM_ITEM_IDS` and `CHOICE_ITEM_IDS` would then reach the player
only through `ELITE` and the shop.

---

## 2. Where party size lives, every read site, and how `backpackCapacity` derives

**Current value: 3.** `data/partyTuning.ts:41`:

```ts
export const PARTY_SIZE = readSizeOverride() ?? 3;
```

`readSizeOverride` reads `GYMRUN_PARTY_SIZE` from the environment and throws
`RangeError` outside 1..6. It is a **module-scope constant**, not a field on
`Tuning`, and the file's header states why: `data/scaling.ts` computes opponent
team sizes from it at module scope and "a value the curve itself is a function of
is not a per-run knob". That argument is the obstacle item 1 has to get past, and
it is a real one — see the end of this section.

### Every read site

**`core/` — 2 sites, 1 load-bearing**

| Site | What it does | Item 1 |
|---|---|---|
| `core/party.ts:114` `sendOrder` | `party.filter(alive).slice(0, PARTY_SIZE)` — the one definition of who a battle is sent and in what order, shared by `battleMembersFor` and `applyBattleState` | **Must read live capacity.** Harmless at capacity ≥ party length, but it is the site where a wrong answer writes damage onto the wrong Pokemon |
| `core/acquisition.ts:103` `hasRoom` | `party.length < PARTY_SIZE` — gates whether a capture can take a free slot or must force a release | **The capture flow the prompt names.** This is the one that produces "told you have room, then asked to replace someone" |
| `core/acquisition.ts:232` | The refusal reason string, `party is full (n/PARTY_SIZE)` | Cosmetic, same fix |

`core/acquisition.ts` is where a capture is legal or not, and `applyAcquisition`
refuses an illegal decision rather than clamping — so a capacity that is stale
here is a thrown error on a replay, not a quiet mis-fill. Good: it fails loud.

**`data/` — the structural ones**

| Site | What it does | Item 1 |
|---|---|---|
| `data/tuning.ts:515` | `backpackCapacity: PARTY_SIZE + 2` | **See below. This is the one that is wrong today.** |
| `data/scaling.ts:596-597` `expectedPartySizeAt` | Clamps a per-segment row `[1,2,2,3,3,3,3,3]` to `PARTY_SIZE` | **Decision needed.** See below |

**`ui/` — 5 sites, all display**

`ui/app.ts:685` (subtitle text, also still reads "Stage 4.7"),
`ui/screens/party.ts:210` (slot count passed to `renderSlots`),
`ui/screens/run-map.ts:437` (`Party ${size} / ${PARTY_SIZE}`, the drawer header —
the prompt's "Party slots: 4. Next slot at Gym 4." readout goes here),
`ui/screens/acquisition.ts:73, 101, 102, 144` (the full/not-full branch and its
two headings — **the capture card**, the other half of the prompt's warning).

**`scripts/sim.ts` — 7 sites**, all report denominators plus
`:1485 if (state.party.length >= PARTY_SIZE) everFilled = true`. The `everFilled`
metric splits the completion rate by whether the party ever filled; against a
growing capacity "ever filled" stops meaning one thing, and I will propose at the
step 2 checkpoint that it become "ever filled its *current* capacity".

### `tuning.backpackCapacity` — it does **not** read live capacity

```ts
backpackCapacity: PARTY_SIZE + 2,   // data/tuning.ts:515
```

This is a **number literal evaluated once at module load** and frozen into
`DEFAULT_TUNING`. `core/items.ts:119` `backpackCapacity(tuning)` then just floors
the stored field. So today it is not "derived from party size" in any live sense —
it is derived from `PARTY_SIZE` *at module load* and captured into the run at
`createRun`. The prompt asks me to "confirm this reads live capacity"; it does
not, and it cannot while it is a `Tuning` field, because `Tuning` is passed into
the run and is not a function of run state.

**This is the shape decision item 1 turns on, and I want it reviewed before I
build.** Three options:

1. **`backpackCapacity(state)` instead of `backpackCapacity(tuning)`.** The
   `Tuning` field becomes a base (`backpackSlotsOverPartyCapacity: 2`) and the
   function takes run state, computing `partyCapacity(state) + base`. Four call
   sites change (`core/items.ts:269`, `core/run.ts:1686`, `ui/screens/party.ts:416`,
   `scripts/sim.ts:1028`). **My recommendation.** It is the only option where
   "grows on the same schedule" is true by construction rather than by a
   maintained invariant, and it keeps the `+2` a tuning number in `data/`.
2. Recompute the field into `state.tuning` at each gym clear. Rejected: it makes
   `Tuning` mutable mid-run, which breaks the "what the seed produced never
   changes" property the whole run log rests on.
3. Leave it at max capacity all run. Rejected: the prompt asks for the opposite.

### The `scaling.ts` question, which is a genuine collision

`expectedPartySizeAt` exists because sizing every opponent against `PARTY_SIZE`
"aimed the entire difficulty curve at a player who does not exist" — the single
largest finding of the Stage 3 balance pass, per the comment at `scaling.ts:553-559`.
It already encodes a growth curve `[1,2,2,3,3,3,3,3]`, hand-tuned against the
simulator, for the party the player *actually has* by segment N.

Item 1 makes roster width a **designed** schedule rather than an emergent one.
Those two curves must agree or the difficulty curve aims at a player who does not
exist again — in the opposite direction this time. **`slotUnlockSchedule` and
`EXPECTED_PARTY_SIZE` are one number asked twice**, and this is exactly the
"answering it in four files is how the four answers drift apart" failure
`partyTuning.ts`'s own header is about.

So: **`slotUnlockSchedule` should be the source and `expectedPartySizeAt` should
read it**, clamped to the capacity the schedule grants at that segment. The
prompt does not mention `scaling.ts` and this changes opponent team sizes, which
is arguably the "no encounter difficulty changes" line in Out of scope. I want an
explicit call. My reading: it is not a difficulty *change*, it is keeping an
existing difficulty rule correct under a new capacity curve, and letting it drift
would be the real change. But it will move the benchmark, and the prompt's
separation argument ("so their effect on the benchmark is separable") is the thing
at risk.

### The schedule, as asked

Starting size is 3 today and the prompt wants a max by roughly gym 6 with the
last two gyms played at full width. Proposed, for review:

| Gyms cleared | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|
| Party capacity | 3 | 3 | 4 | 4 | 5 | 5 | 6 | 6 | 6 |
| `backpackCapacity` (+2) | 5 | 5 | 6 | 6 | 7 | 7 | 8 | 8 | 8 |

Start at 3, not lower: the prompt's definition of done is "clears gym 2 and is
told they now carry another Pokemon", which requires the first unlock at gym 2,
and dropping the start would make the opening narrower than what 4.6c measured.
Ends at 6, the cap `readSizeOverride` already enforces and the series' own party
size. Unlocks at gyms 2, 4 and 6 — three unlocks, evenly spaced, maxed at 6,
gyms 7 and 8 at full width. `GYMRUN_PARTY_SIZE` then overrides the whole
schedule's ceiling rather than a single constant, so `GYMRUN_PARTY_SIZE=1` stays a
valid Stage 3 comparison.

**This roughly doubles the party over a run, and every opponent team size is a
function of it.** That is the largest balance change in the patch and it is in the
"Enjoyable" half, where the prompt says mechanics are frozen. I am flagging it,
not objecting: it is what item 1 asks for and the prompt accepts the benchmark
moving.

---

## 3. `tuning.stepsPerSegment` today, and which guarantees are enforced against it

**A scalar `Range`, not a per-segment lookup.**

```ts
stepsPerSegment: Range;                      // data/tuning.ts:70
stepsPerSegment: { min: 4, max: 5 },         // DEFAULT_TUNING, :457
```

`Range` is `{ min: number; max: number }`, inclusive, drawn uniformly. One read
site in the whole codebase:

```ts
const stepCount = drawRange(shapeStream, tuning.stepsPerSegment);   // core/encounters.ts:367
```

drawn off `routeKey(segment, locale)` — **per route**, so a segment offering three
locales already draws three independent step counts. Item 3's curve is therefore a
one-line change at the draw plus a table, and the per-locale independence it needs
is already there. Two test sites read the scalar directly
(`test/generation.test.ts:110-111`) and one overrides it
(`test/party.test.ts:764`, `{min:1,max:1}`, the victory fixture); both are
requirement-13 updates, not deletions.

Note the comment above the default: 6-8 was sized for Stage 1's *single* segment,
and eight of those was measured as "an attrition countdown rather than a curve".
**Item 3's curve must not put its late segments back where Stage 1 already
failed.** 4-5 rising to 7-8 late is about 44 nodes a run against today's 36; 6-8
late would be 48 and is the shape that was already rejected once. Proposing the
former at the step 3 checkpoint.

### The 4.6a composition guarantees, and which are length-relative

`applyGuarantees` (`core/encounters.ts:564-611`) applies three in a fixed order
against a `claimed` set so they compose rather than race — the header notes that an
earlier version had the rest fix-up silently overwrite the event:

| Guarantee | Knob | Default | Expressed as | Under item 3 |
|---|---|---|---|---|
| The wild step — **every option** on that step is `wild`, width `wildStepOptionCount` | `wildStepsPerSegment` | 1 | **Absolute count** | Stays 1. "Exactly one reachable wild encounter per segment" is a per-segment fact, not a per-step one |
| At least one event offered | `minEventSteps` | 1 | **Absolute count** | Stays 1, or scales. Prompt says "at least one event offered" — reading that as unchanged |
| At least one reachable rest, never before `restEarliestStep` | `minRestSteps`, `restEarliestStep` | 1, 1 | **Absolute count** | **This is the one the prompt says to restate.** Becomes a floor per N steps, `N` in `tuning.ts` |

So: one of the three is length-relative under item 3, and the prompt names exactly
that one. At N = 4 a 4-5 step segment keeps 1 rest and a 7-8 step segment gets 2,
which is the recovery-per-length the prompt is after.

Note `applyGuarantees` places the wild step with `Math.max(1, tuning.wildStepOptionCount)`
and the rest/event fix-ups respect `restEarliestStep` — all three already work at
any step count, so item 3 breaks none of them mechanically. What changes is the
*assertions*.

**Enforced against it today, in tests:**

- `test/generation.test.ts:106` step and option counts within the tuned range —
  reads the scalar, needs the curve
- `:120` no kind twice in a step (`distinctKindsPerStep`)
- `:144` no rest before `restEarliestStep`, and at least `minRestSteps`
- `:155` every segment ends at its gym, which is never an option
- `test/locales.test.ts:281` the wild step, **per route**
- `:294-304` an event and a reachable rest **on every route** — the important one,
  because a guarantee that held only on the road not taken is not a guarantee
- `test/economy.test.ts:548` reads `minRestSteps`

`test/locales.test.ts` is where requirement 5 belongs: it already asserts per
route, which is the axis that matters.

---

## 4. What run state retains about a faint

**Faints are already observable in run state after the fact, with full kill
attribution, and the structure item 5 needs is most of the way there.** But the
prompt's trigger condition cannot fire at the shipped tuning — see §6, which is
the real answer to this question.

### What exists

`NodeVisit` (`core/run.ts:203-220`) carries, per visited node:

```ts
{ node: NodeSpec; segment: number; result: BattleResult | null;
  hpAfter: number; casualties: Casualty[] }
```

filtered to the player's side at `run.ts:756`:
`(result.battle?.casualties ?? []).filter((c) => c.side === 'p1')`. And
`state.history: NodeVisit[]` is the whole run, not just the current segment.

`Casualty` (`core/battle/driver.ts:1588-1608`) is:

```ts
{ side: SideId; name: string; bySpecies: string | null;
  byMove: string | null; indirect: string | null }
```

`readCasualties` walks the protocol pairing every `|faint|` with the `|move|`
before it, and credits `[from]` tags (`psn`, `brn`, `Recoil`, `Life Orb`, `Spikes`)
as `indirect` when no move targeted the victim. The prompt expects "the same shape
as the 4.7 damage attribution work" — correct, and `contribution.ts:42` says so
explicitly: both reconstruct the dealer from the preceding `|move|` line because a
`-damage` line names only its victim.

It is deliberately forgiving: unrecognised removal paths report `null` rather than
crashing a screen. Item 5's "factual entries only" copy has to render a null
`byMove` without inventing one — "fell at Gym 5 to Arcanine" with no move, or
"fell at Gym 5 to poison" off `indirect`.

### What item 5 still needs

Mapping against the prompt's required fields:

| Item 5 wants | Today | Work |
|---|---|---|
| the member | `Casualty.name` — the **battle name** | **The gap.** See below |
| nickname | `PokemonSpec.nickname?` **exists** (`types.ts:59`) and `driver.ts:92` already does `name: spec.nickname ?? spec.species`; `ActiveView.name` is documented as "nickname if the spec set one" | Nothing generates one. A table, a key, set at acquisition |
| species | `Casualty.name` when no nickname is set | Falls out of the above |
| level | **Absent from `Casualty`** | From the party member, matched by slot |
| segment | `NodeVisit.segment` ✓ | Free |
| node | `NodeVisit.node` ✓ | Free |
| opposing species | `Casualty.bySpecies` ✓ | Free |
| killing move | `Casualty.byMove` ✓, plus `indirect` | Free |

**The one real gap is identity, and it is exactly what nicknames fix.**
`Casualty.name` is the sim's battle name, which is `spec.nickname ?? spec.species`.
`contribution.ts:78-79` already states the consequence: *"Two party members of the
same species with no nickname are therefore the same string in every line of the
log."* So today a graveyard cannot tell two Weepinbells apart, and no amount of
work on the death record fixes that — the ambiguity is in the protocol. Item 5's
nicknames are not decoration on the graveyard, **they are the thing that makes the
graveyard well-defined**, and they must land before or with the death record, not
after. The prompt's order (both in step 5) is right.

### Determinism: already satisfied, and better than the prompt assumes

`ui/storage.ts` persists only `RunLog` = `{ seed, version, decisions }`.
`NodeVisit` is commented *"Display only; never serialized"*, and
`test/run-replay.test.ts:364` asserts that derived state is never serialized — a
resumed party is recomputed, not restored. `:321` already asserts contribution
counters rebuild exactly, including from a mid-battle save, and `:98` already
round-trips `visit.result` through history.

So **death records are already derived-from-replay** in exactly the way item 5
requires, and requirement 8 is a new assertion over an existing property rather
than new machinery. The protocol is replayed byte for byte
(`test/replay.test.ts`), which is what `contribution.ts` means by counters
inheriting determinism for free. Death records inherit it the same way.

---

## 5. Item 7 is already built — and on a surface the prompt forbids

**This is the finding that most changes the plan, and step 6 should be struck or
rewritten.**

`partyThreats` already exists in `src/core/typeMatchup.ts:132`. It is pure,
RNG-free, tested across 20+ cases in `test/type-matchup.test.ts` (including the
prompt's "no super-effective coverage" and "answers every threat" cases at `:139`
and `:118`, purity at `:370`, empty party at `:237`, and fainted-members-still-count
at `:259`), and rendered by `src/ui/screens/threats.ts` with its own DOM test
(`test/threat-readout.test.ts`).

Two divergences from the prompt:

**It returns a richer type than the prompt specifies.** Not `TypeName[]` but
`ThreatEntry[]` (`:105`), carrying `membersHit` so the detailed verbosity mode can
read "hits 3 of 4, unanswered". `HITS_HARD_AT = 2` is the threshold constant, and
`THREAT_TITLE = 'Watch for'` is the prompt's own wording, already shipped. The
copy helpers `threatLine`, `threatDetail`, `threatDetailLine` and `NO_THREATS` are
all there.

**It is on the map, which item 7 explicitly forbids.** `ui/screens/threats.ts`'s
header: *"One component, two placements. The party screen is its home... The map
carries it collapsed, because the map is where the next node is chosen and that is
the decision the readout informs."* Item 7 says: *"Surfaces on the party drawer
only in this patch. Do not put it on the map, the locale select screen, or the
pre-gym screen: against a known gym type identity it becomes a routing
recommendation."*

**These are a direct contradiction and I am not resolving it unilaterally.** The
existing header argues *for* the map on the grounds that the map is where the
decision is; the prompt argues *against* the map on the grounds that the map knows
the segment's gym type. Both are coherent. The prompt's is the stronger argument
on the facts, because `run-map.ts:178-190` does render the gym leader's name and
`typeChip(gym.type)` on the same screen — so the map genuinely pairs "watch for
Ground" with "the next gym is Ground", which is the routing recommendation item 7
names. The existing header was written before, or without weighing, that pairing.

**My recommendation: remove the map placement, keep `ThreatEntry`.** The richer
return type is strictly more than `TypeName[]` and its tests are the ones
requirement 10 asks for; narrowing it to satisfy a signature in a prompt would
delete working tested code to match a sketch. But the placement contradiction is
the prompt making a live editorial call against a shipped one, and per
`docs/spec/README.md` a superseded rule is deleted and recorded in
`generation.md` with a dated note — not left behind a flag.

**Either way, step 6 has no core work in it.** Requirement 10 is already met. What
remains is a UI deletion, which belongs in step 7. I propose striking step 6 and
folding the placement change into step 7, and I want that confirmed rather than
assumed.

---

## 6. Item 5's trigger condition cannot fire at the shipped tuning

Item 5 says: *"Run state records a death entry each time a party member faints
**and is not recovered**."*

At the shipped tuning, a party member that faints is **always** recovered:

```ts
reviveFaintedBetweenNodes: true,   // data/tuning.ts:512
reviveHpPercent: 0.5,              // :513
```

`core/party.ts:224-225` revives every fainted member to half HP between nodes.
Out of scope for this patch: *"Revives, or any change to faint recovery."* So
"faints and is not recovered" describes a state the run reaches **only on a
wipe** — `isWiped` is every member fainted, which ends the run. The graveyard
would hold at most the final party, all at once, from the last node. That is not
"a list of everything that died on the way", and it defeats the definition of
done.

**The prompt wants a record of faints, and has written a condition that excludes
all but the last ones.** I read the intent as the definition of done ("a list of
everything that died and what killed it") rather than the literal condition, which
would make the feature vacuous. Three readings, and **I need the call before step 5**:

1. **Every faint is an entry, recovery notwithstanding.** The "graveyard" is a
   casualty log — every time a member went down, where, and to what. Multiple
   entries per member across a run. **My recommendation**, because it is the only
   one that produces the prompt's own example output over a real run, it needs no
   change to faint recovery (staying inside Out of scope), and the data is already
   in `history` — it is a read, not a mechanic. The word "graveyard" becomes
   slightly wrong for it; "casualties" is what the codebase already calls it.
2. **Only terminal faints.** Literal, inside scope, and near-empty. Rejected
   unless you want it.
3. **Make some faints permanent.** Produces a true graveyard and is squarely the
   permadeath and revive-economy work the prompt puts out of scope twice.

Reading 1 also needs a rule for *release*: a member released at a capture is
gone from the party but did not die. It should not be in a death list. Proposing
it is not, and that the result screen's final-party section is where a released
member's absence shows.

---

## 7. The lead-selection softlock — confirmed, located, and a one-line class of fix

The prompt's closing note. **The bug is real and reproducible from the code.**

`src/ui/app.ts:554`:

```ts
onDone: () => showScreen('map'),
```

The party screen's Done button goes to the map, unconditionally. The party screen
has two entrances:

- `run-map.ts:433` `renderPartyHeader(size, onManage)` — the Manage button on the
  map. Returning to the map is correct here.
- `app.ts:328` `chooseLead`'s `onManageParty: showParty` — the pre-gym screen's
  Manage button. **Returning to the map is a softlock here.**

Why it is a softlock, precisely. `chooseLead` is awaited inside `playRun`'s `atGym`
branch, so when the pre-gym screen is up, `state.position >= stepsOf(state).length`
and the pending `leadPick` promise is the only thing the run is waiting on.
`run-map.ts:269-282` passes `onChoose` **only** to the row at `state.position`:

```ts
if (step.index === state.position && !state.outcome) {
  return renderStep(step.index, step.options, 'current', ..., onChoose);
}
```

At the gym no step matches `state.position`, and the gym row is appended at
`:282` with **no `onChoose` argument** — so `renderNode` builds a `div` rather
than a `button` (`:321`, `const interactive = Boolean(onChoose)`). The map at the
gym therefore has **zero controls that advance the run**: every node row is inert,
and the only interactive element is Manage, which goes back to the party screen,
whose Done goes back to the map. `nodeOptions` returns `[]` at the gym by design
(`run.ts`: "the gym is not a choice, so it must not arrive at `chooseNode` as a
list of one"), so `nodePick` is never armed either.

The player is in a two-screen loop with an unresolved promise and no way to reach
`leadPick.submit`. Only a reload recovers it, and the run resumes from the log.

This is the same *class* of bug as the one the 4.7 phone-regression patch step 1
fixed — "the pre-gym screen had no control that submitted the current lead, so a
party of one could not leave it". That fix added the confirm button; it did not
make the Manage round trip return to where it came from.

**The fix: `showParty` takes its return screen.** `showParty(returnTo: ScreenName)`,
with the map's Manage passing `'map'` and `chooseLead`'s passing `'pre-gym'`, and
`onDone` showing that. The pre-gym path must also re-`render` the pre-gym screen on
return, because the party may have been reordered or had a member released while
away — and the lead slot is an index into the party, so returning to a stale
pre-gym render would confirm a slot that now names a different Pokemon. That is the
same hazard `app.ts:530-540` already handles by dropping `pendingPlan` on reorder
and release, and the fix has to extend the same reasoning to the lead.

`onReorder` and `onRelease` also both call `showParty()` to redraw, so they become
`showParty(returnTo)` and the `returnTo` has to thread through — which is why this
is a small refactor rather than a one-character change.

**Where it goes.** It is a UI fix with no `core/` change and no version move, so it
belongs in step 7. But it is a softlock on the path item 1 makes *more* travelled
— a wider party means more reason to open the party screen before a gym — and it
is live on `main` today. **I would rather ship it first, as its own commit, ahead
of step 2.** It is independent of every item in the patch, it is ~15 lines plus a
test, and leaving a known softlock in place through five checkpoints to honour "UI
comes last" is the letter of the rule against its purpose. Requesting permission
to do that; otherwise it lands in step 7 and I will carry it on the checklist.

A regression test for it is a jsdom test in the shape of `test/pre-gym-confirm.test.ts`
(which already drives the pre-gym screen's handlers directly): enter the party
screen through `onManageParty`, fire Done, assert the visible screen is `pre-gym`
and that a control exists which resolves `leadPick`.

---

## 8. Defaults in the prompt: agreed, with one disagreement

Taking all six as written. Specifically **agreeing** with the one the prompt asks
me to flag if I disagree: **score on the result screen only.** A projected score on
a node card is a verdict about a future decision and would make the tier badge a
scoreboard hint. Requirement 7's per-surface negative assertion is the right shape
for it, and it is the kind of rule that gets violated by a plausible one-line
change — `test/threat-readout.test.ts`'s header makes that exact argument about
Part 4's prohibitions, and it is why that test exists.

**Turns at weight zero:** agreed, and worth noting it is already available —
`Contribution.turnsOnField` is per member and folded per battle, so a run total is
a sum over `history`, with no new instrumentation.

**One disagreement, on item 2 Part A.** The prompt says the guaranteed move draws
at "one band above the segment's current band, matching the +1 band that gym
leaders themselves draw at in `data/scaling.ts`. Read that same number, do not
introduce a second one." That number is `GYM_MOVE_BAND_BONUS = 1`
(`data/scaling.ts:515`) and I will read it. But the gym pool's existing tutor entry
is `{ kind: 'tutor', weight: 5, bandOffset: 1 }` resolved at tier `elite`, and
`REWARD_BAND_OFFSET.elite = 2` — so a gym tutor card **today** pays at **+3**, and
`rewardPools.ts:331-335` says that is deliberate: *"a gym offer resolves at `elite`,
so the tier rule already pays +2, and 'strictly better than elite' needs one
more."*

So Part A at `GYM_MOVE_BAND_BONUS` = +1 is **a two-band downgrade** of the move a
gym clear pays, at the same time as Part B cuts the offer from three cards to two
and restricts it to relic-or-gold. The prompt's framing is "a gym clear now pays
twice" — more, not less — and the stated invariant is that gyms stay "strictly
better than elite". An `elite` node pays a +2 move *and* three cards; under a
literal reading a gym would pay a +1 move and two cards, which is strictly
**worse**. I do not think that is intended.

I will implement the prompt as written — one number, `GYM_MOVE_BAND_BONUS`, no
second one — and flag the magnitude at the step 3 checkpoint with the band
arithmetic for both readings, so the call is made on numbers. If the intent was
"the guaranteed move is what the gym's own tutor card paid", the number to read is
the composition `REWARD_BAND_OFFSET.elite + 1`, which is still one rule and not a
second number. Worth deciding before the benchmark, because it is a straight
reduction in what eight gym clears pay and it will show up in mean gyms cleared.

---

## 9. Summary of decisions I need before step 2

| # | Decision | My recommendation |
|---|---|---|
| 1 | `backpackCapacity` becomes a function of run state, not a `Tuning` field (§2) | Yes, option 1 |
| 2 | `expectedPartySizeAt` reads `slotUnlockSchedule`, accepting that opponent team sizes move (§2) | Yes — drift is the bigger risk |
| 3 | The 3 → 6 schedule, unlocking at gyms 2, 4, 6 (§2) | As tabled |
| 4 | Part B restricting the gym pool to relic-or-currency deletes its item and tutor entries (§1) | Flagging, will implement as written |
| 5 | Part A's +1 is a two-band downgrade of the gym move (§8) | Implement as written, decide on numbers at step 3 |
| 6 | Item 7 is already built; strike step 6, keep `ThreatEntry`, remove the map placement in step 7 (§5) | Yes |
| 7 | Item 5 records **every** faint, not only unrecovered ones (§6) | Yes, reading 1 |
| 8 | The softlock ships first, ahead of step 2, as its own commit (§7) | Yes |
| 9 | The pre-existing `boundaries.test.ts` failure is cleared at the step 2 checkpoint (§0) | Yes |

**Stopping here.** No code until these are reviewed.
