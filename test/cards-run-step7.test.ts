/**
 * @vitest-environment jsdom
 *
 * Card run shapes, step 7a (`docs/spec/gymrun-card-run-shapes-prompt.md`):
 * the run's screens say what changes a decision. An act that scales its
 * fights says so before it is met; a shape's plan is at rest, not a hover;
 * the deck reads by shape; the replace screen lists the basic cards first;
 * the boss screen names each talent's shape and what the unit already has;
 * the end of a run names the act it fell in, the shape it leaned into and
 * its talents.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DECK_GROUPS, SHAPES, deckGroupOf, isBasic, shapesLeanedInto } from '../src/cardData/cardrunTables';
import { ACT_SCALING } from '../src/cardData/encounters';
import { TALENTS } from '../src/cardData/talents';
import { createRun, replayRun, stepRun, type CardRunState, type RunAction, type RunLog } from '../src/core/cards/cardrun';
import { runBotAction } from '../src/core/cards/cardrunBot';
import { guardBot } from '../src/core/cards/guard';
import { mountCardRun } from '../src/ui/cardrun/shell';

const all = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
const byText = (root: ParentNode, selector: string, text: string) => all(root, selector).find((n) => n.textContent === text);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SAVE = 'gymrun.cardrun.v1';

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

/** The bot's run on `seed` up to the first screen `until` holds for, saved, and the shell resumed there. */
async function resumeAt(seed: string, until: (s: CardRunState) => boolean): Promise<{ root: HTMLElement; run: CardRunState }> {
  const bot = guardBot();
  let run = createRun(seed);
  const actions: RunAction[] = [];
  while (run.screen.k === 'battle' || !until(run)) {
    const action = runBotAction(run, bot);
    if (!action) throw new Error(`the run ended before the screen: ${run.screen.k}`);
    const result = stepRun(run, action);
    if (!result.ok) throw new Error(result.reason);
    actions.push(action);
    run = result.state;
  }
  localStorage.setItem(SAVE, JSON.stringify({ version: run.version, seed, actions }));
  const host = document.createElement('div');
  document.body.append(host);
  const { root } = mountCardRun(host);
  byText(root, '.cr-btn', 'Continue run')!.click();
  await tick();
  return { root, run };
}

const nextFightAct = (s: CardRunState) => s.nodes.slice(s.at + 1).find((n) => n.kind === 'fight')?.act;

describe('the act warning', () => {
  it('says what the next act adds before its first fight, and marks where each scaling act begins on the strip', async () => {
    const { root } = await resumeAt('STEP7A', (s) => s.screen.k === 'route' && nextFightAct(s) === 1);
    expect(root.querySelector('.cr-act-warning')!.textContent).toBe('Floor 2: enemies +1 HP, veterans in the waves before the last');
    const chips = all(root, '.cr-strip .cr-act-chip');
    // Act 1 adds nothing, so only acts 2 and 3 carry a chip.
    expect(chips.map((c) => c.getAttribute('aria-label'))).toEqual([
      `Floor 2: enemies +${ACT_SCALING[1]!.hpBonus} HP, veterans in the waves before the last`,
      `Floor 3: enemies +${ACT_SCALING[2]!.hpBonus} HP, veterans in every wave`,
    ]);
  });

  it('says nothing on a route whose next fight is in act 1', async () => {
    const { root } = await resumeAt('STEP7A', (s) => s.screen.k === 'route' && nextFightAct(s) === 0);
    expect(root.querySelector('.cr-act-warning')).toBeNull();
  });
});

describe('the shape plans, at rest', () => {
  it('shows each offered card its shape and the plan in a line, with no tooltip', async () => {
    const { root, run } = await resumeAt('STEP7A', (s) => s.screen.k === 'cards');
    const tags = all(root, '.cr-cards .cr-shape');
    expect(tags).toHaveLength(3);
    for (const tag of tags) {
      const shape = SHAPES[tag.dataset['shape'] as keyof typeof SHAPES];
      expect(tag.querySelector('.cr-shape-plan')!.textContent).toBe(shape.plan);
      expect(tag.title).toBe('');
    }
    expect(run.screen.k).toBe('cards');
  });
});

