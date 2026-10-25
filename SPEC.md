# Spec: Habit Tracker

Status: draft, waiting for approval. Source: `docs/intent/habit-tracker.md` (confirmed 2026-10-25).

## Objective

A personal habit tracker that runs as a web app on one phone. The user adds it to the home screen and checks off 3 to 5 habits. The app shows a streak for each habit. All data stays on the phone.

### User

One person, the owner of the phone. There are no accounts and no other users.

### User stories

1. As the user, I add a habit with a name and a cadence. The cadence is daily or weekly. A weekly habit has a target from 1 to 7 days per week.
2. As the user, I open the app and see today's habits. I mark each one done with one tap.
3. As the user, I see the current streak and the best streak for each habit.
4. As the user, I mark a habit done on any past day that I forgot to log. The streaks update at once.
5. As the user, I export all my data to a backup file. I import that file later to restore the data.
6. As the user, I use the app with no network connection after the first visit.

### Why the design is this way

- No server stores user data. The only network use is the first download of the app files from a static host.
- Streaks are always calculated from the history. The app never stores a streak number. This is why past-day edits and target changes give correct results with no extra logic.

## Tech Stack

- Plain HTML, CSS, and JavaScript ES modules. There is no framework and no build step.
- Target phone: iPhone, Safari on iOS, opened from the home screen.
- Storage: `window.localStorage`, one key (see Data Model).
- Offline: a web app manifest and a small service worker that caches the app files.
- Hosting: GitHub Pages, deployed by a GitHub Actions workflow (see Deployment).
- Unit tests: the Node built-in test runner (`node:test`), Node 24. No test dependencies.
- End-to-end tests: `@playwright/test`, using the WebKit browser and an iPhone device profile. This is the only dependency. Approved 2026-10-25.

## Commands

All commands run from the repository root.

```sh
# Dev server (localhost counts as a secure context, so the service worker works)
python3 -m http.server 4174 --bind 127.0.0.1

# Unit tests
npm test                      # runs: node --test tests/

# Unit tests with coverage
node --test --experimental-test-coverage tests/

# One-time setup for end-to-end tests
npm install
npx playwright install webkit

# End-to-end tests
npx playwright test
```

There is no build command. The deploy output is the app files only: `index.html`, `manifest.webmanifest`, `sw.js`, `styles.css`, `icons/`, and `src/`.

## Deployment

- A GitHub Actions workflow (`.github/workflows/pages.yml`) runs `npm test` on each push to `main`. If the tests pass, it publishes only the app files to GitHub Pages.
- Repository: `https://github.com/mcfwesh/addy-osmani-impeccable-test` (public, branch `main`).
- The site address is `https://mcfwesh.github.io/addy-osmani-impeccable-test/`. The app is not at the domain root, so every path in the app is relative (`./src/app.js`, not `/src/app.js`). This includes the manifest `start_url` and `scope`, and the service worker registration.
- GitHub Pages serves only the app files. User data stays in the phone's localStorage and never goes to GitHub.
- Each deploy changes the service worker cache name, so the phone picks up the new version on its next visit.
- The repository is public, so this spec, the tests, and `docs/intent/` are public too. They contain no personal data.
- GitHub Pages must be set to use "GitHub Actions" as its source in the repository settings.

## Project Structure

```
./
  SPEC.md                 → This document
  docs/intent/            → Confirmed statement of intent
  .github/workflows/
    pages.yml             → Test, then deploy app files to GitHub Pages
  index.html              → App shell, loads src/app.js
  manifest.webmanifest    → Name, icons, display: standalone
  sw.js                   → Service worker: caches app files for offline use
  styles.css              → All styles
  icons/                  → Home-screen icons (192px, 512px, maskable)
  src/
    app.js                → Start-up, hash router, re-render on state change
    dates.js              → Pure local-date helpers (no Date.now inside)
    streaks.js            → Pure streak calculation
    store.js              → Load, validate, migrate, and save localStorage data
    backup.js             → Export to file, validate and import a file
    views/
      today.js            → Today screen
      habit.js            → Habit detail screen
      habit-form.js       → Add and edit habit screen
      settings.js         → Settings and data screen
  tests/                  → Unit tests (node:test), one file per src module
  e2e/                    → Playwright tests
  playwright.config.js    → WebKit, iPhone device profile, starts the dev server
  package.json            → "type": "module", scripts, @playwright/test
```

