/**
 * Find a seed that actually exercises the thing under test.
 *
 * **The lesson this file exists for, stated once instead of six times.**
 *
 * A played-run test needs a run that gets somewhere: reaches a gym, takes a
 * capture, is forced to switch. How far a seed gets is a property of the draw,
 * and **every `RANDOMIZER_VERSION` bump reshuffles it** — so a seed pinned in
 * a test is a fixture with an expiry date nobody can see. `test/backpack.ts`
 * states the lesson at length and `test/lead-selection.test.ts` was the first
 * to act on it, at the `-18` bump; the region-composition patch (`-22`) broke
 * five more files at once, which is the point at which the loop stops being
 * copied and becomes a function.
 *
 * Searching does not weaken the assertion, and that is the half worth being
 * clear about. The test still asserts on a real played run; what moves is only
 * *which* run, and `firstRunWhere` throws rather than skipping when no seed in
 * the list qualifies — a vacuous pass is the failure mode the pinning was
 * already producing.
 *
 * Seeds are generated from a prefix and an index rather than listed, so a
 * widened search costs a number rather than a paragraph.
 */

/** `${prefix}0`, `${prefix}1`, … — the seed space a search walks. */
export function seedRange(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => `${prefix}${index}`);
}

/**
 * Play seeds in order until one satisfies `holds`, and return it.
 *
 * A seed whose run throws is skipped rather than failing the search: some
 * policies in these tests are deliberately destructive and a run that ends in
 * an exception has not told us anything about the property being looked for.
 * Running out of seeds throws, naming what was being looked for, because at
 * that point the test cannot assert anything and must say so.
 */
export async function firstRunWhere<T>(
  seeds: readonly string[],
  play: (seed: string) => Promise<T>,
  holds: (run: T) => boolean,
  looking: string,
): Promise<{ seed: string; run: T }> {
  for (const seed of seeds) {
    let run: T;
    try {
      run = await play(seed);
    } catch {
      continue;
    }
    if (holds(run)) return { seed, run };
  }
  throw new Error(
    `no seed of ${seeds.length} (${seeds[0]} … ${seeds[seeds.length - 1]}) ${looking}; widen the search`,
  );
}
