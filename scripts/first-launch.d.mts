/**
 * Types for `scripts/first-launch.mjs`. Named `.d.mts` so that `moduleResolution: bundler` finds it beside the `.mjs` it describes.
 *
 * The module itself is plain ESM because `scripts/smoke.mjs` runs under Node
 * against a built bundle and cannot import TypeScript — see that file's
 * header. Two test files import it as well, and `tsconfig.json` sets no
 * `allowJs`, so the declaration lives here rather than the module being a
 * `.ts` that the smoke run could not read.
 */

/** Seen every greeting there will ever be. */
export declare const SEEN_EVERY_INTRO: number;

/** Every glyph family, past its third exposure in the returning store. M6.1. */
export declare const EXPOSED_FAMILIES: readonly string[];

/** The stored settings a returning player has, as a JSON string. */
export declare function notFirstLaunch(options?: { density?: string; }): string;