The tool folders (`.claude/`, `.agents/`, `.impeccable/`, and others) and `skills-lock.json` are agent configuration. They are not part of the app.

## Data Model

### Storage key

One localStorage key: `habit-tracker:v1`. The value is one JSON document. The app reads the whole document at start-up and writes the whole document after each change.

Size check: 5 habits × 365 dates × about 13 bytes ≈ 24 KB per year. The localStorage limit is about 5 MB, so size is not a concern for many years.

### Schema

```json
{
  "version": 1,
  "settings": {
    "weekStartsOn": 1
  },
  "habits": [
    {
      "id": "6f1c2a9e-3b7d-4c41-9a55-1e2f3a4b5c6d",
      "name": "Exercise",
      "cadence": "weekly",
      "weeklyTarget": 3,
      "createdAt": "2026-10-25T08:14:00.000Z",
      "done": ["2026-10-20", "2026-10-22"]
    },
    {
      "id": "0b8e7d6c-5a4f-4e3d-8c2b-1a0f9e8d7c6b",
      "name": "Read",
      "cadence": "daily",
      "weeklyTarget": null,
      "createdAt": "2026-10-25T08:15:00.000Z",
      "done": ["2026-10-23", "2026-10-24"]
    }
  ]
}
```

### Field rules

| Field | Type | Rule |
|---|---|---|
| `version` | integer | Always `1` for this spec. |
| `settings.weekStartsOn` | integer | `0` = Sunday … `6` = Saturday. Default `1` (Monday). |
| `habits` | array | Display order is array order. New habits go at the end. |
| `id` | string | From `crypto.randomUUID()`. Never changes. |
| `name` | string | Trimmed. 1 to 40 characters. Duplicate names are allowed. |
| `cadence` | string | `"daily"` or `"weekly"`. |
| `weeklyTarget` | integer or null | 1 to 7 when `cadence` is `"weekly"`. `null` when `"daily"`. |
| `createdAt` | string | ISO timestamp. Used for information only, not for streaks. |
| `done` | array of strings | Local calendar dates as `YYYY-MM-DD`. Sorted, no duplicates. One entry means "done on that day". |

### Date rules

- A date is the local calendar date on the phone, as `YYYY-MM-DD`. The app never stores timestamps for completions.
- "Today" is the phone's local date when the app reads it.
- Date math uses calendar dates, not millisecond arithmetic. This keeps daylight saving changes from breaking streaks.
- A habit is done or not done on a day. There are no counts. Two taps on the same day do not make two completions.

### Load and save behavior

| Situation | Behavior |
|---|---|
| Key is missing | Start with empty data (`habits: []`, default settings). Do not write until the first change. |
| Key holds valid version 1 data | Use it. |
| Key holds data that does not parse or fails validation | Show the "data problem" state. Do not overwrite the key. Offer "Export raw data" and "Reset all data". |
| `version` is greater than 1 | Show the "data problem" state with the message that the data comes from a newer version. Do not write. |
| localStorage is not available or a write fails | Show the "storage problem" state. Keep the change on screen but say clearly that it is not saved. |
| Another tab changes the key | Reload the data from the `storage` event and re-render. |

At first start-up, the app calls `navigator.storage.persist()` when that function exists. This asks the browser not to delete the data when space is low. The result does not change app behavior.

## Streak Rules

All streak functions are pure. They take the habit, the settings, and `today` as arguments. They never read the clock.

The app calculates two numbers for each habit:

- **Current streak**: the run that is still alive now.
- **Best streak**: the longest run anywhere in the history, including the current run.

