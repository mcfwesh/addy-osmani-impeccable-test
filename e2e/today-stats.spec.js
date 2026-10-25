import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';
const NOW = '2026-10-25T12:00:00';

function doc(habits) {
  return { version: 1, settings: { weekStartsOn: 1 }, habits };
}

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-09-01T00:00:00.000Z', done };
}

async function seed(page, data) {
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

function row(page, name) {
  return page.getByRole('listitem').filter({ hasText: name });
}

function toggle(page, name) {
  return page.getByRole('button', { name: new RegExp(name) });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
});

test('a new daily habit shows 0 days, then 1 day when marked, then 0 days when unmarked', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Add your first habit' }).click();
  await page.getByLabel('Name').fill('Read');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(row(page, 'Read')).toContainText('0 days');
  await toggle(page, 'Read').click();
  await expect(row(page, 'Read')).toContainText('1 day');
  await expect(row(page, 'Read')).not.toContainText('1 days');
  await toggle(page, 'Read').click();
  await expect(row(page, 'Read')).toContainText('0 days');
});

test('a weekly habit shows weeks and progress, and updates when today is marked', async ({ page }) => {
  await seed(page, doc([habit('w1', 'Exercise', 'weekly', 3, [
    '2026-10-05', '2026-10-06', '2026-10-07',
    '2026-10-12', '2026-10-13', '2026-10-14',
    '2026-10-19', '2026-10-20',
  ])]));
  await page.goto('./#/');
  await expect(row(page, 'Exercise')).toContainText('2 weeks');
  await expect(row(page, 'Exercise')).toContainText('2 of 3 this week');
  await toggle(page, 'Exercise').click();
  await expect(row(page, 'Exercise')).toContainText('3 weeks');
  await expect(row(page, 'Exercise')).toContainText('3 of 3 this week');
});

test('the all done line shows only when every habit counts as done', async ({ page }) => {
  await seed(page, doc([
    habit('d1', 'Read', 'daily', null, []),
    habit('w1', 'Exercise', 'weekly', 3, ['2026-10-19', '2026-10-20', '2026-10-21']),
  ]));
  await page.goto('./#/');
  const line = page.getByText('All done for today.');
  // Exercise already hits this week, but Read is not done.
  await expect(line).toHaveCount(0);
  await toggle(page, 'Read').click();
  await expect(line).toBeVisible();
  await toggle(page, 'Read').click();
  await expect(line).toHaveCount(0);
});

test('a weekly habit over target shows the real count', async ({ page }) => {
  await seed(page, doc([habit('w1', 'Exercise', 'weekly', 3, [
    '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
  ])]));
  await page.goto('./#/');
  await expect(row(page, 'Exercise')).toContainText('4 of 3 this week');
  await expect(page.getByText('All done for today.')).toBeVisible();
});

test('no all done line with no habits', async ({ page }) => {
  await page.goto('./#/');
  await expect(page.getByText('No habits yet')).toBeVisible();
  await expect(page.getByText('All done for today.')).toHaveCount(0);
});
