/**
 * The decision feed: every decision the player made this run, in play order,
 * as one short line each. **Stage 5.0/1, bible R11's carve-out (D55).**
 *
 * The shell calls it *Run Progress*. It is the run log read back as a replay:
 * one entry per logged decision, never more and never fewer, so the feed and
 * the log cannot disagree about what happened.
 *
 * ## Why a policy wrapper, and why outside the replay
 *
 * Almost every logged decision is an index into an offer the seed rebuilds
 * (`{ kind: 'reward', index: 1 }`), so the log alone cannot name anything. The
 * offer is only in hand at the moment the run asks the question. So the feed
 * wraps the run policy, remembers the offer each question carried, and turns
 * the entry into a line when `onDecision` reports it, which is the order the
 * log is written in. Keying on `onDecision` rather than on the answer is what
 * keeps a normal node's card in its logged place: the card is chosen in
 * `reviewBattle` and logged after the capture question.
 *
 * The wrapper goes **around** `replayRunPolicy`, not inside it. A resumed run
 * answers its logged questions from the log without ever calling the live
 * policy, so a wrapper inside would see nothing of the part being resumed.
 * Outside, the replayed questions pass through it with their real offers and
 * the feed rebuilds itself on every load. Nothing is persisted.
 *
 * ## What it may not do
 *
 * It answers nothing: every method returns the inner policy's answer
 * unchanged, so the log is byte for byte what it would be without the feed. It
 * draws nothing. It is in `ui/`, so `contentHash` does not see it, and it
 * reads the run's state only through the arguments the questions already
 * carry.
 *
 * The lines are inputs, not outcomes: what the player chose, never what the
 * sim did. R11 still forbids the battle log at rest; this is not it.
 */
import type { AcquisitionDecision, AcquisitionOffer } from '../core/acquisition';
import type { NodeSpec } from '../core/encounters';
import type { ShopStock } from '../core/economy';
import type { EventInstance } from '../core/events';
import type { EvolutionQuestion } from '../core/evolution';
import { describeReward, type BerryPick, type RewardOffer } from '../core/rewards';
import type { RunPolicy, RunState } from '../core/run';
import type { BattleView, ItemPlan, PokemonState, RunDecision, RunLog } from '../core/types';
import { eventLabel } from '../data/eventCopy';
import { itemName } from '../data/items';
import { localeById, type LocaleId } from '../data/locales';
import { FEED_COPY } from './copy/feed';

export interface FeedEntry {
  /** The decision's index in the log. */
  index: number;
  kind: RunDecision['kind'];
  /** The segment the decision was made in, from the latest state a question carried. */
  segment: number;
  text: string;
}

export interface DecisionFeed {
  /** The policy to hand `playRun`. Answers exactly what `inner` answers. */
  policy: RunPolicy;
  /** Call from `onDecision`. Turns every entry not yet seen into a line. */
  record(log: RunLog): void;
  entries(): readonly FeedEntry[];
  /** Called after each new entry. Returns the unsubscribe. */
  subscribe(listener: (entries: readonly FeedEntry[]) => void): () => void;
}

type Names = string[];

/** Species, not nicknames: the species is the label everywhere (patch 4.8.0.1). */
const namesOf = (party: readonly PokemonState[]): Names => party.map((member) => member.spec.species);

