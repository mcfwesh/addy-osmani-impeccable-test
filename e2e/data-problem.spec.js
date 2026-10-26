import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const KEY = 'habit-tracker:v1';

const BROKEN_JSON = '{"version":1,"habits":[{';
const BAD_CADENCE = JSON.stringify({
  version: 1,
  settings: { weekStartsOn: 1 },
  habits: [{ id: 'a', name: 'Read', cadence: 'monthly', weeklyTarget: null, createdAt: '2026-08-01T00:00:00.000Z', done: [] }],
});
const NEWER = '{"version":2,"settings":{"weekStartsOn":1},"habits":[],"extra":"  keep   spacing"}';
const VALID = {
  version: 1,
  settings: { weekStartsOn: 1 },
  habits: [{ id: 'read-1', name: 'Read', cadence: 'daily', weeklyTarget: null, createdAt: '2026-08-01T00:00:00.000Z', done: [] }],
};

// Seed the raw string once per tab, so a reload does not bring it back.
async function seedRaw(page, raw) {
  await page.addInitScript(([key, value]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(key, value);
  }, [KEY, raw]);
}

const rawStored = (page) => page.evaluate((key) => localStorage.getItem(key), KEY);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
});

test('invalid JSON shows the data problem screen on every route and is never changed', async ({ page }) => {
  await seedRaw(page, BROKEN_JSON);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Your saved data has a problem' })).toBeVisible();
  await expect(page.getByText('Details:')).toContainText('The saved data is not valid JSON.');
  for (const hash of ['#/new', '#/settings', '#/habit/abc', '#/']) {
    await page.goto(`./${hash}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Your saved data has a problem' })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your saved data has a problem' })).toBeVisible();
  expect(await rawStored(page)).toBe(BROKEN_JSON);
});

test('valid JSON that fails validation shows the data problem screen with the reason', async ({ page }) => {
  await seedRaw(page, BAD_CADENCE);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Your saved data has a problem' })).toBeVisible();
  await expect(page.getByText('Details:')).toContainText('cadence must be "daily" or "weekly"');
  expect(await rawStored(page)).toBe(BAD_CADENCE);
});

test('data from a newer version shows its own screen and is never changed', async ({ page }) => {
  await seedRaw(page, NEWER);
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Your data comes from a newer version' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export raw data' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset all data' })).toBeVisible();
  expect(await rawStored(page)).toBe(NEWER);
});

test('Export raw data downloads the exact stored string', async ({ page }, testInfo) => {
  const raw = '{"version":1,  "habits":[{';
  await seedRaw(page, raw);
  await page.goto('./');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export raw data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('habit-tracker-raw-2026-10-25.json');
  const filePath = testInfo.outputPath('raw.json');
  await download.saveAs(filePath);
  expect(readFileSync(filePath, 'utf8')).toBe(raw);
  expect(await rawStored(page)).toBe(raw);
});

test('Reset all data: Cancel keeps the key; Confirm clears it and the app works again', async ({ page }) => {
  await seedRaw(page, BROKEN_JSON);
  await page.goto('./');
  await page.getByRole('button', { name: 'Reset all data' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Reset all data?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await rawStored(page)).toBe(BROKEN_JSON);

  await page.getByRole('button', { name: 'Reset all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset all data' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByText('No habits yet')).toBeVisible();
  expect(await rawStored(page)).toBeNull();

  await page.getByRole('link', { name: 'Add your first habit' }).click();
  await page.getByLabel('Name').fill('Stretch');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Stretch' })).toBeVisible();
  expect(JSON.parse(await rawStored(page)).habits.map((h) => h.name)).toEqual(['Stretch']);
});

// Seed valid data, then make setItem throw while window.__failSetItem is true.
async function seedValidWithFailingSetItem(page, { failFromStart }) {
  await page.addInitScript(([key, value, fail]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(key, JSON.stringify(value));
    }
    window.__failSetItem = fail;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(...args) {
      if (window.__failSetItem) throw new DOMException('full', 'QuotaExceededError');
      return original.apply(this, args);
    };
  }, [KEY, VALID, failFromStart]);
}

test('a failed save keeps the change on screen and shows the banner on every screen', async ({ page }) => {
  await seedValidWithFailingSetItem(page, { failFromStart: true });
  await page.goto('./');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const toggle = page.getByRole('button', { name: 'Mark Read done today' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const banner = page.getByRole('alert').filter({ hasText: 'Your changes are not being saved.' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Export a backup in Settings');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(banner).toBeVisible();
});

test('the banner disappears after a later save succeeds', async ({ page }) => {
  await seedValidWithFailingSetItem(page, { failFromStart: true });
  await page.goto('./');
  const toggle = page.getByRole('button', { name: 'Mark Read done today' });
  await toggle.click();
  const banner = page.getByRole('alert').filter({ hasText: 'Your changes are not being saved.' });
  await expect(banner).toBeVisible();
  await page.evaluate(() => { window.__failSetItem = false; });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(banner).toHaveCount(0);
  expect(JSON.parse(await rawStored(page)).habits[0].done).toEqual([]);
});

test('when localStorage cannot be read the app still works and shows the storage banner', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('denied', 'SecurityError'); },
    });
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByText('No habits yet')).toBeVisible();
  const banner = page.getByRole('alert').filter({ hasText: 'Your changes are not being saved.' });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('This browser is not letting the app use storage.');

  await page.getByRole('link', { name: 'Add your first habit' }).click();
  await page.getByLabel('Name').fill('Stretch');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Stretch' })).toBeVisible();
  await expect(banner).toBeVisible();
});
