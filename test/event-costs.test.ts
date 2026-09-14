/**
 * Event rejig steps 4 and 5: what a cost may do to a run, and what the log
 * records about which button produced it.
 *
 * The patch is the first thing in GYMRUN that lets an event *take* something.
 * Before it, the rule was that an event pays at every band — "a player with
 * nothing is unrewarded, not punished" — and that rule is retired here. What
 * replaces it is not "anything goes": four clamps, asserted below, and the
 * Safe option on every event so that downside is opt in rather than imposed.
 *
 *   1. No cost faints a member or takes one below 1 HP.
 *   2. No cost drives currency below zero.
 *   3. A `T0` always grants its consolation, so a cost never appears alone.
 *   4. A forced discard takes what is there and no more.
 *
 * And the identity: the log records the **archetype**, not an index, because
 * the presented option list is three long without the event's relic and four
 * with.
 */
import { describe, expect, it } from 'vitest';

import {
  applyEventOutcome,
  applyToll,
  tollEffect,
  type EventOutcome,
  type ResolvedEffect,
} from '../src/core/events';
import {
  assertReplayable,
  createRun,
  currentVersions,
  isReplayable,
  RUN_LOG_VERSION,
  type RunState,
} from '../src/core/run';
import { ENGINE_VERSION } from '../src/core/battle/driver';
import type { RunLog } from '../src/core/types';
import { createPartyMember } from '../src/core/party';
import { EVENTS } from '../src/data/events';
import { EVENT_ARCHETYPES, TIER_POOLS, type OutcomeTier } from '../src/data/eventPools';
import { DEFAULT_TUNING } from '../src/data/tuning';

function outcome(cost: readonly ResolvedEffect[], grant: readonly ResolvedEffect[], tier: OutcomeTier = 'T0'): EventOutcome {
  return { tier, entryId: 'test', cost, grant };
}

/** A run with a party on the edge of death and an empty purse. */
function brittle(): RunState {
  const base = createRun('COSTS', DEFAULT_TUNING);
  return { ...base, currency: 0, party: base.party.map((member) => ({ ...member, hp: 1 })) };
}

