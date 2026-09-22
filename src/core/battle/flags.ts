/**
 * Why the turn went the way it did: the battle protocol read as flag words.
 *
 * ## What this is for
 *
 * `turnOrder.ts` answered "who moved first". This answers the other half of the
 * same question — "and why did that land the way it did" — from the same
 * source, in the same way, for the same reason. Every fact below has been
 * resolving correctly in the engine since Stage 0 and none of it was on screen
 * except as a sentence in a log the player has to stop and read.
 *
 * So, like `turnOrder.ts`, this is a **reader**. It never decides anything; it
 * annotates what the engine already did. If a flag here ever disagrees with the
 * battle, the reader is wrong, because the protocol is the record.
 *
 * ## Flags are attributes, not verdicts
 *
 * There is no severity field, no rank, no ordering by importance, and there
 * never will be. `super` and `resisted` are the same kind of thing — a fact
 * about a multiplier that already applied — and a consumer that drew one larger
 * or brighter than the other would be turning a reading into a recommendation.
 * The flags come out in the order the protocol produced them, which is the one
 * ordering that is a fact rather than an opinion.
 *
 * This is also why the mapper returns `kind` and not a word. The words live in
 * `data/flagWords.ts`, because every piece of player-facing copy a tuning pass
 * would touch lives under `data/`, and because a core reader that carried
 * strings would make the vocabulary untestable apart from the reading.
 *
 * ## Two facts this reader used to carry and does not any more
 *
 * STAB and contact were here, injected through `moveIdentity` because the
 * protocol names neither. **M4.1 deleted both**, on R9: *"STAB and contact are
 * causes, not outcomes, and never get a flag."* A cause belongs on the move
 * card, where the type chip and the fact strip already carry it before the
 * player commits; a flag answers what the turn did after it resolved.
 *
 * Deleting them took the dex lookup with them — `moveIdentityOf` and `typesOf`
 * existed for these two kinds and nothing else — and with it the species
 * tracking, the type-change override and the retraction pass that took both
 * words back when the move missed. What is left needs the protocol and one
 * injected priority lookup.
 *
 * ## Priority is not recomputed
 *
 * The `priority` flag is read off the `TurnAction` that `readTurns` already
 * marked, and the bracket rule is therefore exactly the log's: a bracket-driven
 * turn is flagged, a same-bracket turn is not, even when a priority move was
 * used. One implementation of turn order, two consumers. A second reading here
 * would be a second answer waiting to disagree with the log sitting next to it.
 *
 * ## Purity
 *
 * No sim, no DOM, no timers, no `BattleFacts`. A leaf over `readTurns` and a
 * regex per line.
 */
import { readTurns, type ActorSide, type PriorityOf, type TurnAction } from './turnOrder';
import { DISPLAYED_VOLATILES } from './view';

/**
 * Everything the reader needs that the protocol does not say, which since M4.1
 * is one thing.
 *
 * It stays an interface rather than collapsing to a bare parameter because
 * `readTurns` takes the same shape, and because a named field is what made the
 * dex lookups that used to sit beside it assertable from a hand-written log.
 */
export interface FlagDeps {
  priorityOf: PriorityOf;
}

/**
 * Every flag word there is.
 *
 * A closed set, deliberately. A reader that could emit an open-ended vocabulary
 * would be a formatter, and there is already a formatter — the log. These were
 * the nine truths Release C names plus `berry`, which item 4 added off the
 * `-enditem` signal the driver has read since 4.6b; **M4.1 removed `stab` and
 * `contact`** per R9, leaving fifteen.
 *
 * `data/flagPrecedence.ts` sorts all fifteen into two channels and ranks the
 * hit channel. That file is exhaustive over this union by type, so a kind added
 * here fails to compile until somebody decides what the strip does with it —
 * which is the check that keeps R9's "at most one flag" from quietly becoming
 * "at most one of the kinds we remembered".
 */
