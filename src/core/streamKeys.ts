/**
 * Every RNG sub-stream key in the game, in one file.
 *
 * **Stage 4.6a, and it is the other half of the keyed-stream refactor.** The
 * mechanism lives in `core/rng.ts`; this is the *namespace*. A key is a string,
 * and a string typed at a call site is a string that can be typed differently
 * at the next one — two keys that were meant to be the same sequence, silently
 * drawing two.
 *
 * ## The rule
 *
 * A key names a *thing that draws*, never a moment in time. `node('s3-cave-2-0')`
 * is a key; "the fourth draw of segment 3" is not. That is what makes a key
 * stable: the same node in the same seed opens the same sequence however much
 * generation around it changes.
 *
 * ## Why the purposes are separated
 *
 * A node's reward offer, its shop stock and its event outcomes could share one
 * key — they never co-occur on the same node. They do not share one, because
 * "never co-occur" is a property of today's node kinds and a key is forever.
 * Separate purposes mean a stage that lets an event node also pay a card adds a
 * draw to a sequence nothing else reads.
 *
 * ## What this buys the next two sub-stages
 *
 * 4.6b adds banded reward draws and 4.6c adds three-band event outcomes. Both
 * add draws *inside* a key that already exists, or under a new key. The first
 * moves only that node's own later draws in that one purpose; the second moves
 * nothing. Neither can reach the map shape, the teams or the battle seeds.
 * `docs/spec/gymrun-seeds-and-mappability.md` is the long form of that argument.
 */

/** The starter options, drawn once per run before the map. */
export const STARTERS_KEY = 'starters';

/**
 * One node's contents, on `randomizer`, and its sim seed, on `battle`.
 *
 * The same key on two streams is deliberate and safe: the streams are already
 * domain-separated by name, so `randomizer#node/x` and `battle#node/x` are two
 * unrelated sequences. Using one key for both is what makes "everything about
 * node x" one thing to reason about.
 */
export function nodeKey(nodeId: string): string {
  return `node/${nodeId}`;
}

/** What a node pays, on `rewards`. One purpose per key; see the header. */
export function nodeRewardKey(nodeId: string, purpose: 'offer' | 'shop' | 'event' | 'capture'): string {
  return `node/${nodeId}/${purpose}`;
}

/** The locales a segment offers, on `map`. */
export function localeOfferKey(segment: number): string {
  return `seg${segment}/locale-offer`;
}

/**
 * One route's shape, on `map`: step count, kinds, the composition fix-ups and
 * the tiers.
 *
 * Keyed by locale as well as segment because a segment generates a route for
 * **every** locale it offers and the player keeps one. Two locales drawing off
 * one sequence would make the road through the Cave depend on whether the Marsh
 * was offered beside it — a dependency nobody can see and every recorded seed
 * would rest on.
 */
export function routeKey(segment: number, locale: string): string {
  return `seg${segment}/${locale}/route`;
}

/** The gym clear offer, on `rewards`. */
export function gymRewardKey(segment: number): string {
  return `seg${segment}/gym-reward`;
}

/**
 * The characters of a freshly minted run seed, on `map`.
 *
 * The odd one out, and worth saying why it exists rather than leaving the next
 * reader to wonder.
 *
 * `ui/seed.ts` mints a session's first seed by pouring CSPRNG entropy through
 * `createRng` and reading characters back out. Until Release 0.5 it read them
 * off the *unkeyed* root of `map` — the last caller of that API anywhere in
 * `src/`, and the one place production code could still draw from a sequence
 * whose position depends on everything drawn before it.
 *
 * Porting it is safe in a way porting any other caller would not have been.
 * A ported call site draws different values, which for a call site inside a run
 * is a seed break; this one's input is fresh entropy that never repeats, so
 * "different values" is not observable and no recorded seed moves. That
 * argument is specific to this caller and does not generalise.
 *
 * It buys the property the sweep was for: **no production code can draw
 * unkeyed.** What remains of the old API is read only by the tests that exist
 * to test it, which makes its deletion a question about the test suite rather
 * than about the game.
 */
export const SEED_KEY = 'seed';

/**
 * One Pokemon's nickname, on `randomizer`. **Stage 4.8, item 5.**
 *
 * `id` identifies *the thing that offers the Pokemon* — a node id for a wild or
 * event capture, `starter/N` for a starter option — and never the moment the
 * player took it. That is the rule this whole namespace rests on, and it is what
 * makes a name stable across a save, a reload and a replay: the same node in the
 * same seed opens the same sequence however the run was played.
 *
 * A new key, so it shifts nothing. Every Pokemon in the game gained a name and no
 * recorded map moved, which is the property the keyed refactor was built to buy and
 * the first time a stage has spent it on something this broad.
 */
/**
 * Which library record a trainer or gym node is, on `randomizer`. **Stage 6.0.**
 *
 * One draw per node, its own key. The team's member draws stay on `nodeKey`,
 * so a library edit that changes which record a node resolves to moves the
 * canonical members and nothing else: the rolled fill, the abilities, the
 * genders and the held items beside them are drawn exactly where they were.
 * A key names a thing that draws; this one names the pick.
 */
export function encounterKey(nodeId: string): string {
  return `node/${nodeId}/encounter`;
}

