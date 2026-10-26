import { test } from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextLocalMidnight, MIDNIGHT_BUFFER_MS } from '../src/clock.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Delays below are the pure distance to midnight; the buffer is added on top.
const inNewYork = process.env.TZ === 'America/New_York';

test('the buffer is a small positive number of milliseconds', () => {
  assert.ok(MIDNIGHT_BUFFER_MS > 0 && MIDNIGHT_BUFFER_MS <= 5 * SECOND);
});

test('a normal evening is the time left until midnight plus the buffer', () => {
  const now = new Date(2026, 9, 20, 18, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 6 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('one second before midnight waits one second plus the buffer', () => {
  const now = new Date(2026, 9, 20, 23, 59, 59);
  assert.equal(msUntilNextLocalMidnight(now), SECOND + MIDNIGHT_BUFFER_MS);
});

test('milliseconds inside the last second count', () => {
  const now = new Date(2026, 9, 20, 23, 59, 59, 500);
  assert.equal(msUntilNextLocalMidnight(now), 500 + MIDNIGHT_BUFFER_MS);
});

test('exactly at midnight waits for the next midnight, not zero', () => {
  const now = new Date(2026, 9, 20, 0, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 24 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('a month end rolls into the next month', () => {
  const now = new Date(2026, 9, 31, 22, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 2 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('a year end rolls into the next year', () => {
  const now = new Date(2026, 11, 31, 23, 30, 0);
  assert.equal(msUntilNextLocalMidnight(now), 30 * MINUTE + MIDNIGHT_BUFFER_MS);
});

test('a leap day rolls into March', () => {
  const now = new Date(2028, 1, 29, 12, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 12 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('the day before spring-forward ends in 30 minutes at 23:30', () => {
  const now = new Date(2026, 2, 7, 23, 30, 0);
  assert.equal(msUntilNextLocalMidnight(now), 30 * MINUTE + MIDNIGHT_BUFFER_MS);
});

test('the result always lands on the next local midnight, in any time zone', () => {
  for (const [y, m, d, h] of [[2026, 2, 8, 0], [2026, 2, 8, 12], [2026, 10, 1, 0], [2026, 10, 1, 12], [2026, 9, 25, 23]]) {
    const now = new Date(y, m, d, h, 30, 0);
    const fires = new Date(now.getTime() + msUntilNextLocalMidnight(now) - MIDNIGHT_BUFFER_MS);
    const expected = new Date(y, m, d + 1);
    assert.equal(fires.getTime(), expected.getTime());
  }
});

test('spring-forward day is 23 hours long (New York only)', { skip: !inNewYork && 'needs TZ=America/New_York' }, () => {
  // 2026-03-08 00:30 EST. Clocks jump 02:00 -> 03:00, so the day has 23 hours.
  const now = new Date(2026, 2, 8, 0, 30, 0);
  assert.equal(msUntilNextLocalMidnight(now), 22 * HOUR + 30 * MINUTE + MIDNIGHT_BUFFER_MS);
});

test('spring-forward day: 00:00 start waits 23 hours (New York only)', { skip: !inNewYork && 'needs TZ=America/New_York' }, () => {
  const now = new Date(2026, 2, 8, 0, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 23 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('fall-back day is 25 hours long (New York only)', { skip: !inNewYork && 'needs TZ=America/New_York' }, () => {
  // 2026-11-01 00:00 EDT. Clocks repeat 01:00-02:00, so the day has 25 hours.
  const now = new Date(2026, 10, 1, 0, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), 25 * HOUR + MIDNIGHT_BUFFER_MS);
});

test('a time after the repeated hour on fall-back day counts the extra hour (New York only)', { skip: !inNewYork && 'needs TZ=America/New_York' }, () => {
  const now = new Date(2026, 10, 1, 23, 0, 0);
  assert.equal(msUntilNextLocalMidnight(now), HOUR + MIDNIGHT_BUFFER_MS);
});
