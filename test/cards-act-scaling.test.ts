/**
 * Checkpoint 6 (`docs/spec/gymrun-card-run-shapes-prompt.md`): enemies scale
 * by act. Every enemy of an act's fights gains HP (+1 in act 2, +2 in act 3,
 * bosses included); act 2's lead waves and every wave of act 3 field the
 * veterans, harder patterns on the same bodies; and the Warlord is act 2's
 * boss, so the Colossus is not all three.
 */
import { describe, expect, it } from 'vitest';

import { ACTS, STARTING_DECK } from '../src/cardData/cardrunTables';
import { ACT_SCALING, ENCOUNTERS, VETERAN } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { actCanDamage } from '../src/core/cards/enemies';
import { createBattle, layoutBattle, wavesOf } from '../src/core/cards/create';
import type { ActRule, EnemyDefId } from '../src/core/cards/defs';
import { viewOf } from '../src/core/cards/view';
import { step } from '../src/core/cards/step';
import { iidOf } from './fixtures/card-battle';

const damagingSteps = (id: EnemyDefId): number => ENEMIES[id].script.steps.filter((s) => actCanDamage(s.act)).length / ENEMIES[id].script.steps.length;

describe('the veterans', () => {
  it('give each plain enemy a harder pattern on the same kind of body', () => {
    for (const [plain, vet] of Object.entries(VETERAN) as [EnemyDefId, EnemyDefId][]) {
      const a = ENEMIES[plain];
      const b = ENEMIES[vet];
      expect(b, vet).toBeDefined();
      expect(b.boss, vet).toBeUndefined();
      expect(b.fast === true, vet).toBe(a.fast === true);
      expect(b.hp + b.baseShield, vet).toBeGreaterThanOrEqual(a.hp + a.baseShield);
      expect(b.grade, vet).toBeGreaterThanOrEqual(a.grade);
      // Harder: a larger share of its steps hits, or its biggest hit is bigger.
      const hit = (act: ActRule): number =>
        'if' in act ? Math.max(hit(act.then), hit(act.else)) : act.k === 'strike' || act.k === 'pierce' || act.k === 'slash' ? act.n : 0;
      const biggest = (id: EnemyDefId) => Math.max(...ENEMIES[id].script.steps.map((s) => hit(s.act)));
      expect(damagingSteps(vet) > damagingSteps(plain) || biggest(vet) > biggest(plain), vet).toBe(true);
    }
  });
});

describe('the acts', () => {
  it('add HP by act and field veterans in act 2’s lead waves and all of act 3', () => {
    ACTS.forEach((act, index) => {
      const scale = ACT_SCALING[index]!;
      for (const id of [...act.fights, act.boss, ...act.townQuests, ...act.defenseQuests]) {
        const fight = ENCOUNTERS[id]!;
        expect(fight.hpBonus ?? 0, id).toBe(scale.hpBonus);
        const waves = wavesOf(fight);
        const vets = waves.map((w) => w.some((s) => Object.values(VETERAN).includes(s.def)));
        if (scale.veterans === 'none') expect(vets.some(Boolean), id).toBe(false);
        if (scale.veterans === 'all') {
          for (const wave of waves) for (const s of wave) expect(Object.keys(VETERAN), `${id} ${s.def}`).not.toContain(s.def);
        }
        if (scale.veterans === 'leads' && id !== act.boss) expect([vets[0], vets[1]], id).toEqual([true, true]);
      }
    });
  });

  it('lays a battle out with the act’s HP, the max included, and the view and the stalk read it', () => {
    const created = createBattle('run-siege', 'SCALE', { cards: [...STARTING_DECK] });
    if (!created.ok) throw new Error('create');
    const s = created.state;
    for (const e of s.enemies) {
      expect(e.hp, e.id).toBe(ENEMIES[e.def].hp + 2);
      expect(e.maxHp, e.id).toBe(e.hp);
    }
    expect(viewOf(s).enemies.map((e) => e.maxHp)).toEqual(s.enemies.filter((e) => e.wave === 0).map((e) => e.maxHp));
    // The sandbox's own scenarios are unscaled.
    const plain = createBattle('siege', 'SCALE');
    if (!plain.ok) throw new Error('create');
    for (const e of plain.state.enemies) expect(e.maxHp, e.id).toBe(ENEMIES[e.def].hp);
  });
});

describe('the Warlord', () => {
  it('is act 2’s boss, one tile, and stands against Push and Stun as a boss does', () => {
    expect(ACTS[1]!.boss).toBe('run-warlord-guard');
    expect(ACTS.map((a) => a.boss)).toEqual(['run-colossus-lair', 'run-warlord-guard', 'run-siege']);
    expect(ENEMIES.warlord).toMatchObject({ boss: true });
    expect(ENEMIES.warlord.size).toBeUndefined();

    const state = layoutBattle('warlord-guard', 'WARLORD', { cards: ['concuss', ...STARTING_DECK] })!;
    const iid = iidOf(state, 'concuss');
    state.piles.draw = state.piles.draw.filter((c) => c !== iid);
    state.piles.hand.push(iid);
    state.mp = 15;
    for (const e of state.enemies) e.intent = null;
    // The Gunner's lane is the Warlord's.
    const selected = step(state, { type: 'select', card: iid, unit: 'B' });
    if (!selected.ok) throw new Error(selected.reason);
    const committed = step(selected.state, { type: 'commit' });
    if (!committed.ok) throw new Error(committed.reason);
    const warlord = state.enemies.find((e) => e.def === 'warlord')!;
    expect(committed.events.some((e) => e.t === 'damaged' && e.target === warlord.id)).toBe(true);
    expect(committed.events.some((e) => e.t === 'stunned')).toBe(false);
  });
});
