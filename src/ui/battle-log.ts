/**
 * The battle log, rendered from the sim's protocol.
 *
 * Every line here is produced by @pkmn/view's LogFormatter from a protocol
 * message the engine emitted. Nothing is hand-written. That is not a
 * stylistic preference: hand-written strings drift out of sync with what the
 * engine actually did the moment a mechanic surprises you, and "the log said
 * X but the HP said Y" is the worst possible bug to debug in a seeded game.
 */
import { Protocol } from '@pkmn/protocol';
import type { PokemonHPStatus, PokemonIdent } from '@pkmn/protocol';
import { LogFormatter } from '@pkmn/view';
import type { Tracker } from '@pkmn/view';

import { movePriority } from '../core/battle/driver';
import { readTurns, type TurnAction } from '../core/battle/turnOrder';
import { el } from './scene';

/**
 * The smallest tracker that earns its keep.
 *
 * The formatter can produce "(The opposing Blastoise lost 38% of its health!)"
 * instead of "(...was hurt!)", but only if something remembers each Pokemon's
 * HP from before the damage was applied. That is all this does. The full
 * @pkmn/client tracker would also do forme changes, Illusion and type changes,
 * at the cost of pulling a second copy of the Pokedex into the bundle that
 * @pkmn/sim already ships — not a trade worth making for Stage 0.
 */
class HpTracker implements Tracker {
  private readonly hp = new Map<string, [number, number]>();

  observe(line: string): void {
    const parts = line.split('|');
    const ident = parts[2];
    const health = parts[3];
    if (!ident || !health) return;
    const kind = parts[1];
    if (kind !== 'switch' && kind !== 'drag' && kind !== '-damage' && kind !== '-heal') return;
    const source = kind === 'switch' || kind === 'drag' ? parts[4] : health;
    const parsed = this.parse(source);
    if (parsed) this.hp.set(ident, parsed);
  }

  private parse(health: string | undefined): [number, number] | null {
    if (!health) return null;
    const match = /^(\d+)\/(\d+)/.exec(health);
    if (!match?.[1] || !match[2]) return null;
    return [Number(match[1]), Number(match[2])];
  }

  damagePercentage(ident: PokemonIdent, health: PokemonHPStatus): string | undefined {
    const before = this.hp.get(ident);
    const after = this.parse(health) ?? [0, before?.[1] ?? 1];
    if (!before || before[1] === 0) return undefined;
    const delta = Math.abs(before[0] - after[0]) / before[1];
    return `${(delta * 100).toFixed(1)}%`;
  }

  // The rest of the Tracker surface is optional; returning undefined makes the
  // formatter fall back to its less detailed phrasing for those messages.
  pokemonAt(): undefined {
    return undefined;
  }
  currentWeather(): undefined {
    return undefined;
  }
  getSwitchedOutPokemon(): undefined {
    return undefined;
  }
  getPokemonTypeList(): undefined {
    return undefined;
  }
  getPokemonSpeciesForme(): undefined {
    return undefined;
  }
}

export interface BattleLogView {
  /** Feed new protocol lines. Returns the number of entries appended. */
  append(protocol: readonly string[]): number;
  clear(): void;
}

