/**
 * The bundle seam. **Stage 6.0 checkpoint 9.**
 *
 * The Gen 1 to 4 route trainers live in a chunk of their own and reach the
 * library through `installRouteTables`, which the host calls (the app by a
 * dynamic import, Node by importing `full`). What this file holds: a run can
 * never be generated against half the library, because every accessor and
 * every draw throws until the install; the install is idempotent and refuses
 * a different set; after it the library is whole and in id order; and the
 * only imports of the route half are the host's.
 *
 * The test setup installs the tables for every file, so the throw cases
 * reset the module cache and import fresh instances.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_TUNING } from '../src/data/tuning';

const ROOT = new URL('..', import.meta.url).pathname;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('before the install', () => {
  it('every accessor and every draw throws, and a run is never generated', async () => {
    vi.resetModules();
    const index = await import('../src/data/encounters/index');
    const library = await import('../src/data/encounters/library');
    const run = await import('../src/core/run');
    expect(index.routeTablesInstalled()).toBe(false);
    expect(() => index.allEncounters()).toThrow(/route tables are not installed/);
    expect(() => index.encounterTables()).toThrow(/route tables are not installed/);
    expect(() => index.encounterById('rby/brock-1')).toThrow(/route tables are not installed/);
    expect(() => library.encounterCandidates('trainer', 0)).toThrow(/route tables are not installed/);
    expect(() => library.encounterCandidates('gym', 0)).toThrow(/route tables are not installed/);
    expect(() => run.createRun('SEAM-THROW', DEFAULT_TUNING)).toThrow(/route tables are not installed/);
    // The bosses alone are there, and hold no route trainer.
    const bosses = Object.values(index.bossTables()).flatMap((table) => table.records);
    expect(bosses.length).toBeGreaterThan(1000);
    expect(bosses.some((record) => record.role === 'route')).toBe(false);
  });

  it('is whole and in id order after the install, which is idempotent and refuses a different set', async () => {
    vi.resetModules();
    const index = await import('../src/data/encounters/index');
    const { ROUTE_TABLES } = await import('../src/data/encounters/routes');
    index.installRouteTables(ROUTE_TABLES);
    expect(index.routeTablesInstalled()).toBe(true);
    const all = index.allEncounters();
    expect(all.length).toBe(5921);
    for (let i = 1; i < all.length; i += 1) expect(all[i - 1]!.id < all[i]!.id, `${all[i - 1]!.id} before ${all[i]!.id}`).toBe(true);
    expect(index.encounterById('rby/brock-1')?.trainer.name).toBe('Brock');
    expect(index.encounterById('rby/youngster-1')?.role).toBe('route');
    // Again, the same: a no-op.
    index.installRouteTables(ROUTE_TABLES);
    expect(index.allEncounters()).toBe(all);
    // A different set: a data error, loudly.
    expect(() => index.installRouteTables({ rby: ROUTE_TABLES.rby!.slice(0, 10) })).toThrow(/installed twice with different contents/);
    expect(index.allEncounters()).toBe(all);
    // And the draw works.
    const run = await import('../src/core/run');
    expect(run.createRun('SEAM-INSTALLED', DEFAULT_TUNING).segments).toHaveLength(8);
  });
});

describe('who imports the route half', () => {
  const files = walk(join(ROOT, 'src')).map((file) => [relative(ROOT, file), readFileSync(file, 'utf8')] as const);

  it('is nobody under core/ and, under ui/, only app.ts and the gallery entry by dynamic import', () => {
    const touching = files.filter(([path, source]) => /encounters\/(full|routes|[a-z0-9]+-routes)['"]/.test(source) && !path.startsWith('src/data/encounters/'));
    expect(touching.map(([path]) => path).sort()).toEqual(['src/ui/app.ts', 'src/ui/gallery.ts']);
    for (const [path, source] of touching) {
      expect(/\bfrom\s+['"][^'"]*encounters\/(full|routes)['"]/.test(source), `${path} imports the route half statically`).toBe(false);
      expect(/\bimport\s*\(\s*['"][^'"]*encounters\/full['"]\s*\)/.test(source), `${path} imports full dynamically`).toBe(true);
    }
  });

  it('keeps every other dynamic import out of src/', () => {
    const dynamic = files.filter(([path, source]) => /\bimport\s*\(/.test(source) && !['src/ui/app.ts', 'src/ui/gallery.ts'].includes(path));
    expect(dynamic.map(([path]) => path)).toEqual([]);
  });

  it('keeps the route files under src/data/ where the content hash reads them', () => {
    const routes = readdirSync(join(ROOT, 'src/data/encounters')).filter((name) => name.endsWith('-routes.ts'));
    expect(routes).toHaveLength(9);
  });
});
