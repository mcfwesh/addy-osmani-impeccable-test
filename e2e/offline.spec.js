import { test, expect } from '@playwright/test';

function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('habit-tracker:v1')));
}

test('the manifest is linked and parses with a relative start_url', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('./manifest.webmanifest');
  const response = await request.get(new URL(href, page.url()).href);
  expect(response.ok()).toBe(true);
  const manifest = JSON.parse(await response.text());
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')).toBe('./icons/apple-touch-icon.png');
});

test('after the first load the app opens and works with the network off', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Reload once so this page is controlled by the service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await page.getByRole('link', { name: 'Add your first habit' }).click();
  await page.getByLabel('Name').fill('Read');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Read/ })).toBeVisible();

  await context.setOffline(true);
  await page.reload();

  const toggle = page.getByRole('button', { name: /Read/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const data = await stored(page);
  expect(data.habits[0].done).toHaveLength(1);
});