describe('the deck by shape', () => {
  it('groups the deck in a fixed order, each group with its count, every card once', async () => {
    const { root, run } = await resumeAt('STEP7A', (s) => s.screen.k === 'boost');
    byText(root, '.cr-btn', `Deck ${run.deck.length}`)!.click();
    const groups = all(root, '.cr-overlay .cr-group');
    const ids = groups.map((g) => g.dataset['group']);
    expect(ids).toEqual(DECK_GROUPS.filter((g) => run.deck.some((card) => deckGroupOf(card) === g)));
    let total = 0;
    for (const group of groups) {
      const n = group.querySelectorAll('.cr-card').length;
      total += n;
      expect(group.querySelector('.cr-group-name')!.textContent).toMatch(new RegExp(` · ${n}$`));
    }
    expect(total).toBe(run.deck.length);
  });
});

describe('the replace screen', () => {
  it('lists the basic cards first, each marked, and a tap still replaces the card tapped', async () => {
    // The second card reward: by then the deck holds a card that is not basic.
    let rewards = 0;
    const { root, run } = await resumeAt('STEP7A', (s) => s.screen.k === 'replace' && ++rewards === 2);
    const tiles = all(root, '.cr-deck .cr-card--tap');
    expect(tiles).toHaveLength(run.deck.length);
    const marked = tiles.map((t) => t.dataset['basic'] === 'true');
    const basics = run.deck.filter(isBasic).length;
    expect(basics).toBeLessThan(run.deck.length);
    expect(marked).toEqual(run.deck.map((_, i) => i < basics));
    expect(tiles.filter((t) => t.querySelector('.cr-basic')).length).toBe(basics);
    // The first tile that is not basic is the deck's first card that is not.
    const index = run.deck.findIndex((card) => !isBasic(card));
    tiles[basics]!.click();
    const after = replayRun(JSON.parse(localStorage.getItem(SAVE)!) as RunLog);
    expect(after.deck[index]).toBe(run.screen.k === 'replace' ? run.screen.card : '');
  });
});

describe('the boss screen', () => {
  it("names each talent's shape, and what the unit already has beside every offer", async () => {
    const { root, run } = await resumeAt('STEP7A', (s) => s.screen.k === 'boost' && s.nodes[s.at]!.act === 1);
    if (run.screen.k !== 'boost') throw new Error('not the boss screen');
    const choices = all(root, '.cr-choice');
    expect(choices).toHaveLength(run.screen.offers.length);
    run.screen.offers.forEach((offer, i) => {
      const has = run.boosts[offer.unit].talents ?? [];
      const lines = all(choices[i]!, '.cr-choice-line').map((l) => l.textContent);
      expect(lines).toContain(has.length > 0 ? `Has: ${has.map((t) => TALENTS[t]!.name).join(', ')}` : 'No talent yet');
      if (offer.kind === 'talent') expect(choices[i]!.querySelector('.cr-shape')).not.toBeNull();
    });
  });
});

describe('the end of a run', () => {
  it('names the act it fell in, the shape it leaned into and the talents it took', async () => {
    // LOST2: the bot falls on floor 2 (the floors of 2026-10-13 moved where LOST7 fell).
    const { root, run } = await resumeAt('LOST2', (s) => s.screen.k === 'over');
    const notes = all(root, '.cr-screen .cr-note').map((n) => n.textContent ?? '');
    expect(notes.some((n) => n.startsWith('Fell on floor 2/3: '))).toBe(true);
    const lean = shapesLeanedInto(run.deck);
    expect(notes).toContain(lean.shapes.length > 0 ? `Leaned into: ${lean.shapes.map((id) => SHAPES[id].name).join(', ')}, ${lean.n} card${lean.n === 1 ? '' : 's'}` : 'Leaned into no shape');
    expect(notes.some((n) => n.startsWith('Talents: ') || n === 'No talents taken')).toBe(true);
  });
});

describe('shapesLeanedInto', () => {
  it('names every shape tied at the most cards, and none for a deck of basics', () => {
    expect(shapesLeanedInto(['baton', 'shoot'])).toEqual({ shapes: [], n: 0 });
    expect(shapesLeanedInto(['concuss', 'shove', 'fortify', 'baton'])).toEqual({ shapes: ['control'], n: 2 });
    expect(shapesLeanedInto(['concuss+', 'fortify'])).toEqual({ shapes: ['puppeteer', 'control'], n: 1 });
  });
});
