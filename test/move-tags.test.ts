/**
 * Move legibility: the structured fields, the tags derived from them, and the
 * cap that keeps a 2x2 grid of buttons readable on a phone.
 *
 * Stage 4.7, Part 6. Two problems with one cause. A status move renders three
 * empty regions where base power, band and the effectiveness marker sit on a
 * damaging move, so it reads as broken. And a multi-hit move looks identical to
 * a single-hit move of the same base power, which makes the band badge look
 * like a bug.
 *
 * **`describeMove` is the Release B explanation pulled forward**, not a second
 * mechanism beside it. That release is not merged; the Stage 1 `describeMove`
 * existed and returned seven fields; this widens it. The tests below are the
 * Release B sweep and the Part 6 sweep against the one function.
 */
import { describe, expect, it } from 'vitest';

import { describeSpecCard, describeMove } from '../src/core/battle/driver';
import {
  hasStatusReadout,
  moveTags,
  statusEffectFields,
  tagsForFace,
} from '../src/core/moveTags';
import { MOVE_TAGS, MOVE_TAG_BY_ID, moveTagLabel, multiHitLine } from '../src/data/moveTags';
import {
  accuracyPhrase,
  boostPhrase,
  drainPhrase,
  effectPhrase,
  healPhrase,
  priorityPhrase,
  recoilPhrase,
  statusPhrase,
} from '../src/data/moveCopy';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { bandOfMove } from '../src/data/moveOverrides';

/** `describeMove`, with the null case turned into a failure rather than a skip. */
const explain = (name: string) => {
  const move = describeMove(name);
  expect(move, `${name} is not in the dex`).not.toBeNull();
  return move!;
};

const ids = (name: string, holder?: { types: string[] }) =>
  moveTags(explain(name), holder).map((tag) => tag.id);

describe('describeMove, widened', () => {
  it('reports accuracy as a number, and never-misses as an explicit marker', () => {
    /*
     * The single most important field in the patch: a player who misses with an
     * 85% move has no way to know the move was ever inaccurate, so the miss
     * reads as the game cheating.
     */
    expect(explain('Thunder').accuracy).toBe(70);
    expect(explain('Toxic').accuracy).toBe(90);
    expect(explain('Aerial Ace').accuracy).toBe(true);
    expect(explain('Body Slam').accuracy).toBe(100);
  });

  it('reports the priority bracket, in both directions', () => {
    expect(explain('Quick Attack').priority).toBe(1);
    expect(explain('Protect').priority).toBe(4);
    expect(explain('Trick Room').priority).toBe(-7);
    expect(explain('Body Slam').priority).toBe(0);
  });

  it('reports a secondary effect with its chance', () => {
    expect(explain('Flamethrower').secondary).toEqual({ chance: 10, status: 'brn' });
    expect(explain('Thunder').secondary).toEqual({ chance: 30, status: 'par' });
    expect(explain('Body Slam').secondary?.chance).toBe(30);
  });

  it('reports stat changes on the right side of the field', () => {
    expect(explain('Swords Dance').boosts).toEqual([{ stat: 'atk', stages: 2, target: 'self' }]);
    expect(explain('Growl').boosts).toEqual([{ stat: 'atk', stages: -1, target: 'foe' }]);
  });

  it('reports recoil, drain and self-healing as fractions', () => {
    expect(explain('Double-Edge').recoil).toBeCloseTo(1 / 3, 2);
    expect(explain('Giga Drain').drain).toBeCloseTo(1 / 2, 2);
    expect(explain('Roost').heal).toBeCloseTo(1 / 2, 2);
  });

  it('reports charge and recharge turns', () => {
    expect(explain('Solar Beam').chargeTurns).toBe(1);
    expect(explain('Hyper Beam').rechargeTurns).toBe(1);
    expect(explain('Body Slam').chargeTurns).toBeUndefined();
  });

  it('reports a multi-hit range', () => {
    expect(explain('Bullet Seed').multiHit).toEqual([2, 5]);
    expect(explain('Double Kick').multiHit).toEqual([2, 2]);
    expect(explain('Body Slam').multiHit).toBeUndefined();
  });

  it('omits absent fields rather than returning empties', () => {
    /*
     * The rule the status readout depends on: an absent field is absent, not an
     * empty array, because a present-but-empty field is how a card grows a
     * blank row — which is the exact failure Part 6a exists to remove.
     */
    const slam = explain('Body Slam');
    expect('boosts' in slam).toBe(false);
    expect('heal' in slam).toBe(false);
    expect('volatile' in slam).toBe(false);
    expect('multiHit' in slam).toBe(false);
  });

  it('takes its band from bandOfMove rather than recomputing it', () => {
    for (const name of ['Flamethrower', 'Quick Attack', 'Population Bomb', 'Body Slam']) {
      expect(explain(name).band).toBe(bandOfMove(name));
    }
  });

  it('is pure: identical input, identical output', () => {
    expect(explain('Flamethrower')).toEqual(explain('Flamethrower'));
  });

  it('returns null for a move that does not exist', () => {
    expect(describeMove('Not A Move')).toBeNull();
  });
});

