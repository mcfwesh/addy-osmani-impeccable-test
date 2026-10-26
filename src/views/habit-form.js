import { validateHabitInput } from '../store.js';
import { el } from './dom.js';

const DEFAULT_TARGET = 3;

// `habit` is optional: pass an existing habit to pre-fill the form (edit, Task 11).
export function renderForm(root, { habit = null, title, onSubmit, onCancel }) {
  const cadence = habit ? habit.cadence : 'daily';
  const target = habit && habit.weeklyTarget ? habit.weeklyTarget : DEFAULT_TARGET;

  const nameInput = el('input', { id: 'habit-name', name: 'name', type: 'text', autocomplete: 'off', value: habit ? habit.name : '' });
  const nameError = el('p', { id: 'habit-name-error', className: 'error', hidden: true });
  const daily = el('input', { type: 'radio', name: 'cadence', value: 'daily', checked: cadence === 'daily' });
  const weekly = el('input', { type: 'radio', name: 'cadence', value: 'weekly', checked: cadence === 'weekly' });
  const targetInput = el('input', { id: 'habit-target', name: 'weeklyTarget', type: 'number', inputMode: 'numeric', min: '1', max: '7', step: '1', value: String(target) });
  const targetError = el('p', { id: 'habit-target-error', className: 'error', hidden: true });
  const targetField = el('div', { hidden: cadence !== 'weekly' },
    el('label', { htmlFor: 'habit-target', text: 'Weekly target' }), targetInput, targetError);

  function syncTarget() {
    targetField.hidden = !weekly.checked;
  }
  // Editing only: tell the user that changing cadence or target recalculates streaks.
  // The container stays in the page so screen readers announce the text when it appears.
  const recalcNote = el('p', { className: 'recalc-note', 'aria-live': 'polite' });
  function syncRecalcNote() {
    if (!habit) return;
    const nowWeekly = weekly.checked;
    const changed = nowWeekly
      ? habit.cadence !== 'weekly' || Number(targetInput.value) !== habit.weeklyTarget
      : habit.cadence !== 'daily';
    recalcNote.textContent = changed ? 'Streaks will be recalculated from your history.' : '';
  }

  function onChange() {
    syncTarget();
    syncRecalcNote();
  }
  daily.addEventListener('change', onChange);
  weekly.addEventListener('change', onChange);
  targetInput.addEventListener('input', syncRecalcNote);

  function showError(input, errorNode, message) {
    errorNode.textContent = message;
    errorNode.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errorNode.id);
    input.focus();
  }

  function clearErrors() {
    for (const [input, node] of [[nameInput, nameError], [targetInput, targetError]]) {
      node.hidden = true;
      node.textContent = '';
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
  }

  const form = el('form', { noValidate: true },
    el('div', {}, el('label', { htmlFor: 'habit-name', text: 'Name' }), nameInput, nameError),
    el('fieldset', {},
      el('legend', { text: 'Cadence' }),
      el('label', {}, daily, ' Daily'),
      el('label', {}, weekly, ' Weekly'),
    ),
    targetField,
    recalcNote,
    el('button', { type: 'submit', text: 'Save' }),
    el('button', { type: 'button', text: 'Cancel', onclick: onCancel }),
  );

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearErrors();
    const result = validateHabitInput({
      name: nameInput.value,
      cadence: weekly.checked ? 'weekly' : 'daily',
      weeklyTarget: weekly.checked ? Number(targetInput.value) : null,
    });
    if (!result.ok) {
      if (result.field === 'weeklyTarget') showError(targetInput, targetError, result.error);
      else showError(nameInput, nameError, result.error);
      return;
    }
    onSubmit(result.value);
  });

  root.replaceChildren(el('h1', { text: title }), form);
}