export type FlagKind =
  | 'super'
  | 'resisted'
  | 'immune'
  | 'crit'
  | 'miss'
  | 'priority'
  | 'status'
  | 'berry'
  /*
   * The abnormalities. **The battle animation run, Branch 2.**
   *
   * Seven kinds in five classes, and the classes are what `ui/scene.ts` animates
   * — one beat each, so a turn carrying six of these costs exactly what a turn
   * carrying none costs.
   *
   * **Every one of them was measured before it was written.**
   * `scripts/protocol-census.ts` counted 699 battles and
   * `docs/reports/battle-anim-2-protocol-census.md` is the table. Two classes
   * the plan had drafted words for are absent here because the census cut them:
   * recoil, drain and multi-hit fired **not once**, and type change fired on
   * 2.9% of battles and is deferred rather than built. A word for an event no
   * fight produces is dead copy.
   */
  /** A condition took the turn: flinch, full paralysis, sleep, freeze, Truant. */
  | 'prevented'
  /** The move resolved and did nothing. `|-fail|`. */
  | 'failed'
  /** A stat stage went up. The commonest abnormality in the game. */
  | 'boost'
  /** A stat stage went down. Outnumbers `boost` on every stat — see the census. */
  | 'unboost'
  /** An ability announced itself. Names itself, like `berry`. */
  | 'ability'
  /** A volatile began. Filtered to the ones the panel is willing to name. */
  | 'volatile'
  /** Weather or terrain began. The one kind that is about neither Pokemon. */
  | 'field';

/** One truth read off the protocol. */
export interface Flag {
  kind: FlagKind;
  /** Which side the flag is *about*, which is not always the side that acted. */
  side: ActorSide;
  /** The Pokemon it is about, as the protocol names it. */
  subject: string;
  /**
   * What the word alone leaves out, when there is something: the status id for
   * `status`, the item name for `berry`, the signed bracket for `priority`.
   * Null everywhere else — `super` has nothing to add to itself.
   */
  detail: string | null;
}

/** One action, with what the protocol said about it. */
export interface FlaggedAction {
  action: TurnAction;
  flags: readonly Flag[];
}

/** A turn, as a sequence, with each action's flags attached. */
export interface FlaggedTurn {
  turn: number | null;
  actions: readonly FlaggedAction[];
  /**
   * Flags with no action to hang on.
   *
   * A berry eaten at end of turn belongs to the turn, not to whichever move
   * happened to be last — attaching it there would credit a move with something
   * it did not do. Anything after `|upkeep|`, and anything before the group's
   * first action, lands here.
   */
  residual: readonly Flag[];
}

const MOVE = /^\|move\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const SWITCH_DETAILS = /^\|(?:switch|drag)\|(p[12])[a-c]: ([^|]+)\|([^|,]+)/;
const SUPER = /^\|-supereffective\|(p[12])[a-c]: ([^|]+)/;
const RESISTED = /^\|-resisted\|(p[12])[a-c]: ([^|]+)/;
const IMMUNE = /^\|-immune\|(p[12])[a-c]: ([^|]+)/;
const CRIT = /^\|-crit\|(p[12])[a-c]: ([^|]+)/;
const MISS = /^\|-miss\|(p[12])[a-c]: ([^|]+)/;
const STATUS = /^\|-status\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const ENDITEM = /^\|-enditem\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const TURN = /^\|turn\|(\d+)/;
const UPKEEP = /^\|upkeep/;

/** A berry announces itself in the item name, and only berries carry the flag. */
const BERRY = /\bBerry$/;

/*
 * The abnormality patterns. **Branch 2.**
 *
 * Same convention as above: group 1 is the side, group 2 the subject, group 3
 * the payload — except the two field patterns, which name no Pokemon at all and
 * are handled apart.
 */
const CANT = /^\|cant\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const FAIL = /^\|-fail\|(p[12])[a-c]: ([^|]+)/;
const BOOST = /^\|-boost\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const UNBOOST = /^\|-unboost\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const ABILITY = /^\|-ability\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
const VOLATILE = /^\|-start\|(p[12])[a-c]: ([^|]+)\|([^|]+)/;
/*
 * Weather and terrain. **Both name themselves in group 1, not group 3**, and
 * that is not a detail — keying on the third field yields "Rain [upkeep]",
 * because what sits there is the `[from]` or `[upkeep]` tag. Measured while
 * building; see the census report.
 */
