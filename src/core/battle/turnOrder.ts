/**
 * Who went first, and why: the battle protocol read as a sequence of turns.
 *
 * ## What the playtest actually found
 *
 * The feedback was "priority doesn't exist, implement priority moves". The
 * measurement says otherwise, and the test that says so is in
 * `test/turn-order.test.ts`: a level 50 Snorlax using Quick Attack resolves
 * before a level 50 Jolteon using Tackle in the raw protocol, and swapping
 * Snorlax to Tackle flips the order back. @pkmn/sim resolves turn order
 * natively — brackets first, then Speed — and GYMRUN never computes it, so
 * there was nothing to implement.
 *
 * What was missing is that **the player could not see it happen.** The log was
 * a flat list of formatter sentences with no marker for sequence and no marker
 * for cause, so a slower Pokemon moving first read as a bug or as randomness.
 * A mechanic the player cannot see is, from where they sit, a mechanic that
 * does not exist — which is exactly what they reported.
 *
 * So this file is a *reader*, not a resolver. It never decides an order; it
 * annotates the one the engine already produced.
 *
 * ## Why priority is inferred from brackets rather than from Speed
 *
 * The protocol reports what happened and never why. To mark a turn as
 * priority-driven you need one more fact, and there are two candidates:
 *
 *   - **Compare the actors' Speeds.** Tempting, and wrong: the log does not
 *     carry Speed, so it would have to come from elsewhere — and "elsewhere" is
 *     a stat that stat stages, paralysis, Choice Scarf and a dozen abilities all
 *     modify. A marker that disagreed with the turn it labels is worse than no
 *     marker.
 *   - **Compare the moves' priority brackets.** A higher bracket beats Speed by
 *     definition, so if the first actor's move sits in a higher bracket than the
 *     second's, the bracket is *why* it went first — regardless of what either
 *     Speed was. That is a complete explanation from data the dex owns.
 *
 * The second is what this does, and it is deliberately conservative: a turn
 * where both moves share a bracket is never marked, even if a priority move was
 * used. Quick Attack into Quick Attack was decided by Speed, and saying
 * otherwise would be teaching the player a false rule.
 *
 * ## Purity
 *
 * No sim, no DOM, no dex. The bracket lookup is injected — `driver.movePriority`
 * is the one real implementation — because rule 4 says only the adapter may
 * import `@pkmn/sim`, and because it makes every case in this file assertable
 * from a hand-written protocol log.
 */

/** How a move's priority bracket is looked up. `driver.movePriority` supplies it. */
export type PriorityOf = (moveNameOrId: string) => number;

/** Which side an actor is on, as the protocol spells it: `p1a`, `p2a`. */
export type ActorSide = 'p1' | 'p2';

/**
 * One thing a side did in a turn, in the order the engine resolved it.
 *
 * `switch` and `move` are one type rather than two because the log renders them
 * in one ordered list and a consumer that had to merge two streams would be
 * re-deriving the order this file exists to report.
 */
export type TurnAction =
  | {
      kind: 'move';
      side: ActorSide;
      /** The Pokemon's display name, as the protocol gives it. */
      actor: string;
      move: string;
      /** 1 for the first action of the turn, 2 for the second, and so on. */
      order: number;
      /**
       * True when this move went first *because of its bracket*.
       *
       * Set only on the earlier action of a pair whose brackets differ. Never
       * set when both moves share a bracket, even a non-zero one — that turn
       * was decided by Speed, and marking it would teach a false rule.
       */
      priority: boolean;
      /** The bracket itself, so a consumer can show it if it wants to. */
      bracket: number;
    }
  | {
      kind: 'switch';
      side: ActorSide;
      /** Who came in. */
      actor: string;
      /**
       * Who went out, when the protocol said.
       *
       * Null for the opening switch-ins of a battle and for a forced switch
       * after a faint, where nothing was withdrawn.
       */
      from: string | null;
      order: number;
    };

