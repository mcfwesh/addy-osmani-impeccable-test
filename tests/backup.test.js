import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupFileName, serializeBackup, parseBackup, summarize, MAX_BACKUP_BYTES } from '../src/backup.js';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

const sample = {
  version: 1,
  settings: { weekStartsOn: 0 },
  habits: [
    habit('a', 'Read', 'daily', null, ['2026-10-01', '2026-10-02']),
    habit('b', 'Run', 'weekly', 3, ['2026-10-05']),
  ],
};

test('backupFileName uses the given date', () => {
  assert.equal(backupFileName('2026-10-25'), 'habit-tracker-backup-2026-10-25.json');
});

test('serializeBackup writes pretty JSON with 2-space indent', () => {
  const text = serializeBackup(sample);
  assert.equal(text, JSON.stringify(sample, null, 2));
  assert.ok(text.includes('\n  "settings"'));
});

test('round trip: export then import gives deep-equal data', () => {
  const result = parseBackup(serializeBackup(sample));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, sample);
});

test('import normalizes unsorted and repeated done dates', () => {
  const messy = structuredClone(sample);
  messy.habits[0].done = ['2026-10-02', '2026-10-01', '2026-10-02'];
  const result = parseBackup(JSON.stringify(messy));
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.habits[0].done, ['2026-10-01', '2026-10-02']);
});

test('round trip keeps an empty document', () => {
  const empty = { version: 1, settings: { weekStartsOn: 1 }, habits: [] };
  assert.deepEqual(parseBackup(serializeBackup(empty)).data, empty);
});

test('parseBackup returns a summary', () => {
  assert.equal(parseBackup(serializeBackup(sample)).summary, '2 habits, 3 completions');
});

test('summarize handles singular, plural, and zero', () => {
  assert.equal(summarize({ habits: [] }), '0 habits, 0 completions');
  assert.equal(summarize({ habits: [habit('a', 'A', 'daily', null, ['2026-10-01'])] }), '1 habit, 1 completion');
  assert.equal(
    summarize({ habits: [habit('a', 'A', 'daily', null, []), habit('b', 'B', 'daily', null, ['2026-10-01', '2026-10-02'])] }),
    '2 habits, 2 completions');
});

function assertRejected(text, messagePart) {
  const result = parseBackup(text);
  assert.equal(result.ok, false);
  assert.ok(result.error.includes(messagePart), `"${result.error}" should include "${messagePart}"`);
  assert.equal('data' in result, false);
  assert.equal('summary' in result, false);
}

test('rejects text that is not JSON', () => {
  assertRejected('hello {', 'This file is not a valid backup. It is not JSON.');
  assertRejected('', 'It is not JSON.');
});

test('rejects a JSON array', () => {
  assertRejected('[]', 'This file is not a valid backup. ');
});

test('rejects JSON null and a number', () => {
  assertRejected('null', 'This file is not a valid backup. ');
  assertRejected('42', 'This file is not a valid backup. ');
});

test('rejects missing fields and names the problem', () => {
  assertRejected(JSON.stringify({ version: 1, settings: { weekStartsOn: 1 } }), 'habits must be a list.');
  assertRejected(JSON.stringify({ version: 1, habits: [] }), 'settings must be an object.');
  assertRejected(JSON.stringify({ settings: { weekStartsOn: 1 }, habits: [] }), 'version');
});

test('rejects a bad date in done', () => {
  const bad = structuredClone(sample);
  bad.habits[0].done = ['2026-02-30'];
  assertRejected(JSON.stringify(bad), 'not a real date');
});

test('rejects a newer version with its own message', () => {
  const newer = { ...structuredClone(sample), version: 2 };
  const result = parseBackup(JSON.stringify(newer));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'This backup comes from a newer version of the app.');
  assert.equal('data' in result, false);
});

test('rejects text larger than the size limit', () => {
  assert.equal(MAX_BACKUP_BYTES, 5 * 1024 * 1024);
  const result = parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1));
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('too large'));
});
