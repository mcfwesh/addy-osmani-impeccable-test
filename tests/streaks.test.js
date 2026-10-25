import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  currentDailyStreak,
  bestDailyStreak,
  currentWeeklyStreak,
  bestWeeklyStreak,
  currentStreak,
  bestStreak,
  weekProgress,
  weekStatus,
} from '../src/streaks.js';

const todayDate = '2026-10-25';

test('current streak counts back from yesterday when today is still pending', () => {
  const doneDates = ['2026-10-22', '2026-10-23', '2026-10-24'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 3);
});

test('current streak counts back from today when today is done', () => {
  const doneDates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 4);
});

test('current streak is 0 when yesterday is missed and today is not done', () => {
  const doneDates = ['2026-10-22', '2026-10-23'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 0);
});

test('current streak recovers when a past-day edit fills the gap', () => {
  const before = ['2026-10-22', '2026-10-23'];
  const after = ['2026-10-22', '2026-10-23', '2026-10-24'];
  assert.equal(currentDailyStreak(before, todayDate), 0);
  assert.equal(currentDailyStreak(after, todayDate), 3);
});

test('empty history gives current 0 and best 0', () => {
  assert.equal(currentDailyStreak([], todayDate), 0);
  assert.equal(bestDailyStreak([], todayDate), 0);
});

test('only today done gives current 1', () => {
  assert.equal(currentDailyStreak(['2026-10-25'], todayDate), 1);
});

test('only yesterday done gives current 1', () => {
  assert.equal(currentDailyStreak(['2026-10-24'], todayDate), 1);
});

test('only two days ago done gives current 0', () => {
  assert.equal(currentDailyStreak(['2026-10-23'], todayDate), 0);
});

test('a missed day in the middle limits current and best to 2', () => {
  const doneDates = ['2026-10-20', '2026-10-21', '2026-10-23', '2026-10-24'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 2);
  assert.equal(bestDailyStreak(doneDates, todayDate), 2);
});

test('unmarking a day splits a run', () => {
  const before = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const after = ['2026-10-21', '2026-10-22', '2026-10-24'];
  assert.equal(currentDailyStreak(before, todayDate), 4);
  assert.equal(bestDailyStreak(before, todayDate), 4);
  assert.equal(currentDailyStreak(after, todayDate), 1);
  assert.equal(bestDailyStreak(after, todayDate), 2);
});

test('best streak can be older and longer than the current streak', () => {
  const doneDates = [
    '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
    '2026-10-24', '2026-10-25',
  ];
  assert.equal(currentDailyStreak(doneDates, todayDate), 2);
  assert.equal(bestDailyStreak(doneDates, todayDate), 5);
});

test('best streak equals the current run when the current run is longest', () => {
  const doneDates = [
    '2026-10-01', '2026-10-02',
    '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
  ];
  assert.equal(currentDailyStreak(doneDates, todayDate), 4);
  assert.equal(bestDailyStreak(doneDates, todayDate), 4);
});

test('future dates are ignored by current and best', () => {
  const doneDates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 2);
  assert.equal(bestDailyStreak(doneDates, todayDate), 2);
});

test('future dates cannot extend a run when today is pending', () => {
  const doneDates = ['2026-10-26', '2026-10-27'];
  assert.equal(currentDailyStreak(doneDates, todayDate), 0);
  assert.equal(bestDailyStreak(doneDates, todayDate), 0);
});

test('unsorted input with duplicates matches clean sorted input', () => {
  const clean = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
  const messy = ['2026-10-24', '2026-10-22', '2026-10-25', '2026-10-23', '2026-10-24', '2026-10-22'];
  assert.equal(currentDailyStreak(messy, todayDate), currentDailyStreak(clean, todayDate));
  assert.equal(bestDailyStreak(messy, todayDate), bestDailyStreak(clean, todayDate));
});

test('a run crosses a month boundary and the 2026-11-01 daylight saving change', () => {
  const doneDates = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  assert.equal(currentDailyStreak(doneDates, '2026-11-02'), 4);
  assert.equal(bestDailyStreak(doneDates, '2026-11-02'), 4);
});

// Weekly habits. Worked example from SPEC.md: week starts Monday, target 3,
// today is Sunday 2026-10-25, so the current week is 10-19 to 10-25.
const monday = 1;
const weekOf1005 = ['2026-10-05', '2026-10-06', '2026-10-07'];
const weekOf1012 = ['2026-10-12', '2026-10-13', '2026-10-14'];

test('weekly worked example: current week pending, count from last week back', () => {
  const doneDates = [...weekOf1005, ...weekOf1012, '2026-10-19', '2026-10-20'];
  assert.equal(currentWeeklyStreak(doneDates, 3, monday, todayDate), 2);
});

