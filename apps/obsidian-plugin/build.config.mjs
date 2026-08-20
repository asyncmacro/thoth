import { build } from 'esbuild';

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
