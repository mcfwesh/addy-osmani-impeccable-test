import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  emptyData,
  validateData,
  load,
  save,
  clearAll,
  validateHabitInput,
  addHabit,
  updateHabit,
  deleteHabit,
  toggleDone,
  setWeekStartsOn,
} from '../src/store.js';

// A fake Storage that records every call, so tests can assert "no writes".
function fakeStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  const calls = [];
  return {
    calls,
    items,
    getItem(key) {
      calls.push(['getItem', key]);
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      calls.push(['setItem', key, value]);
      items.set(key, String(value));
    },
    removeItem(key) {
      calls.push(['removeItem', key]);
      items.delete(key);
    },
  };
}

function writes(storage) {
  return storage.calls.filter(([name]) => name !== 'getItem');
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function validData() {
  return {
    version: 1,
    settings: { weekStartsOn: 1 },
    habits: [
      {
        id: 'a1',
        name: 'Exercise',
        cadence: 'weekly',
        weeklyTarget: 3,
        createdAt: '2026-10-25T08:14:00.000Z',
        done: ['2026-10-20', '2026-10-22'],
      },
      {
        id: 'b2',
        name: 'Read',
        cadence: 'daily',
        weeklyTarget: null,
        createdAt: '2026-10-25T08:15:00.000Z',
        done: ['2026-10-23', '2026-10-24'],
      },
    ],
  };
}

function withHabit(changes) {
  const data = validData();
  data.habits[0] = { ...data.habits[0], ...changes };
  return data;
}

// ---------- emptyData ----------

test('emptyData returns the default document', () => {
  assert.deepEqual(emptyData(), {
    version: 1,
    settings: { weekStartsOn: 1 },
    habits: [],
  });
});

test('emptyData returns a fresh object each call', () => {
  const first = emptyData();
  first.habits.push('x');
  assert.deepEqual(emptyData().habits, []);
});

test('storage key is habit-tracker:v1', () => {
  assert.equal(STORAGE_KEY, 'habit-tracker:v1');
});

// ---------- validateData ----------

test('validateData accepts valid data', () => {
  const result = validateData(validData());
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, validData());
});

test('validateData accepts empty data', () => {
  assert.equal(validateData(emptyData()).ok, true);
});

test('validateData sorts and dedupes done in the returned data', () => {
  const input = withHabit({ done: ['2026-10-22', '2026-10-20', '2026-10-22'] });
  const result = validateData(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.habits[0].done, ['2026-10-20', '2026-10-22']);
});

test('validateData does not change its input', () => {
  const input = deepFreeze(withHabit({ done: ['2026-10-22', '2026-10-20'] }));
  assert.equal(validateData(input).ok, true);
  assert.deepEqual(input.habits[0].done, ['2026-10-22', '2026-10-20']);
});

test('validateData ignores unknown extra fields', () => {
  const input = validData();
  input.extra = 1;
  input.habits[0].color = 'red';
  const result = validateData(input);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, validData());
});

