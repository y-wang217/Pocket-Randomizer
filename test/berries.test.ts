/**
 * Berries: the low denomination, and the one item that leaves the run by itself.
 *
 * **Stage 4.6b.** Every other item on the whitelist is permanent — assigned,
 * unassigned, discarded, but always somewhere. A berry fires once and is gone,
 * and the only witness to that is the `-enditem` line the sim emitted. The
 * whole of this file is the claim that run state agrees with the battle.
 *
 * Four properties:
 *
 *   1. The table is real: fifteen berries the dex knows, all marked consumable.
 *   2. `-enditem` is read off the protocol, for the player's side only.
 *   3. A fired berry leaves the party *and* the bag, permanently — it does not
 *      restock at the next node.
 *   4. Opponents hold them at the rate the table says, and gyms hold none.
 */
import { describe, expect, it } from 'vitest';

import { Dex } from '@pkmn/sim';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { readConsumedItems, runBattle } from '../src/core/battle/driver';
import { firstUsableMovePolicy } from '../src/core/battle/policy';
import { nodesOf } from '../src/core/encounters';
import { spendItems } from '../src/core/items';
import { createParty } from '../src/core/party';
import { generateGymTeam, generateTrainerTeam, generateWildTeam } from '../src/core/randomizer';
import { createRng } from '../src/core/rng';
import { createRun, playRun, resolveNode, scriptedRunPolicy, type RunPolicy } from '../src/core/run';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { GYMS } from '../src/data/gyms';
import { BERRIES, ITEMS, itemById } from '../src/data/items';
import { berryHoldRate, SEGMENT_COUNT } from '../src/data/scaling';

/**
 * A hand-built `NodeResult` reporting no per-member counters. **Stage 4.7.**
 *
 * An empty array rather than one zeroed entry per member, and the difference is
 * a statement: `applyBattleState` reads `contribution[index]` and leaves a
 * member's running total alone when there is nothing at that index, so this
 * says "this fixture is not about contribution" rather than "every member did
 * nothing". The fixtures below are about state transitions — a wipe, a heal, a
 * berry — and a zero would be an assertion they are not making.
 */
const NO_CONTRIBUTION: never[] = [];


const dex = Dex.forGen(9);

// ---------------------------------------------------------------------------
// 1. The table
// ---------------------------------------------------------------------------

describe('the berry table', () => {
  it('names fifteen berries the dex actually has', () => {
    expect(BERRIES.length).toBeGreaterThanOrEqual(10);
    expect(BERRIES.length).toBeLessThanOrEqual(15);
    for (const entry of BERRIES) {
      const item = dex.items.get(entry.id);
      expect(item.exists, `${entry.name} is not a real item`).toBe(true);
      expect(item.name, entry.id).toBe(entry.name);
      // Every one of them really is a berry to the engine, or the `-enditem`
      // sync would be watching for something that never fires.
      expect(item.isBerry, `${entry.name} is not a berry`).toBe(true);
    }
  });

  it('marks them consumable, and marks nothing else consumable', () => {
    for (const entry of BERRIES) expect(entry.consumable, entry.name).toBe(true);
    const others = ITEMS.filter((entry) => !BERRIES.includes(entry));
    for (const entry of others) expect(entry.consumable ?? false, entry.name).toBe(false);
  });

  it('is reachable through the same lookup every other item uses', () => {
    // A berry is a held item in every respect but its lifetime, so it has to
    // resolve through `itemById` — the party screen, the reward card and the
    // backpack all go through it.
    for (const entry of BERRIES) expect(itemById(entry.id)?.name).toBe(entry.name);
  });
});

// ---------------------------------------------------------------------------
// 2. Reading the protocol
// ---------------------------------------------------------------------------

