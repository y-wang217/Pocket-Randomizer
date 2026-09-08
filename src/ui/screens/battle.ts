/**
 * The battle screen: Stage 0's scene and log, with a header saying which node
 * you are in.
 *
 * Everything below the header was Stage 0 unchanged for three stages, and
 * Stage 4 is the first thing to widen it: the scene now renders a switch panel
 * beside the moves. The seam held — the screen still reads a `BattleView` and
 * writes elements, and the only change here is that a click carries a `Choice`
 * rather than a move slot, because a switch and a move are both "a slot" and
 * nothing above this file should have to guess which panel a number came from.
 */
import type { BattleSession } from '../../core/battle/driver';
import type { NodeSpec } from '../../core/encounters';
import type { Choice } from '../../core/types';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createScene, el, type Scene } from '../scene';

export interface BattleScreen {
  root: HTMLElement;
  /** Point the screen at a new battle. Returns an unsubscribe for the session. */
  attach(session: BattleSession, node: NodeSpec, onChoose: (choice: Choice) => void): () => void;
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
    attach(session, node, onChoose) {
      title.textContent = node.label;
      // Team size on the header, because a gym with three Pokemon is a
      // different fight from one with one and the player is about to budget PP
      // against it.
      const size = node.encounter?.team.length ?? 0;
      detail.textContent =
        (node.encounter?.opponent ?? '') + (size > 1 ? ` · ${size} Pokemon` : '');

      log.clear();
      log.append(session.protocolFor('p1'));
      scene.update(session.viewFor('p1'), onChoose);

      return session.subscribe((update) => {
        log.append(update.protocol);
        scene.update(session.viewFor('p1'), onChoose);
      });
    },
  };
}
