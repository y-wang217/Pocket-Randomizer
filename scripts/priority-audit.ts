/**
 * The Release C interaction audit for the priority and speed aware AI.
 *
 *   npx vite-node scripts/priority-audit.ts [--seeds 20] [--prefix RETUNE]
 *
 * Release C's turn-order jiggle shows the player which side acted first, read
 * off the protocol. The AI now forecasts that order from `battle/speed.ts`,
 * an approximation. This script plays N seeds with the greedy AI on both
 * sides, records every turn the priority rule fired and what the AI expected,
 * then reads the same turns back through `readTurns` — the reader the jiggle
 * uses — and says whether the two agree.
 *
 * Any disagreement is a bug in the speed helper, never in Release C: the
 * jiggle reads the protocol and the helper is a forecast.
 *
 * Two readings per fired turn:
 *
 *   - **The move landed first.** The rule fired to get a priority move off
 *     before the foe's hit. Agreement is the AI's action carrying order 1 in
 *     its turn group — or, when the foe also used a priority move of the same
 *     or higher bracket, the turn being decided by Speed, which the helper
 *     predicted as "not first" and the protocol confirms.
 *   - **The forecast was right.** On every turn where both sides used
 *     bracket-0 moves, the helper's `first`/`second` should match the
 *     protocol's order; `unknown` matches either. This is the helper's
 *     accuracy over the run, the number that says how good the approximation
 *     is where it is not backed by a bracket.
 */
import { decide } from '../src/core/battle/ai';
import { movePriority, type BattleSession } from '../src/core/battle/driver';
import type { Policy } from '../src/core/battle/policy';
import { readTurns } from '../src/core/battle/turnOrder';
import { playRun, scriptedRunPolicy } from '../src/core/run';
import type { SideId } from '../src/core/types';

interface Recorded {
  battle: number;
  turn: number;
  side: SideId;
  branch: 'greedy' | 'priority-escape' | 'priority-kill';
  order: 'first' | 'second' | 'unknown';
  move: string | null;
  priority: number;
}

const args = process.argv.slice(2);
const seeds = Number(args[args.indexOf('--seeds') + 1] || 20);
const prefix = args.includes('--prefix') ? (args[args.indexOf('--prefix') + 1] ?? 'RETUNE') : 'RETUNE';

async function audit(seed: string) {
  const sessions: BattleSession[] = [];
  const recorded: Recorded[] = [];
  const recording = (side: SideId): Policy => async (view) => {
    const decision = decide(view);
    const move = decision.choice.kind === 'move' ? (view.moves.find((entry) => entry.slot === decision.choice.slot) ?? null) : null;
    recorded.push({
      battle: sessions.length - 1,
      turn: view.turn,
      side,
      branch: decision.branch,
      order: decision.order,
      move: move?.name ?? null,
      priority: move?.priority ?? 0,
    });
    return decision.choice;
  };
  await playRun(seed, scriptedRunPolicy(recording('p1')), undefined, {
    opponent: recording('p2'),
    onBattle: (session) => sessions.push(session),
  });

  let fired = 0;
  let firedAgree = 0;
  let firedIntoSwitch = 0;
  const disagreements: string[] = [];
  let forecast = 0;
  let forecastRight = 0;
  let forecastUnknown = 0;

  for (const entry of recorded) {
    const session = sessions[entry.battle];
    if (!session || entry.move === null) continue;
    const groups = readTurns(session.protocolFor('p1'), movePriority);
    // The view's turn is the turn about to be resolved by this decision.
    const group = groups.find((candidate) => candidate.turn === entry.turn);
    if (!group) continue;
    const mine = group.actions.find((action) => action.kind === 'move' && action.side === entry.side);
    const theirs = group.actions.find((action) => action.kind === 'move' && action.side !== entry.side);
    const theySwitched = group.actions.some((action) => action.kind === 'switch' && action.side !== entry.side);
    if (!mine || mine.kind !== 'move') continue;

    if (entry.branch !== 'greedy') {
      fired++;
      const theirBracket = theirs && theirs.kind === 'move' ? theirs.bracket : 0;
      // The move preceded the foe's attack: it went first, or nothing from the
      // foe's side attacked at all (a switch is order 1 and hits nobody; a
      // flinch or full paralysis leaves no `|move|` line). Or the foe matched
      // the bracket and the turn was Speed's to decide, which is what the
      // helper said (`second` or `unknown`) and what the protocol then shows.
      const beforeAnyHit = mine.order === 1 || !theirs || theySwitched;
      const agrees = beforeAnyHit || (theirBracket >= mine.bracket && entry.order !== 'first');
      if (agrees) {
        firedAgree++;
        if (theySwitched) firedIntoSwitch++;
      } else {
        disagreements.push(
          `${seed} battle ${entry.battle} turn ${entry.turn} ${entry.side} ${entry.branch}: ` +
            `${entry.move} (+${mine.bracket}) came ${mine.order === 1 ? 'first' : 'second'}, ` +
            `foe ${theirs && theirs.kind === 'move' ? `${theirs.move} (+${theirs.bracket})` : 'did not move'}, helper said ${entry.order}`,
        );
      }
    }

    if (theirs && theirs.kind === 'move' && mine.bracket === 0 && theirs.bracket === 0) {
      forecast++;
      if (entry.order === 'unknown') forecastUnknown++;
      else if ((entry.order === 'first') === (mine.order === 1)) forecastRight++;
    }
  }

  return { seed, decisions: recorded.length, fired, firedAgree, firedIntoSwitch, disagreements, forecast, forecastRight, forecastUnknown };
}

const rows: Awaited<ReturnType<typeof audit>>[] = [];
for (let index = 0; index < seeds; index++) rows.push(await audit(`${prefix}-${index}`));

const total = (key: 'decisions' | 'fired' | 'firedAgree' | 'firedIntoSwitch' | 'forecast' | 'forecastRight' | 'forecastUnknown'): number =>
  rows.reduce((sum, row) => sum + row[key], 0);

console.log(`priority audit · ${seeds} seeds · prefix ${prefix}`);
console.log(`AI-decided turns: ${total('decisions')}`);
console.log(
  `priority rule fired: ${total('fired')} turns; jiggle order agrees on ${total('firedAgree')} ` +
    `(${total('firedIntoSwitch')} of those against a foe that switched instead of attacking)`,
);
console.log(
  `speed forecast on bracket-0 turns: ${total('forecast')} turns, ` +
    `${total('forecastRight')} right, ${total('forecastUnknown')} unknown (ties), ` +
    `${total('forecast') - total('forecastRight') - total('forecastUnknown')} wrong`,
);
const disagreements = rows.flatMap((row) => row.disagreements);
console.log(`disagreements on fired turns: ${disagreements.length}`);
for (const line of disagreements) console.log(`  ${line}`);
