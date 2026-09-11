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

import type { NodeSpec } from '../core/encounters';
import type { AcquisitionDecision } from '../core/acquisition';
import { releaseMember, reorderParty } from '../core/party';
import {
  defaultItemPlan,
  isReplayable,
  localeOf,
  partyCapacity,
  playRun,
  resumeRun,
  type BattleReview,
  type RunPolicy,
  type RunResult,
  type RunState,
} from '../core/run';
import type { Choice, ItemPlan, PokemonSpec, RunLog } from '../core/types';
import { DEFAULT_TUNING } from '../data/tuning';
import { createPending } from './pending';
import { getVerbosity, initSettings, onSettingsChange, resetTutorial, setVerbosity } from './settings';
import { createTutorial } from './tutorial';
import { TUTORIAL_COPY, TUTORIAL_SCREENS, type TutorialScreen } from '../data/tutorial';
import { applyLocale } from './theme/locale';
import { createTooltips } from './tooltips';
import { createWorldScene, el } from './scene';
import { newSeed, seedFromLocation, writeSeedToLocation } from './seed';
import { createSeedBar } from './seed-bar';
import { createBattleScreen } from './screens/battle';
import { createEventScreen } from './screens/event';

import { createItemTargetScreen } from './screens/item-target';
import { createMoveReplaceScreen } from './screens/move-replace';
import { createPartyScreen } from './screens/party';
import { createLocaleSelect } from './screens/locale-select';
import { createResultScreen } from './screens/result';
import { createRouter, type ScreenName } from './screens/router';
import { createShopScreen } from './screens/shop';
import { createRunMap } from './screens/run-map';
import { createStarterSelect } from './screens/starter-select';
import { createSummary } from './screens/summary';
import { createStamps } from './stamps';
import { createPreGymScreen } from './screens/pre-gym';
import type { GymDefinition } from '../data/gyms';
import { createDrawer, type DrawerView } from './drawer';
import { gymForSegment } from '../data/gyms';
import { itemLayoutOf } from './party-layout';
import { clearRunLog, loadRunLog, saveRunLog } from './storage';
import { applyMotion } from './theme/motion';
import { applyVerbosity } from './theme/verbosity';

