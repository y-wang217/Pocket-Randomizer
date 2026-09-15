/**
 * A promise the UI resolves from an event.
 *
 * Every run decision the player makes has the same shape: `playRun` asks a
 * question and parks on a promise; a click answers it. `createHumanPolicy` in
 * core/battle/policy.ts does exactly this for move choices, and this is the
 * same idea with the type left open, because a starter pick and a node pick are
 * the same problem.
 *
 * `cancel` exists because a run can be abandoned mid-question — the player
 * types a new seed while the map is on screen — and a policy left parked on a
 * promise nobody will resolve is a leaked run that still holds the DOM.
 */
/**
 * The rejection `cancel` raises, as a type the caller can recognise.
 *
 * **It is a class because `app.ts` has to tell an abandoned run from a broken
 * one**, and for a long time it could not: the whole of `playRun` sat inside a
 * bare `catch {}` written on the note that an abandoned decision was the only
 * non-finishing exit. It is not — anything `core/` throws lands there too —
 * and a swallowed `RangeError` leaves the player on a screen whose question is
 * already answered, with no control that advances the run and no error
 * anywhere. See `docs/spec/gymrun-patch-carry-on-softlock.md`.
 */
export class RunAbandoned extends Error {
  constructor(message = 'Run abandoned') {
    super(message);
    this.name = 'RunAbandoned';
  }
}

/** Whether a rejection is a run the player walked away from. */
export function isRunAbandoned(error: unknown): error is RunAbandoned {
  return error instanceof RunAbandoned;
}

export interface Pending<T> {
  /** Park until `submit` is called. */
  wait(): Promise<T>;
  /** Resolve the question currently being asked. False if nothing is asked. */
  submit(value: T): boolean;
  cancel(reason?: string): void;
  isWaiting(): boolean;
}

export function createPending<T>(): Pending<T> {
  let resolve: ((value: T) => void) | null = null;
  let reject: ((error: Error) => void) | null = null;

  const settle = (): void => {
    resolve = null;
    reject = null;
  };

  return {
    wait: () =>
      new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      }),
    submit(value) {
      if (!resolve) return false;
      const done = resolve;
      settle();
      done(value);
      return true;
    },
    cancel(reason = 'Run abandoned') {
      if (!reject) return;
      const fail = reject;
      settle();
      fail(new RunAbandoned(reason));
    },
    isWaiting: () => resolve !== null,
  };
}
