/**
 * Defender Mode v0, step 4: the three badges through the sim, asserted against
 * the protocol. `docs/spec/gymrun-defender-mode-v0-fun-test.md` tests 3, 4
 * and 5.
 */
import { describe, expect, it } from 'vitest';

import { aiPolicy, greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle, runBattle, type BattleSession } from '../src/core/battle/driver';
import type { Policy } from '../src/core/battle/policy';
import { applySimModifier } from '../src/core/battle/stats';
import { battleBadgeFor, fifthMoveFor } from '../src/core/defender/badge';
import { generateDefenderDraft } from '../src/core/defender/draft';
import { generateClassTeam } from '../src/core/randomizer';
import { createAiStream, createRng } from '../src/core/rng';
import { createRun, playRun, scriptedRunPolicy } from '../src/core/run';
import type { BattleBadge, Choice, FoeIntent, PokemonSpec, PokemonState, TeamSpec } from '../src/core/types';
import { AI_TIERS } from '../src/data/ai';
import { DEFENDER_BADGE } from '../src/data/defender';
import { DEFAULT_TUNING } from '../src/data/tuning';

const move = (slot: number): Choice => ({ kind: 'move', slot });
const switchTo = (slot: number): Choice => ({ kind: 'switch', slot });

/** One turn, both sides answered by hand, and the lines it produced. */
function turn(session: BattleSession, p1: Choice, p2: Choice): string[] {
  const before = session.protocolFor('p1').length;
  session.submit('p1', p1);
  session.submit('p2', p2);
  return session.protocolFor('p1').slice(before);
}

const streakStages = (lines: readonly string[]): number[] =>
  lines.flatMap((line) => {
    const match = /gymrun-fire-streak .* stage \+(\d)/.exec(line);
    return match ? [Number(match[1])] : [];
  });

const crit = (lines: readonly string[]): boolean => lines.some((line) => line.startsWith('|-crit|p2a'));

