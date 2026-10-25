import { el } from './dom.js';

export function render(root, state) {
  const habits = state.data.habits;
  const children = [el('h1', { text: 'Today' })];

  if (habits.length === 0) {
    children.push(
      el('p', { text: 'No habits yet. Add one to start tracking.' }),
      el('a', { href: '#/new', className: 'button', text: 'Add your first habit' }),
    );
  } else {
    children.push(
      el('ul', {}, ...habits.map((habit) => el('li', { text: habit.name }))),
      el('nav', { 'aria-label': 'Actions' },
        el('a', { href: '#/new', text: 'Add habit' }),
        el('a', { href: '#/settings', text: 'Settings' }),
      ),
    );
  }
  root.replaceChildren(...children);
}