const invalidCases = [
  ['null', () => null, /object/],
  ['an array', () => [], /object/],
  ['a string', () => 'hello', /object/],
  ['missing version', () => { const d = validData(); delete d.version; return d; }, /version/],
  ['version 0', () => ({ ...validData(), version: 0 }), /version/],
  ['version 1.5', () => ({ ...validData(), version: 1.5 }), /version/],
  ['version as a string', () => ({ ...validData(), version: '1' }), /version/],
  ['missing settings', () => { const d = validData(); delete d.settings; return d; }, /settings/],
  ['weekStartsOn 7', () => ({ ...validData(), settings: { weekStartsOn: 7 } }), /weekStartsOn/],
  ['weekStartsOn -1', () => ({ ...validData(), settings: { weekStartsOn: -1 } }), /weekStartsOn/],
  ['weekStartsOn 1.5', () => ({ ...validData(), settings: { weekStartsOn: 1.5 } }), /weekStartsOn/],
  ['weekStartsOn missing', () => ({ ...validData(), settings: {} }), /weekStartsOn/],
  ['habits missing', () => { const d = validData(); delete d.habits; return d; }, /habits/],
  ['habits not an array', () => ({ ...validData(), habits: {} }), /habits/],
  ['habit not an object', () => ({ ...validData(), habits: [5] }), /Habit 1/],
  ['missing id', () => { const d = validData(); delete d.habits[0].id; return d; }, /id/],
  ['empty id', () => withHabit({ id: '' }), /id/],
  ['numeric id', () => withHabit({ id: 5 }), /id/],
  ['duplicate ids', () => withHabit({ id: 'b2' }), /same id/],
  ['missing name', () => { const d = validData(); delete d.habits[0].name; return d; }, /name/],
  ['empty name', () => withHabit({ name: '' }), /name/],
  ['whitespace-only name', () => withHabit({ name: '   ' }), /name/],
  ['untrimmed name', () => withHabit({ name: ' Run ' }), /name/],
  ['41-character name', () => withHabit({ name: 'a'.repeat(41) }), /40/],
  ['bad cadence', () => withHabit({ cadence: 'monthly' }), /cadence/],
  ['missing cadence', () => { const d = validData(); delete d.habits[0].cadence; return d; }, /cadence/],
  ['weekly with null target', () => withHabit({ weeklyTarget: null }), /weeklyTarget/],
  ['weekly target 0', () => withHabit({ weeklyTarget: 0 }), /weeklyTarget/],
  ['weekly target 8', () => withHabit({ weeklyTarget: 8 }), /weeklyTarget/],
  ['weekly target 2.5', () => withHabit({ weeklyTarget: 2.5 }), /weeklyTarget/],
  ['weekly target as a string', () => withHabit({ weeklyTarget: '3' }), /weeklyTarget/],
  ['daily with numeric target', () => withHabit({ cadence: 'daily', weeklyTarget: 3 }), /weeklyTarget/],
  ['missing createdAt', () => { const d = validData(); delete d.habits[0].createdAt; return d; }, /createdAt/],
  ['numeric createdAt', () => withHabit({ createdAt: 123 }), /createdAt/],
  ['done not an array', () => withHabit({ done: '2026-10-20' }), /done/],
  ['done missing', () => { const d = validData(); delete d.habits[0].done; return d; }, /done/],
  ['bad date format', () => withHabit({ done: ['10/20/2026'] }), /date/],
  ['impossible date', () => withHabit({ done: ['2026-02-30'] }), /date/],
  ['non-string date', () => withHabit({ done: [20261020] }), /date/],
];

for (const [label, build, pattern] of invalidCases) {
  test(`validateData rejects ${label}`, () => {
    const result = validateData(build());
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.match(result.error, pattern);
  });
}

test('validateData error names the habit and the problem', () => {
  const result = validateData(withHabit({ cadence: 'monthly' }));
  assert.equal(result.error, 'Habit 1 ("Exercise"): cadence must be "daily" or "weekly".');
});

// ---------- load ----------

test('load returns empty data when the key is missing, and writes nothing', () => {
  const storage = fakeStorage();
  const result = load(storage);
  assert.deepEqual(result, { status: 'empty', data: emptyData() });
  assert.deepEqual(writes(storage), []);
});

test('load returns ok with valid data', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify(validData()) });
  const result = load(storage);
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.data, validData());
  assert.deepEqual(writes(storage), []);
});

test('load reads only the habit-tracker:v1 key', () => {
  const storage = fakeStorage();
  load(storage);
  assert.deepEqual(storage.calls, [['getItem', STORAGE_KEY]]);
});

test('load normalizes unsorted done arrays', () => {
  const raw = JSON.stringify(withHabit({ done: ['2026-10-22', '2026-10-20', '2026-10-22'] }));
  const result = load(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.equal(result.status, 'ok');
  assert.deepEqual(result.data.habits[0].done, ['2026-10-20', '2026-10-22']);
});

test('load returns data-problem for invalid JSON, keeps raw, and writes nothing', () => {
  const raw = '{not json';
  const storage = fakeStorage({ [STORAGE_KEY]: raw });
  const result = load(storage);
  assert.equal(result.status, 'data-problem');
  assert.equal(result.raw, raw);
  assert.match(result.error, /read|JSON|parse/i);
  assert.deepEqual(writes(storage), []);
});

test('load returns data-problem for the empty string', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '' });
  const result = load(storage);
  assert.equal(result.status, 'data-problem');
  assert.equal(result.raw, '');
});