describe('Fire: the highlighted move\'s streak (prompt test 3)', () => {
  // Slot 1 is the highlight on both members. A Blissey that only Splashes
  // absorbs every hit, so the only thing that changes turn to turn is the streak.
  const fire: TeamSpec = [
    { species: 'Charmander', ability: 'Blaze', moves: ['Tackle', 'Growl'], level: 50, highlightSlot: 0 },
    { species: 'Vulpix', ability: 'Flash Fire', moves: ['Tackle', 'Growl'], level: 50, highlightSlot: 0 },
  ];
  const wall: TeamSpec = [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'], level: 100 }];
  const badge = battleBadgeFor(fire, 'Fire');
  const battle = (seed: string) => createBattle({ teams: { p1: fire, p2: wall }, seed, badge });

  it('builds the badge off the spec: the highlighted slot\'s move, for gym-type members only', () => {
    expect(badge.members).toEqual([
      { highlight: 'tackle', fifthMove: null },
      { highlight: 'tackle', fifthMove: null },
    ]);
    expect(battleBadgeFor([{ ...fire[0]!, species: 'Squirtle' }], 'Fire').members).toEqual([null]);
  });

  it('adds +1, +2, +3 across three consecutive uses, holds +3, and the third use crits', () => {
    for (const seed of ['FIRE-A', 'FIRE-B', 'FIRE-C', 'FIRE-D', 'FIRE-E']) {
      const session = battle(seed);
      const uses = [1, 2, 3, 4].map(() => turn(session, move(1), move(1)));
      expect(uses.map(streakStages)).toEqual([[1], [2], [3], [3]]);
      expect(crit(uses[2]!), `${seed}: the third use at +3 is a certain crit`).toBe(true);
      expect(crit(uses[3]!)).toBe(true);
    }
  });

  it('shows the next use\'s crit chance on the move button: 1/8, 1/2, then certain', () => {
    const session = battle('FIRE-BUTTON');
    const chance = () => session.viewFor('p1').moves[0]?.critChance;
    expect(chance()).toBe(1 / 8);
    turn(session, move(1), move(1));
    expect(chance()).toBe(1 / 2);
    turn(session, move(1), move(1));
    expect(chance()).toBe(1);
    // Only the highlighted slot carries a chance.
    expect(session.viewFor('p1').moves[1]?.critChance).toBeUndefined();
  });

  it('resets on a different move', () => {
    const session = battle('FIRE-RESET-MOVE');
    turn(session, move(1), move(1));
    turn(session, move(1), move(1));
    const other = turn(session, move(2), move(1));
    expect(streakStages(other)).toEqual([]);
    expect(streakStages(turn(session, move(1), move(1)))).toEqual([1]);
  });

  it('resets on a switch, out and back', () => {
    const session = battle('FIRE-RESET-SWITCH');
    turn(session, move(1), move(1));
    turn(session, move(1), move(1));
    turn(session, switchTo(2), move(1));
    // The second member starts its own streak at +1.
    expect(streakStages(turn(session, move(1), move(1)))).toEqual([1]);
    turn(session, switchTo(2), move(1));
    expect(streakStages(turn(session, move(1), move(1)))).toEqual([1]);
  });

  it('gives an off-type member nothing', () => {
    const offType: TeamSpec = [{ species: 'Squirtle', ability: 'Torrent', moves: ['Tackle'], level: 50, highlightSlot: 0 }];
    const session = createBattle({ teams: { p1: offType, p2: wall }, seed: 'FIRE-OFF', badge: battleBadgeFor(offType, 'Fire') });
    for (let i = 0; i < 3; i++) expect(streakStages(turn(session, move(1), move(1)))).toEqual([]);
    expect(session.viewFor('p1').moves[0]?.critChance).toBeUndefined();
  });
});

/** The p2 action on each turn, read off the protocol: the move it used, or what it switched to. */
function actionsByTurn(protocol: readonly string[]): Map<number, string | null> {
  const actions = new Map<number, string | null>();
  let current = 0;
  let moved = false;
  for (const line of protocol) {
    const parts = line.split('|');
    if (parts[1] === 'turn') {
      current = Number(parts[2]);
      moved = false;
    } else if (actions.has(current)) continue;
    // A voluntary switch goes before every move in a turn, so a p2 switch
    // after one is forced (Emergency Exit, Eject Button, a drag): not chosen.
    else if (parts[1] === 'switch' && parts[2]?.startsWith('p2a') && moved) actions.set(current, null);
    else if (parts[1] === 'move' && parts[2]?.startsWith('p2a')) actions.set(current, `move:${parts[3]}`);
    else if (parts[1] === 'move') moved = true;
    else if (parts[1] === 'switch' && parts[2]?.startsWith('p2a')) actions.set(current, `switch:${parts[2].slice(5)}`);
    // Could not move, or fainted before acting: a replacement that follows is
    // not the action the foe chose, so the turn has nothing to compare.
    else if ((parts[1] === 'cant' || parts[1] === 'faint') && parts[2]?.startsWith('p2a')) actions.set(current, null);
  }
  return actions;
}

describe('Psychic: the opponent\'s committed action (prompt test 4)', () => {
  /** A player that records what it was shown, then plays greedy. */
  function watcher(seen: Map<number, FoeIntent | undefined>, asked: number[]): Policy {
    return async (view) => {
      if (!view.forceSwitch) {
        asked.push(view.turn);
        seen.set(view.turn, view.foeIntent);
      }
      return greedyAiPolicy(view);
    };
  }

  it('reveals exactly the action the opponent then attempts, over many turns and seeds', async () => {
    let compared = 0;
    let switches = 0;
    for (let i = 0; i < 40; i++) {
      const seed = `PSY-${i}`;
      const rank = i % 8;
      const draft = generateDefenderDraft(createRng(seed)).Psychic.flat().slice(0, 3);
      const team = draft.map((spec) => ({ ...spec, level: 20 + rank * 5 }));
      const foes = generateClassTeam([], rank, 'hard', 31, createRng(seed).randomizer.at('foe'));
      const seen = new Map<number, FoeIntent | undefined>();
      const asked: number[] = [];
      const simSeed = createRng(seed).battle.at('sim').nextSimSeed();
      // A noisy tier, so the reveal is held against a policy that rolls dice,
      // and the hard tier, which switches.
      const opponent = aiPolicy(i % 2 ? AI_TIERS.hard : AI_TIERS.easy, createAiStream(simSeed, 'p2'));
      const run = await runBattle(team, foes, seed, watcher(seen, asked), opponent, {
        simSeed,
        badge: battleBadgeFor(team, 'Psychic'),
      });
      const acted = actionsByTurn(run.protocol);
      for (const turnNumber of asked) {
        const intent = seen.get(turnNumber);
        expect(intent, `${seed} turn ${turnNumber}: every member is Psychic, so every turn reveals`).toBeDefined();
        const action = acted.get(turnNumber);
        if (action === undefined || action === null || !intent) continue; // the foe never acted: fainted first, or could not move
        const shown = intent.kind === 'move' ? `move:${intent.move}` : `switch:${intent.name}`;
        expect(action, `${seed} turn ${turnNumber}`).toBe(shown);
        compared++;
        if (intent.kind === 'switch') switches++;
      }
    }
    expect(compared).toBeGreaterThan(100);
    expect(switches).toBeGreaterThan(0);
  }, 120_000);

  it('changes nothing the opponent decides: the battle is the battle with no badge', async () => {
    for (const seed of ['PSY-SAME-0', 'PSY-SAME-1', 'PSY-SAME-2']) {
      const team = generateDefenderDraft(createRng(seed)).Psychic.flat().slice(0, 3);
      const foes = generateClassTeam([], 2, 'normal', 10, createRng(seed).randomizer.at('foe'));
      const simSeed = createRng(seed).battle.at('sim').nextSimSeed();
      const play = (badge?: BattleBadge) =>
        runBattle(team, foes, seed, greedyAiPolicy, aiPolicy(AI_TIERS.easy, createAiStream(simSeed, 'p2')), {
          simSeed,
          ...(badge ? { badge } : {}),
        });
      const plain = await play();
      const revealed = await play(battleBadgeFor(team, 'Psychic'));
      // `|t:|` is the sim's wall clock, the one line two identical battles differ on.
      const stable = (lines: readonly string[]) => lines.filter((line) => !line.startsWith('|t:|'));
      expect(stable(revealed.protocol)).toEqual(stable(plain.protocol));
    }
  });

  it('reveals nothing while an off-type member is active, or in an attacker battle', async () => {
    const team: TeamSpec = [{ species: 'Squirtle', ability: 'Torrent', moves: ['Tackle'], level: 30 }];
    const foes: TeamSpec = [{ species: 'Rattata', ability: 'Guts', moves: ['Tackle'], level: 30 }];
    const shown: (FoeIntent | undefined)[] = [];
    const record: Policy = async (view) => {
      shown.push(view.foeIntent);
      return greedyAiPolicy(view);
    };
    await runBattle(team, foes, 'PSY-OFF', record, greedyAiPolicy, { badge: battleBadgeFor(team, 'Psychic') });
    await runBattle(team, foes, 'PSY-OFF', record, greedyAiPolicy);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((intent) => intent === undefined)).toBe(true);
  });
});

