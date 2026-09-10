# GYMRUN Stage 4.5.1: Attrition, Inventory, and Reward Legibility

Paste into Claude Code in the existing repo, after Stage 4.5 is merged, before Stage 5.

---

## PROMPT

You are building **Stage 4.5.1** of GYMRUN. Read `pokerun-build-spec.md`, `docs/generation.md`, the Stage 4.5 prompt, and the existing `src/core/` before writing anything.

Stage 4.5 was a display-only pass with a hard constraint that the simulator output stay byte identical. **That constraint does not apply here.** This stage changes healing, adds inventory state, and turns species rewards on. Balance will move and the numbers will need a retune pass. Plan for a fresh simulator report, not a diff.

### Report before you write any code

Three things must be answered first, because each one can invalidate existing seeds:

1. **How is `tuning.allowSpeciesRewards` implemented in Stage 3?** If the flag filters species entries out of `data/rewardPools.ts` before the draw, flipping it to `true` shifts every reward roll for every seed and requires a `randomizerVersion` bump. If it draws normally and filters after, flipping it costs nothing. Report which, and bump if needed.
2. **Where is HP being restored between nodes?** Stage 1 specified that HP and PP persist and that fainted members revive at the start of the next node. Stage 4 raised party size, and the suspicion is that the revive path now full-heals every member rather than only reviving fainted ones. Find the actual code path and report what it does today before changing it.
3. **Does `@pkmn/client` already expose gender from the `|switch|` details string?** It should. Confirm before building anything for it.

Stop and report all three. Do not proceed until reviewed.

---

## Part 1: Attrition

Healing is currently free, and that makes three systems dead: rest nodes are strictly dominated, the heal reward dilutes every offer it appears in, and the Stage 3 risk gradient loses its cost axis. A hard encounter that costs nothing on a win is only a variance bet, which is a worse decision than a guaranteed price paid for a better reward.

- HP and PP persist across nodes. No reset, no partial top-up, nothing outside rest nodes and explicit heal effects.
- Status continues to clear between nodes, per `tuning.clearStatusBetweenNodes`. That decision stands.
- Fainted party members revive at the start of the next node at `tuning.reviveHpPercent`, defaulting to `0.5`. Not full.
- Cut rest node frequency. The current value was tuned for a world where healing was free. Expose it as a tuning number, do not hardcode it into map generation.

**PP is deferred.** Do not change PP restoration behaviour in this stage. Whether PP is a real resource or decoration is an open question that the simulator can answer from average turns per battle against segment length, and that measurement is postponed. Leave PP exactly as it behaves today.

Rest node restore behaviour itself is unchanged: full HP, full PP, status cleared.

---

## Part 2: Backpack

Stage 3 deliberately deferred inventory: "Do not build an inventory. Inventories are a Stage 4 conversation once there is a party to hold them." Stage 4 is done. Build it now.

- `RunState` gains `backpack: ItemId[]`. It serializes.
- Capacity is `tuning.backpackCapacity`, defaulting to party size plus two. When acquiring an item over capacity, the player chooses what to discard. Do not silently drop, do not silently refuse.
- Items are freely reassignable between party members outside of battle, at no cost, any number of times between nodes.
- Item assignment is locked during a battle. No mid-battle swapping.
- Removing an item from a Pokémon returns it to the backpack. It is never destroyed except by an explicit discard choice.
- The Stage 3 rule that a swapped-out item is lost is retired. Delete it, do not leave it behind a flag.

**Item assignment is a logged player decision.** It affects battle outcomes, so it must serialize into the run log in order and replay identically. This is the main reason this stage bumps the log version.

Capacity is deliberately finite so that acquisition stays a decision rather than pure accumulation. If the simulator later shows players never hit the cap, that is a tuning number, not a redesign.

---

## Part 3: Gender

Gender is already in the Showdown protocol via the `|switch|` details string. Display it, read only.

- Show gender on the battle screen and the party management screen, next to level.
- Do not add gender to `PokemonSpec`. The sim derives it from species gender ratio, which is reproducible for a fixed seed. Adding it to the spec is a randomizer change and is not justified until the simulator shows gender-dependent effects actually landing.
- Genderless species display nothing, not a placeholder.
- **Audit the move and ability pools for gender-dependent entries.** Attract on a genderless species is a dead move. Rivalry and Cute Charm can roll onto anything under full ability randomization, so they land more often here than in a normal Pokemon game. Report what you find and add blacklist candidates to `data/blacklists.ts` with a comment explaining why, per the Stage 2 rule. Do not blacklist anything without reporting it first.

