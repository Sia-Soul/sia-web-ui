import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const source = new URL('../packages/react/src/', import.meta.url);
const files = readdirSync(source).filter(name => name.endsWith('.css'));

for (const name of files) {
  const css = readFileSync(new URL(name, source), 'utf8');
  test(name + ': no extra focus outlines or halo shadows', () => {
    assert.ok(!css.includes('\uFFFD'), 'CSS must retain valid UTF-8 text');
    if (name !== 'focus.css') {
      assert.match(css, /@import "\.\/focus\.css";/, 'Standalone styles must load the scoped native focus reset');
    }
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      assert.doesNotMatch(body, /(?:box-shadow|outline|stroke):[^;]*var\(--sia-color-focus-ring\)/, selector.trim());
      if (!selector.includes(':focus')) continue;
      for (const [, property, value] of body.matchAll(/(outline|box-shadow|filter):\s*([^;]+);/g)) {
        assert.match(value.trim(), /^(none|0)(\s*!important)?$/, selector.trim() + ': ' + property);
      }
    }
  });
}

test('native reset is scoped to components, not the whole application', () => {
  const css = readFileSync(new URL('focus.css', source), 'utf8');
  assert.match(css, /:where\(\[class\^="sia-"\], \[class\*=" sia-"\]\):focus/);
  assert.match(css, /:where\(\[class\^="sia-"\], \[class\*=" sia-"\]\) :focus/);
  assert.doesNotMatch(css, /\*\s*:focus/);
});

test('input status borders and popup elevation remain intact', () => {
  const css = readFileSync(new URL('styles.css', source), 'utf8');
  assert.match(css, /\.sia-input-control:focus-within[^{}]*\{[^}]*border-color: var\(--sia-color-primary\)/);
  assert.match(css, /\.sia-input-control--error:focus-within[^{}]*\{[^}]*border-color: var\(--sia-color-error\)/);
  assert.match(css, /\.sia-modal\s*\{[^}]*box-shadow: var\(--sia-shadow-popup\)/);
});
