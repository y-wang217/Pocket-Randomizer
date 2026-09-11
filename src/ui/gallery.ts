/**
 * The gallery: one surface, one seed, one density mode, rendered in the app's
 * own chrome. Stage V4; every surface since the density modes patch.
 *
 * Not part of the shipped build (`vite.gallery.config.ts` builds it to
 * `dist-gallery/`). It exists so a screenshot or a test can put a screen on
 * a phone viewport in a state the smoke bot cannot reach on demand: the
 * summary of a seed the scripted policy wins on, a result screen with three
 * cards and a capture offer on it at once, and — from the density patch —
 * every surface the shell can route to at its worst case, in any of the three
 * modes.
 *
 *   gallery.html#seed=SMOKE24&screen=party&density=pocket
 *   gallery.html#seed=SMOKE24&screen=result-capture
 *   gallery.html#seed=V5-LOADED-1&screen=battle
 *
 * `screen` is one of `ui/gallery-surfaces.ts`'s names; `density` is one of
 * the three modes, read into the same settings holder the app reads, so a
 * fixture in Pocket is rendered exactly as a stored Pocket preference renders
 * it. A missing `density` is the stored one, which on a fresh context is the
 * first-launch default.
 *
 * ## The same chrome as the app
 *
 * The header, the seed bar, the drawer bar, the drawer and the stamps are
 * mounted here through the same functions `app.ts` mounts them with, in the
 * same order, with the same phase attribute. The Pocket gate is a
 * `scrollHeight` gate on a whole page, and a fixture that drew a screen
 * without the header above it would measure a page the player never sees.
 *
 * ## Played where it can be, constructed where it must be
 *
 * The battle is played (V5.6: Swords Dance and Toxic against Rock Polish and
 * Thunder Wave until both panels are loaded), and the result screen's first
 * three-card offer and first capture offer are harvested from a real run of
 * the seed. The worst-case party, backpack, relics and eight-gym history are
 * constructed by `ui/gallery-fixtures.ts`, which says why and what the
 * construction never touches.
 */
import { greedyAiPolicy } from '../core/battle/ai';
import { createBattle } from '../core/battle/driver';
import type { NodeSpec } from '../core/encounters';
import { localeOf, partyCapacity, playRun, scriptedRunPolicy, type BattleReview, type RunState } from '../core/run';
import { moveChoice, type PokemonState, type TeamSpec } from '../core/types';
import type { AcquisitionOffer } from '../core/acquisition';
import type { RewardOffer } from '../core/rewards';
import { gymForSegment } from '../data/gyms';
import { DEFAULT_TUNING } from '../data/tuning';
import { createDrawer } from './drawer';
import {
  anyShop,
  finishedResult,
  incomingMove,
  lateState,
  openingState,
  targetedReward,
  wordiestEvent,
} from './gallery-fixtures';
import { GALLERY_SURFACES, type GallerySurface } from './gallery-surfaces';
import { createHeader } from './header';
import { itemLayoutOf } from './party-layout';
import { createWorldScene, el } from './scene';
import { createBattleScreen } from './screens/battle';
import { createEventScreen } from './screens/event';
import { createItemTargetScreen } from './screens/item-target';
import { createLocaleSelect } from './screens/locale-select';
import { createMoveReplaceScreen } from './screens/move-replace';
import { createPartyScreen } from './screens/party';
import { createPreGymScreen } from './screens/pre-gym';
import { createResultScreen } from './screens/result';
import { createRouter, DRAWER_SURFACES, type ScreenName } from './screens/router';
import { createRunMap } from './screens/run-map';
import { createShopScreen } from './screens/shop';
import { createStarterSelect } from './screens/starter-select';
import { createSummary } from './screens/summary';
import { createSeedBar } from './seed-bar';
import { DENSITIES, getDensity, initSettings, onSettingsChange, setDensity, type Density } from './settings';
import { createStamps } from './stamps';
import { applyDensity } from './theme/density';
import { applyLocale } from './theme/locale';
import { applyMotion } from './theme/motion';
import { createTooltips } from './tooltips';

const noop = (): void => undefined;

