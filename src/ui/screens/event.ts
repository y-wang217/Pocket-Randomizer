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
  concreteOutcome,
  describeCost,
  describeOutcome,
  describeToll,
  outcomeFor,
  presentedOptions,
  type EventInstance,
  type EventOption,
  type EventOutcome,
} from '../../core/events';
import { tierRangeOf, tierWeightsFor, type EventArchetype } from '../../data/eventPools';
import { capabilityHolders, resolveCapability } from '../../core/capabilities';
import type { RunState } from '../../core/run';
import { BAND_LABELS, CAPABILITY_LABELS, TOLL_PAID_PREFIX } from '../../data/eventCopy';
import { capabilityBandChip, capabilityChip } from '../chip';
import { el } from '../scene';
import { spriteFigure } from '../sprites';

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
      /*
       * Who answers the requirement, at `latent` only. **Idle-sprites patch.**
       *
       * The members whose type the gate names, in slot order, as figures
       * beside the band chip: a fact about the party as it stands, read off
       * the same function the band is. Not at `known`, where the relic is the
       * answer and nobody's type is; not at `none`, where there is nobody.
       * Slot order and never sorted — a position on the party, not a ranking
       * of who would do the job, which `CLAUDE.md` forbids.
       */
      if (band === 'latent') {
        const holders = capabilityHolders(state, event.requires);
        const row = el('span', 'figure-row');
        row.setAttribute('aria-hidden', 'true');
        state.party.forEach((member, slot) => {
          if (holders.includes(member)) row.append(spriteFigure(member.spec.species, { phase: slot }));
        });
        gate.append(row);
      }
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

        /*
         * **The attribute row, and the Part 4 carve-out it sits under.**
         *
         * Tier labels are ordinal, and Part 4 bans ordering that implies
         * ranking. They are allowed here on the same precedent as the `BAND n`
         * badge: the label names *which pool the outcome draws from*, which is
         * an attribute of the button rather than a verdict about it. Recorded
         * in `docs/generation.md` section 14.
         *
         * Nothing else moves. No recommendation, no highlight on the better
         * option, no expected value, and no marker on Attune beyond the relic
         * requirement the gate chip already carries.
         */
        const attributes = el('span', 'event__choice-attributes');
        const cost = costOf(choice);
        if (cost) attributes.append(capabilityChip(cost));
        attributes.append(capabilityBandChip(rewardOf(choice, event.rarity)));

        button.append(label, hint, attributes);
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

        /*
         * **Collapsed against what the run holds, and that is the whole of
         * what makes this line honest.**
         *
         * A drawn `relic` grant carries the whole relic table; which one it
         * pays is decided at resolution, against the held set. `applyEffect`
         * collapses it the same way at the same moment from the same set, so
         * the relic named here is the relic that arrives — and a run holding
         * every relic reads the item it is actually about to get instead of
         * the word "relic" followed by no relic.
         */
        const paid = concreteOutcome(outcomeFor(choice, band), state.relics);
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

        /*
         * **The price, restated as charged.**
         *
         * The reveal used to say nothing about the Toll: the price was on the
         * button, `resolveNode` charged it, and the screen went straight to
         * what it bought. A player who spent a fifth of their HP and read only
         * the reward reasonably concluded the charge had not happened, and the
         * playtest report that produced this patch says exactly that.
         *
         * Its own line, above the outcome, in the order the run applies them:
         * the Toll is charged first, then the tier is paid. A `T0` cost cannot
         * appear beside it — a Toll buys a guaranteed `T2` — but the two lines
         * are independent so that stays true by construction.
         */
        const price = choice.toll
          ? el('p', 'event__outcome event__outcome--bad')
          : null;
        if (price && choice.toll) price.textContent = `${TOLL_PAID_PREFIX}: ${describeToll(choice.toll)}`;

        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button primary-action';
        carry.textContent = 'Carry on';
        // The run records the archetype, which names the button whatever the
        // presented list looks like.
        carry.addEventListener('click', () => onDone(choice.archetype));

        result.replaceChildren(
          ...(conclusion.textContent ? [conclusion] : []),
          ...(price ? [price] : []),
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
 * What this button costs, as an attribute, or null when it costs nothing.
 *
 * Only a Toll has a price. Safe, Gamble and Attune are free, and saying "free"
 * on three of four buttons is noise rather than information.
 */
function costOf(option: EventOption): string | null {
  return option.toll ? `Costs ${describeToll(option.toll)}` : null;
}

/**
 * The tier range this button draws from: `Reward: T1`, `Reward: T0 to T2`.
 *
 * Read off the distribution rather than written beside it, so a tuning pass in
 * `data/eventPools.ts` cannot leave this label describing a table that no
 * longer exists. A single-tier range prints as one tier rather than as "T1 to
 * T1".
 */
function rewardOf(option: EventOption, rarity: EventInstance['rarity']): string {
  // `known` because an Attune button is only ever on screen at `known`, and
  // the other three read the same at every band bar the latent nudge.
  const [low, high] = tierRangeOf(tierWeightsFor(option.archetype, rarity, 'known'));
  return low === high ? `Reward: ${low}` : `Reward: ${low} to ${high}`;
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
