/**
 * A reduced-motion rule must never lose the cascade to the rule it cancels.
 * **The iOS animations patch, item 5.**
 *
 * ## Why this is a test and not a convention
 *
 * A media query adds no specificity of its own. So
 * `@media (prefers-reduced-motion: reduce) { .hp__shadow { animation: none } }`
 * does **not** override `.hp__shadow[data-fading] { animation: hp-chunk … }` —
 * the attribute selector is more specific and wins wherever it sits in the
 * file. The chunk went on fading for everyone who had asked it not to, and the
 * stylesheet's comments record the repair: "Selectors matched to the rules they
 * override, not to the elements."
 *
 * That has now happened **three times** in this lineage. The chunk was first.
 * The species swap was second — a bare `.sprite` under the query lost to
 * `.stage__actor[data-swapped='true'] .sprite:not(.sprite--ghost)`, and it sat
 * latent until Stage 4.9's seed put a send-in on the measured turn. The outro's
 * `:root { --motion-outro: 0ms }` was third, and it is the one this patch
 * deleted: it did not lose, it won — but only because it came later in the
 * bundle than `tokens.css`, which is source order and not specificity, and a
 * bundler that ordered the two files the other way would have silently changed
 * behaviour.
 *
 * Three times is a pattern, and a convention that has failed three times is not
 * a convention. So the property is asserted.
 *
 * ## The property
 *
 * For every rule outside the reduced-motion blocks that starts an animation,
 * there is a rule inside them that cancels it with **at least equal
 * specificity**. Equal is sufficient and is what the file mostly does: an equal
 * selector later in the cascade wins, and can never be beaten by the rule it is
 * matched to. What is forbidden is a cancel that is *less* specific than what
 * it cancels, which is the only way any of the three failures happened.
 *
 * ## Why the stylesheet text rather than a browser
 *
 * `test/visual-motion.test.ts` asserts the same thing from the other end, in
 * two real engines, by reading `animationName` under an emulated setting. That
 * is ground truth and it is the better test — but it can only see the states it
 * knows how to reach. This one sees every rule in the file, including the ones
 * no test drives yet, and it is the half that catches a *new* animation added
 * without a matching cancel.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, { type Rule } from 'postcss';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(process.cwd(), 'src', 'ui', 'styles.css'), 'utf8');
const REDUCED = /prefers-reduced-motion:\s*reduce/;

/**
 * CSS specificity as the three-part tuple, compared lexicographically.
 *
 * `:not()`, `:is()` and `:has()` take the specificity of their most specific
 * argument rather than counting as a pseudo-class, which matters here: the
 * swap's `.sprite:not(.sprite--ghost)` is two classes, not one, and reading it
 * as one is precisely the mistake that let a bare `.sprite` look sufficient.
 */
