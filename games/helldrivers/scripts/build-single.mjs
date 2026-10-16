// Builds the whole game into ONE file you can double-click to play (no
// server, no install). Run: npm run build:single
// It's written twice, with the same content:
//   HELLDRIVERS.html  to double-click on your computer
//   index.html        what websites open by default
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, rmSync } from 'node:fs';

await build({
  root: 'src',
  base: './',
  plugins: [viteSingleFile()],
  build: { outDir: '../.single-build', emptyOutDir: true, chunkSizeWarningLimit: 10000 },
  logLevel: 'warn',
});
copyFileSync('.single-build/index.html', 'HELLDRIVERS.html');
copyFileSync('.single-build/index.html', 'index.html');
rmSync('.single-build', { recursive: true, force: true });
console.log('Built HELLDRIVERS.html (double-click it to play) and index.html (for your website).');