export function mountApp(root: HTMLElement): void {
  /*
   * The verbosity mode, once at startup and once per change. **Patch 4.7.2,
   * ruling 4, and this is the whole of the subscription.**
   *
   * `initSettings` first so the attribute is written from the stored preference
   * before any screen is built, rather than the first frame rendering in the
   * default and flipping.
   *
   * `onSettingsChange` here rather than inside a run, and unsubscribed nowhere,
   * because the mode outlives every run: it is written onto `<html>` and read
   * only by the stylesheet, so a screen drawn before a toggle, after it, or
   * while it happens is correct without anything re-rendering. That is the
   * difference from what this replaced — a subscription that redrew the map and
   * the party screen and left the drawer, pre-gym, reward, summary and battle
   * screens showing the mode they were built in. Nothing registers with this
   * and nothing can forget to.
   *
   * `ui/theme/verbosity.ts` carries the argument for the attribute over a
   * redraw, including why a shell-level redraw could not avoid being a
   * per-screen registration in this router.
   */
  applyVerbosity(initSettings().verbosity);
  onSettingsChange((settings) => applyVerbosity(settings.verbosity));
  /*
   * The one battle-feedback duration, from `data/tuning.ts` onto the root.
   *
   * On `documentElement` rather than on the app root because `tokens.css`
   * declares `--motion-duration` on `:root` and a value set lower down would
   * shadow it for the subtree while leaving the token's own fallback in place
   * above — two answers to one question, which is the thing the token exists
   * to prevent.
   */
  applyMotion(document.documentElement);

  const starterScreen = createStarterSelect();
  const localeScreen = createLocaleSelect();
  const mapScreen = createRunMap();
  const battleScreen = createBattleScreen();
  const resultScreen = createResultScreen();
  const shopScreen = createShopScreen();
  const eventScreen = createEventScreen();
  const targetScreen = createItemTargetScreen();
  const replaceScreen = createMoveReplaceScreen();
  const partyScreen = createPartyScreen();
  const preGymScreen = createPreGymScreen();
  const summaryScreen = createSummary();

  const shell = el('main', 'shell');

  /*
   * The party drawer, mounted once at the shell and toggled. **Stage 4.7, Part 1.**
   *
   * One drawer, not one panel per screen, and an *overlay* rather than a route:
   * closing it returns to byte-identical screen state with nothing selected and
   * nothing submitted. A route would unmount the screen underneath and take its
   * half-filled shop basket with it.
   *
   * `src/ui/drawer.ts` carries the standing rule this implements, and
   * `docs/generation.md` §12 is where future screens inherit it.
   */
  const drawer = createDrawer();

  const router = createRouter(
    {
    starter: starterScreen.root,
    locale: localeScreen.root,
    map: mapScreen.root,
    battle: battleScreen.root,
    result: resultScreen.root,
    target: targetScreen.root,
    replace: replaceScreen.root,
    party: partyScreen.root,
    'pre-gym': preGymScreen.root,
    shop: shopScreen.root,
    event: eventScreen.root,
    summary: summaryScreen.root,
    },
    (name) => {
      shell.dataset['screen'] = name;
    },
  );

  const seedBar = createSeedBar();
  // The corner stamps, fixed to the viewport, updated with the run. Stage V2.
  const stamps = createStamps();
  // The world behind everything, mounted once beside the shell, following
  // <html data-locale>. Stage V3.
  const world = createWorldScene();

  /*
   * The drawer trigger: **one button, mounted at the shell, not one per screen.**
   *
   * The rule is that it sits in the same screen position on every decision
   * surface. Ten per-screen buttons could satisfy that on the day they were
   * written and drift the first time one screen's header grew a row; one button
   * outside the router cannot drift, and no screen can forget to add it.
   *
   * It is shown on the surfaces that ask the player for something *and* have a
   * party to show. Starter select is a decision with no party yet; the summary
   * is a finished run. Both hide it rather than showing an empty drawer.
   */
  const drawerBar = el('div', 'shell__drawer-bar');
  const drawerTrigger = drawer.trigger();
  drawerBar.append(drawerTrigger);

  const replayTutorial = document.createElement('button');
  shell.append(createHeader(replayTutorial, seedBar.toggle), seedBar.root, drawerBar, router.root, drawer.root, stamps.root);

  /** Surfaces that ask for a decision and have a party to show while asking. */
  const DRAWER_SURFACES: readonly ScreenName[] = [
    'locale',
    'map',
    'battle',
    'result',
    'target',
    'replace',
    'party',
    'pre-gym',
    'shop',
    'event',
  ];

  /*
   * The trigger's visibility follows the router, in one place.
   *
   * Wrapped rather than pushed into `createRouter`, because the router's job is
   * to toggle screens and a router that also knew which screens had a party
   * would be a router that knew about the party.
   */
  const showScreen = (name: ScreenName): void => {
    router.show(name);
    drawerBar.hidden = !DRAWER_SURFACES.includes(name);
    // Closing on navigation, not on open: a drawer left open across a screen
    // change would be an overlay over a decision the player has already made.
    drawer.close();
    showTutorialFor(name);
  };

  /*
   * What the drawer would show, asked at the moment it is opened.
   *
   * A getter rather than a snapshot, and that is the whole of "opening it never
   * advances state": the trigger *reads*. It calls nothing, submits nothing,
   * resolves no pending promise and touches no stream. A snapshot kept up to
   * date by a subscription would work too and would be a second copy of run
   * state to keep in agreement with the first.
   *
   * Assigned by `start()`, because the run's state and its unspent item plan
   * both live inside that closure. Null between runs, and the trigger is
   * hidden then anyway.
   */
  let readDrawer: () => DrawerView | null = () => null;

  drawerTrigger.addEventListener('click', () => {
    const view = readDrawer();
    if (!view) return;
    drawer.open({ ...view, inBattle: router.current() === 'battle' });
    tutorial.showFor('drawer', drawer.root);
  });

  // "Show tutorial again": the flags go back to a first launch and the screen
  // on view gets its marks now rather than on its next visit.
  replayTutorial.addEventListener('click', () => {
    resetTutorial();
    const name = router.current();
    if (name) showTutorialFor(name);
    if (drawer.isOpen()) tutorial.showFor('drawer', drawer.root);
  });
  root.replaceChildren(world.root, shell);
  stamps.update({ locale: null, segment: null, segments: 0, seed: null });

  /*
   * Which phase the app is in, so CSS can reclaim the setup chrome on a phone.
   *
   * **The measured cause of the Stage 4.5.2 mobile complaints, and it was not
   * what the brief guessed.** At 390x844 there is no horizontal overflow and
   * the step chain has been laid out vertically since Stage 3 — but the title,
   * the stage blurb, the Detail toggle and the seed box together occupy about
   * 350px above *every* screen, which is 40% of a phone viewport spent on
   * controls used once per run. That is what pushed the move buttons to y=777
   * and the map's decision point to y=688.
   *
   * So the attribute, and the narrow-viewport rules keyed off it, are the whole
   * fix for three of item F's four parts: nothing was mislaid out, there was
   * simply no room left by the time the screen got its turn. It is set here
   * rather than in each screen because it is a fact about the *app*, and
   * because a screen that had to remember to set it would eventually forget.
   *
   * **What 4.5.2 got wrong, and the mobile seed bar patch corrected.** The
   * phase is `running` from the first `start()`, which is page load, so the
   * rule that hid the seed bar during a run hid it on the starter screen too
   * and left a phone with no Start, New seed or Resume until the run ended.
   * The bar now collapses under the phase rather than vanishing, with a
   * toggle on the header row; see `ui/seed-bar.ts`. The phase itself is
   * unchanged.
   */
  const setPhase = (phase: 'setup' | 'running'): void => {
    shell.dataset['phase'] = phase;
  };
  setPhase('setup');

  /*
   * One tooltip layer for the whole app, mounted once.
   *
   * Delegated from the shell rather than from the battle screen, so every tip
   * outside a battle — an ability on the party screen, a stat on a starter
   * card, a move's type on a reward card — works for free.
   *
   * Stage 4.5's rule was that a type badge opened the reference wheel wherever
   * it appeared. Stage 4.5.2 narrowed it to *move* type badges: on a Pokemon
   * the wheel answered a question about the type that said nothing true about
   * that Pokemon's randomized moveset. See `scene.typeChip`.
   */
  createTooltips(shell);

  /*
   * The coach marks, one layer for the whole app, mounted once like the
   * tooltips. A screen's marks are asked for the moment it is shown, after
   * its render has landed (the microtask), and the party drawer asks for its
   * own when it opens. Presentation only: nothing here touches run state.
   */
  const tutorial = createTutorial(shell);
  const isTutorialScreen = (name: string): name is TutorialScreen => (TUTORIAL_SCREENS as readonly string[]).includes(name);
  const showTutorialFor = (name: ScreenName): void => {
    if (!isTutorialScreen(name)) return;
    const screen = router.root.querySelector<HTMLElement>(`.screen[data-screen="${name}"]`);
    if (!screen) return;
    queueMicrotask(() => {
      if (router.current() === name) tutorial.showFor(name, screen);
    });
  };

  /** Tears down the run currently on screen, if any. */
  let abandon: (() => void) | null = null;

  async function start(seed: string, resume?: RunLog): Promise<void> {
    abandon?.();

    setPhase('running');
    // Every run begins with the phone's space reclaimed; the toggle brings
    // the bar back when the player wants it.
    seedBar.collapse();
    seedBar.setSeed(seed);
    writeSeedToLocation(seed);
    // A new run starts in no region; the first state with a locale sets one.
    applyLocale(null);
    stamps.update({ locale: null, segment: null, segments: 0, seed });

    const starterPick = createPending<number>();
    const localePick = createPending<number>();
    const nodePick = createPending<number>();
    const movePick = createPending<Choice>();
    const rewardPick = createPending<number | null>();
    const targetPick = createPending<number>();
    const replacePick = createPending<number>();
    const acquirePick = createPending<AcquisitionDecision>();
    const shopBasket = createPending<number[]>();
    const eventPick = createPending<number>();
    const leadPick = createPending<number>();
    let detachBattle: (() => void) | null = null;
    const releaseBattle = (): void => {
      detachBattle?.();
      detachBattle = null;
    };

    abandon = () => {
      starterPick.cancel();
      localePick.cancel();
      nodePick.cancel();
      movePick.cancel();
      rewardPick.cancel();
      targetPick.cancel();
      replacePick.cancel();
      acquirePick.cancel();
      shopBasket.cancel();
      eventPick.cancel();
      leadPick.cancel();
      releaseBattle();
    };

    const policy: RunPolicy = {
      chooseStarter: (options: PokemonSpec[]) => {
        starterScreen.render(options, (index) => starterPick.submit(index));
        showScreen('starter');
        return starterPick.wait();
      },
      chooseLocale: (options, state) => {
        localeScreen.render(
          {
            options,
            segment: state.currentSegment,
            // The segment's own gym, and only that one. Revealing the full
            // eight-gym ladder turns the run into a draft plan — a different
            // and probably interesting game, and a bigger change than this
            // patch. See the header on `locale-select.ts`.
            gym: gymForSegment(state.currentSegment),
            party: state.party,
          },
          (index) => localePick.submit(index),
        );
        showScreen('locale');
        return localePick.wait();
      },

      /*
       * The pre-gym screen. **Stage 4.7, Part 2.**
       *
       * Between the last node of a segment and the gym battle, and the only
       * decision on it is who leads. Not a node: `playRun` asks this inside the
       * `atGym` branch, before `playNode`, so it costs no step and consumes no
       * RNG.
       */
      chooseLead: (party, gym, state) => {
        /*
         * The gym is held rather than closed over, because the screen has to be
         * able to redraw itself after the player has been somewhere else.
         *
         * `party` and `state` are deliberately unused past this point, the same
         * way `chooseNode` ignores its options: `renderPreGym` reads `live`,
         * which at this call is the very object `playRun` passed — nothing
         * reassigns its `state` between the previous iteration's `onState` and
         * this branch. Reading it there rather than here is what makes the
         * redraw on the way back from the party screen show the party as it
         * *is*, since a reorder or a release replaces the array these name.
         */
        void party;
        void state;
        pendingGym = gym;
        renderPreGym();
        showScreen('pre-gym');
        return leadPick.wait();
      },
      chooseNode: (options: NodeSpec[]) => {
        // The map is already rendered by onState; this only arms the buttons.
        void options;
        showScreen('map');
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
        lastReview = review;
        resultScreen.render(review, review.offer, state, (index) => rewardPick.submit(index));
        showScreen('result');
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
        showScreen('result');
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
        showScreen('shop');
        return shopBasket.wait();
      },
      chooseEventOption: (event, state) => {
        // The event screen holds the run open between the pick and the reveal:
        // it resolves this promise on "Carry on", not on the choice itself.
        eventScreen.render(event, state, (index) => eventPick.submit(index));
        showScreen('event');
        return eventPick.wait();
      },
      chooseMoveRecipient: (offer, party, state) => {
        // The run's tuning, for the move card's face-tag cap (4.8.0.2).
        targetScreen.render(offer, party, (slot) => targetPick.submit(slot), state.tuning);
        showScreen('target');
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
      chooseMoveToReplace: (member, incoming, state) => {
        replaceScreen.render(member, incoming, (slot) => replacePick.submit(slot), state.tuning);
        showScreen('replace');
        return replacePick.wait();
      },
      /*
       * The capture, rendered back onto the result screen the fight ended on.
       *
       * Not a screen of its own any more: the offer used to arrive after the
       * result had been dismissed, so the player judged whether a Pokemon was
       * worth a party slot with the fight it came from off screen. The same
       * review is re-rendered with no cards — by this point they have been
       * taken — and the capture block underneath them.
       *
       * `lastReview` can be null only on the `chooseReward` fallback path,
       * which `playRun` does not use while `reviewBattle` exists. The screen
       * handles a null review as the cards-only shape it had before 4.5.2.
       */
      chooseAcquisition: (offer, party) => {
        const state = live;
        if (state) {
          resultScreen.render(lastReview, null, state, () => undefined, {
            offer,
            party,
            onDecide: (decision) => acquirePick.submit(decision),
          });
          showScreen('result');
        }
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
     * The drawer's window onto this run. See `readDrawer` above.
     *
     * `itemLayoutOf` folds in the unspent plan, so a player who moved their
     * Leftovers on the party screen and then opened the drawer from the shop
     * sees where the item is *going*, not where the run still records it. A
     * readout that contradicted a decision the player already made is the exact
     * failure the drawer exists to remove.
     */
    readDrawer = () => {
      const state = live;
      if (!state) return null;
      return {
        party: state.party,
        holding: itemLayoutOf(state.party, pendingPlan),
        relics: state.relics,
        tuning: state.tuning,
      };
    };

    /*
     * The last battle result shown, held for the capture render that follows it.
     *
     * `playRun` asks two questions about one node — take a card, then take the
     * Pokemon — and the second call has no review attached. Keeping the first
     * one is what lets the capture render on the *same* screen rather than on a
     * blank one.
     */
    let lastReview: BattleReview | null = null;

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

    /**
     * The gym the pre-gym screen is asking about, while it is asking.
     *
     * Held for the same reason `lastReview` is: the screen outlives the call
     * that rendered it, because the player can leave it for the party screen
     * and come back. Null whenever the pre-gym screen does not own the run.
     */
    let pendingGym: GymDefinition | null = null;

    /**
     * Draw the pre-gym screen from live run state.
     *
     * Separate from `chooseLead` so that returning from the party screen redraws
     * it rather than revealing the render `chooseLead` left behind. That is not
     * cosmetic: the lead is a **slot index**, `defaultLeadSlot` computes it from
     * the party it is handed, and a release shifts every slot behind it. A stale
     * render would offer a confirm whose label named one Pokemon and whose slot
     * named another — the same hazard `onReorder` and `onRelease` already handle
     * by dropping `pendingPlan`, one screen further out.
     */
    const renderPreGym = (): void => {
      const state = live;
      if (!state || !pendingGym) return;
      preGymScreen.render(
        {
          gym: pendingGym,
          segment: state.currentSegment,
          party: state.party,
          holding: itemLayoutOf(state.party, pendingPlan),
          tuning: state.tuning,
        },
        {
          onLead: (slot) => {
            pendingGym = null;
            leadPick.submit(slot);
          },
          onManageParty: () => showParty('pre-gym'),
        },
      );
    };

    /**
     * Where the party screen's Done goes back to.
     *
     * Remembered rather than passed to `onDone`, because two things redraw an
     * already-open party screen — a reorder or release, and the verbosity toggle
     * — and a redraw must not quietly retarget the way out.
     */
    let partyReturn: ScreenName = 'map';

    /*
     * The party screen, and **the way back out of it is a parameter**.
     *
     * It has two entrances: the map's Manage button, and the pre-gym screen's.
     * Done used to be `showScreen('map')` for both, which softlocked the second
     * one. At the gym `state.position` is past every step, so `run-map.ts` arms
     * no node row — the gym row is appended with no `onChoose` and renders as a
     * div rather than a button — and `nodeOptions` is empty by design, so
     * `nodePick` is never armed either. The map is therefore a screen with no
     * control that advances the run, while the only thing that can resolve
     * `leadPick` is the pre-gym screen the player just left. Map to party to map,
     * with a pending promise and no way to reach it: recoverable only by a
     * reload.
     *
     * Same class of bug as the one 4.7's phone-regression step 1 fixed — that
     * added the control that submits a lead; this makes the detour come back to
     * it.
     */
    const showParty = (returnTo: ScreenName): void => {
      const state = live;
      if (!state) return;
      partyReturn = returnTo;
      partyScreen.render(
        {
          party: state.party,
          backpack: state.backpack,
          relics: state.relics,
          tuning: state.tuning,
          slots: partyCapacity(state),
          backTo: returnTo === 'pre-gym' ? 'Back to the gym' : 'Back to the map',
          plan: pendingPlan,
        },
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
            showParty(partyReturn);
            mapScreen.render(state, (index) => nodePick.submit(index), () => showParty('map'));
          },
          onRelease: (slot) => {
            pendingPlan = null;
            const released = releaseMember(state.party, slot);
            state.party = released.party;
            // Their item goes to the bag, not with them.
            if (released.freed) state.backpack = [...state.backpack, released.freed];
            showParty(partyReturn);
            mapScreen.render(state, (index) => nodePick.submit(index), () => showParty('map'));
          },
          onPlan: (plan) => {
            pendingPlan = plan;
          },
          /*
           * Back to whichever screen sent us, and redraw it first when that
           * screen is the pre-gym one. See `renderPreGym` for why the redraw is
           * load-bearing rather than tidy.
           */
          onDone: () => {
            if (partyReturn === 'pre-gym') renderPreGym();
            showScreen(partyReturn);
          },
        },
      );
      showScreen('party');
    };

    const onState = (state: RunState): void => {
      // Rendering on every transition, not only when a choice is pending, is
      // what makes a rest node visible: it resolves without a decision, so the
      // only evidence it happened is the party panel refilling.
      live = state;
      /*
       * The world's palette, from the same projection the map names the
       * region with. Stage V1. Set here rather than on the locale screen's
       * click so a resumed run, which replays its decisions through this same
       * hook, wears its region before the map is ever shown.
       */
      applyLocale(localeOf(state));
      stamps.update({
        locale: localeOf(state),
        segment: state.currentSegment + 1,
        segments: state.segments.length,
        seed: state.seed,
      });
      mapScreen.render(state, (index) => nodePick.submit(index), () => showParty('map'));
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
      showScreen('battle');
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
      // The summary is locale neutral, and its stamps say so too.
      applyLocale(null);
      stamps.update({
        locale: null,
        segment: result.state.currentSegment + 1,
        segments: result.state.segments.length,
        seed: result.state.seed,
      });
      showScreen('summary');
      // The run is over, so the seed controls are wanted again: the summary is
      // where a player picks the next seed or replays this one.
      setPhase('setup');
      // The run is over: a saved log now would resume into a finished run.
      clearRunLog();
    } catch {
      // The only way out of playRun other than a finished run is an abandoned
      // pending decision, which happens when the player starts a different one.
    }
  }

  // Already parsed: a bare seed or a versioned one with this build's hash.
  // A foreign one never reaches here; the bar refuses it in place.
  seedBar.onSubmit((seed) => {
    void start(seed || newSeed());
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
  // save. Without one, an interrupted run is resumed where it left off. A
  // versioned URL made on another build has no paste moment to refuse at, so
  // the bare seed starts a fresh run and the bar says why it is not the same one.
  if (fromUrl) {
    void start(fromUrl.seed);
    if (fromUrl.kind === 'foreign') seedBar.refuse(fromUrl);
  } else if (saved && isReplayable(saved)) void start(saved.seed, saved);
  else void start(newSeed());
}

function createHeader(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
  const header = el('header', 'header');
  const title = el('h1', 'header__title');
  title.textContent = 'GYMRUN';
  const subtitle = el('p', 'header__subtitle');
  subtitle.textContent = `Stage 4.8 · ${GYMRUN_FORMAT} · a roster that grows, caught in eight regions, and scored`;
  header.append(title, subtitle, createVerbosityToggle(replayTutorial, seedToggle));
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
function createVerbosityToggle(replayTutorial: HTMLButtonElement, seedToggle: HTMLButtonElement): HTMLElement {
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

  /*
   * The tutorial's one header control, on the same row. **Presentation
   * only.** Here because it is the same kind of thing as the Detail toggle —
   * a reading preference — and because the coach marks are written against
   * Detailed mode. On the same row rather than its own, because the header's
   * height is the battle's and the map's vertical budget: a second row moved
   * the fourth move button past the 740 line on a phone. "Skip tutorial"
   * lives on the first mark itself, where a player meets it.
   */
  replayTutorial.type = 'button';
  replayTutorial.className = 'button button--small tutorial__replay';
  replayTutorial.textContent = TUTORIAL_COPY.replayShort;
  replayTutorial.setAttribute('aria-label', TUTORIAL_COPY.replay);
  replayTutorial.title = TUTORIAL_COPY.replay;
  replayTutorial.dataset['tutorialReplay'] = 'true';

  /*
   * The seed bar's toggle, on the same row and for the same reason: the row
   * already exists on every screen, so a control on it costs the phone no
   * height. The stylesheet shows it only at the phone width during a run,
   * which is the only time the bar it controls is collapsed. See the header
   * of `ui/seed-bar.ts`.
   */
  wrap.append(label, button, replayTutorial, seedToggle);
  return wrap;
}

