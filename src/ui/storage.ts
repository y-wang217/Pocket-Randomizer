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
import type { ItemPlan, RunLog, RunLogVersions } from '../core/types';

const KEY = 'gymrun.lastRun';
const DRAFT_KEY = 'gymrun.itemDraft';

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
 * The item plan the party screen has composed and the run has not spent yet.
 * **The second QA pass, QA-008 and QA-009.**
 *
 * A plan is one logged decision per boundary, so the fidgeting before it is
 * unlogged by design (`RunPolicy.chooseItemPlan`). That left a taught TM or an
 * item moved to the bag living only in `app.ts` memory until the boundary that
 * spends it, and a reload in between handed back the run as the log had it:
 * the old move, the item still held, the TM still in the bag. The draft is kept
 * here instead, beside the log, and the log is untouched: `RUN_LOG_VERSION`
 * does not move, because the decision it becomes is the same `items` entry.
 *
 * Stamped with the seed and the number of decisions logged when it was last
 * written, so it can only come back into the run and the moment it was made.
 */
export interface ItemPlanDraft {
  seed: string;
  decisions: number;
  plan: ItemPlan;
}

export function saveItemDraft(draft: ItemPlanDraft): void {
  try {
    globalThis.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Non-fatal, as for the log: the plan still stands until a reload.
  }
}

export function clearItemDraft(): void {
  try {
    globalThis.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // See above.
  }
}

/**
 * The draft for this log, or null.
 *
 * Null unless it names the same seed and nothing that spends or invalidates a
 * plan has been logged since it was written: an `items` entry spent it, and a
 * party edit or a release for a capture moved the slots it names (the UI drops
 * the plan for both, and a crash between the two writes must not bring it
 * back). `reconcileItemPlan` still runs on it before it is answered with.
 */
export function loadItemDraft(log: RunLog): ItemPlan | null {
  try {
    const raw = globalThis.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ItemPlanDraft> | null;
    if (!parsed || parsed.seed !== log.seed || typeof parsed.decisions !== 'number') return null;
    if (parsed.decisions > log.decisions.length || !isItemPlan(parsed.plan)) return null;
    const since = log.decisions.slice(parsed.decisions);
    const spent = since.some(
      (decision) =>
        decision.kind === 'items' ||
        decision.kind === 'party' ||
        (decision.kind === 'acquisition' && decision.decision.kind === 'release'),
    );
    return spent ? null : parsed.plan;
  } catch {
    return null;
  }
}

function isItemPlan(value: unknown): value is ItemPlan {
  if (typeof value !== 'object' || value === null) return false;
  const plan = value as Partial<Record<keyof ItemPlan, unknown>>;
  return (
    Array.isArray(plan.assignments) &&
    Array.isArray(plan.discards) &&
    Array.isArray(plan.teaches) &&
    Array.isArray(plan.discardTms)
  );
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
    case 'gymType':
    case 'draft':
    case 'door':
    case 'recruit':
    case 'locale':
    case 'lead':
    case 'evolve':
    case 'node':
    case 'reward':
    case 'berry':
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
    // The trade's second step: a yes or no, the third value-shaped decision.
    case 'trade':
      return typeof decision.accept === 'boolean';
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
    /*
     * A party screen edit. The opening playtest QA, QA-001. Checked here for
     * the reason this list exists: a kind missing from it makes every save
     * that holds one silently unresumable.
     */
    case 'party': {
      const edit = decision.edit as { kind?: unknown; from?: unknown; to?: unknown; slot?: unknown } | undefined;
      if (edit?.kind === 'reorder') return typeof edit.from === 'number' && typeof edit.to === 'number';
      if (edit?.kind === 'items') {
        const plan = (edit as { plan?: { assignments?: unknown; discards?: unknown } }).plan;
        return Array.isArray(plan?.assignments) && Array.isArray(plan?.discards);
      }
      if (edit?.kind === 'consume') return typeof (edit as { id?: unknown }).id === 'string' && typeof edit.slot === 'number';
      return edit?.kind === 'release' && typeof edit.slot === 'number';
    }
    default:
      return false;
  }
}
