import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';
const NOW = '2026-10-25T12:00:00';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

async function seed(page, habits, weekStartsOn = 1) {
  const data = { version: 1, settings: { weekStartsOn }, habits };
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const date = (page, d) => page.locator(`button.day[data-date="${d}"]`);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
});

test('marking and unmarking past days updates streaks at once and persists', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, ['2026-10-22', '2026-10-23'])]);
  await page.goto('./#/habit/d1');
  await expect(page.getByText('Current streak: 0 days')).toBeVisible();
  await expect(page.getByText('Best streak: 2 days')).toBeVisible();

  await date(page, '2026-10-24').click();
  await expect(page.getByText('Current streak: 3 days')).toBeVisible();
  await expect(page.getByText('Best streak: 3 days')).toBeVisible();

  await date(page, '2026-10-23').click();
  await expect(page.getByText('Current streak: 1 day')).toBeVisible();
  await expect(page.getByText('Best streak: 1 day')).toBeVisible();

  await page.reload();
  await expect(date(page, '2026-10-24')).toHaveAttribute('aria-pressed', 'true');
  await expect(date(page, '2026-10-23')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Current streak: 1 day')).toBeVisible();
});

test('a day button is named by its date only', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, ['2026-10-24'])]);
  await page.goto('./#/habit/d1');
  await expect(page.getByRole('button', { name: 'Saturday 24 October 2026', pressed: true })).toBeVisible();
});

test('marking a day in a previous month keeps the month and the focus', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, [])]);
  await page.goto('./#/habit/d1');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'September 2026' })).toBeVisible();
  await date(page, '2026-09-15').click();
  await expect(page.getByRole('heading', { level: 2, name: 'September 2026' })).toBeVisible();
  await expect(date(page, '2026-09-15')).toHaveAttribute('aria-pressed', 'true');
  await expect(date(page, '2026-09-15')).toBeFocused();
  await page.reload();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(date(page, '2026-09-15')).toHaveAttribute('aria-pressed', 'true');
});

test('days far in the past can be marked', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, [])]);
  await page.goto('./#/habit/d1');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'April 2026' })).toBeVisible();
  await date(page, '2026-04-03').click();
  await expect(date(page, '2026-04-03')).toHaveAttribute('aria-pressed', 'true');
});

test('future days are disabled and cannot be marked', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, [])]);
  await page.goto('./#/habit/d1');
  await expect(date(page, '2026-10-26')).toBeDisabled();
  await date(page, '2026-10-26').click({ force: true });
  await expect(date(page, '2026-10-26')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('button.day[aria-pressed="true"]')).toHaveCount(0);
});

const weekRow = (page, firstDate) =>
  page.locator('tbody tr').filter({ has: page.locator(`button[data-date="${firstDate}"]`) });

test('a weekly habit shows hit, pending, and missed weeks', async ({ page }) => {
  await page.goto('./#/new');
  await page.getByLabel('Name').fill('Run');
  await page.getByRole('radio', { name: 'Weekly' }).check();
  await page.getByLabel('Weekly target').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('link', { name: 'Run' }).click();

  const current = weekRow(page, '2026-10-19');
  await date(page, '2026-10-19').click();
  await date(page, '2026-10-20').click();
  await expect(current.getByRole('cell').last()).toHaveText(/2 of 3 so far/);
  await date(page, '2026-10-21').click();
  await expect(current.getByRole('cell').last()).toHaveText(/Hit: 3 of 3/);

  await date(page, '2026-10-13').click();
  await expect(weekRow(page, '2026-10-12').getByRole('cell').last()).toHaveText(/Missed: 1 of 3/);
  await expect(page.getByRole('columnheader', { name: 'Week' })).toBeVisible();
});

test('a daily habit has no week column', async ({ page }) => {
  await seed(page, [habit('d1', 'Read', 'daily', null, [])]);
  await page.goto('./#/habit/d1');
  await expect(page.getByRole('columnheader')).toHaveCount(7);
});

test('week status counts days from the adjacent month', async ({ page }) => {
  await seed(page, [habit('w1', 'Run', 'weekly', 3, ['2026-09-28', '2026-09-29', '2026-09-30'])]);
  await page.goto('./#/habit/w1');
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow.getByRole('cell').last()).toHaveText(/Hit: 3 of 3/);
});

test('the weekly detail screen does not scroll sideways', async ({ page }) => {
  await seed(page, [habit('w1', 'Run', 'weekly', 3, ['2026-10-19'])]);
  await page.goto('./#/habit/w1');
  await expect(page.getByRole('columnheader', { name: 'Week' })).toBeVisible();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
  const box = await date(page, '2026-10-19').boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