function isSurface(value: string): value is GallerySurface {
  return (GALLERY_SURFACES as readonly string[]).includes(value);
}

function isDensity(value: string | null): value is Density {
  return value !== null && (DENSITIES as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const params = new URLSearchParams(globalThis.location.hash.replace(/^#/, ''));
  const seed = params.get('seed') ?? 'SMOKE24';
  const requested = params.get('screen') ?? 'summary';
  const surface: GallerySurface = isSurface(requested) ? requested : 'summary';

  /*
   * The mode, from the store and then from the URL. The same holder and the
   * same root attribute the app uses, so nothing here is a second path: a
   * `density=` parameter is exactly a stored preference for this one page.
   */
  initSettings();
  const density = params.get('density');
  if (isDensity(density)) setDensity(density);
  /*
   * `fixture=worst` renders the constructed worst case (`ui/gallery-fixtures.ts`,
   * ruling 3) on the surfaces that have a walked state as well: the result
   * screen's two shapes take the party the seed's own run had at that
   * moment, and the loaded board stops the turn both panels are loaded. The
   * density gates ask for the worst case; the V4 and V5 suites, written
   * against the walked state, keep measuring what they measured.
   */
  const worst = params.get('fixture') === 'worst';
  applyDensity(getDensity());
  onSettingsChange((settings) => applyDensity(settings.density));
  applyMotion(document.documentElement);

  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root element');

  // The shell, in the app's order. See `app.ts` for why each piece is where it is.
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
  const stamps = createStamps();
  const world = createWorldScene();
  const drawerBar = el('div', 'shell__drawer-bar');
  drawerBar.append(drawer.trigger());
  const replayTutorial = document.createElement('button');
  shell.append(createHeader(replayTutorial, seedBar.toggle), seedBar.root, drawerBar, router.root, drawer.root, stamps.root);
  root.replaceChildren(world.root, shell);
  createTooltips(shell);

  const show = (name: ScreenName): void => {
    router.show(name);
    drawerBar.hidden = !DRAWER_SURFACES.includes(name);
  };
  const setPhase = (phase: 'setup' | 'running'): void => {
    shell.dataset['phase'] = phase;
  };
  const stamp = (state: RunState | null): void => {
    stamps.update({
      locale: state ? localeOf(state) : null,
      segment: state ? state.currentSegment + 1 : null,
      segments: state ? state.segments.length : 0,
      seed,
    });
  };

  seedBar.setSeed(seed);
  seedBar.collapse();
  setPhase(surface === 'summary' ? 'setup' : 'running');

  switch (surface) {
    case 'starter': {
      const state = openingState(seed);
      starterScreen.render(state.starterOptions, noop);
      applyLocale(null);
      stamp(null);
      show('starter');
      break;
    }
    case 'locale': {
      const state = openingState(seed);
      const segment = state.segments[0];
      if (!segment) throw new Error('no segment');
      localeScreen.render({ options: segment.localeOffer, segment: 0, gym: gymForSegment(0), party: state.party }, noop);
      applyLocale(null);
      stamp(null);
      show('locale');
      break;
    }
    case 'map':
    case 'drawer': {
      const state = openingState(seed);
      mapScreen.render(state, noop, noop);
      applyLocale(localeOf(state));
      stamp(state);
      show('map');
      if (surface === 'drawer') {
        drawer.open({ party: state.party, holding: itemLayoutOf(state.party, null), relics: state.relics, tuning: state.tuning });
      }
      break;
    }
    case 'battle':
    case 'log-sheet': {
      const state = openingState(seed);
      mountLoadedBattle(battleScreen, seed, worst ? state.party : [], { history: worst && surface === 'log-sheet' });
      applyLocale(localeOf(state));
      stamp(state);
      show('battle');
      if (surface === 'log-sheet') battleScreen.root.querySelector<HTMLElement>('.flags__history')?.click();
      break;
    }
    case 'result':
    case 'result-capture': {
      const { offer, capture, last } = await harvestOffers(seed);
      // Worst case: the party as the fight left it is the six-member party,
      // hurt and statused, and the fight's own numbers come from the played
      // review. Walked: the run's own state at its first three-card offer.
      const state = worst ? lateState(seed) : (offer?.state ?? last);
      const review: BattleReview | null = offer ? (worst ? { ...offer.review, party: state.party } : offer.review) : null;
      const captureParty = worst ? state.party : (capture?.party ?? state.party);
      applyLocale(localeOf(state));
      stamp(state);
      if (surface === 'result') {
        resultScreen.render(review, offer?.offer ?? null, state, noop);
      } else {
        resultScreen.render(
          review,
          null,
          state,
          noop,
          capture ? { offer: capture.offer, party: captureParty, onDecide: noop } : null,
        );
      }
      show('result');
      break;
    }
    case 'target': {
      const state = lateState(seed);
      targetScreen.render(targetedReward(), state.party, noop, state.tuning);
      applyLocale(localeOf(state));
      stamp(state);
      show('target');
      break;
    }
    case 'replace': {
      const state = lateState(seed);
      const member = state.party[0];
      if (!member) throw new Error('no party');
      replaceScreen.render(member, incomingMove(), noop, state.tuning);
      applyLocale(localeOf(state));
      stamp(state);
      show('replace');
      break;
    }
    case 'party': {
      const state = lateState(seed);
      partyScreen.render(
        {
          party: state.party,
          backpack: state.backpack,
          relics: state.relics,
          tuning: state.tuning,
          slots: partyCapacity(state),
          backTo: 'Back to the map',
          plan: null,
        },
        { onReorder: noop, onRelease: noop, onPlan: noop, onDone: noop },
      );
      applyLocale(localeOf(state));
      stamp(state);
      show('party');
      break;
    }
    case 'pre-gym': {
      const state = lateState(seed);
      preGymScreen.render(
        {
          gym: gymForSegment(state.currentSegment),
          segment: state.currentSegment,
          party: state.party,
          holding: itemLayoutOf(state.party, null),
          tuning: state.tuning,
        },
        { onLead: noop, onManageParty: noop },
      );
      applyLocale(localeOf(state));
      stamp(state);
      show('pre-gym');
      break;
    }
    case 'shop': {
      const state = lateState(seed);
      const stock = anyShop(state);
      if (!stock) throw new Error('the map has no shop');
      shopScreen.render(stock, state, noop);
      applyLocale(localeOf(state));
      stamp(state);
      show('shop');
      break;
    }
    case 'event': {
      const state = lateState(seed);
      eventScreen.render(wordiestEvent(seed), state, noop);
      applyLocale(localeOf(state));
      stamp(state);
      show('event');
      // Revealed: the outcome block is on screen, which is the taller shape.
      eventScreen.root.querySelector<HTMLElement>('.event__choice')?.click();
      break;
    }
    case 'summary': {
      const played = await playRun(seed, scriptedRunPolicy(greedyAiPolicy), DEFAULT_TUNING, { opponent: greedyAiPolicy });
      summaryScreen.render(finishedResult(seed, played.log));
      applyLocale(null);
      stamp(lateState(seed));
      show('summary');
      break;
    }
  }

  document.documentElement.dataset['galleryReady'] = 'true';
}

/**
 * The result screen's two decision points, from a real run of the seed: the
 * first review that carries three cards, and the first capture offer.
 */
async function harvestOffers(seed: string): Promise<{
  offer?: { review: BattleReview; offer: RewardOffer; state: RunState };
  capture?: { offer: AcquisitionOffer; party: readonly PokemonState[] };
  last: RunState;
}> {
  const held: {
    offer?: { review: BattleReview; offer: RewardOffer; state: RunState };
    capture?: { offer: AcquisitionOffer; party: readonly PokemonState[] };
  } = {};
  const policy = scriptedRunPolicy(greedyAiPolicy);
  const played = await playRun(
    seed,
    {
      ...policy,
      reviewBattle: async (review, state) => {
        if (!held.offer && review.offer && review.offer.options.length === 3) held.offer = { review, offer: review.offer, state };
        return review.offer ? 0 : null;
      },
      chooseAcquisition: async (offer, party, capacity) => {
        if (!held.capture) held.capture = { offer, party };
        return policy.chooseAcquisition(offer, party, capacity);
      },
    },
    DEFAULT_TUNING,
    { opponent: greedyAiPolicy },
  );
  return { ...held, last: played.state };
}

/**
 * A battle with both panels carrying everything they can carry, and a full
 * bench behind the player's side.
 *
 * The four moves are chosen so the state is reached by *playing*, not by
 * constructing a projection: Swords Dance and Rock Polish are boosts that
 * cannot miss, Toxic and Thunder Wave are the statuses each side can land on
 * the other. Golem is Rock/Ground so Toxic applies; Snorlax is Normal so
 * Thunder Wave does. Both are 90% accurate, which is why this loops rather
 * than taking four turns and hoping — it stops the moment both panels are
 * loaded, and gives up after enough turns that a run of misses is not what
 * a red measurement would be reporting.
 *
 * Level 100 on both sides, because the panel's widest line is the HP readout
 * and three digits either side of the slash is the longest it gets. The bench
 * is the worst-case party's other five members (density patch): a party of
 * six is the widest the run allows and the switch panel is the one region of
 * the battle screen that grows with it.
 */
const LOADED_LEAD: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Swords Dance', 'Toxic', 'Body Slam', 'Rest'], level: 100 },
];
const LOADED_P2: TeamSpec = [
  { species: 'Golem', ability: 'Sturdy', moves: ['Rock Polish', 'Thunder Wave', 'Earthquake', 'Rollout'], level: 100 },
];

function mountLoadedBattle(
  battle: ReturnType<typeof createBattleScreen>,
  seed: string,
  party: readonly PokemonState[],
  options: { history: boolean },
): void {
  const bench = party.slice(1).map((member) => member.spec);
  const session = createBattle({ teams: { p1: [...LOADED_LEAD, ...bench], p2: LOADED_P2 }, seed });

  const node = {
    id: 's1-1-0',
    kind: 'battle',
    tier: 'normal',
    label: 'A loaded board',
    // A plain name. `boundaries.test.ts` reads every string literal under
    // `src/ui/` for verdict vocabulary and does not care that this one is a
    // harness — which is right, because the check cannot tell and should not
    // have to.
    encounter: { team: LOADED_P2, opponent: 'A trainer', simSeed: seed },
    rewards: [],
  } as unknown as NodeSpec;
  battle.attach(session, node, { ability: true, item: true }, () => undefined);

  const loaded = (): boolean => {
    const facts = session.factsFor('p1');
    const sides = [facts.player, facts.opponent] as { status: string | null; boosts: Record<string, number> }[];
    return sides.every((side) => Boolean(side.status) && Object.values(side.boosts).some((stage) => stage !== 0));
  };

  /*
   * Slot 1 is each side's own boost and slot 2 is the status it lands on the
   * other. **Boost first**, because it cannot miss and a panel carrying a
   * status but no stage is only half the worst case; then the status, until it
   * sticks. Neither side ever picks a damaging move, so nobody faints and the
   * loop ends on the state rather than on the battle.
   */
  const boosted = (side: { boosts: Record<string, number> }): boolean =>
    Object.values(side.boosts).some((stage) => stage !== 0);

  /*
   * The board stops the turn it is loaded, so the strip carries that turn's
   * words (`test/visual-v5.test.ts` reads two of them at once on its seed).
   * With `history`, for the log sheet's fixture, the loop keeps going past
   * it, boosts only, while the poisoned side still has half its HP: a sheet
   * that opened on a dozen lines had nothing to scroll, and a side that
   * fainted would hand the board to the bench. Both panels stay loaded
   * throughout — a stage does not unboost and a status does not lift.
   */
  const more = (): boolean => {
    if (!loaded()) return true;
    if (!options.history) return false;
    const opponent = session.factsFor('p1').opponent;
    return opponent.hp > opponent.maxHp / 2;
  };
  for (let turn = 0; turn < 24 && !session.ended && more(); turn++) {
    const facts = session.factsFor('p1');
    if (session.viewFor('p1').awaitingChoice) session.submit('p1', moveChoice(!loaded() && boosted(facts.player) ? 2 : 1));
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', moveChoice(!loaded() && boosted(facts.opponent) ? 2 : 1));
  }
}

void main();
