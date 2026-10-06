/** Types for the gate's tally reading, so `test/check-gate.test.ts` can import it. */
export const REPORTER_RPC_TIMEOUT: RegExp;
export const ALL_FILES_PASSED: RegExp;
export const ANY_FAILED: RegExp;
export const ANSI: RegExp;
/** The output with its colour taken off. See `check-tally.mjs`. */
export function plain(output: string): string;
/** Every test passed and only the reporter channel fell over. Deliberately narrow. */
export function everyTestPassedAnyway(output: string): boolean;
/** `"120 files, 1650 tests"`, or `"every test"` when there is no tally to read. */
export function tally(output: string): string;
