// Backup file logic: file name, export text, and import parsing.
// Pure logic: no DOM and no clock. Callers pass today in.
import { validateData } from './store.js';

// Backups are small. Anything bigger than this is not one of ours.
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export function backupFileName(todayDate) {
  return `habit-tracker-backup-${todayDate}.json`;
}

export function serializeBackup(data) {
  return JSON.stringify(data, null, 2);
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function summarize(data) {
  const completions = data.habits.reduce((sum, habit) => sum + habit.done.length, 0);
  return `${plural(data.habits.length, 'habit')}, ${plural(completions, 'completion')}`;
}

// Never throws. On failure no data is returned.
export function parseBackup(text) {
  if (text.length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'This file is too large to be a backup.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a valid backup. It is not JSON.' };
  }
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    && Number.isInteger(parsed.version) && parsed.version > 1) {
    return { ok: false, error: 'This backup comes from a newer version of the app.' };
  }
  const result = validateData(parsed);
  if (!result.ok) {
    return { ok: false, error: `This file is not a valid backup. ${result.error}` };
  }
  return { ok: true, data: result.data, summary: summarize(result.data) };
}