test('weekly worked example: marking a third day this week makes the current week hit', () => {
  const doneDates = [...weekOf1005, ...weekOf1012, '2026-10-19', '2026-10-20', '2026-10-21'];
  assert.equal(currentWeeklyStreak(doneDates, 3, monday, todayDate), 3);
});

test('weekly worked example: a missed last week and a pending current week give 0', () => {
  const doneDates = [...weekOf1005, '2026-10-12', '2026-10-13', '2026-10-19', '2026-10-20'];
  assert.equal(currentWeeklyStreak(doneDates, 3, monday, todayDate), 0);
});

test('weekly: a pending current week does not break the streak, and a hit current week adds one', () => {
  const lastWeek = ['2026-10-12', '2026-10-13'];
  assert.equal(currentWeeklyStreak([...lastWeek, '2026-10-19'], 2, monday, todayDate), 1);
  assert.equal(currentWeeklyStreak([...lastWeek, '2026-10-19', '2026-10-20'], 2, monday, todayDate), 2);
});

test('weekly: empty history gives current 0 and best 0', () => {
  assert.equal(currentWeeklyStreak([], 3, monday, todayDate), 0);
  assert.equal(bestWeeklyStreak([], 3, monday, todayDate), 0);
});

test('weekly: target 1 hits with a single done day', () => {
  const doneDates = ['2026-10-14', '2026-10-25'];
  assert.equal(currentWeeklyStreak(doneDates, 1, monday, todayDate), 2);
  assert.equal(bestWeeklyStreak(doneDates, 1, monday, todayDate), 2);
});

test('weekly: target 7 needs every day of the week', () => {
  const lastWeek = [
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
  ];
  assert.equal(currentWeeklyStreak(lastWeek, 7, monday, todayDate), 1);
  assert.equal(currentWeeklyStreak(lastWeek.slice(1), 7, monday, todayDate), 0);
  assert.equal(bestWeeklyStreak(lastWeek.slice(1), 7, monday, todayDate), 0);
});

test('weekly: more done days than the target still counts as one hit', () => {
  const doneDates = [
    '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
  ];
  assert.equal(currentWeeklyStreak(doneDates, 3, monday, todayDate), 1);
  assert.equal(bestWeeklyStreak(doneDates, 3, monday, todayDate), 1);
});

test('weekly: dates after today are ignored', () => {
  const doneDates = ['2026-10-12', '2026-10-13', '2026-10-27', '2026-10-28', '2026-11-02', '2026-11-03'];
  assert.equal(currentWeeklyStreak(doneDates, 2, monday, todayDate), 1);
  assert.equal(bestWeeklyStreak(doneDates, 2, monday, todayDate), 1);
});

test('weekly: duplicate dates do not count twice', () => {
  const doneDates = ['2026-10-12', '2026-10-12', '2026-10-12'];
  assert.equal(currentWeeklyStreak(doneDates, 2, monday, todayDate), 0);
  assert.equal(bestWeeklyStreak(doneDates, 2, monday, todayDate), 0);
});

// Today is Sunday 2026-10-25. For each weekStartsOn value: the first day of the
// current week, the day before it, and a day in the week before last week.
const weekStartCases = [
  { weekStartsOn: 0, weekStartDate: '2026-10-25', dayBefore: '2026-10-24', twoWeeksAgoDate: '2026-10-17' },
  { weekStartsOn: 1, weekStartDate: '2026-10-19', dayBefore: '2026-10-18', twoWeeksAgoDate: '2026-10-11' },
  { weekStartsOn: 2, weekStartDate: '2026-10-20', dayBefore: '2026-10-19', twoWeeksAgoDate: '2026-10-12' },
  { weekStartsOn: 3, weekStartDate: '2026-10-21', dayBefore: '2026-10-20', twoWeeksAgoDate: '2026-10-13' },
  { weekStartsOn: 4, weekStartDate: '2026-10-22', dayBefore: '2026-10-21', twoWeeksAgoDate: '2026-10-14' },
  { weekStartsOn: 5, weekStartDate: '2026-10-23', dayBefore: '2026-10-22', twoWeeksAgoDate: '2026-10-15' },
  { weekStartsOn: 6, weekStartDate: '2026-10-24', dayBefore: '2026-10-23', twoWeeksAgoDate: '2026-10-16' },
];

