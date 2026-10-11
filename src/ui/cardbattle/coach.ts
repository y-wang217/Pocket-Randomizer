/**
 * The card battle tutorial's panel: one step at a time, anchored to the real
 * element (`docs/spec/gymrun-patch-card-battle-hearts-and-tutorial.md`).
 *
 * GYMRUN's coach marks (`ui/tutorial.ts`) are the model, and the rules carry
 * over: the anchor is the real panel, card or button, found by selector at
 * the moment of showing, never a mock; a tap on the panel lands on the panel
 * and nothing under it; no timers, nothing auto-advances on time. Skip on the
 * first step ends it and the Menu's Tutorial opens it again.
 *
 * What is new is the wait. A step that asks the player to act (place a unit,
 * press Start, plan a Move, plan an attack, End Turn, beat the dummy) docks
 * at the top, out of the way, and passes when the act is done on the board;
 * its panel offers only Skip step. The sandbox calls `sync` after every
 * render, since a render rebuilds the elements a step points at.
 */
import { CARD_COPY } from '../../cardData/copy';
import type { Action, BattleState } from '../../core/cards/state';
import { TUTORIAL_STEPS, settle, type TutorialStep } from './tutorial';

export interface Coach {
  root: HTMLElement;
  /** Begin at the first step. */
  begin(): void;
  /** Stop without finishing. */
  end(): void;
  active(): boolean;
  /** The step showing, for tests. */
  current(): TutorialStep | null;
  /**
   * After a render: pass any waiting step whose act is done, then point at
   * the step's anchor. `hidden` while a round plays back. Returns `true` the
   * one time the script runs out.
   */
  sync(state: BattleState, actions: readonly Action[], hidden: boolean): boolean;
}

export interface CoachOptions {
  /** The frame the anchors are found in. */
  scope: ParentNode;
  /** The words of a step: its title and its text. */
  words(step: TutorialStep): { title: string; text: string };
  /** Skip tutorial, from the first step. */
  onSkip(): void;
  /** Asks the sandbox to render, which syncs: after a tap passes a step. */
  onAdvance(): void;
}

const TARGET = 'coachTarget';

function present(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden]') !== null) return false;
  const check = (element as { checkVisibility?: () => boolean }).checkVisibility;
  return typeof check === 'function' ? check.call(element) : true;
}

export function createCoach(options: CoachOptions): Coach {
  const root = document.createElement('div');
  root.className = 'cb-coach';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'polite');
  const title = document.createElement('div');
  title.className = 'cb-coach-title';
  const text = document.createElement('div');
  text.className = 'cb-coach-text';
  const footer = document.createElement('div');
  footer.className = 'cb-coach-footer';
  const progress = document.createElement('span');
  progress.className = 'cb-coach-progress';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'cb-coach-btn cb-coach-skip';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cb-coach-btn cb-coach-next';
  footer.append(progress, skip, next);
  root.append(title, text, footer);

  let index = -1;
  let target: HTMLElement | null = null;

  const step = (): TutorialStep | null => (index >= 0 && index < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[index]! : null);

  function clearTarget(): void {
    if (target) delete target.dataset[TARGET];
    target = null;
  }

  function stop(): void {
    clearTarget();
    index = -1;
    root.hidden = true;
  }

  root.addEventListener('click', (event) => {
    // The panel is the only thing a tap on it reaches.
    event.preventDefault();
    event.stopPropagation();
    const shown = step();
    if (!shown) return;
    const on = event.target instanceof Element ? event.target : null;
    if (on?.closest('.cb-coach-skip')) {
      stop();
      options.onSkip();
      return;
    }
    // A tap step passes on a tap anywhere; a waiting one only on Skip step.
    if (shown.wait && !on?.closest('.cb-coach-next')) return;
    index++;
    options.onAdvance();
  });

  function anchorOf(shown: TutorialStep): HTMLElement | null {
    for (const selector of shown.anchor) {
      for (const node of options.scope.querySelectorAll<HTMLElement>(selector)) if (present(node)) return node;
    }
    return null;
  }

  /** Over the status bar for a waiting step; beside the anchor, below it or above, for a tap step. */
  function place(shown: TutorialStep, anchor: HTMLElement | null): void {
    const margin = 6;
    const host = root.parentElement?.getBoundingClientRect();
    const frame = (options.scope as Element).getBoundingClientRect?.();
    if (!host || !frame || host.height === 0) return;
    root.style.left = `${Math.max(margin, frame.left - host.left + margin)}px`;
    root.style.width = `${Math.max(0, Math.min(frame.width, host.width) - 2 * margin)}px`;
    root.style.top = `${Math.max(margin, frame.top - host.top + margin)}px`;
    if (shown.dock === 'top' || !anchor) return;
    const box = anchor.getBoundingClientRect();
    const own = root.getBoundingClientRect();
    const below = box.bottom + margin;
    const above = box.top - margin - own.height;
    const top = below + own.height <= host.bottom - margin ? below : above >= host.top + margin ? above : host.top + margin;
    root.style.top = `${top - host.top}px`;
  }

  return {
    root,
    begin() {
      clearTarget();
      index = 0;
    },
    end: stop,
    active: () => index >= 0,
    current: step,
    sync(state, actions, hidden) {
      if (index < 0) return false;
      index = settle(index, state, actions);
      clearTarget();
      const shown = step();
      if (!shown) {
        stop();
        return true;
      }
      if (hidden) {
        root.hidden = true;
        return false;
      }
      const words = options.words(shown);
      title.textContent = words.title;
      text.textContent = words.text;
      progress.textContent = CARD_COPY.tutorial.progress(index + 1, TUTORIAL_STEPS.length);
      skip.textContent = CARD_COPY.tutorial.skip;
      skip.hidden = index !== 0;
      next.textContent = shown.wait ? CARD_COPY.tutorial.skipStep : CARD_COPY.tutorial.next;
      root.dataset['step'] = shown.id;
      root.dataset['wait'] = String(!!shown.wait);
      root.hidden = false;
      const anchor = anchorOf(shown);
      if (anchor) {
        target = anchor;
        anchor.dataset[TARGET] = 'true';
      }
      place(shown, anchor);
      return false;
    },
  };
}
