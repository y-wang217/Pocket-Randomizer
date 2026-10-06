/**
 * The turn as steps, one per action, read off the batch that produced it.
 * **The per-move replay patch.**
 *
 * ## What was wrong
 *
 * The scene drew one view per batch, so the bar, the number and the sprite
 * stood at the turn's end state on the first frame; only the shadow chunk and
 * the lunges were slotted, by stylesheet delays. The second move's effect
 * landed on the frame the first's did, and a body that switched in and
 * fainted in the same turn was set swapped and fainted on one update: it rose,
 * and the fainted rule snapped it out of sight with no sink. The order the
 * engine resolved was right and the player could not see it, which from where
 * they sit is the same as wrong.
 *
 * ## What this is
 *
 * A reader over the batch's lines, walked in step with the actions `readTurns`
 * already numbered: the nth move-or-switch line is the nth action, the same
 * correspondence `flags.ts` and `battle-log.ts` rest on. Each step records
 * what each body looked like once that action's lines had run: its HP from
 * the last `-damage`, `-heal` or `-sethp` line that named it, whether it
 * fainted, and whether a `switch` or `drag` brought a new body in. The scene
 * composes a view per step from the previous view, the final view and these
 * overrides, and draws them two beats apart; the final view, the session's own
 * facts, always lands last, so nothing here can leave the board wrong.
 *
 * It is a reader, not a resolver: no order is decided here, and the
 * abnormality marks and trait fires per step come from `ui/abnormality.ts`'s
 * own reducers handed one action at a time. The scene is handed the result
 * and never sees a flag or a line (`test/boundaries.test.ts`).
 */
import type { FlaggedTurn } from '../core/battle/flags';
import type { ActorSide, TurnAction } from '../core/battle/turnOrder';
import { abnormalityMarks, firedTraits, type AbnormalityMark, type TraitFire } from './abnormality';

/** What a side's body looked like after a step. `null` means unchanged since the batch began. */
export interface BodyState {
  /** A `switch` or `drag` has brought a new body in by this step. */
  switched: boolean;
  /** The species the switch line named, when one has. */
  species: string | null;
  /** The HP the protocol last reported for this side, when it has. */
  hp: { current: number; max: number; fraction: number } | null;
  fainted: boolean;
}

export interface ReplayStep {
  side: ActorSide;
  kind: TurnAction['kind'];
  bodies: Record<ActorSide, BodyState>;
  /** This action's abnormality marks and trait fires, slot 1, from `ui/abnormality.ts`. */
  marks: AbnormalityMark[];
  fired: TraitFire[];
}

export interface TurnReplay {
  /** One per action of the turn being played, in resolution order. Empty when nothing was chosen. */
  steps: ReplayStep[];
  /** The marks and fires of what hung on no action: the opening batch's, or the residual after the last step. */
  marks: AbnormalityMark[];
  fired: TraitFire[];
  /** Which side a bracket put first this turn, and which way, or null on a same-bracket turn. */
  bracket: { side: ActorSide; way: 'up' | 'down' } | null;
}

/** The same two shapes `core/battle/turnOrder.ts` counts actions by. */
const MOVE = /^\|move\|(p[12])[a-c]: /;
const SWITCH = /^\|(?:switch|drag)\|(p[12])[a-c]: [^|]+\|([^|,]+)[^|]*\|([^|]*)/;
const HP_LINE = /^\|-(?:damage|heal|sethp)\|(p[12])[a-c]: [^|]+\|([^|]*)/;
const FAINT = /^\|faint\|(p[12])[a-c]: /;
const UPKEEP = /^\|upkeep\b/;

/**
 * The HP field of a line: `123/235`, `123/235 brn`, `45/100`, or `0 fnt`,
 * which carries no denominator, so the body's last max is kept over it.
 */
function parseHp(field: string, last: BodyState['hp']): BodyState['hp'] {
  const match = /^(\d+)(?:\/(\d+))?/.exec(field.trim());
  if (!match?.[1]) return null;
  const current = Number(match[1]);
  const max = match[2] ? Number(match[2]) : current === 0 ? (last?.max ?? 0) : 0;
  if (current === 0) return { current: 0, max, fraction: 0 };
  return max > 0 ? { current, max, fraction: current / max } : null;
}

function fresh(): BodyState {
  return { switched: false, species: null, hp: null, fainted: false };
}

function snapshot(bodies: Record<ActorSide, BodyState>): Record<ActorSide, BodyState> {
  return { p1: { ...bodies.p1 }, p2: { ...bodies.p2 } };
}

/** The last group of the batch that has any actions: the turn about to be played. See `scene.ts`. */
function latestTurn(turns: readonly FlaggedTurn[]): FlaggedTurn | undefined {
  return [...turns].reverse().find((turn) => turn.actions.length > 0);
}

