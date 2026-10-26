import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

// Today is Sunday 2026-10-25. Target 1 per week.
// Monday start: Oct 19-25 holds both days, Oct 12-18 is empty -> streak 1 week.
// Sunday start: Oct 25-31 and Oct 18-24 both hit -> streak 2 weeks.
const RUN = habit('run-1', 'Run', 'weekly', 1, ['2026-10-19', '2026-10-25']);

async function seed(page, habits, weekStartsOn = 1) {
  const data = { version: 1, settings: { weekStartsOn }, habits };
  await page.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
});

test('Settings link opens the screen with Monday selected and 7 days listed', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  const select = page.getByLabel('Week starts on');
  await expect(select).toHaveValue('1');
  await expect(select.locator('option')).toHaveText(
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const box = await select.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
});

test('changing the week start moves a weekly streak, saves, and persists', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./');
  const row = page.getByRole('listitem').filter({ hasText: 'Run' });
  await expect(row).toContainText('1 week ·');
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Week starts on').selectOption('0');
  await expect(page.getByText('Saved.')).toBeVisible();
  expect((await stored(page)).settings.weekStartsOn).toBe(0);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(row).toContainText('2 weeks ·');
  await page.reload();
  await expect(row).toContainText('2 weeks ·');
  await page.goto('./#/settings');
  await expect(page.getByLabel('Week starts on')).toHaveValue('0');
});

test('Cancel keeps data; confirming Delete all data clears storage and shows the empty state', async ({ page }) => {
  await seed(page, [RUN]);
  await page.goto('./#/settings');
  const opener = page.getByRole('button', { name: 'Delete all data' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Delete all data?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect((await stored(page)).habits).toHaveLength(1);

  await opener.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect((await stored(page)).habits).toHaveLength(1);

  await opener.click();
  await dialog.getByRole('button', { name: 'Delete all data' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByText('No habits yet')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();
});

test('About your data explains where data lives', async ({ page }) => {
  await seed(page, []);
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'About your data' })).toBeVisible();
  await expect(page.getByText('stored only on this phone')).toBeVisible();
  await expect(page.getByText('Export a backup now and then.')).toBeVisible();
});