test('load returns data-problem when validation fails, and writes nothing', () => {
  const raw = JSON.stringify(withHabit({ cadence: 'monthly' }));
  const storage = fakeStorage({ [STORAGE_KEY]: raw });
  const result = load(storage);
  assert.equal(result.status, 'data-problem');
  assert.equal(result.raw, raw);
  assert.match(result.error, /cadence/);
  assert.deepEqual(writes(storage), []);
});

test('load returns data-problem when the JSON is not an object', () => {
  const result = load(fakeStorage({ [STORAGE_KEY]: 'null' }));
  assert.equal(result.status, 'data-problem');
});

test('load returns newer-version for version 2, and writes nothing', () => {
  const raw = JSON.stringify({ version: 2, whatever: true });
  const storage = fakeStorage({ [STORAGE_KEY]: raw });
  const result = load(storage);
  assert.deepEqual(result, { status: 'newer-version', raw });
  assert.deepEqual(writes(storage), []);
});

test('load treats a non-integer version above 1 as a data problem', () => {
  const raw = JSON.stringify({ ...validData(), version: 2.5 });
  assert.equal(load(fakeStorage({ [STORAGE_KEY]: raw })).status, 'data-problem');
});

test('load returns storage-unavailable when storage is null', () => {
  assert.deepEqual(load(null), { status: 'storage-unavailable', data: emptyData() });
});

test('load returns storage-unavailable when storage is undefined', () => {
  assert.deepEqual(load(undefined), { status: 'storage-unavailable', data: emptyData() });
});

test('load returns storage-unavailable when getItem throws', () => {
  const storage = fakeStorage();
  storage.getItem = () => {
    throw new Error('SecurityError');
  };
  assert.deepEqual(load(storage), { status: 'storage-unavailable', data: emptyData() });
  assert.deepEqual(writes(storage), []);
});

// ---------- save ----------

test('save writes the document under the storage key and returns ok', () => {
  const storage = fakeStorage();
  assert.equal(save(storage, validData()), 'ok');
  assert.deepEqual(writes(storage).map(([name, key]) => [name, key]), [['setItem', STORAGE_KEY]]);
  assert.deepEqual(JSON.parse(storage.items.get(STORAGE_KEY)), validData());
});

test('save sorts and dedupes done arrays', () => {
  const storage = fakeStorage();
  const data = withHabit({ done: ['2026-10-22', '2026-10-20', '2026-10-22', '2026-10-21'] });
  assert.equal(save(storage, data), 'ok');
  const saved = JSON.parse(storage.items.get(STORAGE_KEY));
  assert.deepEqual(saved.habits[0].done, ['2026-10-20', '2026-10-21', '2026-10-22']);
});

test('save does not change the data it is given', () => {
  const data = deepFreeze(withHabit({ done: ['2026-10-22', '2026-10-20'] }));
  assert.equal(save(fakeStorage(), data), 'ok');
  assert.deepEqual(data.habits[0].done, ['2026-10-22', '2026-10-20']);
});

test('save then load gives back the same data', () => {
  const storage = fakeStorage();
  save(storage, validData());
  assert.deepEqual(load(storage), { status: 'ok', data: validData() });
});

test('save returns failed when setItem throws', () => {
  const storage = fakeStorage();
  storage.setItem = () => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  };
  assert.equal(save(storage, validData()), 'failed');
});

test('save returns failed when storage is null or undefined', () => {
  assert.equal(save(null, validData()), 'failed');
  assert.equal(save(undefined, validData()), 'failed');
});

test('save returns failed when the data cannot be turned into JSON', () => {
  const data = validData();
  data.self = data;
  assert.equal(save(fakeStorage(), data), 'failed');
});

test('save returns failed when the data has no habits list', () => {
  assert.equal(save(fakeStorage(), { version: 1 }), 'failed');
});

// ---------- clearAll ----------

test('clearAll removes the key and returns ok', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: '{}' });
  assert.equal(clearAll(storage), 'ok');
  assert.deepEqual(writes(storage), [['removeItem', STORAGE_KEY]]);
  assert.equal(storage.items.has(STORAGE_KEY), false);
});

test('clearAll returns failed when removeItem throws', () => {
  const storage = fakeStorage();
  storage.removeItem = () => {
    throw new Error('blocked');
  };
  assert.equal(clearAll(storage), 'failed');
});

