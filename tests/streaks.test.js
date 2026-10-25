import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentDailyStreak, bestDailyStreak } from '../src/streaks.js';

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
