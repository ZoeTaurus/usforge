// Builds the whole game into ONE file, HELLDRIVE.html, that you can
// double-click to play (no server, no install). Run: npm run build:single
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, rmSync } from 'node:fs';

await build({
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '.single-build', emptyOutDir: true, chunkSizeWarningLimit: 10000 },
  logLevel: 'warn',
});
copyFileSync('.single-build/index.html', 'HELLDRIVE.html');
rmSync('.single-build', { recursive: true, force: true });
console.log('Built HELLDRIVE.html — double-click it to play.');
