/** Slots per turn by class. Slots do not carry over. Appendix A, Classes. */
import type { ClassId } from '../core/cards/defs';

export const CLASS_SLOTS: Readonly<Record<ClassId, number>> = {
  special: 1,
  ranged: 2,
  melee: 3,
};
