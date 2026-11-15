import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../legacy/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('light workspace uses legible neutral theme and light 3D canvas', () => {
  assert.match(html, /name="theme-color" content="#ffffff"/);
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /--panel:\s*#f9f9f9/);
  assert.match(css, /--surface:\s*#ffffff/);
  assert.match(css, /\.primary-btn\s*\{[^}]*background:\s*#191919/s);
  assert.match(scene, /this\.scene\.background\s*=\s*new THREE\.Color\(0xe0e6e4\)/);
  assert.match(app, /fill="#f7f8f8"/);
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
});

test('restyle preserves every primary editing and export control', () => {
  for (const id of [
    'stadiumCanvas', 'outlineSvg', 'outlineEditor', 'tabContent',
    'newProject', 'saveProject', 'openProject', 'undoBtn', 'redoBtn',
    'exportGlb', 'exportJson', 'exportCsv', 'referenceUpload', 'referenceOpacity',
    'showOutlineTab', 'showAislesTab', 'selectionInfo',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} remains in the DOM`);
  }
  for (const view of ['orbit', 'plan', 'seat', 'outline']) {
    assert.match(html, new RegExp(`data-view="${view}"`));
  }
});