const WEATHER = /^\|-weather\|([^|]+)/;
const FIELDSTART = /^\|-fieldstart\|(?:move: )?([^|]+)/;
/*
 * Weather re-announces itself every turn it is up, and that line is 6.1% of all
 * battles on its own. A flag on it would put "Sandstorm" on the strip for every
 * turn of a sandstorm, which is a readout of the weather rather than of the
 * turn. Only the start is an event.
 */
const UPKEEP_TAG = /\|\[upkeep\]/;
/** Who caused a field effect, when the engine says. Otherwise: whoever just acted. */
const OF_SIDE = /\|\[of\] (p[12])[a-c]: ([^|]+)/;

/**
 * Read a protocol stream as turns of flagged actions.
 *
 * **There was a `createFlagReader` here and M4.1 deleted it.** It existed
 * because STAB needed the species that used the move, the protocol names a
 * species exactly once — on the `|switch|` that brought it in — and a turn
 * where nobody switched carries no such line, so a reader starting fresh on
 * every batch would have printed STAB on switch turns and nowhere else. That
 * was a real problem and the state was the right answer to it.
 *
 * With STAB gone nothing is remembered between calls: turn grouping, ordering
 * and priority are all derived per-call by `readTurns` from the lines in front
 * of it. A stateful reader holding no state is a claim about this file that is
 * no longer true, so it is deleted rather than kept as a wrapper — the tree's
 * own rule about a superseded mechanism.
 */
export function readFlags(protocol: readonly string[], deps: FlagDeps): FlaggedTurn[] {
  return readBatch(protocol, deps);
}

