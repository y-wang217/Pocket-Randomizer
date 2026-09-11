/**
 * @vitest-environment jsdom
 *
 * The pre-gym screen's confirm, and the softlock it exists to close.
 *
 * Stage 4.7 gave the gym a beat and one decision: who leads. It built that
 * decision entirely out of *change* controls — slot 0's own button is inert
 * because slot 0 already leads, and a fainted member's is inert because
 * `chooseLead` would refuse it. On a party of one that is every button on the
 * screen, so there was no control on it that submitted anything and the run
 * stopped there. The default being "change nothing" does not submit itself.
 *
 * Two halves, and they have to agree. The screen's confirm answers
 * `chooseLead` with `defaultLeadSlot(party)`; a headless run answering the same
 * way plays a solo party through five gyms. If the two ever disagree, a run
 * driven by the screen and a run driven by a policy stop being the same run.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import { createPreGymScreen, defaultLeadSlot } from '../src/ui/screens/pre-gym';
import { greedyAiPolicy } from '../src/core/battle/ai';
import { battleMembersFor, createParty, leadRefusal } from '../src/core/party';
import { playRun, scriptedRunPolicy } from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { gymForSegment } from '../src/data/gyms';
import { DEFAULT_TUNING } from '../src/data/tuning';

const ROSTER = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Body Slam', 'Rest'], level: 30 },
  { species: 'Gengar', ability: 'Levitate', moves: ['Shadow Ball', 'Toxic'], level: 30 },
  { species: 'Lapras', ability: 'Water Absorb', moves: ['Surf', 'Ice Beam'], level: 30 },
  { species: 'Scyther', ability: 'Swarm', moves: ['Slash', 'Agility'], level: 30 },
  { species: 'Onix', ability: 'Sturdy', moves: ['Rock Slide', 'Earthquake'], level: 30 },
  { species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt', 'Thunder Wave'], level: 30 },
];

/** A party of `size`, with the members at `downed` fainted. */
function partyOf(size: number, downed: number[] = []): PokemonState[] {
  return createParty(ROSTER.slice(0, size)).map((member, index) => ({ ...member, fainted: downed.includes(index) }));
}

/** Mount the screen on a party and report what it submitted, if anything. */
function mount(party: readonly PokemonState[]) {
  const screen = createPreGymScreen();
  const submitted: number[] = [];
  screen.render(
    { gym: gymForSegment(0), segment: 0, party, holding: party.map(() => null), tuning: DEFAULT_TUNING },
    { onLead: (slot) => submitted.push(slot), onManageParty: () => undefined },
  );
  document.body.replaceChildren(screen.root);
  const enabled = (): HTMLButtonElement[] => [...screen.root.querySelectorAll('button')].filter((button) => !button.disabled);
  return { root: screen.root, submitted, enabled };
}

describe('defaultLeadSlot', () => {
  it('is the lowest living slot, which is who the battle would send first', () => {
    expect(defaultLeadSlot(partyOf(1))).toBe(0);
    expect(defaultLeadSlot(partyOf(3))).toBe(0);
    expect(defaultLeadSlot(partyOf(3, [0]))).toBe(1);
    expect(defaultLeadSlot(partyOf(3, [0, 1]))).toBe(2);
  });

  it('never names a slot `chooseLead` would refuse, at any size or damage', () => {
    /*
     * The confirm's answer goes straight into `core/run.chooseLead`, which
     * throws rather than clamping. Every party shape a run can arrive at the
     * gym with, therefore, has to produce a legal slot — swept rather than
     * spot-checked, because the fainted patterns are where this would break.
     */
    for (let size = 1; size <= ROSTER.length; size++) {
      for (let mask = 0; mask < 1 << size; mask++) {
        const downed = [...Array(size).keys()].filter((slot) => mask & (1 << slot));
        if (downed.length === size) continue; // a wiped party never reaches a gym
        const party = partyOf(size, downed);
        const slot = defaultLeadSlot(party);
        expect(leadRefusal(party, slot), `size ${size}, fainted ${downed.join()}`).toBe(null);
        // And it is genuinely the member the battle sends, not merely a legal one.
        expect(battleMembersFor(party)[0]).toBe(party[slot]);
      }
    }
  });
});

