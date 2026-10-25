import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatStreak } from '../src/views/format.js';

test('daily streaks use days', () => {
  assert.equal(formatStreak(0, 'daily'), '0 days');
  assert.equal(formatStreak(1, 'daily'), '1 day');
  assert.equal(formatStreak(4, 'daily'), '4 days');
});

test('weekly streaks use weeks', () => {
  assert.equal(formatStreak(0, 'weekly'), '0 weeks');
  assert.equal(formatStreak(1, 'weekly'), '1 week');
  assert.equal(formatStreak(3, 'weekly'), '3 weeks');
});
