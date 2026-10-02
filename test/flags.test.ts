/**
 * The flag reader, asserted against protocol a real battle produced.
 *
 * ## Why every case here is played rather than written
 *
 * `test/turn-order.test.ts` set the precedent and the argument is the same one:
 * a reader tested only against strings typed into the test file is a reader
 * tested against its author's memory of the protocol. The engine spells
 * `|-miss|` with the *source* first and `|-immune|` with the *defender* alone,
 * a berry fires as `-enditem` and a *separate* `-heal`, and a critical hit is
 * announced before the damage rather than after. Every one of those is a thing
 * this file would have got wrong from memory, and every one of them is asserted
 * below off a battle that actually happened.
 *
 * The seeds are pinned. A crit is a roll, so the crit case names the seed that
 * produces one and asserts the protocol carries `|-crit|` before it asserts the
 * flag — if the sim's roll ever moves, the first assertion says so plainly
 * rather than leaving the second looking like a reader bug.
 *
 * The one hand-written group is the last describe block, which drives the
 * injected lookups through cases no shipped move reaches (a type change, a
 * berry at end of turn). That is what injection is for.
 */
import { describe, expect, it } from 'vitest';

import { createBattle, movePriority, type BattleSession } from '../src/core/battle/driver';
import { readFlags, type FlagDeps, type FlagKind, type FlaggedTurn } from '../src/core/battle/flags';
import { flagWord } from '../src/data/flagWords';
import { moveChoice, type TeamSpec } from '../src/core/types';

/**
 * The real lookup. `core/` never imports the dex; the adapter hands it over.
 *
 * It was three until M4.1: a move-identity and a species-types lookup sat
 * beside this one, for the STAB and contact flags R9 removed.
 */
const DEPS: FlagDeps = { priorityOf: movePriority };

/**
 * Play both sides into their first move slot for a fixed number of turns.
 *
 * The run seed is named rather than the sim seed overridden, because
 * `createBattle` derives the sim's PRNG seed from the run seed's `battle`
 * stream and that derivation is the thing every other seeded assertion in the
 * suite goes through. `FLAGS05` is the default; a case that needs a particular
 * roll names its own and asserts the protocol carries it.
 *
 * It was `FLAGS01` until the `contentHash` release deleted the unkeyed
 * sequence and the fallback that derives a fixture battle's sim seed moved
 * to `FIXTURE_BATTLE_KEY`. Every seed-pinned battle in the suite rolled
 * differently once, and `FLAGS05` is the first seed after it on which every
 * case below still carries the roll it asserts: a Dynamic Punch miss on turn
 * 1, three clean turns of Body Slam against Scald, and a Thunder Wave whose
 * target still gets its Tackle off that turn.
 */
function play(p1: TeamSpec, p2: TeamSpec, turns: number, seed = 'FLAGS05'): string[] {
  const session: BattleSession = createBattle({ teams: { p1, p2 }, seed });
  for (let i = 0; i < turns && !session.ended; i++) {
    for (const side of ['p1', 'p2'] as const) {
      if (session.viewFor(side).awaitingChoice) session.submit(side, moveChoice(1));
    }
  }
  return session.protocolFor('p1').filter((line) => !line.startsWith('|t:|'));
}

/** Every flag in the stream, in the order it was read, as bare kinds. */
function kinds(turns: readonly FlaggedTurn[]): FlagKind[] {
  return turns.flatMap((turn) => [
    ...turn.actions.flatMap((each) => each.flags.map((flag) => flag.kind)),
    ...turn.residual.map((flag) => flag.kind),
  ]);
}

/** Every flag in the stream, whole. */
function all(turns: readonly FlaggedTurn[]) {
  return turns.flatMap((turn) => [...turn.actions.flatMap((each) => each.flags), ...turn.residual]);
}

