import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManualShopping } from './manual-entry.ts';

const input = { displayName: '  Apples  ', quantity: '2.5', unit: '  bags ', intention: 'this_week' as const };

test('keeps the shopper’s wording while trimming entry whitespace', () => {
  assert.deepEqual(buildManualShopping(input), {
    displayName: 'Apples', quantity: 2.5, unit: 'bags', intention: 'this_week',
  });
  assert.deepEqual(buildManualShopping({ ...input, quantity: '', unit: '' }), {
    displayName: 'Apples', quantity: null, unit: null, intention: 'this_week',
  });
});

test('rejects invalid amounts and intentions from a forged request', () => {
  for (const quantity of ['-1', 'Infinity', 'not a number']) {
    assert.throws(() => buildManualShopping({ ...input, quantity }));
  }
  assert.throws(() => buildManualShopping({ ...input, intention: 'plan' as typeof input.intention }));
  assert.throws(() => buildManualShopping({ ...input, displayName: '   ' }));
});
