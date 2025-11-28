import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/core/sdk.ts'),
      name: 'TraceableSDK',
      fileName: (format) => `sdk.${format}.js`,
    },
    rollupOptions: {
      // Ensure external dependencies are not bundled into the library
      // if we want them to be peer dependencies. 
      // For this MVP, we might want to bundle them to make it "lightweight" in terms of usage (single file).
      // However, usually libraries externalize deps. 
      // Given "lightweight" requirement, bundling might be better for drop-in usage, 
      // but let's stick to standard library practices unless specified otherwise.
      // Wait, user said "lightweight 'rewindable screen recording' SDK". 
      // Usually that means small bundle size. Bundling rrweb (heavy) might make it large.
      // But for a standalone SDK, we usually bundle everything.
      // Let's bundle everything for now as it's an SDK.
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
        // Worker plugins if needed
    ]
  }
});
