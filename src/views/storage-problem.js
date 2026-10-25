import { el } from './dom.js';

// Minimal placeholder; Task 14 builds the real screen.
export function render(root, state) {
  const message = state.loadStatus === 'newer-version'
    ? 'This data was saved by a newer version of the app. It has not been changed.'
    : 'The saved data could not be read. It has not been changed.';
  root.replaceChildren(el('h1', { text: 'Habit Tracker' }), el('p', { text: message }));
}
