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
 */
import { greedyAiPolicy } from '../core/battle/ai';
import { localeOf, playRun, scriptedRunPolicy, type BattleReview, type RunState } from '../core/run';
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

async function main(): Promise<void> {
  initSettings();
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
      chooseAcquisition: async (offer, party) => {
        if (!held.capture) held.capture = { offer, party };
        return policy.chooseAcquisition(offer, party);
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

void main();
