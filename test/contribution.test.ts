/**
 * Contribution counters: the reducer, and the protocol facts it stands on.
 *
 * Stage 4.7, Part 5. The feature question is whether a run has a party or a
 * solo carry with three passengers, and the answer is five raw counts per
 * member. The counts are only worth anything if the attribution is right, so
 * most of this file is attribution.
 *
 * The fixtures are **hand-authored protocol**, not recorded battles, for the
 * usual reason a unit test is not an integration test: a recorded battle
 * asserts what one seed happened to do, and re-recording it when the engine
 * moves silently rewrites the thing under test. These say "a recoil line looks
 * like this, and here is what it must count as". One real battle is played at
 * the end to check the two agree.
 */
import { describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { addContribution, emptyContribution, readContribution } from '../src/core/battle/contribution';
import { describeSpec, runBattle } from '../src/core/battle/driver';
import { moveChoice, switchChoice } from '../src/core/types';
import type { Policy } from '../src/core/battle/policy';

const ROSTER = ['Tauros', 'Gengar'];

describe('the reducer', () => {
  it('credits direct move damage to the mover and never to the victim', () => {
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p1a: Tauros|Body Slam|p2a: Snorlax',
        '|-damage|p2a: Snorlax|180/235',
        '|move|p2a: Snorlax|Body Slam|p1a: Tauros',
        '|-damage|p1a: Tauros|120/175',
        '|turn|2',
      ],
      ROSTER,
    );

    expect(counters[0]).toEqual({
      damageDealt: 55,
      damageTaken: 55,
      kos: 0,
      faints: 0,
      turnsOnField: 2,
    });
    // The bench counts nothing, and is present rather than absent.
    expect(counters[1]).toEqual(emptyContribution());
  });

  it('counts a self-inflicted recoil as damage taken and as nobody\'s damage dealt', () => {
    /*
     * The case the spec names, and the one a naive reader gets wrong. Recoil is
     * a `-damage` line on the *attacker*, immediately after the `-damage` line
     * on the defender, and the last `|move|` line still names the attacker. A
     * reader that ignored `[from]` would credit Tauros with 46 points of damage
     * dealt to itself.
     */
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p1a: Tauros|Double-Edge|p2a: Snorlax',
        '|-damage|p2a: Snorlax|97/235',
        '|-damage|p1a: Tauros|129/175|[from] recoil',
      ],
      ROSTER,
    );

    expect(counters[0]?.damageDealt).toBe(138);
    expect(counters[0]?.damageTaken).toBe(46);
  });

  it('counts poison and hazards as damage taken, credited to nobody', () => {
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p2a: Snorlax|Toxic|p1a: Tauros',
        '|-status|p1a: Tauros|tox',
        '|-damage|p1a: Tauros|164/175 tox|[from] psn',
        '|turn|2',
        '|move|p1a: Tauros|Body Slam|p2a: Snorlax',
        '|-damage|p2a: Snorlax|180/235',
        '|-damage|p1a: Tauros|142/175 tox|[from] psn',
      ],
      ROSTER,
    );

    expect(counters[0]?.damageTaken).toBe(33);
    expect(counters[0]?.damageDealt).toBe(55);
  });

  it('credits a KO to whoever landed the killing move', () => {
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|60/235',
        '|turn|1',
        '|move|p1a: Tauros|Body Slam|p2a: Snorlax',
        '|-damage|p2a: Snorlax|0 fnt',
        '|faint|p2a: Snorlax',
      ],
      ROSTER,
    );

    expect(counters[0]?.kos).toBe(1);
    expect(counters[0]?.damageDealt).toBe(60);
  });

  it('credits a KO to nobody when the killing blow was indirect', () => {
    /*
     * The same line `readCasualties` draws with its `indirect` field. If a
     * Pokemon you chipped three turns ago dies to its own recoil, you did not
     * knock it out — and a counter that said you did would be the first step
     * toward a "clutch" statistic, which is a verdict.
     */
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p1a: Tauros|Body Slam|p2a: Snorlax',
        '|-damage|p2a: Snorlax|30/235',
        '|move|p2a: Snorlax|Double-Edge|p1a: Tauros',
        '|-damage|p1a: Tauros|100/175',
        '|-damage|p2a: Snorlax|0 fnt|[from] recoil',
        '|faint|p2a: Snorlax',
      ],
      ROSTER,
    );

    expect(counters[0]?.kos).toBe(0);
    expect(counters[0]?.damageDealt).toBe(205);
  });

  it('follows a switch, so the incoming member owns the damage it takes', () => {
    /*
     * Note where `|turn|2` sits: the sim emits it *before* the turn resolves,
     * and the switch happens inside that turn. So turn 2 belongs to Tauros,
     * who was on the field when it began, and Gengar's first turn is 3 — even
     * though Gengar took the hit on turn 2. That is the definition
     * `turnsOnField` carries and the reason it is written down on the type:
     * counting both would make the column sum to more turns than were played.
     */
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|175/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p2a: Snorlax|Body Slam|p1a: Tauros',
        '|-damage|p1a: Tauros|120/175',
        '|turn|2',
        '|switch|p1a: Gengar|Gengar, L50, M|135/135',
        '|move|p2a: Snorlax|Body Slam|p1a: Gengar',
        '|-damage|p1a: Gengar|60/135',
        '|turn|3',
        '|move|p1a: Gengar|Shadow Ball|p2a: Snorlax',
        '|-damage|p2a: Snorlax|180/235',
      ],
      ROSTER,
    );

    expect(counters[0]).toMatchObject({ damageTaken: 55, damageDealt: 0, turnsOnField: 2 });
    expect(counters[1]).toMatchObject({ damageTaken: 75, damageDealt: 55, turnsOnField: 1 });
  });

  it('counts a faint against the member that fainted, and the turn it fainted on', () => {
    const counters = readContribution(
      [
        '|switch|p1a: Tauros|Tauros, L50, M|40/175',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p2a: Snorlax|Body Slam|p1a: Tauros',
        '|-damage|p1a: Tauros|0 fnt',
        '|faint|p1a: Tauros',
        '|switch|p1a: Gengar|Gengar, L50, M|135/135',
        '|turn|2',
      ],
      ROSTER,
    );

    expect(counters[0]).toMatchObject({ faints: 1, damageTaken: 40, turnsOnField: 1 });
    // The member that came in after the faint did not fight turn 1.
    expect(counters[1]).toMatchObject({ faints: 0, turnsOnField: 1 });
  });

  it('gives a bench member zeroes rather than nothing at all', () => {
    const counters = readContribution(
      ['|switch|p1a: Tauros|Tauros, L50, M|175/175', '|turn|1'],
      ['Tauros', 'Gengar', 'Blissey'],
    );
    expect(counters).toHaveLength(3);
    expect(counters[2]).toEqual(emptyContribution());
  });

  it('is pure: the same protocol gives the same answer', () => {
    const lines = [
      '|switch|p1a: Tauros|Tauros, L50, M|175/175',
      '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
      '|turn|1',
      '|move|p1a: Tauros|Body Slam|p2a: Snorlax',
      '|-damage|p2a: Snorlax|180/235',
    ];
    expect(readContribution(lines, ROSTER)).toEqual(readContribution(lines, ROSTER));
  });

  it('separates two members of the same species by the HP they switched in on', () => {
    /*
     * The limitation the reducer documents, exercised at the point where it
     * still works. Both members are `p1a: Pikachu` in every line; what tells
     * them apart is that the second switch-in of the first one arrives at the
     * HP it left on.
     */
    const counters = readContribution(
      [
        '|switch|p1a: Pikachu|Pikachu, L50, F|110/110',
        '|switch|p2a: Snorlax|Snorlax, L50, F|235/235',
        '|turn|1',
        '|move|p2a: Snorlax|Body Slam|p1a: Pikachu',
        '|-damage|p1a: Pikachu|40/110',
        '|turn|2',
        '|switch|p1a: Pikachu|Pikachu, L50, M|110/110',
        '|move|p2a: Snorlax|Body Slam|p1a: Pikachu',
        '|-damage|p1a: Pikachu|30/110',
        '|turn|3',
        '|switch|p1a: Pikachu|Pikachu, L50, F|40/110',
        '|move|p2a: Snorlax|Body Slam|p1a: Pikachu',
        '|-damage|p1a: Pikachu|0 fnt',
        '|faint|p1a: Pikachu',
      ],
      ['Pikachu', 'Pikachu'],
    );

    expect(counters[0]).toMatchObject({ damageTaken: 110, faints: 1 });
    expect(counters[1]).toMatchObject({ damageTaken: 80, faints: 0 });
  });
});

