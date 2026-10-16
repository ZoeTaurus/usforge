import { defineConfig } from 'vite';

export default defineConfig({
  // The game's web page (index.html) lives in src/ with the rest of the code.
  root: 'src',
  // Relative paths so the built game works from any folder on your website.
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 6000 },
});
