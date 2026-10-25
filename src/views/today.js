import { el } from './dom.js';
import { formatStreak } from './format.js';
import { currentStreak, weekProgress } from '../streaks.js';

export function render(root, state, actions) {
  const focusedId = document.activeElement?.dataset?.habitId;
  const habits = state.data.habits;
  const children = [el('h1', { text: 'Today' })];

  if (habits.length === 0) {
    children.push(
      el('p', { text: 'No habits yet. Add one to start tracking.' }),
      el('a', { href: '#/new', className: 'button', text: 'Add your first habit' }),
    );
  } else {
    if (habits.every((habit) => isDoneForToday(habit, state))) {
      children.push(el('p', { role: 'status', className: 'all-done', text: 'All done for today.' }));
    }
    children.push(
      el('ul', {}, ...habits.map((habit) => habitRow(habit, state, actions))),
      el('nav', { 'aria-label': 'Actions' },
        el('a', { href: '#/new', text: 'Add habit' }),
        el('a', { href: '#/settings', text: 'Settings' }),
      ),
    );
  }
  root.replaceChildren(...children);
  if (focusedId) {
    root.querySelector(`button[data-habit-id="${CSS.escape(focusedId)}"]`)?.focus();
  }
}

function isDoneForToday(habit, state) {
  if (habit.done.includes(state.todayDate)) return true;
  return weekProgress(habit, state.data.settings, state.todayDate)?.hit === true;
}

function habitRow(habit, state, actions) {
  const done = habit.done.includes(state.todayDate);
  const { settings } = state.data;
  const progress = weekProgress(habit, settings, state.todayDate);
  const streak = formatStreak(currentStreak(habit, settings, state.todayDate), habit.cadence);
  const stats = progress ? `${streak} · ${progress.done} of ${progress.target} this week` : streak;
  return el('li', {},
    el('div', { className: 'habit-info' },
      el('span', { className: 'habit-name', text: habit.name }),
      el('span', { className: 'habit-stats', text: stats }),
    ),
    el('button', {
      type: 'button',
      className: 'done-toggle',
      'aria-pressed': String(done),
      'aria-label': `Mark ${habit.name} done today`,
      'data-habit-id': habit.id,
      text: done ? '✓ Done' : 'Done',
      onclick: () => actions.toggleToday(habit.id),
    }),
  );
}