Dates after `today` in `done` are ignored. (The UI does not allow them, but an imported file could contain them.)

### Daily habits

The unit is one day.

1. If today is done, count back from today through each day in a row that is done.
2. If today is not done, count back from yesterday instead. Today is still pending, so it does not break the streak.
3. If today and yesterday are both not done, the current streak is 0.
4. The best streak is the longest run of days in a row in `done`.

Worked example. Today is Sunday 2026-10-25.

| `done` contains | Current | Why |
|---|---|---|
| 10-22, 10-23, 10-24 | 3 | Today is pending. Count from 10-24 back. |
| 10-22, 10-23, 10-24, 10-25 | 4 | Today is done. Count from today back. |
| 10-22, 10-23 | 0 | Yesterday (10-24) is missed, and today is not done. |
| 10-22, 10-23, then the user marks 10-24 | 3 | The past-day edit fills the gap. |

### Weekly habits

The unit is one week. A week starts on `settings.weekStartsOn` and has 7 days.

1. A week **hits** when the number of done days in that week is at least `weeklyTarget`.
2. If the current week hits, count back from the current week through each week in a row that hits.
3. If the current week does not hit yet, count back from last week instead. The current week is pending until its last day ends.
4. If the current week does not hit and last week did not hit, the current streak is 0.
5. The best streak is the longest run of weeks in a row that hit.

Worked example. Week starts Monday. Target 3. Today is Sunday 2026-10-25, so the current week is 10-19 to 10-25.

| History | Current | Why |
|---|---|---|
| Weeks of 10-05 and 10-12 hit. Current week has 2 done days. | 2 | Current week is pending. Count from week of 10-12 back. |
| Same, and the user marks a third day this week. | 3 | Current week hits. |
| Week of 10-12 missed. Current week has 2 done days. | 0 | Last week missed, and the current week is pending. |

### What changes recalculate

Because streaks are calculated from `done`, these changes recalculate all streaks for the habit, including the best streak:

- Marking or unmarking any past day.
- Changing the cadence between daily and weekly.
- Changing `weeklyTarget`.
- Changing `settings.weekStartsOn` (all weekly habits).

Unmarking a past day can lower the best streak. This is correct: the user is fixing a mistake in the history.

### When "today" changes

If the app stays open across midnight, it re-reads today and re-renders. It does this on `visibilitychange` (when the app comes back to the front) and with a timer set for the next local midnight.

## Core Screens and States

Navigation uses the URL hash, so the browser Back button works.

| Route | Screen |
|---|---|
| `#/` | Today |
| `#/new` | Add habit |
| `#/habit/<id>` | Habit detail |
| `#/habit/<id>/edit` | Edit habit |
| `#/settings` | Settings and data |

An unknown route or an unknown habit id goes to Today.

### 1. Today (`#/`)

Shows one row per habit, in array order. Each row shows:

- The habit name. Tapping the name opens Habit detail.
- A done toggle for today. It is a button with `aria-pressed`.
- The current streak, with its unit: "4 days" or "3 weeks".
- For a weekly habit, the progress this week: "2 of 3 this week".

Links: "Add habit" and "Settings".

States:

| State | What the user sees |
|---|---|
| Empty | No habits yet. A short message and one "Add your first habit" button. |
| Normal | The habit list. |
| All done | The list, plus a short line that every habit for today is done. Weekly habits count as done for today if they are done today or their week already hits. |
| Storage problem | A banner at the top: changes are not being saved, and why (if known). |
| Data problem | A full screen instead of the list. It explains the problem and offers "Export raw data" and "Reset all data". Reset needs a confirm step. |

### 2. Habit detail (`#/habit/<id>`)

Shows:

- The name, the cadence, and the weekly target if weekly.
- Current streak and best streak.
- A month calendar. Done days are marked. The user taps any day up to today to toggle it. Future days are disabled. Buttons move to the previous and next month. The next-month button is disabled on the current month.
- For a weekly habit, each week row in the calendar shows whether it hit.
- "Edit" and "Delete" buttons.

