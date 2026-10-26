import { test, expect } from '@playwright/test';

test('shows the Today heading at the root', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
});

test('unknown route falls back to Today and resets the hash', async ({ page }) => {
  await page.goto('./#/nonsense');
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
});

test('a malformed habit id in the URL falls back to Today', async ({ page }) => {
  await page.goto('./#/habit/%E0%A4');
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/#\/$/);
});

test('an unsaved Add habit draft survives the midnight refresh', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-25T23:59:00') });
  await page.goto('./#/new');
  await page.getByLabel('Name').fill('Stretch');
  await page.getByRole('radio', { name: 'Weekly' }).check();
  await page.clock.runFor('02:00');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByLabel('Name')).toHaveValue('Stretch');
  await expect(page.getByRole('radio', { name: 'Weekly' })).toBeChecked();
});

test('the Today back links are at least 44 by 44 pixels', async ({ page }) => {
  await page.goto('./#/settings');
  const box = await page.getByRole('link', { name: 'Today' }).boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});
