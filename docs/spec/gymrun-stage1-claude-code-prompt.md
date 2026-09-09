# GYMRUN Stage 1: Claude Code Build Prompt

Paste into the existing repo. Stage 0 is done and working.

---

## PROMPT

You are building **Stage 1** of GYMRUN. Read `pokerun-build-spec.md` and `docs/engine-notes.md` first, then read the existing `core/` to understand the seams Stage 0 established. Stage 0 proved the battle engine. Stage 1 makes it a game: a seeded run, a starter, a chain of node choices, and one gym leader at the end.

Stage 1 is one segment. Stage 2 is eight. Build it as a list of segments with length one, not as a special case. Anywhere you find yourself writing "the segment" instead of "segment N", stop and generalize.

### New files

```
src/
  core/
    run.ts            run state machine
    encounters.ts     node and map generation
    party.ts          party state, persistence, wipe detection
  data/
    starters.ts       curated pool
    gyms.ts           gym definitions
    tuning.ts         every balance number in the game
  ui/
    screens/          starter select, map, battle, summary
```

### Feature scope

**Run creation.** A run is created from a seed. Seed is visible on screen and editable at run start. Same seed plus same decisions produces an identical run, every time, on any machine.

**Starter select.** Offer 3 species drawn from a curated whitelist in `data/starters.ts`. Curated means no duds: every entry must be viable at the level it starts. Player picks one.

**Run map.** A linear chain of steps. At each step the player is offered 2 or 3 nodes and picks one. Node types for Stage 1: wild battle, trainer battle, rest. The segment ends at a single gym leader node that is not a choice.

**Persistence between nodes.** HP and PP carry across encounters. Rest nodes restore them. There is no grinding: the number of steps in a segment is fixed by generation, so the player cannot farm extra encounters.

**Run end.** Party wipe ends the run in defeat. Beating the gym ends the run in victory. Both land on a summary screen showing seed, nodes taken, and outcome.

### Generation rules that matter for determinism

Generate the **entire map structure at run creation**, in one pass, from the `map` RNG stream. Do not draw lazily as the player advances. Lazy draws make roll order depend on player behaviour, which will silently break seed compatibility the moment Stage 3 adds a reward draw between nodes.

Encounter contents (which species, which levels) may be generated at the same time as the map or at node entry, but pick one and write down which in `docs/generation.md`, because Stage 2's randomizer must follow the same rule.

### Extensibility seams to build now

**Segments, not a segment.** `RunState` holds `segments: Segment[]` and `currentSegment: number`. Stage 1 generates one. `generateSegment(index, rng, tuning)` takes the index and uses it for scaling, even though Stage 1 always passes 0.

**Party, not a starter.** `RunState` holds `party: PokemonState[]`. Stage 1 puts exactly one member in it. Wipe is "every party member fainted", never "the starter fainted". Battle setup takes the party and sends out the first non-fainted member. Stage 4 adds slots and switching without touching this logic.

**Node result hook.** `resolveNode(state, nodeResult)` returns the new run state. Stage 3's rewards hang off this function. Stage 1 returns state with updated party and advanced position. Do not build reward pools, but do not inline the state update into the battle screen either.

**Tier on the node type.** `NodeSpec` carries a `tier` field, defaulting to `normal`. Stage 1 never varies it and never displays it. Stage 3 populates it and keys reward pools to it.

**Gym definitions carry type identity.** `data/gyms.ts` defines each gym as a leader identity, a type, a segment index, and a team. Stage 1 hardcodes the team. Stage 2 replaces the hardcoded team with `generateGymTeam(gym, rng, tuning)`. The gym definition itself must not change when that happens.

**RunPolicy, mirroring the battle Policy seam.**

```ts
type RunPolicy = {
  chooseStarter: (options: PokemonSpec[]) => Promise<number>;
  chooseNode: (options: NodeSpec[]) => Promise<number>;
  battle: Policy;
};
```

The UI is a run policy. A scripted bot is a run policy. `playRun(seed, policy, tuning)` must complete a full segment headless under Node with no DOM. This is the direct precursor to Stage 2's thousand-seed simulator, so it is not optional and it must be tested.

**Every balance number lives in `data/tuning.ts`.** Steps per segment, node choice count, starter level, level curve per segment, rest node restore amount, encounter level offsets. `Tuning` is a typed object passed into generation, never imported ad hoc from deep inside a function. Stage 2 will sweep these values programmatically.

**Starter pool as a function.** `getStarterPool(unlocked?: string[])` rather than a bare exported array. Stage 5 expands the pool through unlocks and this keeps that from touching the run code.

### Decisions I am making for you, all reversible from `tuning.ts`

- Status conditions clear between encounters. HP and PP do not. Rationale: persistent status across a whole segment with one Pokémon is a run-ending coin flip, not an interesting decision. Expose it as `tuning.clearStatusBetweenNodes`.
- Rest nodes fully restore HP, PP, and status. Partial restore is a Stage 3 tuning question once rewards create a real opportunity cost.
- 6 to 8 steps per segment before the gym. Tune from playtest.
- Fainted party members revive at the start of the next node. Relevant only from Stage 4, but encode it now so wipe logic is the only death rule.

### Save and resume

Extend `RunLog` to the full decision sequence: starter choice, node choices, and battle choices, in order. Bump the log version and reject or migrate old logs explicitly. Resuming a run replays the decision log against the seed to reconstruct state. Never serialize derived state. Write a test that saves mid-run, reloads, and continues to an identical outcome.

### Out of scope for Stage 1

Do not build: multiple segments, ability or moveset randomization, difficulty tiers as a displayed feature, rewards, shops, items, event nodes, party slots beyond one, switching, run history, unlocks, or a level scaling curve beyond a simple function of segment index.

### Tests required

1. Two runs with the same seed produce identical starter options, identical map structure, and identical encounter contents.
2. A scripted `RunPolicy` completes a full segment headless under Node, no DOM.
3. Save mid-run, reload, replay: identical resulting state.
4. HP and PP persist across a node boundary. A rest node restores them.
5. Party wipe ends the run in defeat. Gym victory ends it in victory.
6. Existing Stage 0 boundary tests still pass: no `core/` to `ui/` imports, no `Math.random`.

### UI

Reuse the Stage 0 battle screen unchanged where possible. Add a screen router and three screens: starter select, run map, run summary. The map screen shows the full chain with completed, current, and upcoming steps, and the party's current HP and PP. Keep the visual language of the Stage 0 UI. It is clean and readable and that is worth protecting.

### Definition of done

A player opens the build, sees a seed, picks a starter, plays through a chain of node choices into a gym leader, and wins or loses. Two people entering the same seed and making the same choices get an identical run.

### Working method

Order: (1) types plus tuning plus map generation with determinism tests, (2) run state machine plus headless `playRun` with a scripted policy, (3) save and replay, (4) UI screens on top of the working headless run. Do not build UI before the headless run passes its tests. Commit at each checkpoint and stop for review.

---

## Playtest note

The spec calls this the first genuinely fun build and says to playtest hard before Stage 2. The thing to watch for is whether the node choice is a real decision or a formality. If testers pick nodes without thinking, the map is not doing any work yet, and that is expected at Stage 1 because tiers and rewards are what create the tension. What you want to catch here instead is pacing: whether 6 to 8 steps is too long for one gym, and whether HP and PP attrition alone makes rest nodes feel worth taking.
