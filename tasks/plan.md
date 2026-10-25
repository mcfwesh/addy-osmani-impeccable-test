# Implementation Plan: Habit Tracker v1

Source: `SPEC.md` (approved 2026-10-25). Task checklist: `tasks/todo.md`.

## Overview

Build the habit tracker in `SPEC.md` as plain HTML, CSS, and JavaScript ES modules at the repository root. The plan builds the pure logic first, because the streak and date rules carry the most risk. Then it adds one working feature at a time: add a habit, mark today done, show streaks, past-day marking, editing, settings, backup, error states, offline use, and deployment.

The five core features map to these tasks:

| Feature | Tasks |
|---|---|
| Persist to localStorage | 3 |
| Add a habit | 4 |
| Mark a day done | 5 (today), 10 (past days) |
| Compute streaks | 6 (daily), 7 (weekly) |
| Show stats | 8 (Today screen), 9 (Habit detail) |

## Architecture Decisions

1. **Pure logic has no DOM and no clock.** `dates.js`, `streaks.js`, and the data functions in `store.js` and `backup.js` take `today` and data as arguments. Only `src/app.js` reads the clock, with `todayDate(new Date())`. This makes the risky rules fully unit-testable.
2. **Data changes are pure functions.** `store.js` exports functions such as `addHabit(data, input)` and `toggleDone(data, habitId, date)`. Each returns new data. A separate `save(storage, data)` writes it. Views call these through `app.js` and never touch localStorage.
3. **Streaks are never stored.** Views call `streaks.js` on every render. With 5 habits and a few years of dates, this is a few thousand set lookups, so speed is not a concern.
4. **One render path.** `app.js` holds the state, reads the hash route, and calls one view's `render(root, state, actions)`. Each change saves, then re-renders the current view.
5. **Functional styles only.** `styles.css` gets plain layout, readable text, and 44 × 44 px touch targets. The visual design comes from a separate design step (see Open Questions).
6. **Tests are written first for logic.** Tasks 2, 3, 6, 7, and 13 follow the red-green-refactor loop (`agent-skills:test-driven-development`). UI tasks each add the Playwright test for their flow.

## Dependency Graph

```
1 Scaffold ─────────────┐
2 dates.js ──┬── 3 store.js ──┴── 4 Add habit ── 5 Mark today ──┐
             │                                                  ├── 8 Today stats ── 9 Detail ── 10 Past days ── 11 Edit/delete
             └── 6 Daily streaks ── 7 Weekly streaks ───────────┘                      │
                                                                                       ├── 12 Settings ── 13 Backup ── 14 Error states
                                                                                       └── 15 Live updates
14, 15 ── 16 Offline ── 17 Deploy ── 18 iPhone checks
```

## Task List

### Phase 1: Foundation

#### Task 1: Project scaffold and end-to-end test harness

**Description:** Create the app shell and the test tooling. After this task, the dev server serves an empty app, and Playwright can open it in WebKit with an iPhone device profile.

**Acceptance criteria:**
- [ ] `package.json` has `"type": "module"`, a `test` script (`node --test "tests/**/*.test.js"`), and `@playwright/test` as a dev dependency. (`package.json` already exists from Task 6; add Playwright to it.)
- [ ] `playwright.config.js` uses WebKit with an iPhone device profile and starts `python3 -m http.server 4174 --bind 127.0.0.1` as its web server.
- [ ] `index.html` loads `./src/app.js` as a module, using relative paths only. `app.js` renders a placeholder Today heading and handles routes: unknown routes go to `#/`.

**Verification:**
- [ ] `npm install && npx playwright install webkit` succeeds.
- [ ] `npx playwright test` passes `e2e/app-shell.spec.js`: the Today heading is visible, and `#/nonsense` shows Today.
- [ ] Manual check: `grep -n 'src="/\|href="/' index.html` finds no root-absolute paths.

**Dependencies:** None

**Files likely touched:** `package.json`, `playwright.config.js`, `index.html`, `src/app.js`, `e2e/app-shell.spec.js`

**Estimated scope:** M (5 small files)

#### Task 2: Local-date helpers

**Description:** Write `src/dates.js`, the pure helpers for `YYYY-MM-DD` calendar dates. Every later rule depends on these, and daylight saving bugs hide here, so this task comes first.

