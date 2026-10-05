/**
 * The Defender Mode v0 benchmark bot. **Step 6.**
 *
 * The prompt's bot, exactly: greedy battle policy, the first challenger at
 * every door, never a trade, and a consumable on any member under half HP.
 * Every other answer is `scriptedRunPolicy`'s, the first option, for the reason
 * that policy gives: a baseline with a preference in it measures the
 * preference.
 *
 * **It understates two badges, by construction.** It does not read the
 * Psychic reveal (`BattleView.foeIntent`), and it does not hold a Fire streak:
 * the greedy policy picks the best move each turn with no memory of the last.
 * Nor does it ever press Flying's fifth move unless greedy happens to rank it
 * first. The test of this mode is by hand.
 */
import { greedyAiPolicy } from '../battle/ai';
import { scriptedRunPolicy, type RunPolicy, type RunState } from '../run';
import type { PartyEdit } from '../types';

/** Spend consumables, smallest first, on members under half HP, until none is or the bag is empty. */
function patchUp(state: RunState, edit: ((change: PartyEdit) => void) | null): void {
  if (!edit) return;
  for (let guard = 0; guard < 12; guard++) {
    const id = [...(state.consumables ?? [])].sort()[0];
    const slot = state.party.findIndex((member) => !member.fainted && member.hp > 0 && member.hp * 2 < member.maxHp);
    if (!id || slot < 0) return;
    edit({ kind: 'consume', id, slot });
  }
}

export function defenderBenchPolicy(gymType: number): RunPolicy {
  const base = scriptedRunPolicy(greedyAiPolicy);
  let edit: ((change: PartyEdit) => void) | null = null;
  return {
    ...base,
    bindPartyEditor: (bound) => {
      edit = bound;
    },
    chooseGymType: async () => gymType,
    // First door, and a consumable before walking through it.
    chooseDoor: async (_options, state) => {
      patchUp(state, edit);
      return 0;
    },
    // The first card that is not a trade: the bot never trades.
    chooseReward: async (offer) => Math.max(0, offer.options.findIndex((card) => card.kind !== 'trade')),
    // The intermission's shop and the boss's lead are the other two moments
    // between battles; patch up there too, then answer as the baseline does.
    chooseShopPurchases: async (stock, state) => {
      patchUp(state, edit);
      return base.chooseShopPurchases(stock, state);
    },
    chooseLead: async (party, gym, state) => {
      patchUp(state, edit);
      return base.chooseLead(party, gym, state);
    },
  };
}