describe('the five recorded cases Release C names', () => {
  it('reads a critical hit', () => {
    // Persian's Slash is a high-crit move; Snorlax's Splash keeps the other
    // side from ending the battle before the roll lands.
    const protocol = play(
      [{ species: 'Persian', ability: 'Limber', moves: ['Slash'], level: 50 }],
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Splash'], level: 50 }],
      12,
      'CRIT01',
    );
    expect(protocol.some((line) => line.startsWith('|-crit|')), 'this seed still rolls a crit').toBe(true);

    const flags = all(readFlags(protocol, DEPS));
    const crit = flags.find((flag) => flag.kind === 'crit');
    expect(crit).toBeDefined();
    // Announced about the Pokemon that took it, which is not the one that acted.
    expect(crit?.side).toBe('p2');
    expect(crit?.subject).toBe('Snorlax');
    expect(crit?.detail).toBeNull();
  });

  it('reads a miss, and takes back the words a miss disproves', () => {
    const protocol = play(
      [{ species: 'Machamp', ability: 'Guts', moves: ['Dynamic Punch'], level: 50 }],
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 50 }],
      1,
    );
    expect(protocol.some((line) => line.startsWith('|-miss|')), 'this seed still misses on turn 1').toBe(true);

    const [turn] = readFlags(protocol, DEPS).filter((group) => group.turn === 1);
    const punch = turn?.actions.find((each) => each.action.kind === 'move' && each.action.move === 'Dynamic Punch');
    /*
     * Exactly one flag, and it is the miss.
     *
     * This case used to prove `settle`: Dynamic Punch is a Fighting move on a
     * Fighting type and it makes contact, so STAB and CONTACT were stated when
     * the move was named and retracted here, because both are true of the
     * *move* and neither is true of a turn that did nothing. M4.1 deleted both
     * kinds, so there is nothing to retract — and the equality below is the
     * stronger form of the same assertion, since it fails if anything at all
     * joins the miss.
     */
    expect(punch?.flags.map((flag) => flag.kind)).toEqual(['miss']);
  });

  it('reads a hit that had no effect', () => {
    // Normal into a Ghost type. Gengar moves first and does nothing relevant.
    const protocol = play(
      [{ species: 'Gengar', ability: 'Cursed Body', moves: ['Thunder Wave'], level: 50 }],
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Tackle'], level: 50 }],
      2,
    );
    expect(protocol.some((line) => line.startsWith('|-immune|'))).toBe(true);

    const flags = all(readFlags(protocol, DEPS));
    const immune = flags.find((flag) => flag.kind === 'immune');
    // The protocol names only the defender on `|-immune|`, so that is who the
    // flag is about — the attacker was Snorlax on p2.
    expect(immune?.side).toBe('p1');
    expect(immune?.subject).toBe('Gengar');
  });

  it('reads a status infliction, and carries the id', () => {
    const protocol = play(
      [{ species: 'Gengar', ability: 'Cursed Body', moves: ['Thunder Wave'], level: 50 }],
      [{ species: 'Snorlax', ability: 'Thick Fat', moves: ['Tackle'], level: 50 }],
      1,
    );
    const flags = all(readFlags(protocol, DEPS));
    const status = flags.find((flag) => flag.kind === 'status');
    expect(status).toBeDefined();
    expect(status?.side).toBe('p2');
    expect(status?.subject).toBe('Snorlax');
    expect(status?.detail).toBe('par');
    expect(flagWord('status', status?.detail ?? null)).toBe('Paralysed');
  });

  it('reads a berry firing, and names it', () => {
    const protocol = play(
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Splash'], level: 50, item: 'Oran Berry' }],
      [{ species: 'Rattata', ability: 'Run Away', moves: ['Tackle'], level: 50 }],
      30,
    );
    expect(protocol.some((line) => line.startsWith('|-enditem|'))).toBe(true);

    const flags = all(readFlags(protocol, DEPS));
    const berry = flags.find((flag) => flag.kind === 'berry');
    expect(berry).toBeDefined();
    expect(berry?.side).toBe('p1');
    expect(berry?.subject).toBe('Snorlax');
    expect(berry?.detail).toBe('Oran Berry');
    expect(flagWord('berry', berry?.detail ?? null)).toBe('Oran Berry');
  });
});

