import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';
const NOTE = 'Streaks will be recalculated from your history.';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

const READ = habit('read-1', 'Read', 'daily', null, ['2026-10-23', '2026-10-24']);
// Weeks (Mon start) of Oct 5, 12, and 19 each have exactly 2 done days.
const RUN = habit('run-1', 'Run', 'weekly', 3, [
  '2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21',
]);

async function seed(page, habits) {
  const data = { version: 1, settings: { weekStartsOn: 1 }, habits };
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
const note = (page) => page.getByText(NOTE);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
});

test('Edit opens the form with the current values', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1');
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/#\/habit\/run-1\/edit$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit habit' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Run');
  await expect(page.getByRole('radio', { name: 'Weekly' })).toBeChecked();
  await expect(page.getByLabel('Weekly target')).toHaveValue('3');
});

test('renaming saves, shows on detail and Today, persists, and keeps id, createdAt, done', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await page.getByLabel('Name').fill('Jog');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/#\/habit\/run-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Jog' })).toBeVisible();
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('link', { name: 'Jog' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Jog' })).toBeVisible();
  const h = (await stored(page)).habits[0];
  expect(h).toMatchObject({ id: 'run-1', name: 'Jog', createdAt: RUN.createdAt, done: RUN.done });
});

test('recalc note is hidden at first, shows on cadence or target change, hides when changed back', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await expect(note(page)).toBeHidden();
  await page.getByLabel('Weekly target').fill('2');
  await expect(note(page)).toBeVisible();
  await page.getByLabel('Weekly target').fill('3');
  await expect(note(page)).toBeHidden();
  await page.getByRole('radio', { name: 'Daily' }).check();
  await expect(note(page)).toBeVisible();
  await page.getByRole('radio', { name: 'Weekly' }).check();
  await expect(note(page)).toBeHidden();
});

test('the recalc note container is a polite live region', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
});

test('a name change alone does not show the recalc note', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await page.getByLabel('Name').fill('Jog');
  await expect(note(page)).toBeHidden();
});

test('the recalc note never shows on Add habit', async ({ page }) => {
  await seed(page, []);
  await page.goto('./#/new');
  await page.getByRole('radio', { name: 'Weekly' }).check();
  await page.getByLabel('Weekly target').fill('2');
  await page.getByRole('radio', { name: 'Daily' }).check();
  await expect(note(page)).toBeHidden();
});

test('changing the weekly target from 3 to 2 changes the streak', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1');
  await expect(page.locator('.streak-current')).toHaveText('Current streak: 0 weeks');
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Weekly target').fill('2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.streak-current')).toHaveText('Current streak: 3 weeks');
});

test('changing cadence from weekly to daily switches the streak unit to days', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await page.getByRole('radio', { name: 'Daily' }).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.streak-current')).toHaveText(/Current streak: \d+ days?$/);
  await expect(page.locator('.habit-cadence')).toHaveText('Daily');
});

test('validation still works when editing', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await page.getByLabel('Name').fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a name.')).toBeVisible();
  await expect(page).toHaveURL(/\/edit$/);
});

test('Cancel on edit returns to detail with no change', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1/edit');
  await page.getByLabel('Name').fill('Changed');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/#\/habit\/run-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Run' })).toBeVisible();
  expect((await stored(page)).habits[0].name).toBe('Run');
});

test('editing an unknown habit goes to Today', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/unknown/edit');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('Delete opens a confirm dialog with the name, history warning, and export tip', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Delete Read?' })).toBeVisible();
  await expect(dialog).toContainText('This deletes the habit and all of its history. You cannot undo this.');
  await expect(dialog).toContainText('export a backup in Settings first');
  await expect(dialog.getByRole('button', { name: 'Delete habit' })).toBeVisible();
});

test('Cancel in the delete dialog keeps the habit and returns focus to Delete', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/#\/habit\/read-1$/);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
  expect((await stored(page)).habits).toHaveLength(1);
});

test('confirming delete removes the habit and lands on Today empty state', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete habit' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('No habits yet')).toBeVisible();
  expect((await stored(page)).habits).toHaveLength(0);
});

test('focus moves into the delete dialog when it opens', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const inside = await page.evaluate(() => !!document.activeElement.closest('dialog'));
  expect(inside).toBe(true);
});
