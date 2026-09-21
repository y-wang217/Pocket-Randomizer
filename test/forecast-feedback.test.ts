/**
 * One vocabulary across the two halves of R8. **Milestone M4.2.**
 *
 * @vitest-environment jsdom
 *
 * R8: *"Forecast on the button, feedback on the target, same vocabulary, never
 * the same place. … They share a colour family and a glyph family and nothing
 * else."* Section 2 states it as one row — the edge colour on the button *and*
 * the same colour on the feedback flag — and section 5 puts the priority
 * chevron on the panel and on the move card, which is the same claim about a
 * different family.
 *
 * ## Why the colour half is read off the stylesheet
 *
 * The done-when asks for *"the same colour tokens on button edge and flag"*,
 * and a token is what the source says, not what a browser resolves. jsdom does
 * not evaluate `var()` at all, and a Chromium test would compare two resolved
 * hex strings and pass just as well if somebody had typed the hex in — which is
 * the failure `test/visual-tokens.test.ts` exists to catch, one file over. So
 * the assertion is that the two rules name the same custom property, which is
 * the thing that must stay true.
 *
 * ## And why the chevron half is read off the DOM
 *
 * That one is a shared *drawing*, not a shared name, so it is asserted where it
 * is drawn: the glyph the panel mounts and the glyph the move card mounts carry
 * the same `data-glyph` id out of `ui/theme/glyphs.ts`, which is M1.1's single
 * renderer. Two marks that merely looked alike would pass a screenshot and fail
 * the first time one sheet was edited.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createBattle, movePriority } from '../src/core/battle/driver';
import { readFlags, type FlagDeps } from '../src/core/battle/flags';
import { buildBattleUiView } from '../src/core/battle/view';
import { moveChoice, type TeamSpec } from '../src/core/types';
import { abilityEffects } from '../src/data/abilityEffects';
import { flagChip } from '../src/ui/chip';
import { createFlagStrip } from '../src/ui/flag-strip';
import { createScene } from '../src/ui/scene';
import { glyphNode } from '../src/ui/theme/glyph';

/**
 * Sources are read off `process.cwd()`, not off `import.meta.url`.
 *
 * This file runs under jsdom, where `import.meta.url` is an `http:` URL and
 * `readFileSync` refuses it. `test/inspect.test.ts` takes the same route for
 * the same reason.
 */
const source = (path: string): string => readFileSync(join(process.cwd(), path), 'utf8');

const CSS = source('src/ui/styles.css');

/**
 * Every innermost rule in the stylesheet, as a selector list and a body.
 *
 * Written as a brace walk rather than one regex because this file has
 * `@media` and `@keyframes` blocks in it, and a regex that treats `{` as an
 * opener cannot tell a nested rule from a top-level one — it pairs the wrong
 * braces and then answers confidently about a rule that does not exist. A
 * block with no `{` inside it is a rule; whatever precedes it since the last
 * brace is its selector list.
 */