describe('the effectiveness pair, and the two facts the protocol does not carry', () => {
  it('reads super effective, and STAB with it', () => {
    // Crabhammer is Water on a Water type into a Rock/Ground Golem: both words
    // are true of the same action, and they arrive from different places.
    const protocol = play(
      [{ species: 'Kingler', ability: 'Hyper Cutter', moves: ['Crabhammer'], level: 50 }],
      [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }],
      1,
    );
    const [turn] = readFlags(protocol, DEPS).filter((group) => group.turn === 1);
    const hammer = turn?.actions.find((each) => each.action.kind === 'move' && each.action.move === 'Crabhammer');
    const read = hammer?.flags.map((flag) => flag.kind) ?? [];
    expect(read).toContain('super');
    /*
     * And nothing about the move itself. Crabhammer is a Water move on a Water
     * type and it makes contact; both were flags on this exact case until
     * M4.1, and R9's reason for taking them is that a cause is not an outcome.
     * The card says them before the player commits.
     *
     * There is no assertion here that they are absent, because the kinds no
     * longer exist to name — the compiler refuses the string. "No kind outside
     * the vocabulary" is asserted over a whole battle in the reader's shape
     * block below, which is where it holds for every kind rather than two.
     */
  });

  it('reads not very effective', () => {
    const protocol = play(
      [{ species: 'Charizard', ability: 'Blaze', moves: ['Flamethrower'], level: 50 }],
      [{ species: 'Blastoise', ability: 'Torrent', moves: ['Withdraw'], level: 50 }],
      1,
    );
    const flags = all(readFlags(protocol, DEPS));
    expect(flags.map((flag) => flag.kind)).toContain('resisted');
  });

  /*
   * A case was deleted here rather than rewritten: *"gives a status move no
   * STAB, however its types line up"*, which drove Thunder Wave off Raichu so
   * that a type match alone could not pass it. M4.1 deleted the kind, and a
   * test for the absence of something that cannot be named is a test that
   * passes by construction.
   */
});

describe('priority comes from the log’s reading and not a second one', () => {
  /**
   * The same pair `test/turn-order.test.ts` uses, for the same reason: base 30
   * Speed against base 130 is a gap no roll closes, so an order flip is a
   * bracket and nothing else.
   */
  const SLOW: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack', 'Tackle'], level: 50 }];
  const FAST: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Tackle', 'Quick Attack'], level: 50 }];

  it('flags a bracket-driven turn, on the move the bracket moved', () => {
    const protocol = play(SLOW, FAST, 1);
    const [turn] = readFlags(protocol, DEPS).filter((group) => group.turn === 1);
    const first = turn?.actions[0];
    expect(first?.action.kind === 'move' && first.action.move).toBe('Quick Attack');
    const priority = first?.flags.find((flag) => flag.kind === 'priority');
    expect(priority).toBeDefined();
    expect(priority?.detail).toBe('+1');
    expect(flagWord('priority', priority?.detail ?? null)).toBe('Priority +1');
  });

  it('flags nothing when both sides share a bracket, even a non-zero one', () => {
    const BOTH_QUICK: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Quick Attack'], level: 50 }];
    const ALSO_QUICK: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Quick Attack'], level: 50 }];
    const protocol = play(BOTH_QUICK, ALSO_QUICK, 1);
    const flags = all(readFlags(protocol, DEPS));
    // Speed decided this turn. Saying "priority" would teach a false rule, and
    // it is the log's rule that says so — this reader never re-derives it.
    expect(flags.some((flag) => flag.kind === 'priority')).toBe(false);
  });
});

