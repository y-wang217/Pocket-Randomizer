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
 * ## Written against Detailed mode
 *
 * Detailed is the first-launch default and the mode where every abbreviation
 * is on screen to be pointed at. Marks render in every mode against the same
 * anchors; the copy is not mode-specific in this pass, and Pocket mode, when
 * it exists, is allowed to show a mark naming something that mode hides.
 * Recorded as a known gap in `docs/handoff/overnight-3-tutorial.md`.
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
import { STAT_INFO, STAT_ORDER } from './statInfo';

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

/** The six stat one-liners, from the one table that owns them. */
function statSentences(): string {
  return STAT_ORDER.map((stat) => {
    const entry = STAT_INFO[stat];
    // The first sentence of each tooltip: the abbreviation, its name, what the number does.
    const first = entry?.mechanics.split(/(?<=\.)\s/)[0] ?? '';
    return entry ? `${entry.abbreviation} is ${entry.label}: ${first}` : '';
  })
    .filter(Boolean)
    .join(' ');
}

export const TUTORIAL: Readonly<Record<TutorialScreen, readonly TutorialMark[]>> = {
  starter: [
    {
      id: 'seed',
      anchor: '[data-tutorial="seed"]',
      title: 'The seed',
      text:
        'A seed is a short code that fixes the whole run: which Pokemon appear, which routes are offered, ' +
        'what each fight rolls. Two people with the same seed who make the same choices get the same run. ' +
        'The code shown here can be copied and pasted into this box on another day.',
    },
    {
      id: 'starters',
      anchor: '[data-tutorial="starters"]',
      title: 'Three starters',
      text:
        'A run begins by choosing one of these three Pokemon. Everything shown on a card — its stats, its ' +
        'types, its ability and its moves — is the whole basis for the choice. There is nothing hidden.',
    },
    {
      id: 'stats',
      anchor: '[data-tutorial="stats"]',
      title: 'The six stats',
      text: `${statSentences()} Tapping any of the six labels opens the same explanation later.`,
    },
    {
      id: 'types',
      anchor: '[data-tutorial="types"]',
      title: 'Types',
      text:
        'A Pokemon has one or two types, shown here. Moves have a type too, shown on each move, and the two ' +
        'are different things: a Pokemon’s types decide what hits it hard, a move’s type decides what it hits hard.',
    },
    {
      id: 'moves',
      anchor: '[data-tutorial="moves"]',
      title: 'Moves',
      text:
        'Each Pokemon knows up to four moves. A move has a type, a base power in BP, and a number of uses in PP. ' +
        'A move marked Status has no base power: it changes something instead of dealing damage.',
    },
  ],
  locale: [
    {
      id: 'regions',
      anchor: '[data-tutorial="regions"]',
      title: 'A region',
      text:
        'Each part of the run is walked through one region. The region sets which wild Pokemon can appear and ' +
        'which events are available. It does not set how hard the fights are.',
    },
    {
      id: 'gym',
      anchor: '[data-tutorial="gym"]',
      title: 'The gym at the end',
      text:
        'Every region ends at a gym, and the gym’s type is shown here before the region is chosen. ' +
        'The gym leader’s Pokemon share that type.',
    },
  ],
  map: [
    {
      id: 'options',
      anchor: '[data-tutorial="options"]',
      title: 'The current step',
      text:
        'A run through a region is a chain of steps. At each step there are two or three options, and ' +
        'the options on the numbered step here are the decision. Exactly one of them is taken.',
    },
    {
      id: 'kinds',
      anchor: '[data-tutorial="kinds"]',
      title: 'What an option is',
      text:
        'Wild is a fight against a wild Pokemon, which can be caught. Trainer is a fight against a trainer’s ' +
        'team. Rest restores the party’s HP and PP and pays nothing. Shop sells items for coins. ' +
        'A question mark is an event. Gym is the leader at the end of the region.',
    },
    {
      id: 'tier',
      anchor: '[data-tutorial="tier"]',
      title: 'Normal, hard, elite',
      text:
        'A fight carries a tier. Hard is a harder fight than normal and pays a larger reward; elite is harder ' +
        'again and pays more again. The tier is shown on every step that can still be seen.',
    },
    {
      id: 'gate',
      anchor: '[data-tutorial="gate"]',
      title: 'An event’s requirement',
      text:
        'An event names a capability it asks for and shows the party’s standing for it: known, if a relic ' +
        'grants it; latent, if the party’s types could manage it; or none. The standing decides which of ' +
        'the event’s outcomes applies.',
    },
    {
      id: 'chain',
      anchor: '[data-tutorial="chain"]',
      title: 'Above and below',
      text:
        'Steps already taken sit above the current one and the steps still to come sit below it. ' +
        'They are context. Only the current step is being asked about.',
    },
  ],
  battle: [
    {
      id: 'move',
      anchor: '[data-tutorial="move"]',
      title: 'A move button',
      text:
        'Each button is one move. Its type chip and its Physical, Special or Status chip say what it is: ' +
        'a Physical move is resolved with Attack against Defence, a Special move with Special Attack ' +
        'against Special Defence, and a Status move deals no damage.',
    },
    {
      id: 'effectiveness',
      anchor: '[data-tutorial="move"]',
      title: 'The effectiveness marker',
      text:
        'A marker on a move button is a forecast against the Pokemon on the field right now. ' +
        'Super effective means double damage, and four times against two matching types. Not very effective ' +
        'means half, and a quarter against two. No effect means none at all. No marker means normal damage.',
    },
    {
      id: 'pp',
      anchor: '[data-tutorial="pp"]',
      title: 'PP',
      text: 'PP is the number of uses a move has left. A move at zero PP cannot be chosen until it is restored.',
    },
    {
      id: 'status',
      anchor: '[data-tutorial="status"]',
      title: 'Status',
      text:
        'A condition on a Pokemon — burned, paralysed, poisoned, asleep, frozen — is shown as a chip on its ' +
        'panel here, and tapping the chip says what it does.',
    },
    {
      id: 'flags',
      anchor: '[data-tutorial="flags"]',
      title: 'What just happened',
      text:
        'After each turn the strip here and the log beneath the board say what happened: which side moved ' +
        'first, what hit, whether it was super effective, a critical hit, a miss.',
    },
    {
      id: 'fainting',
      anchor: '[data-tutorial="hp"]',
      title: 'Fainting',
      text:
        'A Pokemon whose HP reaches zero faints. Fainting is not death: a fainted Pokemon stays in the party ' +
        'and can be revived. The run ends only when every member of the party has fainted.',
    },
  ],
  result: [
    {
      id: 'rewards',
      anchor: '[data-tutorial="rewards"]',
      title: 'Three cards',
      text:
        'A fight that is won pays a reward: three cards, and exactly one is taken. There is no skipping ' +
        'and no redrawing. Each card says what it is.',
    },
    {
      id: 'capture',
      anchor: '[data-tutorial="capture"]',
      title: 'A capture',
      text:
        'Every win against a wild Pokemon offers to add it to the party. Declining costs nothing. ' +
        'Accepting when the party is full means one member has to be released.',
    },
    {
      id: 'coverage',
      anchor: '[data-tutorial="coverage"]',
      title: 'The coverage line',
      text:
        'The coverage line lists the types the party can hit for extra damage, as it stands and as it would ' +
        'stand with this Pokemon in it.',
    },
  ],
  party: [
    {
      id: 'items',
      anchor: '[data-tutorial="items"]',
      title: 'Held items',
      text:
        'A Pokemon can hold one item, and this screen is where items are given and taken back. ' +
        'Items are locked during a battle.',
    },
    {
      id: 'backpack',
      anchor: '[data-tutorial="backpack"]',
      title: 'The backpack',
      text:
        'Items nobody is holding sit in the backpack, which has a capacity. The count here is how many it ' +
        'holds against how many it can.',
    },
    {
      id: 'relics',
      anchor: '[data-tutorial="relics"]',
      title: 'Relics',
      text:
        'A relic belongs to the run rather than to a Pokemon. It is permanent for the run, it takes no ' +
        'backpack space and no item slot, and it cannot be given away or lost.',
    },
  ],
  drawer: [
    {
      id: 'party',
      anchor: '[data-tutorial="drawer-party"]',
      title: 'The party drawer',
      text:
        'This drawer shows the whole party from any screen: each member’s stats, moves, PP, status and ' +
        'held item. It is a view. Items are given and taken back on the party screen, and are locked during a battle.',
    },
    {
      id: 'relics',
      anchor: '[data-tutorial="drawer-relics"]',
      title: 'Relics',
      text: 'The run’s relics are listed here. A relic is permanent for the run and takes no slot.',
    },
  ],
  'pre-gym': [
    {
      id: 'gym',
      anchor: '[data-tutorial="gym-counter"]',
      title: 'The gym',
      text:
        'A gym is the end of a region. Beating its leader finishes the region and begins the next one; ' +
        'losing ends the run.',
    },
    {
      id: 'type',
      anchor: '[data-tutorial="gym-type"]',
      title: 'The gym’s type',
      text: 'Every gym has a type identity, shown here, and the leader’s Pokemon share it.',
    },
    {
      id: 'lead',
      anchor: '[data-tutorial="gym-lead"]',
      title: 'Who leads',
      text:
        'The Pokemon chosen here is the one sent out first. A gym that is beaten pays a larger reward than ' +
        'an ordinary fight: a move every time, and then a choice of cards.',
    },
  ],
};

/**
 * Words no mark may contain. A lint over Part 4, kept as data so it can grow.
 * Matched as whole words, case-insensitively, in `test/tutorial.test.ts`.
 */
export const TUTORIAL_FORBIDDEN_WORDS: readonly string[] = [
  'best',
  'should',
  'try',
  'recommend',
  'recommended',
  'good',
  'bad',
  'better',
  'worse',
  'strong',
  'weak',
  'usually',
];

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
