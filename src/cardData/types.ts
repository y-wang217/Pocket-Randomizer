/**
 * The card types. Carried by the slice and read by nothing in it yet: a card's
 * type is `null` until the author's typed card list arrives
 * (`docs/spec/gymrun-card-battle-engine-rulings.md`).
 */
import type { TypeId } from '../core/cards/defs';

export const CARD_TYPES: readonly TypeId[] = ['fire', 'plasma', 'water'];
