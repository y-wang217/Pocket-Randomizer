/**
 * The event strip and the history sheet. **V5.2.**
 *
 * @vitest-environment jsdom
 *
 * ## Why these are jsdom tests and the one-line rule is not
 *
 * The same split `test/battle-feedback.test.ts` states: which elements exist,
 * what they say and what a tap does are DOM questions, and jsdom answers them.
 * "The strip never exceeds one line" is a question about layout at 390 wide,
 * jsdom has no layout engine, and a `getBoundingClientRect` of zeros makes a
 * passing assertion meaningless — so that one is in `test/visual-v5.test.ts`,
 * in Chromium, measured.
 *
 * ## The sharp one
 *
 * The plan's test 3, and the reason it is worth a file: **opening the history
 * must not submit a move or advance the turn.** `ui/drawer.ts` names the
 * failure — a move button is a submission, and a control inside the move grid
 * is one keystroke from spending a turn — and this is the second overlay to
 * open over a live battle, so the property is asserted again rather than
 * assumed to have been inherited.
 */
import { describe, expect, it } from 'vitest';

import { createBattle, type BattleSession } from '../src/core/battle/driver';
import type { FlaggedTurn } from '../src/core/battle/flags';
import type { NodeSpec } from '../src/core/encounters';
import type { Choice, TeamSpec } from '../src/core/types';
import { createFlagStrip } from '../src/ui/flag-strip';
import { createLogSheet } from '../src/ui/log-sheet';
import { createBattleScreen } from '../src/ui/screens/battle';
import { eventLine } from '../src/ui/copy/events';

const PLAYER: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest', 'Yawn', 'Curse'], level: 50 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball'], level: 50 },
];
const FOE: TeamSpec = [{ species: 'Golem', ability: 'Sturdy', moves: ['Tackle'], level: 50 }];

function nodeFor(session: BattleSession, seed: string): NodeSpec {
  void session;
  return {
    id: 's1-1-0',
    kind: 'battle',
    tier: 'normal',
    label: 'A fight',
    encounter: { team: FOE, opponent: 'A trainer', simSeed: seed as never },
    rewards: [],
  } as unknown as NodeSpec;
}

/** One turn of a move on both sides, the way `screens/battle.ts` drives it. */
function turn(session: BattleSession, slot = 1): void {
  for (const side of ['p1', 'p2'] as const) {
    if (session.viewFor(side).awaitingChoice) session.submit(side, { kind: 'move', slot } as Choice);
  }
}

describe('the event line', () => {
  it('says what was done, and names the side it was done by', () => {
    expect(eventLine({ kind: 'move', side: 'p1', actor: 'Snorlax', move: 'Body Slam', order: 1, priority: false, bracket: 0 })).toBe(
      'Snorlax used Body Slam',
    );
    /*
     * The opponent is named as the log names it. Both sides can have a
     * Snorlax out, and a bare name on a one-line strip would be the only place
     * on the board that could not say which of the two just acted.
     */
    expect(eventLine({ kind: 'move', side: 'p2', actor: 'Snorlax', move: 'Tackle', order: 2, priority: false, bracket: 0 })).toBe(
      'Opposing Snorlax used Tackle',
    );
  });

  it('names who a switch replaced only when the protocol said', () => {
    expect(eventLine({ kind: 'switch', side: 'p1', actor: 'Gengar', from: 'Snorlax', order: 1 })).toBe(
      'Gengar came in for Snorlax',
    );
    // A replacement after a faint, and the opening switch-ins, replaced nobody
    // the protocol named. Inventing one would claim a withdrawal that never
    // happened.
    expect(eventLine({ kind: 'switch', side: 'p2', actor: 'Golem', from: null, order: 1 })).toBe('Opposing Golem came in');
  });
});

