import { el } from './dom.js';

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

function habitRow(habit, state, actions) {
  const done = habit.done.includes(state.todayDate);
  return el('li', {},
    el('span', { className: 'habit-name', text: habit.name }),
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
