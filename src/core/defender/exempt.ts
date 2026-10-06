/**
 * The off-type slot. **Defender Mode v0, step 5.** Holding the Stranger's Pass
 * exempts `DEFENDER_OFF_TYPE_SLOTS` party slots from the type lock; nothing
 * else does. Read off the held relic list, never folded into `RelicEffects`,
 * which an attacker run computes.
 */
import { DEFENDER_BASE_EXEMPT_SLOTS, DEFENDER_OFF_TYPE_RELIC, DEFENDER_OFF_TYPE_SLOTS } from '../../data/defender';

export function exemptSlots(state: { relics: readonly string[] }): number {
  return DEFENDER_BASE_EXEMPT_SLOTS + (state.relics.includes(DEFENDER_OFF_TYPE_RELIC) ? DEFENDER_OFF_TYPE_SLOTS : 0);
}
