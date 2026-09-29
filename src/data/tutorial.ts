/**
 * The tutorial: first-run coach marks, one screen at a time.
 *
 * Every string a coach mark shows lives here, keyed by screen and mark id.
 * No tutorial sentence lives in a component, for the reason every copy table
 * under `data/` gives: a sentence describing a mechanic, written in the file
 * that draws it, drifts from the mechanic.
 *
 * ## The rule the copy is written under
 *
 * Part 4 of Stage 4.5.1, in full: **the UI presents attributes, never
 * verdicts.** A mark may say what a thing is and what it does. It never says
 * what to pick, which option is better, or what a player usually does. If a
 * sentence could be read as advice, it is cut. `TUTORIAL_FORBIDDEN_WORDS`
 * below is a lint over that rule, not the rule itself; the morning copy
 * review is the real check.
 *
 * ## The bar
 *
 * A player who has never seen a Pokemon game can read every screen and
 * understand what it is asking. Not play well — read. So the marks explain
 * the vocabulary on the screen (a seed, a step, a tier, a type, PP, a status,
 * a relic) and the shape of each decision (three starters, a step's options,
 * four moves, three cards), and stop there.
 *
 * ## Written against the compact face (milestone M6.2)
 *
 * These were first written against Detailed, then the first-launch default,
 * and a guard forced Detailed while a screen's marks were up. M6.2 deleted the
 * guard and rewrote every mark that named something the compact face no
 * longer draws: a stat *label*, `BP`, a category *chip*, the tier *words*, the
 * log beneath the board, the coverage *line*, and a tap that inspects. Four of
 * those were false in every mode, since the tree had moved under them.
 *
 * **A mark explains the screen, never the glyph.** Section 7 of the design
 * bible gives the glyphs to the exposure labels (R7) and the things to inspect
 * (R5), one job each. So a mark says a card shows a move's kind; the label
 * beside the fist says the fist is Physical. The gesture is always "press and
 * hold", because a tap selects.
 *
 * ## Anchors
 *
 * `anchor` is a CSS selector for a `data-tutorial` attribute a screen sets on
 * a real element — the actual stat block, the actual move button, the actual
 * tier badge. A mark never renders a mock of its element. If the anchor is
 * not on screen when the screen is shown (an event gate on a step with no
 * event, a capture block on a trainer win), the mark does not show, and the
 * screen's other marks still do. `test/tutorial.test.ts` mounts every screen
 * and asserts each anchor exists somewhere it can.
 *
 * The stat sentences on the starter screen reuse `data/statInfo.ts` rather
 * than restating it, so "what is SpA" has one answer in the whole app.
 */

/** The screens that carry marks. `drawer` is the party drawer, a shell surface. */
export type TutorialScreen = 'starter' | 'locale' | 'map' | 'battle' | 'result' | 'party' | 'drawer' | 'pre-gym';

export const TUTORIAL_SCREENS: readonly TutorialScreen[] = [
  'starter',
  'locale',
  'map',
  'battle',
  'result',
  'party',
  'drawer',
  'pre-gym',
];

export interface TutorialMark {
  /** Stable, unique within its screen. Tests key on it. */
  id: string;
  /** Selector for the `data-tutorial` attribute on the real element. */
  anchor: string;
  title: string;
  text: string;
}

/*
 * **Twenty-nine marks became seventeen. The opening playtest QA, the author's
 * ruling: "tutorial shorter is better. i always skip it."**
 *
 * The tester counted eleven steps before the first fight and six more inside
 * it. The cut follows bible section 7's division of labour rather than a
 * count: coach marks explain *screens*, exposure labels explain *glyphs*, and
 * inspect explains *things*. Every mark removed was doing one of the other two
 * jobs (the six stats, types, a move card, PP, status, the effectiveness
 * marker, the node kinds), so each fact it carried is still one hold away and
 * C2 holds. What stays says what a screen is for and where its decision is,
 * plus the three rules nothing else on screen can show: the seed, fainting,
 * and that a hold explains without acting. `statSentences` went with the
 * stats mark; `STAT_INFO` still feeds the stat block's inspect.
 */
