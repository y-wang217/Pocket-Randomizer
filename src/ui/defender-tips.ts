/**
 * Defender Mode v0's inspect panels. **Bible Rev 24, D99 and D101.**
 *
 * Four kinds, each answered from a table or a registered Pokemon, never from
 * copy written into a screen (R5):
 *
 *   - `badge:<Fire|Psychic|Flying>`, any badge mark: the badge's name, what it
 *     does, and that it is the gym-type members' only.
 *   - `consumable:<id>`, a consumable's card or bag row: name, effect line, rule.
 *   - `trade-offer:<key>`, a trade card's offered mon: its starter card.
 *   - `trade-ask:<key>`, a trade card's asked-for member: its party row.
 *
 * A trade's two Pokemon are not table rows, so the card that draws them
 * registers each here and carries the key; the registry holds the last few
 * hundred, which is more than any screen draws.
 */
import { BADGE_COPY, BADGE_SCOPE, CONSUMABLE_COPY, CONSUMABLE_RULE } from '../data/defenderCopy';
import { consumableById } from '../data/consumables';
import type { PokemonSpec, PokemonState } from '../core/types';
import { DEFAULT_TUNING } from '../data/tuning';
import { el } from './dom';
import { memberCardContents } from './member-card';
import { starterInspectCard } from './screens/starter-select';

const offers = new Map<string, { spec: PokemonSpec; gymType: string | null }>();
const asks = new Map<string, PokemonState>();
let counter = 0;
const LIMIT = 400;

function remember<T>(map: Map<string, T>, value: T): string {
  const key = String(counter++);
  map.set(key, value);
  if (map.size > LIMIT) map.delete(map.keys().next().value as string);
  return key;
}

/** Register a trade's offered mon; returns the key its `trade-offer:` tip carries. */
export function registerTradeOffer(spec: PokemonSpec, gymType: string | null): string {
  return remember(offers, { spec, gymType });
}

/** Register a trade's asked-for member; returns the key its `trade-ask:` tip carries. */
export function registerTradeAsk(member: PokemonState): string {
  return remember(asks, member);
}

function panel(title: string): HTMLElement {
  const body = el('div', 'tip__body');
  const heading = el('h3', 'tip__title');
  heading.textContent = title;
  body.append(heading);
  return body;
}

function line(text: string, className: string): HTMLElement {
  const paragraph = el('p', className);
  paragraph.textContent = text;
  return paragraph;
}

export function renderBadgeTip(type: string): HTMLElement | null {
  const copy = BADGE_COPY[type];
  if (!copy) return null;
  const body = panel(copy.name);
  body.append(line(copy.effect, 'tip__text'), line(BADGE_SCOPE, 'tip__note'));
  return body;
}

export function renderConsumableTip(id: string): HTMLElement | null {
  const entry = consumableById(id);
  if (!entry) return null;
  const body = panel(entry.name);
  body.append(line(CONSUMABLE_COPY[id] ?? '', 'tip__text'), line(CONSUMABLE_RULE, 'tip__note'));
  return body;
}

export function renderTradeOfferTip(key: string): HTMLElement | null {
  const offer = offers.get(key);
  if (!offer) return null;
  const body = el('div', 'tip__body tip__body--card');
  body.append(starterInspectCard(offer.spec, offer.gymType));
  return body;
}

export function renderTradeAskTip(key: string): HTMLElement | null {
  const member = asks.get(key);
  if (!member) return null;
  const body = el('div', 'tip__body tip__body--card');
  body.append(memberCardContents(member, { holding: member.item ?? null, tuning: DEFAULT_TUNING, readout: true }));
  return body;
}
