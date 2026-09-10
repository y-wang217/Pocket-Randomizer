/**
 * Drop the parts of @pkmn/sim's data tables a randomizer can never use.
 *
 * @pkmn/sim's `Dex` statically imports every generation's data into one lookup
 * object. Nothing can tree-shake that: the modules are all genuinely
 * referenced, just never *read* by us. The largest of them by a wide margin are
 * the learnset tables (~5 MB unminified for gen 9 alone) and the legality
 * tables, and both exist for exactly one consumer — `TeamValidator`.
 *
 * GYMRUN never validates a team. It runs Custom Game specifically so that
 * Stage 2's randomizer can hand the engine a Magikarp with Levitate and
 * Boomburst. Move legality is not a rule we enforce; it is a rule we exist to
 * break. So this plugin replaces those modules with empty tables.
 *
 * That is a real claim about the engine, not a hope, so it is tested — but
 * read what the test actually covers before trusting it. The plugin is
 * declared for the test run as well as the build (see vite.config.ts), and
 * `test/trimmed-data.test.ts` plays a full battle including the moves that
 * acquire another move at runtime. **In Node that runs against the untrimmed
 * dex**: vitest externalises @pkmn/sim, so this hook is never called for it and
 * `Dex.data.Learnsets` still has its 1288 entries. The trim is exercised for
 * real only where it ships — in the browser build, which the visual test files
 * launch — and `GYMRUN_TRIM_STRICT=1` is what makes those runs load-bearing.
 * docs/generation.md section 13 has the measurement and names the gate change
 * that would close the gap.
 *
 * If a later stage adds team validation, set GYMRUN_FULL_DEX=1 to turn this
 * off — that is the whole rollback.
 */
import type { Plugin } from 'vite';

const TRIMMED = /@pkmn[/\\]sim[/\\]build[/\\]esm[/\\]data[/\\](?:mods[/\\][^/\\]+[/\\])?(learnsets|legality|pokemongo)\.mjs$/;

const EXPORTS: Record<string, string> = {
  learnsets: 'Learnsets',
  legality: 'Legality',
  pokemongo: 'PokemonGoData',
};

export function trimSimData(): Plugin {
  const enabled = process.env['GYMRUN_FULL_DEX'] !== '1';

  return {
    name: 'gymrun:trim-sim-data',
    enforce: 'pre',
    load(id) {
      if (!enabled) return null;
      const match = TRIMMED.exec(id.split('?')[0] ?? '');
      const name = match?.[1];
      if (!name) return null;
      // `legality.mjs` also carries a couple of small tables alongside the big
      // one; exporting an empty object for each keeps the shape the Dex expects.
      if (process.env['GYMRUN_TRIM_STRICT'] === '1') {
        return strictStub(name, EXPORTS[name] ?? 'default');
      }
      return `export const ${EXPORTS[name]} = {};\nexport default {};\n`;
    },
  };
}

/**
 * The strict stub: an empty table that throws the moment a value is read.
 *
 * `ownKeys` returns nothing rather than throwing, and that is a correction
 * rather than a relaxation. `@pkmn/sim`'s `sim/dex.mjs` builds its `dexData`
 * literal at module evaluation, and every generation that has a legality table
 * is assembled by a `merge(learnsets, legality)` that runs `for (const id in
 * legality.Legality)` over it. That happens on import, unconditionally, six
 * generations deep, before a line of GYMRUN runs — and it is structural, not a
 * read: under the shipping trim the loop walks zero keys and contributes
 * nothing. A trap that threw on it could never go green under any trim, so it
 * was reporting the engine's own import rather than a read of the data.
 *
 * Every trap that could hand back a *value* still throws, which is the claim
 * the trim actually rests on: no species, no learnset entry and no legality
 * flag is ever read out of these tables. `has` throws too, so a `move in
 * Learnsets[species]` probe is still caught.
 */
function strictStub(name: string, exported: string): string {
  return [
    'const table = new Proxy({}, {',
    `  get(_, key) { throw new Error('read trimmed ${name}.' + String(key)); },`,
    `  has(_, key) { throw new Error('probed trimmed ${name}.' + String(key)); },`,
    '  ownKeys() { return []; },',
    '});',
    `export const ${exported} = table;`,
    'export default table;',
    '',
  ].join('\n');
}