---

## Part 4: The editorial rule for all reward and tooltip copy

This governs everything in Parts 5 and 6 and overrides any instinct toward helpfulness.

**The UI presents attributes. It never presents verdicts.**

Never render: a recommendation, a "best" or "recommended" marker, a numeric score or rating, highlighting that distinguishes a superior option from an inferior one, an ordering that implies ranking, or effectiveness against content the player has not yet reached.

Specifically, a move reward card must not indicate which of the player's current moves it would improve on, and must not show effectiveness against the upcoming gym's type identity.

The single exception is live type effectiveness against the Pokemon currently on the field during a battle, which was agreed in Stage 4.5. That is a fact about the present board state, not a hint about a future decision.

The player should be able to work out that a move is good. The UI should not tell them.

---

## Part 5: Display additions

All of these reuse existing components. Build nothing new where a Stage 4.5 component already exists.

**Party management screen.**
- Full six-stat display, HP, Atk, Def, SpA, SpD, Spe, using the same stat component as the battle panel.
- Each member's held item shown inline, with assignment handled on this screen. The backpack and the party are one screen, not two.
- Status and ability tooltips reachable here, not only mid-battle.

**Reward cards.**
- Move rewards show type, base power, PP, and category, using the battle screen's move card component unchanged. A move must look identical everywhere the player sees it.
- Item rewards show a plain-language effect line, not just the item name. Source it from `data/items.ts` metadata, add a `playerDescription` field if one does not exist.

**Verbosity toggle.**
- Two modes, Simple and Detailed. Global, persisted across runs in the same store as any other cross-run setting.
- Defaults to Detailed on first launch, so a new player encounters the help before they know it exists.
- Simple hides raw stat numbers in favour of relative bars, and keeps the faster-side marker from Stage 4.5. Detailed shows numbers. *(Flagged: this definition was not specified, it is my default. The toggle otherwise has no behaviour.)*
- **The toggle is presentation only.** One flag, read by components. It never branches game logic, never touches `BattleView`, and never changes what data the core layer produces. Add a test that asserts the flag is unreachable from `core/`.

**Stat abbreviation help.**
- A persistent affordance on every stat abbreviation explaining what it means. Atk versus SpA is the exact distinction a non-player cannot infer, and it must be answerable without leaving the screen.
- Same tap-first tooltip layer built in Stage 4.5. Do not add a second tooltip mechanism.

---

## Part 6: Move replacement selection

This is the logic change in this stage. Everything else is display or tuning.

Today a move reward resolves without the player choosing what it displaces. That is the wrong shape: which move you give up is a more interesting decision than which move you gain, and with a party larger than one, the game currently cannot even ask which member learns it.

**Two new player decisions, both logged.**

```ts
type RunPolicy = {
  // ... existing
  chooseMoveRecipient: (offer: MoveReward, party: PokemonState[], state: RunState) => Promise<number>;
  chooseMoveToReplace: (member: PokemonState, incoming: MoveSpec, state: RunState) => Promise<number>;
};
```

Rules:

- The player picks the recipient first, then the move to displace on that member.
- **There is no decline.** The decision to skip a move reward belongs at reward-card-pick time, where the player already chose it over two alternatives. Offering a second escape hatch makes the card pick meaningless.
- If a member has an empty move slot, the incoming move fills it and no replacement choice is presented.
- The replacement screen shows the incoming move and all four current moves side by side, all using the same move card component, all showing type, base power, PP, and category. This satisfies the comparison need without violating Part 4: the player sees the data laid out, and the UI renders no verdict about which to drop.
- The displaced move is gone. No move storage, no relearner.

**Logging and determinism.**

- Both choices serialize into the run log immediately after the reward choice they belong to. Order matters for replay.
- Neither consumes RNG. These are player decisions.
- Bump the run log version. A Stage 4 or Stage 4.5 log must be rejected loudly with a message naming the version mismatch, per the existing rule.

**Simulator policies must implement both.** Give the greedy policy a documented deterministic heuristic, for example: recipient is the party member whose types best match the incoming move's type, replacement is the lowest base power damaging move, or the first status move if the member holds more than one. The heuristic does not need to be smart. It needs to be deterministic and written down in a comment, because it will show up in every balance report from here on.

---

## Part 7: Species rewards, on by default

Flip `tuning.allowSpeciesRewards` to `true`. The Stage 3 note gated it off because party size was one and a species reward was a forced swap of the run's only Pokemon. Party size is no longer one, so the objection is gone.

