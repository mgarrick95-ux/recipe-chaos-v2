import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultWeekStart, validWeekStart } from './weeks.ts';

test('a UTC Monday before midnight in Alberta remains in the previous local week', () => {
  assert.equal(defaultWeekStart(new Date('2026-09-21T02:00:00Z')), '2026-09-14');
  assert.equal(defaultWeekStart(new Date('2026-09-21T07:00:00Z')), '2026-09-21');
});

test('only real Monday dates can identify a weekly plan', () => {
  assert.equal(validWeekStart('2026-09-14'), true);
  for (const value of ['2026-09-15', '2026-02-30', '2026-9-14', '2026-09-14T00:00:00Z'])
    assert.equal(validWeekStart(value), false);
});
