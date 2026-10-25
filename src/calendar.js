// Pure calendar helpers. No DOM, no clock.
import { monthDays } from './dates.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD string.
function weekdayOf(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// month is 1-based. Returns weeks of 7 entries: { date } or null for a blank.
export function calendarWeeks(year, month, weekStartsOn) {
  const dates = monthDays(year, month);
  const cells = Array(((weekdayOf(dates[0]) - weekStartsOn) + 7) % 7).fill(null);
  cells.push(...dates.map((date) => ({ date })));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function weekdayNames(weekStartsOn) {
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStartsOn + i) % 7]);
}

export function monthName(month) {
  return MONTHS[month - 1];
}

export function dateLabel(date) {
  const [year, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${day} ${monthName(month)} ${year}`;
}

export function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
