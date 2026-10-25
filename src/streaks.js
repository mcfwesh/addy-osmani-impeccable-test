import { addDays, startOfWeek } from './dates.js';

export function currentDailyStreak(doneDates, todayDate) {
  const done = new Set(doneDates.filter((date) => date <= todayDate));
  let cursorDate = done.has(todayDate) ? todayDate : addDays(todayDate, -1);
  let streak = 0;
  while (done.has(cursorDate)) {
    streak += 1;
    cursorDate = addDays(cursorDate, -1);
  }
  return streak;
}

export function bestDailyStreak(doneDates, todayDate) {
  const sortedDates = [...new Set(doneDates.filter((date) => date <= todayDate))].sort();
  let best = 0;
  let run = 0;
  let previousDate = null;
  for (const date of sortedDates) {
    run = previousDate !== null && addDays(previousDate, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previousDate = date;
  }
  return best;
}

// Returns the set of week-start dates for weeks that hit the target.
// Ignores dates after todayDate and duplicates.
function hittingWeekStartDates(doneDates, weeklyTarget, weekStartsOn, todayDate) {
  const doneCounts = new Map();
  for (const date of new Set(doneDates.filter((doneDate) => doneDate <= todayDate))) {
    const weekStartDate = startOfWeek(date, weekStartsOn);
    doneCounts.set(weekStartDate, (doneCounts.get(weekStartDate) ?? 0) + 1);
  }
  const hitting = new Set();
  for (const [weekStartDate, count] of doneCounts) {
    if (count >= weeklyTarget) hitting.add(weekStartDate);
  }
  return hitting;
}

export function currentWeeklyStreak(doneDates, weeklyTarget, weekStartsOn, todayDate) {
  const hitting = hittingWeekStartDates(doneDates, weeklyTarget, weekStartsOn, todayDate);
  const thisWeekStartDate = startOfWeek(todayDate, weekStartsOn);
  let cursorDate = hitting.has(thisWeekStartDate) ? thisWeekStartDate : addDays(thisWeekStartDate, -7);
  let streak = 0;
  while (hitting.has(cursorDate)) {
    streak += 1;
    cursorDate = addDays(cursorDate, -7);
  }
  return streak;
}

export function bestWeeklyStreak(doneDates, weeklyTarget, weekStartsOn, todayDate) {
  const hitting = hittingWeekStartDates(doneDates, weeklyTarget, weekStartsOn, todayDate);
  let best = 0;
  let run = 0;
  let previousDate = null;
  for (const weekStartDate of [...hitting].sort()) {
    run = previousDate !== null && addDays(previousDate, 7) === weekStartDate ? run + 1 : 1;
    best = Math.max(best, run);
    previousDate = weekStartDate;
  }
  return best;
}

export function currentStreak(habit, settings, todayDate) {
  if (habit.cadence === 'weekly') {
    return currentWeeklyStreak(habit.done, habit.weeklyTarget, settings.weekStartsOn, todayDate);
  }
  return currentDailyStreak(habit.done, todayDate);
}

export function bestStreak(habit, settings, todayDate) {
  if (habit.cadence === 'weekly') {
    return bestWeeklyStreak(habit.done, habit.weeklyTarget, settings.weekStartsOn, todayDate);
  }
  return bestDailyStreak(habit.done, todayDate);
}

// Progress for the week that contains todayDate. Daily habits have no weekly progress.
export function weekProgress(habit, settings, todayDate) {
  if (habit.cadence !== 'weekly') return null;
  const weekStartDate = startOfWeek(todayDate, settings.weekStartsOn);
  const done = new Set(habit.done.filter((date) => date >= weekStartDate && date <= todayDate)).size;
  return { done, target: habit.weeklyTarget, hit: done >= habit.weeklyTarget };
}
