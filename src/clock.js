// Pure timer math for the midnight refresh. It never reads the current time:
// the caller passes `now`. Only src/app.js touches the clock.

// A little after midnight, so the timer never fires a moment too early.
export const MIDNIGHT_BUFFER_MS = 1000;

// Milliseconds from `now` until the next local midnight, plus a small buffer.
// The Date constructor resolves month ends, year ends, and DST, so a day that
// is 23 or 25 hours long is counted correctly. At exactly midnight this is
// the wait for the NEXT midnight.
export function msUntilNextLocalMidnight(now) {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return nextMidnight.getTime() - now.getTime() + MIDNIGHT_BUFFER_MS;
}
