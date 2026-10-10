/**
 * Opening grace and Fast
 * (`docs/spec/gymrun-patch-card-battle-grace-friendly-fire.md` A1). A
 * non-Fast enemy opens on a step that deals no damage, a Fast one on its
 * first damaging step, and neither moves a spawn tile or a card of the
 * shuffle.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { createBattle } from '../src/core/cards/create';
import type { ActRule, EnemyDef } from '../src/core/cards/defs';
import { actCanDamage, openingSteps } from '../src/core/cards/enemies';
import { begun } from './fixtures/card-battle';

const rules = RULES as { openingGrace: boolean };
afterEach(() => {
  rules.openingGrace = true;
});

/** Every act an act rule can resolve to. */
function acts(act: ActRule): Exclude<ActRule, { if: unknown }>[] {
  return 'if' in act ? [...acts(act.then), ...acts(act.else)] : [act];
}

describe('opening grace and Fast', () => {
  it('ships every non-Fast enemy with a step that deals no damage, and every Fast enemy with an attack for 1', () => {
    for (const def of Object.values(ENEMIES)) {
      const steps = def.script.steps;
      if (def.fast) {
        expect(steps.some((s) => actCanDamage(s.act)), `${def.id} is Fast with no damaging step`).toBe(true);
        for (const s of steps) {
          for (const act of acts(s.act)) if (act.k !== 'none' && act.k !== 'shield') expect(act.n, `${def.id} is Fast and hits for ${act.n}`).toBe(1);
        }
      } else {
        expect(steps.some((s) => !actCanDamage(s.act)), `${def.id} has no step that deals no damage`).toBe(true);
      }
    }
  });

  it('counts a conditional act as damage when either branch deals it', () => {
    expect(actCanDamage({ k: 'none' })).toBe(false);
    expect(actCanDamage({ k: 'shield', n: 1 })).toBe(false);
    expect(actCanDamage({ k: 'strike', n: 1 })).toBe(true);
    expect(actCanDamage({ if: 'slashInRange', then: { k: 'slash', n: 1 }, else: { k: 'shield', n: 1 } })).toBe(true);
    expect(actCanDamage({ if: 'slashInRange', then: { k: 'none' }, else: { k: 'shield', n: 1 } })).toBe(false);
  });

  it('rolls a starting step among the non-damaging steps under grace, and among every step without it', () => {
    expect(openingSteps(ENEMIES.drone)).toEqual([1, 3, 5]);
    expect(openingSteps(ENEMIES.lancer)).toEqual([0, 1]);
    rules.openingGrace = false;
    expect(openingSteps(ENEMIES.drone)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(openingSteps(ENEMIES.lancer)).toEqual([0, 1, 2]);
  });

  it('starts a Fast enemy on its first damaging step, grace or not', () => {
    const fast: EnemyDef = {
      ...ENEMIES.lancer,
      fast: true,
      script: { kind: 'cycle', steps: [{ move: 'none', act: { k: 'none' } }, { move: 'hunt', act: { k: 'strike', n: 1 } }, { move: 'none', act: { k: 'pierce', n: 1 } }] },
    };
    expect(openingSteps(fast)).toEqual([1]);
    rules.openingGrace = false;
    expect(openingSteps(fast)).toEqual([1]);
  });

  it('moves no spawn tile and no card of the shuffle: grace changes the starting steps and nothing else drawn', () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      for (let i = 0; i < 50; i++) {
        rules.openingGrace = true;
        const on = createBattle(id, `GRACE${i}`);
        rules.openingGrace = false;
        const off = createBattle(id, `GRACE${i}`);
        if (!on.ok || !off.ok) throw new Error('create');
        expect(on.state.rngDraws, id).toBe(off.state.rngDraws);
        expect(on.state.enemies.map((e) => e.pos), id).toEqual(off.state.enemies.map((e) => e.pos));
        expect(on.state.piles, id).toEqual(off.state.piles);
      }
    }
  });

  it('over 500 seeds of every scenario, no non-Fast enemy telegraphs damage in round 1', () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      for (let i = 0; i < 500; i++) {
        const { state } = begun(id, `OPEN${i}`);
        for (const enemy of state.enemies) {
          // A later wave's enemies open on their own Start (test/cards-waves.test.ts).
          if (ENEMIES[enemy.def].fast || enemy.wave !== state.wave) continue;
          const act = enemy.intent!.act;
          expect(act === 'none' || act === 'shield', `${id} seed OPEN${i}: ${enemy.id} ${enemy.def} opens on ${act}`).toBe(true);
        }
      }
    }
  });

  it('opens every starting step it may: each one turns up over 500 seeds', () => {
    for (const id of Object.keys(ENCOUNTERS)) {
      const seen = new Map<string, Set<number>>();
      for (let i = 0; i < 500; i++) {
        const created = createBattle(id, `ROLL${i}`);
        if (!created.ok) throw new Error('create');
        for (const e of created.state.enemies) seen.set(e.def, (seen.get(e.def) ?? new Set()).add(e.step));
      }
      for (const [def, steps] of seen) expect([...steps].sort(), `${id} ${def}`).toEqual(openingSteps(ENEMIES[def as keyof typeof ENEMIES]));
    }
  });
});
