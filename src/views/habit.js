import { el } from './dom.js';
import { formatStreak } from './format.js';
import { currentStreak, bestStreak } from '../streaks.js';
import { calendarWeeks, weekdayNames, monthName, dateLabel, shiftMonth } from '../calendar.js';

// Month on screen. Kept here, not in the URL, and reset when another habit opens.
let shown = { habitId: null, year: 0, month: 0 };

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
  if (habit.cadence === 'weekly') {
    children.push(el('p', { text: `Target: ${habit.weeklyTarget} ${habit.weeklyTarget === 1 ? 'day' : 'days'} a week` }));
  }
  children.push(
    el('p', { className: 'streak-current', text: `Current streak: ${formatStreak(currentStreak(habit, settings, state.todayDate), habit.cadence)}` }),
    el('p', { className: 'streak-best', text: `Best streak: ${formatStreak(bestStreak(habit, settings, state.todayDate), habit.cadence)}` }),
    el('div', { className: 'month-nav' },
      el('button', { type: 'button', 'data-nav': 'prev', text: 'Previous month', onclick: () => goTo(-1) }),
      el('h2', { id: 'month-heading', text: `${monthName(shown.month)} ${shown.year}` }),
      el('button', { type: 'button', 'data-nav': 'next', text: 'Next month', disabled: isCurrentMonth, onclick: () => goTo(1) }),
    ),
    calendar(habit, state, settings.weekStartsOn),
  );
  root.replaceChildren(...children);
  if (focusedNav) root.querySelector(`button[data-nav="${focusedNav}"]`)?.focus();
}

function calendar(habit, state, weekStartsOn) {
  const header = el('tr', {}, ...weekdayNames(weekStartsOn).map((name) =>
    el('th', { scope: 'col', abbr: name, text: name.slice(0, 3) })));
  const rows = calendarWeeks(shown.year, shown.month, weekStartsOn).map((week) =>
    el('tr', {}, ...week.map((cell) => el('td', {}, ...(cell ? [dayButton(cell.date, habit, state)] : [])))));
  return el('table', { className: 'calendar', 'aria-labelledby': 'month-heading' },
    el('thead', {}, header),
    el('tbody', {}, ...rows),
  );
}

function dayButton(date, habit, state) {
  const done = habit.done.includes(date);
  const future = date > state.todayDate;
  return el('button', {
    type: 'button',
    className: 'day',
    'aria-pressed': String(done),
    'aria-label': `${dateLabel(date)}, ${done ? 'done' : 'not done'}`,
    disabled: future,
    'data-date': date,
    text: `${Number(date.slice(8))}${done ? ' ✓' : ''}`,
  });
}
