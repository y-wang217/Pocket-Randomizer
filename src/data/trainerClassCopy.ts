/**
 * Every trainer class's name, as a player reads it at the door. **Defender
 * Mode v0.**
 *
 * Split from `data/trainerClasses.ts`, which is hashed, by the 2026-09-22
 * ruling that no copy a player reads is inside `contentHash` (M5.1, D12): a
 * renamed class must not refuse every defender seed recorded before it. Read by
 * `ui/` and tests only; `build-config/content-hash.ts` excludes it.
 */
export const TRAINER_CLASS_NAMES: Readonly<Record<string, string>> = {
  bugcatcher: 'Bug Catcher',
  youngster: 'Youngster',
  lass: 'Lass',
  hiker: 'Hiker',
  swimmer: 'Swimmer',
  blackbelt: 'Black Belt',
  birdkeeper: 'Bird Keeper',
  acetrainer: 'Ace Trainer',
  veteran: 'Veteran',
  // The traded-away mons' trainer (`DEFENDER_REVENGE_CLASS`), 2026-10-06.
  collector: 'Collector',
};