describe('Flying: Speed and the fifth move (prompt test 5)', () => {
  const flock: TeamSpec = [
    { species: 'Pidgey', ability: 'Keen Eye', moves: ['Tackle'], level: 50 },
    { species: 'Squirtle', ability: 'Torrent', moves: ['Tackle'], level: 50 },
    { species: 'Pidgeot', ability: 'Keen Eye', moves: ['Tackle', 'Gust'], level: 50 },
  ];
  const foe: TeamSpec = [{ species: 'Blissey', ability: 'Natural Cure', moves: ['Splash'], level: 100 }];
  const badge = battleBadgeFor(flock, 'Flying');

  it('builds Peck for a species that can still evolve, Pluck for a final stage, nothing off type', () => {
    expect(fifthMoveFor({ species: 'Pidgey' })).toBe('Peck');
    expect(fifthMoveFor({ species: 'Pidgeot' })).toBe('Pluck');
    expect(badge.members.map((member) => member?.fifthMove ?? null)).toEqual(['Peck', null, 'Pluck']);
  });

  it('multiplies effective Speed by 1.1 for gym-type members only, and every Speed read agrees', () => {
    const session = createBattle({ teams: { p1: flock, p2: foe }, seed: 'FLY-SPEED', badge });
    const numerator = Math.trunc(DEFENDER_BADGE.flyingSpeed * 4096);
    const check = (eligible: boolean) => {
      const facts = session.factsFor('p1').player!;
      const stored = facts.stats.spe;
      expect(facts.speed.engine).toBe(eligible ? applySimModifier(stored, numerator) : stored);
      // The AI's read of the player's Speed and the player's own read are the engine's.
      expect(session.viewFor('p2').speed.foe).toBe(facts.speed.engine);
      expect(session.viewFor('p1').speed.me).toBe(facts.speed.engine);
      // The opponent is untouched.
      expect(session.factsFor('p2').player!.speed.engine).toBe(session.factsFor('p2').player!.stats.spe);
    };
    check(true);
    turn(session, switchTo(2), move(1));
    check(false);
    turn(session, switchTo(3), move(1));
    check(true);
  });

  it('agrees with the engine under paralysis, where the sim applies the badge first', () => {
    const paralysed: PokemonState[] = [
      {
        spec: flock[0]!,
        maxHp: 120,
        hp: 120,
        moves: [{ id: 'tackle', name: 'Tackle', pp: 35, maxPp: 56 }],
        status: 'par',
        fainted: false,
        joinedSegment: 0,
        contribution: { damageDealt: 0, damageTaken: 0, knockouts: 0, faints: 0, turnsActive: 0, switchesIn: 0 } as never,
      },
    ];
    const session = createBattle({ teams: { p1: [flock[0]!], p2: foe }, seed: 'FLY-PAR', badge: battleBadgeFor([flock[0]!], 'Flying'), carryOver: paralysed });
    const facts = session.factsFor('p1').player!;
    expect(facts.status).toBe('par');
    expect(session.viewFor('p2').speed.foe).toBe(facts.speed.engine);
  });

  it('offers the fifth move once per battle per mon, outside the four', () => {
    const session = createBattle({ teams: { p1: flock, p2: foe }, seed: 'FLY-FIFTH', badge });
    const moves = session.viewFor('p1').moves;
    expect(moves).toHaveLength(2);
    expect(moves[1]).toMatchObject({ name: 'Peck', badgeMove: true, pp: 1, maxPp: 1, usable: true });
    expect(moves[0]?.badgeMove).toBeUndefined();

    const used = turn(session, move(2), move(1));
    expect(used.some((line) => line.startsWith('|move|p1a: ') && line.includes('|Peck|'))).toBe(true);
    expect(session.viewFor('p1').moves[1]).toMatchObject({ pp: 0, usable: false });

    // The off-type member has no fifth move.
    turn(session, switchTo(2), move(1));
    expect(session.viewFor('p1').moves.map((entry) => entry.name)).toEqual(['Tackle']);
    // A final stage's is Pluck, and it is its own, unspent.
    turn(session, switchTo(3), move(1));
    expect(session.viewFor('p1').moves.map((entry) => entry.name)).toEqual(['Tackle', 'Gust', 'Pluck']);
    expect(session.viewFor('p1').moves[2]).toMatchObject({ pp: 1, usable: true });

    // It never reaches the party, so the next battle's is fresh.
    for (const member of session.partyState('p1')) expect(member.moves.length).toBe(member.spec.moves.length);
    const next = createBattle({ teams: { p1: flock, p2: foe }, seed: 'FLY-FIFTH-2', badge });
    expect(next.viewFor('p1').moves[1]).toMatchObject({ name: 'Peck', pp: 1, usable: true });
  });

  it('keeps every party member at its own moves through a whole defender run', async () => {
    const run = await playRun('FLY-RUN', { ...scriptedRunPolicy(greedyAiPolicy), chooseGymType: async () => 2 }, DEFAULT_TUNING, {
      mode: 'defender',
    });
    // The party's moves are each member's own four, in its own order: a Pluck
    // here is one a TM taught, never the badge's slot carried home.
    for (const member of run.state.party) {
      expect(member.moves.map((entry) => entry.name)).toEqual(member.spec.moves);
    }
    expect(createRun('FLY-RUN', DEFAULT_TUNING, 'defender').defender?.gymType).toBeNull();
  }, 120_000);
});

describe('no badge, no change', () => {
  it('an attacker battle carries none of the badge fields', () => {
    const spec: PokemonSpec = { species: 'Pidgey', ability: 'Keen Eye', moves: ['Tackle'], level: 50, highlightSlot: 0 };
    const session = createBattle({ teams: { p1: [spec], p2: [spec] }, seed: 'NO-BADGE' });
    const view = session.viewFor('p1');
    expect(view.foeIntent).toBeUndefined();
    expect(view.me.speedModifier).toBeUndefined();
    expect(view.moves.map((entry) => [entry.critChance, entry.badgeMove])).toEqual([[undefined, undefined]]);
  });
});