export function specificity(selector: string): [number, number, number] {
  let rest = selector;
  let score: [number, number, number] = [0, 0, 0];

  // Functional pseudo-classes first, scored by their most specific argument.
  rest = rest.replace(/:(?:not|is|has)\(([^()]*)\)/g, (_all, inner: string) => {
    const best = inner
      .split(',')
      .map((part) => specificity(part.trim()))
      .sort(compare)
      .pop();
    if (best) score = [score[0] + best[0], score[1] + best[1], score[2] + best[2]];
    return ' ';
  });
  // `:where()` contributes nothing, by definition.
  rest = rest.replace(/:where\([^()]*\)/g, ' ');

  const ids = rest.match(/#[\w-]+/g) ?? [];
  const classes = rest.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+(?:\([^()]*\))?/g) ?? [];
  const elements = rest.replace(/\.[\w-]+|\[[^\]]*\]|#[\w-]+|::?[\w-]+(?:\([^()]*\))?/g, ' ').match(/[a-zA-Z][\w-]*/g) ?? [];
  const pseudoElements = rest.match(/::[\w-]+/g) ?? [];

  return [
    score[0] + ids.length,
    // A pseudo-element is counted in the element column, so remove it from the
    // class column it was also matched into.
    score[1] + classes.length - pseudoElements.length,
    score[2] + elements.length + pseudoElements.length,
  ];
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

const norm = (selector: string): string => selector.replace(/\s+/g, ' ').replace(/"/g, "'").trim();

interface Found {
  selector: string;
  animation: string;
}

/**
 * Whether a `display: none` under the query already answers this selector.
 *
 * The ambient world drift is cancelled by removal rather than by
 * `animation: none` — `@media (prefers-reduced-motion: reduce)` sets
 * `.world__drift { display: none }`, and an element that is not generated
 * cannot animate, nor can any of its 16 descendant mote rules. That is a
 * *stronger* cancel than the one this file is otherwise looking for, and a
 * check that could not see it would report the safest rule in the stylesheet as
 * the largest hole in it.
 *
 * Prefix at a selector boundary, because both shapes qualify: `.world__drift`
 * narrowed by an attribute still matches a subset of removed elements, and
 * anything to the right of a combinator is inside one.
 */
function removedBy(selector: string, removal: string): boolean {
  if (selector === removal) return true;
  if (!selector.startsWith(removal)) return false;
  return /[[.:#>+~ ]/.test(selector.charAt(removal.length));
}

function collect(): { animated: Found[]; cancels: string[]; removals: string[] } {
  const root = postcss.parse(CSS);
  const animated: Found[] = [];
  const cancels: string[] = [];
  const removals: string[] = [];

  root.walkRules((rule: Rule) => {
    let inReduced = false;
    for (let node = rule.parent; node; node = (node as { parent?: unknown }).parent as never) {
      const params = (node as { params?: string }).params;
      if (typeof params === 'string' && REDUCED.test(params)) inReduced = true;
    }

    for (const decl of rule.nodes ?? []) {
      if (decl.type !== 'decl') continue;
      if (inReduced && decl.prop === 'display' && decl.value.trim() === 'none') {
        for (const selector of rule.selectors) removals.push(norm(selector));
        continue;
      }
      const prop = decl.prop.replace(/^-webkit-/, '');
      /*
       * Every `animation-*` longhand, not only the shorthand. A rule that sets
       * `animation-delay` alone still has to be cancelled — `animation: none`
       * is the shorthand precisely so it resets the delays with it — and the
       * stylesheet's own comments say so: "Selectors matched to every rule they
       * override, the slot delays and the KO-turn duration included."
       */
      if (!prop.startsWith('animation')) continue;
      const off = /(^|\s)none(\s|$)/.test(decl.value);

      for (const selector of rule.selectors) {
        if (inReduced && off) cancels.push(norm(selector));
        else if (!inReduced && !off) animated.push({ selector: norm(selector), animation: decl.value });
      }
    }
  });

  return { animated, cancels, removals };
}

describe('every animation is cancelled by a rule that can actually beat it', () => {
  const { animated, cancels, removals } = collect();

  it('found both halves, so an empty walk cannot pass', () => {
    expect(animated.length, 'no animation rules parsed out of styles.css').toBeGreaterThan(10);
    expect(cancels.length, 'no reduced-motion cancels parsed out of styles.css').toBeGreaterThan(10);
  });

  it('scores :not() by its argument, which is the mistake that shipped twice', () => {
    // `.sprite` alone cannot override `.sprite:not(.sprite--ghost)`, and a
    // scorer that read `:not()` as one pseudo-class would say it could.
    expect(compare(specificity('.sprite'), specificity('.sprite:not(.sprite--ghost)'))).toBeLessThan(0);
    expect(compare(specificity('.hp__shadow'), specificity('.hp__shadow[data-fading]'))).toBeLessThan(0);
    expect(compare(specificity('.a.b'), specificity('.a.b'))).toBe(0);
  });

  /*
   * **The cancel must name the same selector, not merely a specific-enough
   * one.** The first draft of this test asked whether *any* cancel in the block
   * outranked each animated rule, and that is not the question: the block is
   * full of highly specific cancels, so replacing the swap's three selectors
   * with a bare `.sprite` still passed. Specificity only decides a contest
   * between two rules matching the same element, and a check that forgets the
   * second half measures nothing.
   *
   * Verbatim equality is what the stylesheet already does and what its comments
   * say it does. It also settles the specificity question by construction:
   * equal selectors cannot lose to each other, so the later one — the
   * reduced-motion block, which the bundle puts last — always wins. The scorer
   * above stays because it is what says *why* the rule is verbatim equality,
   * and the case below proves it can tell the two apart.
   */
  it('cancels every animated selector with a cancel naming that same selector', () => {
    const cancelled = new Set(cancels);
    const uncancelled = animated.filter(
      ({ selector }) => !cancelled.has(selector) && !removals.some((removal) => removedBy(selector, removal)),
    );

    expect(
      uncancelled.map(({ selector, animation }) => `${selector}  ->  ${animation}`),
      'an animation with no reduced-motion cancel of its own selector keeps running for a player who asked it not to',
    ).toEqual([]);
  });

  it('would reject a cancel that is less specific than what it cancels', () => {
    // The check above enforces equality, which is stricter. This states the
    // reason in the terms the three failures actually took: a weaker selector
    // does not override a stronger one, wherever it sits in the file.
    for (const [weak, strong] of [
      ['.hp__shadow', ".hp__shadow[data-fading]"],
      ['.sprite', ".stage__actor[data-swapped='true'] .sprite:not(.sprite--ghost)"],
    ] as const) {
      expect(compare(specificity(weak), specificity(strong)), `${weak} vs ${strong}`).toBeLessThan(0);
    }
  });

  /*
   * The three failures by name. The check above is the general property and
   * would catch each of them; these say which three, so a regression reports
   * itself as "the chunk again" rather than as a selector nobody recognises.
   */
  it.each([
    ['the HP chunk', ".hp__shadow[data-fading]"],
    ['the species swap', ".stage__actor[data-swapped='true'] .sprite:not(.sprite--ghost)"],
    ['the arriving sprite', ".stage__actor[data-swapped='true'] .sprite--ghost"],
  ])('cancels %s with a selector that matches its own', (_label, selector) => {
    expect(cancels, `${selector} is not cancelled by a rule naming it`).toContain(selector);
  });

  it('counts the ambient drift as cancelled by removal, not as uncovered', () => {
    // The stronger cancel, asserted so that deleting it is a failure rather
    // than a quiet reclassification of 17 rules as "fine".
    expect(removals).toContain('.world__drift');
    expect(removedBy(".world__drift[data-motion='soar'] > svg", '.world__drift')).toBe(true);
    // And it does not swallow a neighbour that merely starts the same way.
    expect(removedBy('.world__drifter', '.world__drift')).toBe(false);
  });

  it('no longer zeroes the outro token, which won on source order alone', () => {
    /*
     * The rule this patch deleted. `:root` inside the media query tied with the
     * `:root` in `tokens.css` and won only by coming later in the bundle — and
     * what it won was a hold of zero, which is the swallowed-last-turn defect
     * handed to every player with Reduce Motion on.
     *
     * Read through postcss rather than by slicing the text, so "inside the
     * query" means inside it rather than after it.
     */
    const offenders: string[] = [];
    postcss.parse(CSS).walkAtRules('media', (atRule) => {
      if (!REDUCED.test(atRule.params)) return;
      atRule.walkDecls(/^--motion-outro$/, (decl) => offenders.push(`${(decl.parent as Rule).selector}: ${decl.value}`));
    });
    expect(offenders, 'the reduced-motion block sets the outro length again').toEqual([]);
  });
});
