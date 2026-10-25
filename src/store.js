// Load, validate, and save the habit tracker document in localStorage.
// Pure logic: no DOM and no clock. Callers pass ids, timestamps, and today in.
import { isValidDate } from './dates.js';

export const STORAGE_KEY = 'habit-tracker:v1';

const NAME_MAX_LENGTH = 40;

export function emptyData() {
  return { version: 1, settings: { weekStartsOn: 1 }, habits: [] };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIntegerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Sorted, no duplicates. ISO dates sort correctly as plain strings.
function normalizeDone(done) {
  return [...new Set(done)].sort();
}

// ---------- validation ----------

function validateHabit(habit, index) {
  const label = isPlainObject(habit) && typeof habit.name === 'string' && habit.name !== ''
    ? `Habit ${index + 1} ("${habit.name}")`
    : `Habit ${index + 1}`;
  const problem = (message) => ({ error: `${label}: ${message}` });

  if (!isPlainObject(habit)) return problem('must be an object.');
  if (typeof habit.id !== 'string' || habit.id === '') {
    return problem('id must be a non-empty string.');
  }
  if (typeof habit.name !== 'string') return problem('name must be text.');
  if (habit.name !== habit.name.trim()) {
    return problem('name must not start or end with spaces.');
  }
  if (habit.name.length < 1) return problem('name must not be empty.');
  if (habit.name.length > NAME_MAX_LENGTH) {
    return problem(`name must be ${NAME_MAX_LENGTH} characters or fewer.`);
  }
  if (habit.cadence !== 'daily' && habit.cadence !== 'weekly') {
    return problem('cadence must be "daily" or "weekly".');
  }
  if (habit.cadence === 'weekly' && !isIntegerInRange(habit.weeklyTarget, 1, 7)) {
    return problem('weeklyTarget must be a whole number from 1 to 7 for a weekly habit.');
  }
  if (habit.cadence === 'daily' && habit.weeklyTarget !== null) {
    return problem('weeklyTarget must be null for a daily habit.');
  }
  if (typeof habit.createdAt !== 'string') return problem('createdAt must be text.');
  if (!Array.isArray(habit.done)) return problem('done must be a list of dates.');
  const badIndex = habit.done.findIndex((date) => !isValidDate(date));
  if (badIndex !== -1) {
    return problem(
      `done entry ${badIndex + 1} is not a real date in YYYY-MM-DD form: ${JSON.stringify(habit.done[badIndex])}.`,
    );
  }

  return {
    habit: {
      id: habit.id,
      name: habit.name,
      cadence: habit.cadence,
      weeklyTarget: habit.weeklyTarget,
      createdAt: habit.createdAt,
      done: normalizeDone(habit.done),
    },
  };
}

// Checks every field rule. Unknown extra fields are ignored and left out of
// the returned data. The returned data is a new object (the input is never
// changed) and every `done` list is sorted with no duplicates, so old files
// with unsorted or repeated dates still load.
export function validateData(value) {
  if (!isPlainObject(value)) return { ok: false, error: 'The data must be an object.' };
  if (!Number.isInteger(value.version) || value.version !== 1) {
    return { ok: false, error: 'version must be the whole number 1.' };
  }
  if (!isPlainObject(value.settings)) {
    return { ok: false, error: 'settings must be an object.' };
  }
  if (!isIntegerInRange(value.settings.weekStartsOn, 0, 6)) {
    return { ok: false, error: 'settings.weekStartsOn must be a whole number from 0 to 6.' };
  }
  if (!Array.isArray(value.habits)) {
    return { ok: false, error: 'habits must be a list.' };
  }

  const habits = [];
  const seenIds = new Set();
  for (let index = 0; index < value.habits.length; index += 1) {
    const result = validateHabit(value.habits[index], index);
    if (result.error) return { ok: false, error: result.error };
    if (seenIds.has(result.habit.id)) {
      return {
        ok: false,
        error: `Habit ${index + 1} ("${result.habit.name}"): two habits have the same id.`,
      };
    }
    seenIds.add(result.habit.id);
    habits.push(result.habit);
  }

  return {
    ok: true,
    data: { version: 1, settings: { weekStartsOn: value.settings.weekStartsOn }, habits },
  };
}

// ---------- load ----------

// Never writes. Never throws.
export function load(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: 'storage-unavailable', data: emptyData() };
  }
  if (raw === null) return { status: 'empty', data: emptyData() };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'data-problem', raw, error: 'The saved data is not valid JSON.' };
  }

  if (isPlainObject(parsed) && Number.isInteger(parsed.version) && parsed.version > 1) {
    return { status: 'newer-version', raw };
  }

  const result = validateData(parsed);
  if (!result.ok) return { status: 'data-problem', raw, error: result.error };
  return { status: 'ok', data: result.data };
}