**Acceptance criteria:**
- [ ] It exports `todayDate(now)`, `addDays(date, n)`, `isValidDate(date)`, `compareDates(a, b)`, `startOfWeek(date, weekStartsOn)`, and `monthDays(year, month)`. No function except `todayDate` takes a `Date` object, and none reads the clock.
- [ ] Date math is correct across month and year ends, leap days (2028-02-29), and US daylight saving days (2026-03-08, 2026-11-01).
- [ ] `isValidDate` rejects bad formats and impossible dates such as `2026-02-30`.

**Verification:**
- [ ] `npm test` and `TZ=America/New_York npm test` both pass.
- [ ] `node --test --experimental-test-coverage "tests/**/*.test.js"` shows 100% branch coverage for `src/dates.js`.

**Dependencies:** None (can run in parallel with Task 1)

**Files likely touched:** `src/dates.js`, `tests/dates.test.js`

**Estimated scope:** S

#### Task 3: Persist to localStorage (store layer)

**Description:** Write `src/store.js`: load, validate, and save the `habit-tracker:v1` document, plus the pure data-change functions. Tests use a fake Storage object, so they run in Node.

**Acceptance criteria:**
- [ ] `load(storage)` returns one status for each row of the spec's "Load and save behavior" table: `empty`, `ok`, `data-problem`, `newer-version`, and `storage-unavailable`. It never writes during a load.
- [ ] `save(storage, data)` returns `ok` or `failed` and never throws. Saved `done` arrays are sorted and have no duplicates.
- [ ] Pure functions `addHabit`, `updateHabit`, `deleteHabit`, `toggleDone`, `setWeekStartsOn`, and `validateData` follow the spec's field rules. They reject invalid input with a clear error message.

**Verification:**
- [ ] `npm test` passes `tests/store.test.js`, including invalid JSON, a missing field, `version: 2`, a `setItem` that throws, and two toggles on the same date.

**Dependencies:** Task 2

**Files likely touched:** `src/store.js`, `tests/store.test.js`

**Estimated scope:** S

### Phase 2: Core loop

#### Task 4: Add a habit

**Description:** The first full feature. The user sees the empty state, opens the Add habit form, saves a habit, and sees it on Today. The habit survives a page reload.

**Acceptance criteria:**
- [ ] With no habits, Today shows the empty state and one "Add your first habit" button that goes to `#/new`.
- [ ] The form validates the name (trimmed, 1 to 40 characters) with the spec's error messages and moves focus to the field. The weekly target (1 to 7, default 3) shows only for Weekly.
- [ ] Save adds the habit to the end of the list, saves it, and returns to Today. Cancel returns with no change. After a reload, the habit is still there.

**Verification:**
- [ ] `npx playwright test e2e/add-habit.spec.js` passes. It covers spec end-to-end flow 2 (reload keeps data).
- [ ] `npm test` still passes.

**Dependencies:** Tasks 1, 3

**Files likely touched:** `src/app.js`, `src/views/today.js`, `src/views/habit-form.js`, `styles.css`, `e2e/add-habit.spec.js`

**Estimated scope:** M

#### Task 5: Mark today done

**Description:** Each habit row on Today gets a done toggle for today.

**Acceptance criteria:**
- [ ] Each row has a button with `aria-pressed` that marks today done with one tap and unmarks it with a second tap.
- [ ] The change is saved, and the toggle state is the same after a reload.
- [ ] `app.js` is the only file that reads the clock (`todayDate(new Date())`).

**Verification:**
- [ ] `npx playwright test e2e/mark-today.spec.js` passes.
- [ ] Manual check: `grep -rn "new Date()" src/` finds only `src/app.js`.

**Dependencies:** Task 4

**Files likely touched:** `src/views/today.js`, `src/app.js`, `e2e/mark-today.spec.js`

**Estimated scope:** S

#### Task 6: Compute daily streaks

**Description:** Write the daily part of `src/streaks.js`: the current and best streak for a daily habit.

**Acceptance criteria:**
- [ ] `currentStreak` and `bestStreak` for daily habits follow the spec rules: today pending, yesterday missed gives 0, and dates after today are ignored.
- [ ] Every row of the spec's daily worked example passes as a unit test.
- [ ] Tests cover empty history, a past-day edit that joins two runs, an unmark that splits a run, and a best streak older than the current one.

