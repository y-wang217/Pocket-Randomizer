# GYMRUN Stage 2: Claude Code Build Prompt

Paste into Claude Code in the existing repo, after Stage 1 is merged.

---

## PROMPT

You are building **Stage 2** of GYMRUN. Read `pokerun-build-spec.md` and the existing `src/core/` before writing anything. Stages 0 and 1 are done and working: seeded battles, seeded run creation, starter select, a single segment of node choices, one gym leader, HP and PP persistence, wipe and victory states.

Stage 2 turns one segment into eight and replaces hardcoded content with a randomizer. The centrepiece deliverable is not a game feature. It is the headless balance simulator. Build it early, not last.

### What Stage 2 adds

1. Eight segments, eight gym leaders, a difficulty curve across them.
2. Ability randomization from the full ability pool.
3. Moveset randomization.
4. A level and stat scaling curve per segment.
5. Gym team generation that respects each leader's type identity.
6. Run summary screen: seed, gyms cleared, final team, cause of death.
7. A headless run simulator that plays N seeds with a scripted policy and reports win rate per gym.

### Order of work, stop for review after each

1. Randomizer core plus its data tables, with unit tests. No UI.
2. Headless run simulator wired to the randomizer. Run 1000 seeds. Report.
3. Tune the curve tables against the report.
4. UI: segment progression, gym presentation, run summary screen.

Do not build the UI before the simulator produces a report. The whole point of Stage 2 is that you cannot balance a roguelike by playing it.

### The randomizer

`core/randomizer.ts` is pure and takes an explicit RNG stream. It never reads global state.

```ts
generateWildMon(segment: number, tier: Tier, rng: Rng): PokemonSpec
generateTrainerTeam(segment: number, tier: Tier, rng: Rng): TeamSpec
generateGymTeam(gym: GymDefinition, segment: number, rng: Rng): TeamSpec
```

`Tier` is `'normal' | 'hard' | 'elite'`. Stage 3 exposes tiers to the player and keys reward pools to them. Stage 2 passes `'normal'` everywhere. Build the parameter now, do not build the tier UI or the reward pools.

Rules the randomizer must follow:

- Species selection draws from a table filtered by segment, not from the raw dex. A Stage 1 gym should not roll a pseudo-legendary.
- Ability is drawn from the **full** ability pool, not the species' legal abilities. That is the point of the randomizer. It must pass through the sim without validation rejecting it.
- Movesets are drawn from a pool that is at least type-plausible and includes at least one damaging move. A Pokémon with four status moves is a dead encounter, not an interesting one.
- Every generated spec is a `PokemonSpec` as defined in Stage 0. No new team representation.
- Blacklists live in `data/blacklists.ts`: abilities, moves, and species. Start them near-empty and populate only from simulator evidence. Document why each entry is there in a comment.

### Data tables, all in `data/`, all tunable without touching logic

- `gyms.ts`: eight `GymDefinition` records. Type identity, name, segment index, team size, and any species restrictions.
- `scaling.ts`: level curve per segment for player and opponents, plus opponent team sizes.
- `speciesPools.ts`: species availability keyed to segment band.
- `movePools.ts`: move availability keyed to segment band.

Everything a balance pass would want to change must be a number in one of these files. If tuning requires editing `randomizer.ts`, the split is wrong.

### Player progression decision

The player's level is a function of segment index read from `scaling.ts`. There is no XP system and no grinding, per design rule 2 in the spec. Encounters chosen within a segment affect what you get, not how strong you are. This is a decision, not a constraint, and it is a one-table change if playtesting says otherwise.

### Party size, and the gym team size problem

The player still solos with the starter until Stage 4. A gym with six Pokémon against a single player Pokémon is not a difficulty curve, it is a wall. Do not hardcode gym team sizes as flavour. Define them in `scaling.ts` as a function of the configured party size:

```ts
const PARTY_SIZE = 1; // Stage 4 raises this
```

Every place that assumes one player Pokémon must read `PARTY_SIZE`. Grep for single-mon assumptions in the run state machine and the battle driver and fix them now. Stage 4 raising this constant should not require a rewrite of the run loop.