function readBatch(protocol: readonly string[], deps: FlagDeps): FlaggedTurn[] {
  const groups = readTurns(protocol, deps.priorityOf);

  /*
   * The actions, flattened, walked in step with the lines.
   *
   * The same correspondence `battle-log.ts` relies on and for the same reason:
   * the nth move-or-switch line in the stream is the nth move-or-switch action,
   * because both readers walk one stream in one order. Threading a line index
   * through `readTurns` would make a pure protocol reader carry a detail that
   * exists only for its consumers.
   */
  const flat = groups.flatMap((group) => group.actions);
  const attached = new Map<TurnAction, Flag[]>();
  /*
   * Keyed by the group's turn number rather than by its position.
   *
   * `readTurns` emits the leading switch-in group only when there is one, so
   * position 0 is the null-turn group in a whole battle and turn 1 in a stream
   * that opens on `|turn|`. The turn number is the group's own identity in both
   * cases, and `|turn|N` starts exactly one group.
   */
  const residual = new Map<number | null, Flag[]>();

  let index = 0;
  let turnNumber: number | null = null;
  let action: TurnAction | null = null;
  let past = false;

  const add = (flag: Flag): void => {
    if (action && !past) {
      const list = attached.get(action);
      if (list) list.push(flag);
      else attached.set(action, [flag]);
      return;
    }
    const list = residual.get(turnNumber);
    if (list) list.push(flag);
    else residual.set(turnNumber, [flag]);
  };

  for (const line of protocol) {
    const started = TURN.exec(line);
    if (started?.[1]) {
      turnNumber = Number(started[1]);
      action = null;
      past = false;
      continue;
    }
    if (UPKEEP.test(line)) {
      past = true;
      continue;
    }

    /*
     * A switch is an action, and that is all this branch does now. It used to
     * record the body's species for STAB as well; `SWITCH_DETAILS` still
     * captures the details field because the regex is one expression and
     * narrowing it would be a change to what the line means rather than to
     * what is read off it.
     */
    const switched = SWITCH_DETAILS.exec(line);
    if (switched?.[1] && switched[3]) {
      action = flat[index++] ?? null;
      continue;
    }

    const move = MOVE.exec(line);
    if (move?.[1] && move[2] && move[3]) {
      action = flat[index++] ?? null;
      const side = move[1] as ActorSide;

      /*
       * The one flag a `|move|` line produces on its own. Everything else about
       * a move — whether it landed, what it did, what it was resisted by —
       * arrives on later lines, which is why this branch is three statements
       * and the ones below it are a list.
       *
       * STAB and contact were stated here and retracted lower down when the
       * move turned out to have missed. R9 took both, and the retraction pass
       * with them: a cause is the move card's job, before the player commits.
       *
       * A `|-start| … |typechange|` line was read here too, to keep STAB
       * honest through Soak and Protean. It now falls through to the volatile
       * branch, where `DISPLAYED_VOLATILES` does not list `typechange` and it
       * is dropped — the same outcome by the filter that was already there.
       */
      if (action?.kind === 'move' && action.priority) {
        const sign = action.bracket > 0 ? '+' : '';
        add({ kind: 'priority', side, subject: move[2], detail: `${sign}${action.bracket}` });
      }
      continue;
    }

    const superEffective = SUPER.exec(line);
    if (superEffective?.[1] && superEffective[2]) {
      add({ kind: 'super', side: superEffective[1] as ActorSide, subject: superEffective[2], detail: null });
      continue;
    }

    const resisted = RESISTED.exec(line);
    if (resisted?.[1] && resisted[2]) {
      add({ kind: 'resisted', side: resisted[1] as ActorSide, subject: resisted[2], detail: null });
      continue;
    }

    const immune = IMMUNE.exec(line);
    if (immune?.[1] && immune[2]) {
      add({ kind: 'immune', side: immune[1] as ActorSide, subject: immune[2], detail: null });
      continue;
    }

    const crit = CRIT.exec(line);
    if (crit?.[1] && crit[2]) {
      add({ kind: 'crit', side: crit[1] as ActorSide, subject: crit[2], detail: null });
      continue;
    }

    const missed = MISS.exec(line);
    if (missed?.[1] && missed[2]) {
      add({ kind: 'miss', side: missed[1] as ActorSide, subject: missed[2], detail: null });
      continue;
    }

    const status = STATUS.exec(line);
    if (status?.[1] && status[2] && status[3]) {
      add({ kind: 'status', side: status[1] as ActorSide, subject: status[2], detail: status[3] });
      continue;
    }

    /*
     * ---------------------------------------------------------------------
     * The abnormalities. **Branch 2.**
     *
     * Inserted above the berry branch rather than below it on purpose: that
     * branch is last and carries no trailing `continue`, and adding one below
     * without noticing would have let a berry line fall through into whatever
     * came next.
     * ---------------------------------------------------------------------
     */

    /*
     * The turn a condition took. **The class built first, and not for its
     * frequency** — at 16.5% of battles it is the least common of the five.
     * It is first because it is the only one that is invisible by
     * construction: a flinched turn draws no damage, so no chunk, so no beat,
     * and today it is indistinguishable from a turn that did not happen. Every
     * other class at least leaves a changed panel behind.
     */
    const cant = CANT.exec(line);
    if (cant?.[1] && cant[2] && cant[3]) {
      add({ kind: 'prevented', side: cant[1] as ActorSide, subject: cant[2], detail: cant[3] });
      continue;
    }

    const failed = FAIL.exec(line);
    if (failed?.[1] && failed[2]) {
      add({ kind: 'failed', side: failed[1] as ActorSide, subject: failed[2], detail: null });
      continue;
    }

    /*
     * Stat stages, and **the commonest abnormality in the game**: 59.5% of
     * battles carry one. The panel already shows the resulting stage as a chip
     * — what is true now — and nothing until this marked the moment it moved.
     *
     * The detail is the stat and not the magnitude, deliberately. The stage
     * chip beside it already says how far, and a word that grew with the
     * number would be the same mistake as a recoil that grew with the
     * multiplier: a verdict on the board.
     */
    const boosted = BOOST.exec(line);
    if (boosted?.[1] && boosted[2] && boosted[3]) {
      add({ kind: 'boost', side: boosted[1] as ActorSide, subject: boosted[2], detail: boosted[3] });
      continue;
    }

    const unboosted = UNBOOST.exec(line);
    if (unboosted?.[1] && unboosted[2] && unboosted[3]) {
      add({ kind: 'unboost', side: unboosted[1] as ActorSide, subject: unboosted[2], detail: unboosted[3] });
      continue;
    }

    /*
     * An ability announcing itself. It names itself in the line, exactly as a
     * berry does, so there is no table: "Intimidate" is the word.
     */
    const ability = ABILITY.exec(line);
    if (ability?.[1] && ability[2] && ability[3]) {
      add({ kind: 'ability', side: ability[1] as ActorSide, subject: ability[2], detail: ability[3] });
      continue;
    }

    /*
     * A volatile beginning, **filtered to the ones the panel is willing to
     * name**. `DISPLAYED_VOLATILES` is that allowlist and it is already
     * exported for the tooltip coverage test, so this reuses it rather than
     * growing a second list that could disagree.
     *
     * The filter is what makes this class usable at all. The census found a
     * long tail on `-start` — `Charge`, `Doom Desire`, `Salt Cure`, `Quark
     * Drive` — that are engine bookkeeping or single moves, and naming them
     * would fill the strip with words a player cannot act on. The allowlist
     * drops every one of them for free.
     *
     * `typechange` is handled above and never reaches here, which is why this
     * branch sits after it.
     */
    const volatile_ = VOLATILE.exec(line);
    if (volatile_?.[1] && volatile_[2] && volatile_[3] && DISPLAYED_VOLATILES.includes(volatile_[3])) {
      add({ kind: 'volatile', side: volatile_[1] as ActorSide, subject: volatile_[2], detail: volatile_[3] });
      continue;
    }

    /*
     * Weather and terrain: **the one kind that is about neither Pokemon.**
     *
     * Two rules the census forced. The name is in the first field, not the
     * third, and a line carrying `[upkeep]` is the weather *continuing* rather
     * than starting — 6.1% of battles on its own, and flagging it would report
     * the weather every turn of a sandstorm instead of reporting the turn.
     *
     * A `Flag` needs a side and a subject and the board has neither, so it is
     * attributed to whoever caused it: the engine's own `[of]` when it says,
     * and otherwise whoever just acted. A field effect with no cause at all —
     * which the protocol does not produce — is dropped rather than guessed.
     */
    const weather = WEATHER.exec(line);
    const terrain = weather ? null : FIELDSTART.exec(line);
    const field = weather ?? terrain;
    if (field?.[1] && !UPKEEP_TAG.test(line) && field[1] !== 'none') {
      const of = OF_SIDE.exec(line);
      const side = (of?.[1] as ActorSide | undefined) ?? action?.side;
      const subject = of?.[2] ?? action?.actor;
      if (side && subject) add({ kind: 'field', side, subject, detail: field[1] });
      continue;
    }

    /*
     * Every spent item, filtered to the berries. **Item 4.**
     *
     * `-enditem` covers a Focus Sash and a Knock Off as well, which is exactly
     * why `driver.readConsumedItems` keeps all of them — the bag has to. A flag
     * word is a different job: the player needs to know a berry *fired*, which
     * is a thing that happened to the number on screen, and "your Air Balloon
     * popped" is a sentence the log already writes better than a chip can.
     */
    const item = ENDITEM.exec(line);
    if (item?.[1] && item[2] && item[3] && BERRY.test(item[3])) {
      add({ kind: 'berry', side: item[1] as ActorSide, subject: item[2], detail: item[3] });
    }
  }

  return groups.map((current) => ({
    turn: current.turn,
    actions: current.actions.map((each) => ({ action: each, flags: attached.get(each) ?? [] })),
    residual: residual.get(current.turn) ?? [],
  }));
}

