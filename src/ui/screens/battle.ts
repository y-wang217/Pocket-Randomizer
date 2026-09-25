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
import { movePriority, type BattleSession } from '../../core/battle/driver';
import { readFlags, type FlagDeps, type FlaggedTurn } from '../../core/battle/flags';
import { buildBattleUiView, type RevealPolicy } from '../../core/battle/view';
import type { NodeSpec } from '../../core/encounters';
import type { Choice } from '../../core/types';
import { abilityEffects } from '../../data/abilityEffects';
import { AI_TIER_LABEL, aiTierFor } from '../../data/ai';
import { GLYPH_LABELS } from '../../data/glyphLabels';
import { gymForSegment } from '../../data/gyms';
import { nodeKindGlyph } from '../chip';
import { createBattleLog, type BattleLogView } from '../battle-log';
import { createSpeciesIndex } from '../species-index';
import { createFlagStrip, type FlagStrip } from '../flag-strip';
import { createLogSheet, onPullUp, type LogSheet } from '../log-sheet';
import { abnormalityMarks } from '../abnormality';
import { createScene, el, type OutroKind, type Scene } from '../scene';
import { fieldGlyph } from '../chip';
import { applyField } from '../theme/field';

/**
 * The one lookup the flag reader cannot have, supplied by the adapter.
 *
 * `core/` never imports `@pkmn/sim`, so a move's priority bracket arrives here,
 * the way the turn reader has taken it since the round 2 patch. It used to
 * carry a move-identity and a species-types lookup beside it, for the STAB and
 * contact flags R9 removed in M4.1.
 */
const FLAGS: FlagDeps = { priorityOf: movePriority };

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
  /**
   * Play the end of the fight and park until it has been seen.
   *
   * Straight through to the scene, which owns every beat on the stage. It is on
   * the screen rather than reached for on `scene` directly because `app.ts`
   * holds a `BattleScreen` and nothing else — the same reason `attach` is here.
   *
   * Safe to call when no battle is attached: the scene resolves at once if
   * there is no hold to run, so a caller never has to ask whether a fight is on
   * screen before ending one.
   */
  outro(kind: OutroKind): Promise<void>;
  /**
   * End a parked outro and settle the stage.
   *
   * Called when the run is released — a new battle starting, the run ending, or
   * the player abandoning it mid-hold. Without it an abandoned run leaves
   * `reviewBattle` awaiting a timer whose screen is gone.
   */
  cancel(): void;
}