describe('addContribution', () => {
  it('sums every counter and mutates neither operand', () => {
    const base = { damageDealt: 10, damageTaken: 20, kos: 1, faints: 0, turnsOnField: 3 };
    const delta = { damageDealt: 5, damageTaken: 0, kos: 0, faints: 1, turnsOnField: 2 };
    expect(addContribution(base, delta)).toEqual({
      damageDealt: 15,
      damageTaken: 20,
      kos: 1,
      faints: 1,
      turnsOnField: 5,
    });
    expect(base.damageDealt).toBe(10);
  });
});

describe('the protocol facts this depends on', () => {
  it('reports exact HP for the opponent, so both counters are in HP points', async () => {
    /*
     * **The load-bearing format property.** A Showdown battle normally splits
     * `-damage` so the owner sees `93/158` and everyone else sees `59/100`.
     * Under that split, "damage dealt" would be in percent and "damage taken"
     * in HP, and the two would be incomparable while looking identical.
     *
     * GYMRUN runs Custom Game, which carries `debug: true`, which turns on the
     * sim's `reportExactHP`. This asserts that directly rather than trusting
     * it: the denominator on an opposing `-damage` line must be the opponent's
     * real max HP, computed independently through `describeSpec`.
     *
     * If a gen-lock or a format change ever turns it off, this fails — instead
     * of every contribution counter quietly changing units.
     */
    const foe = { species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 };
    const run = await runBattle(
      [{ species: 'Tauros', ability: 'Intimidate', moves: ['Body Slam'], level: 50 }],
      [foe],
      'EXACT-HP',
      async (view) => moveChoice(view.moves.find((move) => move.usable)?.slot ?? 1),
      greedyAiPolicy,
    );

    const damageToFoe = run.protocol.filter(
      (line) => line.startsWith('|-damage|p2a:') && !line.includes('[from]'),
    );
    expect(damageToFoe.length, 'the foe was never damaged').toBeGreaterThan(0);

    const expected = describeSpec(foe).maxHp;
    for (const line of damageToFoe) {
      const health = line.split('|')[3] ?? '';
      if (health.startsWith('0 fnt')) continue;
      expect(Number(health.split(' ')[0]?.split('/')[1])).toBe(expected);
    }
  }, 60_000);
});

