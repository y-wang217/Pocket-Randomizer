# GYMRUN Stage 3: Claude Code Build Prompt

Paste into Claude Code in the existing repo, after Stage 2 is merged.

---

## PROMPT

You are building **Stage 3** of GYMRUN. Read `pokerun-build-spec.md`, `docs/generation.md`, and the existing `src/core/` before writing anything. Stages 0 through 2 are done and working: seeded battles, eight segments, eight gyms, ability and moveset randomization, scaling curves, and the headless balance simulator.

Stage 2 made the run long. Stage 3 makes it a decision. Right now the player walks a chain of nodes and the choice between them is a formality. By the end of Stage 3 the player should hesitate at every step.

The centrepiece is not the item system. It is the risk/reward gradient: a visible difficulty tier on every node, a reward pool keyed to that tier, and a simulator that can prove taking risk pays.

### What Stage 3 adds

1. Difficulty tiers on nodes, shown to the player before they commit: normal, hard, elite.
2. Reward pools keyed to tier. Always a choice of 3, never auto granted.
3. Held items, with effects actually wired through the sim.
4. Run currency, earned per node and scaled by tier.
5. Shop nodes.
6. Event nodes: risk and reward, no battle.
7. Simulator extensions that measure whether the risk gradient works.

### Order of work, stop for review after each

1. Tier assignment in map generation, tier wired into the Stage 2 randomizer calls, determinism tests. No rewards yet.
2. Reward pools, item data, and item effects through the sim, with tests proving an item fires in battle.
3. Currency, shops, event nodes.
4. Simulator extensions and a tuning pass against the report.
5. UI: tier display, reward choice screen, shop screen, event screen.

UI comes last again. If a tier-greedy policy and a tier-averse policy have the same win rate, the feature does not work yet and no amount of UI polish fixes that.

### New files

```
src/
  core/
    rewards.ts      offer generation, keyed to tier
    items.ts        held item state, application to battle specs
    events.ts       event resolution
    economy.ts      currency, pricing, shop stock generation
  data/
    rewardPools.ts  pool contents per tier
    items.ts        item whitelist and metadata
    events.ts       event definitions
    shop.ts         stock tables and prices
```

`core/rewards.ts`, `core/events.ts`, and `core/economy.ts` are pure and take an explicit RNG stream, same contract as `randomizer.ts`.

### Tiers

`NodeSpec.tier` already exists from Stage 1 and Stage 2 already passes it into the randomizer. Stage 3 populates it and shows it.

Tier assignment happens at map generation, in the same pass as the rest of the map, from the `map` stream. Every step offers a spread, not a uniform draw: a step where all three options are elite is not a choice. `tuning.ts` gets a tier distribution per segment band, so late segments can weight harder.

Tier does two things and only two things:

- It scales the encounter through the existing `generateWildMon` / `generateTrainerTeam` tier parameter. Define what tier means numerically in `scaling.ts`: level offset, team size, and stat quality. Do not scatter tier logic through the randomizer.
- It selects which reward pool the node draws from.

Rest nodes have no tier. Gym nodes have no tier. Do not model them as `normal`, model them as absent, so the type system stops anyone keying a reward pool off a rest node.

### Rewards

```ts
generateRewardOffer(node: NodeSpec, segment: number, rng: Rng): RewardOffer
applyReward(state: RunState, choice: Reward): RunState
```

An offer is exactly 3 distinct options. Draw the offer **at map generation time**, alongside the map, from the dedicated `rewards` stream. Do not draw at node completion. Drawing lazily makes the roll depend on how many turns the battle took and how many battle rolls were consumed, which is exactly the seed-compatibility failure Stage 2 warned about. Write the choice into `docs/generation.md` next to the Stage 1 entry.

Reward kinds for Stage 3: held item, currency, move tutor (replace one move on a party member), TM (add a move from a segment-appropriate pool), and heal. Species rewards are typed now but gated off, see the note at the bottom.

