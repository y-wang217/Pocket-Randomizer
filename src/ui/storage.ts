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
import type { RunLog, RunLogVersions } from '../core/types';

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
  const versions = candidate.versions as Partial<RunLogVersions> | undefined;
  return (
    typeof candidate.seed === 'string' &&
    typeof versions === 'object' &&
    versions !== null &&
    typeof versions.runLog === 'string' &&
    typeof versions.contentHash === 'string' &&
    typeof versions.aiVersion === 'string' &&
    typeof versions.randomizerVersion === 'string' &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(isRunDecision)
  );
}

/**
 * One decision, by kind. Every kind `core/types.ts` can log, named here.
 *
 * **This list was three kinds long from Stage 1 to Stage V1**, and it cost the
 * resume path silently: the moment 4.6a logged a `locale` decision, every
 * saved run failed this check, `loadRunLog` returned null, and the app started
 * a fresh seed on every reload with the log sitting in storage. Nothing
 * reported it, because "no saved run" is a legitimate answer. V1's save and
 * reload test is what found it (`test/visual-locales.test.ts`).
 */
function isRunDecision(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const decision = value as { kind?: unknown } & Record<string, unknown>;
  switch (decision.kind) {
    case 'starter':
    case 'locale':
    case 'lead':
    case 'evolve':
    case 'node':
    case 'reward':
    case 'target':
      return typeof decision.index === 'number';
    /*
     * **The one decision that is not an index, since the event rejig.**
     *
     * It was in the list above until this patch, and leaving it there was a
     * real defect rather than a cosmetic one: an event decision now carries an
     * `archetype` and no `index`, so the check failed for every saved run that
     * had passed a question mark, `loadRunLog` returned null, and the save was
     * silently unresumable. `test/storage.test.ts` caught it, which is what
     * that suite's "whatever kinds it holds" is for.
     *
     * Validated against the four names rather than `typeof === 'string'`,
     * because the point of the tag is that it is a closed set: a log naming
     * something else is a log this build cannot replay, and it should be
     * refused here rather than at the call site that reads it.
     */
    case 'event':
      return (
        decision.archetype === 'safe' ||
        decision.archetype === 'gamble' ||
        decision.archetype === 'toll' ||
        decision.archetype === 'attune'
      );
    case 'battle': {
      const choice = decision.choice as { kind?: unknown; slot?: unknown } | undefined;
      return (choice?.kind === 'move' || choice?.kind === 'switch') && typeof choice.slot === 'number';
    }
    case 'shop':
      return Array.isArray(decision.indexes) && decision.indexes.every((index) => typeof index === 'number');
    case 'acquisition': {
      const inner = decision.decision as { kind?: unknown; slot?: unknown } | undefined;
      if (inner?.kind === 'decline' || inner?.kind === 'accept') return true;
      return inner?.kind === 'release' && typeof inner.slot === 'number';
    }
    case 'items': {
      const plan = decision.plan as { assignments?: unknown; discards?: unknown } | undefined;
      return Array.isArray(plan?.assignments) && Array.isArray(plan?.discards);
    }
    case 'replace':
      return typeof decision.slot === 'number';
    default:
      return false;
  }
}