// ---------- save ----------

// Writes the whole document. Every `done` list is saved sorted with no
// duplicates. Never throws: a missing storage, a quota error, or data that
// cannot be turned into JSON all return 'failed'.
export function save(storage, data) {
  try {
    const normalized = {
      ...data,
      habits: data.habits.map((habit) => ({ ...habit, done: normalizeDone(habit.done) })),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return 'ok';
  } catch {
    return 'failed';
  }
}

// Removes the stored document. Never throws.
export function clearAll(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return 'ok';
  } catch {
    return 'failed';
  }
}

// ---------- data changes ----------
// Each function returns new data and never changes its input. Invalid input
// throws an Error whose message is plain English for the user.

// Checks the fields of the add and edit habit form. Returns the cleaned value
// (name trimmed, weeklyTarget null for daily) or the first problem found.
export function validateHabitInput(input) {
  const { name, cadence, weeklyTarget } = isPlainObject(input) ? input : {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (trimmedName.length < 1) {
    return { ok: false, field: 'name', error: 'Enter a name.' };
  }
  if (trimmedName.length > NAME_MAX_LENGTH) {
    return { ok: false, field: 'name', error: `Use ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  if (cadence !== 'daily' && cadence !== 'weekly') {
    return { ok: false, field: 'cadence', error: 'Choose daily or weekly.' };
  }
  if (cadence === 'weekly' && !isIntegerInRange(weeklyTarget, 1, 7)) {
    return { ok: false, field: 'weeklyTarget', error: 'Choose a target from 1 to 7.' };
  }
  return {
    ok: true,
    value: {
      name: trimmedName,
      cadence,
      weeklyTarget: cadence === 'weekly' ? weeklyTarget : null,
    },
  };
}

function checkedInput(input) {
  const result = validateHabitInput(input);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function findHabitIndex(data, habitId) {
  const index = data.habits.findIndex((habit) => habit.id === habitId);
  if (index === -1) throw new Error('That habit was not found.');
  return index;
}

function replaceHabit(data, index, habit) {
  const habits = data.habits.slice();
  habits[index] = habit;
  return { ...data, habits };
}

// `id` and `createdAt` come from the caller (crypto.randomUUID() and
// new Date().toISOString() in app.js), which keeps this function pure.
export function addHabit(data, input, { id, createdAt } = {}) {
  const value = checkedInput(input);
  if (typeof id !== 'string' || id === '') throw new Error('A new habit needs an id.');
  if (data.habits.some((habit) => habit.id === id)) {
    throw new Error('Another habit already has this id.');
  }
  if (typeof createdAt !== 'string' || createdAt === '') {
    throw new Error('A new habit needs a createdAt time.');
  }
  return { ...data, habits: [...data.habits, { id, ...value, createdAt, done: [] }] };
}

// Keeps id, createdAt, and done.
export function updateHabit(data, habitId, input) {
  const value = checkedInput(input);
  const index = findHabitIndex(data, habitId);
  return replaceHabit(data, index, { ...data.habits[index], ...value });
}

export function deleteHabit(data, habitId) {
  const index = findHabitIndex(data, habitId);
  return { ...data, habits: data.habits.filter((_, i) => i !== index) };
}

// Adds the date if it is missing and removes it if it is there. The optional
// todayDate lets the caller reject future days (the store has no clock).
export function toggleDone(data, habitId, date, todayDate) {
  if (!isValidDate(date)) throw new Error('Enter a real date as YYYY-MM-DD.');
  if (todayDate !== undefined && date > todayDate) {
    throw new Error('You cannot mark a day in the future.');
  }
  const index = findHabitIndex(data, habitId);
  const habit = data.habits[index];
  const done = habit.done.includes(date)
    ? habit.done.filter((doneDate) => doneDate !== date)
    : [...habit.done, date];
  return replaceHabit(data, index, { ...habit, done: normalizeDone(done) });
}

export function setWeekStartsOn(data, weekStartsOn) {
  if (!isIntegerInRange(weekStartsOn, 0, 6)) {
    throw new Error('Choose a day from Sunday to Saturday.');
  }
  return { ...data, settings: { ...data.settings, weekStartsOn } };
}
