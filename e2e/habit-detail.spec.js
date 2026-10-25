import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';
const NOW = '2026-10-25T12:00:00';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

// Best streak (Oct 1-5 = 5 days) is longer than the current streak (Oct 23-24 = 2 days).
const READ = habit('read-1', 'Read', 'daily', null, [
  '2026-09-10', '2026-09-11',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-23', '2026-10-24',
]);
const RUN = habit('run-1', 'Run', 'weekly', 3, ['2026-10-19', '2026-10-21']);

async function seed(page, habits, weekStartsOn = 1) {
  const data = { version: 1, settings: { weekStartsOn }, habits };
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const day = (page, label) => page.getByRole('button', { name: label });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
});

test('tapping the habit name on Today opens its detail', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Read' }).click();
  await expect(page).toHaveURL(/#\/habit\/read-1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Read' })).toBeVisible();
});

test('an unknown habit id goes to Today', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/does-not-exist');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('the back link returns to Today', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('a daily habit shows cadence and streaks, and no target', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await expect(page.getByText('Daily', { exact: true })).toBeVisible();
  await expect(page.getByText(/Target:/)).toHaveCount(0);
  await expect(page.getByText('Current streak: 2 days')).toBeVisible();
  await expect(page.getByText('Best streak: 5 days')).toBeVisible();
});

test('a weekly habit shows cadence and target', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/habit/run-1');
  await expect(page.getByText('Weekly', { exact: true })).toBeVisible();
  await expect(page.getByText('Target: 3 days a week')).toBeVisible();
});

test('the calendar opens on October 2026 with done days pressed and future days disabled', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toBeVisible();
  await expect(day(page, 'Saturday 24 October 2026')).toHaveAttribute('aria-pressed', 'true');
  await expect(day(page, 'Friday 23 October 2026')).toHaveAttribute('aria-pressed', 'true');
  await expect(day(page, 'Sunday 25 October 2026')).toHaveAttribute('aria-pressed', 'false');
  await expect(day(page, 'Sunday 25 October 2026')).toBeEnabled();
  for (let d = 26; d <= 31; d++) {
    await expect(page.locator(`button[data-date="2026-10-${d}"]`)).toBeDisabled();
  }
  await expect(page.locator('button.day[aria-pressed="true"]')).toHaveCount(7);
});

test('Previous month shows September 2026 with its done days; Next month toggles disabled', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  const next = page.getByRole('button', { name: 'Next month' });
  await expect(next).toBeDisabled();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'September 2026' })).toBeVisible();
  await expect(day(page, 'Thursday 10 September 2026')).toHaveAttribute('aria-pressed', 'true');
  await expect(day(page, 'Friday 11 September 2026')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('button.day[aria-pressed="true"]')).toHaveCount(2);
  await expect(page.locator('button.day:disabled')).toHaveCount(0);
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toBeVisible();
  await expect(next).toBeDisabled();
});

test('weekday headers start on Monday by default', async ({ page }) => {
  await seed(page, [READ]);
  await page.goto('./#/habit/read-1');
  await expect(page.getByRole('columnheader')).toHaveText(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
});

test('weekday headers start on Sunday when weekStartsOn is 0', async ({ page }) => {
  await seed(page, [READ], 0);
  await page.goto('./#/habit/read-1');
  await expect(page.getByRole('columnheader')).toHaveText(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
});

test('the shown month resets to the current month when another habit opens', async ({ page }) => {
  await seed(page, [READ, RUN]);
  await page.goto('./#/habit/read-1');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'August 2026' })).toBeVisible();
  await page.goto('./#/habit/run-1');
  await expect(page.getByRole('heading', { level: 2, name: 'October 2026' })).toBeVisible();
});
