/**
 * The journey vignettes. **The map calm-down and journey vignettes patch,
 * bible Rev 31, D113** (`docs/spec/gymrun-patch-map-calm-down-and-journey-vignettes.md`,
 * section 5's *Vignette* row).
 *
 * A vignette is a beat between screens: a crop of the current locale's map
 * painting, one sprite, and a caption of at most five words, saying what kind
 * of moment the player is entering. It plays after a map commit (keyed to the
 * kind entered), on the gym's entry, and on the return to the map after a
 * battle, a shop or an event. The same caption reads differently in a cave
 * and on a shore because the painting under it is the region's own.
 *
 * ## What it may never do
 *
 * - **Block input.** A tap ends it at once, and the tap that ends it reaches
 *   nothing under it: the pointerdown is taken on the layer, and the click
 *   the browser sends after it is swallowed once, at the window, before any
 *   screen sees it. The beat underneath was the bug the end-of-battle hold
 *   found (its tap was never guarded); this one is.
 * - **Forecast.** It plays only after the choice, and says only the kind,
 *   identical for every node of it (`data/vignetteCopy.ts`).
 * - **Move.** Under `prefers-reduced-motion` the frame is still for the same
 *   hold; the stylesheet keys its entrance off `data-still`.
 * - **Run headless.** Nothing under `core/` imports this; `playRun` under
 *   Node never reaches the app, and the timer is the app's.
 *
 * The setting in `ui/settings.ts` turns every beat off; `play` then does what
 * it would have done beneath the beat and resolves at once.
 */
import type { LocaleId } from '../data/locales';
import { DEFAULT_DISPLAY_TUNING } from '../data/displayTuning';
import { VIGNETTE_CAPTIONS, type VignetteMoment } from '../data/vignetteCopy';
import { applyBackdrop, assetIcon } from './assets/manifest';
import { el } from './dom';
import { getVignettes } from './settings';
import { prefersReducedMotion } from './theme/motion';

export interface VignetteScene {
  moment: VignetteMoment;
  /** The region whose painting the beat stands in, or none (the flat tint). */
  locale: LocaleId | null;
  /**
   * Who the moment is about, where there is someone: a trainer's or the
   * boss's sprite, the lead's for rest and the return. None, the moment's own
   * drawing from the manifest, or its lettered chip where none resolves.
   */
  sprite?: HTMLElement | null;
}

export interface Journey {
  /**
   * Play one beat over the frame. `beneath` runs once the beat covers the
   * frame, so the screen it leads to is already drawn when the beat lifts.
   * Resolves when the beat is over: its hold, a tap, a key, or `cancel`.
   * Never rejects.
   */
  play(scene: VignetteScene, beneath?: () => void): Promise<void>;
  /** End any beat in progress, as a tap would. For an abandoned run. */
  cancel(): void;
  /** Whether a beat is on the frame now. */
  playing(): boolean;
}

/**
 * The journey, mounted on `host`, the frame. One beat at a time: a beat asked
 * for while one plays ends the first, so two can never stack.
 */
export function createJourney(host: HTMLElement, holdMs: () => number = () => DEFAULT_DISPLAY_TUNING.vignetteMs): Journey {
  let finish: (() => void) | null = null;

  const play = (scene: VignetteScene, beneath?: () => void): Promise<void> => {
    finish?.();
    if (getVignettes() === 'off') {
      beneath?.();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const layer = renderVignette(scene);
      layer.dataset['still'] = String(prefersReducedMotion());
      layer.style.setProperty('--vignette-duration', `${Math.max(0, holdMs())}ms`);

      let timer: ReturnType<typeof setTimeout> | null = null;
      const end = (): void => {
        if (finish !== end) return;
        finish = null;
        if (timer !== null) clearTimeout(timer);
        layer.removeEventListener('pointerdown', onPointer, true);
        globalThis.removeEventListener('keydown', onKey, true);
        layer.remove();
        resolve();
      };
      /*
       * The tap that skips. Taken in the capture phase on the layer, which
       * covers the frame, so no screen under it hears the pointerdown; then
       * the click that follows the same tap is swallowed once at the window,
       * because the layer is gone by the time the browser sends it and the
       * screen beneath would otherwise take it as a press.
       */
      const onPointer = (event: Event): void => {
        event.preventDefault();
        event.stopPropagation();
        swallowNextClick();
        end();
      };
      const onKey = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        end();
      };
      layer.addEventListener('pointerdown', onPointer, true);
      // A click with no pointerdown before it (a synthetic one, a keyboard's)
      // ends the beat the same way and goes no further.
      layer.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        end();
      });
      globalThis.addEventListener('keydown', onKey, true);

      finish = end;
      host.append(layer);
      beneath?.();
      timer = setTimeout(end, Math.max(0, holdMs()));
    });
  };

  return {
    play,
    cancel: () => finish?.(),
    playing: () => finish !== null,
  };
}

/**
 * Swallow the next click anywhere, once. The tap that ended a beat sends its
 * click after the layer has gone; this is what keeps it off the screen the
 * beat uncovered. A safety timer drops the guard if no click comes (a touch
 * the browser decided was a scroll), so a later, deliberate tap is never
 * eaten.
 */
function swallowNextClick(): void {
  const swallow = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
    drop();
  };
  const drop = (): void => {
    globalThis.removeEventListener('click', swallow, true);
    clearTimeout(guard);
  };
  globalThis.addEventListener('click', swallow, true);
  const guard = setTimeout(drop, 600);
}

/**
 * One beat's layer: the region's painting, the sprite, the caption. Exported
 * for the tests and the gallery, which draw it without the timer.
 */
export function renderVignette(scene: VignetteScene): HTMLElement {
  const layer = el('div', 'vignette');
  layer.dataset['moment'] = scene.moment;
  layer.setAttribute('role', 'status');
  layer.setAttribute('aria-live', 'polite');

  // A crop of the locale's map painting: the same drawing the map stands
  // on, so the beat is set in the region the player is walking.
  const stage = el('div', 'vignette__stage');
  applyBackdrop(stage, scene.locale ? `map-backdrop:${scene.locale}` : null);
  stage.style.setProperty('--map-scrim', String(DEFAULT_DISPLAY_TUNING.mapScrimOpacity));

  const figure = el('div', 'vignette__sprite');
  figure.dataset['moment'] = scene.moment;
  figure.append(scene.sprite ?? assetIcon(`vignette:${scene.moment}`));

  const caption = el('p', 'vignette__caption');
  caption.textContent = VIGNETTE_CAPTIONS[scene.moment];

  stage.append(figure);
  layer.append(stage, caption);
  return layer;
}
