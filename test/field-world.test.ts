/**
 * The world wears the weather. **Stage 4.11 Tier 3, D47.**
 *
 * @vitest-environment jsdom
 *
 * `applyField` writes the board's state onto `<html>` the way `applyLocale`
 * writes the region; the battle screen writes it on every update and clears
 * it on detach; the world scene carries the layer the stylesheet paints. What
 * the paint looks like is the browser suite's question (`visual-field`).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { createWorldScene } from '../src/ui/scene';
import { createBattleScreen } from '../src/ui/screens/battle';
import { resetSettings } from '../src/ui/settings';
import { applyField, currentField, SUPPRESSED_ATTRIBUTE, TERRAIN_ATTRIBUTE, WEATHER_ATTRIBUTE } from '../src/ui/theme/field';

const REVEAL = { ability: true, item: true, teamSize: true };

function mon(species: string, ability: string): PokemonSpec {
  return { species, ability, moves: ['Tackle'], level: 50 };
}

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

function attach(p1: TeamSpec, p2: TeamSpec, seed = 'FIELD-T3'): () => void {
  const session = createBattle({ teams: { p1, p2 }, seed });
  const screen = createBattleScreen();
  document.body.replaceChildren(screen.root);
  return screen.attach(session, nodeFor(p2, seed), REVEAL, () => undefined, 1);
}

beforeEach(() => {
  resetSettings();
  applyField(null);
});

describe('applyField', () => {
  it('writes the kinds, not the ids, and clears with null', () => {
    const root = document.createElement('div');
    applyField({ weather: { id: 'desolateland', kind: 'sun' }, terrain: { id: 'grassyterrain', kind: 'grassy' }, suppressed: false }, root);
    expect(root.getAttribute(WEATHER_ATTRIBUTE)).toBe('sun');
    expect(root.getAttribute(TERRAIN_ATTRIBUTE)).toBe('grassy');
    expect(root.hasAttribute(SUPPRESSED_ATTRIBUTE)).toBe(false);
    applyField(null, root);
    expect(root.hasAttribute(WEATHER_ATTRIBUTE)).toBe(false);
    expect(root.hasAttribute(TERRAIN_ATTRIBUTE)).toBe(false);
    expect(currentField(root)).toEqual({ weather: null, terrain: null, suppressed: false });
  });

  it('marks a suppressed weather, and only with a weather to suppress', () => {
    const root = document.createElement('div');
    applyField({ weather: { id: 'raindance', kind: 'rain' }, terrain: null, suppressed: true }, root);
    expect(root.getAttribute(SUPPRESSED_ATTRIBUTE)).toBe('true');
    applyField({ weather: null, terrain: null, suppressed: true }, root);
    expect(root.hasAttribute(SUPPRESSED_ATTRIBUTE)).toBe(false);
  });
});

describe('the battle screen and the world', () => {
  it('writes the field from the opening batch, and clears it on detach', () => {
    const detach = attach([mon('Pelipper', 'Drizzle')], [mon('Tapu Koko', 'Electric Surge')]);
    expect(currentField()).toEqual({ weather: 'rain', terrain: 'electric', suppressed: false });
    detach();
    expect(currentField()).toEqual({ weather: null, terrain: null, suppressed: false });
  });

  it('writes nothing for a board with nothing on it', () => {
    const detach = attach([mon('Snorlax', 'Thick Fat')], [mon('Golem', 'Sturdy')]);
    expect(document.documentElement.hasAttribute(WEATHER_ATTRIBUTE)).toBe(false);
    detach();
  });

  it('says when the weather is being held off', () => {
    const detach = attach([mon('Pelipper', 'Drizzle')], [mon('Golduck', 'Cloud Nine')]);
    expect(currentField()).toEqual({ weather: 'rain', terrain: null, suppressed: true });
    detach();
  });

  it('mounts the weather layer over the art and under the scrim', () => {
    const world = createWorldScene(null);
    const order = [...world.root.children].map((child) => child.className);
    expect(order).toEqual([
      'world__layer world__layer--far',
      'world__layer world__layer--mid',
      'world__layer world__layer--near',
      'world__weather',
      'world__scrim',
    ]);
    world.destroy();
  });
});
