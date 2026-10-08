/**
 * The party a restore leaves, shown before it is claimed, and one encoding
 * for every coin amount. **2026-10-08, `docs/spec/gymrun-patch-potion-hp-and-currency.md`.**
 *
 * The preview is the claim band's content, so the claim it supports is only
 * as good as the number. It is asserted the way CLAUDE.md asks a price's
 * payability to be answered: against what the run actually does. Every
 * restore taken and every heal bought across a handful of seeds is previewed,
 * then the node is resolved, and the party `resolveNode` produced must be the
 * party the band showed.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { basketCost } from '../src/core/economy';
import type { Reward, RewardOffer } from '../src/core/rewards';
import {
  chooseStarter,
  createRun,
  partyAfterPurchases,
  partyAfterRestore,
  playRun,
  scriptedRunPolicy,
  type BattleReview,
  type RunPolicy,
} from '../src/core/run';
import type { BattleMemberState, PokemonState } from '../src/core/types';
import { openBandOf } from '../src/ui/band';
import { createResultScreen } from '../src/ui/screens/result';

const seeds = ['RESTORE-0', 'RESTORE-1', 'RESTORE-2', 'RESTORE-3', 'RESTORE-4', 'RESTORE-5'];

const hpOf = (party: readonly PokemonState[]): string[] =>
  party.map((member) => `${member.spec.species} ${member.hp}/${member.maxHp}${member.fainted ? ' fainted' : ''}`);

afterEach(() => {
  openBandOf()?.close();
  document.body.replaceChildren();
});

describe('the restore preview is the party the run produces', () => {
  it('matches resolveNode for every restore taken and every heal bought', async () => {
    let compared = 0;
    let belowFull = 0;
    for (const seed of seeds) {
      const base = scriptedRunPolicy(greedyAiPolicy);
      let expected: PokemonState[] | null = null;
      const policy: RunPolicy = {
        ...base,
        // Take a restore whenever one is offered, so the seeds exercise it.
        reviewBattle: async (review, state) => {
          if (!review.offer) return null;
          const index = review.offer.options.findIndex((option) => option.kind === 'heal');
          if (index < 0) return 0;
          const heal = review.offer.options[index] as Extract<Reward, { kind: 'heal' }>;
          expected = partyAfterRestore(state, heal.fraction, review);
          return index;
        },
        // Buy the shelf's heals the run can pay for, and nothing else.
        chooseShopPurchases: async (stock, state) => {
          const heals = stock.items.flatMap((item, index) => (item.reward.kind === 'heal' ? [index] : []));
          const basket = heals.filter((_, at) => basketCost(stock, heals.slice(0, at + 1)) <= state.currency);
          if (basket.length > 0) expected = partyAfterPurchases(state, stock, basket);
          return basket;
        },
        // A capture adds a member the preview was never shown; keep the party fixed.
        chooseAcquisition: async () => ({ kind: 'decline' }),
      };
      await playRun(seed, policy, undefined, {
        onNodeResolved: (_before, after) => {
          if (!expected) return;
          expect(hpOf(after.party), seed).toEqual(hpOf(expected));
          compared++;
          if (expected.some((member) => member.hp < member.maxHp)) belowFull++;
          expected = null;
        },
      });
    }
    expect(compared, 'no seed took a restore or bought a heal').toBeGreaterThan(0);
    expect(belowFull, 'every preview was a full party, which proves little').toBeGreaterThan(0);
  });
});

describe('the result screen', () => {
  const member = (state: ReturnType<typeof createRun>): BattleMemberState => {
    const lead = state.party[0]!;
    return { ...lead, hp: Math.max(1, Math.floor(lead.maxHp / 3)) } as BattleMemberState;
  };

  function mount(): { state: ReturnType<typeof createRun>; review: BattleReview; screen: ReturnType<typeof createResultScreen> } {
    const state = { ...chooseStarter(createRun('RESTORE-SCREEN'), 0), currency: 61 };
    const offer: RewardOffer = {
      nodeId: 's0-1-0',
      badge: 'normal',
      options: [
        { kind: 'heal', fraction: 0.5 },
        { kind: 'currency', amount: 41 },
        { kind: 'heal', fraction: 1 },
      ],
    };
    const review = {
      node: { id: 's0-1-0', kind: 'trainer' },
      result: { winner: 'p1', turns: 3 },
      won: true,
      party: [member(state)],
      contribution: [],
      currencyEarned: 29,
      offer,
    } as unknown as BattleReview;
    const screen = createResultScreen();
    document.body.append(screen.root);
    screen.render(review, offer, state, () => undefined);
    return { state, review, screen };
  }

  it('prints the payout and the wallet beside the currency mark, as the coins card is', () => {
    const { screen } = mount();
    const amounts = [...screen.root.querySelectorAll<HTMLElement>('.result__header .coin-amount')];
    expect(amounts.map((node) => node.textContent)).toEqual(['+29', '90']);
    for (const node of amounts) expect(node.querySelector('[data-glyph="currency-coin"]')).not.toBeNull();
    expect(amounts.map((node) => node.dataset['tip'])).toEqual(['currency:earned', 'currency:wallet']);
    // The coins card under it wears the same mark.
    expect(screen.root.querySelector('.reward--currency [data-glyph="currency-coin"]')).not.toBeNull();
  });

  it('opens the restore claim with the party as the restore leaves it', () => {
    const { state, review, screen } = mount();
    screen.root.querySelectorAll<HTMLElement>('.rewards .reward')[0]!.click();
    const band = document.body.querySelector('.confirm-band');
    const slots = [...(band?.querySelectorAll('.restore-preview .slot') ?? [])];
    const after = partyAfterRestore(state, 0.5, review);
    expect(slots).toHaveLength(after.length);
    const lead = after[0]!;
    expect(slots[0]?.querySelector('.slot__detail')?.textContent).toContain(`${lead.hp} / ${lead.maxHp}`);
    // Lower than full, and higher than the fight left it: the preview moved.
    expect(lead.hp).toBeGreaterThan(review.party[0]!.hp);
  });

  it('opens a coins claim with no party in it', () => {
    const { screen } = mount();
    screen.root.querySelectorAll<HTMLElement>('.rewards .reward')[1]!.click();
    expect(document.body.querySelector('.confirm-band .restore-preview')).toBeNull();
  });

  it('marks PP with its glyph on the party slot, apart from the HP reading', () => {
    const { screen } = mount();
    const detail = screen.root.querySelector('.result__party .slot__detail');
    const parts = [...(detail?.querySelectorAll('.slot__detail-part') ?? [])];
    expect(parts).toHaveLength(2);
    expect(parts[1]?.querySelector('[data-glyph="pp"]')).not.toBeNull();
  });
});
