import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}

function appFilesFromSw() {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const match = /const APP_FILES = \[([\s\S]*?)\];/.exec(source);
  assert.ok(match, 'sw.js must define const APP_FILES = [...]');
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

test('sw.js has one version line the deploy step can replace', () => {
  const source = readFileSync(join(root, 'sw.js'), 'utf8');
  const lines = source.split('\n').filter((line) => line.startsWith('const VERSION ='));
  assert.deepEqual(lines, ["const VERSION = 'dev';"]);
  assert.match(source, /habit-tracker-\$\{VERSION\}/);
});

test('APP_FILES equals the deployable files on disk', () => {
  const onDisk = new Set([
    './',
    './index.html',
    './manifest.webmanifest',
    './styles.css',
    ...listFiles('icons').map((p) => `./${p}`),
    ...listFiles('src').map((p) => `./${p}`),
  ]);
  const cached = appFilesFromSw();
  assert.equal(new Set(cached).size, cached.length, 'APP_FILES has duplicates');
  assert.deepEqual([...cached].sort(), [...onDisk].sort());
});

test('APP_FILES entries are all relative', () => {
  for (const file of appFilesFromSw()) assert.ok(file.startsWith('./'), file);
});

test('manifest uses relative start_url and scope', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
});

test('every manifest icon exists and uses a relative path', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(manifest.icons.length >= 3);
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), icon.src);
    assert.ok(existsSync(join(root, icon.src)), `${icon.src} is missing`);
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
});

test('index.html has no root-absolute src or href', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(!html.includes('src="/'));
  assert.ok(!html.includes('href="/'));
});

test('index.html links the manifest and the apple touch icon', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.ok(existsSync(join(root, 'icons/apple-touch-icon.png')));
});
