/**
 * @vitest-environment jsdom
 *
 * The battle screen as 5.0/2 rebuilt it, held headless.
 *
 * Stage 2 of `docs/spec/gymrun-stage5.0-visual-redesign.md`, under the rulings
 * on D56 to D60 (`docs/spec/gymrun-stage5.0-rulings-d56-d60.md`). The layout is
 * the browser suite's; what jsdom can hold is the structure the rulings asked
 * for, and those are the things a later restyle could quietly undo:
 *
 *   - **D56 and D57.** Every fact the panel and the move card carried is still
 *     on them. A restyle that drops one fails here, not in a screenshot.
 *   - **D58.** The strip hangs directly under the stage, above the moves.
 *   - **D59.** The bench is behind one Switch button that says what the bench's
 *     heading said; a forced switch opens it by itself, and a choice closes it.
 *     No Info button: the log keeps D26's handle.
 *   - **D60.** The stage names its backdrop: the gym's at a gym, the locale's
 *     everywhere else, and nothing when the run has no locale.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createBattle, type BattleSession } from '../src/core/battle/driver';
import { buildBattleUiView, type BattleUiView } from '../src/core/battle/view';
import type { NodeSpec } from '../src/core/encounters';
import type { Choice, TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { createScene } from '../src/ui/scene';
import { createBattleScreen } from '../src/ui/screens/battle';
import { resetSettings } from '../src/ui/settings';
import { applyLocale } from '../src/ui/theme/locale';

const PARTY: TeamSpec = [
  { species: 'Chingling', ability: 'Levitate', moves: ['Confusion', 'Astonish'], level: 7 },
  { species: 'Horsea', ability: 'Swift Swim', moves: ['Bubble'], level: 7 },
];
const ALONE: TeamSpec = [PARTY[0]!];
const FOE: TeamSpec = [{ species: 'Yamper', ability: 'Ball Fetch', moves: ['Tackle'], level: 4 }];
const REVEAL = { ability: true, item: true, teamSize: true };

beforeEach(() => {
  resetSettings();
});
afterEach(() => {
  applyLocale(null);
});

function viewOf(player: TeamSpec, seed: string): BattleUiView {
  const session = createBattle({ teams: { p1: player, p2: FOE }, seed });
  return buildBattleUiView(session.factsFor('p1'), REVEAL, abilityEffects);
}

function nodeOf(kind: NodeSpec['kind']): NodeSpec {
  return {
    id: 's1-1-0',
    kind,
    tier: 'normal',
    label: 'A fight',
    encounter: { team: FOE, opponent: 'A wild Pokemon', simSeed: 'STAGE2' as never },
    rewards: [],
  } as unknown as NodeSpec;
}

function sessionOf(player: TeamSpec, seed: string): BattleSession {
  return createBattle({ teams: { p1: player, p2: FOE }, seed });
}

const switchButton = (root: ParentNode): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>('.scene__switch') as HTMLButtonElement;
const pane = (root: HTMLElement): string | undefined => root.dataset['pane'];

describe('the Switch row (D59)', () => {
  it('is absent when there is no bench, and there is no Info button either way', () => {
    const scene = createScene();
    scene.update(viewOf(ALONE, 'S2-ALONE'), () => {});
    expect(switchButton(scene.root).hidden).toBe(true);
    expect(scene.root.querySelector<HTMLElement>('.scene__actions')?.hidden).toBe(true);
    expect(pane(scene.root)).toBe('moves');
    expect(scene.root.textContent).not.toMatch(/\bInfo\b/);
  });

  it('carries the bench behind one button that says what its heading said', () => {
    const scene = createScene();
    scene.update(viewOf(PARTY, 'S2-BENCH'), () => {});
    const button = switchButton(scene.root);
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe('Switch');
    // The heading is gone rather than printed twice.
    expect(scene.root.querySelector('.bench__heading')).toBeNull();
    expect(pane(scene.root)).toBe('moves');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    expect(pane(scene.root)).toBe('bench');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(pane(scene.root)).toBe('moves');
  });

  it('closes the bench on any choice, and never chooses on its own', () => {
    const scene = createScene();
    const chosen: Choice[] = [];
    scene.update(viewOf(PARTY, 'S2-CHOOSE'), (choice) => chosen.push(choice));
    switchButton(scene.root).click();
    expect(chosen).toEqual([]);
    scene.root.querySelector<HTMLButtonElement>('.bench__member:not(:disabled)')?.click();
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.kind).toBe('switch');
    expect(pane(scene.root)).toBe('moves');
  });

  it('opens itself on a forced switch, with the forced wording', () => {
    const scene = createScene();
    const forced = { ...viewOf(PARTY, 'S2-FORCED'), forceSwitch: true, moves: [] } as BattleUiView;
    scene.update(forced, () => {});
    expect(pane(scene.root)).toBe('bench');
    expect(switchButton(scene.root).textContent).toBe('Choose who comes in');
    expect(switchButton(scene.root).dataset['forced']).toBe('true');
  });

  it('closes on reset, with the rest of the last fight', () => {
    const scene = createScene();
    scene.update(viewOf(PARTY, 'S2-RESET'), () => {});
    switchButton(scene.root).click();
    scene.reset();
    expect(pane(scene.root)).toBe('moves');
    expect(switchButton(scene.root).hidden).toBe(true);
  });
});

describe('the panels and the move buttons keep every fact (D56, D57)', () => {
  it('draws the HP number on both sides, and every chip slot the panel had', () => {
    const scene = createScene();
    scene.update(viewOf(PARTY, 'S2-FACTS'), () => {});
    for (const side of ['foe', 'me']) {
      const panel = scene.root.querySelector(`.panel--${side}`) as HTMLElement;
      expect(panel.querySelector('.panel__name')?.textContent, side).not.toBe('');
      expect(panel.querySelector('.panel__level')?.textContent, side).not.toBe('');
      expect(panel.querySelector('.panel__hp-text')?.textContent, `${side}: the HP number`).toMatch(/\d+ \/ \d+/);
      for (const slot of ['.hp', '.panel__types', '.panel__traits', '.panel__item', '.panel__volatiles', '.panel__stages', '.panel__priority']) {
        expect(panel.querySelector(slot), `${side}: ${slot}`).not.toBeNull();
      }
      // The long press to the base stats is a control on the panel.
      expect(panel.getAttribute('role')).toBe('button');
    }
    // The ability, which the author named as very important, is named at rest.
    expect(scene.root.querySelector('.panel--foe .panel__traits')?.textContent).toMatch(/Ball Fetch/i);
    // And the opponent's roster count.
    expect(scene.root.querySelector('.panel--foe .panel__roster')?.textContent).not.toBe('');
  });

  it('mounts the full move card on every button', () => {
    const scene = createScene();
    scene.update(viewOf(PARTY, 'S2-MOVES'), () => {});
    const buttons = [...scene.root.querySelectorAll('.moves .move')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.querySelector('.move__name')?.textContent).not.toBe('');
      expect(button.querySelector('.move__meta .chip--type'), 'type chip').not.toBeNull();
      expect(button.querySelector('.move__pp'), 'PP').not.toBeNull();
      expect(button.querySelector('.move__facts'), 'the fact strip').not.toBeNull();
    }
  });

  it('stands both sprites on a platform that is not part of either actor', () => {
    const scene = createScene();
    const platforms = [...scene.stage.querySelectorAll('.stage__platform')];
    expect(platforms).toHaveLength(2);
    for (const platform of platforms) expect(platform.closest('.stage__actor')).toBeNull();
  });
});

describe('the screen (D58, D60)', () => {
  it('hangs the strip directly under the stage, above the moves', () => {
    const screen = createBattleScreen();
    screen.attach(sessionOf(PARTY, 'S2-STRIP'), nodeOf('wild'), REVEAL, () => {});
    const stage = screen.root.querySelector('.stage');
    expect(stage?.nextElementSibling?.classList.contains('flags')).toBe(true);
    expect(stage?.nextElementSibling?.nextElementSibling?.classList.contains('moves')).toBe(true);
    // The log's way in is still D26's handle on the strip.
    expect(screen.root.querySelector('.flags .flags__history')).not.toBeNull();
    // The header row is above the stage.
    const header = screen.root.querySelector('.battle__header') as HTMLElement;
    expect(header.compareDocumentPosition(stage as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the turn header in the header row, and replaces it in place (section 6 step 1)', () => {
    const screen = createBattleScreen();
    const session = sessionOf(PARTY, 'S2-TURN');
    screen.attach(session, nodeOf('wild'), REVEAL, () => {});
    const turn = (): HTMLElement[] => [...screen.root.querySelectorAll<HTMLElement>('.battle__header .battle__turn')];
    expect(turn()).toHaveLength(1);
    expect(turn()[0]?.textContent).toBe('Turn 1');
    for (const side of ['p1', 'p2'] as const) session.submit(side, { kind: 'move', slot: 1 });
    expect(turn()).toHaveLength(1);
    expect(turn()[0]?.textContent).toBe('Turn 2');
  });

  it("stands a fight on its locale's backdrop, and a gym on the gym's", () => {
    applyLocale('marsh');
    const screen = createBattleScreen();
    const stage = (): HTMLElement => screen.root.querySelector('.stage') as HTMLElement;

    screen.attach(sessionOf(PARTY, 'S2-LOCALE'), nodeOf('wild'), REVEAL, () => {});
    expect(stage().dataset['backdrop']).toBe('battle-backdrop:marsh');
    // Every backdrop is a placeholder until the art pass.
    expect(stage().dataset['art']).toBe('placeholder');

    screen.attach(sessionOf(PARTY, 'S2-GYM'), nodeOf('gym'), REVEAL, () => {}, 0);
    expect(stage().dataset['backdrop']).toBe('battle-backdrop:gym');
  });

  it('names no backdrop when the run has no locale, and keeps the placeholder', () => {
    applyLocale(null);
    const screen = createBattleScreen();
    screen.attach(sessionOf(PARTY, 'S2-NONE'), nodeOf('wild'), REVEAL, () => {});
    const stage = screen.root.querySelector('.stage') as HTMLElement;
    expect(stage.dataset['backdrop']).toBeUndefined();
    expect(stage.dataset['art']).toBe('placeholder');
  });
});
