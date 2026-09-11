/**
 * The species behind every name the protocol prints. **Patch 4.8.0.1.**
 *
 * The sim identifies a Pokemon by its battle name, which since Stage 4.8 is
 * the nickname when the spec has one (`toPokemonSet` in `core/battle/driver.ts`).
 * That is the protocol's vocabulary and it stays: the recorded battle logs are
 * byte identical to the baseline, `core/battle/contribution.ts` binds slots by
 * that name, and the graveyard matches casualties on it. What changed in
 * 4.8.0.1 is what the *player* reads. Species is the identity on every label,
 * so the battle text that names an actor — the event strip, the history sheet,
 * the flag chips' subjects — has to say the species too, or the strip would be
 * the one place on the board using a word the panels no longer show.
 *
 * This is a display-side relabel, and it is deliberately not a change to what
 * the sim is handed. Every `|switch|` and `|drag|` line carries both the name
 * and the species (`|switch|p1a: Bramble|Weepinbell, L31, F|100/100`), so the
 * table is read off the protocol as it streams and needs no view, no party and
 * no spec: `observe` learns a name, `relabel` rewrites every identifier that
 * carries it. Applied once per batch in `screens/battle.ts`, before the turn
 * reader, the log and the strip see the lines, so the three agree by
 * construction — the same rule Release C set for the turn reading itself.
 *
 * Keyed by side as well as name. The opponent never carries a nickname (pinned
 * by `test/nicknames-graveyard.test.ts`), but a table that could confuse a
 * player's "Onix" with the foe's Onix would be wrong for a reason nobody would
 * find until it happened.
 *
 * One consequence, recorded rather than hidden: after the relabel, the log's HP
 * tracker keys two same-species party members on one string, which is exactly
 * how it keyed them before 4.8 named anything. The only thing that can read
 * wrong is the "lost N%" figure on a damage sentence in the turn a same-species
 * switch happens, and the state line beside it prints the absolute HP.
 */
export interface SpeciesIndex {
  /** Learn the species behind a name from a switch line. Other lines are ignored. */
  observe(line: string): void;
  /** The same line with every known name replaced by its species. */
  relabel(line: string): string;
}

/** `|switch|p1a: Bramble|Weepinbell, L31, F|…` → side `p1`, name, species. */
const SWITCH = /^\|(?:switch|drag|replace)\|(p[1-4])[a-c]?: ([^|]+)\|([^|,]+)/;

/**
 * Every Pokemon identifier in a line, wherever it sits: as a field of its own
 * (`|p1a: Bramble|`) or after a bracketed source (`[of] p1a: Bramble`). The
 * name runs to the end of its field.
 */
const IDENT = /(^|\|| )(p[1-4][a-c]?): ([^|]*)/g;

export function createSpeciesIndex(): SpeciesIndex {
  const species = new Map<string, string>();
  const key = (side: string, name: string): string => `${side}:${name.trim()}`;

  return {
    observe(line) {
      const switched = SWITCH.exec(line);
      if (switched?.[1] && switched[2] && switched[3]) {
        species.set(key(switched[1], switched[2]), switched[3].trim());
      }
    },
    relabel(line) {
      if (species.size === 0) return line;
      return line.replace(IDENT, (whole: string, lead: string, position: string, name: string) => {
        const found = species.get(key(position.slice(0, 2), name));
        return found === undefined ? whole : `${lead}${position}: ${found}`;
      });
    },
  };
}
