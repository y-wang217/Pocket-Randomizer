/**
 * The run, as plain text on a clipboard. **Stage 4.8, item 6.**
 *
 * **Under `ui/copy/`, not `data/`.** `contentHash` is computed over `data/`, and a
 * word changed here must not move a seed. Nothing in this file is read by `core/`.
 *
 * Pure: it takes a finished run and returns a string. No DOM, no clipboard, no
 * date. The screen does the writing; this decides what gets written, which is what
 * makes the format assertable in a test rather than by reading a paste.
 *
 * ## What it is for, and the constraints that follow
 *
 * It is pasted into Discord or a message thread, which decides almost everything
 * about the shape:
 *
 *   - **No monospace assumption.** No column alignment, no box drawing, no padding
 *     to a width. A proportional font must not turn the thing into a ragged mess,
 *     so structure comes from line breaks and short labels instead.
 *   - **Short enough to read without scrolling in a chat client.** The graveyard is
 *     the only unbounded section, and it is capped — see `GRAVE_LIMIT`.
 *   - **No image, no canvas, no share sheet.** Text is the whole feature.
 *
 * ## The seed is rendered in one place
 *
 * `seedLine` exists so that the versioned seed string is rendered in exactly
 * one function rather than in however many places a run is described. It has
 * been the `GYMRUN-<hash>-<seed>` form since the `contentHash` release.
 */
import { formatSeedString } from '../../core/seedString';
import type { DeathRecord } from '../../core/graveyard';
import type { ScoreBreakdown } from '../../core/scoring';

/**
 * How many tombstones the text carries before it summarises the rest.
 *
 * A long run can lose a dozen Pokemon and a dozen lines is a wall in a chat
 * client. Six plus a count keeps the shape of the run — who died, roughly how
 * often — inside a glance.
 */
export const GRAVE_LIMIT = 6;

/** Everything the text needs. A view, so the builder never reaches into run state. */
export interface ShareView {
  seed: string;
  outcome: 'victory' | 'defeat';
  gymsCleared: number;
  gymTotal: number;
  score: ScoreBreakdown;
  /** Final party, in party order: what each is, and its level. */
  party: readonly { species: string; level: number }[];
  deaths: readonly DeathRecord[];
  /** Relic names, already resolved — this file does not know the relic table. */
  relics: readonly string[];
  /** The locales the run passed through, in order, already named. */
  locales: readonly string[];
}

/**
 * The seed, as one line. **The one place a seed is rendered into shared text.**
 *
 * See the header: the versioned form, so the text carries the balance version
 * the run was made on.
 */
export function seedLine(seed: string): string {
  return `Seed ${formatSeedString(seed)}`;
}

/**
 * One death, as the result screen says it. Factual, and no commentary.
 *
 * Species, not the nickname the record also carries. **4.8.0.1.** The 4.8 line
 * read "Bramble, Weepinbell, Lv31"; the ruling on 4.8.0.1's report de-prioritised
 * nicknames on every surface, the tombstone included, and `DeathRecord.nickname`
 * is kept in `core/` unread rather than removed. `generation.md` section 12i.
 */
export function deathLine(death: DeathRecord): string {
  const who = death.level === null ? death.species : `${death.species}, Lv${death.level}`;
  const where = death.nodeKind === 'gym' ? `at Gym ${death.segment + 1}` : `in region ${death.segment + 1}`;
  const cause = death.byMove
    ? ` to ${death.bySpecies ?? 'something'}, ${death.byMove}`
    : death.indirect
      ? ` to ${death.indirect}`
      : '';
  return `${who}, fell ${where}${cause}.`;
}

/**
 * The whole artifact.
 *
 * Sections in the order a reader wants them: what happened, what it scored, who
 * finished, who did not, what the run was carrying, where it went. The score's
 * components are listed because a total nobody can take apart is a number rather
 * than a result — and the zero-weighted ones are skipped *here only*, because a
 * line reading "Turns taken 0" in a chat message is noise where the same row on
 * the result screen is a column a later pass reads history out of.
 */
export function shareText(view: ShareView): string {
  const lines: string[] = [];

  lines.push(view.outcome === 'victory' ? 'GYMRUN — cleared' : 'GYMRUN — fell');
  lines.push(`${view.gymsCleared} of ${view.gymTotal} gyms · ${view.score.total} points`);
  lines.push(seedLine(view.seed));
  lines.push('');

  const scoring = view.score.components.filter((component) => component.points !== 0);
  if (scoring.length > 0) {
    lines.push('Score');
    for (const component of scoring) {
      lines.push(`· ${component.label} ${component.count} — ${component.points}`);
    }
    lines.push('');
  }

  if (view.party.length > 0) {
    lines.push('Party');
    for (const member of view.party) {
      lines.push(`· ${member.species}, Lv${member.level}`);
    }
    lines.push('');
  }

  if (view.deaths.length > 0) {
    lines.push(view.deaths.length === 1 ? 'Fell in battle (1)' : `Fell in battle (${view.deaths.length})`);
    for (const death of view.deaths.slice(0, GRAVE_LIMIT)) {
      lines.push(`· ${deathLine(death)}`);
    }
    const hidden = view.deaths.length - GRAVE_LIMIT;
    if (hidden > 0) lines.push(`· and ${hidden} more.`);
    lines.push('');
  }

  if (view.relics.length > 0) {
    lines.push(`Relics · ${view.relics.join(', ')}`);
  }
  if (view.locales.length > 0) {
    lines.push(`Route · ${view.locales.join(' → ')}`);
  }

  // One trailing newline at most: a paste that ends in three blank lines looks
  // like a mistake in a chat client.
  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}
