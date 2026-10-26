import { el } from './dom.js';
import { confirmDialog } from './confirm.js';
import { weekdayNames } from '../calendar.js';
import { backupFileName, serializeBackup, parseBackup, MAX_BACKUP_BYTES } from '../backup.js';
import { downloadText } from './download.js';

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

  const exportButton = el('button', { type: 'button', text: 'Export backup' });
  exportButton.addEventListener('click', () => {
    downloadText(backupFileName(state.todayDate), serializeBackup(state.data));
  });

  // The file picker is hidden. The visible button opens it, so keyboard users can reach it.
  const importError = el('p', { role: 'alert', className: 'import-error' });
  const fileInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    tabIndex: -1,
    'aria-label': 'Backup file',
  });
  const importButton = el('button', { type: 'button', text: 'Import backup' });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    importError.textContent = '';
    if (!file) return;
    const result = await readBackup(file);
    // Choosing the same file again must fire "change" again.
    fileInput.value = '';
    if (!result.ok) {
      importError.textContent = result.error;
      return;
    }
    confirmDialog({
      opener: importButton,
      title: 'Replace all data?',
      body: `This backup holds ${result.summary}. Importing replaces all habits and history on this phone. You cannot undo this.`,
      confirmText: 'Import backup',
      onConfirm: () => actions.importData(result.data),
    });
  });

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
    el('section', { className: 'settings-section' },
      el('h2', { text: 'Backup' }),
      el('div', { className: 'habit-actions' }, exportButton, importButton, fileInput),
      importError,
    ),
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

// Checks the size before reading, so a huge file is never loaded into memory.
async function readBackup(file) {
  if (file.size > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'This file is too large to be a backup.' };
  }
  try {
    return parseBackup(await file.text());
  } catch {
    return { ok: false, error: 'This file could not be read.' };
  }
}
