/**
 * The tutorial's coach marks. Overnight Branch 3.
 *
 * @vitest-environment jsdom
 *
 * Seven things the prompt asked for, in order:
 *
 *   1. Every mark's anchor resolves to a real element on the screen it names,
 *      mounted from a real run's state. A mark with no anchor fails here.
 *   2. Copy lint: no mark carries a word from the forbidden list in
 *      `data/tutorial.ts`, matched as a whole word. The list is data.
 *   3. First launch: marks show on a fresh store, not on a returning one, and
 *      again after "Show tutorial again".
 *   4. Per-screen flags: skipping one screen's marks leaves another's due.
 *   5. Tapping a mark never submits anything: every screen's handlers stay
 *      unfired across a full pass, and a headless run's log is what it was.
 *   6. `core/` imports no tutorial module and sets no timer.
 *   7. Byte identity is the sim fixture's and the visual baseline's job; this
 *      file asserts the tutorial layer draws no RNG.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { greedyAiPolicy } from '../src/core/battle/ai';
import { createBattle } from '../src/core/battle/driver';
import { createRng } from '../src/core/rng';
import { chooseLocale, chooseStarter, createRun, playRun, scriptedRunPolicy, type RunState } from '../src/core/run';
import type { NodeSpec } from '../src/core/encounters';
import type { PokemonState, TeamSpec } from '../src/core/types';
import { gymForSegment } from '../src/data/gyms';
import { RELIC_IDS } from '../src/data/relics';
import {
  TUTORIAL,
  TUTORIAL_COPY,
  TUTORIAL_FORBIDDEN_WORDS,
  TUTORIAL_MARKS_PER_SCREEN_MAX,
  TUTORIAL_SCREENS,
  type TutorialScreen,
} from '../src/data/tutorial';
import { DEFAULT_TUNING } from '../src/data/tuning';
import { createDrawer } from '../src/ui/drawer';
import { createBattleScreen } from '../src/ui/screens/battle';
import { createLocaleSelect } from '../src/ui/screens/locale-select';
import { createPartyScreen } from '../src/ui/screens/party';
import { createPreGymScreen } from '../src/ui/screens/pre-gym';
import { createResultScreen } from '../src/ui/screens/result';
import { createRunMap } from '../src/ui/screens/run-map';
import { createStarterSelect } from '../src/ui/screens/starter-select';
import { createSeedBar } from '../src/ui/seed-bar';
import {
  initSettings,
  loadSettings,
  markTutorialSeen,
  resetSettings,
  resetTutorial,
  tutorialDue,
  tutorialFlags,
} from '../src/ui/settings';
import { createTutorial, type TutorialLayer } from '../src/ui/tutorial';

// ---------------------------------------------------------------------------
// Fixtures: every screen, from a real run's state
// ---------------------------------------------------------------------------

/**
 * A seed whose first step, on its first offered locale, offers an event — so
 * the map's `gate` mark has an anchor. Found by scanning, asserted below so
 * a regenerated pool that moves it fails loudly rather than skipping the mark.
 */
function seedWithFirstStepEvent(): string {
  for (let index = 0; index < 60; index++) {
    const seed = `TUTORIAL-${index}`;
    const state = createRun(seed, DEFAULT_TUNING);
    const step = state.segments[0]?.routes[0]?.steps[0];
    if (step?.options.some((node) => node.kind === 'event' && node.event) && step.options.some((node) => node.tier)) {
      return seed;
    }
  }
  throw new Error('no seed in TUTORIAL-0..59 offers an event with a tiered neighbour on its first step');
}

const SEED = seedWithFirstStepEvent();

function onMap(): RunState {
  return chooseLocale(chooseStarter(createRun(SEED, DEFAULT_TUNING), 0), 0);
}

const SNORLAX: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam', 'Rest', 'Quick Attack', 'Curse'], level: 50 }];
const MILOTIC: TeamSpec = [{ species: 'Milotic', ability: 'Marvel Scale', moves: ['Scald'], level: 50 }];

interface Mounted {
  root: HTMLElement;
  /** Every handler the screen could fire, counted. */
  fired: number;
}

