/**
 * `checkInvariants`: what must hold after every step, as a list of breaches.
 * Empty is healthy. The fuzz gate runs it after every step of 2,000 battles.
 */
import { DECKS } from '../../cardData/cards';
import { RULES } from '../../cardData/rules';
import { cardDefOf, checkPlan, slotsOf } from './plan';
import type { BattleState, PileName, UnitId } from './state';
import { enemyTiles, inReach, zoneOf } from './zones';

const PILES: readonly PileName[] = ['draw', 'hand', 'discard', 'spent', 'removed', 'reserve'];

export function checkInvariants(s: BattleState): string[] {
  const out: string[] = [];

  const tiles = new Map<string, string>();
  const place = (id: string, side: 'player' | 'enemy', pos: { lane: number; col: number }): void => {
    const key = `${pos.lane},${pos.col}`;
    if (tiles.has(key)) out.push(`${id} shares ${key} with ${tiles.get(key)}`);
    tiles.set(key, id);
    if (!inReach(side, pos as never)) out.push(`${id} at ${key} is outside the ${side} reach`);
  };
  for (const u of s.units) {
    if (u.pos) place(u.id, 'player', u.pos);
    if (u.hp < 0) out.push(`${u.id} has negative HP`);
    if (u.fainted !== (u.pos === null)) out.push(`${u.id} fainted ${u.fainted} but pos ${JSON.stringify(u.pos)}`);
    if (u.mp < 0 || u.mp > RULES.mp.cap) out.push(`${u.id} MP ${u.mp} outside 0..${RULES.mp.cap}`);
    if (u.shield < 0 || u.baseShield < 0) out.push(`${u.id} has a negative shield`);
  }
  for (const e of s.enemies) {
    for (const t of enemyTiles(e)) place(e.id, 'enemy', t);
    if (e.hp < 0) out.push(`${e.id} has negative HP`);
    if (e.wave > s.wave) {
      if (e.pos !== null || e.intent !== null) out.push(`${e.id} of wave ${e.wave} is on the board in wave ${s.wave}`);
    } else if ((e.hp > 0) !== (e.pos !== null)) out.push(`${e.id} HP ${e.hp} but pos ${JSON.stringify(e.pos)}`);
    if (e.wave < s.wave && e.hp > 0) out.push(`${e.id} of wave ${e.wave} still stands in wave ${s.wave}`);
  }

  const all = PILES.flatMap((pile) => s.piles[pile]);
  // The deck, and any card an enemy grants (held in `reserve` until its wave arrives).
  const deckSize = (DECKS[s.deckId]?.cards.length ?? -1) + Object.values(s.cards).filter((c) => c.granted).length;
  if (all.length !== deckSize) out.push(`${all.length} cards across the piles, the battle holds ${deckSize}`);
  if (new Set(all).size !== all.length) out.push('a card is in two piles');

  const mp: Partial<Record<UnitId, number>> = {};
  const slots: Partial<Record<UnitId, number>> = {};
  for (const play of s.plan) {
    const def = cardDefOf(s, play.card);
    if (!def) {
      out.push(`planned ${play.card} is not a card`);
      continue;
    }
    mp[play.unit] = (mp[play.unit] ?? 0) + def.cost;
    slots[play.unit] = (slots[play.unit] ?? 0) + 1;
    if (def.effects.some((e) => e.k === 'grantMove') && play.choice?.unit) {
      const ally = play.choice.unit as UnitId;
      slots[ally] = (slots[ally] ?? 0) + 1;
    }
  }
  for (const u of s.units) {
    if ((slots[u.id] ?? 0) > slotsOf(u.id)) out.push(`${u.id} uses ${slots[u.id]} slots of ${slotsOf(u.id)}`);
    if ((mp[u.id] ?? 0) > u.mp) out.push(`${u.id} reserves ${mp[u.id]} MP of ${u.mp}`);
  }
  const plan = checkPlan(s, s.plan);
  if (!plan.ok) out.push(`plan illegal at ${plan.index}: ${plan.reason}`);
  if (s.phase !== 'plan' && s.plan.length > 0) out.push(`a battle in ${s.phase} holds a plan`);
  if (s.phase === 'deploy') {
    for (const u of s.units) if (u.pos && zoneOf(u.pos) !== RULES.deployZone) out.push(`${u.id} is deployed outside the ${RULES.deployZone}`);
    if (s.enemies.some((e) => e.intent)) out.push('an enemy telegraphs before the battle starts');
  }

  return out;
}
