import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  todayDate,
  isValidDate,
  compareDates,
  startOfWeek,
  monthDays,
} from '../src/dates.js';

test('addDays crosses a month end', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('addDays crosses a year end', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('addDays with negative n crosses month and year starts', () => {
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
});

test('addDays with 0 returns the same date', () => {
  assert.equal(addDays('2026-05-05', 0), '2026-05-05');
});

test('addDays handles a leap day', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2028-02-29', 1), '2028-03-01');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
});

test('addDays is correct across US DST days', () => {
  assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-03-09', -1), '2026-03-08');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-11-01', 1), '2026-11-02');
  assert.equal(addDays('2026-11-02', -2), '2026-10-31');
});

test('todayDate returns the local calendar date', () => {
  assert.equal(todayDate(new Date(2026, 9, 25, 14, 30)), '2026-10-25');
});

test('todayDate near local midnight', () => {
  assert.equal(todayDate(new Date(2026, 9, 25, 0, 0, 0)), '2026-10-25');
  assert.equal(todayDate(new Date(2026, 9, 24, 23, 59, 59, 999)), '2026-10-24');
});

test('todayDate on US DST days', () => {
  assert.equal(todayDate(new Date(2026, 2, 8, 12, 0)), '2026-03-08');
  assert.equal(todayDate(new Date(2026, 2, 8, 23, 59)), '2026-03-08');
  assert.equal(todayDate(new Date(2026, 10, 1, 0, 30)), '2026-11-01');
  assert.equal(todayDate(new Date(2026, 10, 1, 23, 59)), '2026-11-01');
});

test('todayDate pads month and day', () => {
  assert.equal(todayDate(new Date(2026, 0, 5, 9, 0)), '2026-01-05');
});

test('isValidDate accepts real dates', () => {
  assert.equal(isValidDate('2026-01-05'), true);
  assert.equal(isValidDate('2028-02-29'), true);
  assert.equal(isValidDate('2026-12-31'), true);
});

test('isValidDate rejects non-strings', () => {
  for (const value of [undefined, null, 20260105, new Date(), {}, []]) {
    assert.equal(isValidDate(value), false);
  }
});

test('isValidDate rejects bad formats', () => {
  for (const value of ['2026-1-05', '2026/01/05', '20260105', '2026-01-05 ', ' 2026-01-05', '2026-01-05T00:00', '', 'abcd-ef-gh']) {
    assert.equal(isValidDate(value), false, value);
  }
});

test('isValidDate rejects impossible dates', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29', '2026-04-31', '2026-01-00']) {
    assert.equal(isValidDate(value), false, value);
  }
});

test('compareDates orders dates', () => {
  assert.ok(compareDates('2026-01-01', '2026-01-02') < 0);
  assert.ok(compareDates('2026-01-02', '2026-01-01') > 0);
  assert.equal(compareDates('2026-01-01', '2026-01-01'), 0);
  assert.ok(compareDates('2025-12-31', '2026-01-01') < 0);
});

test('compareDates works as a sort comparator', () => {
  const sorted = ['2026-03-01', '2025-12-31', '2026-01-15'].sort(compareDates);
  assert.deepEqual(sorted, ['2025-12-31', '2026-01-15', '2026-03-01']);
});

// 2026-10-25 is a Sunday.
test('startOfWeek for every weekStartsOn value (date is a Sunday)', () => {
  const expected = {
    0: '2026-10-25', // Sunday: date is the week start
    1: '2026-10-19',
    2: '2026-10-20',
    3: '2026-10-21',
    4: '2026-10-22',
    5: '2026-10-23',
    6: '2026-10-24',
  };
  for (const [weekStartsOn, start] of Object.entries(expected)) {
    assert.equal(startOfWeek('2026-10-25', Number(weekStartsOn)), start, `weekStartsOn ${weekStartsOn}`);
  }
});

test('startOfWeek returns the date itself when it is the week start', () => {
  // 2026-10-26 is a Monday.
  assert.equal(startOfWeek('2026-10-26', 1), '2026-10-26');
});

test('startOfWeek mid-week', () => {
  // 2026-10-28 is a Wednesday.
  assert.equal(startOfWeek('2026-10-28', 1), '2026-10-26');
  assert.equal(startOfWeek('2026-10-28', 0), '2026-10-25');
  assert.equal(startOfWeek('2026-10-28', 3), '2026-10-28');
  assert.equal(startOfWeek('2026-10-28', 4), '2026-10-22');
});

test('startOfWeek crosses month and year boundaries', () => {
  // 2026-01-01 is a Thursday.
  assert.equal(startOfWeek('2026-01-01', 1), '2025-12-29');
  assert.equal(startOfWeek('2026-01-01', 0), '2025-12-28');
  // 2026-11-01 is a Sunday.
  assert.equal(startOfWeek('2026-11-01', 1), '2026-10-26');
});

test('startOfWeek across US DST days', () => {
  // 2026-03-08 is a Sunday.
  assert.equal(startOfWeek('2026-03-08', 1), '2026-03-02');
  assert.equal(startOfWeek('2026-03-08', 0), '2026-03-08');
});

test('monthDays returns 29 days for Feb 2028', () => {
  const days = monthDays(2028, 2);
  assert.equal(days.length, 29);
  assert.equal(days[0], '2028-02-01');
  assert.equal(days[28], '2028-02-29');
});

test('monthDays returns 28 days for Feb 2026', () => {
  const days = monthDays(2026, 2);
  assert.equal(days.length, 28);
  assert.equal(days[27], '2026-02-28');
});

test('monthDays returns 30 days for April', () => {
  const days = monthDays(2026, 4);
  assert.equal(days.length, 30);
  assert.equal(days[0], '2026-04-01');
  assert.equal(days[29], '2026-04-30');
});

test('monthDays returns 31 days for December', () => {
  const days = monthDays(2026, 12);
  assert.equal(days.length, 31);
  assert.equal(days[0], '2026-12-01');
  assert.equal(days[30], '2026-12-31');
});

test('monthDays returns consecutive valid dates', () => {
  const days = monthDays(2026, 3);
  for (let i = 1; i < days.length; i++) {
    assert.equal(addDays(days[i - 1], 1), days[i]);
  }
});
