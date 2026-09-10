/**
 * Who actually did the work: per-member counters read off a battle protocol.
 *
 * **The question this answers is whether the player has a party or a solo carry
 * with three passengers.** Stage 4 added slots, 4.6a made them fillable by
 * catching, and nothing in the game or the simulator could say whether any of
 * it mattered. A party that exists to be a health bar for the starter is a
 * different game from one that fights, and the difference is invisible without
 * these five numbers.
 *
 * ## Why it is a reducer over protocol lines
 *
 * The alternative is instrumenting the engine — hooking damage as it resolves —
 * and it is wrong for the reason every other read in this project is a read:
 * the protocol is what *happened*, and a hook is a second model of what
 * happened that agrees with the first until it does not. The protocol is also
 * already recorded, replayed byte for byte by `test/replay.test.ts`, and
 * therefore already a determinism-checked artefact. Counters derived from it
 * inherit that for free, which is the whole of why `test/run-replay.test.ts`
 * can assert rebuilt counters match saved ones.
 *
 * It lives beside `driver.ts` rather than above it because of the rule in that
 * file's header: **nothing above the adapter may see a protocol string.** This
 * is inside the adapter boundary — it is called by `runBattle` and its output
 * is plain numbers — and it imports no `@pkmn/sim`, so the two rules hold
 * together.
 *
 * ## Two facts about the protocol this is built on
 *
 * **HP is exact on both sides.** A Showdown battle normally splits `-damage`
 * so that the owner sees `93/158` and everyone else sees `59/100`, which would
 * make "damage dealt" and "damage taken" different units wearing one label.
 * GYMRUN runs Custom Game, which carries `debug: true`, which sets the sim's
 * `reportExactHP` — so both halves of the split are identical and every number
 * here is in HP points. That is a property of the format rather than of this
 * file, so `test/contribution.test.ts` asserts it directly: if a gen-lock or a
 * format change ever turns it off, that test fails rather than these counters
 * quietly becoming percentages.
 *
 * **A `-damage` line names its victim, never its dealer.** So attribution is
 * reconstructed from the `|move|` line before it, which is the same mechanism
 * `readCasualties` uses and the reason that function already tracks a rolling
 * `lastMove`.
 */
import type { Contribution, SideId } from '../types';

export function emptyContribution(): Contribution {
  return { damageDealt: 0, damageTaken: 0, kos: 0, faints: 0, turnsOnField: 0 };
}

/** Sum two counters. Used to fold a battle's delta into a run's running total. */
export function addContribution(base: Contribution, delta: Contribution): Contribution {
  return {
    damageDealt: base.damageDealt + delta.damageDealt,
    damageTaken: base.damageTaken + delta.damageTaken,
    kos: base.kos + delta.kos,
    faints: base.faints + delta.faints,
    turnsOnField: base.turnsOnField + delta.turnsOnField,
  };
}

/**
 * Read one battle's counters for the player's side, in send order.
 *
 * `roster` is the battle names of the side being measured, in the order
 * `party.battleMembersFor` sent them — the same order `readPartyState` reads
 * back, and therefore the same order `party.applyBattleState` maps onto the
 * party. One send order, used by everything that maps a battle result onto a
 * party; two would be two orders to keep in agreement, and the failure would be
 * damage credited to the wrong Pokemon.
 *
 * Returns one `Contribution` per roster entry, always, including for members
 * that never came off the bench.
 *
 * ## The one thing it cannot do
 *
 * A battle protocol identifies a Pokemon by its **battle name**, which is its
 * nickname or its species. Two party members of the same species with no
 * nickname are therefore the same string in every line of the log, and no
 * amount of parsing separates them.
 *
 * What this does about it: a switch-in binds to the roster slot whose name
 * matches and whose last known HP matches the HP on the `|switch|` line, and
 * failing that to the first unbound slot with that name. That resolves every
 * realistic case — two same-species members are almost never at identical HP,
 * and the first switch-in of each is unambiguous by order. The residual tie is
 * two members with the same species at the same HP, where the protocol contains
 * no information that separates them and this credits the earlier slot.
 *
 * The real fix is unique battle names, and it is deliberately not taken here:
 * it would change what the player reads on the battle panel, which is a
 * display decision that wants its own argument rather than arriving as a side
 * effect of a stats feature.
 */
