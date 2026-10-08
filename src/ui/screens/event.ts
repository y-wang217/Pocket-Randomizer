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
 * `data/eventCopy.ts` are honest about the shape of the risk without naming
 * the result — "the pile holds itself up" is a decision; saying nothing at all
 * is a coin flip with extra steps. Six words each since M5.6, which is the
 * budget section 4 carries and the reason they read as fragments.
 *
 * ## The standing, on the screen it pays on. Patch 4.8.0.2.
 *
 * Every event names a capability, and the run's standing for it — `known`,
 * `latent` or `none` — selects which of three drawn outcomes each choice
 * pays. The map card has shown that pair since 4.6c; this screen did not, and
 * its hints were the authored ones, written against `latent`, so at `none` a
 * hint promising coins paid a berry with no word about why. Now the same pair
 * sits at the top of the screen — the glyph and the chevron the map card
 * draws, since M5.6, rather than two chips of words — and the reveal says what
 * the standing bought. All of it from `data/eventCopy.ts`, which `core/` never
 * reads.
 *
 * ## A price is charged or it is not offered. 2026-09-19.
 *
 * A Toll states its price on the button. Until this patch the screen offered
 * that button whatever the run held, and a price the run could not pay was
 * charged against nothing: a berry toll pressed by a bag with no berry took
 * nothing and paid its guaranteed `T2` in full, which is a free `T2` on a
 * button labelled with a cost.
 *
 * Two changes, and they are the same change read forwards and backwards. The
 * button is dimmed and says so when `optionPayable` is false, so the price is
 * never charged against nothing; and the price names the item it will take
 * rather than its kind, so a player holding four berries knows which one is
 * leaving before they press. Both read `core/events.ts` — the gate *is* the
 * fold, and the named item is the fold's own walk — so neither can drift into
 * describing a charge that does not happen. `CLAUDE.md`'s Prices section is
 * the rule; `docs/generation.md` section 99 is the account.
 */
import {
  concreteOutcome,
  describeEffect,
  describePrice,
  optionPayable,
  outcomeFor,
  presentedOptions,
  type EventInstance,
  type EventOption,
  type EventOutcome,
  type ResolvedEffect,
} from '../../core/events';
import type { TollPrice } from '../../data/events';
import { tierRangeOf, tierWeightsFor, type EventArchetype } from '../../data/eventPools';
import { capabilityHolders, resolveCapability } from '../../core/capabilities';
import { defenderOptionPayable, defenderOutcomeOf, type DefenderEventInstance } from '../../core/defender/events';
import type { RunState } from '../../core/run';
import { DEFENDER_AMBUSH } from '../../data/defenderEvents';
import { DEFENDER_EVENT_HINTS, DEFENDER_EVENT_HOOKS, defenderEventLabel } from '../../data/defenderEventCopy';
import { BAND_LABELS, CAPABILITY_LABELS, PRICE_UNPAYABLE, TOLL_PAID_PREFIX, eventHook, eventLabel, eventHint } from '../../data/eventCopy';
import { NODE_KIND_WORDS } from '../../data/glyphLabels';
import { capabilityBandChevron, capabilityChip, capabilityGlyph, coinAmount, nodeKindGlyph, rewardTierPips, tierChip } from '../chip';
import { el } from '../scene';
import { spriteFigure } from '../sprites';

export interface EventScreen {
  root: HTMLElement;
  render(event: EventInstance, state: RunState, onDone: (archetype: EventArchetype) => void): void;
  /**
   * A defender question mark (bible Rev 30, D111): the same component with
   * the requirement pair absent, a wager's odds and a fight's trainer mark.
   * `onDone` is the option's index. A `fight` resolves on the press, since
   * the fight follows; every other role holds the screen open for its reveal.
   */
  renderDefender(event: DefenderEventInstance, state: RunState, onDone: (index: number) => void): void;
}

