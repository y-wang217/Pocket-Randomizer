/**
 * Wiring: turn clicks into run decisions and run state into screens.
 *
 * The whole app is one call to `playRun` with a `RunPolicy` whose three
 * promises resolve on clicks — the same call `test/run.test.ts` makes with a
 * scripted policy and `scripts/sweep.ts` makes two hundred times in a row. That
 * is the payoff of the run-policy seam: there is no separate "interactive run
 * loop" to keep in sync with the headless one, because there is only one loop.
 *
 * This file owns exactly two things core/ cannot: where the first seed comes
 * from, and what a click means. Everything else it asks for.
 */
import { greedyAiPolicy } from '../core/battle/ai';
import type { BattleSession } from '../core/battle/driver';
import { GYMRUN_FORMAT } from '../core/battle/format';
import { PARTY_SIZE } from '../data/partyTuning';
import type { NodeSpec } from '../core/encounters';
import type { AcquisitionDecision } from '../core/acquisition';
import { releaseMember, reorderParty } from '../core/party';
import { normalizeSeed } from '../core/rng';
import {
  isReplayable,
  playRun,
  resumeRun,
  type RunPolicy,
  type RunResult,
  type RunState,
} from '../core/run';
import type { Choice, PokemonSpec, RunLog } from '../core/types';
import { DEFAULT_TUNING } from '../data/tuning';
import { createPending } from './pending';
import { createTooltips } from './tooltips';
import { el } from './scene';
import { newSeed, seedFromLocation, writeSeedToLocation } from './seed';
import { createBattleScreen } from './screens/battle';
import { createEventScreen } from './screens/event';
import { createAcquisitionScreen } from './screens/acquisition';
import { createItemTargetScreen } from './screens/item-target';
import { createPartyScreen } from './screens/party';
import { createRewardScreen } from './screens/reward';
import { createRouter } from './screens/router';
import { createShopScreen } from './screens/shop';
import { createRunMap } from './screens/run-map';
import { createStarterSelect } from './screens/starter-select';
import { createSummary } from './screens/summary';
import { clearRunLog, loadRunLog, saveRunLog } from './storage';