### The headless simulator

This is the deliverable that matters most.

`npm run sim -- --seeds 1000 --policy greedy` runs full runs headless under Node, no DOM, using the `Policy` interface from Stage 0. It reports:

- Win rate per gym: what fraction of runs reaching gym N clear gym N.
- Run completion rate.
- Cause of death distribution: which gym, which opposing species, which move landed the kill.
- Average turns per battle, per segment.
- Outlier seeds: the fastest win and the earliest loss, printed with their seeds so you can replay them in the browser.

Also report **diversity**, because the Stage 2 done condition is that each seed feels different, and win rate alone does not measure that:

- Distinct species encountered across the sample, and the top 10 by frequency.
- Distinct abilities rolled, and whether any single ability dominates.
- If the top species or ability appears in a disproportionate share of runs, the pools are too narrow.

Output as a readable table to stdout plus a JSON file in `sim-reports/`, timestamped and stamped with the randomizer version.

Provide at least two policies: `random` (picks a legal move at random) and `greedy` (the Stage 0 damage-max AI). The gap between their win rates is the crude measure of whether player skill matters. If a random policy clears gym 6, the game has no depth.

### Starting balance targets

These are starting hypotheses for tuning, not truths. Adjust after the first report:

- `greedy` policy clears gym 1 in roughly 90 percent of runs.
- `greedy` policy completes a full 8-gym run in roughly 5 to 15 percent of runs.
- `random` policy rarely gets past gym 3.
- No single gym is a cliff, meaning no gym drops the clear rate by more than about 25 points relative to the one before it.

If the first report shows a cliff at one gym, that is a data table problem, not a code problem. Fix it in `scaling.ts` or `gyms.ts`.

### Determinism, and the thing that will silently break it

Adding a randomizer changes what the RNG streams are consumed for. Two protections:

1. Draw randomizer rolls from a dedicated stream, not from `map` or `battle`. Adding a new draw in one system must not shift another system's rolls for the same seed.
2. Add `randomizerVersion` to `RunLog` alongside the existing seed and version. When the data tables or draw order change, bump it. Replaying a log with a mismatched version must fail loudly with a clear message, never silently produce a different run. Shared seeds are worthless if a tuning pass quietly reinterprets them.

### Run summary screen

Seed, copyable. Gyms cleared out of eight. Final team with species, ability, and moves. Cause of death: which gym, which opposing Pokémon, which move. A rematch button that reruns the same seed.

### Explicitly out of scope

Tier selection UI, reward pools, reward choices, held item effects, shops, event nodes (all Stage 3). Party slots, switching, party management, bench experience (all Stage 4). Unlocks, daily seed, run history, seed links, mobile pass (all Stage 5). EVs, IVs, natures, breeding.

### Tests required

1. Determinism: the same seed produces an identical full-run randomizer output, twice.
2. Stream isolation: adding a draw to the rewards stream does not change battle or map output for a fixed seed. Test this directly, it is the failure mode that will bite you.
3. Legality bypass: a spec with an ability the species cannot legally have is accepted by the sim and the ability actually fires in battle.
4. Moveset validity: no generated spec has zero damaging moves. Property test over many seeds, not one case.
5. Gym identity: every generated gym team member matches the leader's type identity across many seeds.
6. Version guard: replaying a log with a mismatched `randomizerVersion` throws.
7. The Stage 0 and Stage 1 test suites still pass unchanged.

### Definition of done

You can play or lose a full 8-gym run in the browser. Two people with the same seed get identical runs. `npm run sim -- --seeds 1000` produces a balance report in under a few minutes, and the numbers in it are close enough to the targets above that you would let a stranger play it.

---

## One thing to decide before you run this

Gym team size against a solo player is the balance question Stage 2 will live or die on. My guess is gyms 1 through 3 run one or two Pokémon and gyms 6 through 8 run three, with the player's single mon healing between encounters. That is a guess. The simulator's per-gym clear rate is what would confirm or kill it, so treat the first report as the real answer and expect to move those numbers.