describe('the multi-hit disagreement', () => {
  it('reports per-hit base power and a band that disagrees, without either being wrong', () => {
    /*
     * The brief's own test, and the failure it prevents: banding happens on
     * *total* power, so Population Bomb reads band 4 at 20 base power. Both
     * numbers on the card or the badge looks broken.
     */
    const bomb = explain('Population Bomb');
    expect(bomb.basePower).toBe(20);
    expect(bomb.band).toBe(4);
    expect(bomb.multiHit).toBeDefined();

    // And the sentence that says so names both.
    const line = multiHitLine(bomb.multiHit!, bomb.basePower);
    expect(line).toMatch(/10/);
    expect(line).toMatch(/20 base power/);
  });

  it('spells a range as a range and a fixed count as a count', () => {
    expect(multiHitLine([2, 5], 25)).toBe('Hits 2 to 5 times, 25 base power each.');
    expect(multiHitLine([2, 2], 30)).toBe('Hits 2 times, 30 base power each.');
  });
});

describe('tag derivation', () => {
  it('tags a multi-hit move', () => {
    expect(ids('Bullet Seed')).toContain('multiHit');
  });

  it('tags a priority move', () => {
    expect(ids('Quick Attack')).toContain('priority');
    expect(ids('Body Slam')).not.toContain('priority');
  });

  it('tags a drain move and a recoil move', () => {
    expect(ids('Giga Drain')).toContain('drain');
    expect(ids('Double-Edge')).toContain('recoil');
  });

  it('tags a charge move and a recharge move', () => {
    expect(ids('Solar Beam')).toContain('charge');
    expect(ids('Hyper Beam')).toContain('recharge');
  });

  it('tags a never-miss move, and never both accuracy tags at once', () => {
    const aerial = ids('Aerial Ace');
    expect(aerial).toContain('neverMisses');
    expect(aerial).not.toContain('accuracy');
  });

  it('tags a sub-100 accuracy move with its number', () => {
    const thunder = moveTags(explain('Thunder'));
    const accuracy = thunder.find((tag) => tag.id === 'accuracy');
    expect(accuracy?.value?.accuracy).toBe(70);
    expect(moveTagLabel('accuracy', accuracy?.value)).toBe('70%');
  });

  it('tags contact, sound, high crit and protect-bypassing', () => {
    expect(ids('Body Slam')).toContain('contact');
    expect(ids('Growl')).toContain('sound');
    expect(ids('Slash')).toContain('highCrit');
    expect(ids('Feint')).toContain('bypassesProtect');
  });

  it('leaves an accuracy-100 move untagged for accuracy', () => {
    const slam = ids('Body Slam');
    expect(slam).not.toContain('accuracy');
    expect(slam).not.toContain('neverMisses');
  });

  it('is ordered by the table, so the face cut is a prefix', () => {
    const tags = moveTags(explain('Bullet Seed'));
    const order = tags.map((tag) => MOVE_TAGS.findIndex((entry) => entry.id === tag.id));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe('STAB, which is contextual', () => {
  it('is absent on an unassigned card and present once a holder is known', () => {
    /*
     * STAB is a property of the move *and* the holder together. A reward card
     * with no recipient chosen yet cannot claim it — that would be claiming
     * something not yet true.
     */
    expect(ids('Flamethrower')).not.toContain('stab');
    expect(ids('Flamethrower', { types: ['Fire'] })).toContain('stab');
    expect(ids('Flamethrower', { types: ['Water'] })).not.toContain('stab');
  });

  it('never appears on a status move, which rolls no damage to multiply', () => {
    expect(ids('Toxic', { types: ['Poison'] })).not.toContain('stab');
  });

  it('reads the holder off a real spec card', () => {
    const card = describeSpecCard({
      species: 'Charizard',
      ability: 'Blaze',
      moves: ['Flamethrower'],
      level: 50,
    });
    expect(ids('Flamethrower', { types: [...card.types] })).toContain('stab');
  });
});

describe('the face cap', () => {
  it('never renders more than tuning.maxMoveTagsOnFace tags', () => {
    /*
     * Four move buttons in a 2x2 grid on a 390x844 phone cannot carry twelve
     * tags and a 44px touch target.
     */
    for (const name of [
      'Bullet Seed',
      'Double-Edge',
      'Giga Drain',
      'Quick Attack',
      'Thunder',
      'Solar Beam',
      'Hyper Beam',
      'Slash',
      'Feint',
      'Body Slam',
      'Growl',
      'Toxic',
    ]) {
      const face = tagsForFace(explain(name), DEFAULT_TUNING.maxMoveTagsOnFace, { types: ['Normal'] });
      expect(face.length, name).toBeLessThanOrEqual(DEFAULT_TUNING.maxMoveTagsOnFace);
    }
  });

  it('finds a move the cap actually cuts, or it is not a cap', () => {
    // Head Smash on a Rock holder: accuracy 80, STAB, recoil, contact. Four
    // tags against a cap of three, so the face has to drop one.
    const crowded = moveTags(explain('Head Smash'), { types: ['Rock'] });
    expect(crowded.length).toBeGreaterThan(DEFAULT_TUNING.maxMoveTagsOnFace);
    expect(tagsForFace(explain('Head Smash'), DEFAULT_TUNING.maxMoveTagsOnFace, { types: ['Rock'] }))
      .toHaveLength(DEFAULT_TUNING.maxMoveTagsOnFace);
  });

  it('keeps the full set reachable, as a superset of the face', () => {
    const move = explain('Head Smash');
    const holder = { types: ['Rock'] };
    const face = tagsForFace(move, DEFAULT_TUNING.maxMoveTagsOnFace, holder);
    const full = moveTags(move, holder);

    expect(full.length).toBeGreaterThanOrEqual(face.length);
    expect(full.slice(0, face.length)).toEqual(face);
    for (const tag of face) expect(full.map((entry) => entry.id)).toContain(tag.id);
  });

  it('cuts in table priority order, not in derivation order', () => {
    const face = tagsForFace(explain('Head Smash'), 2, { types: ['Rock'] });
    const positions = face.map((tag) => MOVE_TAGS.findIndex((entry) => entry.id === tag.id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('handles a cap of zero without throwing', () => {
    expect(tagsForFace(explain('Body Slam'), 0)).toEqual([]);
  });
});

describe('the status readout', () => {
  it('returns a non-empty structured readout for every status move in the sweep', () => {
    /*
     * The brief's own list. Each one exercises a different field: Protect a
     * volatile and a priority bracket, Roost a heal, Swords Dance a self boost,
     * Toxic a status, Trick Room a field effect and a negative bracket.
     */
    for (const name of ['Protect', 'Roost', 'Swords Dance', 'Toxic', 'Trick Room']) {
      const move = explain(name);
      expect(move.category).toBe('Status');
      expect(hasStatusReadout(move), name).toBe(true);
      expect(statusEffectFields(move).length, name).toBeGreaterThan(0);
    }
  });

  it('picks out the right field for each of them', () => {
    expect(statusEffectFields(explain('Protect'))).toEqual(
      expect.arrayContaining(['volatile', 'priority']),
    );
    expect(statusEffectFields(explain('Roost'))).toContain('heal');
    expect(statusEffectFields(explain('Swords Dance'))).toContain('boosts');
    expect(statusEffectFields(explain('Toxic'))).toContain('status');
    expect(statusEffectFields(explain('Trick Room'))).toEqual(
      expect.arrayContaining(['fieldEffect', 'priority']),
    );
  });

  it('returns no status readout for a damaging move', () => {
    for (const name of ['Body Slam', 'Flamethrower', 'Population Bomb', 'Quick Attack']) {
      expect(hasStatusReadout(explain(name)), name).toBe(false);
    }
  });
});

describe('the copy', () => {
  it('states attributes, never verdicts', () => {
    expect(boostPhrase('atk', 2, 'self')).toBe('Raises Attack by 2 stages');
    expect(boostPhrase('spe', -1, 'foe')).toBe('Lowers the target’s Speed by 1 stage');
    expect(healPhrase(0.5)).toBe('Restores half of max HP');
    expect(statusPhrase('tox')).toBe('Badly poisons the target');
    expect(effectPhrase('protect')).toBe('Protects the user this turn');
    expect(priorityPhrase(4)).toBe('Moves in the +4 priority bracket');
    expect(priorityPhrase(-7)).toBe('Moves in the -7 priority bracket');
    expect(accuracyPhrase(85)).toBe('Accuracy 85%');
    expect(accuracyPhrase(true)).toBe('Never misses');
    expect(recoilPhrase(1 / 3)).toBe('The user takes a third of the damage dealt');
    expect(drainPhrase(1 / 2)).toBe('The user recovers half of the damage dealt');
  });

  it('carries no judgement words anywhere in the tag table', () => {
    /*
     * Part 4, asserted rather than intended. "Hits 2 to 5 times" is correct,
     * "high damage potential" is not. "Accuracy 85%" is correct, "risky" is not.
     */
    const forbidden = /\b(best|better|worse|risky|safe|strong|weak|powerful|should|great|good|bad|prefer|recommend)\b/i;
    for (const tag of MOVE_TAGS) {
      expect(tag.short, tag.id).not.toMatch(forbidden);
      expect(tag.long, tag.id).not.toMatch(forbidden);
      expect(tag.blurb, tag.id).not.toMatch(forbidden);
    }
  });

  it('has words for every tag it can derive', () => {
    for (const tag of MOVE_TAGS) {
      expect(MOVE_TAG_BY_ID[tag.id]).toBe(tag);
      expect(moveTagLabel(tag.id).length).toBeGreaterThan(0);
    }
  });

  it('labels the two tags that carry numbers with their numbers', () => {
    expect(moveTagLabel('accuracy', { accuracy: 85 })).toBe('85%');
    expect(moveTagLabel('multiHit', { hits: [2, 5] })).toBe('Hits 2-5');
    expect(moveTagLabel('multiHit', { hits: [10, 10] })).toBe('Hits 10x');
    expect(moveTagLabel('priority', { priority: 1 })).toBe('+1 priority');
    expect(moveTagLabel('priority', { priority: -7 })).toBe('-7 priority');
  });
});