describe('the strip', () => {
  const move = (side: 'p1' | 'p2', actor: string, name: string, order: number): FlaggedTurn['actions'][number] => ({
    action: { kind: 'move', side, actor, move: name, order, priority: false, bracket: 0 },
    flags: [],
  });

  it('reports the last action of the turn, not the first', () => {
    const strip = createFlagStrip();
    strip.show([{ turn: 4, actions: [move('p1', 'Snorlax', 'Body Slam', 1), move('p2', 'Golem', 'Tackle', 2)], residual: [] }]);
    // The board is in the state the *second* action left it, and the log holds
    // both in order one tap away.
    expect(strip.root.querySelector('.flags__event')?.textContent).toBe('Opposing Golem used Tackle');
  });

  it('has something to say on a turn that produced no flag word at all', () => {
    /*
     * Release C showed an empty band here. The fallback group selection is the
     * jiggle's own rule, so on such a turn the panel that twitches and the name
     * in the line are the same side by construction.
     */
    const strip = createFlagStrip();
    strip.show([{ turn: 2, actions: [move('p1', 'Snorlax', 'Splash', 1)], residual: [] }]);
    expect(strip.root.querySelector('.flags__event')?.textContent).toBe('Snorlax used Splash');
    // And `data-empty` still answers the question it has always answered:
    // whether there were words, which is what holds the band's height.
    expect(strip.root.dataset['empty']).toBe('true');
  });

  it('keeps its furniture across a clear, and says nothing', () => {
    const strip = createFlagStrip();
    strip.show([{ turn: 1, actions: [move('p1', 'Snorlax', 'Body Slam', 1)], residual: [] }]);
    strip.clear();
    expect(strip.root.querySelector('.flags__event')?.textContent).toBe('');
    expect(strip.root.querySelectorAll('.chip')).toHaveLength(0);
    expect(strip.root.dataset['empty']).toBe('true');
    // The control outlives the clear. A history that only appeared once a turn
    // had resolved would be unreachable on the one screen where the opening
    // switch-ins are the only thing that has happened.
    expect(strip.history.parentElement).toBe(strip.root);
  });

  it('never marks a side it is not reporting', () => {
    const strip = createFlagStrip();
    strip.clear();
    expect((strip.root.querySelector('.flags__event') as HTMLElement).dataset['side']).toBeUndefined();
  });
});

describe('the history sheet', () => {
  it('starts closed and never opens itself', () => {
    const sheet = createLogSheet();
    expect(sheet.isOpen()).toBe(false);
    expect(sheet.root.hidden).toBe(true);
  });

  it('closes on the scrim and on Close', () => {
    for (const selector of ['.log-sheet__scrim', '.log-sheet__close']) {
      const sheet = createLogSheet();
      sheet.open();
      expect(sheet.isOpen()).toBe(true);
      (sheet.root.querySelector(selector) as HTMLElement).click();
      expect(sheet.isOpen()).toBe(false);
    }
  });

  it('does not submit a move or advance the turn when it opens', () => {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed: 'SHEET01' });
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);

    const chosen: Choice[] = [];
    screen.attach(session, nodeFor(session, 'SHEET01'), { ability: true, item: true }, (choice) => chosen.push(choice));
    // A resolved turn, so the strip has something on it and the board is in a
    // state a change would be visible against.
    turn(session);

    const trigger = screen.root.querySelector('.flags__history') as HTMLButtonElement;
    expect(trigger, 'the strip carries the control').not.toBeNull();
    // The control is not inside the move grid. That is the sharp case, and it
    // is a property of where the trigger sits rather than of what it does.
    expect(trigger.closest('.moves')).toBeNull();

    const before = {
      protocol: session.protocolFor('p1').length,
      turn: session.viewFor('p1').turn,
      scene: (screen.root.querySelector('.scene') as HTMLElement).outerHTML,
    };

    trigger.click();

    expect((screen.root.querySelector('.log-sheet') as HTMLElement).hidden, 'it opened').toBe(false);
    expect(chosen, 'nothing was submitted').toEqual([]);
    expect(session.protocolFor('p1').length, 'the engine emitted nothing').toBe(before.protocol);
    expect(session.viewFor('p1').turn, 'the turn did not advance').toBe(before.turn);
    // The strongest available form of "the screen underneath is untouched".
    expect((screen.root.querySelector('.scene') as HTMLElement).outerHTML).toBe(before.scene);
  });

  it('renders the log inside itself, and nowhere on the board', () => {
    const session = createBattle({ teams: { p1: PLAYER, p2: FOE }, seed: 'SHEET02' });
    const screen = createBattleScreen();
    document.body.replaceChildren(screen.root);
    screen.attach(session, nodeFor(session, 'SHEET02'), { ability: true, item: true }, () => {});
    turn(session);

    const log = screen.root.querySelector('.log') as HTMLElement;
    expect(log, 'the log still exists').not.toBeNull();
    expect(log.closest('.log-sheet'), 'and it is in the sheet').not.toBeNull();
    expect(screen.root.querySelector('.board .log'), 'and not on the board').toBeNull();
    expect(log.querySelectorAll('.log-entry').length, 'still rendering entries').toBeGreaterThan(0);
  });
});