export function createBattleLog(container: HTMLElement): BattleLogView {
  let tracker = new HpTracker();
  let formatter = new LogFormatter('p1', tracker);

  return {
    append(protocol) {
      let added = 0;

      /*
       * The turn structure is read from the *same* batch of lines that is about
       * to be formatted, and keyed by line.
       *
       * Two passes over one array rather than one pass that does both, because
       * `readTurns` needs to see a whole turn before it can say which move went
       * first — the marker on line one is a fact about line two. Keying by the
       * protocol line itself avoids a parallel index that would drift the moment
       * the formatter emitted a different number of chunks than it consumed.
       */
      const annotations = annotate(protocol);

      for (const line of protocol) {
        // The tracker must see the line *before* the formatter, so that
        // "lost 38%" is computed against the pre-damage HP.
        const { args, kwArgs } = Protocol.parseBattleLine(line);
        const text = formatter.formatText(args, kwArgs);
        tracker.observe(line);

        const action = annotations.get(line);
        let first = true;
        for (const chunk of text.split('\n')) {
          const trimmed = chunk.trim();
          if (!trimmed) continue;
          /*
           * The marker goes on the *first* chunk only.
           *
           * One protocol line can format into several sentences — "used Quick
           * Attack!" and "It's super effective!" — and numbering all of them
           * would make one action look like three.
           */
          container.append(renderEntry(trimmed, first ? action : undefined));
          first = false;
          added++;
        }
      }
      if (added > 0) container.scrollTop = container.scrollHeight;
      return added;
    },
    clear() {
      container.replaceChildren();
      tracker = new HpTracker();
      formatter = new LogFormatter('p1', tracker);
    },
  };
}

/**
 * Map each protocol line to the action it turned out to be, if any.
 *
 * `readTurns` gives back groups of actions but not the lines they came from, so
 * this walks the two in step: the nth move-or-switch line in the batch is the
 * nth move-or-switch action. That holds because both are reading the same
 * stream in the same order, and it is cheaper than threading a line index
 * through the core reader — which would make a pure protocol reader carry a
 * detail that exists only for this renderer.
 */
function annotate(protocol: readonly string[]): Map<string, TurnAction> {
  const actions = readTurns(protocol, movePriority).flatMap((group) => group.actions);
  const out = new Map<string, TurnAction>();

  let index = 0;
  for (const line of protocol) {
    if (!/^\|(?:move|switch|drag)\|/.test(line)) continue;
    const action = actions[index++];
    if (action) out.set(line, action);
  }
  return out;
}

/** The formatter marks emphasis with `**`, and turn headers with `== .. ==`. */
function renderEntry(text: string, action?: TurnAction): HTMLElement {
  const entry = document.createElement('p');
  entry.className = 'log-entry';

  const turn = /^==\s*(.+?)\s*==$/.exec(text);
  if (turn?.[1]) {
    entry.classList.add('log-entry--turn');
    entry.textContent = turn[1];
    return entry;
  }
  if (text.startsWith('(') || text.startsWith('It')) entry.classList.add('log-entry--detail');

  /*
   * The sequence marker, and the whole of item C.
   *
   * A small ordinal at the head of each action, so the turn reads as "1 then 2"
   * at a glance rather than as a wall of sentences the player has to infer an
   * order from. `data-side` colours it by whose action it was, which is the
   * other half of "who went first" — the ordinal says when, the colour says who.
   */
  if (action) {
    entry.classList.add('log-entry--action');
    entry.dataset['side'] = action.side;
    if (action.kind === 'switch') entry.classList.add('log-entry--switch');

    const order = el('span', 'log-entry__order');
    order.textContent = String(action.order);
    entry.append(order);

    /*
     * The priority tag, on the move that a bracket put first.
     *
     * One short marker rather than a sentence: this is a log a player scans
     * between turns, not a combat replay. It carries the bracket in its
     * `title`/`aria-label` so "why did that go first" has an answer one tap
     * away without spending a line on it.
     */
    if (action.kind === 'move' && action.priority) {
      const tag = el('span', 'log-entry__priority');
      tag.textContent = 'FIRST';
      const sign = action.bracket > 0 ? '+' : '';
      tag.title = `Priority ${sign}${action.bracket} — moved before a faster Pokemon`;
      tag.setAttribute('aria-label', tag.title);
      entry.append(tag);
    }
  }

  for (const [index, part] of text.split('**').entries()) {
    if (!part) continue;
    if (index % 2 === 1) {
      const strong = document.createElement('strong');
      strong.textContent = part;
      entry.append(strong);
    } else {
      entry.append(document.createTextNode(part));
    }
  }
  return entry;
}
