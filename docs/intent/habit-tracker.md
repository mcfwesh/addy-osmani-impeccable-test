# Habit tracker: statement of intent

Confirmed by the user on 2026-10-25.

## Outcome

A phone web app that the user adds to the home screen. The user checks off 3 to 5 habits.

- Some habits are daily, for example reading and water.
- Some habits have a weekly target, for example exercise 3 times a week.

## User

Only the user. There are no other users.

## Streaks

- Each habit has its own streak. There is no overall streak across all habits.
- A daily habit's streak counts the days in a row that the user did it.
- A weekly habit's streak counts the weeks in a row that the user hit the target. The days inside the week do not matter.
- Today does not break a streak until today ends.

## Missed day

- A missed day resets that habit's streak to 0. There are no freeze days and no grace days.
- The user can mark a habit done on any past day. There is no limit. The streak recalculates from the history.
- The app keeps the best streak for each habit. A reset does not erase it.

## Data

- All data stays on the phone.
- There is no account, no login, no server, and no sync.
- A manual export button saves a backup file that the user keeps.
- Known cost: if the user clears the browser data or loses the phone without an export, the history is gone.

## Out of scope

- Reminders and notifications. A web app with no server cannot reliably send reminders on a phone.
- Charts beyond streaks.
- Other users.
- Cloud backup.

## Not yet decided

- Why now: not asked. It does not change the build.
- Which day a week starts on.