`applyReward` returns new state and is the only path by which a reward changes anything. It hangs off the `resolveNode` hook Stage 1 built. If you find yourself mutating party state from the reward screen, the seam is being bypassed.

Pool contents live entirely in `data/rewardPools.ts`, keyed by tier and segment band. Elite pools contain strictly better entries, not merely more entries. A pool that is just "more rolls of the same table" produces no gradient and the simulator will show it as noise.

### Held items

This is the part that touches the sim, so it is the part that will surprise you.

`PokemonState` gains an optional `item`. The battle driver applies it to the `PokemonSpec` handed to `@pkmn/sim`. Items are a native Showdown concept, so the work is plumbing, not mechanics.

- `data/items.ts` is a curated whitelist, not the full item dex. Start with roughly 15 to 25 items that are legible to a player and that visibly change a battle: Leftovers, Life Orb, Choice Band, Choice Specs, Focus Sash, Assault Vest, type-boosting items, Eviolite.
- Exclude anything whose effect depends on systems that do not exist here: EV or IV items, breeding items, evolution items, and anything that only matters with switching. Switching arrives in Stage 4, so document the excluded-for-now set in a comment rather than deleting it.
- One item per Pokémon. Acquiring a second offers a swap, and the swapped-out item is lost. Do not build an inventory. Inventories are a Stage 4 conversation once there is a party to hold them.
- Choice items lock a move. With a party size of 1 and no switching, a Choice lock persists for the whole battle. Verify that plays acceptably before keeping them in the pool, and cut them from the pool if the simulator says they are a trap. That is a data change, not a code change.

### Currency, shops, events

**Currency.** A single scalar on `RunState`. Earned per completed battle node, scaled by tier, values in `data/shop.ts`. No currency from rest nodes. Spending is validated in `core/economy.ts` and can never go negative, including in a replayed log.

**Shops.** A node type with generated stock: N items drawn from a segment-appropriate table, each with a price. The player may buy any subset they can afford, then leave. Stock is generated at map generation from the `rewards` stream, same rule as reward offers. No selling in Stage 3. No reroll.

**Events.** Data-driven, in `data/events.ts`. Each event is a prompt, 2 or 3 choices, and per-choice outcomes. Outcomes are a **declarative typed union** (`{kind: 'currency', amount}`, `{kind: 'damage', percent}`, `{kind: 'item', pool}`, `{kind: 'nothing'}`), never a callback. Two reasons: outcomes must serialize into the run log, and the simulator must be able to score them without executing arbitrary code. Randomized outcomes draw from the `rewards` stream at map generation, so an event that says "50/50" has already flipped the coin when the map was built, and reloading cannot reroll it.

### Policy extensions

```ts
type RunPolicy = {
  chooseStarter: (options: PokemonSpec[]) => Promise<number>;
  chooseNode: (options: NodeSpec[]) => Promise<number>;
  chooseReward: (offer: RewardOffer, state: RunState) => Promise<number>;
  chooseShopPurchases: (stock: ShopStock, state: RunState) => Promise<number[]>;
  chooseEventOption: (event: EventInstance, state: RunState) => Promise<number>;
  battle: Policy;
};
```

The UI implements these. So do the sim policies. `playRun` must still complete headless under Node with no DOM, and the existing headless test must be extended to cover a run that takes rewards, buys from a shop, and resolves an event.

### Simulator extensions

The Stage 2 report keeps everything it already reports. Add:

- **Win rate by node policy.** Run the same seeds under `tier-averse` (always take the lowest available tier) and `tier-greedy` (always take the highest). Report completion rate for each.
- **Reward take rate by kind.** Which reward kinds a greedy policy picks, and the win rate conditional on having picked each kind at least once.
- **Currency curve.** Median currency held entering each shop. If players are always broke or always flush, the prices are wrong.
- **Item impact.** Completion rate for runs that acquired item X versus runs that did not. This is correlational and will be noisy at 1000 seeds, so print the sample size next to every figure and do not act on a split with fewer than about 50 runs on either side.