for (const { weekStartsOn, weekStartDate, dayBefore, twoWeeksAgoDate } of weekStartCases) {
  test(`weekly: weekStartsOn ${weekStartsOn} puts ${weekStartDate} in the current week and ${dayBefore} in last week`, () => {
    // Target 1: each done day makes its own week hit.
    assert.equal(currentWeeklyStreak([weekStartDate], 1, weekStartsOn, todayDate), 1);
    assert.equal(currentWeeklyStreak([dayBefore, weekStartDate], 1, weekStartsOn, todayDate), 2);
    assert.equal(currentWeeklyStreak([dayBefore], 1, weekStartsOn, todayDate), 1);
    assert.equal(currentWeeklyStreak([twoWeeksAgoDate], 1, weekStartsOn, todayDate), 0);
    assert.equal(bestWeeklyStreak([dayBefore, weekStartDate], 1, weekStartsOn, todayDate), 2);
  });
}

test('weekly: changing weekStartsOn moves days between weeks and changes the streak', () => {
  // Sunday 10-18 and Monday 10-19, target 2.
  const doneDates = ['2026-10-18', '2026-10-19'];
  // Monday start: the days fall in two different weeks, so neither week hits.
  assert.equal(currentWeeklyStreak(doneDates, 2, 1, todayDate), 0);
  assert.equal(bestWeeklyStreak(doneDates, 2, 1, todayDate), 0);
  // Sunday start: both days are in the week 10-18 to 10-24, which hits.
  assert.equal(currentWeeklyStreak(doneDates, 2, 0, todayDate), 1);
  assert.equal(bestWeeklyStreak(doneDates, 2, 0, todayDate), 1);
});

test('weekly: best streak can be earlier in history than the current streak', () => {
  const doneDates = [
    '2026-09-07', '2026-09-08', // week of 09-07 hits
    '2026-09-14', '2026-09-15', // week of 09-14 hits
    '2026-09-21', '2026-09-22', // week of 09-21 hits
    // weeks of 09-28 and 10-05 are missed
    '2026-10-12', '2026-10-13', // week of 10-12 hits
  ];
  assert.equal(currentWeeklyStreak(doneDates, 2, monday, todayDate), 1);
  assert.equal(bestWeeklyStreak(doneDates, 2, monday, todayDate), 3);
});

test('weekly: best streak includes the current week when it hits', () => {
  const doneDates = [
    '2026-10-05', '2026-10-06',
    '2026-10-12', '2026-10-13',
    '2026-10-19', '2026-10-20',
  ];
  assert.equal(currentWeeklyStreak(doneDates, 2, monday, todayDate), 3);
  assert.equal(bestWeeklyStreak(doneDates, 2, monday, todayDate), 3);
});

test('weekly: a run crosses a year boundary', () => {
  // Weeks of 2026-12-21, 2026-12-28, and 2027-01-04 each have one done day.
  const doneDates = ['2026-12-23', '2026-12-30', '2027-01-05'];
  assert.equal(currentWeeklyStreak(doneDates, 1, monday, '2027-01-06'), 3);
  assert.equal(bestWeeklyStreak(doneDates, 1, monday, '2027-01-06'), 3);
});

test('weekly: one week can span the year boundary', () => {
  // The week of 2026-12-28 runs to 2027-01-03.
  const doneDates = ['2026-12-31', '2027-01-01'];
  assert.equal(currentWeeklyStreak(doneDates, 2, monday, '2027-01-03'), 1);
  assert.equal(bestWeeklyStreak(doneDates, 2, monday, '2027-01-03'), 1);
});

const dailyHabit = {
  cadence: 'daily',
  weeklyTarget: null,
  done: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'],
};
const weeklyHabit = { ...dailyHabit, cadence: 'weekly', weeklyTarget: 3 };
const settings = { weekStartsOn: 1 };

test('currentStreak and bestStreak use the daily rules for a daily habit', () => {
  assert.equal(currentStreak(dailyHabit, settings, todayDate), 5);
  assert.equal(bestStreak(dailyHabit, settings, todayDate), 5);
});

test('currentStreak and bestStreak use the weekly rules for a weekly habit', () => {
  assert.equal(currentStreak(weeklyHabit, settings, todayDate), 1);
  assert.equal(bestStreak(weeklyHabit, settings, todayDate), 1);
});

test('changing weeklyTarget on the same done dates changes the streaks', () => {
  const harderHabit = { ...weeklyHabit, weeklyTarget: 6 };
  assert.equal(currentStreak(harderHabit, settings, todayDate), 0);
  assert.equal(bestStreak(harderHabit, settings, todayDate), 0);
});

test('changing weekStartsOn in settings changes a weekly habit streak', () => {
  // Done Tue to Sat. Target 5: hits with a Monday start (week 10-19 to 10-25).
  // With a Saturday start, 10-20 to 10-23 fall in one week and 10-24 in the next.
  const habit = { ...weeklyHabit, weeklyTarget: 5 };
  assert.equal(currentStreak(habit, { weekStartsOn: 1 }, todayDate), 1);
  assert.equal(currentStreak(habit, { weekStartsOn: 6 }, todayDate), 0);
  assert.equal(bestStreak(habit, { weekStartsOn: 6 }, todayDate), 0);
});

