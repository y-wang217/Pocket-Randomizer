/**
 * `commit`: one round, in the phase order of the prompt's section 3, as the
 * author amended it (`docs/spec/gymrun-patch-card-battle-neutral-attack.md`).
 *
 *   1-2. Every planned card in plan order, Moves and Command's included: the
 *      order the player made the plan is the order it plays. A card whose
 *      target is gone fizzles: it is still used and its MP is not refunded.
 *      A play by a unit that fainted earlier in the round (a Blast's friendly
 *      fire, R14) is pruned instead.
 *   3. Win check. Dead enemies never act.
 *   4. MP gain, capped.
 *   5-7. Enemy actions, moves and telegraph (`enemies.ts`).
 *   8. The next hand.
 *
 * The whole round resolves in this one call and returns every event, so the
 * UI never waits on an intermediate state.
 */
import { CARDS } from '../../cardData/cards';
import { ENEMIES } from '../../cardData/enemies';
import { RULES } from '../../cardData/rules';
import { enemyActions, enemyMovesAndTelegraph } from './enemies';
import type { Ctx } from './keywords';
import { gainMp, payFor, resolveEffects, resolveMove, retire } from './keywords';
import { abilitiesOf, cardDefOf, checkPlan, followUps, isMoveCard, livingEnemies, livingUnits, type StepResult, unitOf } from './plan';
import { shuffled, withStream } from './random';
import type { BattleState, PlannedPlay, UnitId } from './state';

/** The index in the plan of the first play that fills each unit's first slot. */
export function firstSlots(s: BattleState, plan: readonly PlannedPlay[]): Partial<Record<UnitId, number>> {
  const first: Partial<Record<UnitId, number>> = {};
  plan.forEach((play, index) => {
    const def = cardDefOf(s, play.card)!;
    const users = [play.unit];
    if (def.effects.some((e) => e.k === 'grantMove') && typeof play.choice?.unit === 'string') users.push(play.choice.unit as UnitId);
    for (const user of users) if (first[user] === undefined) first[user] = index;
  });
  return first;
}

/**
 * A copy of everything a round can change. The card instance table is fixed
 * once the battle is laid out, so the draft shares it; every other field is
 * copied, so the state the caller holds is never touched.
 */
export function draftOf(state: BattleState): BattleState {
  return {
    ...state,
    units: state.units.map((u) => ({ ...u, pos: u.pos && { ...u.pos }, pendingMp: u.pendingMp.map((g) => ({ ...g })) })),
    enemies: state.enemies.map((e) => ({
      ...e,
      pos: e.pos && { ...e.pos },
      conds: { ...e.conds },
      intent: e.intent && { ...e.intent, tiles: e.intent.tiles.map((t) => ({ ...t })) },
    })),
    piles: {
      draw: [...state.piles.draw],
      hand: [...state.piles.hand],
      discard: [...state.piles.discard],
      spent: [...state.piles.spent],
      removed: [...state.piles.removed],
      reserve: [...state.piles.reserve],
    },
    uses: { ...state.uses },
    plan: [...state.plan],
    pendingDraws: state.pendingDraws.map((d) => ({ ...d })),
  };
}