Delete needs a confirm step. The confirm text says that all history for this habit will be deleted and suggests an export first.

### 3. Add habit and Edit habit (`#/new`, `#/habit/<id>/edit`)

Fields:

- Name: required, 1 to 40 characters after trimming.
- Cadence: Daily or Weekly.
- Weekly target: 1 to 7. Shown only when cadence is Weekly. Default 3.

States:

| State | Behavior |
|---|---|
| Invalid name | Error under the field: "Enter a name." or "Use 40 characters or fewer." Focus moves to the field. |
| Edit with a new cadence or target | A note under the fields says that streaks will be recalculated from the history. |
| Save | Saves and goes back: to Today after Add, to Habit detail after Edit. |
| Cancel | Goes back with no change. |

### 4. Settings and data (`#/settings`)

- **Week starts on**: a choice of the 7 days. Default Monday.
- **Export backup**: downloads `habit-tracker-backup-YYYY-MM-DD.json`. The file holds the full stored document.
- **Import backup**: picks a file, validates it, shows what it holds ("4 habits, 212 completions"), and asks for confirmation. Import replaces all current data. A file that fails validation changes nothing and shows an error that names the problem.
- **Delete all data**: needs a confirm step.
- **About your data**: a short plain note. Data is only on this phone. Clearing browser data or losing the phone deletes it. Export a backup now and then.

## Code Style

- ES modules, `const` by default, named exports, no classes unless a class makes the code simpler.
- Pure logic (`dates.js`, `streaks.js`, validation in `store.js` and `backup.js`) has no DOM and no clock access. Callers pass `today` in.
- Views render from state. Event handlers update state through `store.js`, then re-render. Views never write to localStorage directly.
- Names: `camelCase` for functions and variables, `kebab-case` for files. Dates in variable names end with `Date` when they are `YYYY-MM-DD` strings.
- User-facing text follows Plain English: short sentences, active voice.

Example:

```js
// src/streaks.js
import { addDays } from './dates.js';

export function currentDailyStreak(doneDates, todayDate) {
  const done = new Set(doneDates);
  let cursorDate = done.has(todayDate) ? todayDate : addDays(todayDate, -1);
  let streak = 0;
  while (done.has(cursorDate)) {
    streak += 1;
    cursorDate = addDays(cursorDate, -1);
  }
  return streak;
}
```

## Testing Strategy

### Unit tests (`tests/`, `node:test`)

These carry most of the risk, so they get most of the effort. Target: full branch coverage of `dates.js` and `streaks.js`.

`dates.js`:

- Month and year boundaries (10-31 → 11-01, 12-31 → 01-01).
- Leap day (2028-02-28 → 2028-02-29 → 2028-03-01).
- Daylight saving change days (2026-03-08 and 2026-11-01 in US time zones). Run these with `TZ=America/New_York`.
- Start of week for every `weekStartsOn` value.

`streaks.js`:

- Every row of both worked examples above.
- Empty history, a single day, and a run that ends today vs. yesterday vs. earlier.
- A past-day edit that joins two runs, and an unmark that splits a run.
- Best streak earlier in history than the current streak.
- Dates after today are ignored.
- Weekly: the current week pending vs. hit, target 1 and target 7, more done days than the target, and a change of `weekStartsOn` that moves days between weeks.
- Changing cadence and target recalculates.

`store.js` and `backup.js` (use a fake Storage object):

- Missing key, valid data, invalid JSON, invalid fields, and a newer `version`.
- A failed write sets the storage problem state.
- `done` arrays are saved sorted with no duplicates.
- Export then import gives identical data.
- Import rejects files with bad structure and leaves the current data unchanged.

### End-to-end tests (`e2e/`, Playwright, WebKit with an iPhone device profile)

Playwright's WebKit is close to iPhone Safari but is not the same browser. The manual checks below cover the difference.

