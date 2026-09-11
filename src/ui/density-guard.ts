/**
 * The tutorial's hold on the density mode. **Density modes patch, Part 5,
 * as ruling 6 shaped it: per screen, not per run.**
 *
 * The 29 coach marks were written against Detailed, and they position from
 * live geometry: a mark whose anchor is folded away in Pocket does not
 * mis-position, it is dropped without a trace (`ui/tutorial.ts`,
 * `anchorFor`, keeps only painted anchors). So while a screen still has
 * unseen marks, the root wears Detailed — applied *before* the marks look
 * for their anchors, which is why this wraps `showFor` rather than watching
 * the layer — and the moment nothing is showing the stored mode is back. A
 * Pocket player sees Detailed exactly as long as a first visit's marks are
 * up, and their own mode on every screen whose marks are done or skipped.
 *
 * The stored preference is never written here: `ui/settings.ts` owns it and
 * the picker in the drawer writes it. This decides only what the root shows,
 * and it reads the same `isOpen` the drawer reads. Presentation only.
 */
import type { TutorialScreen } from '../data/tutorial';
import { getDensity, onSettingsChange, tutorialDue } from './settings';
import { applyDensity } from './theme/density';
import type { TutorialLayer } from './tutorial';

export interface DensityGuard {
  /**
   * Show `screen`'s marks through the layer, with Detailed on the root
   * first when the screen is due. Returns what the layer returns.
   */
  showFor(screen: TutorialScreen, within: ParentNode): number;
  /** Write the root: Detailed while marks are up, the stored mode otherwise. */
  paint(): void;
  /** Detach from the settings. */
  stop(): void;
}

export function createDensityGuard(tutorial: Pick<TutorialLayer, 'isOpen' | 'showFor'>): DensityGuard {
  const paint = (): void => {
    applyDensity(tutorial.isOpen() ? 'detailed' : getDensity());
  };
  // Every change to the store — the picker, a mark finishing, Skip, a replay
  // — lands here, and the answer is the same question each time.
  const stop = onSettingsChange(paint);
  paint();
  return {
    showFor(screen, within) {
      // Due, not "has marks": a screen already seen keeps the player's mode
      // through its visit, and a skipped tutorial never forces anything.
      if (tutorialDue(screen)) applyDensity('detailed');
      const shown = tutorial.showFor(screen, within);
      paint();
      return shown;
    },
    paint,
    stop,
  };
}
