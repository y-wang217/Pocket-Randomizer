/**
 * The token rule, as a test. Stage V0 of the visual identity pass.
 *
 * Every colour, face, size, radius and spacing value the UI uses lives in
 * `src/ui/theme/tokens.css`. This walks every other file under `src/ui/` and
 * fails on a raw one. It is a grep, deliberately: the failure it guards is a
 * `#fff` typed into a rule because it was three characters shorter than the
 * token, and a grep is exactly the instrument for that.
 *
 * The second half is the accent rule: `--accent` is read by `.primary-action`
 * and by nothing else, in the stylesheet and in the TypeScript.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const UI = join(ROOT, 'src/ui');
const TOKENS = join(UI, 'theme/tokens.css');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Comments out, so the prose can name the thing the rule forbids. */
function stripCss(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function stripTs(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const cssFiles = walk(UI).filter((file) => file.endsWith('.css') && file !== TOKENS);
const tsFiles = walk(UI).filter((file) => file.endsWith('.ts'));

/** Each declaration in a stylesheet, with the line it starts on. */
function declarations(source: string): { line: number; prop: string; value: string }[] {
  const out: { line: number; prop: string; value: string }[] = [];
  const re = /([a-z-]+)\s*:\s*([^;{}]+)(?=;|\})/g;
  for (const match of source.matchAll(re)) {
    const prop = match[1] ?? '';
    const value = (match[2] ?? '').trim();
    if (prop.startsWith('--')) continue;
    out.push({ line: source.slice(0, match.index).split('\n').length, prop, value });
  }
  return out;
}

const SPACING = /^(padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(-[a-z]+)?$/;
const LENGTH = /(^|[\s(])-?\d*\.?\d+(px|rem|em)\b/;

describe('the token rule', () => {
  it('has stylesheets to check', () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it('keeps every colour literal in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i.test(value)) offenders.push(`${relative(ROOT, file)}:${line} ${prop}: ${value}`);
        // Keywords count too: `white` is as much a literal as `#fff`.
        if (/^(color|background|background-color|border-color|outline-color|fill|stroke)$/.test(prop) && /\b(white|black|red|blue|green|gray|grey)\b/.test(value)) {
          offenders.push(`${relative(ROOT, file)}:${line} ${prop}: ${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every font-family in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (prop === 'font-family' && !/^var\(--font-[a-z-]+\)$/.test(value)) offenders.push(`${relative(ROOT, file)}:${line} ${value}`);
        if (prop === 'font' && value !== 'inherit') offenders.push(`${relative(ROOT, file)}:${line} font: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every font-size in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (prop === 'font-size' && !/^var\(--fs-[a-z0-9]+\)$/.test(value)) offenders.push(`${relative(ROOT, file)}:${line} ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every radius in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (prop.startsWith('border-radius') && LENGTH.test(value)) offenders.push(`${relative(ROOT, file)}:${line} ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every spacing value in tokens.css', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (SPACING.test(prop) && LENGTH.test(value)) offenders.push(`${relative(ROOT, file)}:${line} ${prop}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Durations. **Release C, and pinned by count rather than banned outright.**
   *
   * V0's motion note is explicit that "the transitions that predate this stage
   * keep their own lengths in styles.css", so a flat ban would fail on 18
   * values V0 deliberately left alone. What Release C's rule actually says is
   * that every *new* duration resolves through a token — and the instrument for
   * that is the same one V0 used for colours: pin the survivors, so the next
   * hardcoded value is the one that fails.
   *
   * The 18 were 16 × 120ms (the shared hover/press beat), one 380ms (the HP
   * fill's colour crossfade) and one 260ms (the swap beat). Release C's own two
   * lengths are `var(--motion-hp-shadow)` and `var(--motion-jiggle)`, both
   * derived from `--motion-duration`, which is why the count did not move then.
   *
   * If this fails because the number went **down**, that is a stage retiring a
   * hardcoded length and the pin comes down with it.
   *
   * **17 since V5.5**, and that is exactly what happened: the swap beat's 260ms
   * is gone. The beat moved off the panel and onto the sprite, where it reads
   * `var(--motion-swap)` — `--motion-duration`, the one added-time-per-turn
   * number in `data/tuning.ts`. V5 added no duration of its own, so the pin
   * moved down by one and by nothing else.
   */
  const PRE_RELEASE_C_DURATIONS = 17;

  it('adds no duration that is not a token', () => {
    const found: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const { line, prop, value } of declarations(source)) {
        if (!/^(transition|animation)(-duration|-delay)?$/.test(prop)) continue;
        for (const time of value.match(/(^|[\s(,])-?\d*\.?\d+m?s\b/g) ?? []) {
          found.push(`${relative(ROOT, file)}:${line} ${prop}: ${time.trim()}`);
        }
      }
    }
    expect(found.length, found.join('\n')).toBe(PRE_RELEASE_C_DURATIONS);
  });

  it('derives every battle-feedback length from the one tuning number', () => {
    const tokens = readFileSync(TOKENS, 'utf8');
    // The token the tuning number is written into at startup, and the two
    // lengths derived from it. One number, not three.
    expect(tokens).toMatch(/--motion-duration:\s*\d+ms;/);
    expect(tokens).toMatch(/--motion-hp-shadow:\s*var\(--motion-duration\)/);
    expect(tokens).toMatch(/--motion-jiggle:\s*calc\(var\(--motion-duration\)/);
    // V5.5's swap, the third length off the one number.
    expect(tokens).toMatch(/--motion-swap:\s*var\(--motion-duration\)/);

    const styles = cssFiles.map((file) => stripCss(readFileSync(file, 'utf8'))).join('\n');
    for (const rule of ['--motion-hp-shadow', '--motion-jiggle', '--motion-swap']) {
      expect(styles, `${rule} is used`).toContain(`var(${rule})`);
    }
  });

  it('keeps colours and faces out of the TypeScript', () => {
    const offenders: string[] = [];
    for (const file of tsFiles) {
      const source = stripTs(readFileSync(file, 'utf8'));
      if (/#[0-9a-f]{6}\b|\brgba?\(|font-family|style\.(color|background|fontSize|fontFamily|padding|margin|borderRadius)\s*=/i.test(source)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the accent rule', () => {
  /** Every rule block in the stylesheet: its selector and its body. */
  function blocks(source: string): { selector: string; body: string }[] {
    const out: { selector: string; body: string }[] = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    for (const match of source.matchAll(re)) out.push({ selector: (match[1] ?? '').trim(), body: match[2] ?? '' });
    return out;
  }

  it('is read by .primary-action and nothing else', () => {
    const offenders: string[] = [];
    for (const file of cssFiles) {
      const source = stripCss(readFileSync(file, 'utf8'));
      for (const block of blocks(source)) {
        if (!/var\(--accent(-ink)?\)/.test(block.body)) continue;
        if (!/\.primary-action/.test(block.selector)) offenders.push(`${relative(ROOT, file)}: ${block.selector}`);
      }
    }
    expect(offenders).toEqual([]);
    // And it is read at least once, or the rule is vacuous.
    const styles = stripCss(readFileSync(join(UI, 'styles.css'), 'utf8'));
    expect(styles).toMatch(/\.primary-action\s*\{[^}]*var\(--accent\)/);
  });

  it('is never named in the TypeScript', () => {
    const offenders = tsFiles.filter((file) => /--accent\b/.test(stripTs(readFileSync(file, 'utf8'))));
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });
});
