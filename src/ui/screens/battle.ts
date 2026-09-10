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
import { moveIdentity, movePriority, speciesTypes, type BattleSession } from '../../core/battle/driver';
import { createFlagReader, type FlagDeps, type FlaggedTurn } from '../../core/battle/flags';
import { buildBattleUiView, type RevealPolicy } from '../../core/battle/view';
import type { NodeSpec } from '../../core/encounters';
import type { Choice } from '../../core/types';
import { abilityEffects } from '../../data/abilityEffects';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createFlagStrip, type FlagStrip } from '../flag-strip';
import { createScene, el, type Scene } from '../scene';

/**
 * The dex lookups the flag reader cannot have, supplied once by the adapter.
 *
 * `core/` never imports `@pkmn/sim`, so the three facts the protocol does not
 * carry — a move's type, its category and its contact flag, and a species'
 * types — arrive here. Same shape as `movePriority`, which the turn reader has
 * taken this way since the round 2 patch.
 */
const FLAGS: FlagDeps = { priorityOf: movePriority, moveIdentityOf: moveIdentity, typesOf: speciesTypes };

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
  /*
   * The strip sits between the board and the log, which is where V5's
   * one-line event strip goes. Putting it there now means V5 re-homes a
   * container rather than restyling chips.
   */
  const flags: FlagStrip = createFlagStrip();
  const logPanel = el('div', 'log');
  const log: BattleLogView = createBattleLog(logPanel);
  board.append(scene.root, flags.root, logPanel);

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
      const draw = (turns?: readonly FlaggedTurn[]): void => {
        scene.update(buildBattleUiView(session.factsFor('p1'), reveal, abilityEffects), onChoose, turns);
      };

      /*
       * **One reading of the protocol per batch, two consumers.** Release C.
       *
       * The log used to read the turn structure itself and the scene's jiggle
       * would have been a second caller. Two readings of one stream are free to
       * disagree about which move went first while sitting a few hundred pixels
       * apart on the same screen — so the screen reads once, here, and hands
       * the result to both. The log's ordinals and the panels' nudge order
       * agree by construction rather than by two implementations matching.
       */
      /*
       * One reader for the whole battle, made here beside `log.clear()`.
       *
       * It has to outlive a single batch: STAB needs the species that acted,
       * the protocol names a species only on the `|switch|` that brought it
       * in, and most turns carry no switch at all. Same lifetime and same
       * reason as the log's HP tracker.
       */
      const reader = createFlagReader(FLAGS);

      const show = (protocol: readonly string[], animate: boolean): void => {
        const turns = reader.read(protocol);
        log.append(protocol, turns);
        // The strip reports the turn that just resolved, so it is silent on
        // the opening replay for the same reason the jiggle is: nothing has
        // resolved yet.
        if (animate) flags.show(turns);
        // The opening replay is a catch-up, not a turn that just happened.
        // Animating it would nudge both panels at the start of every battle.
        draw(animate ? turns : undefined);
      };

      log.clear();
      flags.clear();
      show(session.protocolFor('p1'), false);

      return session.subscribe((update) => {
        show(update.protocol, true);
      });
    },
  };
}
