import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the static bundle deploys under any path on any host.
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    // Bundle size is a named project risk, so always report transfer cost.
    reportCompressedSize: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