test('clearAll returns failed when storage is null', () => {
  assert.equal(clearAll(null), 'failed');
});

// ---------- validateHabitInput ----------

test('validateHabitInput trims the name and returns the value', () => {
  assert.deepEqual(
    validateHabitInput({ name: '  Read  ', cadence: 'daily', weeklyTarget: null }),
    { ok: true, value: { name: 'Read', cadence: 'daily', weeklyTarget: null } },
  );
});

test('validateHabitInput forces weeklyTarget to null for a daily habit', () => {
  const result = validateHabitInput({ name: 'Read', cadence: 'daily', weeklyTarget: 3 });
  assert.deepEqual(result.value, { name: 'Read', cadence: 'daily', weeklyTarget: null });
});

test('validateHabitInput accepts a weekly habit with a target from 1 to 7', () => {
  for (const weeklyTarget of [1, 7]) {
    const result = validateHabitInput({ name: 'Run', cadence: 'weekly', weeklyTarget });
    assert.deepEqual(result, { ok: true, value: { name: 'Run', cadence: 'weekly', weeklyTarget } });
  }
});

test('validateHabitInput accepts a 40-character name', () => {
  assert.equal(validateHabitInput({ name: 'a'.repeat(40), cadence: 'daily' }).ok, true);
});

test('validateHabitInput says "Enter a name." for an empty or blank name', () => {
  for (const name of ['', '   ', undefined, null, 5]) {
    assert.deepEqual(validateHabitInput({ name, cadence: 'daily' }), {
      ok: false,
      field: 'name',
      error: 'Enter a name.',
    });
  }
});

test('validateHabitInput says "Use 40 characters or fewer." for a long name', () => {
  assert.deepEqual(validateHabitInput({ name: 'a'.repeat(41), cadence: 'daily' }), {
    ok: false,
    field: 'name',
    error: 'Use 40 characters or fewer.',
  });
});

test('validateHabitInput counts the trimmed name, not the raw one', () => {
  assert.equal(validateHabitInput({ name: `  ${'a'.repeat(40)}  `, cadence: 'daily' }).ok, true);
});

test('validateHabitInput rejects an unknown cadence', () => {
  assert.deepEqual(validateHabitInput({ name: 'Run', cadence: 'monthly' }), {
    ok: false,
    field: 'cadence',
    error: 'Choose daily or weekly.',
  });
});

test('validateHabitInput rejects a weekly target outside 1 to 7', () => {
  for (const weeklyTarget of [0, 8, 2.5, '3', null, undefined]) {
    assert.deepEqual(validateHabitInput({ name: 'Run', cadence: 'weekly', weeklyTarget }), {
      ok: false,
      field: 'weeklyTarget',
      error: 'Choose a target from 1 to 7.',
    });
  }
});

test('validateHabitInput checks the name before the other fields', () => {
  const result = validateHabitInput({ name: '', cadence: 'nope' });
  assert.equal(result.field, 'name');
});

test('validateHabitInput rejects input that is not an object', () => {
  assert.equal(validateHabitInput(null).ok, false);
  assert.equal(validateHabitInput(undefined).field, 'name');
});

// ---------- addHabit ----------

const newInfo = { id: 'c3', createdAt: '2026-10-26T09:00:00.000Z' };

test('addHabit appends a new habit at the end with an empty done list', () => {
  const data = deepFreeze(validData());
  const next = addHabit(data, { name: ' Stretch ', cadence: 'weekly', weeklyTarget: 4 }, newInfo);
  assert.equal(next.habits.length, 3);
  assert.deepEqual(next.habits[2], {
    id: 'c3',
    name: 'Stretch',
    cadence: 'weekly',
    weeklyTarget: 4,
    createdAt: '2026-10-26T09:00:00.000Z',
    done: [],
  });
  assert.deepEqual(next.habits.slice(0, 2), validData().habits);
});

test('addHabit forces weeklyTarget to null for a daily habit', () => {
  const next = addHabit(emptyData(), { name: 'Read', cadence: 'daily', weeklyTarget: 5 }, newInfo);
  assert.equal(next.habits[0].weeklyTarget, null);
});