export function mountApp(root: HTMLElement): void {
  const starterScreen = createStarterSelect();
  const mapScreen = createRunMap();
  const battleScreen = createBattleScreen();
  const rewardScreen = createRewardScreen();
  const shopScreen = createShopScreen();
  const eventScreen = createEventScreen();
  const targetScreen = createItemTargetScreen();
  const acquisitionScreen = createAcquisitionScreen();
  const partyScreen = createPartyScreen();
  const summaryScreen = createSummary();

  const router = createRouter({
    starter: starterScreen.root,
    map: mapScreen.root,
    battle: battleScreen.root,
    reward: rewardScreen.root,
    target: targetScreen.root,
    acquisition: acquisitionScreen.root,
    party: partyScreen.root,
    shop: shopScreen.root,
    event: eventScreen.root,
    summary: summaryScreen.root,
  });

  const seedBar = createSeedBar();
  const shell = el('main', 'shell');
  shell.append(createHeader(), seedBar.root, router.root);
  root.replaceChildren(shell);

  /*
   * One tooltip layer for the whole app, mounted once.
   *
   * Delegated from the shell rather than from the battle screen, so a type
   * badge on the starter select or the party screen works for free — every one
   * of those already renders `.type` chips, and Stage 4.5's rule is that a type
   * badge is a door into the reference wheel wherever it appears.
   */
  createTooltips(shell);

  /** Tears down the run currently on screen, if any. */
  let abandon: (() => void) | null = null;

  async function start(seed: string, resume?: RunLog): Promise<void> {
    abandon?.();

    seedBar.setSeed(seed);
    writeSeedToLocation(seed);

    const starterPick = createPending<number>();
    const nodePick = createPending<number>();
    const movePick = createPending<Choice>();
    const rewardPick = createPending<number>();
    const targetPick = createPending<number>();
    const acquirePick = createPending<AcquisitionDecision>();
    const shopBasket = createPending<number[]>();
    const eventPick = createPending<number>();
    let detachBattle: (() => void) | null = null;
    const releaseBattle = (): void => {
      detachBattle?.();
      detachBattle = null;
    };

    abandon = () => {
      starterPick.cancel();
      nodePick.cancel();
      movePick.cancel();
      rewardPick.cancel();
      targetPick.cancel();
      acquirePick.cancel();
      shopBasket.cancel();
      eventPick.cancel();
      releaseBattle();
    };

    const policy: RunPolicy = {
      chooseStarter: (options: PokemonSpec[]) => {
        starterScreen.render(options, (index) => starterPick.submit(index));
        router.show('starter');
        return starterPick.wait();
      },
      chooseNode: (options: NodeSpec[]) => {
        // The map is already rendered by onState; this only arms the buttons.
        void options;
        router.show('map');
        return nodePick.wait();
      },
      chooseReward: (offer, state) => {
        rewardScreen.render(offer, state, (index) => rewardPick.submit(index));
        router.show('reward');
        return rewardPick.wait();
      },
      chooseShopPurchases: (stock, state) => {
        shopScreen.render(stock, state, (indexes) => shopBasket.submit(indexes));
        router.show('shop');
        return shopBasket.wait();
      },
      chooseEventOption: (event, state) => {
        // The event screen holds the run open between the pick and the reveal:
        // it resolves this promise on "Carry on", not on the choice itself.
        eventScreen.render(event, state, (index) => eventPick.submit(index));
        router.show('event');
        return eventPick.wait();
      },
      chooseItemTarget: (reward, party) => {
        targetScreen.render(reward, party, (slot) => targetPick.submit(slot));
        router.show('target');
        return targetPick.wait();
      },
      chooseAcquisition: (offer, party) => {
        acquisitionScreen.render(offer, party, (decision) => acquirePick.submit(decision));
        router.show('acquisition');
        return acquirePick.wait();
      },
      battle: () => movePick.wait(),
    };

    /*
     * The party the map screen is currently showing.
     *
     * Held here rather than read back out of `playRun`, because the party
     * screen edits state *between* decisions — a reorder is not a run decision
     * and is not in the log (see `screens/party.ts`) — so there has to be one
     * object both screens agree is the current party. `onState` replaces it
     * whenever the run advances; the party screen mutates it in place through
     * `core/party.ts` and re-renders both.
     */
    let live: RunState | null = null;

    const showParty = (): void => {
      const state = live;
      if (!state) return;
      partyScreen.render(state.party, {
        onReorder: (from, to) => {
          state.party = reorderParty(state.party, from, to);
          showParty();
          mapScreen.render(state, (index) => nodePick.submit(index), showParty);
        },
        onRelease: (slot) => {
          state.party = releaseMember(state.party, slot);
          showParty();
          mapScreen.render(state, (index) => nodePick.submit(index), showParty);
        },
        onDone: () => router.show('map'),
      });
      router.show('party');
    };

    const onState = (state: RunState): void => {
      // Rendering on every transition, not only when a choice is pending, is
      // what makes a rest node visible: it resolves without a decision, so the
      // only evidence it happened is the party panel refilling.
      live = state;
      mapScreen.render(state, (index) => nodePick.submit(index), showParty);
    };

    const onBattle = (session: BattleSession, node: NodeSpec, state: RunState): void => {
      releaseBattle();
      /*
       * The reveal policy comes off the run's own tuning, not off the module
       * default, so a run started with a swept tuning shows what that run was
       * configured to show. Two booleans rather than the whole object: see the
       * header of screens/battle.ts.
       */
      const reveal = {
        ability: state.tuning.revealOpponentAbility,
        item: state.tuning.revealOpponentItem,
      };
      detachBattle = battleScreen.attach(session, node, reveal, (choice) => {
        // A click with nothing pending is a no-op, not a decision queued
        // against the following turn.
        movePick.submit(choice);
      });
      router.show('battle');
    };

    try {
      const options = { onState, onBattle, onDecision: saveRunLog, opponent: greedyAiPolicy };
      const result: RunResult = resume
        ? await resumeRun(resume, policy, DEFAULT_TUNING, options)
        : await playRun(seed, policy, DEFAULT_TUNING, options);

      releaseBattle();
      // Leave the map showing the run as it finished, behind the summary.
      mapScreen.render(result.state, () => undefined, () => undefined);
      summaryScreen.render(result);
      router.show('summary');
      // The run is over: a saved log now would resume into a finished run.
      clearRunLog();
    } catch {
      // The only way out of playRun other than a finished run is an abandoned
      // pending decision, which happens when the player starts a different one.
    }
  }

  seedBar.onSubmit((value) => {
    void start(normalizeSeed(value) || newSeed());
  });
  seedBar.onReroll(() => {
    void start(newSeed());
  });
  seedBar.onResume(() => {
    const saved = loadRunLog();
    if (saved && isReplayable(saved)) void start(saved.seed, saved);
  });
  summaryScreen.onReplaySeed((seed) => {
    void start(seed);
  });
  summaryScreen.onNewSeed(() => {
    void start(newSeed());
  });

  const saved = loadRunLog();
  seedBar.setResumable(Boolean(saved && isReplayable(saved)));

  const fromUrl = seedFromLocation(globalThis.location.href);
  // A seed in the URL is an explicit request for *that* run, so it wins over a
  // save. Without one, an interrupted run is resumed where it left off.
  if (fromUrl) void start(fromUrl);
  else if (saved && isReplayable(saved)) void start(saved.seed, saved);
  else void start(newSeed());
}