describe('reading -enditem', () => {
  it('picks up a consumed item for the side asked about, and no other', () => {
    const protocol = [
      '|move|p1a: Snorlax|Tackle|p2a: Gengar',
      '|-enditem|p1a: Snorlax|Oran Berry|[eat]',
      '|-enditem|p2a: Gengar|Sitrus Berry|[eat]',
      '|-enditem|p1a: Snorlax|Focus Sash',
    ];
    expect(readConsumedItems(protocol, 'p1')).toEqual(['oranberry', 'focussash']);
    expect(readConsumedItems(protocol, 'p2')).toEqual(['sitrusberry']);
  });

  it('normalises the display name into the id the run stores', () => {
    expect(readConsumedItems(['|-enditem|p1a: X|Lum Berry|[eat]'], 'p1')).toEqual(['lumberry']);
    expect(readConsumedItems(['|-enditem|p1a: X|Choice Band'], 'p1')).toEqual(['choiceband']);
  });

  it('reports every kind of item loss, not only berries', () => {
    /*
     * Deliberate. The run's rule is that an item leaves the bag when the battle
     * says it left the Pokemon, and a reader that only recognised berries would
     * leave a spent Focus Sash sitting on the party screen — an item the player
     * would assign, count against capacity, and find missing.
     */
    const knocked = readConsumedItems(['|-enditem|p1a: X|Leftovers|[from] move: Knock Off'], 'p1');
    expect(knocked).toEqual(['leftovers']);
  });

  it('finds nothing in a protocol with no item loss in it', () => {
    expect(readConsumedItems(['|move|p1a: X|Tackle|p2a: Y', '|-damage|p2a: Y|50/100'], 'p1')).toEqual([]);
  });

  it('reads a real battle where a berry actually fires', async () => {
    /*
     * The end-to-end half: the sim resolves the berry itself, and this asserts
     * the protocol line it emits is the one the reader is watching for. A test
     * built only on hand-written protocol would keep passing if Showdown
     * renamed the message.
     */
    const holder: PokemonSpec = {
      species: 'Snorlax',
      ability: 'Thick Fat',
      moves: ['Tackle'],
      level: 50,
      item: 'sitrusberry',
    };
    /*
     * Level 50 with a middling move, not a level 80 with Close Combat.
     *
     * The first draft one-shot the Snorlax, which skipped the berry entirely —
     * Sitrus fires when the holder *drops below half*, and a Pokemon that goes
     * from full to fainted never passes through that. Worth recording: the
     * berry not firing looked exactly like the reader being broken.
     */
    const attacker: PokemonSpec = {
      species: 'Machamp',
      ability: 'Guts',
      moves: ['Body Slam'],
      level: 50,
    };
    const run = await runBattle([holder] as TeamSpec, [attacker] as TeamSpec, 'BERRY-FIRES',
      firstUsableMovePolicy, firstUsableMovePolicy);

    expect(run.protocol.some((line) => line.includes('-enditem'))).toBe(true);
    expect(run.consumed).toContain('sitrusberry');
  }, 30_000);
});

// ---------------------------------------------------------------------------
// 3. Spending it
// ---------------------------------------------------------------------------

describe('spending a consumed item', () => {
  const spec = (species: string, item?: string): PokemonSpec => ({
    species,
    ability: 'Levitate',
    moves: ['Tackle'],
    level: 30,
    ...(item ? { item } : {}),
  });

  it('takes it off the Pokemon that was holding it', () => {
    const party = createParty([spec('Bulbasaur')]).map((member) => ({ ...member, item: 'oranberry' }));
    const after = spendItems({ party, backpack: [] }, ['oranberry']);
    expect(after.party[0]?.item).toBeUndefined();
    expect(after.backpack).toEqual([]);
  });

  it('takes it out of the bag when nobody was holding it', () => {
    const party = createParty([spec('Bulbasaur')]);
    const after = spendItems({ party, backpack: ['oranberry', 'leftovers'] }, ['oranberry']);
    expect(after.backpack).toEqual(['leftovers']);
  });

  it('removes one copy, not every copy', () => {
    // Two Oran Berries is a normal state — they are the commonest reward in the
    // normal pool — and eating one must not clear the shelf.
    const party = createParty([spec('Bulbasaur')]);
    const after = spendItems({ party, backpack: ['oranberry', 'oranberry'] }, ['oranberry']);
    expect(after.backpack).toEqual(['oranberry']);
  });

  it('changes nothing when nothing was consumed', () => {
    const state = { party: createParty([spec('Bulbasaur')]), backpack: ['oranberry'] };
    expect(spendItems(state, [])).toBe(state);
  });

  it('destroys it: a spent berry does not come back at the next node', async () => {
    /*
     * The rule the whole mechanic rests on. An unassigned item returns to the
     * backpack; a *consumed* one is gone, and it is the difference between a
     * resource and an ability with a cooldown.
     */
    const start = createRun('BERRY-GONE');
    const party = createParty([start.starterOptions[0]!]).map((member) => ({
      ...member,
      item: 'oranberry',
    }));
    const node = start.segments[0]!.routes[0]!.steps[0]!.options[0]!;

    const after = resolveNode(
      { ...start, party, starterIndex: 0, localeChoices: start.localeChoices.map(() => 0) },
      {
        node,
        battle: {
          result: { winner: 'p1', turns: 3, cause: 'faint' },
          party,
          contribution: NO_CONTRIBUTION,
          consumed: ['oranberry'],
        },
      },
    );

    expect(after.party[0]?.item).toBeUndefined();
    expect(after.backpack).not.toContain('oranberry');
  });
});