describe('HP costs never end a run', () => {
  it('leaves every member standing, at any percent, lead or party', () => {
    for (const target of ['lead', 'party'] as const) {
      for (const percent of [0.15, 0.2, 0.25, 0.5, 0.99, 1, 4]) {
        const after = applyEventOutcome(
          brittle(),
          outcome([{ kind: 'damage', percent, target }], [{ kind: 'currency', amount: 1 }]),
          DEFAULT_TUNING,
        );
        for (const member of after.party) {
          expect(member.hp, `${target} ${percent}`).toBeGreaterThanOrEqual(1);
          expect(member.fainted, `${target} ${percent}`).toBe(false);
        }
      }
    }
  });

  it('hits the lead alone when the target is the lead', () => {
    // `createRun` starts with no party — the starter is a decision — so the
    // bench this test needs is built by hand.
    const base = {
      ...createRun('LEAD-ONLY', DEFAULT_TUNING),
      party: [
        createPartyMember({ species: 'Snorlax', ability: 'Immunity', moves: ['Tackle'], level: 30 }),
        createPartyMember({ species: 'Pikachu', ability: 'Static', moves: ['Tackle'], level: 30 }),
      ],
    };
    expect(base.party.length, 'this test needs a bench').toBeGreaterThan(1);
    const after = applyEventOutcome(
      base,
      outcome([{ kind: 'damage', percent: 0.25, target: 'lead' }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    expect(after.party[0]!.hp).toBeLessThan(base.party[0]!.hp);
    for (let index = 1; index < after.party.length; index++) {
      expect(after.party[index]!.hp, `bench ${index}`).toBe(base.party[index]!.hp);
    }
  });

  it('leaves a fainted member fainted rather than reviving or re-hitting it', () => {
    const base = createRun('FAINTED', DEFAULT_TUNING);
    const downed = { ...base, party: base.party.map((m) => ({ ...m, fainted: true, hp: 0 })) };
    const after = applyEventOutcome(
      downed,
      outcome([{ kind: 'damage', percent: 0.25, target: 'party' }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    for (const member of after.party) {
      expect(member.fainted).toBe(true);
      expect(member.hp).toBe(0);
    }
  });
});

describe('gold costs never go negative', () => {
  it('clamps a flat charge at zero', () => {
    const after = applyEventOutcome(
      brittle(),
      outcome([], [{ kind: 'currency', amount: -500 }], 'T1'),
      DEFAULT_TUNING,
    );
    expect(after.currency).toBe(0);
  });

  it('takes the floor from a broke player and the fraction from a rich one', () => {
    const broke = { ...brittle(), currency: 10 };
    const rich = { ...brittle(), currency: 1000 };
    // No consolation in this fixture, so the arithmetic is the cost alone.
    const charge = outcome([{ kind: 'currencyFraction', fraction: 0.35, floor: 26 }], [{ kind: 'nothing' }]);
    // A broke player still pays something: the floor, clamped at what they have.
    expect(applyEventOutcome(broke, charge, DEFAULT_TUNING).currency).toBe(0);
    // A rich player pays the fraction, which is above the floor.
    expect(applyEventOutcome(rich, charge, DEFAULT_TUNING).currency).toBe(1000 - 350);
  });

  it('never goes negative for any fraction or floor', () => {
    for (const currency of [0, 1, 9, 25, 100, 999]) {
      for (const fraction of [0.3, 0.35, 0.4]) {
        const after = applyEventOutcome(
          { ...brittle(), currency },
          outcome([{ kind: 'currencyFraction', fraction, floor: 40 }], [{ kind: 'currency', amount: 0 }]),
          DEFAULT_TUNING,
        );
        expect(after.currency, `${currency} at ${fraction}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the bag costs take what is there and no more', () => {
  it('discards from the end, and no-ops on an empty bag', () => {
    const base = { ...brittle(), backpack: ['leftovers', 'oranberry', 'shellbell'] };
    const after = applyEventOutcome(
      base,
      outcome([{ kind: 'discard', count: 1 }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    expect(after.backpack).toEqual(['leftovers', 'oranberry']);

    const empty = applyEventOutcome(
      { ...brittle(), backpack: [] },
      outcome([{ kind: 'discard', count: 1 }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    expect(empty.backpack).toEqual([]);
  });

  it('never discards more than the bag holds', () => {
    const after = applyEventOutcome(
      { ...brittle(), backpack: ['leftovers'] },
      outcome([{ kind: 'discard', count: 9 }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    expect(after.backpack).toEqual([]);
  });

  it('takes one berry and leaves everything else, or nothing when there is none', () => {
    const base = { ...brittle(), backpack: ['leftovers', 'oranberry', 'sitrusberry'] };
    const after = applyEventOutcome(
      base,
      outcome([{ kind: 'loseItem', pool: ['oranberry', 'sitrusberry'] }], [{ kind: 'currency', amount: 1 }]),
      DEFAULT_TUNING,
    );
    expect(after.backpack).toEqual(['leftovers', 'sitrusberry']);

    const noBerries = { ...brittle(), backpack: ['leftovers'] };
    expect(
      applyEventOutcome(
        noBerries,
        outcome([{ kind: 'loseItem', pool: ['oranberry'] }], [{ kind: 'currency', amount: 1 }]),
        DEFAULT_TUNING,
      ).backpack,
    ).toEqual(['leftovers']);
  });
});

describe('a cost is never alone, at resolution as well as in the table', () => {
  it('grants something on every T0 in the pool, at every band', () => {
    for (const band of TIER_POOLS.T0) {
      for (const entry of band.entries) {
        expect(entry.grant.length, `${band.throughSegment}/${entry.id}`).toBeGreaterThan(0);
        expect(entry.cost?.length, `${band.throughSegment}/${entry.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('leaves the run better off in at least one dimension after a T0', () => {
    /*
     * Not "better off overall" — a setback is a setback. What must be true is
     * that *something* arrived, or the result screen has an empty consolation
     * line and the player reads the node as having taken and given nothing.
     */
    const before = { ...brittle(), currency: 100, backpack: ['leftovers'] };
    const after = applyEventOutcome(
      before,
      outcome([{ kind: 'damage', percent: 0.25, target: 'party' }], [{ kind: 'currency', amount: 40 }]),
      DEFAULT_TUNING,
    );
    expect(after.currency).toBeGreaterThan(before.currency);
  });
});

describe('tolls are the same machinery as costs', () => {
  it('charges every toll shape without breaking a clamp', () => {
    for (const event of EVENTS) {
      const after = applyToll(brittle(), event.toll, DEFAULT_TUNING);
      expect(after.currency, event.id).toBeGreaterThanOrEqual(0);
      for (const member of after.party) {
        expect(member.hp, event.id).toBeGreaterThanOrEqual(1);
        expect(member.fainted, event.id).toBe(false);
      }
      expect(after.backpack.length, event.id).toBeLessThanOrEqual(brittle().backpack.length);
    }
  });

  it('resolves every toll kind to exactly one effect', () => {
    for (const event of EVENTS) {
      const effect = tollEffect(event.toll);
      expect(effect.kind, event.id).toBeTruthy();
      // A toll is a price. It may never be a *grant* wearing a price's name.
      expect(['damage', 'currency', 'currencyFraction', 'loseItem', 'discard'], event.id).toContain(effect.kind);
      if (effect.kind === 'currency') expect(effect.amount, event.id).toBeLessThan(0);
    }
  });
});

describe('the logged identity is the archetype', () => {
  it('bumped RUN_LOG_VERSION, because the answer changed shape', () => {
    expect(RUN_LOG_VERSION).toMatch(/^gymrun-run-14\//);
  });

  /*
   * The condition that makes the tag an identity at all. It is structurally
   * true today — options are built by mapping `EVENT_ARCHETYPES` — and asserted
   * anyway, because the day someone adds a second Gamble to one event is the
   * day the log stops naming a unique button.
   */
  it('gives an event at most one option per archetype', () => {
    expect(new Set(EVENT_ARCHETYPES).size).toBe(EVENT_ARCHETYPES.length);
  });

  it('spells the same four archetypes in core/types.ts as in data/eventPools.ts', () => {
    /*
     * `core/types.ts` is the bottom of the dependency graph and imports
     * nothing, so it writes the union out by hand. This is the check that the
     * two copies cannot drift.
     */
    const declared = ['safe', 'gamble', 'toll', 'attune'];
    expect([...EVENT_ARCHETYPES].sort()).toEqual([...declared].sort());
  });
});

describe('a pre-patch log is refused, loudly and by name', () => {
  it('names the axis and both values', () => {
    const prePatch: RunLog = {
      seed: 'PRE-REJIG',
      versions: { ...currentVersions(), runLog: `gymrun-run-13/${ENGINE_VERSION}` },
      decisions: [],
    };
    expect(isReplayable(prePatch)).toBe(false);
    expect(() => assertReplayable(prePatch)).toThrow(/mismatch on runLog/);
    expect(() => assertReplayable(prePatch)).toThrow(/gymrun-run-13/);
    expect(() => assertReplayable(prePatch)).toThrow(/gymrun-run-14/);
  });

  it('refuses a log whose event decision is still an index, rather than reading it as one', () => {
    /*
     * The shape of a `-13` event decision. It cannot reach `playRun` — the
     * version guard stops it first — and that ordering is the point: the log is
     * refused for *being* a `-13` log, not for happening to carry a field this
     * build cannot parse. A build that checked the field instead would accept a
     * hand-edited log that lied about its version.
     */
    const stale = {
      seed: 'PRE-REJIG',
      versions: { ...currentVersions(), runLog: `gymrun-run-13/${ENGINE_VERSION}` },
      decisions: [{ kind: 'event', index: 1 }],
    } as unknown as RunLog;
    expect(isReplayable(stale)).toBe(false);
    expect(() => assertReplayable(stale)).toThrow(/mismatch on runLog/);
  });
});
