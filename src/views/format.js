// Pure text helpers for views. No DOM.
export function formatStreak(count, cadence) {
  const unit = cadence === 'weekly' ? 'week' : 'day';
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
