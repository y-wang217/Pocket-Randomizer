/**
 * A committed round as a list of steps, for the sandbox to play back and to
 * list in its round log. **Card battle sandbox, the play order patch**
 * (`docs/spec/gymrun-patch-card-battle-neutral-attack.md`).
 *
 * The engine resolves a round in one call and hands back the final state and
 * every event in the order it happened. This walks those events over a copy
 * of the state the round began from, so each step carries the board as it
 * stood once that step was done: the screen can draw the round one card and
 * one enemy at a time without the engine ever exposing an intermediate state.
 * It reads no rule. Every number on a step is one an event already carried.
 *
 * No DOM here; the sandbox does the drawing.
 */
import { CARDS } from '../../cardData/cards';
import { CARD_COPY } from '../../cardData/copy';
import { ENEMIES } from '../../cardData/enemies';
import type { Pos } from '../../core/cards/defs';
import type { BattleEvent } from '../../core/cards/events';
import { previewPlay } from '../../core/cards/preview';
import type { BattleState, Intent, TargetId } from '../../core/cards/state';

export type StepKind = 'card' | 'enemy' | 'move' | 'next' | 'round' | 'end';

export interface StepHit {
  id: TargetId;
  /** HP lost. */
  hp: number;
  /** Damage a shield or a base shield took instead. */
  blocked: number;
  /** Where it stood when hit, so a hit that defeats still shows where it landed. */
  pos: Pos | null;
}

export interface Step {
  kind: StepKind;
  /** The board once this step is done. */
  state: BattleState;
  /** The unit or enemy acting. */
  actor?: TargetId;
  /** The attack's kind, for the tiles' flash. */
  act?: Intent['act'];
  /** Tiles the step's attack lit. */
  tiles: Pos[];
  hits: StepHit[];
  moves: { id: TargetId; from: Pos; to: Pos }[];
  title: string;
  lines: string[];
  /** Listed in the round log, but not worth a beat of the playback. */
  quiet: boolean;
}

export interface RoundRecord {
  round: number;
  /** The state the round was committed from. */
  before: BattleState;
  steps: Step[];
}

const ACT_WORD: Record<Exclude<Intent['act'], 'none'>, string> = {
  strike: CARD_COPY.keyword.strike,
  pierce: CARD_COPY.keyword.pierce,
  slash: CARD_COPY.keyword.slash,
  shield: CARD_COPY.keyword.shield,
};

function actWord(act: Intent['act'], n: number): string {
  return act === 'none' ? CARD_COPY.intentNone : `${ACT_WORD[act]} ${n}`;
}

/** A unit by its letter, an enemy by its name and spawn number. */
export function whoOf(state: BattleState, id: string): string {
  if (state.units.some((u) => u.id === id)) return id;
  const enemy = state.enemies.find((e) => e.id === id);
  return enemy ? `${ENEMIES[enemy.def].name} ${enemy.spawnIndex + 1}` : id;
}

/**
 * A move as the screen shows it. Lanes run left to right; column 1, the
 * player's back edge, is at the bottom.
 */
export function wayOf(from: Pos, to: Pos): string {
  const w = CARD_COPY.log.way;
  const parts: string[] = [];
  const dLane = to.lane - from.lane;
  const dCol = to.col - from.col;
  if (dLane !== 0) parts.push(`${dLane < 0 ? w.left : w.right} ${Math.abs(dLane)}`);
  if (dCol !== 0) parts.push(`${dCol > 0 ? w.up : w.down} ${Math.abs(dCol)}`);
  return parts.join(', ');
}