export const TUTORIAL: Readonly<Record<TutorialScreen, readonly TutorialMark[]>> = {
  starter: [
    {
      id: 'seed',
      anchor: '[data-tutorial="seed"]',
      title: 'The seed',
      text:
        'A seed fixes the whole run. The same seed and the same choices give the same run, ' +
        'so the code here can be copied and played again.',
    },
    {
      id: 'starters',
      anchor: '[data-tutorial="starters"]',
      title: 'Three starters',
      text:
        'A run begins with one of these three. A card is everything there is to know about it. ' +
        'Pressing and holding anything, here or later, explains it.',
    },
  ],
  locale: [
    {
      id: 'regions',
      anchor: '[data-tutorial="regions"]',
      title: 'A region',
      text:
        'Each part of the run is one region, chosen here. It sets which wild Pokemon and events appear, ' +
        'and it ends at a gym whose type is shown.',
    },
  ],
  map: [
    {
      id: 'options',
      anchor: '[data-tutorial="options"]',
      title: 'The current step',
      text:
        'Each step offers two or three options, and exactly one is taken. ' +
        'Steps above are done; steps below are still to come.',
    },
    {
      id: 'tier',
      anchor: '[data-tutorial="tier"]',
      title: 'How hard a fight is',
      text: 'The pips are a fight’s tier. Each filled pip is a harder fight that pays a larger reward.',
    },
    {
      id: 'gate',
      anchor: '[data-tutorial="gate"]',
      title: 'An event’s requirement',
      text:
        'An event shows the capability it asks for, and the chevron beside it the party’s standing: ' +
        'known, latent or none. The standing decides which outcome applies.',
    },
  ],
  battle: [
    {
      id: 'move',
      anchor: '[data-tutorial="move"]',
      title: 'A move button',
      text: 'Tapping a move uses it. Holding it explains it, and never uses it.',
    },
    {
      id: 'flags',
      anchor: '[data-tutorial="flags"]',
      title: 'What just happened',
      text: 'After each turn this strip says what happened. Every turn so far is in the battle history.',
    },
    {
      id: 'fainting',
      anchor: '[data-tutorial="hp"]',
      title: 'Fainting',
      text:
        'A Pokemon at zero HP faints, and stays in the party. ' +
        'The run ends only when every member has fainted.',
    },
  ],
  result: [
    {
      id: 'rewards',
      anchor: '[data-tutorial="rewards"]',
      title: 'Three cards',
      text: 'A win pays three cards, and exactly one is taken. There is no skipping and no redrawing.',
    },
    {
      id: 'capture',
      anchor: '[data-tutorial="capture"]',
      title: 'A capture',
      text:
        'A win against a wild Pokemon offers to add it to the party. Declining costs nothing; ' +
        'at a full party, accepting releases one member.',
    },
    {
      id: 'coverage',
      anchor: '[data-tutorial="coverage"]',
      title: 'Coverage',
      text:
        'The plus row lists the types the party could newly hit for extra damage with this Pokemon in it. ' +
        'The minus row lists the types it would no longer hit that way.',
    },
  ],
  party: [
    {
      id: 'items',
      anchor: '[data-tutorial="items"]',
      title: 'Held items',
      text:
        'A Pokemon holds one item, given and taken back here, and locked during a battle. ' +
        'Items nobody holds sit in the backpack, which has a capacity.',
    },
    {
      id: 'relics',
      anchor: '[data-tutorial="relics"]',
      title: 'Relics',
      text: 'A relic belongs to the run, not to a Pokemon. It takes no slot and cannot be lost.',
    },
  ],
  drawer: [
    {
      id: 'party',
      anchor: '[data-tutorial="drawer-party"]',
      title: 'The party drawer',
      text: 'The whole party, from any screen. It is a view: items are changed on the party screen.',
    },
  ],
  'pre-gym': [
    {
      id: 'gym',
      anchor: '[data-tutorial="gym-counter"]',
      title: 'The gym',
      text:
        'The end of the region. The leader’s Pokemon share the type shown here. ' +
        'Winning begins the next region; losing ends the run.',
    },
    {
      id: 'lead',
      anchor: '[data-tutorial="gym-lead"]',
      title: 'Who leads',
      text: 'The Pokemon chosen here goes out first. A gym pays a move every time, then a choice of cards.',
    },
  ],
};

export { FORBIDDEN_WORDS as TUTORIAL_FORBIDDEN_WORDS } from './forbiddenWords';

/** The controls' labels. */
export const TUTORIAL_COPY = {
  next: 'Next',
  done: 'Done',
  skip: 'Skip tutorial',
  replay: 'Show tutorial again',
  /** The header button's face; `replay` is its label for a screen reader and its title. */
  replayShort: 'Tutorial',
  /** "2 of 5", read by the mark's counter. */
  progress: (index: number, count: number): string => `${index} of ${count}`,
} as const;

/** How many marks a screen may carry. The prompt's ceiling: past it, the screen is the problem. */
export const TUTORIAL_MARKS_PER_SCREEN_MAX = 6;
