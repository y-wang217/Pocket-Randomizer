/**
 * Wiring: turn clicks into policy decisions and battle updates into DOM.
 *
 * The whole app is one call to `runBattle` with a human policy on p1 and the
 * greedy AI on p2 — the same call test/headless.test.ts makes with two AIs.
 * That is the payoff of the policy seam: there is no separate "interactive
 * battle loop" to keep in sync with the headless one, because there is only
 * one loop.
 */
import { greedyAiPolicy } from '../core/battle/ai';
import { runBattle, type BattleSession } from '../core/battle/driver';
import { GYMRUN_FORMAT, STRIPPED_CLAUSES } from '../core/battle/format';
import { createHumanPolicy } from '../core/battle/policy';
import { normalizeSeed } from '../core/rng';
import { moveChoice, type BattleResult, type RunLog } from '../core/types';
import { OPPONENT_TEAM, PLAYER_TEAM } from '../data/mons';
import { createBattleLog } from './battle-log';
import { createScene, el } from './scene';
import { newSeed, seedFromLocation, writeSeedToLocation } from './seed';
import { saveRunLog } from './storage';

/**
 * A one-battle run log.
 *
 * Stage 1 replaces this screen entirely; until then the Stage 0 app records its
 * battle in the run-log format so persistence has one shape rather than two.
 */
function asRunLog(log: { seed: string; version: string; decisions: { choice: { kind: 'move'; slot: number } }[] }): RunLog {
  return {
    seed: log.seed,
    version: log.version,
    decisions: log.decisions.map((decision) => ({ kind: 'battle' as const, choice: decision.choice })),
  };
}

export function mountApp(root: HTMLElement): void {
  const scene = createScene();
  const logPanel = el('div', 'log');
  const battleLog = createBattleLog(logPanel);
  const seedBar = createSeedBar();
  const overlay = createOverlay();

  const shell = el('main', 'shell');
  const board = el('div', 'board');
  board.append(scene.root, logPanel);
  shell.append(createHeader(), seedBar.root, board, overlay.root);
  root.replaceChildren(shell);

  /** Cancels the in-flight battle's pending human decision, if any. */
  let abandon: (() => void) | null = null;

  async function start(seed: string): Promise<void> {
    abandon?.();

    seedBar.setSeed(seed);
    writeSeedToLocation(seed);
    battleLog.clear();
    overlay.hide();

    const human = createHumanPolicy();
    abandon = () => human.cancel();

    let session: BattleSession | null = null;
    const attach = (started: BattleSession): void => {
      session = started;
      battleLog.append(started.protocolFor('p1'));
      render(started);
      started.subscribe((update) => {
        battleLog.append(update.protocol);
        render(started);
      });
    };

    const render = (active: BattleSession): void => {
      scene.update(active.viewFor('p1'), (slot) => {
        // A click that arrives when nothing is pending is a no-op, not a
        // decision queued against the following turn.
        human.submit(moveChoice(slot));
      });
    };

    try {
      const run = await runBattle(PLAYER_TEAM, OPPONENT_TEAM, seed, human.policy, greedyAiPolicy, {
        onStart: attach,
      });
      saveRunLog(asRunLog(run.battleLog));
      if (session) render(session);
      overlay.show(run.result, seed);
    } catch {
      // The only way out of runBattle other than a finished battle is an
      // abandoned human policy, which happens when the player restarts.
    }
  }

  seedBar.onSubmit((value) => {
    void start(normalizeSeed(value) || newSeed());
  });
  seedBar.onReroll(() => {
    void start(newSeed());
  });
  overlay.onRematch((seed) => {
    void start(seed);
  });
  overlay.onNextSeed(() => {
    void start(newSeed());
  });

  void start(seedFromLocation(globalThis.location.href) ?? newSeed());
}

function createHeader(): HTMLElement {
  const header = el('header', 'header');
  const title = el('h1', 'header__title');
  title.textContent = 'GYMRUN';
  const subtitle = el('p', 'header__subtitle');
  const clauses = STRIPPED_CLAUSES.length > 0 ? ` · no ${STRIPPED_CLAUSES.join(', ').toLowerCase()}` : '';
  subtitle.textContent = `Stage 0 · ${GYMRUN_FORMAT}${clauses}`;
  header.append(title, subtitle);
  return header;
}

interface SeedBar {
  root: HTMLElement;
  setSeed(seed: string): void;
  onSubmit(handler: (seed: string) => void): void;
  onReroll(handler: () => void): void;
}

/**
 * The seed, displayed and editable.
 *
 * A tester who can type a seed and get the identical battle back is the
 * cheapest bug-reporting tool this project will ever have, which is why it is
 * in the UI at Stage 0 rather than behind a debug flag.
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
  apply.textContent = 'Run seed';

  const reroll = document.createElement('button');
  reroll.type = 'button';
  reroll.className = 'button';
  reroll.textContent = 'New seed';

  root.append(label, input, apply, reroll);

  return {
    root,
    setSeed: (seed) => {
      input.value = seed;
    },
    onSubmit: (handler) =>
      root.addEventListener('submit', (event) => {
        event.preventDefault();
        handler(input.value);
      }),
    onReroll: (handler) => reroll.addEventListener('click', () => handler()),
  };
}

interface Overlay {
  root: HTMLElement;
  show(result: BattleResult, seed: string): void;
  hide(): void;
  onRematch(handler: (seed: string) => void): void;
  onNextSeed(handler: () => void): void;
}

function createOverlay(): Overlay {
  const root = el('div', 'overlay');
  root.hidden = true;

  const card = el('div', 'overlay__card');
  const title = el('h2', 'overlay__title');
  const detail = el('p', 'overlay__detail');

  const rematch = document.createElement('button');
  rematch.type = 'button';
  rematch.className = 'button button--primary';
  rematch.textContent = 'Rematch (same seed)';

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'button';
  next.textContent = 'New seed';

  const actions = el('div', 'overlay__actions');
  actions.append(rematch, next);
  card.append(title, detail, actions);
  root.append(card);

  let currentSeed = '';

  return {
    root,
    show(result, seed) {
      currentSeed = seed;
      const won = result.winner === 'p1';
      root.dataset['outcome'] = result.winner === null ? 'draw' : won ? 'win' : 'loss';
      title.textContent = result.winner === null ? 'Draw' : won ? 'Victory' : 'Defeat';
      detail.textContent =
        `${result.turns} turn${result.turns === 1 ? '' : 's'} · ${result.cause} · seed ${seed}`;
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    // Rematch replays the same seed. With the same choices it is the same
    // battle, turn for turn — that is the property the whole game rests on.
    onRematch: (handler) => rematch.addEventListener('click', () => handler(currentSeed)),
    onNextSeed: (handler) => next.addEventListener('click', () => handler()),
  };
}