test('addHabit does not change its input and returns valid data', () => {
  const data = deepFreeze(emptyData());
  const next = addHabit(data, { name: 'Read', cadence: 'daily' }, newInfo);
  assert.notEqual(next, data);
  assert.equal(data.habits.length, 0);
  assert.equal(validateData(next).ok, true);
});

test('addHabit throws the form message for an empty name', () => {
  assert.throws(
    () => addHabit(emptyData(), { name: '  ', cadence: 'daily' }, newInfo),
    { message: 'Enter a name.' },
  );
});

test('addHabit throws the form message for a long name', () => {
  assert.throws(
    () => addHabit(emptyData(), { name: 'a'.repeat(41), cadence: 'daily' }, newInfo),
    { message: 'Use 40 characters or fewer.' },
  );
});

test('addHabit throws for a bad weekly target', () => {
  assert.throws(
    () => addHabit(emptyData(), { name: 'Run', cadence: 'weekly', weeklyTarget: 9 }, newInfo),
    { message: 'Choose a target from 1 to 7.' },
  );
});

test('addHabit throws when the id is missing, empty, or already used', () => {
  const input = { name: 'Run', cadence: 'daily' };
  assert.throws(() => addHabit(emptyData(), input, { createdAt: newInfo.createdAt }), /id/);
  assert.throws(() => addHabit(emptyData(), input, { id: '', createdAt: newInfo.createdAt }), /id/);
  assert.throws(() => addHabit(validData(), input, { id: 'a1', createdAt: newInfo.createdAt }), /id/);
});

test('addHabit throws when createdAt is missing', () => {
  assert.throws(
    () => addHabit(emptyData(), { name: 'Run', cadence: 'daily' }, { id: 'c3' }),
    /createdAt/,
  );
});

// ---------- updateHabit ----------

test('updateHabit changes name, cadence, and target and keeps id, createdAt, and done', () => {
  const data = deepFreeze(validData());
  const next = updateHabit(data, 'b2', { name: ' Read more ', cadence: 'weekly', weeklyTarget: 5 });
  assert.deepEqual(next.habits[1], {
    id: 'b2',
    name: 'Read more',
    cadence: 'weekly',
    weeklyTarget: 5,
    createdAt: '2026-10-25T08:15:00.000Z',
    done: ['2026-10-23', '2026-10-24'],
  });
  assert.deepEqual(next.habits[0], validData().habits[0]);
});

test('updateHabit sets weeklyTarget to null when the habit becomes daily', () => {
  const next = updateHabit(validData(), 'a1', { name: 'Exercise', cadence: 'daily', weeklyTarget: 3 });
  assert.equal(next.habits[0].weeklyTarget, null);
});

test('updateHabit keeps the habit in the same position', () => {
  const next = updateHabit(validData(), 'a1', { name: 'Gym', cadence: 'daily' });
  assert.deepEqual(next.habits.map((habit) => habit.id), ['a1', 'b2']);
});

test('updateHabit throws for invalid input', () => {
  assert.throws(
    () => updateHabit(validData(), 'a1', { name: '', cadence: 'daily' }),
    { message: 'Enter a name.' },
  );
});

test('updateHabit throws for an unknown habit id', () => {
  assert.throws(
    () => updateHabit(validData(), 'zzz', { name: 'Run', cadence: 'daily' }),
    { message: 'That habit was not found.' },
  );
});

// ---------- deleteHabit ----------

test('deleteHabit removes the habit and keeps the others in order', () => {
  const data = deepFreeze(validData());
  const next = deleteHabit(data, 'a1');
  assert.deepEqual(next.habits, [validData().habits[1]]);
  assert.equal(data.habits.length, 2);
});

test('deleteHabit throws for an unknown habit id', () => {
  assert.throws(() => deleteHabit(validData(), 'zzz'), { message: 'That habit was not found.' });
});

// ---------- toggleDone ----------

test('toggleDone adds a date that is not there, keeping done sorted', () => {
  const data = deepFreeze(validData());
  const next = toggleDone(data, 'a1', '2026-10-21');
  assert.deepEqual(next.habits[0].done, ['2026-10-20', '2026-10-21', '2026-10-22']);
  assert.deepEqual(data.habits[0].done, ['2026-10-20', '2026-10-22']);
});

