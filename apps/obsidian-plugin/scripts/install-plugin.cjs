#!/usr/bin/env node
const { execSync } = require('node:child_process');
const { readFileSync, readdirSync, mkdirSync, cpSync } = require('node:fs');
const { resolve, join } = require('node:path');

const vaultPathArg = process.argv[2];
if (!vaultPathArg) {
  console.error('Usage: pnpm plugin:install <vault-path>');
  process.exit(1);
}

const vaultPath = resolve(vaultPathArg);
try {
  const stats = require('node:fs').statSync(vaultPath);
  if (!stats.isDirectory()) {
    console.error('Error: vault path is not a directory');
    process.exit(1);
  }
} catch {
  console.error('Error: vault path does not exist');
  process.exit(1);
}

// 1. Build plugin
console.log('Building plugin...');
try {
  execSync('pnpm build', { stdio: 'inherit', cwd: __dirname + '/..' });
} catch (err) {
  console.error('Build failed');
  process.exit(1);
}

// 2. Resolve plugin folder name from manifest.json
const manifestPath = join(__dirname, '..', 'manifest.json');
let pluginFolder;
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const raw = manifest.id || manifest.name || 'thoth-sync';
  pluginFolder = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
} catch (err) {
  console.error('Error reading manifest.json:', err.message);
  process.exit(1);
}

// 3. Target directory
const target = join(vaultPath, '.obsidian', 'plugins', pluginFolder);
mkdirSync(target, { recursive: true });

// 4. Copy dist contents into target
const distDir = join(__dirname, '..', 'dist');
if (!require('node:fs').existsSync(distDir)) {
  console.error('Error: dist directory not found after build');
  process.exit(1);
}

const allowed = new Set(['manifest.json', 'main.js', 'main.js.map', 'styles.css'])
for (const entry of readdirSync(distDir)) {
  if (!allowed.has(entry)) continue;
  const src = join(distDir, entry);
  const dst = join(target, entry);
  cpSync(src, dst, { recursive: true, force: true });
}

console.log(`Installed ${pluginFolder} → ${target}`);
