/**
 * The ability-effects table, checked against the engine over the whole pool.
 *
 * `data/abilityEffects.ts` was derived by reading the gen 9 dex's event
 * handlers, and that method has a hole: **Levitate has no handler**. Its Ground
 * immunity is a hardcoded branch in `Pokemon#isGrounded`, so introspection
 * finds every absorbing ability in the game except the one every player knows
 * by name. A table built that way would have shipped a battle screen that shows
 * `2x` on an Earthquake aimed at a Levitating Rhydon.
 *
 * So the table is not trusted on the strength of how it was written. This file
 * sweeps every ability the randomizer can draw through the engine itself, and
 * fails if any of them grants an immunity the display does not know about. It
 * is the same argument as `test/stats.test.ts`: a transcription is worth what
 * the thing checking it is worth.
 *
 * The property is one-directional on purpose. **Whenever the engine says a hit
 * does nothing, the badge must say `0x`.** The reverse — a table entry with no
 * engine immunity behind it — would be a display that under-promises, which is
 * a bug worth catching but not the one that destroys trust.
 */
import { describe, expect, it } from 'vitest';

import { moveFlags, probeAbilityImmunities, REPRESENTATIVE_MOVES, typeMultiplier } from '../src/core/battle/driver';
import { applyAbilityEffects } from '../src/core/battle/view';
import { ABILITY_POOL } from '../src/data/abilities';
import { abilityEffects, ABILITY_EFFECTS } from '../src/data/abilityEffects';
import { BLACKLISTED_ABILITIES } from '../src/data/blacklists';

/** Dex id form: lowercase, letters and digits only. Matches `Dex#abilities.get().id`. */
function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Every ability a run can actually put on the field. */
const DRAWABLE = ABILITY_POOL.map(toId).filter((id) => !BLACKLISTED_ABILITIES.map(toId).includes(id));

const TYPES = Object.keys(REPRESENTATIVE_MOVES);

describe('the ability pool', () => {
  it('is large enough for this sweep to mean something', () => {
    expect(DRAWABLE.length).toBeGreaterThan(200);
    expect(TYPES.length).toBe(18);
  });
});

describe('ability immunities, against the engine', () => {
  /**
   * The sweep. Every drawable ability, every damaging type.
   *
   * The probe defender starts as a pure Fire type, which is immune to nothing
   * on the chart, so an immunity reported against those types came from the
   * ability rather than from the typing. `probe.types` is read back rather than
   * assumed because a handful of abilities — Imposter above all — change what
   * the defender *is* on switch-in.
   *
   * The displayed multiplier starts at the naive chart value for those live
   * types and is then run through the table; if the engine blocks the hit, the
   * number on the button has to be zero.
   */
  it('never leaves an engine immunity showing as a hit', () => {
    const missing: string[] = [];

    for (const id of DRAWABLE) {
      const probe = probeAbilityImmunities(id);
      if (probe.blocked.length === 0) continue;

      for (const type of probe.blocked) {
        /*
         * The naive chart value against the defender's *live* types, and the
         * move's *real* flags — both read from the same dex the battle screen
         * reads, rather than assumed here.
         *
         * The first cut of this test hardcoded both and reported three
         * failures, none of which were table gaps: Energy Ball and Sludge Bomb
         * are `bullet` moves, so a hand-written flag list missed two thirds of
         * what Bulletproof stops, and Imposter had turned the Fire-type probe
         * into a Normal-type Ditto whose Ghost immunity came from the chart.
         * Asking the dex is both shorter and correct.
         */
        const naive = typeMultiplier(type, probe.types);
        const flags = moveFlags(REPRESENTATIVE_MOVES[type] ?? '');
        const shown = applyAbilityEffects(naive, type, flags, abilityEffects(id));
        if (shown !== 0) missing.push(`${id} blocks ${type} but the badge shows ${shown}x`);
      }
    }

    expect(missing).toEqual([]);
  });

  /**
   * Levitate by name, because it is the case the derivation missed and a
   * regression here would be silent in the sweep above if the pool ever changed.
   */
  it('knows about Levitate specifically', () => {
    expect(probeAbilityImmunities('levitate').blocked).toContain('Ground');
    expect(applyAbilityEffects(2, 'Ground', [], abilityEffects('levitate'))).toBe(0);
  });

  /** And the absorbing abilities that *do* have handlers, so both paths are live. */
  it('knows about the handler-based absorbers', () => {
    expect(probeAbilityImmunities('voltabsorb').blocked).toContain('Electric');
    expect(probeAbilityImmunities('waterabsorb').blocked).toContain('Water');
    expect(probeAbilityImmunities('flashfire').blocked).toContain('Fire');
    expect(probeAbilityImmunities('sapsipper').blocked).toContain('Grass');
    expect(probeAbilityImmunities('eartheater').blocked).toContain('Ground');
  });
});

describe('the table itself', () => {
  it('is keyed by dex id, not by display name', () => {
    for (const key of Object.keys(ABILITY_EFFECTS)) {
      expect(key, `${key} is not in dex-id form`).toBe(toId(key));
    }
  });

  /**
   * Every entry names an ability that can actually be drawn.
   *
   * A table entry for something outside the pool is dead weight that reads as
   * coverage — the sweep above cannot catch it, because it only ever asks about
   * abilities a run can produce.
   */
  it('has no entry for an ability the randomizer cannot draw', () => {
    const drawable = new Set(DRAWABLE);
    const orphans = Object.keys(ABILITY_EFFECTS).filter((id) => !drawable.has(id));
    expect(orphans).toEqual([]);
  });
});
