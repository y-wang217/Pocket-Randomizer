/**
 * The event screen: a prompt, two or three choices, and the outcome revealed
 * *after* you commit.
 *
 * The two-phase interaction is the whole point. The outcome was drawn when the
 * map was built — the coin is already flipped, and reloading a save cannot
 * reroll it — but the player must not see it before choosing, or there is no
 * choice. So this screen holds the run open between the click and the answer:
 * pick, read what happened, then continue. `chooseEventOption` does not resolve
 * until the second click.
 *
 * Each choice shows a *hint* rather than its outcome. The hints in
 * `data/events.ts` are honest about the shape of the risk without naming the
 * result — "could be anything, could be something that bites" is a decision;
 * saying nothing at all is a coin flip with extra steps.
 */
import { describeOutcome, type EventInstance, type EventOutcome } from '../../core/events';
import type { RunState } from '../../core/run';
import { el } from '../scene';

export interface EventScreen {
  root: HTMLElement;
  render(event: EventInstance, state: RunState, onDone: (index: number) => void): void;
}

export function createEventScreen(): EventScreen {
  const root = el('section', 'screen screen--event');

  const title = el('h2', 'screen__title');
  title.textContent = 'Something happens';
  const prompt = el('p', 'event__prompt');
  const choices = el('div', 'event__choices');
  const result = el('div', 'event__result');
  result.hidden = true;

  root.append(title, prompt, choices, result);

  return {
    root,
    render(event, state, onDone) {
      void state;
      prompt.textContent = event.prompt;
      result.hidden = true;
      result.replaceChildren();

      const buttons = event.choices.map((choice, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'event__choice';

        const label = el('span', 'event__choice-label');
        label.textContent = choice.label;
        const hint = el('span', 'event__choice-hint');
        hint.textContent = choice.hint;

        button.append(label, hint);
        button.addEventListener('click', () => reveal(index));
        return button;
      });
      choices.replaceChildren(...buttons);

      function reveal(index: number): void {
        const choice = event.choices[index];
        if (!choice) return;

        // Every button locks, and the taken one stays highlighted. The player
        // should be able to see what they picked while they read what it cost.
        for (const [i, button] of buttons.entries()) {
          button.disabled = true;
          button.classList.toggle('event__choice--taken', i === index);
        }

        const outcome = el('p', `event__outcome event__outcome--${toneOf(choice.outcome)}`);
        outcome.textContent = describeOutcome(choice.outcome);

        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button button--primary';
        carry.textContent = 'Carry on';
        carry.addEventListener('click', () => onDone(index));

        result.replaceChildren(outcome, carry);
        result.hidden = false;
        carry.focus();
      }
    },
  };
}

/**
 * Whether an outcome reads as good, bad or neither.
 *
 * Keyed off the value and not only the kind, because a `currency` outcome can
 * be a toll as easily as a payout — colouring "-30 coins" green would be the
 * screen contradicting its own text.
 */
function toneOf(outcome: EventOutcome): 'good' | 'bad' | 'flat' {
  switch (outcome.kind) {
    case 'damage':
      return 'bad';
    case 'nothing':
      return 'flat';
    case 'currency':
      return outcome.amount >= 0 ? 'good' : 'bad';
    default:
      return 'good';
  }
}
