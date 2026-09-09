# Untitled Pokémon Roguelike: Build Spec v0.1

Working name: **GYMRUN**. Browser web app. Seeded roguelike runs. No overworld, no story, no walking. Starter plus a short chain of choice-driven encounters into 8 gym leaders.

---

## 1. The single most important engineering decision

**Do not write a Pokémon battle engine.** Wrap Pokémon Showdown's.

`@pkmn/sim` is Showdown's simulator published as an npm package. It ships with the full national dex, every move, every ability, PP, status, stat stages, secondary effects, speed ties, weather, terrain, items, and a seedable PRNG. It is the only realistic way to hit "full battle mechanics, roster up to latest gen, randomized abilities from the total pool" without burning six months on damage formula edge cases.

Companion packages:

| Package | Use |
|---|---|
| `@pkmn/sim` | Battle simulation. Accepts arbitrary teams with any ability and any 4 moves. |
| `@pkmn/dex` | Species, move, ability, item data. Powers the randomizer tables. |
| `@pkmn/client` + `@pkmn/view` | Turns raw sim protocol into renderable battle state. Skips a lot of UI plumbing. |
| `@smogon/calc` | Damage estimation. Needed for enemy AI, not for resolution. |
| `@pkmn/img` | Sprite and icon URL resolution against Showdown's sprite CDN. |

Set the format to a Gen 9 singles base with clauses stripped. That matches Emerald Rogue EX's target: modern mechanics, physical/special split, fairy type, full ability pool.

**Cost of this decision:** you inherit Showdown's mechanics, not literal Gen 3 Emerald mechanics. Given you asked for "latest gen roster and randomized abilities," this is correct. If you later want true Gen 3 behaviour, `@pkmn/sim` supports gen-locked formats, so it is a config change, not a rewrite.

---

## 2. Architecture

```
src/
  core/            pure, deterministic, zero DOM, 100% unit testable
    rng.ts         seeded PRNG, split streams (map / rewards / battle)
    run.ts         run state machine
    randomizer.ts  species, ability, moveset, gym team generation
    encounters.ts  node generation, difficulty tiers
    rewards.ts     reward pools keyed to difficulty
    battle/        adapter over @pkmn/sim
      driver.ts    start battle, submit choice, read protocol
      ai.ts        opponent move selection
  ui/              rendering only, no game logic
  data/            static randomizer tables, gym definitions, starter pool
```

**Hard rule:** `core/` never imports from `ui/`. `Math.random()` is banned everywhere. All randomness comes from the seeded RNG. This buys you seed sharing, daily runs, reproducible bug reports, and headless balance simulation, which you will want by Stage 3.

**Save state:** the entire run serializes to a JSON blob in `localStorage`. Store the seed plus the sequence of player decisions, not the derived state. Replaying decisions against the seed reconstructs the run and makes save-scumming detectable.

---

## 3. Design rules locked in from requirements

1. **Starter pool has no duds.** Curated whitelist of viable species, not a roll off the full dex. Player picks 1 of 3 offered.
2. **1 to 3 encounters between gyms.** Player chooses which encounters to take. Encounter budget is capped so grinding is impossible.
3. **Risk scales with reward.** Hard and elite encounters pay out better held items, rare species, and move tutors. This is the core Slay the Spire tension and it is the thing that makes the game good, so it gets real balance attention.
4. **Gym leaders keep a type identity, teams are procedurally generated** within that type, scaling across gyms 1 through 8.
5. **Party wipe ends the run.** Individual faints do not remove a Pokémon permanently.

**Assumption flagged for your confirmation:** I read "no moves like you would do in a nuzlocke" as *no nuzlocke ruleset*. No per Pokémon permadeath, no first encounter only, no forced nicknames. Faints heal between encounters or via rest nodes. Correct me if you meant something else, because it changes rule 5 significantly.

---

## 4. Staged deliverables

Each stage ends in something you can open in a browser and play. Nothing is a throwaway prototype.

### Stage 0: Battle Slice
**Goal:** prove the engine bet in the smallest possible surface.

