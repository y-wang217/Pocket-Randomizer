import { defineConfig } from 'vitest/config';

import { contentHash } from './build-config/content-hash';
import { trimSimData } from './build-config/trim-sim-data';

export default defineConfig({
  // Applied to the test run as well as the build, so the suite proves the
  // trimmed data really is unused rather than assuming it.
  plugins: [trimSimData(), contentHash()],
  // Relative base so the static bundle deploys under any path on any host.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    // Bundle size is a named project risk, so always report transfer cost.
    reportCompressedSize: true,
    // We are shipping a Pokemon engine; one large chunk is the expected shape,
    // not a code-splitting oversight (docs/engine-notes.md section 4 has the
    // breakdown). The limit is set just above the current size so that a
    // regression still trips the warning. Since Stage 6.0 checkpoint 9 there
    // is a second chunk beside it: the encounter library's route trainers,
    // from the one dynamic import in src/ui/app.ts, installed before the
    // first run (docs/generation.md section 108).
    chunkSizeWarningLimit: 3500,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // The whole encounter library, installed before any test generates a
    // run (checkpoint 9). The registry test resets modules to prove the
    // throw without it.
    setupFiles: ['test/setup/encounter-library.ts'],
    /*
     * Raised from the 5s default in Stage 4.
     *
     * Two of the resume tests replay a whole run from *every* save point, which
     * is quadratic in the length of a run — and Stage 4 made runs longer twice
     * over: opponents field `PARTY_SIZE + advantage` Pokemon, so every team on
     * the map grew, and switching adds turns on top of that. The tests were not
     * slow because they were doing something wasteful; they were slow because
     * there is more run to replay, and shortening them would trade the property
     * they prove (resume works from *any* point, not a convenient one) for a
     * number in a config file.
     */
    testTimeout: 60_000,
  },
});
