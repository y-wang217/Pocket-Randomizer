/**
 * Modules the build serves rather than the tree. Declared here so `tsc` can
 * type an import the file system cannot resolve.
 */

/**
 * The content hash, computed over `src/data/**` at build time by
 * `build-config/content-hash.ts` and served by its Vite plugin. Imported by
 * `src/core/contentHash.ts` and nothing else.
 */
declare module 'virtual:gymrun/content-hash' {
  export const CONTENT_HASH: string;
}
