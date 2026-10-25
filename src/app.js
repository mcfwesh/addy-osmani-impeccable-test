import { render as renderToday } from './views/today.js';

const routes = {
  '#/': renderToday,
};

const state = {};
const actions = {};

function renderRoute() {
  const root = document.getElementById('app');
  const view = routes[window.location.hash];
  if (!view) {
    window.location.replace('#/');
    return;
  }
  view(root, state, actions);
}

window.addEventListener('hashchange', renderRoute);
if (!window.location.hash) {
  window.location.replace('#/');
} else {
  renderRoute();
}
