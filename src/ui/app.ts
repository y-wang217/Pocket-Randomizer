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
import type { BattleSession } from '../core/battle/driver';

import type { NodeSpec } from '../core/encounters';
import type { VignetteMoment } from '../data/vignetteCopy';
import { trainerClass } from '../data/trainerClasses';
import { opponentImg, spriteImg } from './sprites';
import { createJourney } from './vignette';
import { mountNodeBand } from './node-band';
import type { AcquisitionDecision } from '../core/acquisition';
import { applyBattleState } from '../core/party';
import {
  gymClearLevel,
  describeVersionMismatch,
  isReplayable,
  versionMismatch,
  localeOf,
  partyCapacity,
  playRun,
  runMode,
  replayRunPolicy,
  type BattleReview,
  type RunPolicy,
  type RunProjection,
  type RunResult,
  type RunState,
  teachableNow,
} from '../core/run';
import { previewEvolutions } from '../core/evolution';

import type { Choice, ItemId, ItemPlan, PartyEdit, PokemonSpec, PokemonState, RunLog, RunMode } from '../core/types';
import { DEFENDER_SCREEN_COPY } from './copy/defender';
import { applyRelicPassives } from '../core/relics';
import { applyItemPlan, arrivedItems, backpackCapacity, keepLayoutPlan, reconcileItemPlan } from '../core/items';
import { DEFAULT_TUNING } from '../data/tuning';
import { SEED_COPY } from '../data/seedCopy';
import type { EventArchetype } from '../data/eventPools';
import { createPending, isRunAbandoned } from './pending';
import { watchExposures } from './exposure-labels';
import { initSettings, onSettingsChange, resetIntro, resetTutorial } from './settings';
import { createTutorial } from './tutorial';
import { createIntro } from './intro';
import { TUTORIAL_SCREENS, type TutorialScreen } from '../data/tutorial';
import { applyLocale } from './theme/locale';
import { applyField } from './theme/field';
import { setBandMount } from './band';
import { createTooltips } from './tooltips';
import { createWorldScene, el, type OutroKind } from './scene';
import { newSeed, seedFromLocation, writeSeedToLocation } from './seed';
import { createSeedBar } from './seed-bar';
import { createBattleScreen } from './screens/battle';
import { createEventScreen } from './screens/event';

import { TEACH_CANCELLED, createItemTargetScreen } from './screens/item-target';
import { createMoveReplaceScreen } from './screens/move-replace';
import { describeMove } from '../core/battle/driver';
import { replacementNeeded } from '../core/party';
import { createPartyScreen, type PartyFocus } from './screens/party';
import { createLocaleSelect } from './screens/locale-select';
import { createGymSelect } from './screens/gym-select';
import { createResultScreen } from './screens/result';
import { createRouter, DRAWER_SURFACES, PARTY_EDIT_SURFACES, WRITABLE_TAB_SURFACES, type ScreenName } from './screens/router';
import { createHeader } from './header';
import { createShopScreen } from './screens/shop';
import { createRunMap } from './screens/run-map';
import { createStarterSelect } from './screens/starter-select';


import { createSummary } from './screens/summary';
import { createStamps } from './stamps';
import { createPreGymScreen } from './screens/pre-gym';
import type { GymDefinition } from '../data/gyms';
import type { RelicId } from '../data/relics';
import { createDrawer, type DrawerView } from './drawer';
import { createMapDrawer } from './map-drawer';
import { presentAsScreen } from './overlay';
import type { NavTab } from './assets/manifest';
import { createDecisionFeed } from './decision-feed';
import { createNav } from './nav';
import { createRunInfo, type RunInfoView } from './run-info';
import { createSettingsSheet } from './settings-sheet';
import { createSidebar } from './sidebar';
import { gymForSegment } from '../data/gyms';
import { itemLayoutOf, partyWithPlan } from './party-layout';
import { clearItemDraft, clearRunLog, loadItemDraft, loadRunLog, saveItemDraft, saveRunLog } from './storage';
import { applyMotion } from './theme/motion';


/**
 * A defender rank's boss as the pre-gym screen shows it: its team size and its
 * level (bible Rev 25, D101). A boss team is drawn at one level
 * (`generateBossTeam` pins the range to the column's maximum); the highest is
 * read rather than the first so an empty team reads 0 instead of throwing.
 */
function bossOf(state: RunState): { size: number; level: number } {
  const team = state.segments[state.currentSegment]?.gym.encounter?.team ?? [];
  return { size: team.length, level: Math.max(0, ...team.map((spec) => spec.level)) };
}

/**
 * How this fight should end on the stage. **The battle animation run.**
 *
 * Pure, and derived from the review the policy is already handed, so `core/`
 * knows nothing about the outro and no field was added to carry it.
 *
 *   - **Lost** -> `defeat`. No recall: the body that ended it has already sunk.
 *     The hold still runs, and a loss is where it matters most — a wipe ends
 *     the battle on the same frame the last body faints, so its beats were the
 *     most reliably swallowed of all.
 *   - **Won a wild fight that offers a capture** -> `caught`. `node.acquisition`
 *     is the offer `core/run.ts`'s `acquisitionOffered` will read a moment
 *     later from the same `NodeSpec`, so the ball and the offer on the next
 *     screen cannot disagree about whether there is something to catch.
 *   - **Won anything else** -> `recall`, the gym and trainer case.
 *
 * An event node's capture is deliberately *not* a `caught`: that offer comes
 * from the chosen outcome's grant rather than from the node, there may have
 * been no fight at all, and a ball closing over a gym leader's Pokemon because
 * the event behind it happened to pay a species would be a lie about what just
 * happened.
 */
export function outroFor(review: BattleReview): OutroKind {
  if (!review.won) return 'defeat';
  return review.node.acquisition ? 'caught' : 'recall';
}


/**
 * The route half of the encounter library, fetched as a chunk of its own.
 * **Stage 6.0 checkpoint 9, the bundle seam.** The import starts the moment
 * the app module is evaluated, in parallel with the first paint, and
 * `start()` awaits it before the first run: `core/` throws before any draw
 * if a run is generated without it, so there is no path by which a seed is
 * read against half the library. The only dynamic import in `src/`.
 */
const encounterLibrary = import('../data/encounters/full');

