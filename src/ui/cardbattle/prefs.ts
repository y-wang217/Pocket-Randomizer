/**
 * The card battle sandbox's two settings: its language and its palette.
 * Saved on this device only, under their own key, apart from the run save and
 * from the app's own settings: the sandbox writes nothing into either
 * (`docs/spec/gymrun-patch-card-battle-accessibility.md`).
 *
 * Every access is guarded, as `ui/storage.ts` guards the run log: a browser
 * that refuses storage plays in English on the standard palette.
 */
import { isCardLanguage, type CardLanguage } from '../../cardData/copy';

export const CARD_PALETTES = ['standard', 'tritan'] as const;
export type CardPalette = (typeof CARD_PALETTES)[number];

export interface CardPrefs {
  language: CardLanguage;
  palette: CardPalette;
}

export const DEFAULT_CARD_PREFS: CardPrefs = { language: 'en', palette: 'standard' };

const KEY = 'gymrun.cardbattle.prefs';

/** What a stored value holds, field by field; anything unreadable is the default. */
export function readCardPrefs(value: unknown): CardPrefs {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  return {
    language: isCardLanguage(raw['language']) ? raw['language'] : DEFAULT_CARD_PREFS.language,
    palette: (CARD_PALETTES as readonly unknown[]).includes(raw['palette']) ? (raw['palette'] as CardPalette) : DEFAULT_CARD_PREFS.palette,
  };
}

export function loadCardPrefs(): CardPrefs {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    return readCardPrefs(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_CARD_PREFS };
  }
}

export function saveCardPrefs(prefs: CardPrefs): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Non-fatal: the setting holds until the sandbox closes.
  }
}