export function createDecisionFeed(inner: RunPolicy): DecisionFeed {
  const entries: FeedEntry[] = [];
  const listeners = new Set<(entries: readonly FeedEntry[]) => void>();

  /*
   * The context each question left behind, overwritten by the next question
   * of its kind. One slot per kind is enough because the run asks a question
   * and logs its answer before it asks the next one of the same kind.
   */
  let segment = 0;
  let party: Names = [];
  let starters: readonly { species: string }[] = [];
  let locales: readonly LocaleId[] = [];
  let nodes: readonly NodeSpec[] = [];
  let offer: RewardOffer | null = null;
  let pick: BerryPick | null = null;
  let stock: ShopStock | null = null;
  let event: EventInstance | null = null;
  let acquisition: { offer: AcquisitionOffer; party: Names } | null = null;
  let evolution: EvolutionQuestion | null = null;
  let view: BattleView | null = null;
  let leadParty: Names = [];

  const seen = (state: RunState | undefined): void => {
    if (!state) return;
    segment = state.currentSegment;
    party = namesOf(state.party);
  };

  // One wording for a layout, whether a boundary's plan or an ad hoc
  // `items` edit carried it (bible Rev 23, D94).
  const describePlan = (plan: ItemPlan): string => {
    const { assignments, teaches, discards, discardTms } = plan;
    const parts = [
      ...assignments.map((assignment) =>
        assignment.item ? FEED_COPY.held(itemName(assignment.item), party[assignment.slot] ?? '') : FEED_COPY.unheld(party[assignment.slot] ?? ''),
      ),
      ...teaches.map((teach) => FEED_COPY.taught(teach.move, party[teach.slot] ?? '')),
      ...discards.map((id) => FEED_COPY.discarded(itemName(id))),
      ...discardTms.map((move) => FEED_COPY.discarded(move)),
    ];
    return FEED_COPY.items(parts);
  };

  const line = (decision: RunDecision): string => {
    switch (decision.kind) {
      case 'starter':
        return FEED_COPY.starter(starters[decision.index]?.species ?? '');
      case 'locale': {
        const id = locales[decision.index];
        return FEED_COPY.locale(id ? localeById(id).name : '');
      }
      case 'node': {
        const node = nodes[decision.index];
        return node ? FEED_COPY.node(node.kind, node.tier) : FEED_COPY.node('wild', null);
      }
      case 'battle': {
        const choice = decision.choice;
        if (choice.kind === 'move') {
          return FEED_COPY.move(view?.moves.find((move) => move.slot === choice.slot)?.name ?? '');
        }
        return FEED_COPY.switchTo(view?.switches.find((member) => member.slot === choice.slot)?.species ?? '');
      }
      case 'reward': {
        const reward = offer?.options[decision.index];
        return FEED_COPY.reward(reward ? describeReward(reward) : '');
      }
      case 'berry': {
        const berry = pick?.berries[decision.index];
        return FEED_COPY.berry(berry ? itemName(berry) : '');
      }
      case 'shop': {
        const bought = decision.indexes.map((index) => stock?.items[index]?.reward).flatMap((reward) => (reward ? [describeReward(reward)] : []));
        return FEED_COPY.shop(bought);
      }
      case 'event':
        return FEED_COPY.event(event ? eventLabel(event.eventId, decision.archetype) : '');
      case 'acquisition': {
        const species = acquisition?.offer.spec.species ?? '';
        const answer: AcquisitionDecision = decision.decision;
        if (answer.kind === 'decline') return FEED_COPY.declined(species);
        if (answer.kind === 'accept') return FEED_COPY.caught(species);
        const released = acquisition?.party[answer.slot] ?? '';
        return FEED_COPY.caughtReleasing(species, released);
      }
      case 'items':
        return describePlan(decision.plan);
      case 'lead':
        return FEED_COPY.lead(leadParty[decision.index] ?? '');
      case 'party': {
        const edit = decision.edit;
        if (edit.kind === 'items') return describePlan(edit.plan);
        if (edit.kind === 'release') {
          const name = party[edit.slot] ?? '';
          party = party.filter((_, slot) => slot !== edit.slot);
          return FEED_COPY.released(name);
        }
        const name = party[edit.from] ?? '';
        const next = [...party];
        const [moved] = next.splice(edit.from, 1);
        if (moved !== undefined) next.splice(edit.to, 0, moved);
        party = next;
        return FEED_COPY.reordered(name, edit.to);
      }
      case 'evolve': {
        const from = evolution?.member.spec.species ?? '';
        const to = evolution?.options[decision.index]?.species ?? '';
        return FEED_COPY.evolved(from, to);
      }
    }
  };

  const policy: RunPolicy = {
    ...inner,
    chooseStarter: (options) => {
      starters = options;
      return inner.chooseStarter(options);
    },
    chooseLocale: (options, state) => {
      seen(state);
      locales = options;
      return inner.chooseLocale(options, state);
    },
    chooseNode: (options, state) => {
      seen(state);
      nodes = options;
      return inner.chooseNode(options, state);
    },
    chooseReward: (next, state) => {
      seen(state);
      offer = next;
      return inner.chooseReward(next, state);
    },
    chooseShopPurchases: (next, state) => {
      seen(state);
      stock = next;
      return inner.chooseShopPurchases(next, state);
    },
    chooseEventOption: (next, state) => {
      seen(state);
      event = next;
      return inner.chooseEventOption(next, state);
    },
    chooseAcquisition: (next, members, capacity) => {
      acquisition = { offer: next, party: namesOf(members) };
      return inner.chooseAcquisition(next, members, capacity);
    },
    chooseLead: (members, gym, state) => {
      seen(state);
      leadParty = namesOf(members);
      return inner.chooseLead(members, gym, state);
    },
    chooseEvolution: (question, state) => {
      seen(state);
      evolution = question;
      return inner.chooseEvolution(question, state);
    },
    chooseBerry: (next, state) => {
      seen(state);
      pick = next;
      return inner.chooseBerry(next, state);
    },
    chooseItemPlan: (state) => {
      seen(state);
      return inner.chooseItemPlan(state);
    },
    battle: (next) => {
      view = next;
      return inner.battle(next);
    },
  };
  /*
   * `playRun` branches on whether these two exist, so the wrapper has them
   * exactly when `inner` does. A normal node's card is chosen here, before
   * the capture question, and logged after it.
   */
  if (inner.reviewBattle) {
    const review = inner.reviewBattle;
    policy.reviewBattle = (next, state) => {
      seen(state);
      offer = next.offer;
      return review(next, state);
    };
  }

  return {
    policy,
    record(log) {
      for (let index = entries.length; index < log.decisions.length; index++) {
        const decision = log.decisions[index] as RunDecision;
        entries.push({ index, kind: decision.kind, segment, text: line(decision) });
      }
      for (const listener of listeners) listener(entries);
    },
    entries: () => entries,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
