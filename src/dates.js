const MS_PER_DAY = 86400000;

export function addDays(date, n) {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + n * MS_PER_DAY);
  const yyyy = String(shifted.getUTCFullYear()).padStart(4, '0');
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value, length) {
  return String(value).padStart(length, '0');
}

export function todayDate(now) {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

export function isValidDate(date) {
  if (typeof date !== 'string') return false;
  const match = DATE_PATTERN.exec(date);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function compareDates(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function startOfWeek(date, weekStartsOn) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((weekday - weekStartsOn + 7) % 7));
}

// month is 1-based (1 = January, 12 = December).
export function monthDays(year, month) {
  const first = `${pad(year, 4)}-${pad(month, 2)}-01`;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}
