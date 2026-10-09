/**
 * Replay a card battle log headless and print it round by round, in words:
 * where the units were placed, then the board, the intents and the hand each
 * round opens on, the plan in the order it resolves, and everything that
 * happened when it was committed.
 *
 *   npm run cards:narrate -- <log.json>
 *
 * The log alone records only the player's decisions. The hands, the enemies'
 * rolled starting steps and every outcome come from replaying it, which is
 * what this does. The reading guide is `docs/handoff/card-battle-log-reading.md`.
 */
import { readFileSync } from 'node:fs';

import { CARDS } from '../src/cardData/cards';
import { ENCOUNTERS } from '../src/cardData/encounters';
import { ENEMIES } from '../src/cardData/enemies';
import { RULES } from '../src/cardData/rules';
import { UNITS } from '../src/cardData/units';
import { createBattle, gradeTotal } from '../src/core/cards/create';
import type { Pos } from '../src/core/cards/defs';
import type { BattleEvent } from '../src/core/cards/events';
import { type BattleLog, CARD_ENGINE_VERSION, formatReadout, summarize } from '../src/core/cards/log';
import type { Action, BattleState, Intent } from '../src/core/cards/state';
import { step } from '../src/core/cards/step';

const at = (p: Pos | null): string => (p ? `L${p.lane}C${p.col}` : 'off the board');
const tiles = (ps: readonly Pos[]): string => ps.map(at).join(' ');

