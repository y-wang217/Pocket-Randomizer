import { defineConfig } from 'vitest/config';

import { trimSimData } from './build-config/trim-sim-data';

export default defineConfig({
  // Applied to the test run as well as the build, so the suite proves the
  // trimmed data really is unused rather than assuming it.
  plugins: [trimSimData()],
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
    // regression still trips the warning.
    chunkSizeWarningLimit: 3500,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
