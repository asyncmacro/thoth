import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  platform: 'browser',
  target: 'es2020',
  format: 'cjs',
  external: ['obsidian'],
  sourcemap: true,
});

mkdirSync('dist', { recursive: true });
copyFileSync('manifest.json', 'dist/manifest.json');