- Vite plus TypeScript project, deploys to a static host.
- One hardcoded Pokémon versus one hardcoded Pokémon, full Showdown mechanics.
- Move selection UI, PP display, HP bars, status icons, stat stage indicators, battle log.
- Opponent AI: pick the highest expected damage move via `@smogon/calc`.
- Win or lose screen. Nothing else.

**Done when:** you can win a battle in the browser and the mechanics feel right.
**Risk this retires:** whether `@pkmn/sim` is workable in a browser bundle. This is the whole project's load-bearing assumption, so it goes first.

### Stage 1: The Loop
**Goal:** the game becomes a game.

- Seeded run creation. Seed visible and shareable.
- Starter select: 3 options from the curated pool.
- Run map: linear chain of nodes. At each step, choose 1 of 2 or 3 encounters.
- Node types: wild battle, trainer battle, rest.
- One gym leader at the end of the segment.
- HP and PP persist across encounters. Rest nodes restore.
- Wipe ends the run. Beat the gym and the run ends in victory.

**Done when:** a full segment is playable end to end and two people with the same seed get identical runs.
**This is your first genuinely fun build. Playtest it hard before moving on.**

### Stage 2: Full Run and Randomizer
**Goal:** 8 gyms, real randomization.

- 8 segments, 8 gym leaders, difficulty curve across them.
- Ability randomization from the full ability pool.
- Moveset randomization.
- Level and stat scaling curve per segment.
- Gym team generation respecting type identity.
- Run summary screen: seed, gyms cleared, team, cause of death.

**Done when:** you can complete or lose an 8 gym run and each seed feels different.
**Build here:** a headless run simulator that plays 1000 seeds with a dumb policy and reports win rate per gym. You cannot balance a roguelike by hand. This tool pays for itself immediately.

### Stage 3: The Roguelike Layer
**Goal:** the decisions get interesting.

- Encounter difficulty tiers displayed before the player commits: normal, hard, elite.
- Reward pools keyed to tier. Held items, rare species, move tutors, TMs.
- Reward is always a choice of 3, never auto granted.
- Held item effects wired through the sim.
- Shop nodes with run currency.
- Event nodes: risk and reward with no battle.

**Done when:** a playtester agonizes over a node choice. That feeling is the product.

### Stage 4: Team Building
**Goal:** you stop soloing with the starter.

- Party slots. Acquiring Pokémon from rewards and encounters.
- Switching during battle, with the standard switch cost.
- Party management screen between encounters.
- Bench experience rules.

**Open decision:** party size. 3 is tighter and more roguelike. 6 is more Pokémon. Recommend starting at 3 and testing 4 to 6 later, because small parties make each acquisition matter and keep battles fast.
**Note:** switching is a significant battle UI and AI change. It is deliberately not in Stage 0 to 3.

### Stage 5: Meta and Distribution
**Goal:** retention and shareability.

- Persistent unlocks across runs, expanding the starter pool.
- Daily seed, shared by all players.
- Run history and stats.
- Seed sharing links and a spectator friendly layout for streaming.
- Mobile responsive pass.

---

## 5. Named risks

| Risk | Mitigation |
|---|---|
| Opponent AI is bad and battles feel hollow | Budget real time here. Greedy damage max is the Stage 0 baseline. Add switch logic and status awareness by Stage 3. |
| Bundle size from full dex data | Tree shake `@pkmn/dex`, lazy load sprites, code split the battle engine. Measure at Stage 0. |
| Randomized abilities produce unwinnable gyms | The headless simulator from Stage 2 catches this. Blacklist a small set of abilities if needed. |
| IP exposure | Fan project. No monetization, no ad revenue, no asset redistribution. Load sprites from Showdown's CDN, do not host them. Nintendo tolerates non commercial fan games and shuts down commercial ones. |
| Scope creep into full Pokémon | The out of scope list is the defence. Breeding, EVs, IVs, natures, and multiplayer stay out through Stage 5. |

---

## 6. Immediate next actions

1. Confirm the nuzlocke interpretation in section 3.
2. Confirm party size direction for Stage 4.
3. Green light Stage 0 and I scaffold the repo.