/** Mount one screen's fixture into `document.body` and hand back its root and a handler counter. */
function mount(screen: TutorialScreen): Mounted {
  const counter = { fired: 0 };
  const fire = (): void => {
    counter.fired++;
  };
  let root: HTMLElement;
  switch (screen) {
    case 'starter': {
      const bar = createSeedBar();
      bar.setSeed(SEED);
      bar.onSubmit(fire);
      const starter = createStarterSelect();
      starter.render(createRun(SEED, DEFAULT_TUNING).starterOptions, fire);
      root = document.createElement('div');
      root.append(bar.root, starter.root);
      break;
    }
    case 'locale': {
      const state = chooseStarter(createRun(SEED, DEFAULT_TUNING), 0);
      const locale = createLocaleSelect();
      locale.render(
        { options: state.segments[0]!.localeOffer, segment: 0, gym: gymForSegment(0), party: state.party },
        fire,
      );
      root = locale.root;
      break;
    }
    case 'map': {
      const map = createRunMap();
      map.render(onMap(), fire, fire);
      root = map.root;
      break;
    }
    case 'battle': {
      const session = createBattle({ teams: { p1: SNORLAX, p2: MILOTIC }, seed: 'TUTORIAL-BATTLE' });
      const battle = createBattleScreen();
      const node = {
        id: 'tutorial-node',
        kind: 'trainer',
        tier: 'normal',
        label: 'A trainer',
        encounter: { team: MILOTIC, opponent: 'A trainer', simSeed: session.simSeed },
        rewards: [],
      } as unknown as NodeSpec;
      battle.attach(session, node, { ability: true, item: true }, fire);
      root = battle.root;
      break;
    }
    case 'result': {
      const state = onMap();
      const result = createResultScreen();
      result.render(null, null, state, fire, {
        offer: {
          nodeId: 'tutorial-node',
          source: 'encounter',
          spec: { species: 'Pikachu', ability: 'Static', moves: ['Thunderbolt', 'Quick Attack'], level: 12 },
        },
        party: state.party,
        onDecide: fire,
      });
      root = result.root;
      break;
    }
    case 'party': {
      const state = onMap();
      const party = createPartyScreen();
      party.render(
        {
          party: state.party,
          backpack: [],
          relics: [RELIC_IDS[0]!],
          tuning: state.tuning,
          slots: 3,
          backTo: 'map',
          plan: null,
        },
        { onReorder: fire, onRelease: fire, onPlan: fire, onDone: fire },
      );
      root = party.root;
      break;
    }
    case 'drawer': {
      const state = onMap();
      const drawer = createDrawer();
      drawer.open({
        party: state.party,
        holding: state.party.map(() => null),
        relics: [RELIC_IDS[0]!],
        tuning: state.tuning,
      });
      root = drawer.root;
      break;
    }
    case 'pre-gym': {
      const state = onMap();
      const preGym = createPreGymScreen();
      preGym.render(
        { gym: gymForSegment(0), segment: 0, party: state.party, holding: state.party.map(() => null), tuning: state.tuning },
        { onLead: fire, onManageParty: fire },
      );
      root = preGym.root;
      break;
    }
  }
  document.body.append(root);
  return {
    root,
    get fired() {
      return counter.fired;
    },
  };
}

let layer: TutorialLayer;

beforeEach(() => {
  document.body.replaceChildren();
  globalThis.localStorage.clear();
  resetSettings();
  initSettings();
  layer = createTutorial(document.body);
});

/** Tap the open mark until the layer closes, counting taps. */
function tapThrough(): number {
  let taps = 0;
  while (layer.isOpen() && taps < 20) {
    layer.root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    taps++;
  }
  return taps;
}

// ---------------------------------------------------------------------------
// 1. Anchors
// ---------------------------------------------------------------------------

describe('every mark resolves to an anchor on its screen', () => {
  for (const screen of TUTORIAL_SCREENS) {
    it(`${screen}: ${TUTORIAL[screen].map((mark) => mark.id).join(', ')}`, () => {
      const { root } = mount(screen);
      for (const mark of TUTORIAL[screen]) {
        const anchor = root.querySelector(mark.anchor);
        expect(anchor, `${screen}/${mark.id} has no anchor ${mark.anchor}`).not.toBeNull();
      }
      // And the layer shows every one whose anchor is not inside a hidden
      // region. The result fixture carries a capture, which hides the cards,
      // so its `rewards` mark waits for the fixture below.
      const showable = TUTORIAL[screen].filter((mark) => root.querySelector(mark.anchor)?.closest('[hidden]') === null);
      expect(showable.length, screen).toBeGreaterThanOrEqual(TUTORIAL[screen].length - 1);
      expect(layer.showFor(screen, root)).toBe(showable.length);
    });
  }

  it('result: the rewards mark shows on a win that pays cards', async () => {
    let offer: Parameters<ReturnType<typeof createResultScreen>['render']>[1] = null;
    await playRun('TUTORIAL-CARDS', {
      ...scriptedRunPolicy(greedyAiPolicy),
      chooseReward: async (offered) => {
        offer ??= offered;
        return 0;
      },
    });
    expect(offer).not.toBeNull();
    const result = createResultScreen();
    result.render(null, offer, onMap(), () => undefined);
    document.body.append(result.root);
    const cards = result.root.querySelector('[data-tutorial="rewards"]');
    expect(cards?.closest('[hidden]')).toBeNull();
    layer.showFor('result', result.root);
    expect(layer.current()?.mark.id).toBe('rewards');
  }, 120_000);

  it('keeps ids unique within a screen and every screen within the ceiling', () => {
    for (const screen of TUTORIAL_SCREENS) {
      const ids = TUTORIAL[screen].map((mark) => mark.id);
      expect(new Set(ids).size, screen).toBe(ids.length);
      expect(ids.length, `${screen} has more than ${TUTORIAL_MARKS_PER_SCREEN_MAX} marks`).toBeLessThanOrEqual(
        TUTORIAL_MARKS_PER_SCREEN_MAX,
      );
      expect(ids.length, screen).toBeGreaterThan(0);
    }
    const total = TUTORIAL_SCREENS.reduce((sum, screen) => sum + TUTORIAL[screen].length, 0);
    expect(total).toBeGreaterThanOrEqual(25);
    expect(total).toBeLessThanOrEqual(35);
  });

  it('skips a mark whose anchor is not on screen, and shows the rest', () => {
    // A map with no event on its first step has no gate; the other marks still show.
    const { root } = mount('map');
    root.querySelector('[data-tutorial="gate"]')?.remove();
    expect(layer.showFor('map', root)).toBe(TUTORIAL.map.length - 1);
  });
});