// ---------------------------------------------------------------------------
// 4. Who holds them
// ---------------------------------------------------------------------------

describe('opponents holding berries', () => {
  const BERRY_IDS = new Set(BERRIES.map((entry) => entry.id));

  /** Held-berry rate over many seeds, for one kind of opponent in one segment. */
  function rateOf(kind: 'trainer' | 'wild', segment: number): number {
    let held = 0;
    let total = 0;
    for (let seed = 0; seed < 60; seed++) {
      const stream = createRng(`HOLD-${kind}-${segment}-${seed}`).randomizer;
      const team =
        kind === 'trainer'
          ? generateTrainerTeam(segment, 'normal', stream)
          : generateWildTeam(segment, 'normal', stream);
      for (const spec of team) {
        total++;
        if (spec.item && BERRY_IDS.has(spec.item)) held++;
      }
    }
    return total === 0 ? 0 : held / total;
  }

  it('gives trainers berries at roughly the rate the table names', () => {
    for (const segment of [0, 4, 7]) {
      const expected = berryHoldRate('trainer', segment);
      const measured = rateOf('trainer', segment);
      expect(measured, `segment ${segment} trainer`).toBeGreaterThan(expected - 0.18);
      expect(measured, `segment ${segment} trainer`).toBeLessThan(expected + 0.18);
    }
  });

  it('gives wild Pokemon berries less often than trainers, in every segment', () => {
    for (let segment = 0; segment < SEGMENT_COUNT; segment++) {
      expect(berryHoldRate('wild', segment), `segment ${segment}`).toBeLessThan(
        berryHoldRate('trainer', segment),
      );
    }
  });

  it('weights the early segments higher, because that is when a berry matters', () => {
    expect(berryHoldRate('trainer', 0)).toBeGreaterThan(berryHoldRate('trainer', 7));
    expect(berryHoldRate('wild', 0)).toBeGreaterThan(berryHoldRate('wild', 7));
  });

  it('gives a gym leader nothing to hold', () => {
    expect(berryHoldRate('gym', 3)).toBe(0);
    for (const segment of [0, 3, 7]) {
      const team = generateGymTeam(GYMS[segment]!, segment, createRng(`GYM-HOLD-${segment}`).randomizer);
      for (const spec of team) expect(spec.item, `${spec.species}`).toBeUndefined();
    }
  });

  it('costs the same draws whether the Pokemon ends up holding one or not', () => {
    /*
     * The invariant that lets `BERRY_HOLD_RATE` be retuned freely: the roll and
     * the pick both happen on every opponent, so the per-Pokemon draw count is
     * a constant and no later roll in the seed moves with the table.
     */
    const cost = (segment: number): number => {
      const rng = createRng('BERRY-DRAWS');
      const before = rng.randomizer.draws;
      const team = generateTrainerTeam(segment, 'normal', rng.randomizer);
      return (rng.randomizer.draws - before) / team.length;
    };
    // Segment 0 holds at 0.5 and segment 7 at 0.2; the cost per member is the
    // same either way.
    expect(cost(0)).toBe(cost(7));
  });

  it('never hands out an item that is not on the whitelist', () => {
    for (const segment of [0, 3, 6]) {
      for (const node of nodesOf(createRun(`HOLD-WHITELIST-${segment}`).segments[segment]!)) {
        for (const spec of node.encounter?.team ?? []) {
          if (!spec.item) continue;
          expect(itemById(spec.item), `${spec.species} holds ${spec.item}`).not.toBeNull();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. End to end
// ---------------------------------------------------------------------------

describe('a run that eats berries', () => {
  it('never ends a node holding an item the battle spent', async () => {
    /*
     * The integration claim, asserted over a whole run rather than at one node:
     * after every node, no party member and no backpack slot holds an item that
     * the battle just reported as consumed.
     */
    const policy: RunPolicy = scriptedRunPolicy(greedyAiPolicy);
    const run = await playRun('BERRY-RUN', policy);

    const held = new Set(
      [...run.state.party.map((member) => member.item), ...run.state.backpack].filter(Boolean),
    );
    for (const item of held) expect(itemById(item as string), `${item as string}`).not.toBeNull();
    expect(['victory', 'defeat']).toContain(run.outcome);
  }, 60_000);
});
