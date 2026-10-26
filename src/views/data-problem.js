import { el } from './dom.js';
import { confirmDialog } from './confirm.js';
import { downloadText } from './download.js';

// Full screen shown instead of any route while the saved data is read-only:
// it failed validation, or a newer version of the app wrote it.
// Nothing here writes to storage except the confirmed reset.
export function render(root, state, actions) {
  const newer = state.loadStatus === 'newer-version';

  const exportButton = el('button', { type: 'button', text: 'Export raw data' });
  exportButton.addEventListener('click', () => {
    // The exact stored text, byte for byte.
    downloadText(`habit-tracker-raw-${state.todayDate}.json`, state.raw);
  });

  const resetButton = el('button', { type: 'button', className: 'delete-habit', text: 'Reset all data' });
  resetButton.addEventListener('click', () => confirmDialog({
    opener: resetButton,
    title: 'Reset all data?',
    body: 'This deletes the saved data on this phone and starts again with no habits. You cannot undo this. Export the raw data first if you want to keep it.',
    confirmText: 'Reset all data',
    onConfirm: () => actions.resetAllData(),
  }));

  const explanation = newer
    ? [
      el('p', { text: 'This copy of the app is older than the saved data, so it cannot read it safely. Reload the page or update the app to get the newest version.' }),
      el('p', { text: 'Your data has not been changed or deleted.' }),
    ]
    : [
      el('p', { text: 'The app could not read your saved habits. It has not changed or deleted them.' }),
      el('p', { text: 'You can export the raw data to keep a copy or to get help, or reset all data to start again with no habits.' }),
      el('p', { className: 'problem-details', text: `Details: ${state.loadError}` }),
    ];

  root.replaceChildren(
    el('h1', { text: newer ? 'Your data comes from a newer version' : 'Your saved data has a problem' }),
    ...explanation,
    el('div', { className: 'habit-actions' }, exportButton, resetButton),
  );
}