1. Empty state → add a daily habit → mark today → streak shows 1 day.
2. Reload the page → data is still there.
3. Mark a past day in the calendar → the streak updates.
4. Add a weekly habit with target 3 → mark 3 days → the week shows as hit.
5. Export, delete all data, import → the original data returns.
6. Corrupt the localStorage value → the data problem screen appears and the key is not overwritten.
7. Go offline after the first load → the app still opens and works.

### Manual checks before calling v1 done

- Open the GitHub Pages address in Safari on the iPhone, add it to the home screen, and open it from there.
- Turn on Airplane Mode and open the app from the home screen. It still works.
- Export a backup and confirm the file appears in the Files app. Import it again.
- Use VoiceOver for one full add-and-mark flow.

## Boundaries

- **Always:**
  - Run `npm test` before each commit.
  - Pass `today` into logic. Never call `new Date()` inside `dates.js` or `streaks.js`.
  - Validate all data read from localStorage or from an import file.
  - Keep touch targets at least 44 × 44 CSS pixels.
- **Ask first:**
  - Adding any dependency beyond `@playwright/test`.
  - Changing the storage schema or `version`.
  - Changing any streak rule in this spec.
  - Adding any network request.
- **Never:**
  - Send user data off the phone: no analytics, no error reporting service, no sync.
  - Load scripts, fonts, or styles from a third-party server.
  - Overwrite stored data that failed validation.
  - Store a streak number instead of calculating it.

## Success Criteria

v1 is done when all of these are true:

1. All unit tests pass, with full branch coverage of `dates.js` and `streaks.js`.
2. All 7 end-to-end tests pass in Playwright WebKit with an iPhone device profile.
3. Every streak rule example in this spec gives the stated result in a unit test.
4. The app makes no network requests after the first load, checked in the browser network panel.
5. The app opens from the GitHub Pages address and works offline from the home screen on the iPhone.
6. Export then import restores identical data.
7. Bad stored data is never overwritten without the user choosing "Reset all data".
8. Every control works with a screen reader and has a touch target of at least 44 × 44 CSS pixels.

## Non-Goals

These are out of scope for v1. Each one needs a spec change first.

1. Reminders and notifications. A web app with no server cannot reliably send reminders on a phone.
2. Charts or statistics beyond the current and best streak and the calendar.
3. Accounts, other users, sharing, or social features.
4. Cloud backup, sync, or use on more than one device. The export file is the only backup.
5. Freeze days, grace days, or "skip" days. A missed day or week resets the streak.
6. An overall streak across all habits.
7. Counts or amounts (for example, "8 glasses of water"). A habit is done or not done each day.
8. Habit schedules on fixed weekdays (for example, "only Monday and Thursday"). Use a weekly target instead.
9. Archiving habits. Delete is the only way to remove a habit.
10. Notes, tags, categories, rewards, or points.
11. App store versions (native iOS or Android apps).
12. Visual design. This spec defines behavior only. The look comes from a separate design step.

## Assumptions

These were not confirmed in the interview. Correct any that are wrong.

1. Import is part of v1. Without it, the export file cannot restore anything.
2. The week starts on Monday by default and the user can change it in Settings.
3. Changing a habit's cadence or target recalculates its full history with the new rule. The app does not keep old targets.
4. A habit is done or not done each day. "Water" is a single check, not a count.
5. Past-day edits have no lower limit. The user can mark any day before the habit was created.

## Decisions

Confirmed by the user on 2026-10-25:

1. Hosting: GitHub Pages.
2. Phone: iPhone.
3. `@playwright/test` is approved as a dev dependency.
4. The app lives at the repository root. The earlier, unrelated files in this folder were removed.
5. Repository: `https://github.com/mcfwesh/addy-osmani-impeccable-test`.

## Risks

1. **iPhone storage deletion.** Safari can delete website storage after 7 days without use. A web app opened from the home screen is expected to avoid this, but this is not certain. Mitigation: the user opens the app from the home screen, the app calls `navigator.storage.persist()`, and the export button is the safety net.

## Open Questions

None.