export function mountApp(root: HTMLElement): void {
  const settings = initSettings();
  /*
   * The move bar layout, once at startup and once per change.
   *
   * Straight off the store, like density. The marks that name a move button
   * anchor `data-tutorial="move"` and `"pp"`, and both attributes are on the
   * same elements in both layouts, so there is nothing for a layout to fold
   * away.
   */
  /*
   * The one battle-feedback duration, from `data/displayTuning.ts` onto the
   * root, scaled by the player's chosen battle speed.
   *
   * On `documentElement` rather than on the app root because `tokens.css`
   * declares `--motion-duration` on `:root` and a value set lower down would
   * shadow it for the subtree while leaving the token's own fallback in place
   * above — two answers to one question, which is the thing the token exists
   * to prevent.
   */
  applyMotion(document.documentElement, settings.battleSpeed);
  /*
   * And again whenever the speed moves, like the move bar above. Re-applying
   * writes one custom property, and every battle-feedback length in the
   * stylesheet derives from it — so a turn already on screen picks the new
   * pace up at its next beat rather than needing the battle rebuilt.
   */
  onSettingsChange((next) => applyMotion(document.documentElement, next.battleSpeed));

  const starterScreen = createStarterSelect();
  const gymSelectScreen = createGymSelect();
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

  /*
   * The map overlay, mounted beside the party drawer and on the same terms.
   *
   * The party drawer's standing rule has a second half that was never built:
   * a decision surface must also expose *where the run is going*, and until now
   * the only way to see the route was to be standing on the map screen. A
   * player in a shop could not see whether a rest was two steps ahead.
   *
   * `src/ui/map-drawer.ts` carries the argument, and the reason it can show the
   * route without breaking the reveal rules: it calls the map screen's own
   * renderers rather than reimplementing them.
   */
  const mapDrawer = createMapDrawer();

  const router = createRouter(
    {
    starter: starterScreen.root,
    'gym-select': gymSelectScreen.root,
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
      // The opening painting behind the frame before the first region (D87).
      // `world` is declared below; the router announces its first screen only
      // after the app is assembled.
      world.setOpening(name === 'starter' || name === 'gym-select' || name === 'locale');
    },
  );

  const seedBar = createSeedBar();
  // The corner stamps, fixed to the viewport, updated with the run. Stage V2.
  const stamps = createStamps();
  // The world behind everything, mounted once beside the shell, following
  // <html data-locale>. Stage V3.
  const world = createWorldScene();

  /*
   * **The shell nav replaces the drawer bar. Stage 5.0/1.**
   *
   * Map, Team, Bag, Run Info, Settings, at the top of the frame on every
   * viewport (`ui/nav.ts`). The Map and Party triggers the bar carried since
   * Stage 4.7 are gone; what they opened is what the Map and Team tabs open,
   * restyled from a sheet to a screen that fills the frame under the nav
   * (bible section 5, Shell nav, D53).
   *
   * **The guard.** A tab opened while a decision is pending elsewhere opens a
   * readout: the party drawer, the map without its picker, Run Info,
   * Settings. None of them advances run state, submits or draws, and closing
   * any of them returns to the decision underneath, which never unmounted.
   * The one writable screen a tab reaches is the party screen, and only from
   * the map or the pre-gym screen, which are the two places its Manage
   * buttons already led: between nodes, where a party edit is a logged
   * decision of its own.
   */
  const nav = createNav();
  const runInfo = createRunInfo();
  const settingsSheet = createSettingsSheet();
  for (const layer of [drawer.root, mapDrawer.root, runInfo.overlay.root, settingsSheet.overlay.root]) presentAsScreen(layer);
  const sidebar = createSidebar();

  const replayTutorial = document.createElement('button');
  shell.append(
    nav.root,
    createHeader(replayTutorial, seedBar.toggle),
    seedBar.root,
    router.root,
    drawer.root,
    mapDrawer.root,
    runInfo.overlay.root,
    settingsSheet.overlay.root,
    stamps.root,
  );

  /*
   * **The journey vignettes. Bible Rev 30, D109.** Mounted on the frame, over
   * the nav and every screen, so a beat covers everything a tap could reach.
   * Driven from the run's seams below and nowhere else.
   */
  const journey = createJourney(shell);

  /*
   * The trigger's visibility follows the router, in one place.
   *
   * Wrapped rather than pushed into `createRouter`, because the router's job is
   * to toggle screens and a router that also knew which screens had a party
   * would be a router that knew about the party.
   */
  /** Which tab's screen is open over the router, if any. */
  let openTab: NavTab | null = null;
  /** Which tab led to the party screen, so the right one reads as current. */
  let partyVia: 'team' | 'bag' = 'team';

  const closeTabScreens = (): void => {
    drawer.close();
    mapDrawer.close();
    runInfo.overlay.close();
    settingsSheet.overlay.close();
  };

  /*
   * The nav's state follows the router and the open tab screen, in one place.
   * A tab is available when it has something to show: Settings always, the
   * rest once a run has state, and Team and Bag on the surfaces the drawer
   * trigger was shown on, plus the map and the party screen themselves.
   */
  const refreshNav = (): void => {
    const name = router.current();
    const running = readMap() !== null;
    const available = new Set<NavTab>(['settings']);
    if (running) available.add('info');
    if (running && name !== 'summary' && name !== 'starter') available.add('map');
    if (name && (DRAWER_SURFACES.includes(name) || name === 'map') && readDrawer() !== null) {
      available.add('team');
      available.add('bag');
    }
    nav.setAvailable(available);
    nav.setActive(openTab ?? (name === 'map' ? 'map' : name === 'party' ? partyVia : null));
  };
  for (const layer of [drawer, mapDrawer, runInfo.overlay, settingsSheet.overlay]) {
    layer.onClose(() => {
      openTab = null;
      refreshNav();
    });
  }

  const showScreen = (name: ScreenName): void => {
    router.show(name);
    // Closing on navigation, not on open: a tab screen left open across a
    // screen change would be a readout over a decision already made.
    closeTabScreens();
    refreshNav();
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

  /**
   * The run state the map overlay would draw, asked at the moment it opens.
   *
   * A getter for `readDrawer`'s reason and assigned in the same place: the
   * live state lives inside `start()`'s closure, and a snapshot kept current by
   * a subscription would be a second copy of run state to keep in agreement
   * with the first. Null between runs, and the trigger is hidden then anyway.
   *
   * Unlike `readDrawer` this hands back `RunState` itself rather than a
   * prepared view, because the three renderers the overlay calls read the state
   * directly — there is nothing to prepare, and preparing something would be
   * the second implementation the overlay exists to avoid.
   */
  let readMap: () => RunState | null = () => null;

  /**
   * The Run Info screen's view, asked at the moment it opens, on the same
   * getter discipline as the two above. Assigned by `start()`.
   */
  let readRunInfo: () => RunInfoView | null = () => null;
  /**
   * The writable party screen, if the surface on view is one it may be
   * reached from: the map or pre-gym. Returns false everywhere else, and the
   * tab opens the read-only drawer instead. Assigned by `start()`.
   */
  let openPartyRoute: (bag: boolean) => boolean = () => false;
  /**
   * Leave the party screen for the map screen it was opened from, the way its
   * own back control does. Returns false, and leaves everything where it is,
   * when the party screen was opened from the pre-gym screen or a boundary is
   * waiting on its answer: there the Map tab opens the readout as it does from
   * any other decision. Assigned by `start()`.
   *
   * Without this the Map tab pressed from the party screen opened the readout
   * over it, a map whose nodes cannot be pressed, and the only way back to
   * the real map was the party screen's own control underneath.
   */
  let leavePartyForMap: () => boolean = () => false;
  /** Redraw the open party screen as the other tab's. Assigned by `start()`. */
  let switchPartyFocus: (focus: PartyFocus) => void = () => undefined;

  nav.onPress((id, button) => {
    const name = router.current();
    // The tab of what is already on view: close whatever is over it.
    const onView =
      openTab === id ||
      (openTab === null && ((id === 'map' && name === 'map') || ((id === 'team' || id === 'bag') && name === 'party')));
    if (onView) {
      closeTabScreens();
      if (name === 'party' && id !== partyVia) {
        partyVia = id === 'bag' ? 'bag' : 'team';
        // Two screens over one working copy (D95): the held plan carries over.
        switchPartyFocus(partyVia);
      }
      refreshNav();
      return;
    }
    closeTabScreens();
    switch (id) {
      case 'map': {
        if (name === 'map') break;
        if (name === 'party' && leavePartyForMap()) break;
        const state = readMap();
        if (!state) break;
        mapDrawer.open(state, button);
        openTab = 'map';
        break;
      }
      case 'team':
      case 'bag': {
        if (openPartyRoute(id === 'bag')) {
          partyVia = id;
          break;
        }
        const view = readDrawer();
        if (!view) break;
        drawer.open({ ...view, inBattle: name === 'battle', focus: id }, button);
        openTab = id;
        marks.showFor('drawer', drawer.root);
        break;
      }
      case 'info': {
        const view = readRunInfo();
        if (!view) break;
        runInfo.open(view, button);
        openTab = 'info';
        break;
      }
      case 'settings':
        settingsSheet.overlay.open(button);
        openTab = 'settings';
        break;
    }
    refreshNav();
  });

  // "Show tutorial again": the flags go back to a first launch and the screen
  // on view gets its marks now rather than on its next visit.
  replayTutorial.addEventListener('click', () => {
    resetIntro();
    resetTutorial();
    /*
     * The greeting first, and the marks from its `onClose` — the same order a
     * first launch has. The drawer's marks are the one thing that cannot wait
     * for the close, because the drawer may not be open by then; they are
     * asked for here as before, and the panel over them is the player's own
     * doing.
     */
    intro.open(replayTutorial);
    const name = router.current();
    if (name) showTutorialFor(name);
    if (drawer.isOpen()) marks.showFor('drawer', drawer.root);
  });
  settingsSheet.onReplayTutorial(() => replayTutorial.click());
  /*
   * The frame and the sidebar, side by side from 1024px. On a phone the
   * sidebar is hidden and the frame is the viewport.
   */
  const layout = el('div', 'layout');
  layout.append(shell, sidebar.root);
  root.replaceChildren(world.root, layout);
  sidebar.update(null, []);
  refreshNav();

  /*
   * **The exposure labels. Milestone M6.1, R7.** One pass whenever anything in
   * the shell is added or replaced, counted against whatever the player is
   * looking at: the drawer while it is open, the routed screen otherwise. A
   * screen's first draw, a battle's per-turn redraw and the drawer opening are
   * all additions, so this one watcher covers every path without a call at
   * each. `ui/exposure-labels.ts` says why a redraw re-labels without
   * re-counting.
   */
  watchExposures(shell, () => {
    const name = router.current();
    // The drawer is counted within the visit to the screen under it, so
    // opening and closing it does not start that screen's visit again.
    if (drawer.isOpen()) return { screen: 'drawer', within: drawer.root, ...(name ? { visit: name } : {}) };
    const screen = name ? router.root.querySelector<HTMLElement>(`.screen[data-screen="${name}"]`) : null;
    return name && screen ? { screen: name, within: screen } : null;
  });
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
  // The confirm band mounts where the tooltip layer listens, so a long press
  // on a card inside it inspects like anywhere else (R5).
  setBandMount(shell);

  /*
   * The coach marks, one layer for the whole app, mounted once like the
   * tooltips. A screen's marks are asked for the moment it is shown, after
   * its render has landed (the microtask), and the party drawer asks for its
   * own when it opens. Presentation only: nothing here touches run state.
   */
  const tutorial = createTutorial(shell);
  /*
   * The intro, mounted beside the coach marks and sequenced ahead of them.
   *
   * Two overlays on one screen is neither, and on a first launch both are due
   * on the starter screen. `showTutorialFor` holds while the panel is open and
   * `onClose` asks again for whatever the router is showing, so the order is
   * always intro, then marks. Presentation only, like the layer it sits next
   * to: `ui/intro.ts`.
   */
  const intro = createIntro(shell);
  /*
   * **The marks show in the player's own mode. Milestone M6.2, 2026-09-23.**
   *
   * Ruling 6 on the density modes patch put a guard here that forced Detailed
   * while a screen's unseen marks were up, because in 4.7.2 a mark's anchor
   * could be folded away in Pocket and the layer drops an unpainted anchor
   * without a trace. Tiers 2 to 5 put every one of those facts on the compact
   * face: measured before M6.2, all 29 anchors paint in Pocket. The guard was
   * protecting nothing, and it put the classroom in Detailed on run one, where
   * no glyph paints (D43). Section 7, amended under D10, asked for it deleted
   * before Pocket became the default.
   */
  const marks = tutorial;
  const isTutorialScreen = (name: string): name is TutorialScreen => (TUTORIAL_SCREENS as readonly string[]).includes(name);
  const showTutorialFor = (name: ScreenName): void => {
    if (!isTutorialScreen(name)) return;
    // Held, not dropped: the marks are asked for again from `intro.onClose`,
    // against whatever the router is showing then. A screen reached while the
    // greeting is up still gets its first visit.
    if (intro.isOpen()) return;
    const screen = router.root.querySelector<HTMLElement>(`.screen[data-screen="${name}"]`);
    if (!screen) return;
    queueMicrotask(() => {
      if (router.current() === name) marks.showFor(name, screen);
    });
  };

  intro.onClose(() => {
    const name = router.current();
    if (name) showTutorialFor(name);
  });
  // The greeting goes up before the first screen is reached, so the shell is
  // the thing behind it rather than a decision the player is part way into.
  intro.openIfDue();

  /** Tears down the run currently on screen, if any. */
  let abandon: (() => void) | null = null;

  async function start(seed: string, resume?: RunLog): Promise<void> {
    abandon?.();
    // The route tables, before the first run (checkpoint 9). A no-op after
    // the first await; the chunk is fetched once.
    await encounterLibrary;

    setPhase('running');
    // Every run begins with the phone's space reclaimed; the toggle brings
    // the bar back when the player wants it.
    seedBar.collapse();
    seedBar.setSeed(seed);
    /*
     * **The mode this run plays. Defender Mode v0.** A resume plays the saved
     * log's own, whatever the bar shows, and the bar is moved to say so; a
     * fresh run plays the bar's.
     */
    const mode: RunMode = resume?.mode ?? seedBar.mode();
    seedBar.setMode(mode);
    /*
     * **Resume is offered only for a save that is not the run on screen. The
     * opening playtest QA, the author's ruling: "hide it to make it not
     * ambiguous".**
     *
     * A resumed run *is* the save, and the button beside it only restarted the
     * same run. A fresh run started over a save (New seed tapped by accident,
     * a linked seed) leaves the save intact until that run's first decision
     * writes over it, and the button is the way back for exactly that window.
     */
    const pending = resume ? null : loadRunLog();
    seedBar.setResumable(Boolean(pending && isReplayable(pending)));
    writeSeedToLocation(seed);
    // A new run starts in no region; the first state with a locale sets one.
    applyLocale(null);
    applyField(null);
    stamps.update({ locale: null, segment: null, segments: 0, seed });

    const starterPick = createPending<number>();
    const gymTypePick = createPending<number>();
    const localePick = createPending<number>();
    const nodePick = createPending<number>();
    const movePick = createPending<Choice>();
    const rewardPick = createPending<number | null>();
    const itemPlanPick = createPending<ItemPlan>();
    const targetPick = createPending<number>();
    const replacePick = createPending<number>();
    const acquirePick = createPending<AcquisitionDecision>();
    const shopBasket = createPending<number[]>();
    const eventPick = createPending<EventArchetype>();
    const leadPick = createPending<number>();
    const evolvePick = createPending<number>();
    const berryPick = createPending<number>();
    let detachBattle: (() => void) | null = null;
    /*
     * The fight in progress, and the party it was sent with.
     *
     * **This is the only source for what the drawer shows mid-fight**, and the
     * drawer's own blurb is why it has to exist: it says "Your side, as the
     * fight has left it", and until this was wired it showed the HP the node
     * was *entered* with. `applyBattleState` folds the sim's read-back by
     * `sendOrder` computed from the pre-battle party, so that exact party is
     * kept here rather than re-read from `live` — a release or reorder cannot
     * happen mid-fight, but keeping the array the send was computed from is
     * what makes the mapping correct by construction rather than by luck.
     *
     * Measured before the wiring: 137 of 217 turns across twelve seeds
     * disagreed with the field, the worst of them a Seel the fight had at
     * 1 HP and the drawer at 25.
     */
    let liveBattle: { session: BattleSession; sent: readonly PokemonState[] } | null = null;
    const releaseBattle = (): void => {
      detachBattle?.();
      detachBattle = null;
      liveBattle = null;
      /*
       * And end any parked outro. A run abandoned while the stage is playing
       * the end of a fight would otherwise leave `reviewBattle` waiting on a
       * timer whose screen is gone — the leaked-promise case `ui/pending.ts`
       * exists for, arrived at from the other direction.
       */
      battleScreen.cancel();
    };

    abandon = () => {
      starterPick.cancel();
      gymTypePick.cancel();
      localePick.cancel();
      nodePick.cancel();
      movePick.cancel();
      rewardPick.cancel();
      itemPlanPick.cancel();
      targetPick.cancel();
      replacePick.cancel();
      acquirePick.cancel();
      shopBasket.cancel();
      eventPick.cancel();
      leadPick.cancel();
      evolvePick.cancel();
      berryPick.cancel();
      releaseBattle();
      // A beat on the frame belongs to the run that asked for it.
      journey.cancel();
    };

    /*
     * The run's party editor, bound before the first question. QA-001: a
     * reorder or a release goes through `core/run.ts`, which applies it, logs
     * it and reports the new state, rather than being written into `live` here
     * where no log could see it.
     */
    let editParty: ((edit: PartyEdit) => void) | null = null;
    let nodeArrived: ItemId[] = [];

    /*
     * **The layout the party screen was left with, applied as the next
     * question is answered. Bible Rev 23, D94.**
     *
     * It used to wait for the boundary after the next node, so an item moved
     * on the map was not held in the fight it was moved for. Now the answer
     * that starts the next step — a locale, a node, a lead — first hands the
     * held layout to the run's party editor, which applies it in place and
     * logs it just before the answer. One entry per committed layout, and none
     * at all for a layout that changes nothing. Reconciled first, as the
     * boundary is, so a layout the run has moved on from is brought forward
     * rather than refused.
     *
     * Not at a teach boundary: there the screen answers `chooseItemPlan`
     * itself and the plan is that answer.
     */
    const flushedBefore = <T,>(answer: T): T => {
      const plan = pendingPlan;
      const state = live;
      if (!plan || !state || !editParty || atTeachBoundary) return answer;
      holdPlan(null);
      const capacity = backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics));
      const teachable = teachableNow(state);
      const brought = reconcileItemPlan(state, plan, capacity, teachable);
      const applied = applyItemPlan(state, brought, capacity, teachable);
      const same =
        applied.party.every((member, slot) => member.item === state.party[slot]?.item && member.spec.moves.join() === state.party[slot]?.spec.moves.join()) &&
        applied.backpack.join() === state.backpack.join() &&
        applied.tms.join() === state.tms.join();
      if (!same) editParty({ kind: 'items', plan: brought });
      return answer;
    };

    /*
     * **The journey's seams. Bible Rev 30, D109.** Three, and every beat
     * plays through one of them, so no screen can skip its vignette by
     * accident (`test/journey-seam.test.ts` holds the shape):
     *
     * - `enterNode`, after a node is chosen and before `playRun` hears the
     *   choice, so the beat stands between the commit and the node's screen.
     *   Every map pick (`chooseNode`, `chooseDoor`) and the gym's entry
     *   (`chooseLead`) answer through it. The same pattern as the
     *   end-of-battle hold: one `await` on the one path, no branch in `core/`.
     * - `arriveAtMap`, the only place the map screen is shown from a question.
     *   When the last thing walked was a battle, a shop, an event or a region,
     *   it plays *Where to next?* with the map drawn beneath it, so the beat
     *   lifts onto the map at the current step. Rest does not chain: its own
     *   beat was the whole of it, and the map never left.
     * - `localePick`'s answer, which arms the return for the region's first map.
     *
     * The beats read `live` and draw nothing: no decision, no stream, no log.
     */
    let returnDue = false;
    const beat = (moment: VignetteMoment, sprite: HTMLElement | null, beneath?: () => void): Promise<void> =>
      journey.play({ moment, locale: live ? localeOf(live) : null, sprite }, beneath);
    const leadSprite = (): HTMLElement | null => {
      const lead = live?.party[0];
      return lead ? spriteImg(lead.spec.species) : null;
    };
    // Who a moment is about: a trainer's or the boss's own sprite, the lead
    // at a rest, and the kind's drawing otherwise.
    const nodeSprite = (node: NodeSpec): HTMLElement | null => {
      if (node.kind === 'rest') return leadSprite();
      if (node.kind !== 'trainer' && node.kind !== 'gym') return null;
      const sprite = node.trainerClass ? (trainerClass(node.trainerClass)?.sprite ?? null) : (node.encounter?.source?.sprite ?? null);
      return sprite ? opponentImg(sprite, 24) : null;
    };
    const enterNode = async <T,>(node: NodeSpec | undefined, answer: T): Promise<T> => {
      if (node) {
        returnDue = node.kind !== 'rest';
        await beat(node.kind, nodeSprite(node));
      }
      return answer;
    };
    const arriveAtMap = (): void => {
      if (!returnDue) {
        showScreen('map');
        return;
      }
      returnDue = false;
      void beat('return', leadSprite(), () => showScreen('map'));
    };

    const policy: RunPolicy = {
      bindPartyEditor: (edit) => {
        editParty = edit;
      },
      chooseStarter: (options: PokemonSpec[]) => {
        starterScreen.render(options, (index) => starterPick.submit(index));
        showScreen('starter');
        return starterPick.wait();
      },
      /*
       * **Defender Mode v0's four questions, bible Rev 25.** The gym type on
       * its own screen (D101); the draft and the recruit on the starter
       * screen, unchanged but for the heading and the Fire flame (D100); a door
       * on the map screen, which `onState` has already drawn with the rank's
       * doors, exactly as `chooseNode` does.
       */
      chooseGymType: (options) => {
        gymSelectScreen.render(options, (index) => gymTypePick.submit(index));
        showScreen('gym-select');
        return gymTypePick.wait();
      },
      chooseDraftPick: (options, state) => {
        const gymType = state.defender?.gymType ?? '';
        starterScreen.render(options, (index) => starterPick.submit(index), { title: DEFENDER_SCREEN_COPY.draft, gymType });
        showScreen('starter');
        return starterPick.wait();
      },
      chooseRecruit: (options, state) => {
        const gymType = state.defender?.gymType ?? '';
        starterScreen.render(options, (index) => starterPick.submit(index), { title: DEFENDER_SCREEN_COPY.recruit, gymType });
        showScreen('starter');
        return starterPick.wait();
      },
      chooseDoor: (options) => {
        const picked = nodePick.wait();
        arriveAtMap();
        return picked.then((index) => enterNode(options[index], index)).then(flushedBefore);
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
            leader: state.segments[state.currentSegment]?.leader ?? '',
            challenger: state.segments[state.currentSegment]?.gym.encounter?.opponent ?? '',
            sprite: state.segments[state.currentSegment]?.gym.encounter?.source?.sprite ?? null,
            party: state.party,
          },
          (index) => localePick.submit(index),
        );
        showScreen('locale');
        return localePick
          .wait()
          .then((index) => {
            // A region's first map arrives with *Where to next?* (D109).
            returnDue = true;
            return index;
          })
          .then(flushedBefore);
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
        mountNodeBand(preGymScreen.root, 'gym', live ? localeOf(live) : null);
        showScreen('pre-gym');
        // The gym's own beat, once the lead is chosen and before the fight (D109).
        return leadPick
          .wait()
          .then((lead) => enterNode(live?.segments[live.currentSegment]?.gym, lead))
          .then(flushedBefore);
      },
      chooseNode: (options: NodeSpec[]) => {
        // The map is already rendered by onState; this arms the buttons and
        // shows it, through the journey's seam (D109).
        const picked = nodePick.wait();
        arriveAtMap();
        return picked.then((index) => enterNode(options[index], index)).then(flushedBefore);
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
      reviewBattle: async (review, state) => {
        /*
         * **The end of the fight is played before the screen leaves it.**
         *
         * This one `await` is the whole fix for "a fight that ends in a
         * one-hit KO shows no animation". It was never only a 1HKO: the last
         * turn of *every* fight was swallowed, and a 1HKO is the case where the
         * last turn is the only turn, so it was the one where nothing moved at
         * all.
         *
         * The chain it interrupts: `driver.ts` drains the final protocol batch
         * and calls `notify` synchronously, `screens/battle.ts` renders, the
         * stage sets `data-fainting`/`data-hit` and the bar paints its chunk —
         * three CSS animations start — the battle loop exits, `run.ts` awaits
         * this policy, and the line below used to flip `hidden` on the battle
         * screen in the same microtask. No yield, no paint.
         *
         * **`reviewBattle` is the right seam because it is the only one.**
         * `core/run.ts` calls it for every battle completion, won or lost, with
         * cards or without, and says so: "It is one path, not a second one." So
         * one `await` covers gym, trainer, wild, victory and defeat with no
         * branch in `core/` and no new projection field — `won` and the node's
         * capture offer are already on the review.
         *
         * `releaseBattle()` is not called when a battle ends, only at the next
         * `onBattle` or at the end of the run, so the screen keeps its
         * subscription and its last frame for the whole hold.
         *
         * **It is the first thing in the function, and after Stage 4.9 that
         * ordering carries more than it did.** Three things now hang off a gym
         * clear — the outro, the evolution preview below, and `chooseEvolution`
         * after it (`core/run.ts` calls that one *after* `reviewBattle`). The
         * fight finishing on screen comes before any of them, so a player sees
         * the Pokemon that won leave the field before being told what it became.
         */
        await battleScreen.outro(outroFor(review));
        lastReview = review;
        /*
         * A gym clear shows what it does to the party before it shows what it
         * pays. Stage 4.9: the level-up's evolutions, previewed up to the first
         * fork; the fork itself is asked by `chooseEvolution` below, on this
         * same screen. Answers are collected across that clear's questions so
         * each re-render shows every step decided so far.
         */
        evolveAnswers.length = 0;
        const clearLevel = review.node.kind === 'gym' && review.won ? gymClearLevel(state) : null;
        const preview = clearLevel === null ? null : previewEvolutions(state.party, clearLevel, []);
        resultScreen.render(
          review,
          review.offer,
          state,
          (index) => rewardPick.submit(index),
          null,
          preview ? { records: preview.records } : null,
        );
        showScreen('result');
        return rewardPick.wait();
      },
      /*
       * The fork. Stage 4.9. Same screen, the block between the party and the
       * cards; choosing a branch is the continue, so the actions row is empty
       * while it is up. `state.party` is the pre-clear party, which is what the
       * question was computed from.
       */
      chooseEvolution: (question, state) => {
        const level = gymClearLevel(state);
        const preview = level === null ? { records: [] } : previewEvolutions(state.party, level, evolveAnswers);
        resultScreen.render(lastReview, null, state, () => undefined, null, {
          records: preview.records,
          question: {
            question,
            onChoose: (index) => {
              evolveAnswers.push(index);
              evolvePick.submit(index);
            },
          },
        });
        showScreen('result');
        return evolvePick.wait();
      },
      /*
       * The berry pick, on the same screen, in the cards' place. The berry
       * gym reward patch. `playRun` asks it right after the `berryPick` card
       * is claimed, so the result the card came from is still `lastReview`,
       * and the fifteen berries render where the three cards were. Choosing
       * one is the continue, as taking a card is.
       */
      chooseBerry: (pick, state) => {
        resultScreen.render(lastReview, null, state, () => undefined, null, null, {
          pick,
          badge: lastReview?.offer?.badge ?? 'gym',
          onChoose: (index) => berryPick.submit(index),
        });
        showScreen('result');
        return berryPick.wait();
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
        /*
         * **Wherever a TM may be spent the player is asked, rather than
         * answered for.**
         *
         * A plan composed on the map names a teach against the node the run has
         * just walked; it is spent at the boundary of the node the player walks
         * *next*, and if that one does not allow the move the teach is not
         * legal there. `reconcileItemPlan` would drop it, correctly and
         * silently, and the player would watch a TM they had arranged simply
         * fail to be spent.
         *
         * So the screen opens here, where composing and spending are the same
         * moment and `teachableNow` is the same answer for both. Everywhere
         * else the pre-composed plan still stands, because an item assignment
         * means the same thing at any boundary.
         *
         * **The gate is the set being non-empty, and that is what makes
         * teach-now a question rather than something done to the player.** It
         * used to read `canTeachNow(state) && state.tms.length > 0`, which is
         * true at a rest and a shop and nowhere else. A node that pays a move
         * now puts that move in `teachableNow`, so the screen opens there too
         * and the player answers *teach it now, or leave it in the bag* — which
         * is the whole of the choice. Leaving is the default and costs nothing
         * but the bag slot the TM was going to take anyway.
         *
         * Without this, `defaultItemPlan` below would have answered for them,
         * and rule 3 teaches every teachable TM to slot 0 — a move landing on
         * the lead, displacing something, with nobody asked.
         */
        if (teachableNow(state).size > 0) {
          live = state;
          atTeachBoundary = true;
          // On the Bag, where the TMs are (bible Rev 23, D95).
          partyVia = 'bag';
          showParty(partyReturn === 'pre-gym' ? 'pre-gym' : 'map', 'bag');
          const composed = await itemPlanPick.wait();
          atTeachBoundary = false;
          holdPlan(null);
          return reconcileItemPlan(
            state,
            composed,
            backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics)),
            teachableNow(state),
          );
        }
        const plan = pendingPlan;
        holdPlan(null);
        /*
         * **Nothing held: keep the layout the run has, and equip only what this
         * node brought. Bible Rev 23, D94.** A layout made on the map is already
         * applied (`flushedBefore`), so the old answer here, `defaultItemPlan`,
         * would fill every empty hand and put back an item the player had just
         * taken off. `keepLayoutPlan` fills a hand only from `nodeArrived`.
         */
        if (!plan) {
          return reconcileItemPlan(
            state,
            keepLayoutPlan(state, nodeArrived),
            backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics)),
            teachableNow(state),
          );
        }
        /*
         * **Brought forward before it is answered with, and this is the fix
         * for the Carry on soft lock.**
         *
         * The plan was composed on the party screen against the inventory the
         * run held *then*. It is spent here, after the node has resolved — and
         * the node is exactly what may have taken an item out of the bag: an
         * event's forced `discard`, a `loseItem`, a berry the sim ate, a grant
         * that filled the last slot. The plan then names something the run no
         * longer holds, `applyItemPlan` refuses it with a `RangeError`, and
         * until the catch below learned to tell a broken run from an abandoned
         * one that `RangeError` went nowhere: the player sat on the event
         * screen pressing a Carry on that had already been pressed.
         *
         * `reconcileItemPlan` is `core/` and pure, so what it returns is what
         * the log records and what a replay applies. See
         * `docs/spec/gymrun-patch-carry-on-softlock.md`.
         */
        return reconcileItemPlan(
          state,
          plan,
          backpackCapacity(partyCapacity(state), state.tuning, applyRelicPassives(state.relics)),
          teachableNow(state),
        );
      },
      chooseShopPurchases: (stock, state) => {
        shopScreen.render(stock, state, (indexes) => shopBasket.submit(indexes));
        // The node band (D109): the shop's token and silhouette, and the region.
        mountNodeBand(shopScreen.root, 'shop', localeOf(state));
        showScreen('shop');
        return shopBasket.wait();
      },
      chooseEventOption: (event, state) => {
        // The event screen holds the run open between the pick and the reveal:
        // it resolves this promise on "Carry on", not on the choice itself.
        eventScreen.render(event, state, (archetype) => eventPick.submit(archetype));
        mountNodeBand(eventScreen.root, 'event', localeOf(state));
        showScreen('event');
        return eventPick.wait();
      },
      /*
       * `chooseMoveRecipient` and `chooseMoveToReplace` were wired here and are
       * gone with the policy methods themselves.
       *
       * The two screens they drove are not gone — `targetScreen` and
       * `replaceScreen` still exist and still ask exactly what they asked — but
       * they are reached from the party screen while a plan is being composed
       * now, not from `playRun` at the node that paid for the move. A teach is
       * part of one `ItemPlan` rather than two log entries of its own.
       */
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
            /*
             * **The party as the fight left it, not as the node found it. The
             * opening playtest QA, QA-002.**
             *
             * `party` is `state.party`, which holds the HP and PP the node was
             * entered with until `resolveNode` folds the battle in, so the
             * capture block showed a Skrelp at 36/44 as 44/44 and full PP. The
             * projection is the same fold computed in `core/`, and a battle
             * fold moves no slot, so every slot the block's release control
             * names is the slot `decisionRefusal` checks.
             */
            party: decidedParty ?? party,
            onDecide: (decision) => {
              /*
               * **A release drops the pending plan, for the reason the party
               * screen's own release does.**
               *
               * A plan names *slots*, and `applyAcquisition` removes the
               * released slot and appends the new member — so every slot behind
               * it becomes a different Pokemon. Carrying the plan across would
               * hand the Leftovers the player chose for their Mantyke to
               * whoever shifted up into that slot, silently and with no error
               * to notice. `showParty`'s `onRelease` states the rule; this is
               * the same edit arrived at from the capture side, which is the
               * other of the two paths that can shorten a party.
               *
               * `accept` appends and touches no existing slot, so it keeps the
               * plan. `decline` changes nothing at all.
               */
              if (decision.kind === 'release') holdPlan(null);
              acquirePick.submit(decision);
            },
          });
          showScreen('result');
        }
        return acquirePick.wait();
      },
      battle: () => movePick.wait(),
    };

    /*
     * Every decision this run makes, as the Run Progress feed. **Stage
     * 5.0/1.** Wrapped around the replay on a resume, so the feed sees the
     * logged questions too; it answers nothing itself.
     */
    const feed = createDecisionFeed(resume ? replayRunPolicy(resume, policy, mode) : policy);

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
     *
     * **`partyWithPlan` folds the other half of the same plan**, added by the
     * learn-move refresh patch: a teach composed on the party screen is spent
     * at the same boundary the item half is, and until it was folded here the
     * drawer went on listing the move the player had just replaced. Same
     * argument, same plan, one field further down it.
     */
    readDrawer = () => {
      const state = live;
      if (!state) return null;
      /*
       * **The drawer shows what the surface underneath it shows, and that is
       * the whole rule.**
       *
       * Three sources, read in order of how close each is to the moment the
       * player is standing in:
       *
       *   1. `liveBattle` — a fight in progress. The only source that is not a
       *      fold of run state at all, because mid-fight there is no run state
       *      to fold: the damage is in the sim. An empty contribution list is
       *      deliberate — `applyBattleState` keeps the member's own counters
       *      when a delta is missing, and a fight's contribution is not final
       *      until it ends.
       *   2. `decidedParty` — a decision the run has taken and not applied,
       *      from the projection hook. **It used to have a second setter** and
       *      does not any more: the move questions were asked from `playRun`
       *      against a party that did not fold the battle, so the drawer had to
       *      be pinned to that reading or it would have shown live HP over a
       *      screen showing pre-fight HP. Moves became bag items and teaching
       *      moved to the party screen, which is reached between nodes where
       *      `live` is already current — so the second reading, and the pin it
       *      needed, are both gone. The projection is the only setter now.
       *   3. `live.party` — between nodes, which is every other screen.
       */
      /*
       * **The fight is only a source while its screen is up**, and the gate is
       * the same condition the blurb uses rather than `liveBattle` being set.
       *
       * The session outlives its screen: `releaseBattle` runs when the *next*
       * fight starts, so between the outro and the end of the node the ended
       * session is still in hand. Reading it there is not merely redundant —
       * `partyState` would keep answering with the battle's three members while
       * the projection had already folded in the Pokemon the player caught,
       * which is the reported defect wearing this patch's clothes.
       */
      const fight = router.current() === 'battle' ? liveBattle : null;
      /*
       * The plan is folded onto the between-nodes reading only, and that is
       * not an omission: `run.canTeachAt` allows a teach at a rest or a shop
       * and nowhere else, so a plan holding one cannot coexist with a fight on
       * screen. Folding it into the battle reading would be previewing a teach
       * that could not have been composed.
       */
      const party = fight
        ? applyBattleState(fight.sent, fight.session.partyState('p1'), [])
        : partyWithPlan(decidedParty ?? state.party, pendingPlan);
      return {
        party,
        holding: itemLayoutOf(party, pendingPlan),
        relics: decidedRelics ?? state.relics,
        tuning: state.tuning,
        // The Bag tab's readout, as run state holds it. Stage 5.0/1.
        bag: {
          loose: state.backpack,
          capacity: backpackCapacity(partyCapacity(state), state.tuning),
          tms: state.tms,
          consumables: state.consumables ?? [],
        },
      };
    };

    // The map overlay's window onto this run. A read of the same `live`
    // reference, with nothing derived — see the declaration above.
    readMap = () => live;
    readRunInfo = () => (live ? { state: live, entries: feed.entries() } : null);
    /*
     * The Team and Bag tabs' writable destination: the party screen, from the
     * two surfaces whose Manage buttons already lead there. Everywhere else
     * the tab opens the read-only drawer. Stage 5.0/1, the guard.
     */
    /*
     * **Every surface outside a battle, since bible Rev 23 (D94).** It was the
     * map and pre-gym only, so a player on a result, a shop or an event could
     * look at their items and not move one. Mid-node the screen offers items
     * and not reorder or release, and the layout rides the node's boundary.
     */
    openPartyRoute = (bag) => {
      const name = router.current();
      if (!live || !name || !WRITABLE_TAB_SURFACES.includes(name)) return false;
      atTeachBoundary = false;
      showParty(name, bag ? 'bag' : 'team');
      return true;
    };
    switchPartyFocus = (focus) => {
      if (router.current() !== 'party') return;
      showParty(partyReturn, focus);
    };
    leavePartyForMap = () => {
      if (!live || router.current() !== 'party' || partyReturn !== 'map' || itemPlanPick.isWaiting()) return false;
      // The plan stays held in `pendingPlan`, exactly as the back control leaves it.
      showScreen('map');
      return true;
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
    /** The branch answers given so far on the current gym clear. Stage 4.9. */
    const evolveAnswers: number[] = [];

    /*
     * The item plan the player has composed on the party screen, if any.
     *
     * Held here between the screen and the next `chooseItemPlan` call, because
     * the two are separated by however long the player spends on the map. Null
     * means they never opened the screen, and the run falls back to the
     * reference plan — which is also what happens on the very first boundary,
     * before the screen has ever been shown.
     */
    let pendingPlan: ItemPlan | null = resume ? loadItemDraft(resume) : null;

    /*
     * How many decisions the log holds, for the draft's stamp. Kept by
     * `onDecision`, which a replay fires for every entry it re-records.
     */
    let loggedDecisions = resume?.decisions.length ?? 0;

    /*
     * **Every write to `pendingPlan` goes through here. The second QA pass,
     * QA-008 and QA-009.** A teach or a move to the bag was held only in this
     * variable until the boundary that spends it, so a reload dropped it and
     * the run came back as the log had it. The draft now goes to storage
     * beside the log on every change and comes back on resume; see
     * `ui/storage.ts` `loadItemDraft` for when it does not.
     */
    const holdPlan = (plan: ItemPlan | null): void => {
      pendingPlan = plan;
      if (plan) saveItemDraft({ seed, decisions: loggedDecisions, plan });
      else clearItemDraft();
    };

    /*
     * The party a decision has already settled on, while `live` is still behind.
     *
     * **`live` lags inside a node, and the drawer is the surface where that
     * shows.** `playRun` applies a capture in `resolveNode`, at the end of the
     * node, but it asks the move questions *before* that — against
     * `partyAfterAcquisition`, the party with the decision folded in. So
     * between "release the Mantyke for this Anorith" and the end of the node,
     * the recipient screen lists Anorith and `live.party` still holds Mantyke.
     * A player who opened the drawer on that screen was shown a party
     * contradicting the one they were picking from, which is the readout
     * failure `ui/party-layout.ts` names and the drawer exists to remove.
     *
     * `core/run.ts` cannot close it from its side: nothing has happened to run
     * state yet, so there is no `onState` for it to fire. What it hands over
     * instead is a projection — the applied result of the same folds
     * `resolveNode` will perform, computed in `core/` — so `ui/` stays out of
     * deciding what a capture means.
     *
     * Read-only surfaces only. The party screen is a *write* path — a reorder
     * or a release mutates the array it was handed — and pointing that at a
     * party the run has not adopted yet would drop the edit at the node
     * boundary. It is unreachable during this window anyway: the drawer is the
     * one surface open on every screen.
     *
     * Cleared in `onState`, which is exactly the moment `live` catches up.
     */
    let decidedParty: readonly PokemonState[] | null = null;

    /*
     * The relics held, when a card taken this node has not been folded yet.
     *
     * The same lag as `decidedParty` and the same lifetime: the player takes a
     * relic on the result screen, `resolveNode` grants it at the end of the
     * node, and the capture screen in between listed the relics they held
     * before the choice they had just made. `core/run.ts` projects it, because
     * reading a reward card's kind here would be `ui/` deciding what a card
     * pays.
     */
    let decidedRelics: readonly RelicId[] | null = null;

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
          leader: state.segments[state.currentSegment]?.leader ?? '',
          challenger: state.segments[state.currentSegment]?.gym.encounter?.opponent ?? '',
          segment: state.currentSegment,
          /*
           * Both halves of the plan, for the reason `readDrawer` gives: the
           * player walked here from the party screen and the cards must show
           * what they arranged there. Slot order is untouched by either fold,
           * so `defaultLeadSlot` and the slot `onLead` submits still name the
           * same member in run state.
           */
          party: partyWithPlan(state.party, pendingPlan),
          holding: itemLayoutOf(state.party, pendingPlan),
          tuning: state.tuning,
          ...(runMode(state) === 'defender' ? { boss: bossOf(state) } : {}),
        },
        {
          onLead: (slot) => {
            pendingGym = null;
            leadPick.submit(slot);
          },
          onManageParty: () => {
            // Not the boundary: this is the player looking, between decisions.
            atTeachBoundary = false;
            showParty('pre-gym');
          },
        },
      );
    };

    /**
     * Where the party screen's Done goes back to.
     *
     * Remembered rather than passed to `onDone`, because two things redraw an
     * already-open party screen — a reorder or release, and the density toggle
     * — and a redraw must not quietly retarget the way out.
     */
    let partyReturn: ScreenName = 'map';
    /** Which tab's screen the party screen is drawn as. Bible Rev 23, D95. */
    let partyFocus: PartyFocus = 'team';

    /*
     * Whether the party screen is open **at** the boundary that may spend a TM.
     *
     * **This is the difference between a teach that happens and a teach that is
     * silently thrown away**, and it is not the same question as
     * `run.canTeachNow`.
     *
     * `canTeachNow` reads the node the run has just walked, and it stays true
     * for the whole time the player then stands on the map — so the Manage
     * button offered a Teach control after every rest and every shop. The plan
     * that control composes is not spent there: it is held in `pendingPlan` and
     * spent at the boundary of the node walked *next*, where `canTeachNow`
     * reads that node instead. Walk into a fight, and `reconcileItemPlan` drops
     * the teach — correctly, by its own rule, and silently — and the TM is back
     * in the bag.
     *
     * Measured on the scripted baseline, 400 runs: of 111 teaches composed from
     * the map, **9 survived and 57 were dropped** (the rest never reached a
     * boundary before the run ended). A control that works 8% of the time is
     * worse than one that is not offered, which is what the reported
     * "teaching tms doesnt work, the tms return to inventory" was.
     *
     * So teaching is offered only where composing and spending are the same
     * moment — the screen `chooseItemPlan` opens — which is what that function's
     * own comment already said the design was. Set there, cleared when the plan
     * is answered, and left alone by the re-renders (`back`, a reorder, a
     * release) that re-enter this screen without leaving the boundary.
     */
    let atTeachBoundary = false;

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
    const showParty = (returnTo: ScreenName, focus: PartyFocus = partyFocus): void => {
      const state = live;
      if (!state) return;
      partyReturn = returnTo;
      partyFocus = focus;
      const betweenNodes = PARTY_EDIT_SURFACES.includes(returnTo);
      partyScreen.render(
        {
          /*
           * Mid-node, the party as the node will leave it (D94): a plan names
           * slots, and the boundary that spends it reads the resolved party,
           * a caught Pokemon included. Between nodes that is `state.party`.
           */
          party: betweenNodes ? state.party : (decidedParty ?? state.party),
          focus,
          canEditParty: betweenNodes,
          // Defender Mode v0 (D102): usable wherever the run is not inside a
          // battle node, which is between nodes and the intermission's shop.
          consumables: state.consumables ?? [],
          canConsume: betweenNodes || returnTo === 'shop',
          backpack: state.backpack,
          tms: state.tms,
          teachable: atTeachBoundary ? teachableNow(state) : new Set<string>(),
          relics: state.relics,
          tuning: state.tuning,
          slots: partyCapacity(state),
          // Named for where it goes; from a result, a shop or an event (D94)
          // the screen under it is the one the player left, so plain Back.
          backTo: returnTo === 'pre-gym' ? 'Back to the gym' : returnTo === 'map' ? 'Back to the map' : 'Back',
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
            holdPlan(null);
            editParty?.({ kind: 'reorder', from, to });
            showParty(partyReturn);
            if (partyReturn !== 'locale') mapScreen.render(state, (index) => nodePick.submit(index));
          },
          onRelease: (slot) => {
            holdPlan(null);
            // The item goes to the bag, in `core/run.ts`'s editor.
            editParty?.({ kind: 'release', slot });
            showParty(partyReturn);
            if (partyReturn !== 'locale') mapScreen.render(state, (index) => nodePick.submit(index));
          },
          onPlan: (plan) => {
            holdPlan(plan);
          },
          // A use changes HP and the list, never a slot, so the held plan stays.
          onConsume: (id, slot) => {
            editParty?.({ kind: 'consume', id, slot });
            showParty(partyReturn, 'bag');
          },
          /*
           * Spending a TM: the same two screens, reached from here instead of
           * from `playRun`.
           *
           * **Neither screen changed and neither is a copy.** `targetScreen`
           * asks who learns it against the whole party, and `replaceScreen`
           * asks what it costs that member — the identical pair a move card
           * asked at the node it was taken at, in the identical order, for the
           * identical reason: the four moves on the table depend entirely on
           * who is learning.
           *
           * What changed is who is waiting on the answer. `playRun` used to
           * park on a pending promise; here the party screen hands in a
           * continuation, because a teach is one part of a plan the player is
           * still composing and backing out has to leave them on the party
           * screen with the plan intact.
           *
           * The decline control on the target screen is offered, and it means
           * "not this one, not now" rather than the retired "nobody ever" —
           * the TM stays in the bag.
           */
          onTeach: (move, done) => {
            const reward = { kind: 'tm' as const, move };
            const back = (): void => {
              showParty(partyReturn);
            };
            /*
             * **Asked against the party this plan has already taught, not the
             * one the run still holds.** The learn-move refresh patch, and the
             * half of it that is not cosmetic.
             *
             * `pendingPlan` is current here: the party screen commits on every
             * change, so a teach arranged a moment ago is already in it. Both
             * questions below read `replacementNeeded`, and reading it against
             * run state answers for a member that has not learned the earlier
             * teach — which is the same divergence `reconcileItemPlan`'s own
             * comment warns about, arriving one screen earlier. A member with
             * three moves and two TMs pointed at it was asked "free slot?"
             * twice, said yes twice, and the boundary then dropped the second
             * teach with the TM silently back in the bag.
             *
             * The recipient list is drawn from the same reading, so the four
             * moves the replace screen offers are the four the member will
             * actually have when this teach lands.
             */
            const shown = partyWithPlan(state.party, pendingPlan);
            targetScreen.render(
              reward,
              shown,
              (slot) => {
                if (slot === TEACH_CANCELLED) {
                  done(null);
                  back();
                  return;
                }
                const learner = shown[slot];
                if (!learner) {
                  done(null);
                  back();
                  return;
                }
                if (replacementNeeded(learner, move) !== 'choose') {
                  done({ move, slot, replaceSlot: null });
                  back();
                  return;
                }
                const incoming = describeMove(move);
                if (!incoming) {
                  done(null);
                  back();
                  return;
                }
                replaceScreen.render(
                  learner,
                  incoming,
                  (replaceSlot) => {
                    done({ move, slot, replaceSlot });
                    back();
                  },
                  state.tuning,
                );
                showScreen('replace');
              },
              state.tuning,
              true,
            );
            showScreen('target');
          },
          /*
           * Back to whichever screen sent us, and redraw it first when that
           * screen is the pre-gym one. See `renderPreGym` for why the redraw is
           * load-bearing rather than tidy.
           */
          onDone: () => {
            /*
             * The way out is also the commit, and only when the boundary is
             * waiting on one.
             *
             * `itemPlanPick.submit` answers false when nothing is armed, which
             * is every ordinary visit to this screen from the map — there the
             * plan is held in `pendingPlan` and spent at the next boundary, as
             * it always was. When a rest or a shop opened the screen to ask,
             * this is the answer, and the run continues from here.
             */
            const plan = pendingPlan ?? {
              assignments: state.party.map((member, slot) => ({ slot, item: member.item ?? null })),
              discards: [],
              teaches: [],
              discardTms: [],
            };
            if (itemPlanPick.submit(plan)) return;
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
      // And the overrides go with it: `live` is now what the run holds, so a
      // stand-in for it is a second answer to a question with one.
      decidedParty = null;
      decidedRelics = null;
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
      mapScreen.render(state, (index) => nodePick.submit(index));
      sidebar.update(state, feed.entries());
      refreshNav();
    };

    /*
     * What the run has been told and not yet applied. **Stage: this patch.**
     *
     * The one wire for every mid-node readout: a finished fight, a taken relic
     * and a capture all arrive here the moment they become true, rather than at
     * the node boundary where `onState` would have reported them. `core/run.ts`
     * computes it — folding battle state in `ui/` would be a second reading of
     * what a node did, and the first divergence between the two would be
     * invisible.
     *
     * It does not touch `live`. A projection is not a run state and the app
     * must not start treating it as one: nothing decides against this, nothing
     * is saved from it, and the map is not redrawn on it.
     */
    const onProjection = (projection: RunProjection): void => {
      decidedParty = projection.party;
      decidedRelics = projection.relics;
    };

    const onBattle = (session: BattleSession, node: NodeSpec, state: RunState): void => {
      releaseBattle();
      // The fight and the party it was sent with, for the drawer. `releaseBattle`
      // above has just cleared the previous one, so this is never the fight
      // before's session.
      liveBattle = { session, sent: state.party };
      /*
       * The reveal policy comes off the run's own tuning, not off the module
       * default, so a run started with a swept tuning shows what that run was
       * configured to show. Two booleans rather than the whole object: see the
       * header of screens/battle.ts.
       */
      const reveal = {
        ability: state.tuning.revealOpponentAbility,
        item: state.tuning.revealOpponentItem,
        /*
         * And the third one, which is the node's rather than the tuning's.
         *
         * A trainer and a gym leader arrive with a team, so the count is theirs
         * to show. A wild encounter is whatever the grass has left, and a number
         * there would be the game telling the player how long the fight lasts
         * before it has happened. `kind` is the only input: a wild node is the
         * one that withholds it, everything else is a person with a party.
         */
        teamSize: node.kind !== 'wild',
      };
      detachBattle = battleScreen.attach(
        session,
        node,
        reveal,
        (choice) => {
          // A click with nothing pending is a no-op, not a decision queued
          // against the following turn.
          movePick.submit(choice);
        },
        // The segment, so the panel can name who is playing this fight. The
        // same reading the node card made before the click.
        state.currentSegment,
        runMode(state) === 'defender',
      );
      // The node band (D109): the kind the fight is under, which the battle
      // header no longer carries as a mark.
      mountNodeBand(battleScreen.root, node.kind, localeOf(state));
      showScreen('battle');
    };

    try {
      /*
       * **No `opponent` here, and its absence is the whole of the tier patch
       * reaching the app.** `PlayRunOptions.opponent` pins one bot to every
       * fight in the run and, when it is set, `opponentFor` is not consulted
       * and no tier is read. It was set to `greedyAiPolicy` while that constant
       * *was* the opponent — it predates the tiers by two days — and the tiers
       * patch added `tieredOpponentFor` as the default without removing the
       * pin, so the shipped game went on playing `GREEDY_BASELINE`,
       * `smartSwitching` and all, behind a card that said `Rookie`. See
       * `generation.md` section 48.
       *
       * Leaving it out is what makes the badge true: `tieredOpponentFor` reads
       * `aiTierFor` per node, which is the same reading the node card and the
       * battle panel already print.
       */
      const options = {
        mode,
        onState,
        onBattle,
        onProjection,
        // What each node put in the bag, for the boundary's `keepLayoutPlan`.
        // Observed on replay too, so a resumed run answers the same way.
        onNodeResolved: (before: RunState, after: RunState) => {
          nodeArrived = arrivedItems(before.backpack, after.backpack);
        },
        // The first decision of a fresh run replaces the save the button pointed at.
        onDecision: (log: RunLog) => {
          feed.record(log);
          sidebar.update(live, feed.entries());
          saveRunLog(log);
          loggedDecisions = log.decisions.length;
          // A fresh run's starter: nothing can be pending yet, and a draft left
          // by the save it replaces must not come back into this one.
          if (!resume && log.decisions.length === 1) clearItemDraft();
          seedBar.setResumable(false);
        },
      };
      /*
       * The decision feed wraps the replay rather than the live policy, so a
       * resumed run's logged questions pass through it with their real offers
       * and the feed rebuilds itself. This is `resumeRun` spelled out with the
       * wrapper in the middle: the same replay, the same live handover, the
       * same answers. `ui/decision-feed.ts`.
       */
      const result: RunResult = await playRun(resume?.seed ?? seed, feed.policy, DEFAULT_TUNING, options);

      releaseBattle();
      // Leave the map showing the run as it finished, behind the summary.
      mapScreen.render(result.state, () => undefined);
      summaryScreen.render(result);
      // The summary is locale neutral, and its stamps say so too.
      applyLocale(null);
      applyField(null);
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
      clearItemDraft();
    } catch (error) {
      /*
       * An abandoned decision, which happens when the player starts a
       * different run while this one is parked on a question. Expected, and
       * the new run has already taken the screens.
       */
      if (isRunAbandoned(error)) return;
      /*
       * **Anything else is a bug, and it used to be invisible.**
       *
       * This was a bare `catch {}` on the note that an abandoned decision was
       * the only non-finishing exit from `playRun`. It is not: every
       * `RangeError` `core/` raises to refuse an illegal answer lands here
       * too, and swallowing one leaves the player on a screen whose question
       * has already been answered — no control that advances the run, nothing
       * in the console, nothing to do but reload. That is the soft lock
       * `docs/spec/gymrun-patch-carry-on-softlock.md` was filed against, and a
       * screen that says nothing is worse than a screen that says it broke.
       *
       * The run is over either way. What changes is that it says so, hands the
       * seed controls back, and leaves the error where a report can quote it.
       */
      console.error('GYMRUN: the run stopped on an error', error);
      releaseBattle();
      /*
       * **And the save goes with it, because a save is how this became
       * unrecoverable rather than annoying.**
       *
       * `onDecision` is `saveRunLog`, and `record` runs *before* the answer is
       * applied — so the decision that `core/` then refused is already in
       * `localStorage` by the time it throws. Reloading resumes that log,
       * replays the same decisions, and dies at the same step. The player who
       * filed this had a run that was soft locked across reloads, not on one
       * screen.
       *
       * A log that deterministically cannot be applied is not a run to go back
       * to, so it is dropped rather than re-offered. That is a real cost and it
       * is the smaller one: the alternative is a Resume button that does
       * nothing but reproduce the failure.
       */
      clearRunLog();
      clearItemDraft();
      seedBar.setResumable(false);
      seedBar.warn(SEED_COPY.runFailed);
      setPhase('setup');
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

  const fromUrl = seedFromLocation(globalThis.location.href);
  /*
   * **Continuing is assumed on load. The opening playtest QA, the author's
   * ruling.**
   *
   * The URL seed used to win over a save, on the reading that a seed in the
   * URL is an explicit request for that run. But `start` writes every run's
   * own seed into the URL, so a reload of a run in progress carried its own
   * seed back in and restarted it from the starter choice with the save
   * sitting beside it. On a phone that is "sometimes": a restored tab keeps
   * the hash, a home screen launch does not.
   *
   * So a replayable save always resumes. A link naming a *different* seed is
   * not dropped: it goes in the box with a notice, and Start plays it. A save
   * this build cannot replay is said out loud rather than replaced silently.
   */
  if (saved && isReplayable(saved)) {
    void start(saved.seed, saved);
    if (fromUrl && fromUrl.seed !== saved.seed) {
      seedBar.setSeed(fromUrl.seed);
      seedBar.warn(SEED_COPY.linkWaiting);
    }
    return;
  }
  // A versioned URL made on another build has no paste moment to refuse at, so
  // the bare seed starts a fresh run and the bar says why it is not the same one.
  if (fromUrl) {
    void start(fromUrl.seed);
    if (fromUrl.kind === 'foreign') seedBar.refuse(fromUrl);
  } else void start(newSeed());
  if (saved && fromUrl?.kind !== 'foreign') {
    console.warn('GYMRUN: the saved run cannot be replayed on this build', describeVersionMismatch(versionMismatch(saved)!));
    // Reported, not acted on: the new run has started, so the bar stays shut.
    seedBar.warn(SEED_COPY.saveOutdated, { open: false });
  }
}