**Verification:**
- [ ] `npm test` passes `tests/streaks.test.js`.

**Dependencies:** Task 2 (can run in parallel with Tasks 3 to 5)

**Files likely touched:** `src/streaks.js`, `tests/streaks.test.js`

**Estimated scope:** S

#### Task 7: Compute weekly streaks

**Description:** Add weekly habits to `src/streaks.js`: current and best streak in weeks, and progress for the current week.

**Acceptance criteria:**
- [ ] Weekly `currentStreak` and `bestStreak` follow the spec rules. A week hits when its done days reach `weeklyTarget`. The current week is pending until it ends.
- [ ] `weekProgress(habit, settings, today)` returns `{ done, target, hit }` for the current week.
- [ ] Every row of the spec's weekly worked example passes. Tests also cover targets 1 and 7, more done days than the target, every `weekStartsOn` value, and a change of cadence or target.

**Verification:**
- [ ] `npm test` passes.
- [ ] `node --test --experimental-test-coverage "tests/**/*.test.js"` shows 100% branch coverage for `src/streaks.js`.

**Dependencies:** Task 6 (same file)

**Files likely touched:** `src/streaks.js`, `tests/streaks.test.js`

**Estimated scope:** S

#### Task 8: Show stats on Today

**Description:** Each Today row shows its current streak and, for weekly habits, this week's progress.

**Acceptance criteria:**
- [ ] Each row shows the current streak with the correct unit and number form: "1 day", "4 days", "1 week", "3 weeks", and "0 days".
- [ ] Weekly rows show "2 of 3 this week". Marking today updates the streak and the progress at once, with no reload.
- [ ] When every habit is done for today (a weekly habit counts if it is done today or its week already hits), Today shows the "all done" line.

**Verification:**
- [ ] `npx playwright test e2e/today-stats.spec.js` passes. It covers spec end-to-end flow 1.
- [ ] `npm test` still passes.

**Dependencies:** Tasks 5, 7

**Files likely touched:** `src/views/today.js`, `e2e/today-stats.spec.js`

**Estimated scope:** S

### Checkpoint A: Core loop (after Tasks 1 to 8)

- [ ] `npm test` and `npx playwright test` pass.
- [ ] On the dev server: add a daily and a weekly habit, mark today, see the streaks, reload, and the data is still there.
- [ ] 100% branch coverage for `dates.js` and `streaks.js`.
- [ ] Review with the user before Phase 3.

### Phase 3: History and editing

#### Task 9: Habit detail screen with stats and calendar

**Description:** Add `#/habit/<id>`. It shows the habit's settings, current and best streak, and a month calendar that is read-only for now.

**Acceptance criteria:**
- [ ] Tapping a habit name on Today opens its detail screen. An unknown id goes to Today.
- [ ] The screen shows the name, cadence, target (if weekly), current streak, and best streak.
- [ ] The month calendar marks done days. Previous and next buttons change the month. The next button is disabled on the current month.

**Verification:**
- [ ] `npx playwright test e2e/habit-detail.spec.js` passes.

**Dependencies:** Task 8

**Files likely touched:** `src/views/habit.js`, `src/app.js`, `styles.css`, `e2e/habit-detail.spec.js`

**Estimated scope:** M

#### Task 10: Mark past days done

**Description:** The user taps any past day on the detail calendar to mark it done or not done. For weekly habits, each calendar week shows whether it hit.

**Acceptance criteria:**
- [ ] Tapping a day up to today toggles it, saves it, and updates the current and best streaks at once. Future days are disabled.
- [ ] Days in any past month can be marked. There is no lower limit.
- [ ] For a weekly habit, each week row shows whether it hit its target.

**Verification:**
- [ ] `npx playwright test e2e/past-days.spec.js` passes. It covers spec end-to-end flows 3 and 4.

**Dependencies:** Task 9

**Files likely touched:** `src/views/habit.js`, `e2e/past-days.spec.js`

**Estimated scope:** S

#### Task 11: Edit and delete a habit

**Description:** Add `#/habit/<id>/edit` and the Delete action on the detail screen.

