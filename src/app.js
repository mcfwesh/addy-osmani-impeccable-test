import { load, save, addHabit, emptyData } from './store.js';
import { todayDate } from './dates.js';
import { render as renderToday } from './views/today.js';
import { render as renderNew } from './views/new-habit.js';
import { render as renderStorageProblem } from './views/storage-problem.js';

const loaded = load(window.localStorage);
const readOnly = loaded.status === 'data-problem' || loaded.status === 'newer-version';

const state = {
  loadStatus: loaded.status,
  data: loaded.data ?? emptyData(),
  saveFailed: false,
  todayDate: todayDate(new Date()),
};

// Exact routes and parameter routes ('#/habit/:id') in one list.
const routes = [
  { pattern: '#/', view: renderToday },
  { pattern: '#/new', view: renderNew },
];

function matchRoute(hash) {
  for (const route of routes) {
    const names = [];
    const source = route.pattern.replace(/:(\w+)/g, (_, name) => { names.push(name); return '([^/]+)'; });
    const match = new RegExp(`^${source}$`).exec(hash);
    if (match) {
      const params = Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])]));
      return { view: route.view, params };
    }
  }
  return null;
}

function renderRoute() {
  const root = document.getElementById('app');
  if (readOnly) {
    renderStorageProblem(root, state);
    return;
  }
  const route = matchRoute(window.location.hash);
  if (!route) {
    window.location.replace('#/');
    return;
  }
  route.view(root, state, actions, route.params);
}

// Apply a pure store change, save it, and remember whether saving failed.
function commit(nextData) {
  if (readOnly) return;
  state.data = nextData;
  state.saveFailed = save(window.localStorage, state.data) === 'failed';
}

const actions = {
  navigate(hash) {
    window.location.hash = hash;
  },
  addHabit(input) {
    commit(addHabit(state.data, input, { id: crypto.randomUUID(), createdAt: new Date().toISOString() }));
    actions.navigate('#/');
  },
};

window.addEventListener('hashchange', renderRoute);
if (!window.location.hash) {
  window.location.replace('#/');
} else {
  renderRoute();
}
