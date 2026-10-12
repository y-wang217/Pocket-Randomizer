/**
 * @vitest-environment jsdom
 *
 * The card run's screens in every language
 * (`docs/spec/gymrun-patch-card-run-translations.md`): the run's own words
 * (`RUN_COPY`) and the lines its tables carry onto a screen are in all eight
 * languages, swap with the battle's, and a run screen in another language
 * shows none of the English it replaced. Machine-drafted, like every other
 * line of the translation tables.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { ACTS, EVENTS, SHAPES } from '../src/cardData/cardrunTables';
import { RUN_COPY, RUN_COPY_BY_LANGUAGE, textOf } from '../src/cardData/cardrunCopy';
import { CARD_LANGUAGES, setCardLanguage, type CardLanguage } from '../src/cardData/copy';
import { RUN_FIGHTS } from '../src/cardData/encounters';
import { TALENTS } from '../src/cardData/talents';
import { createRun, currentStop, stepRun, type CardRunState, type RunAction } from '../src/core/cards/cardrun';
import { runBotAction } from '../src/core/cards/cardrunBot';
import { guardBot } from '../src/core/cards/guard';
import { saveCardPrefs } from '../src/ui/cardbattle/prefs';
import { mountCardRun } from '../src/ui/cardrun/shell';

const SAVE = 'gymrun.cardrun.v1';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const OTHERS = CARD_LANGUAGES.filter((l) => l !== 'en');

afterEach(() => {
  setCardLanguage('en');
  document.body.replaceChildren();
  localStorage.clear();
});

/** Every line from the run's tables that a run screen shows. */
const LINES = [
  ...new Set([
    ...Object.values(SHAPES).flatMap((s) => [s.name, s.plan]),
    ...Object.values(EVENTS).flatMap((e) => [e.name, e.text, ...e.options.map((o) => o.label)]),
    ...Object.values(TALENTS).map((t) => t.text),
    ...ACTS.map((a) => RUN_FIGHTS[a.boss]!.blurb),
  ]),
];

/** Every fixed string in a copy table, by its path; the data lines (`text`) are held apart. */
function leaves(table: unknown, path = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof table === 'string') out.set(path, table);
  else if (table && typeof table === 'object')
    for (const [key, value] of Object.entries(table)) if (path || key !== 'text') for (const [p, v] of leaves(value, `${path}.${key}`)) out.set(p, v);
  return out;
}

describe('the tables', () => {
  it('fills every line a run screen draws from data, in every language, and nothing else', () => {
    for (const language of OTHERS) {
      const text = RUN_COPY_BY_LANGUAGE[language].text;
      for (const line of LINES) expect(text[line], `${language}: ${line}`).toBeTruthy();
      expect(Object.keys(text).filter((k) => !LINES.includes(k)), language).toEqual([]);
    }
  });

  it('translates every fixed word: none is left as the English', () => {
    const english = leaves(RUN_COPY_BY_LANGUAGE.en);
    // Words a language shares with English: a loanword, a unit's own label, or a heading that is only its slot.
    const shared = new Set(['.sandbox', '.tutorial', '.owner.neutral', '.boost.talent', '.node.boss', '.camp.heading', '.team']);
    for (const language of OTHERS) {
      const own = leaves(RUN_COPY_BY_LANGUAGE[language]);
      expect([...own.keys()].sort(), language).toEqual([...english.keys()].sort());
      const same = [...english].filter(([path, word]) => !shared.has(path) && own.get(path) === word).map(([path]) => path);
      expect(same, language).toEqual([]);
    }
  });

  it('swaps with the battle: one setting sets both', () => {
    setCardLanguage('ja');
    expect(RUN_COPY.route.heading).toBe('立ち寄り先を選ぶ');
    expect(textOf('Move on')).toBe('先へ進む');
    setCardLanguage('en');
    expect(RUN_COPY.route.heading).toBe('Choose your stop');
    expect(textOf('Move on')).toBe('Move on');
  });

  it('counts in Ukrainian by its own plural', () => {
    const { suppliesN } = RUN_COPY_BY_LANGUAGE.uk;
    expect([1, 2, 5, 11, 12, 21, 22, 25].map(suppliesN)).toEqual([
      '1 припас',
      '2 припаси',
      '5 припасів',
      '11 припасів',
      '12 припасів',
      '21 припас',
      '22 припаси',
      '25 припасів',
    ]);
  });
});

