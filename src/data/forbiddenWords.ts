/**
 * Words no player-facing explanation may contain. **Milestone M0.3.**
 *
 * Design bible section 8: *"Never a hedge word (risky, safe, strong, weak,
 * good, bad, worth) on any surface."* The rule is older than this file — it
 * lived here as `TUTORIAL_FORBIDDEN_WORDS` in `data/tutorial.ts`, linted over
 * the twenty-nine coach marks by `test/tutorial.test.ts` — and M0.3 widens it
 * to the explanation tables, which is where discrepancy D3 found six live
 * violations against the four the bible had on file.
 *
 * Moved out of `tutorial.ts` because it stopped being about the tutorial. The
 * list is data rather than a regex in the linter for the reason it always was:
 * it grows, and a word added to a table is a smaller change than a word added
 * to a script.
 *
 * ## What is on it, and what is deliberately not
 *
 * Three words joined the twelve that were here: **risky**, **safe** and
 * **worth**, each named by section 8 or found by D3 in a line section 8 was
 * pointing at.
 *
 * Section 8's rule is about **hedges and verdicts**, not about vocabulary that
 * happens to sound evaluative. "Super effective" stays, because it is what the
 * protocol says happened. "Critical" stays for the same reason. A word earns a
 * place here when it states a *reading* of a fact rather than the fact.
 *
 * ## Whole words, case-insensitively
 *
 * `bad` must not fire on `badly`, which is how a status is inflicted, and
 * `worse` must not be reached through `worsen`. The linter anchors on word
 * boundaries, and `test/hedge-lint.test.ts` holds both cases.
 *
 * **There is no allowlist, by ruling.** The one name that collided — the Toxic
 * status, which read "Bad poison" — was renamed rather than exempted, so the
 * linter has no list of blessed exceptions that a future violation could hide
 * behind. See `statusInfo.ts`'s `tox` entry.
 *
 * ## Excluded from `contentHash`
 *
 * Listed in `build-config/content-hash.ts`. Nothing under `src/core/` imports
 * it at any depth — it is read by a build script and a test — and a word added
 * to a lint cannot change what a seed generates.
 */

/**
 * The hedge words, lowercase. Matched as whole words, case-insensitively.
 *
 * The first twelve are the coach-mark list as it stood; the last three are
 * M0.3's, and each is named in the design bible's section 8 sentence.
 */
export const FORBIDDEN_WORDS: readonly string[] = [
  'best',
  'should',
  'try',
  'recommend',
  'recommended',
  'good',
  'bad',
  'better',
  'worse',
  'strong',
  'weak',
  'usually',
  'risky',
  'safe',
  'worth',
];

/** The files the lint reads, as globs relative to the repo root. */
export const LINTED_COPY_GLOBS: readonly string[] = ['src/data/*Info.ts', 'src/data/tutorial.ts'];

/**
 * Every forbidden word in a string, as whole words, in the order they appear.
 *
 * Returns the matched text rather than the list entry, so a report can print
 * `Best` where the source said `Best` and the reader can find it.
 */
export function hedgeWordsIn(text: string): string[] {
  const pattern = new RegExp(`\\b(${FORBIDDEN_WORDS.join('|')})\\b`, 'gi');
  return [...text.matchAll(pattern)].map((match) => match[0]);
}