export function commit(state: BattleState): StepResult {
  if (state.phase !== 'plan') return { ok: false, state, reason: 'battleOver' };
  if (!checkPlan(state, state.plan).ok) return { ok: false, state, reason: 'breaksPlan' };

  const s = draftOf(state);
  const ctx: Ctx = { s, events: [{ t: 'committed', round: s.round }] };
  const plan = s.plan;
  s.plan = [];

  // B's ability reads its HP at the start of the turn and applies to the card
  // in its first slot (the author's card sheet: "first card played each turn
  // gains pierce if HP full (turn start)").
  const first = firstSlots(s, plan);
  const fullAtStart = Object.fromEntries(s.units.map((u) => [u.id, u.hp === u.maxHp])) as Record<UnitId, boolean>;
  const converts = (play: PlannedPlay, index: number): boolean =>
    first[play.unit] === index && fullAtStart[play.unit] && abilitiesOf(s, play.unit).some((a) => a.k === 'firstCardConverts');

  // 1 and 2. Every card, Moves included, in plan order.
  plan.forEach((play, index) => {
    if (s.phase !== 'plan') return;
    // A unit a Blast made faint earlier in the round plays nothing more: its
    // own cards left with it, and a Neutral it held stays in hand.
    if (unitOf(s, play.unit)?.fainted) {
      ctx.events.push({ t: 'planPruned', card: play.card, unit: play.unit, reason: 'fainted' });
      return;
    }
    const def = cardDefOf(s, play.card)!;
    if (isMoveCard(def)) {
      // A move card's follow-ups land after the move, from where the unit then stands (4b).
      playCard(ctx, play, () => {
        resolveMove(ctx, play, def);
        if (followUps(def).length > 0 && s.phase === 'plan') resolveEffects(ctx, play, def, converts(play, index));
      });
    } else playCard(ctx, play, () => resolveEffects(ctx, play, def, converts(play, index)));
  });

  // 3. Win check: the last enemy of a wave brings the next wave, of the last wave wins.
  if (livingEnemies(s).length === 0 && s.phase === 'plan') {
    if (s.enemies.some((e) => e.wave > s.wave)) {
      startWave(ctx, s.wave + 1);
      return { ok: true, state: s, events: ctx.events };
    }
    s.phase = 'won';
    ctx.events.push({ t: 'won' });
  }
  if (s.phase !== 'plan') return { ok: true, state: s, events: ctx.events };

  // 4. MP gain.
  for (const unit of livingUnits(s)) gainMp(ctx, unit, RULES.mp.gainPerRound, 'round');

  // 5. The enemies act; 6 and 7, they move and telegraph.
  enemyActions(ctx);
  if (s.phase !== 'plan') return { ok: true, state: s, events: ctx.events };
  enemyMovesAndTelegraph(ctx, true);

  // 8. The next hand.
  nextHand(ctx);
  return { ok: true, state: s, events: ctx.events };
}

/**
 * The next wave arrives (`RULES.betweenWaves`, the author's ruling of
 * 2026-10-11, `docs/spec/gymrun-card-run-shapes-prompt.md`). The cards reset
 * and nothing else does: each living unit keeps its HP, its base shield as
 * spent, its MP and any MP a card still owes it, and stays on its tile. Every
 * card a faint did not remove, Once cards included, is shuffled into a fresh
 * draw pile, in deck order first so the shuffle reads no history; extra draws
 * owed clear. The new wave spawns at once with no placement: the round count
 * starts again with round 1's hand, a card shield clears with it as at any
 * turn start (R3), and the wave makes its opening moves under grace.
 */
export function startWave(ctx: Ctx, wave: number): void {
  const { s } = ctx;
  s.wave = wave;
  s.plan = [];
  s.pendingDraws = [];
  for (const enemy of s.enemies) {
    if (enemy.wave === wave) enemy.pos = { ...enemy.spawn! };
  }
  const index = (iid: string): number => Number(iid.slice(1));
  // Equipment once used is gone for the run, so a new wave does not bring it back.
  const usedUp = (iid: string): boolean => CARDS[s.cards[iid]!.def]!.equipment === true;
  const gone = s.piles.spent.filter(usedUp);
  const deck = [...s.piles.draw, ...s.piles.hand, ...s.piles.discard, ...s.piles.spent.filter((iid) => !usedUp(iid))].sort((a, b) => index(a) - index(b));
  s.piles = { draw: withStream(s, (stream) => shuffled(stream, deck)), hand: [], discard: [], spent: gone, removed: s.piles.removed, reserve: s.piles.reserve };
  // Uses come back with the reshuffle (C4), but not on used equipment.
  for (const iid of Object.keys(s.uses)) if (!gone.includes(iid)) s.uses[iid] = CARDS[s.cards[iid]!.def]!.uses!;
  ctx.events.push({ t: 'waveStarted', wave });
  grantWave(ctx);
  s.round = 0;
  nextHand(ctx);
  if (s.phase !== 'plan') return;
  enemyMovesAndTelegraph(ctx, false);
}

/** The cards the arriving wave's enemies grant leave the reserve for the hand. */
export function grantWave(ctx: Ctx): void {
  const { s } = ctx;
  for (const enemy of s.enemies) {
    const def = ENEMIES[enemy.def];
    if (enemy.wave !== s.wave || !def.grants) continue;
    const iid = s.piles.reserve.find((c) => s.cards[c]!.def === def.grants);
    if (!iid) continue;
    s.piles.reserve = s.piles.reserve.filter((c) => c !== iid);
    s.piles.hand.push(iid);
    ctx.events.push({ t: 'granted', card: iid });
  }
}