export function createEventScreen(): EventScreen {
  const root = el('section', 'screen screen--event');

  /*
   * **No title element, and the hook is why. Milestone M5.6.**
   *
   * `Something happens` sat above a hook that already says what happens, on
   * the one screen section 4 budgets prose on — two words naming the same
   * thing the next line names, which is R3 one level up from an attribute.
   * The phrase is not lost: it is the map node card's label for an event
   * node, which is where a player reads it before arriving here.
   */
  const gate = el('div', 'event__gate');
  const prompt = el('p', 'event__prompt');
  const choices = el('div', 'event__choices');
  const result = el('div', 'event__result');
  result.hidden = true;

  root.append(gate, prompt, choices, result);

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
      /*
       * **The map node's own pair, mounted rather than redrawn. M5.6.**
       *
       * Section 3 gives this attribute one encoding — *"capability glyph plus
       * band chevron"* — and M5.2 built it; this screen went on printing
       * `Requires Cut` and `you have the relic`, five words for a fact the
       * map card beside it draws with two marks. R1 says one component per
       * attribute cluster and names a surface that positions an attribute
       * itself as the defect, so the fix is to mount what already exists.
       * The capability name and what satisfies it are the inspect column, on
       * the same `capability:` tip the chip carried.
       */
      gate.replaceChildren(
        capabilityGlyph(event.requires, CAPABILITY_LABELS[event.requires]),
        capabilityBandChevron(band, BAND_LABELS[band]),
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
      prompt.textContent = eventHook(event.eventId);
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
        label.textContent = eventLabel(event.eventId, choice.archetype);
        const hint = el('span', 'event__choice-hint');
        hint.textContent = eventHint(event.eventId, choice.archetype);

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
        if (choice.toll) attributes.append(priceChip(choice.toll, state));
        const [low, high] = rewardRangeOf(choice, event.rarity);
        attributes.append(rewardTierPips(low, high, rewardLabelOf(low, high)));

        /*
         * **The price gate.** A button whose stated price this run cannot pay
         * is dimmed, says so, and cannot be pressed.
         *
         * It stays on the menu rather than leaving it, which is the difference
         * between this and the Attune gate above: Attune is an option the run
         * does not have, and a Toll is an option the run cannot afford *yet*.
         * A player who can see the price they are short of can go and get the
         * berry; a player who is shown three buttons where there were four
         * learns nothing at all. `presentedOptions` is untouched, so the list
         * is still three long without the relic and four with.
         *
         * `optionPayable` is the only definition of "can pay", and it answers
         * by charging the price against a throwaway state — so a button is
         * enabled exactly when pressing it would take something. The bug this
         * answers is the inverse: a berry price against an empty bag charged
         * nothing and paid its guaranteed `T2` in full.
         */
        if (!optionPayable(state, choice)) {
          button.disabled = true;
          button.classList.add('event__choice--unpayable');
          attributes.append(capabilityChip(PRICE_UNPAYABLE));
        }

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
        outcome.replaceChildren(...outcomeNodes(paid));

        /*
         * The consolation gets its own line, and so does the cost above it.
         * A `T0` that showed only what it took would read as the game taking
         * something and giving nothing — the exact misread the retired
         * "unrewarded, not punished" rule existed to prevent.
         */
        const costLine = paid.cost.length > 0 ? el('p', 'event__outcome event__outcome--bad') : null;
        if (costLine) costLine.replaceChildren(...effectNodes(paid.cost));

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
        /*
         * The **named** price, off the bag as it stood when this screen opened
         * — which is the bag the charge was taken from, because `state` does
         * not move while the screen is held open. Past tense over a concrete
         * item: "Paid: Oran Berry" is what happened, where "Paid: A berry"
         * left the player counting their bag to find out which.
         */
        if (price && choice.toll) {
          price.replaceChildren(`${TOLL_PAID_PREFIX}: `, ...priceNodes(choice.toll, state));
        }

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

    renderDefender(event, state, onDone) {
      // No requirement pair: a defender run has no capabilities (D111).
      gate.replaceChildren();
      prompt.textContent = DEFENDER_EVENT_HOOKS[event.eventId] ?? '';
      result.hidden = true;
      result.replaceChildren();

      const buttons = event.options.map((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `event__choice event__choice--${option.role}`;

        const label = el('span', 'event__choice-label');
        label.textContent = defenderEventLabel(event.eventId, index);
        const hint = el('span', 'event__choice-hint');
        hint.textContent = DEFENDER_EVENT_HINTS[event.eventId]?.[index] ?? '';

        /*
         * The attribute row (D111): the price, named against the bag, on a
         * `pay`; the odds as a bare percentage on a `wager`, in the chevron's
         * slot; the trainer mark and the tier word on a `fight`, the map node
         * card's own pair; the tier pips on everything that pays. No
         * recommendation, no highlight, no expected value.
         */
        const attributes = el('span', 'event__choice-attributes');
        if (option.toll) attributes.append(priceChip(option.toll, state));
        if (option.odds !== null) {
          const odds = el('span', 'event__odds');
          odds.textContent = `${Math.round(option.odds * 100)}%`;
          odds.setAttribute('aria-label', `${Math.round(option.odds * 100)}% to win`);
          attributes.append(odds);
        }
        if (option.role === 'fight') {
          attributes.append(nodeKindGlyph('trainer', NODE_KIND_WORDS.trainer, 16), tierChip(DEFENDER_AMBUSH.tier));
        }
        if (option.tier) attributes.append(rewardTierPips(option.tier, option.tier, `Reward ${option.tier}`));

        // The price gate, as the attacker's: dimmed, says so, cannot be pressed.
        if (!defenderOptionPayable(state, option)) {
          button.disabled = true;
          button.classList.add('event__choice--unpayable');
          attributes.append(capabilityChip(PRICE_UNPAYABLE));
        }

        button.append(label, hint, attributes);
        button.addEventListener('click', () => reveal(index));
        return button;
      });
      choices.replaceChildren(...buttons);

      function reveal(index: number): void {
        const option = event.options[index];
        if (!option) return;
        for (const [i, button] of buttons.entries()) {
          button.disabled = true;
          button.classList.toggle('event__choice--taken', i === index);
        }
        // A fight follows the press: the battle screen is the reveal.
        if (option.role === 'fight') {
          onDone(index);
          return;
        }

        // What the role pays, from the drawn roll, collapsed against the held relics.
        const drawn = defenderOutcomeOf(option, false);
        const paid = drawn ? concreteOutcome(drawn, state.relics) : null;
        const lines: HTMLElement[] = [];
        if (option.toll) {
          const price = el('p', 'event__outcome event__outcome--bad');
          price.replaceChildren(`${TOLL_PAID_PREFIX}: `, ...priceNodes(option.toll, state));
          lines.push(price);
        }
        if (paid) {
          if (paid.cost.length > 0) {
            const costLine = el('p', 'event__outcome event__outcome--bad');
            costLine.replaceChildren(...effectNodes(paid.cost));
            lines.push(costLine);
          }
          const outcome = el('p', `event__outcome event__outcome--${toneOf(paid)}`);
          outcome.replaceChildren(...outcomeNodes(paid));
          lines.push(outcome);
        }

        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'button primary-action';
        carry.textContent = 'Carry on';
        carry.addEventListener('click', () => onDone(index));

        result.replaceChildren(...lines, carry);
        result.hidden = false;
        carry.focus();
      }
    },
  };
}