export function nicknameKey(id: string): string {
  return `nickname/${id}`;
}

/**
 * The sim seed of a battle started with no generated node behind it.
 *
 * `createBattle` derives its own sim seed when a caller hands it a run seed
 * and no `simSeed` — the Stage 0 fixture battles and the determinism suite,
 * never a run, which always passes the seed `encounters.ts` drew under
 * `nodeKey`. Until the `contentHash` release that fallback drew off the
 * unkeyed root of `battle`, and it was the one unkeyed draw left in `src/`;
 * the root is gone, so it draws here. A stable key, named for the thing that
 * draws, never for a moment: the same fixture seed gives the same battle.
 */
export const FIXTURE_BATTLE_KEY = 'fixture-battle';

/**
 * The balance simulator's scripted bots: the `random` battle policy's move
 * picks, and every bot's uniform locale and node draws.
 *
 * The `policy` stream exists so a scripted policy can be reproducible without
 * borrowing a stream that belongs to a game system, and until the
 * `contentHash` release the simulator drew off its unkeyed root. The root is
 * gone; this is the one key the simulator opens on it. Nothing in a run reads
 * it — a run's policy is the player — so moving it moves no seed.
 */
export const SIM_POLICY_KEY = 'sim-policy';

/*
 * ---------------------------------------------------------------------------
 * Defender Mode v0
 * ---------------------------------------------------------------------------
 *
 * Every defender key starts `defender/`, and no attacker key does, so nothing
 * the mode draws can share a sequence with anything an attacker run draws.
 * `test/attacker-generation-golden.test.ts` is what holds that.
 */

/**
 * One gym type's whole opening draft, on `randomizer`: every option of every
 * pick, in pick order. Opened for all three types on every defender run,
 * because the type is a decision (report ruling R3).
 */
export function defenderDraftKey(gymType: string): string {
  return `defender/draft/${gymType}`;
}

/**
 * The Fire badge's highlighted slot for one generated defender-side mon, on
 * `randomizer`. `mon` names the mon, never a moment: `draft/Fire/4` is the
 * fifth option drawn in the Fire draft.
 */
export function defenderHighlightKey(mon: string): string {
  return `defender/highlight/${mon}`;
}

/**
 * One defender node's contents on `randomizer` and its sim seed on `battle`,
 * as `nodeKey` is for an attacker node. Defender node ids are `r<rank>-…`.
 */
export function defenderNodeKey(nodeId: string): string {
  return `defender/node/${nodeId}`;
}

/**
 * What a defender node pays, on `rewards`, as `nodeRewardKey`. `event` is a
 * question mark's option draws (2026-10-06), a purpose nothing else reads.
 */
export function defenderNodeRewardKey(nodeId: string, purpose: 'offer' | 'shop' | 'trade' | 'event'): string {
  return `defender/node/${nodeId}/${purpose}`;
}

/**
 * A rank's question marks, on `map`: each one's shape and identity, in step
 * order (2026-10-06). One key per rank, as `defenderDoorKey` is one per door.
 */
export function defenderRankEventsKey(rank: number): string {
  return `defender/rank/${rank}/events`;
}

/** One door's two classes and two tiers, on `map`. */
export function defenderDoorKey(rank: number, door: number): string {
  return `defender/r${rank}/door${door}`;
}

/** A rank's boss payout, both pages, on `rewards`. */
export function defenderBossRewardKey(rank: number): string {
  return `defender/r${rank}/boss-reward`;
}

/** One rank's recruit draft for one gym type, on `randomizer`. */
export function defenderRecruitKey(rank: number, gymType: string): string {
  return `defender/r${rank}/recruit/${gymType}`;
}

/*
 * ---------------------------------------------------------------------------
 * The card battle engine (`docs/generation.md` section 125)
 * ---------------------------------------------------------------------------
 */

/**
 * One sandbox card battle's draws, on `battle`, opened on the battle's own
 * seed and never on a run's. The opening shuffle, every reshuffle and each
 * enemy's starting step come off it in sequence. The key names the battle;
 * how far along it a draw sits is the battle's own business, as it is inside
 * a Showdown battle's PRNG.
 */
export function cardBattleKey(encounterId: string): string {
  return `cards/${encounterId}`;
}

/**
 * The card run's generation (`core/cards/cardrun.ts`), on `map`, opened on the
 * run's own seed. One key per thing a node draws, named by the node's place in
 * the run (`a1/s0`, `a2/boss`) and never by how the player got there, so a
 * stop the player never visits draws exactly what it would have.
 */
export function cardRunKey(node: string, what: string): string {
  return `cardrun/${node}/${what}`;
}

/**
 * The card engine's random bot, on `policy`, opened on the bot's own seed. A
 * scripted player, like `SIM_POLICY_KEY`: nothing a person plays reads it.
 */
export const CARD_BOT_KEY = 'cards/bot';

/**
 * The guard bot's trainer (`core/cards/train.ts`): the weight mutations it
 * tries, on `policy`, opened on the training seed. A tool, like
 * `CARD_BOT_KEY`: nothing a person plays reads it, and no battle draws from it.
 */
export function cardTrainKey(): string {
  return 'cards/train';
}
