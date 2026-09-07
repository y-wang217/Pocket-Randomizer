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
 * That is a real claim about the engine, not a hope, so it is tested: the whole
 * suite runs with this plugin active (see vite.config.ts), and
 * test/trimmed-data.test.ts asserts both that the tables are empty and that a
 * full battle still plays out. It was also verified once with the stubs
 * replaced by throwing proxies, which confirmed nothing reads them at all
 * rather than merely tolerating an empty read.
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
        return `const t=new Proxy({},{get(_,k){throw new Error('read trimmed ${name}.'+String(k));},has(_,k){throw new Error('probed trimmed ${name}.'+String(k));},ownKeys(){throw new Error('enumerated trimmed ${name}');}});\nexport const ${EXPORTS[name]} = t;\nexport default t;\n`;
      }
      return `export const ${EXPORTS[name]} = {};\nexport default {};\n`;
    },
  };
}
