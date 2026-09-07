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
      for (const line of protocol) {
        // The tracker must see the line *before* the formatter, so that
        // "lost 38%" is computed against the pre-damage HP.
        const { args, kwArgs } = Protocol.parseBattleLine(line);
        const text = formatter.formatText(args, kwArgs);
        tracker.observe(line);
        for (const chunk of text.split('\n')) {
          const trimmed = chunk.trim();
          if (!trimmed) continue;
          container.append(renderEntry(trimmed));
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

/** The formatter marks emphasis with `**`, and turn headers with `== .. ==`. */
function renderEntry(text: string): HTMLElement {
  const entry = document.createElement('p');
  entry.className = 'log-entry';

  const turn = /^==\s*(.+?)\s*==$/.exec(text);
  if (turn?.[1]) {
    entry.classList.add('log-entry--turn');
    entry.textContent = turn[1];
    return entry;
  }
  if (text.startsWith('(') || text.startsWith('It')) entry.classList.add('log-entry--detail');

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
