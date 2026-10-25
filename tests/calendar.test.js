import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeeks, weekdayNames, monthName, dateLabel, shiftMonth } from '../src/calendar.js';

const days = (weeks) => weeks.flat().filter(Boolean).map((d) => d.date);
const blanks = (week) => week.map((d) => d === null);

test('October 2026, week starts Monday: 3 leading blanks, 31 days, 1 trailing blank', () => {
  const weeks = calendarWeeks(2026, 10, 1);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.length, 5);
  assert.deepEqual(blanks(weeks[0]), [true, true, true, false, false, false, false]);
  assert.equal(weeks[0][3].date, '2026-10-01');
  assert.deepEqual(blanks(weeks[4]), [false, false, false, false, false, false, true]);
  assert.equal(days(weeks).length, 31);
  assert.equal(days(weeks)[30], '2026-10-31');
});

test('October 2026, week starts Sunday: 4 leading blanks, 31 days, no trailing blanks', () => {
  const weeks = calendarWeeks(2026, 10, 0);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.length, 5);
  assert.deepEqual(blanks(weeks[0]), [true, true, true, true, false, false, false]);
  assert.deepEqual(blanks(weeks[4]), [false, false, false, false, false, false, false]);
  assert.equal(days(weeks).length, 31);
});

test('February 2028 (leap) has 29 days', () => {
  const weeks = calendarWeeks(2028, 2, 1);
  assert.equal(days(weeks).length, 29);
  assert.equal(days(weeks).at(-1), '2028-02-29');
  assert.ok(weeks.every((w) => w.length === 7));
});

test('a month that starts on the week start day has no leading blanks', () => {
  const weeks = calendarWeeks(2026, 6, 1); // 1 June 2026 is a Monday
  assert.equal(weeks[0][0].date, '2026-06-01');
});

test('February 2027 starting Monday and ending Sunday fills exactly 4 rows with no blanks', () => {
  const weeks = calendarWeeks(2027, 2, 1); // 1 Feb 2027 is a Monday, 28 days
  assert.equal(weeks.length, 4);
  assert.ok(weeks.flat().every((d) => d !== null));
});

test('weekdayNames starts at the week start day', () => {
  assert.deepEqual(weekdayNames(1), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  assert.equal(weekdayNames(0)[0], 'Sunday');
  assert.equal(weekdayNames(0)[6], 'Saturday');
});

test('monthName is 1-based', () => {
  assert.equal(monthName(10), 'October');
  assert.equal(monthName(1), 'January');
});

test('dateLabel gives weekday, day, month and year', () => {
  assert.equal(dateLabel('2026-10-19'), 'Monday 19 October 2026');
  assert.equal(dateLabel('2026-10-25'), 'Sunday 25 October 2026');
});

test('shiftMonth moves across year boundaries', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 10 }, -1), { year: 2026, month: 9 });
});