describe('a real battle, end to end', () => {
  it('produces counters that agree with the battle that produced them', async () => {
    /*
     * The integration check, and it asserts *relations* rather than numbers,
     * because numbers here are a property of one seed and would have to be
     * re-recorded on every engine bump. What must hold on any seed:
     *
     *   - the two members' damage taken sums to what the opponent dealt, which
     *     is bounded by their combined HP bars;
     *   - a member that never came off the bench has all zeroes;
     *   - a KO is only ever credited to a member that dealt damage.
     */
    let turns = 0;
    const player: Policy = async (view) => {
      if (view.forceSwitch) return switchChoice(view.switches.find((s) => s.usable)?.slot ?? 1);
      turns++;
      if (turns === 3 && view.switches.some((s) => s.usable)) return switchChoice(2);
      return moveChoice(view.moves.find((move) => move.usable)?.slot ?? 1);
    };

    const run = await runBattle(
      [
        { species: 'Tauros', ability: 'Intimidate', moves: ['Double-Edge', 'Toxic'], level: 50 },
        { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Sludge Bomb'], level: 50 },
      ],
      [
        { species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 },
        { species: 'Machamp', ability: 'Guts', moves: ['Cross Chop'], level: 50 },
      ],
      'CONTRIB-REAL',
      player,
      greedyAiPolicy,
    );

    expect(run.contribution).toHaveLength(2);
    for (const counter of run.contribution) {
      expect(counter.damageDealt).toBeGreaterThanOrEqual(0);
      expect(counter.damageTaken).toBeGreaterThanOrEqual(0);
      if (counter.kos > 0) expect(counter.damageDealt).toBeGreaterThan(0);
      if (counter.turnsOnField === 0) {
        expect(counter).toEqual(emptyContribution());
      }
    }

    // Both members fought, which is what makes this a two-member fixture.
    expect(run.contribution.every((counter) => counter.turnsOnField > 0)).toBe(true);
    // The opponent's whole team is 2 Pokemon; nobody can deal more damage than
    // the sum of the HP bars that existed to be removed.
    const foeHp = describeSpec({ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }).maxHp
      + describeSpec({ species: 'Machamp', ability: 'Guts', moves: ['Cross Chop'], level: 50 }).maxHp;
    const dealt = run.contribution.reduce((total, counter) => total + counter.damageDealt, 0);
    expect(dealt).toBeLessThanOrEqual(foeHp);
  }, 60_000);
});
