/**
 * R9's one flag per hit, and D23's second channel. **Milestone M4.1.**
 *
 * @vitest-environment jsdom
 *
 * ## Two things, tested two ways
 *
 * `data/flagPrecedence.ts` is a table and is asserted as one: every kind in
 * exactly one channel, every hit kind ranked exactly once, no kind ranked
 * twice. Those are the failures a table has, and none of them needs a battle.
 *
 * `ui/flag-strip.ts` applies it, and the item's done-when names the three
 * collisions it must resolve correctly — a crit on a super effective hit, a
 * miss with a status, a berry with a stat stage. Those are driven through
 * hand-written protocol rather than played battles, for the reason
 * `test/flags.test.ts` gives for its own last block: the point of each case is
 * a specific collision, and a seed that happens to produce one today is a seed
 * that stops producing it when the sim's rolls move.
 *
 * The reading itself is `readFlags`, unchanged and unfiltered. **The mapper
 * still returns everything**, which is R9's own enforcement clause and what
 * `ui/abnormality.ts` reads its beats from. Only the strip cuts.
 */
import { describe, expect, it } from 'vitest';

import { readFlags, type FlagDeps, type FlagKind } from '../src/core/battle/flags';
import { FLAG_CHANNEL, HIT_PRECEDENCE, hitRank } from '../src/data/flagPrecedence';
import { FLAG_BLURBS } from '../src/data/flagWords';
import { createFlagStrip } from '../src/ui/flag-strip';

const DEPS: FlagDeps = { priorityOf: () => 0 };

const OPEN = [
  '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
  '|switch|p2a: Golem|Golem, L50, F|155/155',
  '|turn|1',
];

/** The words on the strip, in the order it drew them. */
function words(protocol: readonly string[]): string[] {
  const strip = createFlagStrip();
  strip.show(readFlags(protocol, DEPS));
  return [...strip.root.querySelectorAll('.chip--flag')].map((chip) => chip.textContent ?? '');
}

/** The kinds on the strip, in the order it drew them. */
function shown(protocol: readonly string[]): string[] {
  const strip = createFlagStrip();
  strip.show(readFlags(protocol, DEPS));
  return [...strip.root.querySelectorAll('.chip--flag')].map(
    (chip) => (chip as HTMLElement).dataset['flag'] ?? '',
  );
}

describe('the precedence table', () => {
  /**
   * Every kind, from the one place that has to know them all.
   *
   * `FLAG_BLURBS` is keyed by `FlagKind` and is exhaustive by type, so this
   * list cannot fall behind the union the way a hand-written one would.
   */
  const KINDS = Object.keys(FLAG_BLURBS) as FlagKind[];

  it('puts every kind in exactly one channel', () => {
    for (const kind of KINDS) expect(FLAG_CHANNEL[kind], kind).toMatch(/^(hit|second)$/);
    expect(KINDS).toHaveLength(15);
  });

  it('ranks every hit kind exactly once, and nothing else at all', () => {
    const ranked = HIT_PRECEDENCE.flat();
    const hitKinds = KINDS.filter((kind) => FLAG_CHANNEL[kind] === 'hit');

    expect([...ranked].sort()).toEqual([...hitKinds].sort());
    expect(new Set(ranked).size, 'no kind ranked twice').toBe(ranked.length);
  });

  it('is R9’s order, in R9’s words', () => {
    /*
     * Restated from the rule rather than read off the table, so that reordering
     * the table fails here. R9: "no effect, miss, super effective or not very
     * effective, critical, status inflicted, berry fired, stat stage changed."
     */
    expect(HIT_PRECEDENCE).toEqual([
      ['immune'],
      ['miss'],
      ['super', 'resisted'],
      ['crit'],
      ['status'],
      ['berry'],
      ['boost', 'unboost'],
    ]);
  });

  it('gives a tied pair the same rank, and a second-channel kind no rank at all', () => {
    // One multiplier reported two ways, and one stat stage moving: neither
    // outranks the other and neither can co-occur with its twin on one hit.
    expect(hitRank('super')).toBe(hitRank('resisted'));
    expect(hitRank('boost')).toBe(hitRank('unboost'));
    expect(hitRank('immune')).toBeLessThan(hitRank('crit'));

    for (const kind of KINDS.filter((each) => FLAG_CHANNEL[each] === 'second')) {
      expect(hitRank(kind), kind).toBe(Number.POSITIVE_INFINITY);
    }
  });
});

