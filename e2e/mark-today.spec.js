import { test, expect } from '@playwright/test';

async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('habit-tracker:v1')));
}

async function localToday(page) {
  return page.evaluate(() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

async function addHabit(page, name) {
  await page.getByRole('link', { name: 'Add habit' }).or(page.getByRole('link', { name: 'Add your first habit' })).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
}

function toggle(page, name) {
  return page.getByRole('button', { name: new RegExp(name) });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.goto('./#/');
  await addHabit(page, 'Read');
});

test('the done toggle starts not pressed and is at least 44x44 px', async ({ page }) => {
  const button = toggle(page, 'Read');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('one tap marks today done and saves the local date', async ({ page }) => {
  await toggle(page, 'Read').click();
  await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'true');
  const today = await localToday(page);
  expect((await stored(page)).habits[0].done).toEqual([today]);
});

test('a second tap unmarks today and removes the date', async ({ page }) => {
  await toggle(page, 'Read').click();
  await toggle(page, 'Read').click();
  await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
  expect((await stored(page)).habits[0].done).toEqual([]);
});

test('the done state survives a reload', async ({ page }) => {
  await toggle(page, 'Read').click();
  await page.reload();
  await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'true');
});

test('toggling one habit does not affect another', async ({ page }) => {
  await addHabit(page, 'Run');
  await toggle(page, 'Run').click();
  await expect(toggle(page, 'Run')).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
  const data = await stored(page);
  expect(data.habits[0].done).toEqual([]);
  expect(data.habits[1].done).toHaveLength(1);
});

test('keyboard focus stays on the toggled button after the tap', async ({ page }) => {
  await addHabit(page, 'Run');
  await toggle(page, 'Run').focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page, 'Run')).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle(page, 'Run')).toBeFocused();
});