test('weekProgress counts done days this week while the week is pending', () => {
  const habit = { cadence: 'weekly', weeklyTarget: 3, done: ['2026-10-20', '2026-10-21'] };
  assert.deepEqual(weekProgress(habit, settings, todayDate), { done: 2, target: 3, hit: false });
});

test('weekProgress reports a hit when done days reach the target', () => {
  const habit = { cadence: 'weekly', weeklyTarget: 3, done: ['2026-10-20', '2026-10-21', '2026-10-22'] };
  assert.deepEqual(weekProgress(habit, settings, todayDate), { done: 3, target: 3, hit: true });
});

test('weekProgress reports more done days than the target', () => {
  const habit = {
    cadence: 'weekly',
    weeklyTarget: 3,
    done: ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-25'],
  };
  assert.deepEqual(weekProgress(habit, settings, todayDate), { done: 5, target: 3, hit: true });
});

test('weekProgress on the first day of the week does not count last week', () => {
  const habit = { cadence: 'weekly', weeklyTarget: 2, done: ['2026-10-24', '2026-10-25', '2026-10-26'] };
  assert.deepEqual(weekProgress(habit, settings, '2026-10-26'), { done: 1, target: 2, hit: false });
});

test('weekProgress follows weekStartsOn', () => {
  const habit = { cadence: 'weekly', weeklyTarget: 2, done: ['2026-10-24', '2026-10-25'] };
  assert.deepEqual(weekProgress(habit, { weekStartsOn: 1 }, todayDate), { done: 2, target: 2, hit: true });
  assert.deepEqual(weekProgress(habit, { weekStartsOn: 0 }, todayDate), { done: 1, target: 2, hit: false });
});

test('weekProgress ignores dates after today and duplicates', () => {
  const habit = {
    cadence: 'weekly',
    weeklyTarget: 3,
    done: ['2026-10-20', '2026-10-20', '2026-10-23', '2026-10-24'],
  };
  assert.deepEqual(weekProgress(habit, settings, '2026-10-22'), { done: 1, target: 3, hit: false });
});

test('weekProgress is null for a daily habit', () => {
  assert.equal(weekProgress(dailyHabit, settings, todayDate), null);
});

const weeklyWith = (target, done) => ({ cadence: 'weekly', weeklyTarget: target, done });

test('weekStatus is hit when done days reach the target', () => {
  const habit = weeklyWith(3, ['2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-12', todayDate), { done: 3, target: 3, hit: true, state: 'hit' });
});

test('weekStatus counts more done days than the target as hit', () => {
  const habit = weeklyWith(2, ['2026-10-12', '2026-10-13', '2026-10-14']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-12', todayDate), { done: 3, target: 2, hit: true, state: 'hit' });
});

test('weekStatus is missed for a past week below the target', () => {
  const habit = weeklyWith(3, ['2026-10-12']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-12', todayDate), { done: 1, target: 3, hit: false, state: 'missed' });
});

test('weekStatus is pending for the current week below the target', () => {
  const habit = weeklyWith(3, ['2026-10-19', '2026-10-20']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-19', todayDate), { done: 2, target: 3, hit: false, state: 'pending' });
});

test('weekStatus is hit for the current week once the target is reached', () => {
  const habit = weeklyWith(2, ['2026-10-19', '2026-10-20']);
  assert.equal(weekStatus(habit, settings, '2026-10-19', todayDate).state, 'hit');
});

test('weekStatus is future for a week that starts after today', () => {
  const habit = weeklyWith(3, ['2026-10-27']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-26', todayDate), { done: 0, target: 3, hit: false, state: 'future' });
});

test('weekStatus counts days across a month boundary', () => {
  const habit = weeklyWith(3, ['2026-09-28', '2026-09-30', '2026-10-02']);
  assert.deepEqual(weekStatus(habit, settings, '2026-09-28', todayDate), { done: 3, target: 3, hit: true, state: 'hit' });
});

test('weekStatus ignores dates after today and duplicates', () => {
  const habit = weeklyWith(3, ['2026-10-20', '2026-10-20', '2026-10-23', '2026-10-24']);
  assert.deepEqual(weekStatus(habit, settings, '2026-10-19', '2026-10-22'), { done: 1, target: 3, hit: false, state: 'pending' });
});

test('weekStatus is null for a daily habit', () => {
  assert.equal(weekStatus(dailyHabit, settings, '2026-10-19', todayDate), null);
});
