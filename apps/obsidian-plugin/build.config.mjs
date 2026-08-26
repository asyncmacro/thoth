import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';

const outDir = process.env.RELEASE_OUT ?? 'dist';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: `${outDir}/main.js`,
  platform: 'browser',
  target: 'es2020',
  format: 'cjs',
  external: ['obsidian'],
  sourcemap: true,
});

mkdirSync(outDir, { recursive: true });
copyFileSync('manifest.json', `${outDir}/manifest.json`);
if (existsSync('styles.css')) {
  copyFileSync('styles.css', `${outDir}/styles.css`);
}
