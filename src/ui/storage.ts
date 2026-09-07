/**
 * RunLog persistence.
 *
 * Exactly one run's log is kept, and only the seed plus the decision sequence
 * go in — the same bytes a replay needs, and nothing else. Unlocks and run
 * history are later stages' problems.
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

/**
 * Parse defensively: a stored log is untrusted input like any other.
 *
 * This only checks the *shape*. Whether the log was recorded against a
 * compatible build is a separate question, answered by comparing `version` at
 * replay time — a Stage 0 log parses fine here and is rejected there, which is
 * the explicit rejection the format change calls for rather than a silent
 * misreplay.
 */
function isRunLog(value: unknown): value is RunLog {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RunLog>;
  return (
    typeof candidate.seed === 'string' &&
    typeof candidate.version === 'string' &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(isRunDecision)
  );
}

function isRunDecision(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as { kind?: unknown; index?: unknown; choice?: { kind?: unknown; slot?: unknown } };
  if (decision.kind === 'starter' || decision.kind === 'node') return typeof decision.index === 'number';
  if (decision.kind === 'battle') {
    return decision.choice?.kind === 'move' && typeof decision.choice.slot === 'number';
  }
  return false;
}
