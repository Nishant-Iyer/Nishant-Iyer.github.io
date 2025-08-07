const { readFileSync } = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('body has theme transitions', () => {
  const css = readFileSync('style.css', 'utf8');
  assert.match(css, /body\s*{[^}]*transition:\s*background-color 0\.5s, color 0\.5s;/);
});

test('.icon transitions filter and opacity', () => {
  const css = readFileSync('style.css', 'utf8');
  assert.match(css, /\.icon\s*{[^}]*transition:\s*filter 0\.5s, opacity 0\.5s;/);
});

test('theme toggle toggles dark class', () => {
  const js = readFileSync('script.js', 'utf8');
  assert.ok(js.includes("document.body.classList.toggle('dark')"));
});
