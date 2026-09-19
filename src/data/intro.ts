/**
 * The intro: five sentences shown once, before anything else.
 *
 * ## What it is for, and what the tutorial is for
 *
 * They answer different questions and neither answers the other's.
 *
 * The tutorial (`data/tutorial.ts`) explains the **vocabulary**: what a seed
 * is, what PP is, what a tier is, what a relic is. Its bar is that a player
 * who has never seen a Pokemon game can read every screen and understand what
 * it is asking. It is very good at that and it is the wrong tool for the
 * question a new player actually opens with, which is *what kind of thing is
 * this*. Twenty-eight coach marks answer that eventually, in pieces, after
 * eight screens.
 *
 * The intro answers it in one line, before the first decision: a deckbuilding
 * roguelike, played with randomized Pokemon. A player who knows the genre now
 * knows the whole shape of the game — one run, escalating fights, a reward
 * after each, no take-backs — and every screen after this reads as an instance
 * of a pattern they have. A player who does not know the genre has lost
 * nothing, because the tutorial is still there and the intro says so.
 *
 * ## The naming is deliberate, and it is a comparison rather than a claim
 *
 * "Slay the Spire" is a fact about what this is like, in the one register that
 * conveys a genre to the people who would recognise it. It is not a verdict
 * about an option the player is choosing between — there is no option here,
 * and the copy rule in `CLAUDE.md` governs the screens where a choice is being
 * made. The nearest thing in the game already is `data/locales.ts`'s blurbs:
 * a line that sets a register rather than stating a number.
 *
 * ## Read by `ui/` only, and excluded from `contentHash`
 *
 * Nothing under `core/` imports this file, so it sits on the exclusion list in
 * `build-config/content-hash.ts` beside `data/tutorial.ts` and
 * `data/seedCopy.ts`: rewording the greeting must not move a seed.
 */

/**
 * The version of the intro's *content*.
 *
 * Stored alongside the seen flag, so a rewrite that changes what the intro
 * says can show itself once to a player who has already dismissed the old
 * one. Bumped by hand, and only when the body changes enough to be worth
 * interrupting a returning player for — a typo fix is not.
 */
export const INTRO_VERSION = 1;

export const INTRO_COPY = {
  /** The heading. Names what the panel is about, and claims nothing. */
  title: 'What this is',
  /**
   * The whole thing, in two sentences.
   *
   * The second is the load-bearing one. A first-time player who does not
   * recognise the reference is told, in the same breath, that not recognising
   * it is expected and that nothing is riding on it — which is a friendlier
   * thing to read than a paragraph explaining the genre to them would be.
   */
  body: 'Slay the Spire, meets a Pokemon randomizer. If that means nothing to you: good luck.',
  /** The dismiss. It closes the panel and nothing else. */
  dismiss: 'Good luck',
  /**
   * The line under the buttons.
   *
   * The intro's one job beyond the greeting: say that the coach marks exist
   * and where the control is, so a player who wants the long version does not
   * have to find it by accident. `Tutorial` is `TUTORIAL_COPY.replayShort`,
   * the face of the header button, quoted so the sentence names the control
   * the player is looking at.
   */
  tutorial: 'The marks that follow name everything on each screen. Tutorial, in the header, brings them back.',
  /** The header control's label when it will reopen this panel too. */
  replay: 'Show the intro and the tutorial again',
} as const;