test('toggleDone adds a date before and after the existing dates in order', () => {
  let next = toggleDone(validData(), 'a1', '2026-10-01');
  next = toggleDone(next, 'a1', '2026-10-30');
  assert.deepEqual(next.habits[0].done, ['2026-10-01', '2026-10-20', '2026-10-22', '2026-10-30']);
});

test('toggleDone removes a date that is there', () => {
  const next = toggleDone(validData(), 'a1', '2026-10-20');
  assert.deepEqual(next.habits[0].done, ['2026-10-22']);
});

test('two toggles on the same date give back the original data', () => {
  const once = toggleDone(validData(), 'a1', '2026-10-21');
  const twice = toggleDone(once, 'a1', '2026-10-21');
  assert.deepEqual(twice, validData());
});

test('toggleDone only changes the chosen habit', () => {
  const next = toggleDone(validData(), 'a1', '2026-10-21');
  assert.deepEqual(next.habits[1], validData().habits[1]);
});

test('toggleDone repairs a done list that was unsorted with duplicates', () => {
  const messy = withHabit({ done: ['2026-10-22', '2026-10-20', '2026-10-22'] });
  const next = toggleDone(messy, 'a1', '2026-10-21');
  assert.deepEqual(next.habits[0].done, ['2026-10-20', '2026-10-21', '2026-10-22']);
});

test('toggleDone rejects dates that are not real YYYY-MM-DD dates', () => {
  for (const date of ['2026-02-30', '10/20/2026', '', undefined, 20261020]) {
    assert.throws(() => toggleDone(validData(), 'a1', date), {
      message: 'Enter a real date as YYYY-MM-DD.',
    });
  }
});

test('toggleDone throws for an unknown habit id', () => {
  assert.throws(() => toggleDone(validData(), 'zzz', '2026-10-21'), {
    message: 'That habit was not found.',
  });
});

test('toggleDone rejects a date after todayDate when todayDate is given', () => {
  assert.throws(() => toggleDone(validData(), 'a1', '2026-10-26', '2026-10-25'), {
    message: 'You cannot mark a day in the future.',
  });
});

test('toggleDone accepts todayDate itself and earlier dates', () => {
  assert.deepEqual(toggleDone(validData(), 'a1', '2026-10-25', '2026-10-25').habits[0].done, [
    '2026-10-20',
    '2026-10-22',
    '2026-10-25',
  ]);
  assert.equal(toggleDone(validData(), 'a1', '2026-10-21', '2026-10-25').habits[0].done.length, 3);
});

test('toggleDone allows any date when todayDate is not given', () => {
  assert.equal(toggleDone(validData(), 'a1', '2099-01-01').habits[0].done.length, 3);
});

// ---------- setWeekStartsOn ----------

test('setWeekStartsOn changes the setting and leaves the habits alone', () => {
  const data = deepFreeze(validData());
  const next = setWeekStartsOn(data, 0);
  assert.equal(next.settings.weekStartsOn, 0);
  assert.deepEqual(next.habits, validData().habits);
  assert.equal(data.settings.weekStartsOn, 1);
});

test('setWeekStartsOn accepts 0 and 6', () => {
  assert.equal(setWeekStartsOn(validData(), 0).settings.weekStartsOn, 0);
  assert.equal(setWeekStartsOn(validData(), 6).settings.weekStartsOn, 6);
});

test('setWeekStartsOn rejects values that are not whole numbers from 0 to 6', () => {
  for (const value of [-1, 7, 1.5, '1', null, undefined]) {
    assert.throws(() => setWeekStartsOn(validData(), value), {
      message: 'Choose a day from Sunday to Saturday.',
    });
  }
});

// ---------- every change keeps the data valid ----------

test('data-change functions return data that passes validateData', () => {
  let data = emptyData();
  data = addHabit(data, { name: 'Run', cadence: 'weekly', weeklyTarget: 2 }, newInfo);
  data = toggleDone(data, 'c3', '2026-10-24');
  data = updateHabit(data, 'c3', { name: 'Jog', cadence: 'daily' });
  data = setWeekStartsOn(data, 3);
  assert.equal(validateData(data).ok, true);
  data = deleteHabit(data, 'c3');
  assert.deepEqual(data.habits, []);
});
