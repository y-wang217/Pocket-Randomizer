/**
 * The wallet on the tabs a player checks, and the capture card's held item
 * without a `to bag` that reads as a control. **2026-10-08,
 * `docs/spec/gymrun-patch-wallet-on-tabs-and-to-bag.md`.**
 *
 * The wallet is one component (`walletFigure`) on Team, Bag, the read-only
 * drawer, Run Info and the Map tab's overlay. Mid-node its number is the
 * projection's, so the first test holds that number to what `resolveNode`
 * produces: a tab opened over the result screen must say what the result
 * screen's header says, and what the run will hold.
 *
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createParty } from '../src/core/party';
import {
  chooseStarter,
  createRun,
  playRun,
  scriptedRunPolicy,
  type RunProjection,
  type RunState,
} from '../src/core/run';
import type { PokemonState } from '../src/core/types';
import { partyCapacityAfter } from '../src/data/partyTuning';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { openBandOf } from '../src/ui/band';
import { createDrawer } from '../src/ui/drawer';
import { createMapDrawer } from '../src/ui/map-drawer';
import { createRunInfo } from '../src/ui/run-info';
import { renderCaptureOffer } from '../src/ui/screens/acquisition';
import { createPartyScreen } from '../src/ui/screens/party';

const SEEDS = ['WALLET-0', 'WALLET-1', 'WALLET-2', 'WALLET-3'];

afterEach(() => {
  openBandOf()?.close();
  document.body.replaceChildren();
});

const walletText = (root: ParentNode): string | null =>
  root.querySelector('.wallet .coin-amount[data-tip="currency:wallet"]')?.textContent ?? null;

function walking(): RunState {
  const state = { ...chooseStarter(createRun('WALLET-UI', DEFAULT_TUNING), 0), currency: 137 };
  return { ...state, localeChoices: state.localeChoices.map((_, index) => (index === 0 ? 0 : null)) };
}

describe('the projected wallet is the wallet the run lands on', () => {
  it('matches resolveNode at every fight that is not an event or a shop', async () => {
    let compared = 0;
    let paid = 0;
    for (const seed of SEEDS) {
      let last: RunProjection | null = null;
      // Cards answered on the result screen, as the app answers them: the
      // projection reads the taken card off that answer.
      const base = scriptedRunPolicy(greedyAiPolicy);
      const policy = { ...base, reviewBattle: async (review: { offer: unknown }) => (review.offer ? 0 : null) };
      await playRun(seed, policy, DEFAULT_TUNING, {
        opponent: greedyAiPolicy,
        onProjection: (projection) => {
          last = projection;
        },
        onNodeResolved: (before, after, result) => {
          const projection = last as RunProjection | null;
          last = null;
          // An event's Toll and a shop's basket are folded by their own
          // screens' reveal and band, not projected; a fight is.
          if (!projection || !result.battle || result.node.event || result.node.shop || result.node.kind === 'gym') return;
          expect(projection.currency, `${seed} ${result.node.id}`).toBe(after.currency);
          compared++;
          if (after.currency > before.currency) paid++;
        },
      });
    }
    expect(compared).toBeGreaterThan(0);
    expect(paid, 'no fight paid anything, so the payout was never projected').toBeGreaterThan(0);
  });
});

describe('the wallet on each tab', () => {
  it('sits on the Team and Bag screens', () => {
    for (const focus of ['team', 'bag'] as const) {
      const screen = createPartyScreen();
      screen.render(
        {
          party: walking().party,
          currency: 137,
          focus,
          backpack: [],
          tms: [],
          teachable: new Set([]),
          relics: [],
          tuning: DEFAULT_TUNING,
          slots: partyCapacityAfter(0),
          backTo: 'Back to the map',
          plan: null,
        },
        { onReorder: () => undefined, onRelease: () => undefined, onPlan: () => undefined, onTeach: () => undefined, onDone: () => undefined },
      );
      expect(walletText(screen.root), focus).toBe('137');
    }
  });

  it('opens the read-only drawer on it, on both tabs', () => {
    const drawer = createDrawer();
    const members = walking().party;
    for (const focus of ['team', 'bag'] as const) {
      drawer.open({ party: members, holding: members.map(() => null), relics: [], currency: 88, tuning: DEFAULT_TUNING, focus });
      expect(walletText(drawer.root), focus).toBe('88');
    }
  });

  it('is in Run Info and the Map tab, with the projected number when it is handed one', () => {
    const state = walking();
    const info = createRunInfo();
    info.open({ state, entries: [], currency: 170 });
    expect(walletText(info.overlay.root)).toBe('170');
    const map = createMapDrawer();
    map.open(state, null, 170);
    expect(walletText(map.root)).toBe('170');
    map.open(state);
    expect(walletText(map.root), 'with no projection the run\'s own coins').toBe('137');
  });
});

describe('the capture card on a full party', () => {
  function holder(): PokemonState[] {
    const party = createParty([
      { species: 'Pachirisu', ability: 'Volt Absorb', moves: ['Spark'], level: 26 },
      { species: 'Magby', ability: 'Flame Body', moves: ['Ember'], level: 26 },
    ]);
    return [{ ...party[0]!, item: 'eviolite' }, party[1]!];
  }

  it('names the held item with no `to bag` beside it', () => {
    const card = renderCaptureOffer(
      { nodeId: 's2-1-0', source: 'encounter', spec: { species: 'Klawf', ability: 'Anger Shell', moves: ['Rock Slide'], level: 26 } },
      holder(),
      () => undefined,
      2,
    );
    document.body.append(card);
    expect(card.textContent ?? '').not.toMatch(/to bag|returns to your bag/i);
    expect(card.querySelector('[data-tip="item:eviolite"]')).not.toBeNull();
  });

  it('says in the release band which item goes back to the bag', () => {
    const card = renderCaptureOffer(
      { nodeId: 's2-1-0', source: 'encounter', spec: { species: 'Klawf', ability: 'Anger Shell', moves: ['Rock Slide'], level: 26 } },
      holder(),
      () => undefined,
      2,
    );
    document.body.append(card);
    const releases = [...card.querySelectorAll<HTMLButtonElement>('.button--danger')];
    expect(releases).toHaveLength(2);
    releases[0]!.click();
    expect(document.body.querySelector('.confirm-band')?.textContent ?? '').toContain('Eviolite goes back to the bag.');
    openBandOf()?.close();
    releases[1]!.click();
    expect(document.body.querySelector('.confirm-band')?.textContent ?? '').not.toMatch(/back to the bag/);
  });
});