/** The steps of one committed round, `before` being the state it was committed from. */
export function roundSteps(before: BattleState, events: readonly BattleEvent[], after: BattleState): Step[] {
  const L = CARD_COPY.log;
  const draft = structuredClone(before);
  const steps: Step[] = [];
  // Cast so the checker does not narrow it to `null`: `begin` reassigns it.
  let open = null as Step | null;
  const roundMp: { step?: Step; units: string[] } = { units: [] };

  const begin = (kind: StepKind, title: string, extra: Partial<Step> = {}): Step => {
    open = { kind, state: draft, tiles: [], hits: [], moves: [], title, lines: [], quiet: false, ...extra };
    steps.push(open);
    return open;
  };
  /** The open step, or a fresh one of `kind` if none is open or it is another kind. */
  const current = (kind: StepKind, title: string): Step => (open && open.kind === kind ? open : begin(kind, title));
  const who = (id: string): string => whoOf(draft, id);
  const unitOf = (id: string) => draft.units.find((u) => u.id === id);
  const enemyOf = (id: string) => draft.enemies.find((e) => e.id === id);
  const target = (id: string) => unitOf(id) ?? enemyOf(id);

  for (const event of events) {
    switch (event.t) {
      case 'played': {
        const index = draft.plan.findIndex((p) => p.card === event.card);
        const def = CARDS[draft.cards[event.card]!.def]!;
        // The forecast the plan showed for this card, on the board it resolves on.
        const planned = before.plan.findIndex((p) => p.card === event.card);
        const attack = planned >= 0 ? previewPlay(before, before.plan[planned]!, planned).attack : null;
        begin('card', L.plays(event.unit, def.name), {
          actor: event.unit,
          ...(attack ? { act: attack.act === 'blast' ? 'strike' : attack.act, tiles: attack.tiles.map((t) => t.pos) } : {}),
        });
        if (index >= 0) draft.plan.splice(index, 1);
        draft.piles.hand = draft.piles.hand.filter((c) => c !== event.card);
        const unit = unitOf(event.unit);
        if (unit) unit.mp = Math.max(0, unit.mp - def.cost);
        break;
      }
      case 'moved': {
        const unit = unitOf(event.unit);
        if (unit) unit.pos = { ...event.to };
        const step = current('card', '');
        step.moves.push({ id: event.unit, from: event.from, to: event.to });
        step.lines.push(L.moves(who(event.unit), wayOf(event.from, event.to)));
        break;
      }
      case 'converted':
        current('card', '').lines.push(L.converted);
        if (open?.kind === 'card') open.act = 'pierce';
        break;
      case 'fizzled':
        current('card', '').lines.push(event.why === 'targetGone' ? L.fizzledGone : L.fizzledNothing);
        break;
      case 'damaged': {
        const hit = target(event.target);
        const pos = hit?.pos ? { ...hit.pos } : null;
        if (hit) {
          hit.shield -= event.shield;
          hit.baseShield -= event.baseShield;
          hit.hp -= event.hp;
        }
        const step = open ?? begin('card', '');
        step.hits.push({ id: event.target, hp: event.hp, blocked: event.shield + event.baseShield, pos });
        const parts = [
          event.shield > 0 ? L.absorbed.shield(event.shield) : '',
          event.baseShield > 0 ? L.absorbed.baseShield(event.baseShield) : '',
          event.hp > 0 ? L.absorbed.hp(event.hp) : '',
        ].filter(Boolean);
        step.lines.push([L.hit(who(event.target), event.amount), ...parts].join(' · '));
        break;
      }
      case 'shielded': {
        const to = target(event.unit);
        if (to) to.shield += event.amount;
        (open ?? begin('card', '')).lines.push(L.shielded(who(event.unit), event.amount));
        break;
      }
      case 'defeated': {
        const enemy = enemyOf(event.enemy);
        if (enemy) {
          enemy.pos = null;
          enemy.shield = 0;
          enemy.intent = null;
        }
        (open ?? begin('card', '')).lines.push(L.defeated(who(event.enemy)));
        break;
      }
      case 'fainted': {
        const unit = unitOf(event.unit);
        if (unit) {
          unit.fainted = true;
          unit.pos = null;
        }
        draft.plan = draft.plan.filter((p) => p.unit !== event.unit && p.choice?.unit !== event.unit);
        draft.piles.hand = draft.piles.hand.filter((c) => !event.removed.includes(c));
        (open ?? begin('card', '')).lines.push(L.fainted(who(event.unit)));
        break;
      }
      case 'mpGained': {
        const unit = unitOf(event.unit);
        if (unit) unit.mp += event.amount;
        if (event.source === 'card') current('card', '').lines.push(L.mp(event.unit, event.amount));
        else if (event.source === 'round') {
          roundMp.units.push(event.unit);
          roundMp.step ??= begin('round', '', { quiet: true });
          roundMp.step.title = L.roundMp(roundMp.units.join(', '));
        } else (open ?? begin('round', '')).lines.push(L.mp(event.unit, event.amount));
        break;
      }
      case 'drawQueued':
        current('card', '').lines.push(L.drawQueued(event.n));
        break;
      case 'shieldCleared': {
        const from = target(event.unit);
        if (from) from.shield = 0;
        const line = L.shieldDrops(who(event.unit), event.amount);
        // An enemy's own shield wears off as it acts; a unit's as the next round starts.
        if (enemyOf(event.unit)) {
          const enemy = enemyOf(event.unit)!;
          begin('enemy', L.acts(who(event.unit), actWord(enemy.intent?.act ?? 'none', enemy.intent?.n ?? 0)), { actor: event.unit }).lines.push(line);
        } else (open ?? begin('round', '')).lines.push(line);
        break;
      }
      case 'enemyActed': {
        const enemy = enemyOf(event.enemy);
        const tiles = enemy?.intent?.tiles.map((t) => ({ ...t })) ?? [];
        const title = L.acts(who(event.enemy), actWord(event.act, event.n));
        const step: Step = open && open.kind === 'enemy' && open.actor === event.enemy ? open : begin('enemy', title, { actor: event.enemy });
        step.title = title;
        step.act = event.act;
        step.tiles = tiles;
        break;
      }
      case 'enemyMissed':
        current('enemy', '').lines.push(L.missed);
        break;
      case 'enemyMoved': {
        const enemy = enemyOf(event.enemy);
        if (enemy) enemy.pos = { ...event.to };
        begin('move', L.moves(who(event.enemy), wayOf(event.from, event.to)), { actor: event.enemy }).moves.push({
          id: event.enemy,
          from: event.from,
          to: event.to,
        });
        break;
      }
      case 'enemyWaited':
        begin('move', L.waits(who(event.enemy)), { actor: event.enemy, quiet: true });
        break;
      case 'telegraphed': {
        const enemy = enemyOf(event.enemy);
        if (enemy) enemy.intent = { ...event.intent, tiles: event.intent.tiles.map((t) => ({ ...t })) };
        current('next', L.next).lines.push(L.telegraph(who(event.enemy), actWord(event.intent.act, event.intent.n)));
        break;
      }
      case 'roundStarted':
        draft.round = event.round;
        begin('round', L.round(event.round));
        break;
      case 'reshuffled':
        (open ?? begin('round', '')).lines.push(L.reshuffled);
        break;
      case 'won':
      case 'lost':
        begin('end', event.t === 'won' ? CARD_COPY.won : CARD_COPY.lost);
        break;
      default:
        break;
    }
    // Each step keeps its own picture of the board.
    if (open) open.state = structuredClone(draft);
  }
  // The last step shows the state the engine returned, whatever this walk missed.
  const last = steps.at(-1);
  if (last) last.state = after;
  return steps;
}
