import { test, expect } from '@playwright/test';

const KEY = 'habit-tracker:v1';

function habit(id, name, cadence, weeklyTarget, done) {
  return { id, name, cadence, weeklyTarget, createdAt: '2026-08-01T00:00:00.000Z', done };
}

// Seed once per tab, so a reload does not bring the seed back.
async function seed(target, habits) {
  const data = { version: 1, settings: { weekStartsOn: 1 }, habits };
  await target.addInitScript(([key, value]) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, [KEY, data]);
}

const toggle = (page, name) => page.getByRole('button', { name: new RegExp(name) });
const rawStored = (page) => page.evaluate((key) => localStorage.getItem(key), KEY);
const dataProblem = (page) => page.getByRole('heading', { level: 1, name: 'Your saved data has a problem' });

async function addHabit(page, name) {
  await page.getByRole('link', { name: 'Add habit' }).or(page.getByRole('link', { name: 'Add your first habit' })).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
}

test.describe('today moves forward', () => {
  test('crossing local midnight with the app open moves today on', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-25T23:59:00') });
    await seed(page, [
      habit('d1', 'Read', 'daily', null, ['2026-10-24', '2026-10-25']),
    ]);
    await page.goto('./');
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('2 days')).toBeVisible();

    await page.clock.runFor('02:00');
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
    // Today is still pending, so the streak from yesterday is kept.
    await expect(page.getByText('2 days')).toBeVisible();

    await page.goto('./#/habit/d1');
    await expect(page.locator('button.day[data-date="2026-10-26"]')).toBeEnabled();
  });

  test('coming back to the app after the time moved on updates today', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-25T12:00:00') });
    await seed(page, [
      habit('d1', 'Read', 'daily', null, ['2026-10-24', '2026-10-25']),
    ]);
    await page.goto('./');
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'true');

    // Moves the time without firing timers, like a suspended iOS web app.
    await page.clock.setSystemTime(new Date('2026-10-26T09:00:00'));
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByText('2 days')).toBeVisible();
  });

  test('nothing is written to storage when today moves on', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-25T23:59:00') });
    await seed(page, [habit('d1', 'Read', 'daily', null, ['2026-10-25'])]);
    await page.goto('./');
    const before = await rawStored(page);
    await page.clock.runFor('02:00');
    await expect(toggle(page, 'Read')).toHaveAttribute('aria-pressed', 'false');
    expect(await rawStored(page)).toBe(before);
  });
});

test.describe('other tabs', () => {
  test('a habit added in one tab shows in the other without a reload', async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('./');
    await b.goto('./');
    await expect(b.getByText('No habits yet')).toBeVisible();
    await addHabit(a, 'Read');
    await expect(toggle(a, 'Read')).toBeVisible();
    await expect(toggle(b, 'Read')).toBeVisible();
  });

  test('delete all data in one tab shows the empty state in the other', async ({ context }) => {
    await seed(context, [habit('d1', 'Read', 'daily', null, [])]);
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('./');
    await b.goto('./');
    await expect(toggle(b, 'Read')).toBeVisible();

    await a.goto('./#/settings');
    await a.getByRole('button', { name: 'Delete all data' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Delete all data' }).click();
    await expect(a.getByText('No habits yet')).toBeVisible();
    await expect(b.getByText('No habits yet')).toBeVisible();
  });

  test('a habit deleted in one tab sends the other tab from its detail page to Today', async ({ context }) => {
    await seed(context, [habit('d1', 'Read', 'daily', null, []), habit('d2', 'Run', 'daily', null, [])]);
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('./#/habit/d1');
    await b.goto('./#/habit/d1');
    await expect(b.getByRole('heading', { level: 1, name: 'Read' })).toBeVisible();

    await a.getByRole('button', { name: 'Delete' }).click();
    await a.getByRole('dialog').getByRole('button', { name: 'Delete habit' }).click();
    await expect(a.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(b.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(b).toHaveURL(/#\/$/);
    await expect(toggle(b, 'Run')).toBeVisible();
  });

  test('invalid data written by one tab shows the data problem screen in the other, which writes nothing', async ({ context }) => {
    await seed(context, [habit('d1', 'Read', 'daily', null, [])]);
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('./');
    await b.goto('./');
    await expect(toggle(b, 'Read')).toBeVisible();

    const broken = '{"version":1,"habits":[{';
    await a.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, broken]);
    await expect(dataProblem(b)).toBeVisible();
    expect(await rawStored(b)).toBe(broken);
  });

  test('valid data written by one tab brings the other tab out of the data problem screen', async ({ context }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('./');
    await b.goto('./');
    await a.evaluate((key) => localStorage.setItem(key, '{"version":1,"habits":[{'), KEY);
    await expect(dataProblem(b)).toBeVisible();

    const fixed = JSON.stringify({ version: 1, settings: { weekStartsOn: 1 }, habits: [habit('d1', 'Read', 'daily', null, [])] });
    await a.evaluate(([key, value]) => localStorage.setItem(key, value), [KEY, fixed]);
    await expect(toggle(b, 'Read')).toBeVisible();
    expect(await rawStored(b)).toBe(fixed);
  });
});

test.describe('persistent storage request', () => {
  test('is called once at start-up and does not change behavior', async ({ page }) => {
    await page.addInitScript(() => {
      window.__persistCalls = 0;
      navigator.storage.persist = () => {
        window.__persistCalls += 1;
        return Promise.resolve(false);
      };
    });
    await page.goto('./');
    await expect(page.getByText('No habits yet')).toBeVisible();
    await page.goto('./#/settings');
    await page.goto('./#/');
    expect(await page.evaluate(() => window.__persistCalls)).toBe(1);
  });

  test('a rejected request leaves the app working', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      navigator.storage.persist = () => Promise.reject(new Error('no'));
    });
    await page.goto('./');
    await addHabit(page, 'Read');
    await expect(toggle(page, 'Read')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a request that throws leaves the app working', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.storage.persist = () => { throw new Error('boom'); };
    });
    await page.goto('./');
    await expect(page.getByText('No habits yet')).toBeVisible();
  });

  test('a browser without navigator.storage still renders the app', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    });
    await page.goto('./');
    await expect(page.getByText('No habits yet')).toBeVisible();
  });
});