**Acceptance criteria:**
- [ ] Edit opens the form with the current values. When the cadence or target changes, the form shows the note that streaks will be recalculated. Save returns to the detail screen with recalculated streaks.
- [ ] Delete shows a confirm step. Its text says all history for the habit will be deleted and suggests an export first. Confirming removes the habit and returns to Today. Cancelling changes nothing.

**Verification:**
- [ ] `npx playwright test e2e/edit-delete.spec.js` passes, including a target change from 3 to 2 that changes a weekly streak.

**Dependencies:** Task 10

**Files likely touched:** `src/views/habit-form.js`, `src/views/habit.js`, `src/app.js`, `e2e/edit-delete.spec.js`

**Estimated scope:** M

### Checkpoint B: History and editing (after Tasks 9 to 11)

- [ ] All tests pass.
- [ ] Every screen in the spec exists except Settings.
- [ ] Review with the user. Decide when to run the visual design step (see Open Questions).

### Phase 4: Data safety

#### Task 12: Settings screen: week start and delete all data

**Description:** Add `#/settings` with the week start choice, Delete all data, and the "About your data" note. Export and import come in Task 13.

**Acceptance criteria:**
- [ ] "Week starts on" offers all 7 days, defaults to Monday, saves the choice, and recalculates weekly streaks and progress.
- [ ] "Delete all data" needs a confirm step, then returns the app to the empty state.
- [ ] The "About your data" note matches the spec text.

**Verification:**
- [ ] `npx playwright test e2e/settings.spec.js` passes, including a week start change that moves a weekly habit's streak.

**Dependencies:** Task 11

**Files likely touched:** `src/views/settings.js`, `src/app.js`, `e2e/settings.spec.js`

**Estimated scope:** S

#### Task 13: Export and import a backup

**Description:** Write `src/backup.js` and add the Export and Import buttons to Settings.

**Acceptance criteria:**
- [ ] Export downloads `habit-tracker-backup-YYYY-MM-DD.json` that holds the full stored document.
- [ ] Import validates the file, shows a summary ("4 habits, 212 completions"), and replaces all data only after the user confirms.
- [ ] A file that fails validation changes nothing and shows an error that names the problem.

**Verification:**
- [ ] `npm test` passes `tests/backup.test.js`: an export-then-import round trip gives identical data, and bad files are rejected.
- [ ] `npx playwright test e2e/backup.spec.js` passes. It covers spec end-to-end flow 5.

**Dependencies:** Task 12

**Files likely touched:** `src/backup.js`, `tests/backup.test.js`, `src/views/settings.js`, `e2e/backup.spec.js`

**Estimated scope:** M

#### Task 14: Storage problem and data problem states

**Description:** Show the error states from the spec. Never overwrite data that failed validation.

**Acceptance criteria:**
- [ ] When a save fails, Today shows the storage problem banner. The change stays on screen, marked as not saved.
- [ ] Invalid stored data shows the data problem screen with "Export raw data" and "Reset all data" (with a confirm step). Data from a newer version shows its own message. The app never writes in either case.
- [ ] The localStorage value is byte-for-byte unchanged after the data problem screen loads.

**Verification:**
- [ ] `npx playwright test e2e/data-problem.spec.js` passes. It covers spec end-to-end flow 6 and a failing `setItem`.

**Dependencies:** Task 13 (reuses the download function for "Export raw data")

**Files likely touched:** `src/app.js`, `src/views/today.js`, `src/views/data-problem.js`, `e2e/data-problem.spec.js`

**Estimated scope:** M

#### Task 15: Live updates: other tabs, midnight, and persistent storage

**Description:** Keep the screen correct while the app stays open, and ask the browser to keep the data.

**Acceptance criteria:**
- [ ] A `storage` event from another tab reloads the data and re-renders.
- [ ] Across local midnight, "today" moves forward. This happens on `visibilitychange` and with a timer set for the next midnight.
- [ ] At first start-up, the app calls `navigator.storage.persist()` when it exists. The result does not change behavior.

**Verification:**
- [ ] `npx playwright test e2e/live-updates.spec.js` passes. It uses Playwright's clock control to cross midnight and a second page for the `storage` event.

**Dependencies:** Task 8 (can run in parallel with Tasks 9 to 14)

**Files likely touched:** `src/app.js`, `e2e/live-updates.spec.js`

**Estimated scope:** S

### Checkpoint C: Data safety (after Tasks 12 to 15)

