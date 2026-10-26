import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const KEY = 'habit-tracker:v1';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

const ORIGINAL = {
  version: 1,
  settings: { weekStartsOn: 0 },
  habits: [
    habit('read-1', 'Read', 'daily', null, ['2026-10-23', '2026-10-24', '2026-10-25']),
    habit('run-1', 'Run', 'weekly', 3, ['2026-10-20', '2026-10-25']),
  ],
};

// Seed once per tab. A reload or "Delete all data" must not bring the seed back.
async function seed(page, data) {
  await page.addInitScript(([key, value]) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const rawStored = (page) => page.evaluate((key) => localStorage.getItem(key), KEY);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T12:00:00'));
});

test('export, delete all data, then import the file brings everything back', async ({ page }, testInfo) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('habit-tracker-backup-2026-10-25.json');
  const filePath = testInfo.outputPath('backup.json');
  await download.saveAs(filePath);
  expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(JSON.parse(await rawStored(page)));
  expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(ORIGINAL);

  await page.getByRole('button', { name: 'Delete all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete all data' }).click();
  await expect(page.getByText('No habits yet')).toBeVisible();
  expect(await rawStored(page)).toBeNull();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.locator('input[type="file"]').setInputFiles(filePath);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Replace all data?' })).toBeVisible();
  await expect(dialog).toContainText('This backup holds 2 habits, 5 completions.');
  await dialog.getByRole('button', { name: 'Import backup' }).click();

  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('link', { name: 'Read' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Run' })).toBeVisible();
  expect(JSON.parse(await rawStored(page))).toEqual(ORIGINAL);
});

test('the Import backup button is at least 44 by 44 pixels', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  for (const name of ['Export backup', 'Import backup']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('the empty state shows one Add your first habit control and a Settings link', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('link', { name: 'Add your first habit' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Add habit', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

test('a file that is not JSON shows an error and changes nothing', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const before = await rawStored(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json at all'),
  });
  await expect(page.getByRole('alert')).toHaveText('This file is not a valid backup. It is not JSON.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await rawStored(page)).toBe(before);
});

test('a file with a bad field names the problem and changes nothing', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const before = await rawStored(page);
  const bad = { version: 1, settings: { weekStartsOn: 1 }, habits: 'nope' };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)),
  });
  await expect(page.getByRole('alert')).toContainText('habits must be a list.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await rawStored(page)).toBe(before);
});

test('a backup from a newer version is refused and changes nothing', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const before = await rawStored(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'v2.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...ORIGINAL, version: 2 })),
  });
  await expect(page.getByRole('alert')).toHaveText('This backup comes from a newer version of the app.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await rawStored(page)).toBe(before);
});

test('a file over 5 MB is refused before it is read', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const before = await rawStored(page);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x20),
  });
  await expect(page.getByRole('alert')).toHaveText('This file is too large to be a backup.');
  expect(await rawStored(page)).toBe(before);
});

test('Cancel in the import dialog keeps the current data', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const before = await rawStored(page);
  const other = { version: 1, settings: { weekStartsOn: 1 }, habits: [habit('x', 'Other', 'daily', null, [])] };
  await page.locator('input[type="file"]').setInputFiles({
    name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(other)),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('This backup holds 1 habit, 0 completions.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await rawStored(page)).toBe(before);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByRole('link', { name: 'Read' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Other' })).toHaveCount(0);
});

test('choosing the same file again after an error shows the error again', async ({ page }) => {
  await seed(page, ORIGINAL);
  await page.goto('./#/settings');
  const bad = { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') };
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(bad);
  await expect(page.getByRole('alert')).toContainText('It is not JSON.');
  await expect.poll(() => input.evaluate((node) => node.value)).toBe('');
});