export function createBattleScreen(): BattleScreen {
  const root = el('section', 'screen screen--battle');

  const header = el('div', 'battle__header');
  const title = el('h2', 'screen__title');
  const detail = el('p', 'screen__blurb');
  /*
   * The detail line is two things: the words (who is in the fight, how it
   * plays) and, after them, the field. **Stage 4.11 Tier 2, D47.** The field
   * has a slot of its own so that a turn can redraw it without touching the
   * words, and so the words are set once at attach and never rebuilt.
   */
  const detailText = el('span', 'battle__detail-text');
  const field = el('span', 'battle__field');
  detail.append(detailText, field);
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
  // The control is handed over as the opener, so closing the sheet puts focus
  // back on it rather than at the top of the document. `ui/overlay.ts` says why.
  flags.history.addEventListener('click', () => sheet.open(flags.history));
  /*
   * And the pull. **M4.3, row D26.**
   *
   * Wired here beside the click for the reason the strip exposes its control
   * rather than wiring it: the sheet never opens on its own, and this file is
   * the one place a gesture becomes an open. Two routes to one sheet, both
   * ending in the same call, with the same opener handed over so focus returns
   * to the handle either way.
   */
  onPullUp(flags.history, () => sheet.open(flags.history));

  root.append(header, board, sheet.root);

  return {
    root,
    outro: (kind) => scene.outro(kind),
    cancel: () => scene.cancel(),
    attach(session, node, reveal, onChoose, segment) {
      /*
       * **The kind is the node's mark, at 16. Patch 4.10.1, D46.**
       *
       * D28 budgeted this header at 4 with the kind as a word, on the reasoning
       * that no family could carry a node kind. D46 gave it one, and R1 then
       * puts the same mark here that the card wore before the click: the head
       * the player chose is the head the fight is under. A gym keeps its
       * leader's name beside the badge; the other kinds carry the mark alone,
       * because the detail line below already names who is in the fight.
       */
      title.replaceChildren(nodeKindGlyph(node.kind, GLYPH_LABELS[`node-${node.kind}`] ?? node.kind, 16));
      // The leader's name from the gym table, not the node's `"<Leader>'s Gym"`
      // label, which `core/` keeps for the log and which would double the mark.
      if (node.kind === 'gym') {
        title.append(document.createTextNode(segment === undefined ? node.label : gymForSegment(segment).leader));
      }
      /*
       * **The team size came off this header**, and it had to.
       *
       * It was a fixed count read straight off the node's generated team, which
       * was right when nothing else said it and wrong the moment the opposing
       * panel started carrying a live one: a header reading `3 Pokemon` beside
       * a panel reading `1/? left` is the same screen answering one question two
       * ways, and the header's answer is the one the wild node is not supposed
       * to give. The panel's row is live, it is on the side it describes, and it
       * honours the reveal policy. This line was none of those things.
       */
      /*
       * And who is playing it. **The AI tiers patch.**
       *
       * The same word the node card showed before the click, so the card's
       * claim and the fight agree — a readout that changed between the two
       * would be worse than no readout. An attribute: it names the opponent,
       * it does not rate the fight.
       */
      const tier = segment === undefined || !node.encounter ? null : aiTierFor(node.kind, node.tier, segment);
      detailText.textContent = [
        node.encounter?.opponent ?? '',
        ...(tier ? [AI_TIER_LABEL[tier]] : []),
      ]
        .filter((part) => part.length > 0)
        .join(' · ');
      field.replaceChildren();

      // Derived on every update, never stored. `BattleUiView` is a pure
      // function of the facts, so rebuilding it is cheaper than keeping one
      // alive and wondering which turn it describes.
      const draw = (turns?: readonly FlaggedTurn[]): void => {
        /*
         * The third consumer of the one reading. **Branch 3B.**
         *
         * `abnormalityMarks` reduces the turn's flags to at most one class and
         * slot per side, and the scene is handed that rather than the flags —
         * `test/boundaries.test.ts` forbids the scene from reading a flag,
         * because a beat that can see severity is one step from a beat that
         * shows it. The reduction happens here, off the same `turns` the log
         * and the strip already get, so the rule at the top of this file still
         * holds: one reading of the protocol, now three consumers.
         */
        const view = buildBattleUiView(session.factsFor('p1'), reveal, abilityEffects);
        scene.update(view, onChoose, turns, abnormalityMarks(turns));
        // The world behind the stage wears the same state. **Tier 3.**
        applyField(view.field);
        /*
         * The state of the board, on the header. **Stage 4.11 Tier 2, D47.**
         *
         * Redrawn from the view on every update, the same way the panels are,
         * because weather begins and ends on the engine's schedule and not on
         * the player's. Nothing renders when nothing is set (R4): the locale's
         * own sky is the default, and an empty slot is how the header says so.
         * Weather before terrain, always — one fixed order is R1's slot rule
         * for a family with two members on one surface.
         */
        field.replaceChildren(
          ...[view.field.weather, view.field.terrain].flatMap((effect, index) => {
            if (!effect?.kind) return [];
            const suppressed = index === 0 && view.field.suppressed;
            return [fieldGlyph(effect.kind, effect.id, GLYPH_LABELS[`field-${effect.kind}`] ?? effect.kind, suppressed)];
          }),
        );
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
       * The species table, one per battle, made here beside `log.clear()`.
       * **4.8.0.1.**
       *
       * A flag reader used to be made alongside it and outlive the batch for
       * the same class of reason — STAB needed a species the protocol names
       * only on a switch. M4.1 deleted that flag, and the reading is a pure
       * function of the batch again.
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
        const turns = readFlags(protocol, FLAGS);
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
      /*
       * And the board's own two panels. **The bench-carryover patch.**
       *
       * The moves column and the bench both keep their last render when a view
       * offers nothing, so that neither collapses mid-fight. Nothing bounded
       * that to one fight: this screen is built once for the life of the page,
       * so the panels a finished battle left behind were what the next one
       * opened on — and across a new seed that meant a party the run had never
       * owned, which is the defect this line closes.
       */
      scene.reset();
      // A sheet left open across a battle would put the last fight's history
      // over the first turn of the next one. Same rule `app.ts` applies to the
      // party drawer on navigation, for the same reason.
      sheet.close();
      show(session.protocolFor('p1'), false);

      const unsubscribe = session.subscribe((update) => {
        show(update.protocol, true);
      });
      return () => {
        unsubscribe();
        // The fight is over or abandoned: the world goes back to the locale's own sky.
        applyField(null);
      };
    },
  };
}
