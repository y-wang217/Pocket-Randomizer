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
  defaultItemPlan,
  isReplayable,
  playRun,
  resumeRun,
  type RunPolicy,
  type RunResult,
  type RunState,
} from '../core/run';
import type { Choice, ItemPlan, PokemonSpec, RunLog } from '../core/types';
import { DEFAULT_TUNING } from '../data/tuning';
import { createPending } from './pending';
import { getVerbosity, initSettings, onSettingsChange, setVerbosity } from './settings';
import { createTooltips } from './tooltips';
import { el } from './scene';
import { newSeed, seedFromLocation, writeSeedToLocation } from './seed';
import { createBattleScreen } from './screens/battle';
import { createEventScreen } from './screens/event';
import { createAcquisitionScreen } from './screens/acquisition';
import { createItemTargetScreen } from './screens/item-target';
import { createMoveReplaceScreen } from './screens/move-replace';
import { createPartyScreen } from './screens/party';
import { createResultScreen } from './screens/result';
import { createRouter } from './screens/router';
import { createShopScreen } from './screens/shop';
import { createRunMap } from './screens/run-map';
import { createStarterSelect } from './screens/starter-select';
import { createSummary } from './screens/summary';
import { clearRunLog, loadRunLog, saveRunLog } from './storage';

export function mountApp(root: HTMLElement): void {
  // Before any screen is built, so the first render already reflects the
  // stored preference rather than flipping to it a frame later.
  initSettings();

  const starterScreen = createStarterSelect();
  const mapScreen = createRunMap();
  const battleScreen = createBattleScreen();
  const resultScreen = createResultScreen();
  const shopScreen = createShopScreen();
  const eventScreen = createEventScreen();
  const targetScreen = createItemTargetScreen();
  const replaceScreen = createMoveReplaceScreen();
  const acquisitionScreen = createAcquisitionScreen();
  const partyScreen = createPartyScreen();
  const summaryScreen = createSummary();

  const router = createRouter({
    starter: starterScreen.root,
    map: mapScreen.root,
    battle: battleScreen.root,
    result: resultScreen.root,
    target: targetScreen.root,
    replace: replaceScreen.root,
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
    const rewardPick = createPending<number | null>();
    const targetPick = createPending<number>();
    const replacePick = createPending<number>();
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
      replacePick.cancel();
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
      /*
       * Every battle completion, win or loss, cards or none.
       *
       * This is the hook item D added, and it is the *only* one `playRun` uses
       * for a battle node — so a rewardless win lands on a screen instead of
       * dropping the player back to the map with nothing to say the node
       * happened. Reward cards render inside the result rather than replacing
       * it; taking one is the continue, and when there are none the screen
       * grows a Carry on button instead.
       */
      reviewBattle: (review, state) => {
        resultScreen.render(review, review.offer, state, (index) => rewardPick.submit(index));
        router.show('result');
        return rewardPick.wait();
      },
      /*
       * Required by `RunPolicy` and unreachable from `playRun` while
       * `reviewBattle` is implemented above, because the two are one question
       * and `playRun` asks the richer form when it is offered.
       *
       * Kept honest rather than stubbed: it renders the same screen with the
       * cards alone, which is the shape it had before this stage. A throw here
       * would be a landmine for whoever removes `reviewBattle`.
       */
      chooseReward: async (offer, state) => {
        resultScreen.render(null, offer, state, (index) => rewardPick.submit(index));
        router.show('result');
        return (await rewardPick.wait()) ?? 0;
      },
      /*
       * Auto-planned for now: fill empty hands, discard the overflow.
       *
       * The party screen is where this belongs — the backpack and the party are
       * one screen, and assignment is a player decision — and it is built in the
       * display pass at the end of this stage. Until then the run cannot simply
       * skip the question: a plan that leaves the backpack over capacity is
       * refused, so "ask nothing" would end a run on a thrown RangeError the
       * first time the bag filled. `defaultItemPlan` is the documented reference
       * plan, and it makes the same choice on a replay as it did live.
       */
      /*
       * The layout the player left the party screen with, or the reference plan.
       *
       * The fallback is not a convenience. There is no decline: a plan that
       * leaves the backpack over capacity is refused, so a player who never
       * opens the screen must still produce a legal plan or the run ends on a
       * thrown RangeError the first time the bag fills. `defaultItemPlan` is
       * that legal plan, and it is the same one the scripted baseline gives.
       *
       * Cleared after use, so a plan composed before one node cannot be
       * silently reapplied at the next — by then the party may have changed and
       * the slots would mean something else.
       */
      chooseItemPlan: async (state) => {
        const plan = pendingPlan;
        pendingPlan = null;
        return plan ?? defaultItemPlan(state);
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
      chooseMoveRecipient: (offer, party) => {
        targetScreen.render(offer, party, (slot) => targetPick.submit(slot));
        router.show('target');
        return targetPick.wait();
      },
      /*
       * The second half of a move reward, and the one the app used to answer
       * for the player.
       *
       * It was wired to `defaultMoveReplacement` — the reference heuristic the
       * scripted baseline uses — on the note that the screen would land in a
       * later display pass. That pass did not land, so the reward screen's
       * "you choose what it replaces next" was a promise the app broke every
       * time, silently, by dropping the weakest attack. `core/run.ts` was
       * asking the question and the run log was recording the answer the whole
       * time; only this line was not asking anybody.
       *
       * The heuristic stays where it belongs: `scripts/sim.ts` and the replay
       * baseline still answer with it, which is why it is still exported.
       */
      chooseMoveToReplace: (member, incoming) => {
        replaceScreen.render(member, incoming, (slot) => replacePick.submit(slot));
        router.show('replace');
        return replacePick.wait();
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

    /*
     * The item plan the player has composed on the party screen, if any.
     *
     * Held here between the screen and the next `chooseItemPlan` call, because
     * the two are separated by however long the player spends on the map. Null
     * means they never opened the screen, and the run falls back to the
     * reference plan — which is also what happens on the very first boundary,
     * before the screen has ever been shown.
     */
    let pendingPlan: ItemPlan | null = null;

    const showParty = (): void => {
      const state = live;
      if (!state) return;
      partyScreen.render(
        { party: state.party, backpack: state.backpack, tuning: state.tuning, plan: pendingPlan },
        {
          /*
           * Both of these drop the pending plan, and they have to.
           *
           * A plan names *slots*, and reordering or releasing changes which
           * Pokemon a slot is. Carrying the plan across either would apply the
           * Leftovers the player chose for their Squirtle to whoever ended up
           * in that slot instead — a silent mis-assignment with no error to
           * notice. Dropping it re-seeds the screen from run state, which is
           * the arrangement that is actually true.
           */
          onReorder: (from, to) => {
            pendingPlan = null;
            state.party = reorderParty(state.party, from, to);
            showParty();
            mapScreen.render(state, (index) => nodePick.submit(index), showParty);
          },
          onRelease: (slot) => {
            pendingPlan = null;
            const released = releaseMember(state.party, slot);
            state.party = released.party;
            // Their item goes to the bag, not with them.
            if (released.freed) state.backpack = [...state.backpack, released.freed];
            showParty();
            mapScreen.render(state, (index) => nodePick.submit(index), showParty);
          },
          onPlan: (plan) => {
            pendingPlan = plan;
          },
          onDone: () => router.show('map'),
        },
      );
      router.show('party');
    };

    /*
     * Redraw the open screen when the toggle flips.
     *
     * Without this the new mode would only appear at the next natural
     * re-render, which on the party screen is never — the player would flip the
     * switch and watch nothing happen. The battle screen redraws every turn and
     * would have caught up on its own; the map and party screens would not.
     */
    const unsubscribe = onSettingsChange(() => {
      const state = live;
      if (!state) return;
      mapScreen.render(state, (index) => nodePick.submit(index), showParty);
      if (router.current() === 'party') showParty();
    });

    const previousAbandon = abandon;
    abandon = () => {
      unsubscribe();
      previousAbandon();
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
  subtitle.textContent = `Stage 4.5.1 · ${GYMRUN_FORMAT} · a party of ${PARTY_SIZE}, a bag, and a price for healing`;
  header.append(title, subtitle, createVerbosityToggle());
  return header;
}

/**
 * The Simple / Detailed toggle. **Presentation only, and global.**
 *
 * In the header rather than on a settings screen because it is a reading
 * preference rather than a game option: the player who wants it wants it
 * *while looking at* the numbers it hides, and a preference behind a menu is
 * one they set once and never revisit.
 *
 * It is a cross-run setting, persisted in `ui/settings.ts`, and it defaults to
 * Detailed on a first launch — a new player does not know the help exists, so
 * the mode that hides it is the mode they never leave.
 *
 * Nothing here touches run state. See the header of `ui/settings.ts` for the
 * rule and `test/verbosity.test.ts` for its enforcement.
 */
function createVerbosityToggle(): HTMLElement {
  const wrap = el('div', 'verbosity');
  const label = el('span', 'verbosity__label');
  label.textContent = 'Detail';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button--small verbosity__toggle';

  const paint = (): void => {
    const detailed = getVerbosity() === 'detailed';
    button.textContent = detailed ? 'Detailed' : 'Simple';
    button.setAttribute('aria-pressed', String(detailed));
    // Says what the *other* mode does, because the button already says which
    // one is on. "Showing numbers" and "showing bars" are both facts.
    button.title = detailed ? 'Showing stat numbers' : 'Showing relative bars';
  };

  button.addEventListener('click', () => {
    setVerbosity(getVerbosity() === 'detailed' ? 'simple' : 'detailed');
    paint();
  });
  paint();

  wrap.append(label, button);
  return wrap;
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