function createHeader(): HTMLElement {
  const header = el('header', 'header');
  const title = el('h1', 'header__title');
  title.textContent = 'GYMRUN';
  const subtitle = el('p', 'header__subtitle');
  subtitle.textContent = `Stage 4 · ${GYMRUN_FORMAT} · a party of ${PARTY_SIZE}, and somewhere to switch to`;
  header.append(title, subtitle);
  return header;
}

interface SeedBar {
  root: HTMLElement;
  setSeed(seed: string): void;
  setResumable(resumable: boolean): void;
  onSubmit(handler: (seed: string) => void): void;
  onReroll(handler: () => void): void;
  onResume(handler: () => void): void;
}

/**
 * The seed, displayed and editable at run start.
 *
 * A tester who can type a seed and get the identical run back is the cheapest
 * bug-reporting tool this project will ever have, which is why it is in the UI
 * rather than behind a debug flag.
 */
function createSeedBar(): SeedBar {
  const root = el('form', 'seedbar');
  const label = el('label', 'seedbar__label');
  label.textContent = 'Seed';

  const input = document.createElement('input');
  input.className = 'seedbar__input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Run seed');
  label.setAttribute('for', (input.id = 'seed-input'));

  const apply = document.createElement('button');
  apply.type = 'submit';
  apply.className = 'button button--primary';
  apply.textContent = 'Start run';

  const reroll = document.createElement('button');
  reroll.type = 'button';
  reroll.className = 'button';
  reroll.textContent = 'New seed';

  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'button';
  resume.textContent = 'Resume saved run';
  resume.hidden = true;

  root.append(label, input, apply, reroll, resume);

  return {
    root,
    setSeed: (seed) => {
      input.value = seed;
    },
    setResumable: (resumable) => {
      resume.hidden = !resumable;
    },
    onSubmit: (handler) =>
      root.addEventListener('submit', (event) => {
        event.preventDefault();
        handler(input.value);
      }),
    onReroll: (handler) => reroll.addEventListener('click', () => handler()),
    onResume: (handler) => resume.addEventListener('click', () => handler()),
  };
}
