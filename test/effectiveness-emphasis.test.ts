/**
 * The lit and greyed forecast, on the move bar and on the bench. **The
 * effectiveness emphasis patch, bible D91 and D92.**
 *
 * @vitest-environment jsdom
 *
 * Driven from a real battle, so the bench's forecast is the adapter's chart
 * and the projection's helper, never a fixture agreeing with itself.
 */
import { describe, expect, it } from 'vitest';

import { createBattle } from '../src/core/battle/driver';
import { buildBattleUiView, type RevealPolicy } from '../src/core/battle/view';
import type { TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { createScene } from '../src/ui/scene';

const REVEAL_ALL: RevealPolicy = { ability: true, item: true, teamSize: true };

// The lead has one super effective move on Charmander (Water Gun), one
// neutral (Tackle), one resisted (Vine Whip) and one status (Growl).
// The bench member has one of each band against the same Charmander.
const PLAYER: TeamSpec = [
  { species: 'Squirtle', ability: 'Torrent', moves: ['Water Gun', 'Tackle', 'Vine Whip', 'Growl'], level: 20 },
  { species: 'Geodude', ability: 'Sturdy', moves: ['Rock Throw', 'Tackle', 'Defense Curl'], level: 20 },
  { species: 'Pidgey', ability: 'Keen Eye', moves: ['Gust', 'Tackle'], level: 20 },
];
const FOE: TeamSpec = [{ species: 'Charmander', ability: 'Blaze', moves: ['Scratch'], level: 20 }];
// A foe nothing on the lead's bar is super effective against.
const NORMAL_FOE: TeamSpec = [{ species: 'Rattata', ability: 'Run Away', moves: ['Tackle'], level: 20 }];

function view(foe: TeamSpec) {
  const session = createBattle({ teams: { p1: PLAYER, p2: foe }, seed: 'D91' });
  return buildBattleUiView(session.factsFor('p1'), REVEAL_ALL, abilityEffects);
}

describe('the bench forecast (D92)', () => {
  it('forecasts every benched member’s moves against the Pokemon on the field', () => {
    const ui = view(FOE);
    const geodude = ui.switches.find((member) => member.species === 'Geodude')!;
    const bands = Object.fromEntries(geodude.forecast.map((move) => [move.name, move.band]));
    expect(bands).toEqual({ 'Rock Throw': 'super', Tackle: 'neutral', 'Defense Curl': null });
    expect(geodude.forecast.find((move) => move.name === 'Rock Throw')!.effectiveness).toBe(2);
  });

  it('gives the active member no forecast of its own', () => {
    const ui = view(FOE);
    expect(ui.switches.find((member) => member.block === 'active')?.forecast ?? []).toEqual([]);
  });
});

describe('the scene (D91, D92)', () => {
  it('lights the super effective move and greys the other damaging moves, never a status move', () => {
    const scene = createScene();
    scene.update(view(FOE), () => undefined);
    const bar = scene.root.querySelector<HTMLElement>('.moves')!;
    expect(bar.dataset['hasSuper']).toBe('true');
    const byName = (name: string) =>
      [...bar.querySelectorAll<HTMLElement>('.move')].find((button) => button.querySelector('.move__name')?.textContent?.startsWith(name))!;
    expect(byName('Water Gun').dataset['effect']).toBe('super');
    expect(byName('Tackle').dataset['damaging']).toBe('true');
    expect(byName('Vine Whip').dataset['damaging']).toBe('true');
    expect(byName('Growl').dataset['damaging']).toBeUndefined();
  });

  it('greys nothing when no move on the bar is super effective (R4)', () => {
    const scene = createScene();
    scene.update(view(NORMAL_FOE), () => undefined);
    expect(scene.root.querySelector<HTMLElement>('.moves')!.dataset['hasSuper']).toBeUndefined();
  });

  it('draws each bench row’s damaging moves, edged, inert, lit per member', () => {
    const scene = createScene();
    scene.update(view(FOE), () => undefined);
    const rows = [...scene.root.querySelectorAll<HTMLElement>('.bench__member')];
    const geodude = rows.find((row) => row.querySelector('.bench__name')?.textContent === 'Geodude')!;
    const moves = geodude.querySelector<HTMLElement>('.bench__moves')!;
    // Rock Throw and Tackle; Defense Curl has no forecast.
    expect(moves.querySelectorAll('.bench__move')).toHaveLength(2);
    expect(moves.dataset['hasSuper']).toBe('true');
    expect(moves.querySelector('[data-effect="super"] .badge--effect')?.textContent).toBe('2');
    // Inert: the row is the switch, and a tip inside it would be a dead patch.
    expect(moves.querySelector('[data-tip]')).toBeNull();
    // Pidgey's Gust is resisted by nothing here and Tackle neutral: no light.
    const pidgey = rows.find((row) => row.querySelector('.bench__name')?.textContent === 'Pidgey')!;
    expect(pidgey.querySelector<HTMLElement>('.bench__moves')!.dataset['hasSuper']).toBeUndefined();
  });
});
