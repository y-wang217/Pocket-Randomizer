/**
 * RunLog persistence.
 *
 * Stage 0 keeps exactly one battle's log, and only the seed plus the decision
 * sequence go in — the same bytes `replayRunLog` needs, and nothing else. This
 * is the full extent of persistence in Stage 0 by design; saves, unlocks and
 * run history are later stages' problems.
 *
 * Every access is guarded: localStorage throws outright in private-mode
 * Safari and in some embedded webviews, and a game that refuses to start
 * because it could not write a log would be a worse failure than losing the
 * log.
 */
import type { RunLog } from '../core/types';

const KEY = 'gymrun.lastRun';

export function saveRunLog(log: RunLog): void {
  try {
    globalThis.localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Non-fatal: the battle is still playable, it just is not resumable.
  }
}

export function loadRunLog(): RunLog | null {
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRunLog(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRunLog(): void {
  try {
    globalThis.localStorage.removeItem(KEY);
  } catch {
    // See above.
  }
}

/** Parse defensively: a stored log is untrusted input like any other. */
function isRunLog(value: unknown): value is RunLog {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RunLog>;
  return (
    typeof candidate.seed === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(
      (d) =>
        typeof d === 'object' &&
        d !== null &&
        typeof d.turn === 'number' &&
        (d.side === 'p1' || d.side === 'p2') &&
        d.choice?.kind === 'move' &&
        typeof d.choice.slot === 'number',
    )
  );
}
