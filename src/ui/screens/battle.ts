/**
 * The battle screen: Stage 0's scene and log, with a header saying which node
 * you are in.
 *
 * Everything below the header is Stage 0 unchanged. That is deliberate — the
 * scene reads a `BattleView` and writes elements, and a run does not change
 * what a battle looks like, only how often you have one.
 */
import type { BattleSession } from '../../core/battle/driver';
import type { NodeSpec } from '../../core/encounters';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createScene, el, type Scene } from '../scene';

export interface BattleScreen {
  root: HTMLElement;
  /** Point the screen at a new battle. Returns an unsubscribe for the session. */
  attach(session: BattleSession, node: NodeSpec, onChoose: (slot: number) => void): () => void;
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