function playCard(ctx: Ctx, play: PlannedPlay, resolve: () => void): void {
  const def = cardDefOf(ctx.s, play.card)!;
  payFor(unitOf(ctx.s, play.unit), def);
  ctx.events.push({ t: 'played', card: play.card, unit: play.unit });
  resolve();
  retire(ctx, play);
}

/** Draw `n` from the top of the draw pile, reshuffling the discard in when it runs out. */
function drawCards(ctx: Ctx, n: number): void {
  const { s } = ctx;
  let drawn: string[] = [];
  const flush = (): void => {
    if (drawn.length > 0) ctx.events.push({ t: 'drew', cards: drawn });
    drawn = [];
  };
  for (let i = 0; i < n; i++) {
    if (s.piles.draw.length === 0) {
      if (s.piles.discard.length === 0) break;
      flush();
      const count = s.piles.discard.length;
      s.piles.draw = withStream(s, (stream) => shuffled(stream, s.piles.discard));
      s.piles.discard = [];
      ctx.events.push({ t: 'reshuffled', count });
    }
    const card = s.piles.draw.shift()!;
    s.piles.hand.push(card);
    drawn.push(card);
  }
  flush();
}

/**
 * Phase 8. Round up, player Shield clears (R3), start-of-turn MP lands, the
 * unplayed hand is discarded, then a fresh hand and any extra draws owed.
 *
 * Need Help's extra card is the first card in the draw pile not owned by the
 * card's owner. The draw pile is never reshuffled for it; none there and the
 * extra draw fizzles (the author's ruling).
 */
export function nextHand(ctx: Ctx): void {
  const { s } = ctx;
  s.round += 1;
  ctx.events.push({ t: 'roundStarted', round: s.round });
  if (s.round > RULES.roundCap) {
    s.phase = 'lost';
    ctx.events.push({ t: 'lost', why: 'roundCap' });
    return;
  }

  for (const unit of s.units) {
    if (unit.shield === 0) continue;
    ctx.events.push({ t: 'shieldCleared', unit: unit.id, amount: unit.shield });
    unit.shield = 0;
  }
  // Stealth (Group B) and Cover (5a) wear off a turn at a time, with the card shield.
  for (const unit of s.units) {
    for (const key of ['stealth', 'cover'] as const) {
      const left = unit[key];
      if (left === undefined) continue;
      if (left > 1) unit[key] = left - 1;
      else delete unit[key];
    }
  }

  for (const unit of livingUnits(s)) {
    for (const ability of abilitiesOf(s, unit.id)) {
      if (ability.k === 'mpAtTurnStart') gainMp(ctx, unit, ability.n, 'ability');
    }
    const owed = unit.pendingMp.reduce((sum, grant) => sum + grant.n, 0);
    if (owed > 0) gainMp(ctx, unit, owed, 'focus');
    unit.pendingMp = unit.pendingMp.map((grant) => ({ ...grant, turns: grant.turns - 1 })).filter((grant) => grant.turns > 0);
  }

  // Retain: an unplayed copy stays, holding one of the hand's places.
  const kept = s.piles.hand.filter((iid) => CARDS[s.cards[iid]!.def]!.retain);
  const gone = s.piles.hand.filter((iid) => !kept.includes(iid));
  if (gone.length > 0) {
    ctx.events.push({ t: 'discarded', cards: gone });
    s.piles.discard.push(...gone);
  }
  s.piles.hand = kept;

  drawCards(ctx, Math.max(0, RULES.handSize - kept.length));

  for (const owed of s.pendingDraws) {
    for (let i = 0; i < owed.n; i++) {
      const index = s.piles.draw.findIndex((iid) => s.cards[iid]!.owner !== owed.owner);
      if (index < 0) {
        ctx.events.push({ t: 'extraDrawFizzled' });
        continue;
      }
      const [card] = s.piles.draw.splice(index, 1);
      s.piles.hand.push(card!);
      ctx.events.push({ t: 'extraDrew', card: card! });
    }
  }
  s.pendingDraws = [];
}
