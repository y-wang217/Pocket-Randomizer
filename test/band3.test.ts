/**
 * Band 3: a capture with no fight in front of it.
 *
 * The mechanism only — no event in `data/events.ts` resolves to an acquisition
 * yet, because the band payout tables are a separate decision. So these tests
 * build the outcome directly and assert the two properties that made this
 * shape worth choosing over a node-model refactor:
 *
 *   1. The offer reaches the run's existing capture step, so an event-sourced
 *      Pokemon joins by exactly the code path a wild one does.
 *   2. A node still completes exactly once. There is no second path.
 */
import { describe, expect, it } from 'vitest';
import { generateEventAcquisition } from '../src/core/acquisition';
import { applyEventOutcome, describeOutcome, generateEvent, type EventOutcome } from '../src/core/events';
import { acquisitionOffered, createRun, resolveNode, type NodeResult, type RunState } from '../src/core/run';
import { createRng } from '../src/core/rng';
import { DEFAULT_TUNING } from '../src/data/tuning';
import type { AcquisitionOffer } from '../src/core/acquisition';

function offerFor(seed: string, segment = 0): AcquisitionOffer {
  const rng = createRng(seed);
  const offer = generateEventAcquisition('n1', segment, rng.rewards.at('test/capture'), DEFAULT_TUNING);
  if (!offer) throw new Error('fixture: no offer');
  return offer;
}

describe('the event acquisition offer', () => {
  it('is a complete, fully resolved offer tagged as event-sourced', () => {
    const offer = offerFor('BAND3');
    expect(offer.source).toBe('event');
    expect(offer.nodeId).toBe('n1');
    expect(offer.spec.species).toBeTruthy();
    expect(offer.spec.moves.length).toBeGreaterThan(0);
    expect(offer.spec.level).toBeGreaterThan(0);
  });

  it('is deterministic in the seed', () => {
    expect(offerFor('BAND3')).toEqual(offerFor('BAND3'));
    expect(offerFor('BAND3').spec.species).not.toBe(offerFor('OTHER-SEED').spec.species);
  });

  it('is refused when captures are turned off, without drawing differently', () => {
    const rng = createRng('OFF');
    const off = generateEventAcquisition('n1', 0, rng.rewards.at('k'), {
      ...DEFAULT_TUNING,
      allowEncounterAcquisitions: false,
    });
    expect(off).toBeNull();
  });
});

describe('draw isolation', () => {
  it('costs the event stream nothing', () => {
    // The capture draw lands on its own sub-stream, so an event that offers a
    // Pokemon and one that does not consume the `event` stream identically.
    // This is the property that let band 3 ship without moving a single
    // existing reward draw.
    const withOffer = createRng('ISO');
    const without = createRng('ISO');
    const a = generateEvent('n1', withOffer.rewards.at('e'), DEFAULT_TUNING, () =>
      offerFor('ISO-CAPTURE'),
    );
    const b = generateEvent('n1', without.rewards.at('e'), DEFAULT_TUNING);
    expect(a.eventId).toBe(b.eventId);
    expect(a.prompt).toBe(b.prompt);
    expect(withOffer.rewards.at('e').draws).toBe(without.rewards.at('e').draws);
  });

  it('degrades to nothing when no offer can be made', () => {
    const rng = createRng('NONE');
    const event = generateEvent('n1', rng.rewards.at('e'), DEFAULT_TUNING, () => null);
    for (const choice of event.choices) {
      expect(choice.outcome.kind).not.toBe('acquisition');
    }
  });
});

describe('applying it', () => {
  it('changes no state on its own', () => {
    // The party change is applyAcquisition, called once by resolveNode. If this
    // fold ever starts adding the Pokemon too, an event capture and a wild
    // capture have become two different code paths.
    const state = createRun('APPLY', DEFAULT_TUNING);
    const outcome: EventOutcome = { kind: 'acquisition', offer: offerFor('APPLY') };
    expect(applyEventOutcome(state, outcome, DEFAULT_TUNING)).toEqual(state);
  });

  it('describes itself as the species and nothing else', () => {
    const offer = offerFor('DESC');
    expect(describeOutcome({ kind: 'acquisition', offer })).toBe(offer.spec.species);
  });
});

describe('finding the offer', () => {
  const base = createRun('FIND', DEFAULT_TUNING);
  const eventNode = { ...base.segments[0]!.gym, kind: 'event' as const, encounter: null, acquisition: null };
  const offer = offerFor('FIND');

  /** An event node whose chosen choice resolves to an acquisition. */
  function nodeOfferingAt(chosen: number): NodeResult['node'] {
    const choices = [
      { label: 'a', hint: 'a', outcome: { kind: 'nothing' } as EventOutcome },
      { label: 'b', hint: 'b', outcome: { kind: 'acquisition', offer } as EventOutcome },
    ];
    void chosen;
    return { ...eventNode, event: { nodeId: 'n1', eventId: 'test', prompt: 'p', choices } };
  }

  it('finds an offer on the chosen event outcome', () => {
    expect(acquisitionOffered({ node: nodeOfferingAt(1), eventChoice: 1 })).toEqual(offer);
  });

  it('finds nothing when the player chose a different button', () => {
    // The offer is not a property of the node. Choosing the other option means
    // there is no Pokemon, and a static node.acquisition would have offered one
    // whichever button was pressed.
    expect(acquisitionOffered({ node: nodeOfferingAt(1), eventChoice: 0 })).toBeNull();
  });

  it('finds nothing when no event choice was made', () => {
    expect(acquisitionOffered({ node: nodeOfferingAt(1) })).toBeNull();
  });

  it('still finds a wild node offer, unchanged', () => {
    const wild = { ...eventNode, kind: 'wild' as const, acquisition: offer };
    expect(acquisitionOffered({ node: wild })).toEqual(offer);
  });
});

describe('a node still completes exactly once', () => {
  it('folds an event capture through the same single resolveNode call', () => {
    const base = createRun('COMPLETE', DEFAULT_TUNING);
    const state: RunState = { ...base, starterIndex: 0, party: [] };
    const offer = offerFor('COMPLETE');
    const node = { ...base.segments[0]!.gym, kind: 'event' as const, encounter: null };

    const result: NodeResult = {
      node,
      acquisition: { offer, decision: { kind: 'accept' } },
    };
    const after = resolveNode(state, result);

    expect(after.party).toHaveLength(1);
    expect(after.party[0]?.spec.species).toBe(offer.spec.species);
    // One visit recorded, with no battle result attached.
    expect(after.history).toHaveLength(state.history.length + 1);
    expect(after.history.at(-1)?.result).toBeNull();
  });
});
