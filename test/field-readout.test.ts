/**
 * The state of the board, on the battle header. **Stage 4.11 Tier 2, D47.**
 *
 * @vitest-environment jsdom
 *
 * The header wears the field glyph after the AI tier: weather then terrain,
 * nothing when nothing is set (R4), dimmed while an ability holds the weather
 * off. Long-press opens the name and the effect line from `fieldCopy` (R5).
 * Every case is a real battle through the screen's own `attach`, the same
 * call the app makes, so what is asserted is the wiring that ships.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createBattle, type BattleSession } from '../src/core/battle/driver';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonSpec, TeamSpec } from '../src/core/types';
import { DEFAULT_DISPLAY_TUNING } from '../src/data/displayTuning';
import { createBattleScreen } from '../src/ui/screens/battle';
import { resetSettings } from '../src/ui/settings';
import { createTooltips } from '../src/ui/tooltips';

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

function mount(p1: TeamSpec, p2: TeamSpec, seed = 'FIELD-T2'): { root: HTMLElement; session: BattleSession; detach: () => void } {
  const session = createBattle({ teams: { p1, p2 }, seed });
  const screen = createBattleScreen();
  document.body.replaceChildren(screen.root);
  const detach = screen.attach(session, nodeFor(p2, seed), REVEAL, () => undefined, 1);
  return { root: screen.root, session, detach };
}

function marks(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.battle__field .battle__field-mark')];
}

beforeEach(() => {
  resetSettings();
});

describe('the field glyph on the header', () => {
  it('renders nothing when nothing is set', () => {
    const { root, detach } = mount([mon('Snorlax', 'Thick Fat')], [mon('Golem', 'Sturdy')]);
    expect(marks(root)).toHaveLength(0);
    expect(root.querySelector('.battle__field')?.childElementCount).toBe(0);
    detach();
  });

  it('wears the weather a lead ability set, from the opening batch', () => {
    const { root, detach } = mount([mon('Pelipper', 'Drizzle')], [mon('Golem', 'Sturdy')]);
    const [mark, ...rest] = marks(root);
    expect(rest).toHaveLength(0);
    expect(mark?.querySelector('[data-glyph]')?.getAttribute('data-glyph')).toBe('field-rain');
    expect(mark?.querySelector('[data-family]')?.getAttribute('data-family')).toBe('field');
    expect(mark?.dataset['tip']).toBe('field:raindance');
    expect(mark?.getAttribute('aria-label')).toBe('Rain');
    expect(mark?.dataset['suppressed']).toBeUndefined();
    detach();
  });

  it('puts weather before terrain, in one fixed order', () => {
    const { root, detach } = mount([mon('Tapu Koko', 'Electric Surge')], [mon('Pelipper', 'Drizzle')]);
    expect(marks(root).map((mark) => mark.dataset['tip'])).toEqual(['field:raindance', 'field:electricterrain']);
    detach();
  });

  it('dims a weather an ability is holding off, and keeps it', () => {
    const { root, detach } = mount([mon('Pelipper', 'Drizzle')], [mon('Golduck', 'Cloud Nine')]);
    const [mark] = marks(root);
    expect(mark?.dataset['tip']).toBe('field:raindance');
    expect(mark?.dataset['suppressed']).toBe('true');
    detach();
  });

  it('gives the primal weathers the base mark and their own id', () => {
    const { root, detach } = mount([mon('Groudon', 'Desolate Land')], [mon('Golem', 'Sturdy')]);
    const [mark] = marks(root);
    expect(mark?.querySelector('[data-glyph]')?.getAttribute('data-glyph')).toBe('field-sun');
    expect(mark?.dataset['tip']).toBe('field:desolateland');
    detach();
  });

  it('adds no word to the header', () => {
    const { root, detach } = mount([mon('Pelipper', 'Drizzle')], [mon('Golem', 'Sturdy')]);
    const text = root.querySelector('.battle__field')?.textContent ?? '';
    expect(text.trim()).toBe('');
    detach();
  });

  it('leaves the words of the detail line where D46 put them', () => {
    const { root, detach } = mount([mon('Pelipper', 'Drizzle')], [mon('Golem', 'Sturdy')]);
    expect(root.querySelector('.battle__detail-text')?.textContent).toMatch(/^Trainer's Golem/);
    detach();
  });
});

describe('inspect on the field glyph (R5)', () => {
  async function pressed(mark: HTMLElement): Promise<string> {
    const layer = createTooltips(document.body, { ...DEFAULT_DISPLAY_TUNING, inspectHoldMs: 0 });
    mark.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const text = layer.root.textContent ?? '';
    mark.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    layer.destroy();
    return text;
  }

  it('opens the name in full and the effect line', async () => {
    const { root, detach } = mount([mon('Groudon', 'Desolate Land')], [mon('Golem', 'Sturdy')]);
    const text = await pressed(marks(root)[0] as HTMLElement);
    expect(text).toContain('Extreme sun');
    expect(text).toContain('Water moves fail outright');
    detach();
  });

  it('says when an ability is holding the weather off', async () => {
    const { root, detach } = mount([mon('Pelipper', 'Drizzle')], [mon('Golduck', 'Cloud Nine')]);
    const text = await pressed(marks(root)[0] as HTMLElement);
    expect(text).toContain('Rain');
    expect(text).toContain('holding this weather off');
    detach();
  });
});