function narrate(log: BattleLog): string[] {
  if (log.engineVersion !== CARD_ENGINE_VERSION) {
    throw new Error(`card engine version mismatch: the log was written by ${log.engineVersion}, this build is ${CARD_ENGINE_VERSION}`);
  }
  const created = createBattle(log.encounterId, log.seed);
  if (!created.ok) throw new Error(`the log names an unknown encounter: ${log.encounterId}`);
  let s: BattleState = created.state;
  const out: string[] = [];
  const card = (iid: string): string => `${iid} ${CARDS[s.cards[iid]!.def]!.name}`;
  const who = (id: string): string => {
    const unit = s.units.find((u) => u.id === id);
    if (unit) return `${id} ${UNITS[unit.id].name}`;
    const enemy = s.enemies.find((e) => e.id === id);
    return enemy ? `${id} ${ENEMIES[enemy.def].name}` : id;
  };
  const intent = (i: Intent | null): string => {
    if (!i || i.act === 'none') return 'waits';
    if (i.act === 'shield') return `Shield ${i.n} (self)`;
    return `${i.act[0]!.toUpperCase()}${i.act.slice(1)} ${i.n} on ${tiles(i.tiles)}`;
  };
  const board = (title = s.wave > 0 ? `WAVE ${s.wave + 1} ROUND ${s.round}` : `ROUND ${s.round}`): void => {
    out.push('', title);
    for (const u of s.units) {
      out.push(u.fainted
        ? `  ${who(u.id)}: fainted`
        : `  ${who(u.id)} at ${at(u.pos)}  HP ${u.hp}/${u.maxHp}  base shield ${u.baseShield}  MP ${u.mp}`);
    }
    for (const e of s.enemies) {
      if (!e.pos) continue;
      const shield = e.shield ? `  shield ${e.shield}` : '';
      const telegraph = s.phase === 'deploy' ? '' : `  telegraphs: ${intent(e.intent)}`;
      out.push(`  ${who(e.id)} at ${at(e.pos)}  HP ${e.hp}  base shield ${e.baseShield}${shield}${telegraph}`);
    }
    out.push(`  hand: ${s.piles.hand.map(card).join(', ')}`);
  };
  const choice = (a: Extract<Action, { type: 'select' }>): string => {
    const c = a.choice;
    if (!c) return '';
    if (c.unit && c.tile) return ` -> moves ${who(c.unit)} to ${at(c.tile)}`;
    if (c.unit) return ` -> on ${who(c.unit)}`;
    return c.tile ? ` -> ${at(c.tile)}` : '';
  };
  // A friendly fire event names the Blast; the damage line after it says so.
  let friendly: string | null = null;
  const event = (e: BattleEvent): string | null => {
    switch (e.t) {
      case 'friendlyFire':
        friendly = CARDS[s.cards[e.card]!.def]!.name;
        return null;
      case 'planPruned': return `${who(e.unit)} has fainted: ${card(e.card)} is not played`;
      case 'played': return `${who(e.unit)} plays ${card(e.card)}`;
      case 'moved': return `  ${who(e.unit)} moves ${at(e.from)} -> ${at(e.to)}`;
      case 'converted': return `  Gunner ability: the Strike becomes a Pierce`;
      case 'fizzled': return `  fizzles (${e.why === 'targetGone' ? 'target gone' : 'nothing to hit'})`;
      case 'damaged': {
        const parts = [e.shield && `shield -${e.shield}`, e.baseShield && `base shield -${e.baseShield}`, e.hp && `HP -${e.hp}`].filter(Boolean);
        const from = friendly ? ` from ${friendly} (friendly fire)` : '';
        friendly = null;
        return `  ${who(e.target)} takes ${e.amount}${from}: ${parts.join(', ') || 'nothing left to take'}`;
      }
      case 'shielded': return `  ${who(e.unit)} gains shield ${e.amount}`;
      case 'defeated': return `  ${who(e.enemy)} is defeated`;
      case 'fainted': return `  ${who(e.unit)} FAINTS; its cards leave the battle (${e.removed.join(' ')})`;
      case 'mpGained': return e.source === 'card' ? `  ${who(e.unit)} +${e.amount} MP` : null;
      case 'drawQueued': return `  next hand gets +${e.n} card not owned by this unit`;
      case 'enemyActed': return e.act === 'shield' ? null : `${who(e.enemy)} acts: ${e.act} ${e.n}`;
      case 'enemyMissed': return `  misses: nobody on the lit tiles`;
      case 'enemyMoved': return `${who(e.enemy)} ${e.rule}s ${at(e.from)} -> ${at(e.to)}`;
      case 'enemyWaited': return `${who(e.enemy)} stays put (${{ noLane: 'no lane to hunt into', blocked: 'blocked', limit: 'at its advance limit' }[e.why]})`;
      case 'reshuffled': return `(discard pile shuffled back into the draw pile)`;
      case 'extraDrew': return `(Need Help: extra card ${card(e.card)})`;
      case 'waveStarted': return `WAVE ${e.wave + 1} ARRIVES: HP carries over; shields, MP and the deck start again`;
      case 'won': return 'WON';
      case 'lost': return `LOST (${e.why === 'allFainted' ? 'every unit fainted' : 'round cap'})`;
      default: return null;
    }
  };

  out.push(`seed ${log.seed}  encounter ${log.encounterId} (grade ${gradeTotal(ENCOUNTERS[log.encounterId]!)})  deck ${log.deckId}  engine ${log.engineVersion}`);
  out.push(`enemy starting steps (rolled from the seed): ${s.enemies.map((e) => `${e.id} step ${e.step + 1} of ${ENEMIES[e.def].script.steps.length}`).join(', ')}`);
  // Opening grace and Fast: how each enemy's starting step was chosen.
  for (const e of s.enemies) {
    const wave = e.wave > 0 ? ` (wave ${e.wave + 1})` : '';
    if (ENEMIES[e.def].fast) out.push(`${who(e.id)} is Fast: starts on an attack step${wave}`);
    else if (RULES.openingGrace) out.push(`grace: ${e.id} starts on a setup step${wave}`);
  }
  board('DEPLOY (the units on their default tiles; the enemies have not moved yet)');
  let plan: string[] = [];
  log.actions.forEach((a, index) => {
    const result = step(s, a);
    if (!result.ok) throw new Error(`the log does not replay: action ${index} (${JSON.stringify(a)}) refused: ${result.reason}`);
    if (a.type === 'place') out.push(`  places ${who(a.unit)} on ${at(a.tile)}${result.events.length > 1 ? ', swapping' : ''}`);
    if (a.type === 'start') {
      s = result.state;
      board();
      return;
    }
    if (a.type === 'select') plan.push(`  ${plan.length + 1}. ${card(a.card)} by ${who(a.unit)}${choice(a)}`);
    if (a.type === 'unselect') plan.push(`  (takes back plan slot ${a.planIndex + 1})`);
    if (a.type === 'commit') {
      out.push('  plan, in the order it resolves:', ...(plan.length ? plan : ['  (nothing: End Turn with an empty plan)']));
      out.push('  what happened:');
      // Shields clearing and MP ticking happen every round; the board shows their result.
      const enemyShields = result.events.filter((e) => e.t === 'shielded' && s.enemies.some((x) => x.id === e.unit));
      for (const e of result.events) {
        if (e.t === 'roundStarted') break;
        const line = enemyShields.includes(e) ? `${who((e as { unit: string }).unit)} shields itself` : event(e);
        if (line) out.push(`    ${line}`);
      }
      const after = result.events.slice(result.events.findIndex((e) => e.t === 'roundStarted') + 1);
      for (const e of after) {
        const line = e.t === 'reshuffled' || e.t === 'extraDrew' ? event(e) : null;
        if (line) out.push(`    ${line}`);
      }
      plan = [];
      s = result.state;
      if (s.phase === 'plan') board();
      if (s.phase === 'deploy') board(`WAVE ${s.wave + 1} DEPLOY (the units back on their default tiles)`);
    } else {
      s = result.state;
    }
  });
  return out;
}

const file = process.argv.slice(2).find((arg) => arg !== '--');
if (!file) {
  console.error('usage: npm run cards:narrate -- <log.json>');
  process.exit(2);
}
try {
  const log = JSON.parse(readFileSync(file, 'utf8')) as BattleLog;
  console.log([...narrate(log), '', formatReadout(summarize(log))].join('\n'));
} catch (error) {
  console.error(`cards:narrate: ${(error as Error).message}`);
  process.exit(1);
}
