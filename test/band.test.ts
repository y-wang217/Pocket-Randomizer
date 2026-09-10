/**
 * The one overlay, and the rule that it is the only one. Stage V2.
 *
 * @vitest-environment jsdom
 *
 * Behaviour first: open, confirm, cancel, Escape, the dim, one at a time,
 * the body attribute. Then the structural half: no file under `src/ui/`
 * except `band.ts` builds a dialog, and the two-click confirm pattern the
 * band replaced does not come back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openBand, openBandOf } from '../src/ui/band';

const ROOT = process.cwd();

afterEach(() => {
  openBandOf()?.close();
  document.body.replaceChildren();
});

function open(overrides: Partial<Parameters<typeof openBand>[0]> = {}) {
  const calls = { confirm: 0, cancel: 0 };
  const band = openBand({
    title: 'Release Squirtle?',
    detail: 'For good.',
    confirm: 'Release',
    cancel: 'Keep',
    onConfirm: () => calls.confirm++,
    onCancel: () => calls.cancel++,
    ...overrides,
  });
  return { band, calls };
}

describe('the band', () => {
  it('mounts one dialog with a title, a detail, an accent primary and a hollow secondary', () => {
    const { band } = open();
    expect(document.body.querySelectorAll('.confirm-band')).toHaveLength(1);
    expect(band.root.getAttribute('role')).toBe('dialog');
    expect(band.root.querySelector('.confirm-band__title')?.textContent).toBe('Release Squirtle?');
    expect(band.root.querySelector('.confirm-band__detail')?.textContent).toBe('For good.');
    expect(band.root.querySelectorAll('.primary-action')).toHaveLength(1);
    expect(band.root.querySelector('.primary-action')?.textContent).toBe('Release');
    expect(band.root.querySelector('.button--hollow')?.textContent).toBe('Keep');
    expect(document.body.dataset['bandOpen']).toBe('true');
  });

  it('commits on the primary only, and closes', () => {
    const { band, calls } = open();
    band.root.querySelector<HTMLElement>('.primary-action')?.click();
    expect(calls).toEqual({ confirm: 1, cancel: 0 });
    expect(document.body.querySelector('.confirm-band')).toBeNull();
    expect(document.body.dataset['bandOpen']).toBeUndefined();
  });

  it('cancels on the secondary, on Escape, and on the dim, never committing', () => {
    let { band, calls } = open();
    band.root.querySelector<HTMLElement>('.button--hollow')?.click();
    expect(calls).toEqual({ confirm: 0, cancel: 1 });
    expect(document.body.querySelector('.confirm-band')).toBeNull();

    ({ band, calls } = open());
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(calls).toEqual({ confirm: 0, cancel: 1 });
    expect(document.body.querySelector('.confirm-band')).toBeNull();

    ({ band, calls } = open());
    band.root.click();
    expect(calls).toEqual({ confirm: 0, cancel: 1 });
    expect(document.body.querySelector('.confirm-band')).toBeNull();

    // A click inside the body is not the dim.
    ({ band, calls } = open());
    band.root.querySelector<HTMLElement>('.confirm-band__body')?.click();
    expect(calls).toEqual({ confirm: 0, cancel: 0 });
    expect(document.body.querySelector('.confirm-band')).not.toBeNull();
  });

  it('holds one band at a time', () => {
    const first = open();
    const second = open({ title: 'Discard Leftovers?' });
    expect(document.body.querySelectorAll('.confirm-band')).toHaveLength(1);
    expect(openBandOf()).toBe(second.band);
    expect(first.band.root.isConnected).toBe(false);
    // Closing the stale handle is a no-op, not a way to close the live one.
    first.band.close();
    expect(document.body.querySelectorAll('.confirm-band')).toHaveLength(1);
  });
});

describe('no screen builds its own overlay', () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
    });
  }
  const files = walk(join(ROOT, 'src/ui')).map((file) => [relative(ROOT, file), readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')] as const);

  it('is asserted over every file under src/ui', () => {
    const dialogs = files
      .filter(([, source]) => /role',\s*'dialog'|aria-modal|el\('div', 'band|className = ['"]band|['"]overlay/.test(source))
      .map(([name]) => name);
    /*
     * The tooltip panel is a popover and predates the band; the 4.7 party
     * drawer is a bottom sheet; V5's history sheet is the same bottom sheet
     * holding the battle log. **None of the three is a confirm.** Each asks
     * nothing, submits nothing and resolves no pending decision: they are
     * readouts the player opens, not questions the game puts, and each closes
     * without leaving anything behind it changed. The band is the one overlay
     * that carries a decision, and it stays the only one that does.
     *
     * The list is an allowlist and grows one deliberate line at a time, which
     * is the whole of its value — a fourth overlay that nobody had to justify
     * is how the rule stops being one.
     */
    expect(dialogs.sort()).toEqual([
      'src/ui/band.ts',
      'src/ui/drawer.ts',
      'src/ui/log-sheet.ts',
      'src/ui/tooltips.ts',
    ]);
  });

  it('never brings the two-click confirm back', () => {
    const offenders = files.filter(([, source]) => /dataset\[['"]confirm['"]\]/.test(source)).map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it('routes every confirm through the helper', () => {
    for (const screen of ['src/ui/screens/party.ts', 'src/ui/screens/acquisition.ts']) {
      const source = files.find(([name]) => name === screen)?.[1] ?? '';
      expect(source, `${screen} imports openBand`).toMatch(/import \{ openBand \} from '\.\.\/band'/);
    }
  });
});
