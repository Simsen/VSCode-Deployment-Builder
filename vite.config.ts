import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Produces a single self-contained dist/index.html with all JS/CSS inlined,
// so the output runs from file:// without a web server. This matches the
// "run locally from browser" requirement (DESIGN.md, Decision 15).
export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
