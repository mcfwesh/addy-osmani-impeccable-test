import { test, expect } from '@playwright/test';

async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('habit-tracker:v1')));
}

async function addHabit(page, name, cadence = 'Daily', target) {
  await page.getByRole('link', { name: 'Add habit' }).or(page.getByRole('link', { name: 'Add your first habit' })).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('radio', { name: cadence }).check();
  if (target) await page.getByLabel('Weekly target').fill(String(target));
  await page.getByRole('button', { name: 'Save' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./#/');
});

test('empty state shows a message and one Add your first habit control that opens the form', async ({ page }) => {
  await expect(page.getByText('No habits yet')).toBeVisible();
  await expect(page.getByRole('link', { name: /Add (your first )?habit/ })).toHaveCount(1);
  await page.getByRole('link', { name: 'Add your first habit' }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await expect(page.getByLabel('Name')).toBeVisible();
});

test('weekly target is hidden for Daily and shown with default 3 for Weekly', async ({ page }) => {
  await page.goto('./#/new');
  await expect(page.getByRole('radio', { name: 'Daily' })).toBeChecked();
  await expect(page.getByLabel('Weekly target')).toBeHidden();
  await page.getByRole('radio', { name: 'Weekly' }).check();
  await expect(page.getByLabel('Weekly target')).toBeVisible();
  await expect(page.getByLabel('Weekly target')).toHaveValue('3');
  await page.getByRole('radio', { name: 'Daily' }).check();
  await expect(page.getByLabel('Weekly target')).toBeHidden();
});

for (const [label, value] of [['empty', ''], ['whitespace-only', '    ']]) {
  test(`${label} name shows an error and focuses the field`, async ({ page }) => {
    await page.goto('./#/new');
    await page.getByLabel('Name').fill(value);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Enter a name.')).toBeVisible();
    await expect(page.getByLabel('Name')).toBeFocused();
    await expect(page.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Name')).toHaveAccessibleDescription('Enter a name.');
    await expect(page).toHaveURL(/#\/new$/);
  });
}

test('a 41-character name shows the length error', async ({ page }) => {
  await page.goto('./#/new');
  await page.getByLabel('Name').fill('a'.repeat(41));
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Use 40 characters or fewer.')).toBeVisible();
  await expect(page.getByLabel('Name')).toBeFocused();
});

test('saving a daily habit returns to Today and lists it', async ({ page }) => {
  await addHabit(page, 'Read');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.getByRole('listitem')).toContainText(['Read']);
  await expect(page.getByRole('link', { name: 'Add habit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  const data = await stored(page);
  expect(data.habits).toHaveLength(1);
  expect(data.habits[0]).toMatchObject({ name: 'Read', cadence: 'daily', weeklyTarget: null, done: [] });
});

test('a weekly habit is added after the first and stores its target', async ({ page }) => {
  await addHabit(page, 'Read');
  await addHabit(page, 'Run', 'Weekly', 5);
  await expect(page.getByRole('listitem')).toContainText(['Read', 'Run']);
  const data = await stored(page);
  expect(data.habits[1]).toMatchObject({ name: 'Run', cadence: 'weekly', weeklyTarget: 5 });
});

test('Cancel returns to Today with no change', async ({ page }) => {
  await page.goto('./#/new');
  await page.getByLabel('Name').fill('Nope');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('No habits yet')).toBeVisible();
  expect(await stored(page)).toBeNull();
});

test('habits survive a reload', async ({ page }) => {
  await addHabit(page, 'Read');
  await page.reload();
  await expect(page.getByRole('listitem')).toContainText(['Read']);
});