export function readReplay(protocol: readonly string[], turns: readonly FlaggedTurn[]): TurnReplay {
  const latest = latestTurn(turns);
  if (!latest) return { steps: [], marks: abnormalityMarks(turns), fired: firedTraits(turns), bracket: null };

  // Where this turn's actions start among every action in the batch: the
  // same count the line walk below keeps, so the two meet at the same line.
  const flat = turns.flatMap((turn) => turn.actions);
  const offset = flat.indexOf(latest.actions[0]!);

  const bodies: Record<ActorSide, BodyState> = { p1: fresh(), p2: fresh() };
  const steps = new Map<number, ReplayStep>();
  let count = 0;
  let open = -1;
  let past = false;

  const stepFor = (index: number): ReplayStep => {
    const each = latest.actions[index]!;
    const one: FlaggedTurn = { turn: latest.turn, actions: [each], residual: [] };
    return {
      side: each.action.side,
      kind: each.action.kind,
      bodies: snapshot(bodies),
      marks: abnormalityMarks([one]),
      fired: firedTraits([one]),
    };
  };
  const close = (): void => {
    if (open >= 0) steps.set(open, stepFor(open));
    open = -1;
  };

  for (const line of protocol) {
    if (UPKEEP.test(line)) {
      past = true;
      close();
    }
    const move = MOVE.exec(line);
    const switched = SWITCH.exec(line);
    if (move || switched) {
      close();
      const index = count++ - offset;
      if (!past && index >= 0 && index < latest.actions.length) open = index;
    }
    if (switched?.[1] && switched[2]) {
      const side = switched[1] as ActorSide;
      bodies[side] = { switched: true, species: switched[2].trim(), hp: parseHp(switched[3] ?? '', null), fainted: false };
      continue;
    }
    const hp = HP_LINE.exec(line);
    if (hp?.[1]) {
      const side = hp[1] as ActorSide;
      const parsed = parseHp(hp[2] ?? '', bodies[side].hp);
      if (parsed) bodies[side].hp = parsed;
      continue;
    }
    const fainted = FAINT.exec(line);
    if (fainted?.[1]) {
      const side = fainted[1] as ActorSide;
      const max = bodies[side].hp?.max ?? 0;
      bodies[side] = { ...bodies[side], fainted: true, hp: { current: 0, max, fraction: 0 } };
    }
  }
  close();
  /*
   * Every action is a step, in order. An action no line opened a step for (a
   * replacement switch after `|upkeep|`, which the engine writes there, or a
   * turn handed over with no lines at all, as the fixtures do) takes the
   * bodies as they stand at the end, so a body that arrived after the
   * residual still rises as its own step and nothing the engine resolved is
   * skipped.
   */
  for (let index = 0; index < latest.actions.length; index++) {
    if (!steps.has(index)) steps.set(index, stepFor(index));
  }
  const ordered = [...steps.entries()].sort(([a], [b]) => a - b).map(([, step]) => step);

  /*
   * What is left for the final draw: every flag that hangs on no step. The
   * turn's residual, and any earlier group's flags in the batch (a `|cant|`
   * after the opening switch-ins lands in a group with no action at all),
   * reduced by the same rule the turn-at-once draw used, with the steps'
   * own flags taken out.
   */
  const rest = turns.map((turn) => (turn === latest ? { ...turn, actions: [] } : turn));
  return { steps: ordered, marks: abnormalityMarks(rest), fired: firedTraits(rest), bracket: bracketOf(latest) };
}

/**
 * Which side a priority bracket put first this turn, and which way. **M4.2,
 * section 6 step 2**, moved here from the scene with the per-move replay.
 *
 * It is the log's rule because it is the log's reading: `readTurns` sets
 * `priority` on the earlier action of a pair whose brackets differ and never
 * on a same-bracket turn, and that answer is read here, not recomputed. The
 * sign is read rather than assumed, because a negative bracket going first
 * would mean the other move was lower still.
 */
function bracketOf(turn: FlaggedTurn): TurnReplay['bracket'] {
  for (const { action } of turn.actions) {
    if (action.kind !== 'move' || !action.priority) continue;
    return { side: action.side, way: action.bracket > 0 ? 'up' : 'down' };
  }
  return null;
}

/**
 * The same turn with no steps and every mark and fire on the turn itself,
 * first per side winning as `ui/abnormality.ts` has it. For the opening batch,
 * which the scene plays no step for (an arrival is not a turn) and which
 * carries most of the game's ability announcements and field starts on its
 * switch-ins (Tier 0 census, D47 and D48).
 */
export function flattenReplay(replay: TurnReplay): TurnReplay {
  const marks = new Map<ActorSide, AbnormalityMark>();
  const fired = new Map<string, TraitFire>();
  for (const mark of [...replay.steps.flatMap((step) => step.marks), ...replay.marks]) {
    if (!marks.has(mark.side)) marks.set(mark.side, { ...mark, slot: 1 });
  }
  for (const fire of [...replay.steps.flatMap((step) => step.fired), ...replay.fired]) {
    const key = `${fire.side}:${fire.what}`;
    if (!fired.has(key)) fired.set(key, { ...fire, slot: 1 });
  }
  return { steps: [], marks: [...marks.values()], fired: [...fired.values()], bracket: replay.bracket };
}
