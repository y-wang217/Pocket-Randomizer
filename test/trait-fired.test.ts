/**
 * A trait fired on the panel. **Stage 4.11 Tier 4, D48 and section 6 steps 3
 * and 7.**
 *
 * @vitest-environment jsdom
 *
 * The ability's name pulses in its slot the beat the engine says it fired,
 * one keyframe for every ability; a berry's sprite pops in the slot's ghost
 * and the ghost is emptied at the next update. And the opening batch, where
 * most of both land, is shown when it did something and silent when it did
 * not.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle, movePriority, type BattleSession } from '../src/core/battle/driver';
import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { buildBattleUiView } from '../src/core/battle/view';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { abnormalityMarks, firedTraits } from '../src/ui/abnormality';
import { createScene } from '../src/ui/scene';
import { createBattleScreen } from '../src/ui/screens/battle';
import { resetSettings } from '../src/ui/settings';

const REVEAL = { ability: true, item: true, teamSize: true };
const FLAGS: FlagDeps = { priorityOf: movePriority };

function mon(species: string, ability: string, item?: string): PokemonSpec {
  return { species, ability, moves: ['Tackle'], level: 50, ...(item ? { item } : {}) };
}

function view(session: BattleSession) {
  return buildBattleUiView(session.factsFor('p1'), REVEAL, abilityEffects);
}

beforeEach(() => {
  resetSettings();
});

describe('the scene, handed a fire', () => {
  it('pulses the ability slot on the side that fired, in its slot, and clears it next update', () => {
    const session = createBattle({ teams: { p1: [mon('Snorlax', 'Thick Fat')], p2: [mon('Golem', 'Sturdy')] }, seed: 'FIRE-1' });
    const scene = createScene();
    scene.update(view(session), () => undefined);
    scene.update(view(session), () => undefined, undefined, [], [{ side: 'p2', what: 'ability', slot: 2 }]);
    const foe = scene.root.querySelector('.panel--foe .panel__traits') as HTMLElement;
    const me = scene.root.querySelector('.panel--me .panel__traits') as HTMLElement;
    expect(foe.dataset['fired']).toBe('true');
    expect(foe.dataset['firedSlot']).toBe('2');
    expect(me.dataset['fired']).toBeUndefined();
    scene.update(view(session), () => undefined);
    expect(foe.dataset['fired']).toBeUndefined();
    expect(foe.dataset['firedSlot']).toBeUndefined();
  });

  it('pops the berry in the ghost, cloned before the redraw took it, and empties the ghost after', () => {
    const session = createBattle({ teams: { p1: [mon('Snorlax', 'Thick Fat', 'Sitrus Berry')], p2: [mon('Golem', 'Sturdy')] }, seed: 'FIRE-2' });
    const scene = createScene();
    scene.update(view(session), () => undefined);
    const slot = scene.root.querySelector('.panel--me .panel__item') as HTMLElement;
    const ghost = scene.root.querySelector('.panel--me .panel__item-ghost') as HTMLElement;
    expect(slot.firstElementChild).not.toBeNull();
    scene.update(view(session), () => undefined, undefined, [], [{ side: 'p1', what: 'item', slot: 1 }]);
    expect(ghost.dataset['fired']).toBe('true');
    expect(ghost.firstElementChild?.className).toBe(slot.firstElementChild?.className);
    scene.update(view(session), () => undefined);
    expect(ghost.dataset['fired']).toBeUndefined();
    expect(ghost.childElementCount).toBe(0);
  });

  it('pops nothing when the slot held nothing to pop', () => {
    const session = createBattle({ teams: { p1: [mon('Snorlax', 'Thick Fat')], p2: [mon('Golem', 'Sturdy')] }, seed: 'FIRE-3' });
    const scene = createScene();
    scene.update(view(session), () => undefined);
    scene.update(view(session), () => undefined, undefined, [], [{ side: 'p1', what: 'item', slot: 1 }]);
    const ghost = scene.root.querySelector('.panel--me .panel__item-ghost') as HTMLElement;
    expect(ghost.dataset['fired']).toBeUndefined();
  });
});

describe('the opening batch', () => {
  function nodeFor(foe: TeamSpec, seed: string): NodeSpec {
    return {
      id: 's1-1-0',
      kind: 'trainer',
      tier: 'normal',
      label: 'Trainer battle',
      encounter: { team: foe, opponent: `Trainer's ${foe[0]?.species ?? ''}`, simSeed: seed as never },
      rewards: [],
    } as unknown as NodeSpec;
  }

  function attach(p1: TeamSpec, p2: TeamSpec, seed: string): HTMLElement {
    const session = createBattle({ teams: { p1, p2 }, seed });
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);
    screen.attach(session, nodeFor(p2, seed), REVEAL, () => undefined, 1);
    return screen.root;
  }

  it('shows a lead Drizzle: the field sweep on the actor, the pulse on its panel, the word on the strip', () => {
    const root = attach([mon('Snorlax', 'Thick Fat')], [mon('Pelipper', 'Drizzle')], 'OPEN-1');
    expect(root.querySelector('.stage__actor--foe')?.getAttribute('data-abnormal')).toBe('field');
    expect(root.querySelector('.panel--foe .panel__traits')?.getAttribute('data-fired')).toBe('true');
    expect(root.querySelector('.flags')?.textContent).toContain('Rain');
    // And no lunge: nothing was chosen.
    expect(root.querySelector('.stage__actor--foe')?.getAttribute('data-acted')).toBeNull();
    expect(root.querySelector('.stage__actor--me')?.getAttribute('data-acted')).toBeNull();
  });

  it('stays silent on a plain start', () => {
    const root = attach([mon('Snorlax', 'Thick Fat')], [mon('Golem', 'Sturdy')], 'OPEN-2');
    expect(root.querySelector('.stage__actor--foe')?.getAttribute('data-abnormal')).toBeNull();
    expect(root.querySelector('.panel--foe .panel__traits')?.getAttribute('data-fired')).toBeNull();
    expect((root.querySelector('.flags__words')?.textContent ?? '').trim()).toBe('');
  });

  it('agrees with the reducers it is built from', () => {
    const session = createBattle({ teams: { p1: [mon('Snorlax', 'Thick Fat')], p2: [mon('Pelipper', 'Drizzle')] }, seed: 'OPEN-1' });
    const turns = readFlags(session.protocolFor('p1'), FLAGS);
    expect(abnormalityMarks(turns).map((mark) => mark.klass)).toEqual(['field']);
    expect(firedTraits(turns)).toEqual([{ side: 'p2', what: 'ability', slot: 2 }]);
  });
});