/** A turn, as a sequence. `number` is null for the pre-turn switch-ins. */
export interface TurnGroup {
  turn: number | null;
  actions: TurnAction[];
}

/**
 * The `|move|p1a: Snorlax|Quick Attack|p2a: Jolteon` shape.
 *
 * Written out rather than delegated to @pkmn/protocol's parser because this
 * file is a leaf and the parser lives behind the adapter. Three fields, one
 * split, and `test/turn-order.test.ts` drives it from real protocol captured
 * off a real battle rather than from strings written here.
 */
const MOVE = /^\|move\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const SWITCH = /^\|(?:switch|drag)\|(p[12])[a-c]: ([^|]+)\|/;
const TURN = /^\|turn\|(\d+)/;
const FAINT = /^\|faint\|(p[12])[a-c]: /;

/**
 * Group a protocol stream into turns, with each action tagged in resolution
 * order and priority-driven moves marked.
 *
 * The stream may be a whole battle or one update's worth; a leading run of
 * actions before the first `|turn|` becomes a group with a null turn number,
 * which is where the opening switch-ins land.
 */
export function readTurns(protocol: readonly string[], priorityOf: PriorityOf): TurnGroup[] {
  const groups: TurnGroup[] = [];
  let current: TurnGroup = { turn: null, actions: [] };

  /*
   * Who is standing on each side, tracked across the whole stream.
   *
   * Battle-wide rather than per turn, because a voluntary switch is usually the
   * *first* action of its turn and the Pokemon it replaces was sent out in an
   * earlier one. Scoping this to the turn group reports `from: null` for every
   * real switch, which is the one thing the field exists to say.
   *
   * Cleared on a faint, so the replacement that follows reads as an arrival
   * rather than as "Snorlax switched out" — it did not switch out, it died, and
   * the log has already said so on its own line.
   */
  const standing: Record<ActorSide, string | null> = { p1: null, p2: null };

  const flush = (): void => {
    if (current.actions.length > 0 || current.turn !== null) groups.push(markPriority(current));
  };

  for (const line of protocol) {
    const turn = TURN.exec(line);
    if (turn?.[1]) {
      flush();
      current = { turn: Number(turn[1]), actions: [] };
      continue;
    }

    const move = MOVE.exec(line);
    if (move?.[1] && move[2] && move[3]) {
      current.actions.push({
        kind: 'move',
        side: move[1] as ActorSide,
        actor: move[2],
        move: move[3],
        order: current.actions.length + 1,
        priority: false,
        bracket: priorityOf(move[3]),
      });
      continue;
    }

    const fainted = FAINT.exec(line);
    if (fainted?.[1]) {
      standing[fainted[1] as ActorSide] = null;
      continue;
    }

    const switched = SWITCH.exec(line);
    if (switched?.[1] && switched[2]) {
      const side = switched[1] as ActorSide;
      current.actions.push({
        kind: 'switch',
        side,
        actor: switched[2],
        // The protocol does not name the outgoing Pokemon on a `|switch|`, so
        // it comes from what was standing there. Null for an opening switch-in
        // and for the replacement after a faint.
        from: standing[side],
        order: current.actions.length + 1,
      });
      standing[side] = switched[2];
    }
  }

  flush();
  return groups;
}

/**
 * Mark the first move of the turn when a bracket, not Speed, put it there.
 *
 * Only the first *pair* of moves is considered. Later actions in a turn are
 * replacements after a faint and residual effects, and neither was ordered by a
 * bracket comparison against anything.
 */
function markPriority(group: TurnGroup): TurnGroup {
  const moves = group.actions.filter((action) => action.kind === 'move');
  const [first, second] = moves;
  if (
    first?.kind !== 'move' ||
    second?.kind !== 'move' ||
    first.side === second.side ||
    first.bracket <= second.bracket
  ) {
    return group;
  }

  return {
    ...group,
    actions: group.actions.map((action) => (action === first ? { ...action, priority: true } : action)),
  };
}