describe('the reader’s shape', () => {
  it('groups by turn, in resolution order, exactly as the log does', () => {
    const protocol = play(
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }],
      [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }],
      3,
    );
    const turns = readFlags(protocol, DEPS);
    // The opening switch-ins are their own group with a null turn number, and
    // then the turns run 1, 2, 3 with no gaps.
    expect(turns[0]?.turn).toBeNull();
    expect(turns.slice(1).map((turn) => turn.turn)).toEqual([1, 2, 3]);
    for (const turn of turns) {
      expect(turn.actions.map((each) => each.action.order)).toEqual(
        turn.actions.map((_, index) => index + 1),
      );
    }
  });

  it('reads a whole battle without emitting a flag it has no word for', () => {
    const protocol = play(
      [{ species: 'Machamp', ability: 'Guts', moves: ['Dynamic Punch'], level: 50 }],
      [{ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 50 }],
      8,
    );
    /*
     * Hand-written rather than derived from the union, and that is the point:
     * widening `FlagKind` does not fail this list, so a kind that reaches the
     * strip with no word behind it fails *here*, at runtime, on a real battle.
     * Branch 2 added the seven abnormalities; M4.1 removed `stab` and
     * `contact`, leaving fifteen.
     */
    const KNOWN: FlagKind[] = [
      'super', 'resisted', 'immune', 'crit', 'miss', 'priority', 'status', 'berry',
      'prevented', 'failed', 'boost', 'unboost', 'ability', 'volatile', 'field',
    ];
    for (const kind of kinds(readFlags(protocol, DEPS))) expect(KNOWN).toContain(kind);
  });

  it('is a pure function of its inputs', () => {
    const protocol = play(
      [{ species: 'Kingler', ability: 'Hyper Cutter', moves: ['Crabhammer'], level: 50 }],
      [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }],
      2,
    );
    expect(kinds(readFlags(protocol, DEPS))).toEqual(kinds(readFlags(protocol, DEPS)));
  });
});

