/**
 * The locale, projected onto `<html>` so the stylesheet can paint the world.
 *
 * Stage V1. One attribute, `data-locale`, set from the same projection the map
 * uses to name the region (`localeOf(state)`), on every state transition, so
 * a segment start, a gym battle inside that segment and a resumed run all
 * arrive at the same answer by the same route. The summary clears it: the run
 * summary is locale neutral.
 *
 * Nothing under `core/` knows the attribute exists. It is written from the
 * app's `onState` hook and read only by CSS.
 */
import type { LocaleId } from '../../data/locales';

export const LOCALE_ATTRIBUTE = 'data-locale';

/** Write the locale onto a root element, or clear it when there is none. */
export function applyLocale(locale: LocaleId | null, root: HTMLElement = document.documentElement): void {
  if (locale) root.setAttribute(LOCALE_ATTRIBUTE, locale);
  else root.removeAttribute(LOCALE_ATTRIBUTE);
}

/** What the root currently says, or null. */
export function currentLocale(root: HTMLElement = document.documentElement): string | null {
  return root.getAttribute(LOCALE_ATTRIBUTE);
}
