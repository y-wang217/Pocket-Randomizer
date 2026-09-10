/**
 * What died, and what killed it. **Stage 4.8, item 5.**
 *
 * A faint used to be a state transition with no memory: the run ended and the
 * player could not reconstruct what they had lost or when. The pieces were all
 * there — `NodeVisit.casualties` has carried the killing move and the opposing
 * species since the 4.7 attribution work — and what was missing was identity and
 * a place to read them in order.
 *
 * Pure. No RNG, no DOM. Derived from `RunState`, which a replay rebuilds from the
 * decision log, so a graveyard reconstructs identically and needs no field in the
 * log. That is why `RUN_LOG_VERSION`'s move this patch is item 2's and not this
 * item's.
 *
 * ## Every faint, not only the unrecoverable ones
 *
 * The prompt asks for an entry "each time a party member faints and is not
 * recovered". At the shipped tuning `reviveFaintedBetweenNodes` is true, so a
 * member that faints is *always* recovered — the only faints that are not are the
 * ones in the wipe that ends the run. Read literally, the graveyard would hold at
 * most one node's worth of casualties, all from the last fight, which is not "a
 * list of everything that died on the way" and would make the feature vacuous.
 *
 * So this records **every** faint, and the review that settled it chose that
 * reading. Revives are explicitly out of scope for this patch, so the alternative
 * was not available: making some faints permanent is the permadeath and
 * revive-economy work, and changing recovery to justify a readout would be the
 * readout deciding a mechanic.
 *
 * It follows that a member can appear more than once, and that a member alive at
 * the end can appear at all. Both are correct and both are the point: "Bramble
 * went down three times in the Marsh" is the run's story, and a list that hid it
 * because Bramble survived would be hiding the most interesting line in it.
 *
 * ## What this is not
 *
 * Not a release log. A member let go at a capture is gone from the party and did
 * not die; it has no casualty line and must not get one. The final-party section
 * of the result screen is where an absence shows.
 */
import type { Casualty } from './battle/driver';
import type { RunState } from './run';
import type { PokemonState } from './types';

/**
 * One death, in the terms a result screen renders.
 *
 * `nickname` and `species` are separate fields even though the protocol gives one
 * string, because the screen prints both — "Bramble, Weepinbell, Lv31" — and a
 * caller that had to split them would be re-deriving what this already knows.
 */
export interface DeathRecord {
  /** The name the protocol used, which is the nickname when the spec has one. */
  nickname: string;
  /** The species, from the party member the name matched, or the name itself. */
  species: string;
  /**
   * The level it fell at.
   *
   * **The one field the protocol cannot supply.** A `|faint|` line carries a name
   * and nothing else, so this is read off the party member as it stood when the
   * node resolved — see `deathsFrom` for how the match is made, and for what
   * happens when it cannot be.
   */
  level: number | null;
  /** 0-based segment the node belonged to. */
  segment: number;
  /** The node it fell in, so a screen can say "at Gym 5" or "at a wild encounter". */
  nodeKind: string;
  /** Node id, for a screen that wants to tie an entry to the map. */
  nodeId: string;
  /** The opposing Pokemon that landed the blow, or null for indirect damage. */
  bySpecies: string | null;
  /** The move that landed it, or null when nothing did. */
  byMove: string | null;
  /** `psn`, `brn`, `Recoil`, `Life Orb`, `Spikes` — verbatim from the protocol. */
  indirect: string | null;
}

/**
 * Every death in a run, in the order they happened.
 *
 * Run order is history order, which is already the order nodes resolved, so this
 * is a flat-map rather than a sort. A sort would need a key, and the only honest
 * key is "the order it happened", which is the thing history already is.
 *
 * ## Matching a casualty to a party member
 *
 * The protocol names its victim by `spec.nickname ?? spec.species`, so the match
 * is on that string against the party recorded *in the same visit*. Before item 5
 * gave every Pokemon a name this was ambiguous for two members of one species —
 * `core/battle/contribution.ts` says so — and nicknames are what make it exact.
 * They are drawn at map generation precisely so that this lookup is total.
 *
 * The match is against the run's **current** party, and the level it reads is that
 * member's level now rather than at the moment it fell. Those differ: `levelParty`
 * raises the whole party at every gym clear, so a member that went down in segment
 * 2 and survived to segment 5 reads its segment-5 level. That is a real
 * imprecision and it is accepted rather than hidden, because the exact fix is a
 * party snapshot on every `NodeVisit` — a copy of the whole party per node, to put
 * a more accurate number in one line of a readout. A later pass can make that
 * trade if the number ever matters.
 *
 * When no member matches, `level` is null and `species` falls back to the name
 * rather than the entry being dropped. That happens for a member released or lost
 * since, and returning null is the honest answer rather than a guess borrowed from
 * a different member. The same forgiveness `readCasualties` shows for an
 * unrecognised removal path applies here: "died to something" is a better line
 * than a missing row or a crashed screen.
 */
export function deathsFrom(state: RunState): DeathRecord[] {
  const deaths: DeathRecord[] = [];

  for (const visit of state.history) {
    for (const casualty of visit.casualties) {
      const member = state.party.find((candidate) => nameOf(candidate) === casualty.name);
      deaths.push({
        nickname: casualty.name,
        species: member?.spec.species ?? casualty.name,
        level: member?.spec.level ?? null,
        segment: visit.segment,
        nodeKind: visit.node.kind,
        nodeId: visit.node.id,
        bySpecies: casualty.bySpecies,
        byMove: casualty.byMove,
        indirect: casualty.indirect,
      });
    }
  }

  return deaths;
}

/**
 * The name the sim would have used for a member.
 *
 * `spec.nickname ?? spec.species` is the adapter's own rule (`driver.ts` builds the
 * battle name that way), and restating it here rather than importing it is the one
 * duplication in this file. It is two tokens and the alternative is reaching into
 * the adapter for a string helper; if it ever grows, it moves.
 */
function nameOf(member: PokemonState): string {
  return member.spec.nickname ?? member.spec.species;
}

/** Re-export so a caller does not have to reach into the adapter for the type. */
export type { Casualty };
