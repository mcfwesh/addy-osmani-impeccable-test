import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from '../src/dates.js';

test('addDays adds one day within a month', () => {
  assert.equal(addDays('2026-10-10', 1), '2026-10-11');
});

test('addDays subtracts one day within a month', () => {
  assert.equal(addDays('2026-10-10', -1), '2026-10-09');
});

test('addDays with 0 returns the same date', () => {
  assert.equal(addDays('2026-10-10', 0), '2026-10-10');
});

test('addDays crosses a month end going forward', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('addDays crosses a year end going forward', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('addDays crosses a year start going backward', () => {
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('addDays reaches Feb 29 in a leap year', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});

test('addDays moves from Feb 29 to Mar 1 in a leap year', () => {
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
});

test('addDays skips Feb 29 in a non-leap year', () => {
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
});

test('addDays is correct across the spring US daylight saving change', () => {
  const dstDate = addDays('2026-03-07', 1);
  assert.equal(dstDate, '2026-03-08');
  assert.equal(addDays(dstDate, 1), '2026-03-09');
});

test('addDays is correct across the autumn US daylight saving change', () => {
  const dstDate = addDays('2026-10-31', 1);
  assert.equal(dstDate, '2026-11-01');
  assert.equal(addDays(dstDate, 1), '2026-11-02');
});

test('addDays handles a large positive n across a year', () => {
  assert.equal(addDays('2026-10-25', 365), '2027-10-25');
});

test('addDays handles a large negative n across a year', () => {
  assert.equal(addDays('2026-10-25', -365), '2025-10-25');
});