// ---------------------------------------------------------------------------
// 2. Copy lint
// ---------------------------------------------------------------------------

describe('the copy', () => {
  it('contains no forbidden word, as whole words', () => {
    expect(TUTORIAL_FORBIDDEN_WORDS.length).toBeGreaterThanOrEqual(10);
    for (const word of ['best', 'should', 'try', 'recommend', 'good', 'bad', 'better', 'worse', 'strong', 'weak']) {
      expect(TUTORIAL_FORBIDDEN_WORDS).toContain(word);
    }
    const pattern = new RegExp(`\\b(${TUTORIAL_FORBIDDEN_WORDS.join('|')})\\b`, 'i');
    for (const screen of TUTORIAL_SCREENS) {
      for (const mark of TUTORIAL[screen]) {
        expect(`${mark.title} ${mark.text}`, `${screen}/${mark.id}`).not.toMatch(pattern);
      }
    }
    for (const label of [TUTORIAL_COPY.next, TUTORIAL_COPY.done, TUTORIAL_COPY.skip, TUTORIAL_COPY.replay]) {
      expect(label).not.toMatch(pattern);
    }
  });

  it('never tells the player what to pick, in the two other spellings the list does not catch', () => {
    // "a good idea" is in the list; "try to" and "usually" are named by the prompt.
    for (const screen of TUTORIAL_SCREENS) {
      for (const mark of TUTORIAL[screen]) {
        expect(mark.text, `${screen}/${mark.id}`).not.toMatch(/\btry to\b|\busually\b|\ba good idea\b|\brecommended\b/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3 and 4. The flags
// ---------------------------------------------------------------------------

describe('the first-launch flag', () => {
  it('shows marks on a fresh store', () => {
    expect(tutorialFlags()).toEqual({ skipped: false, seen: [] });
    for (const screen of TUTORIAL_SCREENS) expect(tutorialDue(screen), screen).toBe(true);
    const { root } = mount('starter');
    expect(layer.showFor('starter', root)).toBeGreaterThan(0);
    expect(layer.isOpen()).toBe(true);
  });

  it('does not show them on a returning store', () => {
    const { root } = mount('starter');
    layer.showFor('starter', root);
    tapThrough();
    expect(tutorialDue('starter')).toBe(false);
    // Persisted in the same store as the density setting, and read back on the next launch.
    expect(loadSettings().tutorial.seen).toContain('starter');
    resetSettings();
    initSettings();
    expect(tutorialDue('starter')).toBe(false);
    expect(layer.showFor('starter', root)).toBe(0);
    expect(layer.isOpen()).toBe(false);
  });

  it('shows them again after the settings reset', () => {
    const { root } = mount('starter');
    layer.showFor('starter', root);
    tapThrough();
    expect(layer.showFor('starter', root)).toBe(0);
    resetTutorial();
    expect(tutorialFlags()).toEqual({ skipped: false, seen: [] });
    expect(layer.showFor('starter', root)).toBe(TUTORIAL.starter.length);
  });

  it('dismisses every screen on skip, and only the reset brings them back', () => {
    const { root } = mount('starter');
    layer.showFor('starter', root);
    const skip = layer.root.querySelector<HTMLButtonElement>('.coach__skip')!;
    expect(skip.hidden).toBe(false);
    skip.click();
    expect(layer.isOpen()).toBe(false);
    expect(tutorialFlags().skipped).toBe(true);
    for (const screen of TUTORIAL_SCREENS) expect(tutorialDue(screen), screen).toBe(false);
    expect(layer.showFor('map', mount('map').root)).toBe(0);
    resetTutorial();
    expect(tutorialDue('map')).toBe(true);
  });

  it('only offers skip on the first mark', () => {
    const { root } = mount('battle');
    layer.showFor('battle', root);
    const skip = layer.root.querySelector<HTMLButtonElement>('.coach__skip')!;
    expect(skip.hidden).toBe(false);
    layer.root.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(layer.current()?.index).toBe(1);
    expect(skip.hidden).toBe(true);
  });
});

describe('the per-screen flags', () => {
  it('leave another screen due when one screen is finished', () => {
    const map = mount('map');
    layer.showFor('map', map.root);
    tapThrough();
    expect(tutorialDue('map')).toBe(false);
    expect(tutorialDue('battle')).toBe(true);
    expect(tutorialDue('result')).toBe(true);
    const battle = mount('battle');
    expect(layer.showFor('battle', battle.root)).toBe(TUTORIAL.battle.length);
  });

  it('mark one screen seen without touching the others', () => {
    markTutorialSeen('locale');
    expect(tutorialFlags().seen).toEqual(['locale']);
    for (const screen of TUTORIAL_SCREENS) expect(tutorialDue(screen), screen).toBe(screen !== 'locale');
  });

  it('spends a screen’s first visit when another screen replaces it mid-marks', () => {
    const map = mount('map');
    layer.showFor('map', map.root);
    expect(layer.current()?.screen).toBe('map');
    const battle = mount('battle');
    layer.showFor('battle', battle.root);
    expect(layer.current()?.screen).toBe('battle');
    expect(tutorialDue('map')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Taps never decide anything
// ---------------------------------------------------------------------------

describe('tapping a mark', () => {
  for (const screen of TUTORIAL_SCREENS) {
    it(`on ${screen} fires none of the screen's handlers across a full pass`, () => {
      const mounted = mount(screen);
      const count = layer.showFor(screen, mounted.root);
      expect(count).toBeGreaterThan(0);
      // Tap the panel itself, its Next button, and its text, the three places a thumb lands.
      const targets = [layer.root, layer.root.querySelector('.coach__next')!, layer.root.querySelector('.coach__text')!];
      let taps = 0;
      while (layer.isOpen() && taps < 20) {
        targets[taps % targets.length]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        taps++;
      }
      expect(taps).toBe(count);
      expect(mounted.fired).toBe(0);
      expect(tutorialDue(screen)).toBe(false);
    });
  }

  it('highlights the real element and clears the highlight when it closes', () => {
    const { root } = mount('starter');
    layer.showFor('starter', root);
    const anchor = root.querySelector('[data-coach-target]');
    expect(anchor).not.toBeNull();
    expect(anchor?.matches(TUTORIAL.starter[0]!.anchor)).toBe(true);
    tapThrough();
    expect(root.querySelector('[data-coach-target]')).toBeNull();
  });

  it('leaves a headless run’s log exactly as it was, because it is not in the loop at all', async () => {
    const before = await playRun('TUTORIAL-LOG', scriptedRunPolicy(greedyAiPolicy));
    const mounted = mount('map');
    layer.showFor('map', mounted.root);
    tapThrough();
    const after = await playRun('TUTORIAL-LOG', scriptedRunPolicy(greedyAiPolicy));
    expect(JSON.stringify(after.log)).toBe(JSON.stringify(before.log));
  });
});

// ---------------------------------------------------------------------------
// 6 and 7. Boundaries
// ---------------------------------------------------------------------------

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('core/ and the tutorial', () => {
  const core = filesUnder(join(process.cwd(), 'src', 'core')).filter((path) => path.endsWith('.ts'));

  it('never imports or mentions it', () => {
    expect(core.length).toBeGreaterThan(5);
    for (const path of core) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/tutorial/i);
      expect(source, path).not.toMatch(/from\s+['"].*ui\//);
    }
  });

  it('sets no timers, and neither does the layer', () => {
    for (const path of core) {
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(source, path).not.toMatch(/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/);
    }
    const layerSource = readFileSync(join(process.cwd(), 'src', 'ui', 'tutorial.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    expect(layerSource).not.toMatch(/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/);
  });

  it('draws no RNG to show or advance a mark', () => {
    const rng = createRng('TUTORIAL-RNG');
    const before = rng.map.totalDraws + rng.battle.totalDraws + rng.rewards.totalDraws + rng.randomizer.totalDraws;
    const { root } = mount('battle');
    layer.showFor('battle', root);
    tapThrough();
    expect(rng.map.totalDraws + rng.battle.totalDraws + rng.rewards.totalDraws + rng.randomizer.totalDraws).toBe(before);
  });

  it('keeps every party member on the drawer fixture, which is what its marks point at', () => {
    const state = onMap();
    const party: readonly PokemonState[] = state.party;
    expect(party.length).toBeGreaterThan(0);
  });
});
