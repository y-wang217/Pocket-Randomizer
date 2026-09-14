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
import { AI_TIER_LABEL, aiTierFor } from '../../data/ai';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createSpeciesIndex } from '../species-index';
import { createFlagStrip, type FlagStrip } from '../flag-strip';
import { createLogSheet, type LogSheet } from '../log-sheet';
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
    /**
     * Which segment this fight belongs to, so the panel can name the opponent's
     * skill tier. **The AI tiers patch.**
     *
     * Optional, and absent means "do not say": the gallery and the fixed-board
     * tests attach a session with no run behind it, and a tier invented for
     * them would be a fact about nothing.
     */
    segment?: number,
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
   * The strip sits under the scene, where Release C put it and where V5's
   * one-line event strip goes. V5 re-homed a container rather than restyling
   * chips, exactly as that placement predicted.
   */
  const flags: FlagStrip = createFlagStrip();
  /*
   * The log is no longer on the board. **V5.2.**
   *
   * It was a persistent multi-line panel costing 320px of an 844px phone, on
   * the screen the player sees most, and the plan's budget spends all of it:
   * the turn's outcome is on the strip above, the history is in here behind a
   * tap. The renderer is unchanged — `createBattleLog` is handed the sheet's
   * container and does not know it moved.
   */
  const sheet: LogSheet = createLogSheet();
  const log: BattleLogView = createBattleLog(sheet.panel);
  board.append(scene.root, flags.root);

  /*
   * The one place a tap becomes an open, and the reason the strip exposes its
   * control rather than wiring it. The sheet never opens on its own: `open`
   * has this single caller, and it is a click handler.
   *
   * The control is in the strip, which is outside `.moves`. That is the sharp
   * case `ui/drawer.ts` names — a move button is a submission, and a trigger
   * inside the grid would be one keystroke from spending a turn.
   */
  flags.history.addEventListener('click', () => sheet.open());

  root.append(header, board, sheet.root);

  return {
    root,
    attach(session, node, reveal, onChoose, segment) {
      title.textContent = node.label;
      // Team size on the header, because a gym with three Pokemon is a
      // different fight from one with one and the player is about to budget PP
      // against it.
      const size = node.encounter?.team.length ?? 0;
      /*
       * And who is playing it. **The AI tiers patch.**
       *
       * The same word the node card showed before the click, so the card's
       * claim and the fight agree — a readout that changed between the two
       * would be worse than no readout. An attribute: it names the opponent,
       * it does not rate the fight.
       */
      const tier = segment === undefined || !node.encounter ? null : aiTierFor(node.kind, node.tier, segment);
      detail.textContent = [
        node.encounter?.opponent ?? '',
        ...(size > 1 ? [`${size} Pokemon`] : []),
        ...(tier ? [AI_TIER_LABEL[tier]] : []),
      ]
        .filter((part) => part.length > 0)
        .join(' · ');

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
      /*
       * And one species table, same lifetime, for the same reason. **4.8.0.1.**
       *
       * The protocol names a Pokemon by its battle name, which is the nickname.
       * Every label on the board is the species now, so the lines are relabelled
       * once here — before the reader, the log and the strip see them — and the
       * three agree about who acted by construction. `ui/species-index.ts` says
       * what this does and does not touch; the session's own protocol is never
       * rewritten.
       */
      const names = createSpeciesIndex();

      const show = (raw: readonly string[], animate: boolean): void => {
        const protocol = raw.map((line) => {
          names.observe(line);
          return names.relabel(line);
        });
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
      // A sheet left open across a battle would put the last fight's history
      // over the first turn of the next one. Same rule `app.ts` applies to the
      // party drawer on navigation, for the same reason.
      sheet.close();
      show(session.protocolFor('p1'), false);

      return session.subscribe((update) => {
        show(update.protocol, true);
      });
    },
  };
}
