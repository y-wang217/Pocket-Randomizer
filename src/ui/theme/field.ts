/**
 * The field, projected onto `<html>` so the stylesheet can paint the world.
 * **Stage 4.11 Tier 3, D47.**
 *
 * Three attributes, all written from the battle screen's own update and read
 * only by CSS, exactly as `locale.ts` writes `data-locale`: `data-weather` and
 * `data-terrain` carry the *kind* (the mark's name, `rain`, `electric`) and
 * not the sim id, because the wash is one per mark by the D47 ruling and the
 * id is the tip's business; `data-weather-suppressed` is the second fact a
 * weather can carry, and the stylesheet halves the wash and stops its motion
 * on it.
 *
 * Cleared with `null` when the battle screen detaches and wherever the locale
 * is cleared, so a map or a summary never wears the last fight's rain. Nothing
 * under `core/` knows the attributes exist.
 */
import type { FieldUiView } from '../../core/battle/view';

export const WEATHER_ATTRIBUTE = 'data-weather';
export const TERRAIN_ATTRIBUTE = 'data-terrain';
export const SUPPRESSED_ATTRIBUTE = 'data-weather-suppressed';

/** Write the board's state onto a root element, or clear it when there is none. */
export function applyField(field: FieldUiView | null, root: HTMLElement = document.documentElement): void {
  const weather = field?.weather?.kind ?? null;
  const terrain = field?.terrain?.kind ?? null;
  if (weather) root.setAttribute(WEATHER_ATTRIBUTE, weather);
  else root.removeAttribute(WEATHER_ATTRIBUTE);
  if (terrain) root.setAttribute(TERRAIN_ATTRIBUTE, terrain);
  else root.removeAttribute(TERRAIN_ATTRIBUTE);
  if (weather && field?.suppressed) root.setAttribute(SUPPRESSED_ATTRIBUTE, 'true');
  else root.removeAttribute(SUPPRESSED_ATTRIBUTE);
}

/** What the root currently says, or nulls. */
export function currentField(root: HTMLElement = document.documentElement): { weather: string | null; terrain: string | null; suppressed: boolean } {
  return {
    weather: root.getAttribute(WEATHER_ATTRIBUTE),
    terrain: root.getAttribute(TERRAIN_ATTRIBUTE),
    suppressed: root.getAttribute(SUPPRESSED_ATTRIBUTE) === 'true',
  };
}
