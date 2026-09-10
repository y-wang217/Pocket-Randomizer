/**
 * Relics: the table, and the fold.
 *
 * Stage 4.6c step 1. No events and no UI yet — what is asserted here is that
 * the table is coherent and that `applyRelicPassives` is a pure, additive,
 * order-independent sum, because everything built on top of it in the later
 * steps assumes exactly that.
 */
import { describe, expect, it } from 'vitest';
import {
  NO_RELIC_EFFECTS,
  applyRelicPassives,
  grantedCapabilities,
  grantsCapability,
  hasRelic,
} from '../src/core/relics';
import { RELICS, RELIC_IDS, relicById, relicsGranting } from '../src/data/relics';
import { CAPABILITIES } from '../src/data/capabilities';

const idOf = (capability: (typeof CAPABILITIES)[number]): string => {
  const relic = relicsGranting(capability)[0];
  if (!relic) throw new Error(`no relic grants ${capability}`);
  return relic.id;
};

describe('the table', () => {
  it('has a relic for every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(relicsGranting(capability).length, capability).toBeGreaterThan(0);
    }
  });

  it('has unique ids and unique names', () => {
    expect(new Set(RELIC_IDS).size).toBe(RELICS.length);
    expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length);
  });

  it('grants exactly one capability per relic, and a real one', () => {
    for (const relic of RELICS) {
      expect(CAPABILITIES).toContain(relic.grants);
    }
  });

  it('gives every relic a description that says what it opens', () => {
    for (const relic of RELICS) {
      expect(relic.playerDescription.length, relic.id).toBeGreaterThan(20);
      // The Part 4 editorial rule: attributes, never verdicts. A permanent
      // object is on screen for the rest of the run, so this matters more here
      // than on a card the player sees once.
      expect(relic.playerDescription).not.toMatch(/\b(best|strong(est)?|useful|powerful|better|worth it|recommended)\b/i);
    }
  });

  it('resolves a known id and refuses an unknown one without throwing', () => {
    expect(relicById(RELIC_IDS[0] ?? '')?.id).toBe(RELIC_IDS[0]);
    expect(relicById('no-such-relic')).toBeNull();
  });
});

describe('reading the held set', () => {
  it('answers hasRelic and grantsCapability', () => {
    const surf = idOf('surf');
    expect(hasRelic([surf], surf)).toBe(true);
    expect(hasRelic([], surf)).toBe(false);
    expect(grantsCapability([surf], 'surf')).toBe(true);
    expect(grantsCapability([surf], 'fly')).toBe(false);
  });

  it('lists granted capabilities once each, in the order taken', () => {
    const [a, b] = [idOf('fly'), idOf('surf')];
    expect(grantedCapabilities([a, b])).toEqual(['fly', 'surf']);
    expect(grantedCapabilities([b, a])).toEqual(['surf', 'fly']);
    // Two relics granting the same capability list it once.
    const bothCut = relicsGranting('cut').map((relic) => relic.id);
    expect(bothCut.length).toBeGreaterThan(1);
    expect(grantedCapabilities(bothCut)).toEqual(['cut']);
  });

  it('ignores an id the table does not have', () => {
    expect(grantsCapability(['no-such-relic'], 'surf')).toBe(false);
    expect(grantedCapabilities(['no-such-relic'])).toEqual([]);
  });
});

describe('folding the passives', () => {
  it('gives a run holding nothing every field at zero', () => {
    expect(applyRelicPassives([])).toEqual(NO_RELIC_EFFECTS);
  });

  it('is pure: identical input, identical output, and the input is untouched', () => {
    const held = [idOf('strength'), idOf('rockSmash')];
    const before = [...held];
    expect(applyRelicPassives(held)).toEqual(applyRelicPassives(held));
    expect(held).toEqual(before);
  });

  it('sums two relics granting the same kind', () => {
    // Rusted Machete +3 and Ferryman's Oar +4 both pay nodeCurrency.
    const one = applyRelicPassives(['rusted-machete']).nodeCurrency;
    const other = applyRelicPassives(['ferrymans-oar']).nodeCurrency;
    const both = applyRelicPassives(['rusted-machete', 'ferrymans-oar']).nodeCurrency;
    expect(one).toBeGreaterThan(0);
    expect(other).toBeGreaterThan(0);
    expect(both).toBe(one + other);
  });

  it('is order-independent', () => {
    const a = ['rusted-machete', 'ferrymans-oar', 'cascade-talisman'];
    expect(applyRelicPassives(a)).toEqual(applyRelicPassives([...a].reverse()));
  });

  it('ignores a duplicated id rather than counting it twice', () => {
    const once = applyRelicPassives(['prospectors-hammer']);
    expect(applyRelicPassives(['prospectors-hammer', 'prospectors-hammer'])).toEqual(once);
  });

  it('ignores an unknown id', () => {
    expect(applyRelicPassives(['no-such-relic'])).toEqual(NO_RELIC_EFFECTS);
  });

  it('contributes nothing for a relic whose passive is none', () => {
    const pure = RELICS.filter((relic) => relic.passive.kind === 'none');
    expect(pure.length).toBeGreaterThan(0);
    expect(applyRelicPassives(pure.map((relic) => relic.id))).toEqual(NO_RELIC_EFFECTS);
  });

  it('clamps a stacked shop discount to a free item rather than wrapping', () => {
    // Not reachable from the shipped table, which has one discount relic. It is
    // asserted anyway because the clamp is the kind of thing a later relic
    // silently invalidates.
    const effects = applyRelicPassives(RELIC_IDS);
    expect(effects.shopDiscount).toBeGreaterThanOrEqual(0);
    expect(effects.shopDiscount).toBeLessThanOrEqual(1);
  });

  it('folds the whole table without a NaN or a negative', () => {
    const effects = applyRelicPassives(RELIC_IDS);
    for (const [field, value] of Object.entries(effects)) {
      expect(Number.isFinite(value), field).toBe(true);
      expect(value, field).toBeGreaterThanOrEqual(0);
    }
  });
});