describe('the pre-gym screen', () => {
  beforeEach(() => document.body.replaceChildren());

  it('gives a party of one a control that leaves the screen', () => {
    /*
     * The regression itself. Before the confirm, this party's only button was
     * slot 0's inert "Leading" and the screen could not be left at all.
     */
    const { submitted, enabled } = mount(partyOf(1));
    expect(enabled().length).toBeGreaterThan(0);

    const confirm = enabled().find((button) => button.classList.contains('pre-gym__confirm'));
    expect(confirm, 'no confirm on a party of one').toBeDefined();
    confirm!.click();
    expect(submitted).toEqual([0]);
  });

  it('confirms the current lead at every party size', () => {
    for (let size = 1; size <= ROSTER.length; size++) {
      document.body.replaceChildren();
      const { submitted, root } = mount(partyOf(size));
      const confirm = root.querySelector<HTMLButtonElement>('.pre-gym__confirm');
      expect(confirm?.disabled, `size ${size}`).toBe(false);
      confirm!.click();
      expect(submitted, `size ${size}`).toEqual([0]);
    }
  });

  it('names the member it sends, so the confirm reads as a fact about the party', () => {
    const { root } = mount(partyOf(3));
    expect(root.querySelector('.pre-gym__confirm')?.textContent).toBe('Send Snorlax in');
  });

  it('confirms the first living member when the lead walked out of the last node down', () => {
    /*
     * Slot 0 fainted. `battleMembersFor` filters it, so the member that leads
     * is slot 1 either way — the confirm submitting 1 is the reorder the battle
     * would have performed anyway, and unlike submitting 0 it is not refused.
     */
    const party = partyOf(3, [0]);
    const { submitted, root } = mount(party);
    expect(root.querySelector('.pre-gym__confirm')?.textContent).toBe('Send Gengar in');
    root.querySelector<HTMLButtonElement>('.pre-gym__confirm')!.click();
    expect(submitted).toEqual([1]);
    expect(leadRefusal(party, submitted[0]!)).toBe(null);
  });

  it('still offers the other members as a change of lead', () => {
    // The confirm is an addition, not a replacement: picking somebody else is
    // the decision the screen exists for and it still submits that slot.
    const { submitted, root } = mount(partyOf(3));
    // The lead controls alone: since the density modes patch each card also
    // carries its Pocket fold toggle, which is a control about the card.
    const slots = [...root.querySelectorAll<HTMLButtonElement>('.pre-gym__slot .pre-gym__choose')];
    expect(slots.map((button) => button.disabled)).toEqual([true, false, false]);
    slots[2]!.click();
    expect(submitted).toEqual([2]);
  });

  it('shows one accent, and it is the confirm', () => {
    // The V0 rule: never two primary actions on a screen. The confirm is the
    // control that leaves, so it is the one that carries the accent.
    const { root } = mount(partyOf(3));
    const accents = [...root.querySelectorAll('.primary-action')];
    expect(accents).toHaveLength(1);
    expect(accents[0]!.classList.contains('pre-gym__confirm')).toBe(true);
  });
});

describe('a solo party, headless', () => {
  it('reaches the gym battle and clears gyms on the confirm alone', async () => {
    /*
     * The other half of the softlock, proved against a real run rather than a
     * fixture: a policy that declines every acquisition keeps the party at the
     * starter, so every gym on this seed is faced by a party of exactly one —
     * the shape the screen could not leave. Answering `chooseLead` the way the
     * confirm answers it walks that run through its gyms.
     */
    const sizes: number[] = [];
    const run = await playRun(
      'SOLO-1',
      {
        ...scriptedRunPolicy(greedyAiPolicy),
        chooseAcquisition: async () => ({ kind: 'decline' }),
        chooseLead: async (party) => {
          sizes.push(party.length);
          return defaultLeadSlot(party);
        },
      },
      DEFAULT_TUNING,
    );

    expect(sizes.length, 'this seed never reached a gym').toBeGreaterThan(0);
    expect(new Set(sizes), 'a gym was faced with more than one member').toEqual(new Set([1]));

    const gyms = run.state.history.filter((visit) => visit.node.kind === 'gym').length;
    expect(gyms).toBe(sizes.length);

    // Every lead is followed straight by the gym fight it confirmed, so the
    // screen's answer really did reach a battle rather than ending the run.
    const decisions = run.log.decisions;
    for (const [index, decision] of decisions.entries()) {
      if (decision.kind === 'lead') expect(decisions[index + 1]?.kind).toBe('battle');
    }
  }, 180_000);
});
