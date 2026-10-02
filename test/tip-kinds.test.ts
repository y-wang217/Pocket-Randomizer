/**
 * Every tip a component emits opens something. **Milestone M5.6.**
 *
 * `render` in `ui/tooltips.ts` splits a `data-tip` on its first colon and
 * returns `null` when the prefix is not in `KINDS`. A trigger carrying an
 * unlisted prefix is therefore focusable, `aria-expanded`, and silent: the
 * inspect gesture R5 promises lands on nothing.
 *
 * **This has now happened twice.** The flag strip shipped in release C with a
 * `flag:` tip and no `flag` kind, caught at M1.2 and written up in the comment
 * above `KINDS`. `capabilityBandChevron` shipped in M5.2 with a
 * `capability-band:` tip and no `capability-band` kind, and nothing caught it
 * until M5.6 mounted the same chevron on a second surface. The guard that was
 * added the first time — `ALL_KINDS_LISTED` — checks the union against the
 * allowlist, which is two of the three places, and the third is the call sites.
 * This is the third.
 *
 * It reads the source rather than a rendered tree on purpose. A DOM walk can
 * only see the triggers a fixture happens to mount, which is the same blind
 * spot D35 named for the gallery: a chevron at one band and not another, a
 * chip on a screen no surface renders. Every `tip:` literal in `ui/` is every
 * tip the tree can emit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const UI = join(process.cwd(), 'src/ui');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/**
 * The prefixes `KINDS` lists, read out of the file rather than imported.
 *
 * `ui/tooltips.ts` does not export `KINDS`, and exporting it so a test could
 * read it would widen the module's surface for the test's convenience. The
 * array is one literal block and reading it is unambiguous.
 */
function listedKinds(): Set<string> {
  const source = readFileSync(join(UI, 'tooltips.ts'), 'utf8');
  const start = source.indexOf('const KINDS = [');
  const end = source.indexOf('] as const satisfies', start);
  expect(start, 'KINDS block').toBeGreaterThan(-1);
  expect(end, 'KINDS block end').toBeGreaterThan(start);
  return new Set([...source.slice(start, end).matchAll(/^\s*'([a-z-]+)',$/gm)].map((match) => match[1] as string));
}

/** Every `tip:` value a component builds, as `{ file, kind }`. */
function emitted(): { file: string; kind: string }[] {
  const out: { file: string; kind: string }[] = [];
  for (const file of sources(UI)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/tip:\s*[`'"]([a-z-]+):/g)) {
      out.push({ file: file.slice(UI.length + 1), kind: match[1] as string });
    }
  }
  return out;
}

describe('the inspect layer answers every trigger', () => {
  it('finds tips to check at all, so a broken regex cannot pass this', () => {
    const kinds = new Set(emitted().map(({ kind }) => kind));
    expect(kinds.size).toBeGreaterThan(8);
    expect(kinds).toContain('capability-band');
    expect(kinds).toContain('reward-tier');
  });

  it('lists every kind a component emits', () => {
    const listed = listedKinds();
    const orphans = emitted()
      .filter(({ kind }) => !listed.has(kind))
      .map(({ file, kind }) => `${file}: ${kind}`);
    expect(orphans).toEqual([]);
  });
});
