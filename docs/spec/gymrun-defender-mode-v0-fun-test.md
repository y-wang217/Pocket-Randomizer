GYMRUN Defender Mode v0: Fun Test
Paste into Claude Code on a fresh branch off main. Commit this file verbatim to `docs/spec/` with a register row before doing anything else.
PROMPT
You are building Defender Mode v0: the player is the gym leader, drafts a type-locked roster, and defends against waves of trainers.
This is a fun test, not a stage. If it is not fun by hand, the branch is thrown away. So: build it as a second run mode selected at run creation, delete nothing from the attacker loop, reuse every existing screen and component you can, and ship on placeholders. No new art.
Read `docs/architecture.md`, `docs/generation.md`, `docs/balance.md`, and `src/core/` before writing anything.
Rules that hold

* `core/` never imports from `ui/`. No `Math.random`. Keyed streams only, and a key never varies with player behaviour.
* Every number lives in `data/`.
* Attributes, never verdicts.
* Version guards stay loud. Balance is not a gate: record the number and keep going.
* Attacker mode still runs and its suites pass. Prove its generation is unchanged apart from version and hash fields.

Report before you write any code

1. Species count carrying Fire, Psychic, and Flying in either type slot, per segment band, and how many of each are final stage.
2. Can a format-level handler in `@pkmn/sim` modify crit ratio and Speed for one side only? Name the exact mechanism.
3. Can a spec carry a fifth move through the adapter, the AI view, and the battle UI?
4. Does the opponent AI commit its action before the player's choice is submitted, and independent of it? Where, and can it be surfaced through the battle view?
5. What IVs do both sides get today, and does `PokemonSpec` carry them to the sim?
6. Does any trainer class concept exist? What does `generateTrainerTeam` key on?
7. What does an out-of-battle consumable need? The TM inventory is the nearest precedent.
8. Cheapest way to express the wave structure below: the existing segment generator under different tuning, or a new generator. Recommend one.

Stop and report. Do not proceed until reviewed.
Run structure
Eight ranks. Each rank is:

1. A wave of `defender.waveLength[rank]` battles. Start at `[2,2,3,3,4,4,5,5]`.
2. Each battle is a door: 2 challengers offered, each showing trainer class and tier. Pick one.
3. A reward pick of 3 after every battle.
4. Intermission after the wave: shop, TM teaching, party management. This is the only shop and the only place a TM is taught.
5. Boss. On a win: existing two-page boss payout, full restore, slot unlock per the shipped schedule.

Party wipe ends the run. HP and PP persist inside a rank under the existing attrition rules. There are no rest nodes.
Switched off in defender mode: locales, wild nodes, capture, events, rest nodes, and capability relics (no events to gate).
Gym select and draft

* Offer the three gym types: Fire, Psychic, Flying. Player picks one.
* Draft 3 mons, each a pick 1 of 3, drawn from species carrying the gym type in either slot.
* Type lock: every roster slot must carry the gym type. Secondary types are the coverage.
* Slot fill: when a slot unlocks, the player gets a recruit draft, pick 1 of 3, same type rule. Trades cannot grow a party, so this is the only way one grows.
* One relic in the boss relic pool grants a single slot exempt from the type lock. It appears at most once per run.

Badges
A badge applies only to party members carrying the gym type. The off-type slot gets nothing.
Fire. Each mon has one highlighted move slot, drawn at mon generation from its damaging slots. Consecutive uses of that move add crit stages: first use +1, second +2, third and later +3, which in Gen 9 is 1/8, 1/2, guaranteed. The streak resets on any other move, on switching out, and on fainting. The highlight belongs to the slot, so a TM taught into that slot inherits it. The move button shows the crit chance of its next use.
Psychic. Before the player chooses, the opponent's committed action for this turn is shown, moves and switches both. Forced replacements after a faint are not revealed.
Flying. 1.1x Speed. Each mon also gets a fifth move usable once per battle: Peck if the species can still evolve, Pluck if it is final stage. It costs the turn, has no persistent PP, and resets every battle. Render it as a fifth button outside the 2x2 grid. Every Speed readout and the AI's Speed read must come from the sim's effective value, so the multiplier is never contradicted on screen.
Badge levels are parked. The relic pool is today's pool minus capability relics, plus the off-type slot relic.
Opponents

