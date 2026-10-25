export function render(root, state, actions) {
  const heading = document.createElement('h1');
  heading.textContent = 'Today';
  root.replaceChildren(heading);
}
