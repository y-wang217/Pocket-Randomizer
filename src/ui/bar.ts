/**
 * One bar component, and no bar built by hand anywhere else.
 *
 * ## What it is for
 *
 * Six places built the same three lines — a track, a fill, an inline width —
 * and four of them carried a copy of the same band ternary. Release C's chunk
 * and shadow, the one bar behaviour that took any thought, lived in the battle
 * panel's own code and nowhere else, so a bar anywhere but the battle screen
 * could not show a hit even if a screen wanted it to. This file is that code,
 * moved, with the six call sites reduced to a factory and a `set`.
 *
 * The `neutral` variant carries no HP meaning at all: no band colour, no
 * threshold. It is here so the next progress readout is a `createBar` and not
 * a seventh hand-built track.
 *
 * ## The class names are the old ones
 *
 * `.hp`, `.hp__fill`, `.hp__shadow`, `.hp--slim`. Renaming them to `bar` would
 * touch every stylesheet rule, every density override and every test selector
 * that names them, for no change in what the player sees. The block is called
 * `hp` because that is what it was; the component is called a bar because that
 * is what it is.
 *
 * ## The chunk, unchanged from Release C item 1
 *
 * When the fraction drops, the fill goes to the new value on the frame the
 * update arrives — **no width transition** — and a shadow segment is left
 * standing across exactly the span it vacated, fading over
 * `--motion-hp-shadow`. A sliding bar tells the player the number is changing
 * and hides how much it changed; a chunk that drops and leaves its outline says
 * how big the hit was, in one read.
 *
 * Four negatives, each of which a plausible one-line change would break:
 *
 * - **A heal draws no shadow.** A shadow behind a bar that grew would mark
 *   ground the Pokemon just gained as ground it lost.
 * - **The first draw draws no shadow.** There is no previous value, so there is
 *   no chunk — an opening switch-in at anything other than full HP is a
 *   carry-over, not a hit.
 * - **`chunk: false` draws no shadow**, and clears a standing one. The battle
 *   panel passes it on a species change, because the difference between two
 *   different bodies' bars is not damage.
 * - **A drop under `MIN_CHUNK` draws no shadow.** Thinner than the rounding on
 *   its own corners, it reads as an artefact rather than a hit; the log says so
 *   in words.
 *
 * `set` returns whether a chunk was drawn, and that boolean is the only thing
 * the battle screen's hit beat reads. The beat and the chunk therefore agree by
 * construction: no second threshold, no second rule.
 *
 * The shadow is opt-in per bar. A bar without one renders the single child the
 * six sites always rendered, so the DOM shape at every migrated site is the
 * shape it was.
 */
import { el } from './dom';

export type BarVariant = 'hp' | 'slim' | 'neutral';

export interface BarOptions {
  /** `hp` is the 9px track; `slim` the 4px bench track; `neutral` an uncoloured progress bar. */
  variant?: BarVariant;
  /** Create the shadow segment, so `set` can mark the chunk a drop took. */
  shadow?: boolean;
}

export interface SetOptions {
  /**
   * Draw a chunk if the fraction dropped. Default true. False when the bar now
   * describes a different thing than it did — a swapped body — and a drop is
   * therefore not a hit.
   */
  chunk?: boolean;
  /**
   * Which slot of the turn this chunk belongs to, 1-based, or null.
   *
   * **The victory-order patch, item 2.** The bar's *number* is still correct on
   * the frame the update arrives and always will be — that is the rule in
   * `ui/theme/motion.ts` and nothing here moves it. What is slotted is the
   * chunk, which is not information but emphasis: the outline of the ground a
   * hit took, held at full strength until the moment in the turn that hit
   * landed, then faded.
   *
   * The reported symptom was "the animation for my attack went first" on a turn
   * the player lost the Speed check. The lunges were correctly ordered — that is
   * asserted on both engines in `test/visual-motion.test.ts` — but *both* bars
   * drew their chunk on the same frame, before either body had moved, so the
   * damage the player dealt was on screen before the attack that preceded theirs
   * had visibly happened. Two chunks at once is a turn with no order in it, and
   * the eye goes to the bar.
   *
   * Null is the opening draw and every caller that is not the battle stage: the
   * chunk fades across the whole budget from now, which is what every bar did
   * before slots existed.
   */
  slot?: number | null;
}

