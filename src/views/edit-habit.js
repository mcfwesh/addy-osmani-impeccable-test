import { renderForm } from './habit-form.js';

export function render(root, state, actions, params) {
  const habit = state.data.habits.find((h) => h.id === params.id);
  if (!habit) {
    window.location.replace('#/');
    return;
  }
  const detail = `#/habit/${encodeURIComponent(habit.id)}`;
  renderForm(root, {
    habit,
    title: 'Edit habit',
    onSubmit: (input) => actions.updateHabit(habit.id, input),
    onCancel: () => actions.navigate(detail),
  });
}
