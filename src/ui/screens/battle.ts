/**
 * The battle screen: Stage 0's scene and log, with a header saying which node
 * you are in.
 *
 * Everything below the header was Stage 0 unchanged for three stages. Stage 4
 * widened it with a switch panel; Stage 4.5 changes where its numbers come
 * from. The screen now builds a `BattleUiView` and hands *that* to the scene,
 * and it is the only projection in play — no `RunState`, no `PokemonSpec`, no
 * reaching into the run for an opponent's ability.
 *
 * The reveal policy arrives as two booleans rather than as the whole `Tuning`.
 * Passing `Tuning` would have put every balance number in the game within reach
 * of a screen, and the next person to need one would take it from here rather
 * than threading it properly — which is the same seam `core/battle/view.ts`
 * exists to keep shut, one level up.
 */
import type { BattleSession } from '../../core/battle/driver';
import { buildBattleUiView, type RevealPolicy } from '../../core/battle/view';
import type { NodeSpec } from '../../core/encounters';
import type { Choice } from '../../core/types';
import { abilityEffects } from '../../data/abilityEffects';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createScene, el, type Scene } from '../scene';

export interface BattleScreen {
  root: HTMLElement;
  /** Point the screen at a new battle. Returns an unsubscribe for the session. */
  attach(
    session: BattleSession,
    node: NodeSpec,
    reveal: RevealPolicy,
    onChoose: (choice: Choice) => void,
  ): () => void;
}

export function createBattleScreen(): BattleScreen {
  const root = el('section', 'screen screen--battle');

  const header = el('div', 'battle__header');
  const title = el('h2', 'screen__title');
  const detail = el('p', 'screen__blurb');
  header.append(title, detail);

  const board = el('div', 'board');
  const scene: Scene = createScene();
  const logPanel = el('div', 'log');
  const log: BattleLogView = createBattleLog(logPanel);
  board.append(scene.root, logPanel);

  root.append(header, board);

  return {
    root,
    attach(session, node, reveal, onChoose) {
      title.textContent = node.label;
      // Team size on the header, because a gym with three Pokemon is a
      // different fight from one with one and the player is about to budget PP
      // against it.
      const size = node.encounter?.team.length ?? 0;
      detail.textContent =
        (node.encounter?.opponent ?? '') + (size > 1 ? ` · ${size} Pokemon` : '');

      // Derived on every update, never stored. `BattleUiView` is a pure
      // function of the facts, so rebuilding it is cheaper than keeping one
      // alive and wondering which turn it describes.
      const draw = (): void => {
        scene.update(buildBattleUiView(session.factsFor('p1'), reveal, abilityEffects), onChoose);
      };

      log.clear();
      log.append(session.protocolFor('p1'));
      draw();

      return session.subscribe((update) => {
        log.append(update.protocol);
        draw();
      });
    },
  };
}
