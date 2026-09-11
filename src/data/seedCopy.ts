/**
 * What the seed bar says when a pasted seed was made somewhere else.
 *
 * A seed string carries the content hash of the build it was made on
 * (`core/seedString.ts`), and one made against other tables would not
 * reproduce here. The player is told so at paste time, in these words, and
 * offered the bare seed for a fresh run instead. Here rather than in
 * `ui/seed-bar.ts` for the reason every copy table under `data/` gives: a
 * sentence describing a mechanic, written in the file that renders it, drifts
 * from the mechanic.
 *
 * `{theirs}` and `{ours}` are the two six-character hashes, so the message
 * names both sides the way the replay guard does.
 *
 * Read by `ui/` only, so it is on the `contentHash` exclusion list in
 * `build-config/content-hash.ts`: rewording this must not move the hash it
 * is explaining.
 */
export const SEED_COPY = {
  /** The paste-time refusal. */
  foreign:
    'This seed was made on a different balance version ({theirs}; this build is {ours}) and will not reproduce here. ' +
    'The run seed on its own will start a fresh run.',
  /** The seed bar's copy button, resting and after a copy. */
  copy: 'Copy seed',
  copied: 'Copied',
  copyFailed: 'Select and copy',
} as const;

/** Fill the two hashes into the refusal. */
export function foreignSeedMessage(theirs: string, ours: string): string {
  return SEED_COPY.foreign.replace('{theirs}', theirs).replace('{ours}', ours);
}
