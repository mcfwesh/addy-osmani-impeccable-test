import { el } from './dom.js';
import { formatStreak } from './format.js';
import { currentStreak, bestStreak, weekStatus } from '../streaks.js';
import { startOfWeek, addDays } from '../dates.js';
import { calendarWeeks, weekdayNames, monthName, dateLabel, shiftMonth } from '../calendar.js';

// Month on screen. Kept here, not in the URL, and reset when another habit opens.
let shown = { habitId: null, year: 0, month: 0 };
let focusDate = null;

export function render(root, state, actions, params) {
  const habit = state.data.habits.find((h) => h.id === params.id);
  if (!habit) {
    window.location.replace('#/');
    return;
  }
  const [todayYear, todayMonth] = state.todayDate.split('-').map(Number);
  if (shown.habitId !== habit.id) {
    shown = { habitId: habit.id, year: todayYear, month: todayMonth };
  }
  const { settings } = state.data;
  const isCurrentMonth = shown.year === todayYear && shown.month === todayMonth;
  const focusedNav = document.activeElement?.dataset?.nav;
  // Safari does not focus a button on click, so a tapped day is remembered in focusDate.
  const focusedDate = focusDate ?? document.activeElement?.dataset?.date;
  focusDate = null;

  const goTo = (delta) => {
    shown = { habitId: habit.id, ...shiftMonth(shown, delta) };
    render(root, state, actions, params);
  };

  const cadenceText = habit.cadence === 'weekly' ? 'Weekly' : 'Daily';
  const children = [
    el('a', { href: '#/', text: 'Today' }),
    el('h1', { text: habit.name }),
    el('p', { className: 'habit-cadence', text: cadenceText }),
  ];
  const deleteButton = el('button', { type: 'button', className: 'delete-habit', text: 'Delete' });
  deleteButton.addEventListener('click', () => openDeleteDialog(habit, deleteButton, actions));
  if (habit.cadence === 'weekly') {
    children.push(el('p', { text: `Target: ${habit.weeklyTarget} ${habit.weeklyTarget === 1 ? 'day' : 'days'} a week` }));
  }
  children.push(
    el('div', { className: 'habit-actions' },
      el('a', { href: `#/habit/${encodeURIComponent(habit.id)}/edit`, className: 'button', text: 'Edit' }),
      deleteButton,
    ),
    el('p', { className: 'streak-current', text: `Current streak: ${formatStreak(currentStreak(habit, settings, state.todayDate), habit.cadence)}` }),
    el('p', { className: 'streak-best', text: `Best streak: ${formatStreak(bestStreak(habit, settings, state.todayDate), habit.cadence)}` }),
    el('div', { className: 'month-nav' },
      el('button', { type: 'button', 'data-nav': 'prev', text: 'Previous month', onclick: () => goTo(-1) }),
      el('h2', { id: 'month-heading', text: `${monthName(shown.month)} ${shown.year}` }),
      el('button', { type: 'button', 'data-nav': 'next', text: 'Next month', disabled: isCurrentMonth, onclick: () => goTo(1) }),
    ),
    calendar(habit, state, actions, settings),
  );
  root.replaceChildren(...children);
  if (focusedNav) root.querySelector(`button[data-nav="${focusedNav}"]`)?.focus();
  if (focusedDate) root.querySelector(`button[data-date="${focusedDate}"]`)?.focus();
}

function calendar(habit, state, actions, settings) {
  const weekly = habit.cadence === 'weekly';
  const headerCells = weekdayNames(settings.weekStartsOn).map((name) =>
    el('th', { scope: 'col', abbr: name, text: name.slice(0, 3) }));
  if (weekly) headerCells.push(el('th', { scope: 'col', text: 'Week' }));
  const rows = calendarWeeks(shown.year, shown.month, settings.weekStartsOn).map((week) => {
    const cells = week.map((cell) =>
      el('td', {}, ...(cell ? [dayButton(cell.date, habit, state, actions)] : [])));
    if (weekly) {
      // Every row has at least one real date; its week may start in the previous month.
      const anyDate = week.find(Boolean).date;
      const weekStartDate = startOfWeek(anyDate, settings.weekStartsOn);
      cells.push(weekCell(weekStatus(habit, settings, weekStartDate, state.todayDate)));
    }
    return el('tr', {}, ...cells);
  });
  return el('table', { className: 'calendar', 'aria-labelledby': 'month-heading' },
    el('thead', {}, el('tr', {}, ...headerCells)),
    el('tbody', {}, ...rows),
  );
}

function weekCell(status) {
  const cell = el('td', { className: 'week-status' });
  if (status.state === 'future') return cell;
  const counts = `${status.done} of ${status.target}`;
  const full = {
    hit: `Hit: ${counts}`,
    missed: `Missed: ${counts}`,
    pending: `${counts} so far`,
  }[status.state];
  const short = { hit: 'Hit', missed: 'Missed', pending: `${status.done}/${status.target}` }[status.state];
  cell.classList.add(`week-${status.state}`);
  cell.append(
    el('span', { className: 'visually-hidden', text: full }),
    el('span', { 'aria-hidden': 'true', text: short }),
  );
  return cell;
}

function dayButton(date, habit, state, actions) {
  const done = habit.done.includes(date);
  const future = date > state.todayDate;
  return el('button', {
    type: 'button',
    className: 'day',
    'aria-pressed': String(done),
    'aria-label': dateLabel(date),
    disabled: future,
    'data-date': date,
    text: `${Number(date.slice(8))}${done ? ' ✓' : ''}`,
    onclick: () => {
      focusDate = date;
      actions.toggleDay(habit.id, date);
    },
  });
}

// Confirm step before deleting. A native <dialog> traps focus and closes on Escape.
function openDeleteDialog(habit, opener, actions) {
  const title = el('h2', { id: 'delete-title' });
  title.textContent = `Delete ${habit.name}?`;
  const cancel = el('button', { type: 'button', text: 'Cancel' });
  const confirm = el('button', { type: 'button', className: 'delete-confirm', text: 'Delete habit' });
  const dialog = el('dialog', { 'aria-labelledby': 'delete-title' },
    title,
    el('p', { text: 'This deletes the habit and all of its history. You cannot undo this. To keep a copy, export a backup in Settings first.' }),
    el('div', { className: 'habit-actions' }, cancel, confirm),
  );
  const close = () => {
    dialog.close();
    dialog.remove();
    opener.focus();
  };
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  confirm.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    actions.deleteHabit(habit.id);
  });
  // Inside the view, so a route change (e.g. Back) removes it with the screen.
  opener.parentElement.append(dialog);
  dialog.showModal();
  cancel.focus();
}