describe('hand-written protocol, driven past what a shipped move reaches', () => {
  /**
   * The deps, now one function.
   *
   * This block was called "the injected lookups" and existed because a stub dex
   * could drive a type change and a contact flag through cases no shipped move
   * reaches. M4.1 deleted those kinds; the hand-written protocol stayed,
   * because the line shapes below are still shapes a played battle rarely
   * produces.
   */
  const STUB: FlagDeps = { priorityOf: () => 0 };

  /*
   * ---------------------------------------------------------------------
   * The abnormalities. **Branch 2.**
   *
   * Hand-written protocol rather than played battles, because the point of
   * each is a specific line shape — and two of them are shapes the census
   * found the hard way, where reading the wrong field yields a plausible
   * wrong word rather than an error.
   * ---------------------------------------------------------------------
   */
  it('names the turn a condition took, which nothing else on the screen does', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|cant|p1a: Snorlax|flinch',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => [...group.actions.flatMap((a) => a.flags), ...group.residual]);
    expect(flags.map((flag) => flag.kind)).toEqual(['prevented']);
    expect(flags[0]?.detail).toBe('flinch');
  });

  it('reads a stat stage by its stat, both ways', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-unboost|p2a: Golem|spe|2',
      '|-boost|p1a: Snorlax|atk|1',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags));
    expect(flags.filter((f) => f.kind === 'unboost').map((f) => f.detail)).toEqual(['spe']);
    expect(flags.filter((f) => f.kind === 'boost').map((f) => f.detail)).toEqual(['atk']);
  });

  /*
   * **The census found this one.** The weather names itself in the first field;
   * the third carries the `[from]` tag. Reading the third yields "Rain
   * [upkeep]" — a plausible-looking word that is wrong, which is exactly the
   * kind that ships.
   */
  it('takes a field effect’s name from the field that holds it', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-weather|RainDance|[from] ability: Drizzle|[of] p2a: Pelipper',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags));
    const field = flags.find((flag) => flag.kind === 'field');
    expect(field?.detail).toBe('RainDance');
    // Attributed to the side the engine named as the cause, not to whoever moved.
    expect(field?.side).toBe('p2');
    expect(field?.subject).toBe('Pelipper');
  });

  /**
   * The ability that set the weather. **Stage 4.11 Tier 4.** The engine names
   * it only on the field line's `[from]` tag, so until this the setters were
   * the one kind of ability firing that never produced an `ability` flag.
   * Second, after the field, so the strip's second channel still reads the
   * board and the cause rides the log and the panel's pulse.
   */
  it('names the ability that set a field effect, after the field itself', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Pelipper|Pelipper, L50, M|155/155',
      '|-weather|RainDance|[from] ability: Drizzle|[of] p2a: Pelipper',
      '|turn|1',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => [...group.actions.flatMap((a) => a.flags), ...group.residual]);
    expect(flags.map((flag) => [flag.kind, flag.detail, flag.side])).toEqual([
      ['field', 'RainDance', 'p2'],
      ['ability', 'Drizzle', 'p2'],
    ]);
  });

  /**
   * An ability that fires through an activation line and writes no
   * `-ability` line: 7.2% of battles in the Tier 0 census. Same kind, same
   * word. A move's activation line — the trapping moves — is not an ability
   * and earns nothing here; the panel's volatile chip already says *Bound*.
   */
  it('reads an ability off an activation line, and not a move', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-activate|p2a: Golem|ability: Emergency Exit',
      '|-activate|p2a: Golem|move: Whirlpool|[of] p1a: Snorlax',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags));
    expect(flags.map((flag) => [flag.kind, flag.detail, flag.side])).toEqual([['ability', 'Emergency Exit', 'p2']]);
  });

  /** And the other half of that finding: weather continuing is not an event. */
  it('says nothing when the weather is only carrying on', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|upkeep',
      '|-weather|Sandstorm|[upkeep]',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => [...group.actions.flatMap((a) => a.flags), ...group.residual]);
    expect(flags.some((flag) => flag.kind === 'field')).toBe(false);
  });

  it('names a volatile the panel would name, and ignores one it would not', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-start|p2a: Golem|confusion',
      // Engine bookkeeping and single moves: 4.7% and 2.9% of battles in the
      // census, and no word a player can act on. The allowlist drops them.
      '|-start|p2a: Golem|Charge',
      '|-start|p2a: Golem|Salt Cure',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags));
    expect(flags.filter((flag) => flag.kind === 'volatile').map((flag) => flag.detail)).toEqual(['confusion']);
  });

  it('lets an ability name itself, as a berry does', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|-ability|p2a: Gyarados|Intimidate|boost',
    ];
    const flags = readFlags(protocol, STUB).flatMap((group) => [...group.actions.flatMap((a) => a.flags), ...group.residual]);
    expect(flags.find((flag) => flag.kind === 'ability')?.detail).toBe('Intimidate');
  });

  it('flags a move that failed, and says nothing else about it', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-fail|p1a: Snorlax',
    ];
    const kindsHere = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags.map((f) => f.kind)));
    /*
     * One flag, and it is the failure.
     *
     * The premise changed rather than the case. It used to assert that CONTACT
     * and STAB were *retracted* here — a move that failed did nothing, so it
     * made no contact and earned no same-type bonus, and printing CONTACT under
     * Failed teaches a player to stop trusting the row. M4.1 deleted both kinds
     * and the retraction with them, so the equality is the assertion now: it
     * fails if anything at all joins `failed`.
     */
    expect(kindsHere).toEqual(['failed']);
  });

  it('leaves an ordinary damage turn carrying no abnormality at all', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
    ];
    const kindsHere = readFlags(protocol, STUB).flatMap((group) => group.actions.flatMap((a) => a.flags.map((f) => f.kind)));
    const ABNORMAL = ['prevented', 'failed', 'boost', 'unboost', 'ability', 'volatile', 'field'];
    expect(kindsHere.filter((kind) => ABNORMAL.includes(kind))).toEqual([]);
  });

  it('reads no flag off a type change, which used to be the one line STAB needed', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Golem|Golem, L50, F|155/155',
      '|turn|1',
      '|-start|p1a: Snorlax|typechange|Water',
      '|move|p1a: Snorlax|Water Gun|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
      '|upkeep',
    ];
    /*
     * Two cases stood here, and both were about STAB surviving Soak and
     * Protean: a body that changed type earned the bonus on the type it *now*
     * had, and dropped the acquired type when it left the field. M4.1 deleted
     * the kind, so the branch that read this line went with it.
     *
     * The line is still in the protocol, so this asserts where it lands now:
     * it falls through to the volatile branch, `DISPLAYED_VOLATILES` does not
     * list `typechange`, and it is dropped. A reader that started emitting
     * `Condition: typechange` on every Protean turn would fail here rather
     * than on the strip.
     */
    expect(all(readFlags(protocol, STUB)).map((flag) => flag.kind)).toEqual([]);
  });

  it('puts an end-of-turn berry on the turn rather than on the last move', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p1a: Snorlax|Tackle|p2a: Golem',
      '|-damage|p2a: Golem|100/155',
      '|upkeep',
      '|-enditem|p1a: Snorlax|Sitrus Berry|[eat]',
      '|-heal|p1a: Snorlax|180/235|[from] item: Sitrus Berry',
    ];
    const [turn] = readFlags(protocol, STUB).filter((group) => group.turn === 1);
    // Tackle did not feed anybody a berry, so it does not wear the flag.
    expect(turn?.actions.flatMap((each) => each.flags).some((flag) => flag.kind === 'berry')).toBe(false);
    expect(turn?.residual.map((flag) => flag.kind)).toEqual(['berry']);
  });

  it('ignores a spent item that is not a berry', () => {
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|turn|1',
      '|move|p2a: Golem|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|1/235',
      '|-enditem|p1a: Snorlax|Focus Sash',
      '|upkeep',
    ];
    // The bag still counts it — `driver.readConsumedItems` keeps every
    // `-enditem` — but a Focus Sash is a sentence the log writes better.
    const flags = all(readFlags(protocol, STUB));
    expect(flags.some((flag) => flag.kind === 'berry')).toBe(false);
  });

  it('handles a stream that opens on a turn rather than on a switch-in', () => {
    const protocol = ['|turn|4', '|move|p1a: Snorlax|Tackle|p2a: Golem', '|-crit|p2a: Golem', '|upkeep'];
    const turns = readFlags(protocol, STUB);
    expect(turns.map((turn) => turn.turn)).toEqual([4]);
    expect(turns[0]?.actions[0]?.flags.map((flag) => flag.kind)).toContain('crit');
  });
});

