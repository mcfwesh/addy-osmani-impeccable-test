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
