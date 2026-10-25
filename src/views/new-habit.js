import { renderForm } from './habit-form.js';

export function render(root, state, actions) {
  renderForm(root, {
    title: 'Add habit',
    onSubmit: (input) => actions.addHabit(input),
    onCancel: () => actions.navigate('#/'),
  });
}