describe('reading a battle one update at a time', () => {
  /**
   * What this block was, and why it is one case now.
   *
   * It held the case that broke the first cut of the reader: a battle's
   * updates arrive one turn at a time, the protocol names a species exactly
   * once — on the `|switch|` that brought it in — and a turn where nobody
   * switched carries no `|switch|` line at all. A reader that started fresh on
   * every batch therefore knew the species only on switch turns and printed
   * STAB on those and nowhere else, which is worse than never printing it.
   * `createFlagReader` existed to carry that state across batches.
   *
   * M4.1 deleted STAB, which deleted the state, which deleted the reader. What
   * survives is the property that mattered underneath it: **a batch is read on
   * its own terms**, and a turn that carried no switch still reports what it
   * did. That is asserted here against a real streamed battle rather than
   * assumed from the function being pure.
   */
  const SNORLAX: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }];
  const MILOTIC: TeamSpec = [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }];

  it('reads a batch that carried no switch, the same as one that did', () => {
    const session = createBattle({ teams: { p1: SNORLAX, p2: MILOTIC }, seed: 'STREAM01' });

    // The opening batch: switch-ins and `|turn|1`, and no move.
    const opening = session.protocolFor('p1').filter((line) => !line.startsWith('|t:|'));
    expect(opening.some((line) => line.startsWith('|switch|'))).toBe(true);
    expect(readFlags(opening, DEPS).length, 'the opening reads as a group').toBeGreaterThan(0);

    // Two turns of moves, each in its own batch, neither carrying a `|switch|`.
    for (let turn = 0; turn < 2; turn++) {
      const before = session.protocolFor('p1').length;
      for (const side of ['p1', 'p2'] as const) {
        if (session.viewFor(side).awaitingChoice) session.submit(side, moveChoice(1));
      }
      const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
      expect(batch.some((line) => line.startsWith('|switch|')), 'batch carries no switch').toBe(false);

      const read = readFlags(batch, DEPS);
      // Body Slam against Scald: both sides act every turn, and the reader
      // places both actions without having seen either body arrive.
      const actions = read.flatMap((group) => group.actions);
      expect(actions.length, `turn ${turn + 1} actions`).toBeGreaterThan(0);
      expect(actions.every((each) => each.action.order > 0)).toBe(true);
    }
  });

  it('reads one batch the same whether it follows another or not', () => {
    const protocol = play(SNORLAX, MILOTIC, 2, 'STREAM01');
    /*
     * The one-shot form used to be asserted equal to the stateful reader over
     * the same lines. With the reader gone the equivalent claim is that the
     * function carries nothing between calls, which is what the screen now
     * relies on: it calls `readFlags` once per update, forever.
     */
    expect(kinds(readFlags(protocol, DEPS))).toEqual(kinds(readFlags(protocol, DEPS)));
  });
});
