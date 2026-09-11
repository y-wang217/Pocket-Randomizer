/**
 * The gallery: one screen, one seed, rendered from a scripted run. Stage V4.
 *
 * Not part of the shipped build (`vite.gallery.config.ts` builds it to
 * `dist-gallery/`). It exists so a screenshot or a test can put a screen on
 * a phone viewport in a state the smoke bot cannot reach on demand: the
 * summary of a seed the scripted policy wins on, the summary of one it loses
 * at gym 5 on, a result screen with three cards and a capture offer on it at
 * once. The run is played in the browser by `playRun` under
 * `scriptedRunPolicy`, the same call the headless suite makes, so a seed
 * found by `scripts/visual/scan-summary-seeds.ts` renders the same run here.
 *
 *   gallery.html#seed=V4-42&screen=summary
 *   gallery.html#seed=SMOKE24&screen=result            three cards, no capture
 *   gallery.html#seed=SMOKE24&screen=result-capture    the capture offer, no cards
 *   gallery.html#seed=SMOKE24&screen=result-both       both at once, which the app never shows
 *   gallery.html#seed=V5-LOADED&screen=battle          both panels fully loaded
 *
 * **V5.6 added the battle screen**, and for the reason this file exists. The
 * plan's closing assertion is a layout height "with a full status and stage
 * chip row on both sides", and the smoke bot cannot ask for that: it plays a
 * seed, and whether both Pokemon happen to be statused and boosted on the turn
 * it stops is the seed's business. Here the battle is driven deliberately —
 * Swords Dance and Toxic against Rock Polish and Thunder Wave — until both
 * sides carry a status and a stage, and *then* it is measured. That is the
 * worst case for panel height, played rather than fabricated.
 */
import { greedyAiPolicy } from '../core/battle/ai';
import { createBattle } from '../core/battle/driver';
import type { NodeSpec } from '../core/encounters';
import { localeOf, playRun, scriptedRunPolicy, type BattleReview, type RunState } from '../core/run';
import { moveChoice, type TeamSpec } from '../core/types';
import { createBattleScreen } from './screens/battle';
import type { AcquisitionOffer } from '../core/acquisition';
import type { RewardOffer } from '../core/rewards';
import type { PokemonState } from '../core/types';
import { DEFAULT_TUNING } from '../data/tuning';
import { createWorldScene, el } from './scene';
import { createResultScreen } from './screens/result';
import { createSummary } from './screens/summary';
import { createStamps } from './stamps';
import { applyLocale } from './theme/locale';
import { createTooltips } from './tooltips';
import { initSettings } from './settings';
import { applyVerbosity } from './theme/verbosity';

async function main(): Promise<void> {
  // The gallery renders one screen from a scripted run, so it never toggles —
  // but it must still write the mode, or every card it captures would be
  // Detailed-by-CSS-default regardless of the stored preference. Patch 4.7.2.
  applyVerbosity(initSettings().verbosity);
  const params = new URLSearchParams(globalThis.location.hash.replace(/^#/, ''));
  const seed = params.get('seed') ?? 'SMOKE24';
  const screen = params.get('screen') ?? 'summary';

  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root element');
  const shell = el('main', 'shell');
  shell.dataset['phase'] = screen === 'summary' ? 'setup' : 'running';
  shell.dataset['screen'] = screen;
  const screens = el('div', 'screens');
  const stamps = createStamps();
  shell.append(screens, stamps.root);
  const world = createWorldScene();
  root.replaceChildren(world.root, shell);
  createTooltips(shell);

  if (screen === 'battle') {
    mountLoadedBattle(screens, seed);
    applyLocale(null);
    stamps.update({ locale: null, segment: 1, segments: 8, seed });
    document.documentElement.dataset['galleryReady'] = 'true';
    return;
  }

  // The first review that carries three cards, and the first capture offer:
  // the result screen's two decision points, held so they render together.
  const held: {
    offer?: { review: BattleReview; offer: RewardOffer; state: RunState };
    capture?: { offer: AcquisitionOffer; party: readonly PokemonState[] };
  } = {};
  const policy = scriptedRunPolicy(greedyAiPolicy);
  const result = await playRun(
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
  const firstOffer = held.offer;
  const firstCapture = held.capture;

  if (screen === 'summary') {
    const summary = createSummary();
    summary.root.dataset['screen'] = 'summary';
    screens.append(summary.root);
    summary.render(result);
    applyLocale(null);
    stamps.update({ locale: null, segment: result.state.currentSegment + 1, segments: result.state.segments.length, seed });
  } else {
    const resultScreen = createResultScreen();
    resultScreen.root.dataset['screen'] = 'result';
    screens.append(resultScreen.root);
    const state = firstOffer?.state ?? result.state;
    applyLocale(localeOf(state));
    stamps.update({ locale: localeOf(state), segment: state.currentSegment + 1, segments: state.segments.length, seed });
    // The app renders the cards, then the capture on a second render with
    // the cards gone; `result` and `result-capture` are those two shapes and
    // `result-both` is the two together for a worst-case measurement.
    const withCards = screen !== 'result-capture';
    const withCapture = screen !== 'result';
    resultScreen.render(
      firstOffer?.review ?? null,
      withCards ? (firstOffer?.offer ?? null) : null,
      state,
      () => undefined,
      withCapture && firstCapture ? { offer: firstCapture.offer, party: firstCapture.party, onDecide: () => undefined } : null,
    );
  }
  document.documentElement.dataset['galleryReady'] = 'true';
}

/**
 * A battle with both panels carrying everything they can carry.
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
 * and three digits either side of the slash is the longest it gets.
 */
const LOADED_P1: TeamSpec = [
  { species: 'Snorlax', ability: 'Thick Fat', moves: ['Swords Dance', 'Toxic', 'Body Slam', 'Rest'], level: 100 },
];
const LOADED_P2: TeamSpec = [
  { species: 'Golem', ability: 'Sturdy', moves: ['Rock Polish', 'Thunder Wave', 'Earthquake', 'Rollout'], level: 100 },
];

function mountLoadedBattle(screens: HTMLElement, seed: string): void {
  const session = createBattle({ teams: { p1: LOADED_P1, p2: LOADED_P2 }, seed });
  const battle = createBattleScreen();
  battle.root.dataset['screen'] = 'battle';
  battle.root.hidden = false;
  screens.append(battle.root);

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

  for (let turn = 0; turn < 24 && !session.ended && !loaded(); turn++) {
    const facts = session.factsFor('p1');
    if (session.viewFor('p1').awaitingChoice) session.submit('p1', moveChoice(boosted(facts.player) ? 2 : 1));
    if (session.viewFor('p2').awaitingChoice) session.submit('p2', moveChoice(boosted(facts.opponent) ? 2 : 1));
  }
}

void main();