/**
 * What this button costs, as an attribute. Called only where a Toll is set.
 *
 * Only a Toll has a price. Safe, Gamble and Attune are free, and saying "free"
 * on three of four buttons is noise rather than information.
 *
 * **Named against the bag**, through `describePrice`: "Costs Oran Berry" where
 * the run holds one, "Costs A berry" where it holds none — and where it holds
 * none the button is dimmed anyway, so the generic wording only ever appears
 * on a price that cannot be paid. A price the player can plan around is the
 * reason a price is on the button at all.
 */
function priceChip(toll: TollPrice, state: RunState): HTMLElement {
  const chip = capabilityChip('Costs ');
  chip.append(...priceNodes(toll, state));
  return chip;
}

/**
 * A price as the player reads it: a coin amount as the currency mark beside a
 * bare number, everything else named against the bag. **2026-10-08.** A
 * fixed-coin Toll read `Costs 40 coins` here while the shop's price, the
 * map's payout and the coins card all wore the mark; section 2's currency row
 * puts the mark *"wherever a coin amount appears"*. The exact amount is still
 * the exact amount, which is what CLAUDE.md's *Prices* asks of a price. A
 * share of the wallet (`25% of your coins`) is not an amount, and keeps its
 * words.
 */
function priceNodes(toll: TollPrice, state: RunState): Node[] {
  if (toll.kind === 'goldFixed') return [coinAmount(String(toll.amount))];
  return [document.createTextNode(describePrice(toll, state.backpack))];
}

/**
 * Effects as the player reads them, joined as `core/events.ts`'s
 * `describeOutcome` joins them, with a coin amount drawn as the mark and a
 * signed number in place of `+40 coins` (2026-10-08, the same section 2 row).
 */
function effectNodes(effects: readonly ResolvedEffect[]): Node[] {
  return joinNodes(
    effects.map((effect) =>
      effect.kind === 'currency'
        ? coinAmount(effect.amount >= 0 ? `+${effect.amount}` : String(effect.amount))
        : document.createTextNode(describeEffect(effect)),
    ),
  );
}

/** An outcome's grants, with `describeOutcome`'s rule for an empty one. */
function outcomeNodes(outcome: EventOutcome): Node[] {
  const grants = outcome.grant.filter((effect) => describeEffect(effect) !== NOTHING_HAPPENS);
  return grants.length > 0 ? effectNodes(grants) : [document.createTextNode(NOTHING_HAPPENS)];
}

const NOTHING_HAPPENS = describeEffect({ kind: 'nothing' });

function joinNodes(parts: readonly Node[]): Node[] {
  return parts.flatMap((part, index) => (index === 0 ? [part] : [document.createTextNode(' + '), part]));
}

/**
 * The tier range this button draws from, as its two ends.
 *
 * Read off the distribution rather than written beside it, so a tuning pass in
 * `data/eventPools.ts` cannot leave the meter describing a table that no
 * longer exists.
 */
function rewardRangeOf(option: EventOption, rarity: EventInstance['rarity']): readonly [string, string] {
  // `known` because an Attune button is only ever on screen at `known`, and
  // the other three read the same at every band bar the latent nudge.
  return tierRangeOf(tierWeightsFor(option.archetype, rarity, 'known'));
}

/**
 * What the pip span is called for a screen reader, and only for one.
 *
 * `Reward: T0 to T2` was the visible label until M5.6 and is now the
 * `aria-label` on the meter that replaced it. Nothing renders it: the census
 * counts text nodes, and this string is never one. A sighted player reads the
 * span, and reaches the same sentence through inspect on the `reward-tier:`
 * tip — one fact, two ways in, which is R5 rather than a second channel.
 */
function rewardLabelOf(low: string, high: string): string {
  return low === high ? `Reward ${low}` : `Reward ${low} to ${high}`;
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
