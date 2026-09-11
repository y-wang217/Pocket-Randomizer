/**
 * The gallery build: `gallery.html` alone, to `dist-gallery/`. Not the app.
 * See src/ui/gallery.ts.
 */
import { defineConfig } from 'vite';

import { contentHash } from './build-config/content-hash';
import { trimSimData } from './build-config/trim-sim-data';

export default defineConfig({
  plugins: [trimSimData(), contentHash()],
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist-gallery',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 3500,
    rollupOptions: { input: 'gallery.html' },
  },
});
