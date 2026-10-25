import { addDays } from './dates.js';

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
