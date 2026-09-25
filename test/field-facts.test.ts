/**
 * The weather and terrain on the board, as facts. **Stage 4.11, Tier 1.**
 *
 * Headless, off a real battle: a lead whose ability sets the weather on
 * switch-in is how every weather in this game starts (the Tier 0 census found
 * no other source in 982 battles), so that is the fixture. The projection is
 * asserted through `buildBattleUiView`, the same call the screen makes.
 */
import { Dex } from '@pkmn/sim';
import { describe, expect, it } from 'vitest';
import { abilityEffects } from '../src/data/abilityEffects';
import { createBattle } from '../src/core/battle/driver';
import { GYMRUN_GEN } from '../src/core/battle/format';
import { buildBattleUiView, fieldKindOf } from '../src/core/battle/view';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { FIELD_EFFECTS, FIELD_NAMES, fieldEffect, fieldName } from '../src/data/fieldCopy';

const REVEAL = { ability: true, item: true, teamSize: true };

function mon(species: string, ability: string): PokemonSpec {
  return { species, ability, moves: ['Tackle'], level: 50 };
}

function facts(p1: TeamSpec, p2: TeamSpec, seed = 'FIELD-T1') {
  return createBattle({ teams: { p1, p2 }, seed }).factsFor('p1');
}

describe('the board state, off the sim', () => {
  it('reports nothing when nothing is set', () => {
    const field = facts([mon('Snorlax', 'Thick Fat')], [mon('Golem', 'Sturdy')]).field;
    expect(field).toEqual({ weather: null, terrain: null, suppressed: false });
  });

  it('reports the weather a lead ability set on switch-in, by the sim id', () => {
    const field = facts([mon('Pelipper', 'Drizzle')], [mon('Golem', 'Sturdy')]).field;
    expect(field.weather).toBe('raindance');
    expect(field.terrain).toBeNull();
    expect(field.suppressed).toBe(false);
  });

  it('reports a terrain the same way, and the two together', () => {
    const field = facts([mon('Pelipper', 'Drizzle')], [mon('Tapu Koko', 'Electric Surge')]).field;
    expect(field.weather).toBe('raindance');
    expect(field.terrain).toBe('electricterrain');
  });

  it('says when an ability is holding the weather off, and the weather is still there', () => {
    const field = facts([mon('Pelipper', 'Drizzle')], [mon('Golduck', 'Cloud Nine')]).field;
    expect(field.weather).toBe('raindance');
    expect(field.suppressed).toBe(true);
  });

  it('is the same fact from both sides: weather is public', () => {
    const session = createBattle({ teams: { p1: [mon('Pelipper', 'Drizzle')], p2: [mon('Golem', 'Sturdy')] }, seed: 'FIELD-T1' });
    expect(session.factsFor('p2').field).toEqual(session.factsFor('p1').field);
  });
});

describe('the board state, projected', () => {
  it('gives each id its mark and carries no word', () => {
    const view = buildBattleUiView(facts([mon('Pelipper', 'Drizzle')], [mon('Tapu Koko', 'Electric Surge')]), REVEAL, abilityEffects);
    expect(view.field).toEqual({
      weather: { id: 'raindance', kind: 'rain' },
      terrain: { id: 'electricterrain', kind: 'electric' },
      suppressed: false,
    });
    expect(JSON.stringify(view.field)).not.toMatch(/Rain|Electric Terrain/);
  });

  it('projects an empty board as two nulls', () => {
    const view = buildBattleUiView(facts([mon('Snorlax', 'Thick Fat')], [mon('Golem', 'Sturdy')]), REVEAL, abilityEffects);
    expect(view.field).toEqual({ weather: null, terrain: null, suppressed: false });
  });
});

describe('the nine marks cover what the engine can set', () => {
  const conditions = Dex.forGen(GYMRUN_GEN).conditions;
  const ids = Object.keys(Dex.forGen(GYMRUN_GEN).data.Conditions ?? {}).filter((id) => {
    const effectType = conditions.get(id).effectType;
    return effectType === 'Weather' || effectType === 'Terrain';
  });

  it('finds the dex weathers and terrains', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  it.each(ids)('has a mark, a name and an effect line for %s', (id) => {
    expect(fieldKindOf(id)).not.toBeNull();
    expect(FIELD_NAMES[id], `name for ${id}`).toBeDefined();
    expect(FIELD_EFFECTS[id], `effect for ${id}`).toBeDefined();
  });

  it('shares the rain and sun marks with the primal weathers, and gives strong winds its own', () => {
    expect(fieldKindOf('primordialsea')).toBe('rain');
    expect(fieldKindOf('desolateland')).toBe('sun');
    expect(fieldKindOf('deltastream')).toBe('wind');
    expect(fieldName('primordialsea')).not.toBe(fieldName('raindance'));
  });

  it('never returns nothing for a word, and nothing rather than a guess for an effect', () => {
    expect(fieldName('unknownweather')).toBe('unknownweather');
    expect(fieldEffect('unknownweather')).toBeNull();
  });

  it('says nothing that judges', () => {
    for (const line of Object.values(FIELD_EFFECTS)) {
      expect(line).not.toMatch(/\b(strong|weak|good|bad|better|worse|best|worst|should)\b/i);
    }
  });
});
