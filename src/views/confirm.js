import { el } from './dom.js';

// Confirm step before a destructive action. A native <dialog> traps focus and closes on Escape.
// Focus starts on Cancel. Cancel and Escape close it and return focus to the opener.
export function confirmDialog({ opener, title, body, confirmText, onConfirm }) {
  const titleNode = el('h2', { id: 'confirm-title' });
  titleNode.textContent = title;
  const bodyNode = el('p');
  bodyNode.textContent = body;
  const cancel = el('button', { type: 'button', text: 'Cancel' });
  const confirm = el('button', { type: 'button', className: 'delete-confirm' });
  confirm.textContent = confirmText;
  const dialog = el('dialog', { 'aria-labelledby': 'confirm-title' },
    titleNode,
    bodyNode,
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
    onConfirm();
  });
  // Inside the view, so a route change removes it with the screen.
  opener.parentElement.append(dialog);
  dialog.showModal();
  cancel.focus();
}