Add `--policy tier-averse` and `--policy tier-greedy` to the CLI. Both use the Stage 0 greedy battle AI, so the only variable is node selection.

### Starting balance targets

Hypotheses to test, not truths:

- `tier-greedy` completion rate is **higher** than `tier-averse` by a visible margin. If elite paths pay off worse than safe paths, the reward pools are too weak and the whole stage has failed its purpose.
- `tier-greedy` has visibly higher variance: more early deaths and more full clears. Risk should mean risk.
- Neither extreme dominates so hard that mixed play is pointless. If `tier-greedy` wins 3x as often, elite encounters are undertuned rather than rewards being overtuned, so check the encounter side first.
- No reward kind is picked by a greedy policy more than about half the time. If one kind is always correct, the choice of 3 is decorative.

If the first report shows `tier-averse` ahead, do not touch `rewards.ts`. Fix `rewardPools.ts` and `scaling.ts`.

### Determinism

Everything Stage 3 draws comes from the `rewards` stream. Nothing new touches `map`, `battle`, or the randomizer stream. Test stream isolation directly, again, in both directions.

Bump the run log version. The log now carries reward choices, shop purchases, and event choices in order. A log from Stage 2 must be rejected loudly with a message naming the version mismatch, never silently replayed. Extend the mid-run save/reload/replay test to cover a save taken between a battle and its reward choice, which is the boundary most likely to be wrong.

### UI

Three new screens plus one change to an existing one.

- **Map screen:** each offered node shows its tier and a readable hint of the reward tier it carries. The player must be able to see the trade before committing. This is the single most important pixel in the game.
- **Reward screen:** 3 cards, one pick, no skip, no reroll.
- **Shop screen:** stock, prices, current currency, buy and leave.
- **Event screen:** prompt text, choices, outcome revealed after picking.

Keep the Stage 0 visual language.

### Out of scope

Party slots, switching, party management, bench experience (Stage 4). Unlocks, daily seed, run history, seed links, mobile pass (Stage 5). Selling to shops, reward rerolls, inventories, consumable items, EVs, IVs, natures.

### Tests required

1. Determinism: same seed produces identical tier assignment, reward offers, shop stock, and event outcomes, twice.
2. Stream isolation: adding a draw to the `rewards` stream does not change map, battle, or randomizer output for a fixed seed, and vice versa.
3. Item effect fires in the sim: a Pokémon holding Leftovers recovers HP at end of turn, and a Choice item locks the move. Assert against the battle protocol, not against your own state.
4. Every reward offer contains exactly 3 distinct options, all legal for the current run state.
5. Currency never goes negative, including through a replayed log, and a purchase over budget is rejected.
6. Event outcomes serialize and replay to identical state.
7. Tier scaling is monotonic: for a fixed segment and many seeds, elite specs are stronger than hard, which are stronger than normal, by whatever metric `scaling.ts` defines.
8. Version guard: a Stage 2 log throws on replay.
9. Stage 0, 1, and 2 suites still pass unchanged.

### Definition of done

The spec's bar for this stage is behavioural, not functional: a playtester agonizes over a node choice. Functionally, that means a full 8-gym run is playable with visible tiers, a 3-card reward after every battle node, working held items, a shop, and events. And `npm run sim -- --seeds 1000 --policy tier-greedy` beats `--policy tier-averse` on completion rate.

---

## One thing to decide before you run this

Species rewards. The spec lists rare species in the Stage 3 reward pools, but party size is still 1 until Stage 4, so a species reward is not an addition, it is a forced swap of the run's only Pokémon. That is either the most interesting decision in the game or an instant run-ender, and there is no way to know which without playing it.

My recommendation: build the `species` reward kind into the type union now so the shape is right, keep entries in `data/rewardPools.ts`, and gate it behind `tuning.allowSpeciesRewards = false`. Flip it on once and playtest it deliberately, separately from everything else in this stage. If it is fun, it becomes a Stage 3 feature. If it is not, it waits for Stage 4 when a swap costs a slot instead of the whole run.