- If the party has an empty slot, the species is added.
- If the party is full, the player chooses which member it replaces. Reuse the recipient-selection shape from Part 6. Same logged-decision treatment, same replay requirement.
- The replaced member is gone. No box, no storage, no retrieval.

**Coverage one-liner.**

A species reward card shows a single line describing the change in the party's offensive type coverage, before and after.

- Implement coverage as a pure function in `core/`, something like `offensiveCoverage(party: PokemonState[]): TypeName[]`, returning the set of types the party can currently hit super effectively with its available damaging moves.
- The card renders the before set and the after set. One line. No score, no delta count framed as good or bad, no arrows, no colour coding that implies improvement.
- This is a factual readout, and Part 4 applies to it in full. "Coverage: adds Dragon, Steel. Loses Ghost." is correct. "Improves your coverage" is not.
- When the party is full and the swap target is not yet chosen, compute against the currently highlighted target so the line updates as the player moves between members.

Keep the function pure and free of RNG so it can be lifted into the simulator later. Do not wire it into the simulator in this stage.

---

## Determinism and versioning

- **Run log version bumps.** New logged decisions: item assignment, move recipient, move replacement, species recipient, and backpack discard. Old logs rejected loudly.
- **`randomizerVersion` bumps only if** the `allowSpeciesRewards` investigation from the top of this prompt shows that flipping the flag changes reward pool composition before the draw.
- No new RNG streams. No new draws. Every decision added in this stage is a player decision, not a roll.
- Stream isolation tests from Stages 2 and 3 must still pass unchanged.

---

## Order of work, stop for review after each

1. The three investigation questions at the top. Report, do not code.
2. Attrition changes and tuning numbers. Run the simulator, report, retune.
3. Backpack state, capacity, assignment, discard, and its log entries.
4. Move replacement selection: policy interface, log entries, sim heuristics, headless test. No UI.
5. Species rewards on, recipient selection, coverage function.
6. Gender display and the move and ability pool audit.
7. All Part 5 display work, including the verbosity toggle.
8. Full simulator run and a second retune pass against the combined changes.

UI comes last, as in every prior stage.

---

## Tests required

1. HP and PP persist across a node boundary with no restoration outside rest nodes and heal effects.
2. A fainted member revives at exactly `tuning.reviveHpPercent`, not full, at the start of the next node.
3. Backpack capacity is enforced, over-capacity acquisition presents a discard choice, and no item is ever silently destroyed.
4. Item assignment replays identically from a saved log, including a save taken between assignment and the following battle.
5. Move replacement: the displaced move is gone, the incoming move occupies its slot, and an empty slot skips the replacement prompt.
6. A headless `playRun` completes under Node with a scripted policy that takes a move reward, replaces a move, takes a species reward, swaps a party member, assigns items, and buys from a shop.
7. Species swap replays identically, and the coverage function is pure and returns identical output for identical input.
8. The verbosity flag is unreachable from `core/`.
9. Version guard: a Stage 4.5 log throws on replay with a message naming the mismatch.
10. Stream isolation from Stages 2 and 3 passes unchanged.
11. Stage 0 through 4.5 suites pass, except those asserting the old healing behaviour, which must be updated with a comment explaining the change rather than deleted.

---

## Out of scope

PP restoration changes. Move storage or relearning. Box or PC storage for replaced party members. Selling to shops. Reward rerolls. Consumable items. A coverage score or rating of any kind. Any simulator policy that reads tooltip-derived information. Everything in Stage 5.

---

## Definition of done

A player takes visible attrition damage across a segment and has to decide whether a rest node is worth a reward node. They carry a small pool of items and reassign them between fights. When they take a move reward they choose who learns it and what it costs them. When they take a species reward they see, in one factual line, what their party gains and loses in coverage. A player who has never played Pokemon can read every screen in Detailed mode and find the answer to any abbreviation on it. And the simulator produces a fresh balance report whose per-gym clear rates are back inside the Stage 2 targets after retuning.

---

## Decisions I defaulted, flagged for your review

- **Map reveals tier only, never species.** This is status quo, so no work. It matters now because free item reassignment plus a species reveal would make pre-fight loadout optimization trivially correct, which turns a build decision into a chore.
- **Simple mode shows relative bars in place of raw stat numbers.** The toggle had no defined behaviour otherwise.
- **Party-wide coverage gap display was not built as a standalone party screen feature.** The coverage function exists and is used on species reward cards only. Surfacing it permanently on the party screen edges close to the Part 4 verdict rule and is worth deciding separately.
- **No `--policy simple` simulator run.** Whether the game is winnable without tooltip-derived information is a real question, and it is not answered in this stage.