export interface Bar {
  root: HTMLElement;
  fill: HTMLElement;
  /** The chunk segment, or null for a bar created without one. */
  shadow: HTMLElement | null;
  /** Point the bar at a fraction. Returns true if a chunk was drawn. */
  set(fraction: number, options?: SetOptions): boolean;
  /**
   * Resolve a standing chunk instantly. The tap handler's call: no transition
   * may outlast input, and the fill it was describing is already right.
   */
  cancel(): void;
}

/**
 * The smallest drop worth drawing, as a fraction of the track.
 *
 * Below this the shadow is thinner than the rounding on its own corners and
 * reads as a rendering artefact rather than as a hit. Sand damage on a 300 HP
 * Pokemon is a real event and the log says so in words; a two-pixel smear on
 * the bar is not the place to say it a second time.
 */
export const MIN_CHUNK = 0.005;

const VARIANT_CLASS: Record<BarVariant, string> = {
  hp: 'hp',
  slim: 'hp hp--slim',
  neutral: 'hp hp--neutral',
};

/** The three HP colours' thresholds. A threshold, not a quantity: the fill's colour crossfades, its width does not. */
export function hpBand(fraction: number): 'high' | 'mid' | 'low' {
  if (fraction > 0.5) return 'high';
  return fraction > 0.2 ? 'mid' : 'low';
}

export function createBar(options: BarOptions = {}): Bar {
  const variant = options.variant ?? 'hp';
  const root = el('div', VARIANT_CLASS[variant]);
  const fill = el('div', 'hp__fill');
  /*
   * The shadow goes in **before** the fill, so the fill paints over it.
   *
   * The two overlap by a hairline at the boundary — a fraction is a float and
   * the track is a few hundred device pixels — and a shadow drawn on top would
   * put a seam on the leading edge of the bar on exactly the frames the player
   * is watching it.
   */
  const shadow = options.shadow ? el('div', 'hp__shadow') : null;
  if (shadow) root.append(shadow);
  root.append(fill);

  const clearChunk = (): void => {
    if (!shadow) return;
    // Clearing rather than leaving the last chunk standing: a shadow that
    // outlives the hit it describes is a lie about the current turn.
    delete shadow.dataset['fading'];
    // And the slot with it. A slotted chunk holds at full strength through its
    // delay, so a cleared one that kept its slot would be a visible chunk with
    // no animation left to fade it.
    delete shadow.dataset['slot'];
    shadow.style.width = '0%';
  };

  return {
    root,
    fill,
    shadow,
    set(fraction, setOptions = {}) {
      const before = Number(fill.dataset['fraction'] ?? fraction);
      fill.style.width = `${fraction * 100}%`;
      fill.dataset['fraction'] = String(fraction);
      if (variant !== 'neutral') fill.dataset['band'] = hpBand(fraction);

      const lost = before - fraction;
      if (!shadow || setOptions.chunk === false || lost < MIN_CHUNK) {
        clearChunk();
        return false;
      }
      /*
       * Absolute inside the track and measured from the left in the same units
       * the fill uses, so the two agree by construction rather than by a
       * shared calculation: the shadow starts where the fill now ends and runs
       * to where the fill used to end.
       *
       * Restarted rather than extended — re-setting an attribute an element
       * already carries does not replay a CSS animation, which is the same
       * thing the stage's beats do and for the same reason. Two hits in
       * consecutive turns each get their own fade.
       */
      shadow.style.left = `${fraction * 100}%`;
      shadow.style.width = `${lost * 100}%`;
      delete shadow.dataset['fading'];
      /*
       * The slot goes on **before** the restart, not after.
       *
       * It selects the rule that sets this fade's delay and duration, and
       * changing either on a running animation re-times it mid-flight rather
       * than replaying it. Written first, the reflow below starts an animation
       * that already has its final timing — the same discipline the restart
       * itself exists for.
       */
      if (setOptions.slot === null || setOptions.slot === undefined) delete shadow.dataset['slot'];
      else shadow.dataset['slot'] = String(setOptions.slot);
      void shadow.offsetWidth;
      shadow.dataset['fading'] = 'true';
      return true;
    },
    cancel: clearChunk,
  };
}
