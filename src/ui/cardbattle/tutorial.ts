/**
 * The card battle tutorial's steps: what each points at and what it waits
 * for. **No DOM here**, so the whole script can be walked headless
 * (`test/cards-tutorial.test.ts`); the panel that shows a step is `coach.ts`.
 *
 * Shaped like GYMRUN's coach marks (`ui/tutorial.ts`): one mark at a time,
 * anchored to the real element by selector, never a mock of it, Skip on the
 * first, seen once and replayable from the Menu. It differs in one way, the
 * brief's: it is interactive. A `tap` step advances on the panel; a step with
 * a `wait` advances when the player has done the thing, on the real board,
 * and the panel only offers to skip it.
 *
 * Every wait reads the battle and the actions taken since the tutorial began,
 * never a count of renders or taps, so a player who runs ahead (plans Shoot
 * before the Move step, ends the turn early) finds the steps they already did
 * pass at once. Words live in `cardData/copy.ts`, under `tutorial`.
 */
import { CARDS } from '../../cardData/cards';
import type { Action, BattleState } from '../../core/cards/state';

/** The tutorial's battle and the seed whose first hand holds Move, Shoot and Call Medic. */
export const TUTORIAL_ENCOUNTER = 'tutorial';
export const TUTORIAL_SEED = 'TUTOR1';

export type TutorialWait = 'placed' | 'started' | 'moved' | 'attacked' | 'ended' | 'won';

export type TutorialStepId = 'place' | 'start' | 'hand' | 'vitals' | 'mana' | 'move' | 'slots' | 'attack' | 'end' | 'finish';

export interface TutorialStep {
  id: TutorialStepId;
  /** Selectors tried in order; the first painted match is the anchor. */
  anchor: readonly string[];
  /** Absent: the panel's tap advances. Present: the player's act does. */
  wait?: TutorialWait;
  /**
   * Where the panel sits. `top` docks over the status bar and the enemy
   * roster, out of the way of the board, the units and the hand that a
   * waiting step needs tapped. `near` sits beside the anchor.
   */
  dock: 'top' | 'near';
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'place', anchor: ['[data-coach="units"]'], wait: 'placed', dock: 'top' },
  { id: 'start', anchor: ['[data-coach="end"]'], wait: 'started', dock: 'top' },
  { id: 'hand', anchor: ['[data-coach="hand"]'], dock: 'near' },
  { id: 'vitals', anchor: ['.cb-panel--unit[data-id="A"] [data-coach="vitals"]'], dock: 'near' },
  { id: 'mana', anchor: ['.cb-panel--unit[data-id="A"] [data-coach="mana"]'], dock: 'near' },
  { id: 'move', anchor: ['.cb-card[data-card="move"]', '[data-coach="hand"]'], wait: 'moved', dock: 'top' },
  { id: 'slots', anchor: ['.cb-slot--filled', '[data-coach="slots"]'], dock: 'near' },
  { id: 'attack', anchor: ['.cb-card[data-card="shoot"]', '[data-coach="hand"]'], wait: 'attacked', dock: 'top' },
  { id: 'end', anchor: ['[data-coach="end"]'], wait: 'ended', dock: 'top' },
  { id: 'finish', anchor: ['.cb-token--enemy', '[data-coach="board"]'], wait: 'won', dock: 'top' },
];

const DAMAGE = new Set(['strike', 'pierce', 'slash', 'blast']);

/** The card an action selects, by its definition id. */
function selected(state: BattleState, action: Action): string | null {
  return action.type === 'select' ? (state.cards[action.card]?.def ?? null) : null;
}

/** Whether a step's wait is met: by the battle as it stands, or by an action taken since the tutorial began. */
export function waitMet(wait: TutorialWait, state: BattleState, actions: readonly Action[]): boolean {
  const effects = (def: string | null) => (def ? (CARDS[def]?.effects ?? []) : []);
  switch (wait) {
    case 'placed':
      // Started without placing still counts: the units are placed where they stood.
      return actions.some((a) => a.type === 'place') || state.phase !== 'deploy';
    case 'started':
      return state.phase !== 'deploy';
    case 'moved':
      return actions.some((a) => effects(selected(state, a)).some((e) => e.k === 'move' || e.k === 'grantMove'));
    case 'attacked':
      return actions.some((a) => effects(selected(state, a)).some((e) => DAMAGE.has(e.k)));
    case 'ended':
      return actions.some((a) => a.type === 'commit');
    case 'won':
      return state.phase === 'won';
  }
}

/**
 * The step to show: from `index`, past every waiting step whose act is
 * already done. A `tap` step is never passed here; only its panel passes it.
 * `TUTORIAL_STEPS.length` when the script is done, which a won battle always
 * is: beating the dummy is the goal, however the player got there.
 */
export function settle(index: number, state: BattleState, actions: readonly Action[]): number {
  if (state.phase === 'won') return TUTORIAL_STEPS.length;
  let at = index;
  while (at < TUTORIAL_STEPS.length) {
    const wait = TUTORIAL_STEPS[at]!.wait;
    if (!wait || !waitMet(wait, state, actions)) break;
    at++;
  }
  return at;
}