describe('one flag per hit, by R9’s precedence', () => {
  it('shows the effectiveness of a critical hit, not the crit', () => {
    /*
     * The done-when's first collision. Super effective outranks critical in
     * R9's own order, and it is the fact that changes the next decision: the
     * crit was a roll and the matchup will still be there next turn.
     */
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-supereffective|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|40/155',
      '|upkeep',
    ];
    expect(shown(protocol)).toEqual(['super']);
    expect(words(protocol)).toEqual(['Super effective']);
  });

  it('shows the miss, not the status the same turn inflicted', () => {
    /*
     * The second collision, and the reason miss sits so high: a turn that did
     * nothing is the turn a player is most likely to misread. The status is on
     * the panel as a chip and stays there until it is cured.
     */
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-miss|p1a: Snorlax|p2a: Golem',
      '|move|p2a: Golem|Thunder Wave|p1a: Snorlax',
      '|-status|p1a: Snorlax|par',
      '|upkeep',
    ];
    // One per side: the miss is p1's, the paralysis is p1's too — so they
    // compete, and the miss wins.
    expect(shown(protocol)).toEqual(['miss']);
  });

  it('shows the berry, not the stat stage that came with it', () => {
    /*
     * The third collision. A berry is spent and gone; a stat stage is on the
     * panel as a multiplier and a ladder for as long as it lasts.
     */
    const protocol = [
      ...OPEN,
      '|move|p2a: Golem|Tackle|p1a: Snorlax',
      '|-damage|p1a: Snorlax|20/235',
      '|-enditem|p1a: Snorlax|Starf Berry|[eat]',
      '|-boost|p1a: Snorlax|atk|2',
      '|upkeep',
    ];
    expect(shown(protocol)).toEqual(['berry']);
    expect(words(protocol)).toEqual(['Starf Berry']);
  });

  it('gives each side its own flag, because R9 counts targets', () => {
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-resisted|p2a: Golem',
      '|-damage|p2a: Golem|120/155',
      '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
      '|-crit|p1a: Snorlax',
      '|-damage|p1a: Snorlax|180/235',
      '|upkeep',
    ];
    expect(shown(protocol)).toEqual(['resisted', 'crit']);
  });

  it('keeps the protocol’s order, which precedence never reorders', () => {
    /*
     * The second side resolves first here, so the strip reads `crit` then
     * `resisted` — the reverse of the case above, off the same two kinds. A
     * strip that sorted by rank would print them the same way round both
     * times, and rank would have become a ranking on screen.
     */
    const protocol = [
      ...OPEN,
      '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
      '|-crit|p1a: Snorlax',
      '|-damage|p1a: Snorlax|180/235',
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-resisted|p2a: Golem',
      '|-damage|p2a: Golem|120/155',
      '|upkeep',
    ];
    expect(shown(protocol)).toEqual(['crit', 'resisted']);
  });
});

describe('the second channel, which is D23', () => {
  it('keeps a prevented turn’s word, which nothing else on the screen draws', () => {
    /*
     * The case D23 was ruled for. A flinched turn draws no damage, so no chunk
     * and no beat; ranked against a hit outcome it would be dropped on exactly
     * the turn that leaves no other trace.
     */
    const protocol = [...OPEN, '|cant|p1a: Snorlax|flinch', '|upkeep'];
    expect(words(protocol)).toEqual(['Flinched']);
  });

  it('draws one non-hit kind beside the hit flag, on the same side', () => {
    const protocol = [
      ...OPEN,
      '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
      '|-supereffective|p1a: Snorlax',
      '|-damage|p1a: Snorlax|100/235',
      '|-start|p1a: Snorlax|confusion',
      '|upkeep',
    ];
    // The hit outcome and the condition that began are different questions,
    // and the panel draws the second one as a chip that stays.
    expect(shown(protocol)).toEqual(['super', 'volatile']);
  });

  it('takes the first non-hit kind per side and drops the rest', () => {
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-ability|p2a: Golem|Sturdy',
      '|-start|p2a: Golem|confusion',
      '|-fail|p2a: Golem',
      '|upkeep',
    ];
    // Three second-channel kinds on one side; the protocol's own order decides,
    // and the bound is what keeps section 4's row a budget.
    expect(shown(protocol)).toEqual(['ability']);
  });

  it('bounds the whole strip at two per side', () => {
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-supereffective|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|40/155',
      '|-status|p2a: Golem|par',
      '|-start|p2a: Golem|confusion',
      '|-ability|p2a: Golem|Sturdy',
      '|move|p2a: Golem|Rock Slide|p1a: Snorlax',
      '|-crit|p1a: Snorlax',
      '|-damage|p1a: Snorlax|180/235',
      '|-start|p1a: Snorlax|confusion',
      '|upkeep',
    ];
    const kinds = shown(protocol);
    expect(kinds).toEqual(['super', 'volatile', 'crit', 'volatile']);
    expect(kinds).toHaveLength(4);
  });
});

describe('what the cut does not touch', () => {
  it('leaves the mapper returning everything, which is R9’s own clause', () => {
    /*
     * R9: "the mapper returns a list; the renderer takes the first by
     * precedence." `ui/abnormality.ts` reads its beat from that list, so a
     * filter applied upstream would silently change which animations play.
     */
    const protocol = [
      ...OPEN,
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-supereffective|p2a: Golem',
      '|-crit|p2a: Golem',
      '|-damage|p2a: Golem|40/155',
      '|-status|p2a: Golem|par',
      '|upkeep',
    ];
    const read = readFlags(protocol, DEPS)
      .flatMap((group) => [...group.actions.flatMap((each) => each.flags), ...group.residual])
      .map((flag) => flag.kind);

    expect(read).toEqual(['super', 'crit', 'status']);
    expect(shown(protocol)).toEqual(['super']);
  });
});