function rules(css: string): { selectors: string[]; body: string }[] {
  const found: { selectors: string[]; body: string }[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  let preamble = '';
  let depth = 0;
  let body = '';

  for (const char of stripped) {
    if (char === '{') {
      depth += 1;
      if (depth === 1) body = '';
      else preamble = '';
      continue;
    }
    if (char === '}') {
      if (depth === 1 && !body.includes('{')) {
        found.push({
          selectors: preamble.split(',').map((each) => each.trim().replace(/\s+/g, ' ')).filter(Boolean),
          body,
        });
      }
      depth = Math.max(0, depth - 1);
      preamble = '';
      continue;
    }
    if (depth === 0) preamble += char;
    else if (depth === 1) body += char;
  }
  return found;
}

const RULES = rules(CSS);

/**
 * The value a declaration carries, for the first rule whose selector list
 * contains this selector.
 *
 * Selector lists are split rather than matched whole, because three of the
 * rules asserted on here are grouped — the shared edge width is written once
 * for the three effectiveness kinds, which is the point of it.
 */
function declaration(selector: string, property: string): string | null {
  for (const rule of RULES) {
    if (!rule.selectors.includes(selector)) continue;
    const found = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`).exec(rule.body);
    if (found?.[1]) return found[1].trim();
  }
  return null;
}

describe('the effectiveness colour, on the button and on the flag', () => {
  it('draws the flag edge from the same token as the button edge', () => {
    for (const [effect, flag] of [
      ['super', 'super'],
      ['resisted', 'resisted'],
      ['none', 'immune'],
    ] as const) {
      const button = declaration(`.moves .move[data-effect='${effect}']`, 'border-left-color');
      const chip = declaration(`.chip--flag[data-flag="${flag}"]`, 'border-left-color');

      expect(button, `button edge for ${effect}`).toMatch(/^var\(--stage-(up|down)\)$/);
      expect(chip, `flag edge for ${flag}`).toBe(button);
    }
  });

  it('draws them at the same width, so neither is the louder one', () => {
    expect(declaration('.moves .move[data-effect]', 'border-left-width')).toBe('3px');
    expect(declaration('.chip--flag[data-flag="super"]', 'border-left-width')).toBe('3px');
  });

  it('leaves every other kind neutral, which is the rule that did not change', () => {
    /*
     * The weight axis, as an assertion on the source. Three kinds carry an edge
     * and nothing else in the strip carries a colour, a size or a weight — a
     * fourth `.chip--flag[data-flag=…]` rule setting anything else would be the
     * hue-per-kind D27 rejected.
     */
    const rules = [...CSS.matchAll(/\.chip--flag\[data-flag="([a-z]+)"\]/g)].map((match) => match[1]);
    expect([...new Set(rules)].sort()).toEqual(['immune', 'resisted', 'super']);
  });

  it('puts no colour on the chip element itself, so the word is never the carrier', () => {
    const strip = createFlagStrip();
    const protocol = [
      '|switch|p1a: Snorlax|Snorlax, L50, M|235/235',
      '|switch|p2a: Golem|Golem, L50, F|155/155',
      '|turn|1',
      '|move|p1a: Snorlax|Body Slam|p2a: Golem',
      '|-supereffective|p2a: Golem',
      '|-damage|p2a: Golem|40/155',
      '|upkeep',
    ];
    strip.show(readFlags(protocol, { priorityOf: () => 0 } satisfies FlagDeps));

    const chip = strip.root.querySelector('.chip--flag') as HTMLElement | null;
    expect(chip?.dataset['flag']).toBe('super');
    // One recipe, and the kind is an attribute rather than a class: the
    // stylesheet decides what an attribute means, and nothing here can grow a
    // modifier without the check above seeing it.
    expect([...(chip?.classList ?? [])].sort()).toEqual(['badge', 'badge--flag', 'chip', 'chip--flag']);
    expect(chip?.style.cssText).toBe('');
  });

  it('keeps the same recipe on a kind with no colour at all', () => {
    const neutral = flagChip('crit', 'Critical hit');
    const coloured = flagChip('super', 'Super effective');
    expect([...neutral.classList].sort()).toEqual([...coloured.classList].sort());
  });
});

describe('the priority chevron, on the panel and on the card', () => {
  it('is the same glyph id in both places', () => {
    /*
     * `ui/theme/glyphs.ts` is the one sheet and `glyphNode` its one renderer —
     * `test/glyphs.test.ts` holds that. So "the same chevron" is the same id
     * out of that sheet, and this asserts the ids the two call sites use are
     * the ids the sheet defines.
     */
    for (const id of ['priority-up', 'priority-down']) {
      const mark = glyphNode(id, { label: id });
      expect(mark, id).not.toBeNull();
      expect(mark?.dataset['glyph']).toBe(id);
    }
  });

  it('is mounted from the sheet on the panel and on the move card, not drawn twice', () => {
    const scene = source('src/ui/scene.ts');
    /*
     * Both call sites reach the chevron through `glyphNode`, which is what
     * stops the panel and the card drifting into two marks that look alike.
     * The panel builds both forms and the stylesheet picks; the card picks in
     * TypeScript because a card knows its move's bracket at render time and a
     * panel does not know the turn's until the turn resolves.
     */
    expect(scene).toContain('glyphNode(`priority-${bracket}`');
    expect(scene).toContain("glyphNode(priority > 0 ? 'priority-up' : 'priority-down'");
  });

  it('opens the explanation the strip’s own priority chip opens', () => {
    /*
     * R5, and the defect M1.2 found: a glyph on this screen that opens nothing
     * is a focusable trigger with no panel behind it. The panel's chevron and
     * the strip's `Priority` chip are the same fact about the same turn, so
     * they share one explanation rather than growing a second.
     */
    const root = playOneTurn(QUICK, SLOW, 'BRACKET01');
    const marks = [...root.querySelectorAll('.panel__priority > .glyph')] as HTMLElement[];
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark.dataset['tip']).toBe('flag:priority');
  });

  it('shows the chevron only when a bracket decided the order', () => {
    // R4 and section 6 step 2 together: a same-bracket turn is unmarked, so the
    // slot has no resting state to hide.
    expect(declaration('.panel__priority', 'display')).toBe('none');
    expect(declaration('.panel[data-bracket] .panel__priority', 'animation-name')).toBe('priority-flash');
  });

  it('borrows the lunge’s duration, so a priority turn costs the same as any other', () => {
    // Section 6 adds no time. `--motion-beat` is the lunge, and naming a number
    // here would be the hardcoded duration `visual-tokens.test.ts` counts.
    expect(declaration('.panel[data-bracket] .panel__priority', 'animation-duration')).toBe('var(--motion-beat)');
  });
});

/**
 * One turn, played, with the scene handed exactly what the app hands it.
 *
 * The same two calls `ui/screens/battle.ts` makes — one `readFlags` over the
 * batch, then `scene.update(view, onChoose, turns)` — so what is asserted is
 * the wiring that ships. `test/battle-feedback.test.ts` states the idiom.
 */
function playOneTurn(p1: TeamSpec, p2: TeamSpec, seed: string): HTMLElement {
  const session = createBattle({ teams: { p1, p2 }, seed });
  const before = session.protocolFor('p1').length;
  for (const side of ['p1', 'p2'] as const) session.submit(side, moveChoice(1));

  const batch = session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
  const scene = createScene();
  scene.update(
    buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects),
    () => undefined,
    readFlags(batch, { priorityOf: movePriority }),
  );
  return scene.root;
}

const QUICK: TeamSpec = [{ species: 'Jolteon', ability: 'Volt Absorb', moves: ['Quick Attack'], level: 50 }];
const SLOW: TeamSpec = [{ species: 'Snorlax', ability: 'Immunity', moves: ['Body Slam'], level: 50 }];
const ALSO_SLOW: TeamSpec = [{ species: 'Golem', ability: 'Sturdy', moves: ['Rock Slide'], level: 50 }];

describe('the chevron on the turn a bracket decided', () => {
  it('marks the panel that went first, and only that one', () => {
    const root = playOneTurn(QUICK, SLOW, 'BRACKET01');
    const me = root.querySelector('.panel--me') as HTMLElement;
    const foe = root.querySelector('.panel--foe') as HTMLElement;

    // Quick Attack is +1 against Body Slam's 0, so the bracket is why p1 went
    // first — which is the log's rule, not a Speed comparison.
    expect(me.dataset['bracket']).toBe('up');
    expect(foe.dataset['bracket']).toBeUndefined();
  });

  it('leaves both panels unmarked when the brackets are equal', () => {
    /*
     * Section 6: *"Same-bracket turns are unmarked, matching the log rule."*
     * Both moves sit at bracket 0 here, so Speed decided, and Speed is not what
     * this chevron means — the Stat family's Speed glyph on the chip row is.
     */
    const root = playOneTurn(SLOW, ALSO_SLOW, 'BRACKET02');
    for (const side of ['me', 'foe']) {
      const panel = root.querySelector(`.panel--${side}`) as HTMLElement;
      expect(panel.dataset['bracket'], side).toBeUndefined();
    }
  });

  it('clears the mark when the next turn is an ordinary one', () => {
    /*
     * The attribute is the whole of the state, so a turn that was not
     * bracket-driven has to take the previous turn's chevron away with it. A
     * mark left behind would be the panel claiming a bracket decided a turn it
     * did not.
     */
    const session = createBattle({ teams: { p1: QUICK, p2: SLOW }, seed: 'BRACKET03' });
    const scene = createScene();
    const view = (): ReturnType<typeof buildBattleUiView> =>
      buildBattleUiView(session.factsFor('p1'), { ability: true, item: true, teamSize: true }, abilityEffects);

    const turn = (): readonly string[] => {
      const before = session.protocolFor('p1').length;
      for (const side of ['p1', 'p2'] as const) {
        if (session.viewFor(side).awaitingChoice) session.submit(side, moveChoice(1));
      }
      return session.protocolFor('p1').slice(before).filter((line) => !line.startsWith('|t:|'));
    };

    scene.update(view(), () => undefined, readFlags([...turn()], { priorityOf: movePriority }));
    const me = scene.root.querySelector('.panel--me') as HTMLElement;
    expect(me.dataset['bracket']).toBe('up');

    // A redraw that is not the result of new protocol carries no turns at all,
    // which is the case `update` documents — and it must not leave the mark up.
    scene.update(view(), () => undefined);
    expect(me.dataset['bracket']).toBeUndefined();
  });
});

describe('the jiggle still reads the log’s order', () => {
  it('derives the acting order and the bracket from the actions it is handed', () => {
    /*
     * M4.2's third clause is a verification: *"verify the jiggle order still
     * reads off the log's ordered data, not a second computation"*. Two things
     * hold it, and both are already tested elsewhere — `test/boundaries.test.ts`
     * forbids `scene.ts` from calling `readTurns` or `readFlags` at all, and
     * `test/battle-feedback.test.ts` asserts the actors move in the order the
     * log numbers the actions.
     *
     * What is asserted here is the part M4.2 added: the chevron comes off the
     * same `TurnAction` the lunge does, so a turn cannot flash a chevron on one
     * panel while the lunge says the other side went first.
     */
    const scene = source('src/ui/scene.ts');
    const body = /function bracketMark\([\s\S]*?\n}/.exec(scene)?.[0] ?? '';

    expect(body).toContain('action.priority');
    expect(body).toContain('action.bracket');
    // No second reading, and no Speed anywhere near it: the bracket is the
    // log's answer, arriving on the action rather than being worked out again.
    expect(body).not.toMatch(/readTurns|readFlags|speed|Speed/);
    expect(body).not.toMatch(/\.flags\b/);
  });
});