export function readContribution(
  protocol: readonly string[],
  roster: readonly string[],
): Contribution[] {
  const counters = roster.map(() => emptyContribution());

  /** Which roster slot is on the field, and what the log last said its HP was. */
  let mine: { slot: number; hp: number } | null = null;
  /** The opposing active. No slot: the opponent's party is not being measured. */
  let theirs: { hp: number } | null = null;
  /** Roster slots already seen on the field, for the binding rule above. */
  const lastHpBySlot = new Map<number, number>();
  const bound = new Set<number>();

  /** The move that is currently resolving, and the slot that used it. */
  let lastMove: { side: SideId; slot: number | null; target: string } | null = null;
  /** Who last dealt *direct* damage to each identifier, for KO credit. */
  const lastDamager = new Map<string, number>();

  for (const line of protocol) {
    const parts = line.split('|');
    const tag = parts[1] ?? '';

    if (tag === 'switch' || tag === 'drag' || tag === 'replace') {
      const identifier = parts[2] ?? '';
      const side = sideOf(identifier);
      const hp = hpOf(parts[4] ?? '');
      if (side === 'p2') {
        theirs = { hp };
        continue;
      }
      const slot = bindSlot(roster, nameOf(identifier), hp, lastHpBySlot, bound);
      mine = slot === null ? null : { slot, hp };
      if (slot !== null) {
        bound.add(slot);
        lastHpBySlot.set(slot, hp);
      }
      continue;
    }

    if (tag === 'turn') {
      // "Turns spent on the field" is counted at the top of a turn rather than
      // at the bottom: a member that fainted during turn 6 was on the field for
      // turn 6, and one that switched in after the faint was not.
      if (mine) counters[mine.slot]!.turnsOnField++;
      continue;
    }

    if (tag === 'move') {
      const identifier = parts[2] ?? '';
      const side = sideOf(identifier);
      lastMove = {
        side,
        slot: side === 'p1' ? (mine?.slot ?? null) : null,
        target: parts[4] ?? '',
      };
      continue;
    }

    if (tag === '-damage' || tag === '-heal' || tag === '-sethp') {
      const identifier = parts[2] ?? '';
      const side = sideOf(identifier);
      const now = hpOf(parts[3] ?? '');
      const before = side === 'p1' ? (mine?.hp ?? now) : (theirs?.hp ?? now);
      const lost = Math.max(0, before - now);

      if (side === 'p1' && mine) {
        mine.hp = now;
        lastHpBySlot.set(mine.slot, now);
        counters[mine.slot]!.damageTaken += lost;
      } else if (side === 'p2') {
        theirs = { hp: now };
      }

      /*
       * Credit only direct move damage, and only to a mover on the other side.
       *
       * `[from]` is the protocol's own marker for "this was not the move that
       * was just used": `[from] psn`, `[from] Recoil`, `[from] item: Life Orb`,
       * `[from] Spikes`. Recoil is the case the tests pin, because it is a
       * `-damage` line on the *attacker* arriving immediately after a `-damage`
       * line on the defender, and a reader that ignored the tag would credit
       * the attacker with hitting itself.
       */
      const indirect = parts.some((part) => part.startsWith('[from]'));
      if (tag === '-damage' && !indirect && lost > 0 && lastMove && lastMove.slot !== null) {
        if (lastMove.side === 'p1' && side === 'p2') {
          counters[lastMove.slot]!.damageDealt += lost;
          lastDamager.set(identifier, lastMove.slot);
        }
      }
      if (indirect || tag !== '-damage') lastDamager.delete(identifier);
      continue;
    }

    if (tag === 'faint') {
      const identifier = parts[2] ?? '';
      if (sideOf(identifier) === 'p1') {
        if (mine) counters[mine.slot]!.faints++;
        continue;
      }
      // A KO is credited to whoever last landed a direct move on the fainted
      // Pokemon. A faint to poison or recoil is credited to nobody, which is
      // the same line `readCasualties` draws with its `indirect` field.
      const dealer = lastDamager.get(identifier);
      if (dealer !== undefined) counters[dealer]!.kos++;
      lastDamager.delete(identifier);
      continue;
    }
  }

  return counters;
}

/**
 * Which roster slot a switch-in refers to.
 *
 * Name first, then HP among the members that share it, then send order among
 * the ones nothing has separated. See the note on `readContribution` for what
 * this cannot do and why the fix is not taken here.
 */
function bindSlot(
  roster: readonly string[],
  name: string,
  hp: number,
  lastHpBySlot: Map<number, number>,
  bound: ReadonlySet<number>,
): number | null {
  const matches = roster.flatMap((entry, slot) => (entry === name ? [slot] : []));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!;

  const byHp = matches.find((slot) => bound.has(slot) && lastHpBySlot.get(slot) === hp);
  if (byHp !== undefined) return byHp;

  const unbound = matches.find((slot) => !bound.has(slot));
  return unbound ?? matches[0]!;
}

/** `p2a: Gengar` -> `p2`. Anything unrecognised is treated as the player's. */
function sideOf(identifier: string): SideId {
  return identifier.startsWith('p2') ? 'p2' : 'p1';
}

/** `p2a: Gengar` -> `Gengar`. Empty for a malformed or absent identifier. */
function nameOf(identifier: string): string {
  const split = identifier.indexOf(': ');
  return split === -1 ? '' : identifier.slice(split + 2);
}

/**
 * The HP number out of a protocol health field.
 *
 * The field is `93/158`, `93/158 par`, `0 fnt`, or `0`. Splitting on the space
 * first is what makes a status suffix harmless; `0 fnt` has no denominator at
 * all, which is why only the numerator is read.
 */
function hpOf(field: string): number {
  const value = Number.parseInt(field.split(' ')[0]?.split('/')[0] ?? '', 10);
  return Number.isFinite(value) ? value : 0;
}