- [ ] All unit and end-to-end tests pass. End-to-end flows 1 to 6 are covered.
- [ ] Review with the user before offline work and deployment.

### Phase 5: Offline and deployment

#### Task 16: Offline use and home-screen install

**Description:** Add the web app manifest, the service worker, and the icons so the app installs to the home screen and works offline.

**Acceptance criteria:**
- [ ] `manifest.webmanifest` has the name, `display: standalone`, relative `start_url` and `scope`, and 192 px, 512 px, and maskable icons. `index.html` links it and has the Apple touch icon.
- [ ] `sw.js` caches every app file on install, serves from the cache, and deletes old caches. The cache name includes a version string.
- [ ] After the first load, the app opens and works with the network off.

**Verification:**
- [ ] `npx playwright test e2e/offline.spec.js` passes. It covers spec end-to-end flow 7.
- [ ] Manual check: the browser network panel shows no requests after the first load (spec success criterion 4).

**Dependencies:** Tasks 14, 15 (the cache list needs every app file)

**Files likely touched:** `manifest.webmanifest`, `sw.js`, `icons/`, `index.html`, `e2e/offline.spec.js`

**Estimated scope:** M

#### Task 17: GitHub Pages deployment

**Description:** Add the workflow that tests and deploys the app files to GitHub Pages.

**Acceptance criteria:**
- [ ] `.github/workflows/pages.yml` runs `npm test` on each push to `main` and deploys only if the tests pass.
- [ ] The deployed site contains only the app files. `SPEC.md`, `tests/`, and `docs/` return 404 on the site.
- [ ] The site works at `https://mcfwesh.github.io/addy-osmani-impeccable-test/`.

**Verification:**
- [ ] The workflow run on `main` succeeds (`gh run list --workflow pages.yml`).
- [ ] `curl -sI https://mcfwesh.github.io/addy-osmani-impeccable-test/` returns 200, and the same URL plus `SPEC.md` returns 404.
- [ ] User step first: in the repo settings, set the Pages source to "GitHub Actions".

**Dependencies:** Task 16

**Files likely touched:** `.github/workflows/pages.yml`

**Estimated scope:** XS

#### Task 18: iPhone checks

**Description:** The user runs the spec's manual checks on the iPhone.

**Acceptance criteria:**
- [ ] The app installs from Safari to the home screen and opens from there.
- [ ] With Airplane Mode on, the app opens and works.
- [ ] An export appears in the Files app and imports again. One full add-and-mark flow works with VoiceOver.

**Verification:**
- [ ] The user confirms each check.

**Dependencies:** Task 17

**Files likely touched:** None (fixes become new tasks)

**Estimated scope:** XS

### Checkpoint: Complete

- [ ] All 8 spec success criteria are met.
- [ ] The user approves v1.

## Parallel Work

- **Safe in parallel:** Task 1 with Task 2. Tasks 6 and 7 (one worker, in order) with Tasks 3 to 5. Task 15 with Tasks 9 to 14.
- **Must be in order:** Tasks 3 → 4 → 5 (shared `today.js` and `app.js`), 6 → 7 (shared file), 9 → 10 → 11, 12 → 13 → 14.
- **Shared contract first:** Tasks 3 and 6 both use the data shape in `SPEC.md`. The spec already fixes it, so they can start in parallel.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Daylight saving or time zone bugs in date math | High | Calendar-date strings only. Task 2 tests run with `TZ=America/New_York`. |
| Streak rule edge cases are wrong | High | Pure functions with 100% branch coverage. Every worked example in the spec is a test. |
| iPhone Safari deletes localStorage | High | Home-screen install, `navigator.storage.persist()`, and the export button. Task 18 checks the real phone. |
| Playwright WebKit differs from iPhone Safari | Medium | Task 18 manual checks on the real phone. |
| A stale service worker keeps an old version | Medium | Versioned cache name and old-cache cleanup in Task 16. |
| Absolute paths break under the `/addy-osmani-impeccable-test/` subpath | Medium | Relative paths only. Checks in Tasks 1 and 17. |

## Open Questions

1. **When to run the visual design step.** The spec leaves the look to a separate design step. I recommend running it with Impeccable after Checkpoint B, when every main screen exists, and before Task 16, so the icons come from the design.
