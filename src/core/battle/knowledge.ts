/**
 * What a battle has actually shown about the opponent. **`seenKnowledge`.**
 *
 * The vanilla rule, ported whole: the AI records the moves, the ability and the
 * item it has *seen the player use*, and it forgets all of it when that Pokemon
 * leaves the field. Nothing else. It is the cleanest difficulty axis in any of
 * the reference implementations, because it is information rather than a
 * number — a better opponent is one that has been paying attention, not one
 * whose attacks hit harder.
 *
 * **This is an addition, not a restriction, and that is worth stating.** Until
 * this patch the AI knew strictly less than a `seenKnowledge` bot: `BattleView`
 * carries no foe moves and always reports the foe's ability as null, and
 * nothing anywhere tracked a reveal, so the opponent walked into turn forty
 * having learned nothing since turn one. The brief expected to find the AI
 * accidentally omniscient and the opposite was true.
 *
 * ## Read off the protocol, never off the teams
 *
 * The protocol is what a *client* would see, and `driver.ts` already splits it
 * per side so neither player is handed the other's secrets. Reading knowledge
 * from anywhere else — the team spec, the sim's own objects — would be reading
 * the answer sheet, and the balance sweep would then be measuring a bot no
 * player can be.
 *
 * ## Forgetting
 *
 * A Pokemon that leaves the field takes what was learned about it with it.
 * That is vanilla's rule and it is kept for the reason vanilla has it: a
 * switch is supposed to buy something, and an opponent with perfect recall
 * across switches turns a pivot into a free scouting mission for the AI.
 * What is forgotten is the *active* record; a later stage that wants
 * cross-switch memory would keep a second one and say so.
 */
import type { SeenKnowledge, SideId } from '../types';

export type { SeenKnowledge };

export function emptyKnowledge(): SeenKnowledge {
  return { moves: [], ability: null, item: null };
}

/**
 * Fold a side's protocol into what is known about its *current* active Pokemon.
 *
 * A pure function of the lines, so a view can be rebuilt at any point in a
 * battle and a replay reconstructs exactly the same knowledge. Every line the
 * sim emits about the watched side is considered; a `switch` or `drag` line
 * clears the record, which is the forgetting rule.
 */
export function knowledgeFrom(protocol: readonly string[], about: SideId): SeenKnowledge {
  const known = emptyKnowledge();
  for (const line of protocol) {
    const parts = line.split('|');
    const tag = parts[1];
    if (!tag) continue;
    const identifier = parts[2] ?? '';
    if (!identifier.startsWith(about)) continue;

    switch (tag) {
      case 'switch':
      case 'drag':
      case 'replace': {
        // A different body is on the field. Everything learned about the last
        // one goes with it.
        known.moves = [];
        known.ability = null;
        known.item = null;
        break;
      }
      case 'move': {
        const move = parts[3];
        // Struggle is not a move the player chose to carry, and remembering it
        // would have the AI plan around a move that only exists because the
        // player ran out of them.
        if (move && move !== 'Struggle' && !known.moves.includes(move)) known.moves.push(move);
        break;
      }
      case '-ability': {
        const ability = parts[3];
        if (ability) known.ability = ability;
        break;
      }
      case '-item':
      case '-enditem': {
        const item = parts[3];
        if (item) known.item = item;
        break;
      }
      default:
        break;
    }
  }
  return known;
}