* Trainer classes. New `data/trainerClasses.ts`: class name, type set, rank band, sprite key. Early ranks are single-type weak classes (Bug Catcher, Youngster, Lass). Middle ranks are themed classes (Hiker, Swimmer, Black Belt, Bird Keeper). The last ranks are untyped Ace Trainers and Veterans. The two challengers at a door are always different classes.
* Bosses are not type locked. Team size and level follow the existing gym columns. The pre-boss screen shows team size and level, not species.
* IVs. Player mons get 31 in every stat. Opponents, bosses included, get a flat IV per rank from `data/scaling.ts`: `[0, 5, 10, 14, 18, 24, 26, 28]`. This reverses the build spec's out-of-scope line on IVs. Record that in `docs/generation.md`.

Rewards and economy

* Consumables. New `data/consumables.ts`: Potion, Super Potion, Hyper Potion, values in data. Used between battles only, never in battle. Single use. They share backpack capacity with held items and berries. Using one is a logged decision.
* Reward offers gain consumables as a kind. Berries are unchanged.
* Trade is a reward card kind. The card shows both sides: the mon offered and the party member the requester wants. Taking it is mon for mon, the player does not choose what to give up. Declining is picking a different card.
   * The offered mon is drawn at generation, obeys the type lock, and is drawn one quality step above the rank's norm.
   * The requested member cannot be drawn at generation, since the party is a player decision. Draw a single selector value at generation and resolve it against the party in acquisition order when the offer is shown. RNG consumption is constant whatever the party looks like.
   * The held item of the traded mon returns to the backpack.
   * At most one trade card per offer. Rate in tuning.

Determinism and logging

* New logged decisions: gym type, draft picks, door choice, recruit picks, consumable use, trade accept.
* Bump `RUN_LOG_VERSION` and `RANDOMIZER_VERSION`. `contentHash` moves on its own. Hold `AI_VERSION` unless the Psychic reveal forces a change in AI decision order, and say so if it does.
* The run log records the mode. A defender log replayed as attacker throws.

Simulator
Minimal. One benchmark row per gym type, 200 seeds, metric mean bosses beaten, stamped with seed prefix, seed count and AI version. Greedy battle policy, first-door choice, never trades, uses a consumable when a member is under half HP.
State in the report header that this bot does not read the Psychic reveal and does not hold a Fire streak, so both rows understate their badge. The test of this mode is by hand.
Order of work, stop for review after each

1. Report questions.
2. Mode flag, gym select, draft, type lock, IV table, trainer classes. Headless.
3. Wave structure, door, intermission, boss. Headless `playRun` to completion.
4. The three badges through the sim, with protocol-level tests.
5. Consumables, trades, recruit draft, off-type relic.
6. Benchmark rows.
7. UI on existing components.

Tests required

1. Same seed and decisions give an identical defender run, twice.
2. Every drafted, recruited and trade-offered mon carries the gym type, over many seeds. The exempt slot accepts one off-type mon and no more.
3. Fire: crit ratio is +1, +2, +3 across three consecutive uses and the third use crits, asserted against the protocol. The streak resets on a different move and on a switch.
4. Psychic: the revealed action equals the action the opponent attempts, over many turns and seeds.
5. Flying: effective Speed is 1.1x for gym-type members only. The fifth move works once per battle per mon and is available again next battle.
6. Opponent IVs match the rank table. Player IVs are 31.
7. Trade: RNG consumption is identical for two different parties on one seed. The requested member is the same across a save and reload.
8. A consumable cannot be used in battle, is destroyed on use, and replays identically.
9. A party never exceeds the slot schedule, and a trade never changes party size.
10. Attacker mode suites pass. A defender log throws under attacker replay.

Definition of done
A player picks a gym type, drafts three mons, reads the class of each challenger at the door, fights through eight ranks of waves and bosses, and can say after one run whether the badge changed how they played.
Out of scope
Badge levels, leader characters and traits, the card battle system, the other fifteen types, a lives system, new art, retuning, a tutorial pass, events.
Defaults I am taking, flagged for review

* Two challengers at each door, so class is something the player acts on. The alternative is a forced queue.
* A recruit draft fills each unlocked slot.
* Badges apply to gym-type members only.
* Flying's free move costs the turn. Peck or Pluck is decided by evolution stage.
* Fire's highlight is drawn per mon, not chosen.
* No boss species preview.
* Full restore after each boss, none before it.
* TMs teach only at the intermission.
* Consumables share backpack capacity.