/**
 * One run, steered so every kind of screen comes up: the bot plays, but at a
 * route it takes the City, the Wild and the Town in turn. The decisions up to
 * the first time each screen shows, by screen.
 */
function screensOf(seed: string): Map<CardRunState['screen']['k'], RunAction[]> {
  const bot = guardBot();
  const order = ['city', 'wild', 'town'] as const;
  let run = createRun(seed);
  let stops = 0;
  const actions: RunAction[] = [];
  const seen = new Map<CardRunState['screen']['k'], RunAction[]>();
  for (;;) {
    // A Wild counts once it holds a ? event, so the event's lines are on a screen.
    const counts = run.screen.k !== 'battle' && (run.screen.k !== 'wild' || !!currentStop(run)?.wild.event);
    if (counts && !seen.has(run.screen.k)) seen.set(run.screen.k, [...actions]);
    let action = runBotAction(run, bot);
    if (!action) break;
    if (run.screen.k === 'route' && action.type === 'go') action = { type: 'go', to: order[stops++ % order.length]! };
    const result = stepRun(run, action);
    if (!result.ok) throw new Error(result.reason);
    actions.push(action);
    run = result.state;
  }
  return seen;
}

/** The run resumed at those decisions, in `language`. */
async function resume(seed: string, actions: RunAction[], language: CardLanguage): Promise<HTMLElement> {
  saveCardPrefs({ language, palette: 'standard' });
  localStorage.setItem(SAVE, JSON.stringify({ version: createRun(seed).version, seed, actions }));
  const host = document.createElement('div');
  document.body.append(host);
  const { root } = mountCardRun(host);
  root.querySelector<HTMLElement>('.cr-title .cr-btn')!.click();
  await tick();
  return root;
}

/** Every piece of text a player or a screen reader gets: each element's own text, its label and its title. */
function said(root: HTMLElement): string[] {
  const out: string[] = [];
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    for (const child of node.childNodes) if (child.nodeType === 3 && child.textContent!.trim()) out.push(child.textContent!.trim());
    for (const attr of ['aria-label', 'title']) if (node.getAttribute(attr)) out.push(node.getAttribute(attr)!);
  }
  return out;
}

describe('a run screen in another language', () => {
  // A seed whose steered run reaches every screen, the shrine's and the smith's included.
  const seed = 'RUNCOPY';
  const screens = screensOf(seed);
  const english = [...leaves(RUN_COPY_BY_LANGUAGE.en)];

  it('reaches every screen a run decision is made on', () => {
    expect([...screens.keys()].sort()).toEqual(['boost', 'cards', 'city', 'market', 'over', 'remove', 'replace', 'route', 'upgrade', 'wild']);
  });

  for (const language of OTHERS) {
    it(`${language}: says nothing in the English it replaced`, async () => {
      const own = leaves(RUN_COPY_BY_LANGUAGE[language]);
      const replaced = new Set(english.filter(([path, word]) => own.get(path) !== word).map(([, word]) => word));
      const lines = LINES.filter((line) => RUN_COPY_BY_LANGUAGE[language].text[line] !== line);
      for (const [screen, actions] of screens) {
        const root = await resume(seed, actions, language);
        expect(root.lang, screen).toBe(language);
        // The deck, where the shapes' names and plans are read.
        if (screen === 'route') root.querySelector<HTMLElement>('.cr-deck-btn')!.click();
        // The Wild this seed reaches holds a ? event, so its lines are read too.
        if (screen === 'wild') expect(root.querySelector('.cr-event'), language).not.toBeNull();
        const words = said(root);
        expect(words.filter((w) => replaced.has(w)), `${language} ${screen}`).toEqual([]);
        expect(words.filter((w) => lines.some((line) => w.includes(line))), `${language} ${screen}`).toEqual([]);
        document.body.replaceChildren();
      }
    });
  }
});
