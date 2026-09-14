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
 *
 * ## The standing, on the screen it pays on. Patch 4.8.0.2.
 *
 * Every event names a capability, and the run's standing for it — `known`,
 * `latent` or `none` — selects which of three drawn outcomes each choice
 * pays. The map card has shown that pair of chips since 4.6c; this screen did
 * not, and its hints were the authored ones, written against `latent`, so at
 * `none` a hint promising coins paid a berry with no word about why. Now the
 * same two chips sit under the title, the hint is the band's own where the
 * authored one is wrong for it, and the reveal opens with a sentence naming
 * what the standing bought before the label says what it paid. All of it from
 * `data/eventCopy.ts`, which `core/` never reads.
 */
import {
  describeCost,
  describeOutcome,
  outcomeFor,
  presentedOptions,
  type EventInstance,
  type EventOutcome,
} from '../../core/events';
import type { EventArchetype } from '../../data/eventPools';
import { resolveCapability } from '../../core/capabilities';
import type { RunState } from '../../core/run';
import { BAND_LABELS, CAPABILITY_LABELS } from '../../data/eventCopy';
import { capabilityBandChip, capabilityChip } from '../chip';
import { el } from '../scene';

export interface EventScreen {
  root: HTMLElement;
  render(event: EventInstance, state: RunState, onDone: (archetype: EventArchetype) => void): void;
}

export function createEventScreen(): EventScreen {
  const root = el('section', 'screen screen--event');

  const title = el('h2', 'screen__title');
  title.textContent = 'Something happens';
  const gate = el('div', 'event__gate');
  const prompt = el('p', 'event__prompt');
  const choices = el('div', 'event__choices');
  const result = el('div', 'event__result');
  result.hidden = true;

  root.append(title, gate, prompt, choices, result);

  return {
    root,
    render(event, state, onDone) {
      /*
       * The band this run is at, read once when the screen opens.
       *
       * It selects which of the three drawn outcomes this event pays. Read
       * here rather than per click so that the answer cannot change between
       * rendering the buttons and revealing the result — the run does not move
       * while this screen is open, but reading it once says so.
       */
      const band = resolveCapability(state, event.requires);
      gate.replaceChildren(
        capabilityChip(`Requires ${CAPABILITY_LABELS[event.requires]}`),
        capabilityBandChip(BAND_LABELS[band]),
      );
      prompt.textContent = event.prompt;
      result.hidden = true;
      result.replaceChildren();

      /*
       * The **presented** list: three options without the event's relic, four
       * with. `presentedOptions` is the only place that gate lives, and the
       * index handed back to the run is an index into the *built* list, which
       * does not move when the relic does.
       */
      const offered = presentedOptions(event, band);
      const buttons = offered.map((choice, index) => {
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
        const choice = offered[index];
        if (!choice) return;

        // Every button locks, and the taken one stays highlighted. The player
        // should be able to see what they picked while they read what it cost.
        for (const [i, button] of buttons.entries()) {
          button.disabled = true;
          button.classList.toggle('event__choice--taken', i === index);
        }

        const paid = outcomeFor(choice, band);
        const conclusion = el('p', 'event__conclusion');
        /*
         * No conclusion line yet. The per-event band copy that used to write
         * one was deleted with the 4.6c model it described, and the archetype
         * copy that replaces it is step 8's. The element stays so the result
         * block's shape does not have to change twice.
         */
        conclusion.textContent = '';

        const outcome = el('p', `event__outcome event__outcome--${toneOf(paid)}`);
        outcome.textContent = describeOutcome(paid);

        /*
         * The consolation gets its own line, and so does the cost above it.
         * A `T0` that showed only what it took would read as the game taking
         * something and giving nothing — the exact misread the retired
         * "unrewarded, not punished" rule existed to prevent.
         */
        const cost = describeCost(paid);
        const costLine = cost ? el('p', 'event__outcome event__outcome--bad') : null;
        if (costLine) costLine.textContent = cost;

        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button primary-action';
        carry.textContent = 'Carry on';
        // The run records the archetype, which names the button whatever the
        // presented list looks like.
        carry.addEventListener('click', () => onDone(choice.archetype));

        result.replaceChildren(
          ...(conclusion.textContent ? [conclusion] : []),
          ...(costLine ? [costLine] : []),
          outcome,
          carry,
        );
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
  const grants = outcome.grant.filter((effect) => effect.kind !== 'nothing');
  if (grants.length === 0) return 'flat';
  if (grants.every((effect) => effect.kind === 'currency' && effect.amount < 0)) return 'bad';
  return 'good';
}
