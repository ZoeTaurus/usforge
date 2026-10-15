import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the built game works from any folder on your website.
  base: './',
  build: { chunkSizeWarningLimit: 6000 },
});
