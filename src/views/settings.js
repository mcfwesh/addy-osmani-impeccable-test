import { el } from './dom.js';
import { confirmDialog } from './confirm.js';
import { weekdayNames } from '../calendar.js';

// Shown after a week start change, so it survives the re-render.
let savedNote = false;

export function render(root, state, actions) {
  const current = state.data.settings.weekStartsOn;
  const select = el('select', { id: 'week-start' },
    ...weekdayNames(0).map((name, index) =>
      el('option', { value: String(index), selected: index === current, text: name })));
  select.addEventListener('change', () => {
    savedNote = true;
    actions.setWeekStartsOn(Number(select.value));
  });

  const deleteButton = el('button', { type: 'button', className: 'delete-habit', text: 'Delete all data' });
  deleteButton.addEventListener('click', () => confirmDialog({
    opener: deleteButton,
    title: 'Delete all data?',
    body: 'This deletes every habit and all history on this phone. You cannot undo this. Export a backup first if you want a copy.',
    confirmText: 'Delete all data',
    onConfirm: () => actions.deleteAllData(),
  }));

  const hadFocus = document.activeElement?.id === 'week-start';
  root.replaceChildren(
    el('a', { href: '#/', text: 'Today' }),
    el('h1', { text: 'Settings' }),
    el('section', { className: 'settings-section' },
      el('h2', { text: 'Weekly habits' }),
      el('label', { htmlFor: 'week-start', text: 'Week starts on' }),
      select,
      el('p', { role: 'status', 'aria-live': 'polite', className: 'saved-note', text: savedNote ? 'Saved.' : '' }),
    ),
    // Task 13 adds the Backup section (Export and Import) here.
    el('section', { className: 'settings-section' },
      el('h2', { text: 'Delete all data' }),
      el('div', {}, deleteButton),
    ),
    el('section', { className: 'settings-section' },
      el('h2', { text: 'About your data' }),
      el('p', { text: 'Your habits are stored only on this phone. Nothing is sent anywhere. If you clear your browser data or lose your phone, your habits are gone. Export a backup now and then.' }),
    ),
  );
  if (hadFocus) root.querySelector('#week-start').focus();
  savedNote = false;
}
