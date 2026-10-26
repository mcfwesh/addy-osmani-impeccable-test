import { load, save, addHabit, updateHabit, deleteHabit, toggleDone, setWeekStartsOn, clearAll, emptyData } from './store.js';
import { todayDate } from './dates.js';
import { render as renderToday } from './views/today.js';
import { render as renderHabit } from './views/habit.js';
import { render as renderEdit } from './views/edit-habit.js';
import { render as renderNew } from './views/new-habit.js';
import { render as renderSettings } from './views/settings.js';
import { render as renderDataProblem } from './views/data-problem.js';
import { el } from './views/dom.js';

// Reading window.localStorage can itself throw (SecurityError) in some Safari
// and privacy settings. null makes load, save, and clearAll report a problem.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const loaded = load(getStorage());

const state = {
  loadStatus: loaded.status,
  data: loaded.data ?? emptyData(),
  // The exact stored text and the reason it was rejected. Only set for the two read-only statuses.
  raw: loaded.raw ?? null,
  loadError: loaded.error ?? null,
  saveFailed: false,
  todayDate: todayDate(new Date()),
};

// Read-only means stored data failed validation or is newer than this app.
// The app must not write in this mode. Only resetAllData leaves it.
function isReadOnly() {
  return state.loadStatus === 'data-problem' || state.loadStatus === 'newer-version';
}

// Exact routes and parameter routes ('#/habit/:id') in one list.
const routes = [
  { pattern: '#/', view: renderToday },
  { pattern: '#/new', view: renderNew },
  { pattern: '#/settings', view: renderSettings },
  { pattern: '#/habit/:id', view: renderHabit },
  { pattern: '#/habit/:id/edit', view: renderEdit },
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

// Shown above every screen while changes cannot be saved. It lives outside
// #app, so views do not know about it. It is only rebuilt when the message
// changes, so a screen reader does not announce it again on every render.
const BANNER_MESSAGES = {
  'save-failed': "The phone's storage may be full or blocked. Your latest change shows on screen but will be lost when you close the app. Export a backup in Settings if you can.",
  'storage-unavailable': 'This browser is not letting the app use storage. Private Browsing can cause this.',
};
let shownBanner = null;

function renderBanner() {
  let kind = null;
  if (state.loadStatus === 'storage-unavailable') kind = 'storage-unavailable';
  else if (state.saveFailed) kind = 'save-failed';
  if (kind === shownBanner) return;
  shownBanner = kind;
  const root = document.getElementById('banner');
  if (!kind) {
    root.replaceChildren();
    return;
  }
  root.replaceChildren(el('div', { className: 'banner', role: 'alert' },
    el('strong', { text: 'Your changes are not being saved.' }),
    el('p', { text: BANNER_MESSAGES[kind] }),
  ));
}

function renderRoute() {
  const root = document.getElementById('app');
  renderBanner();
  if (isReadOnly()) {
    renderDataProblem(root, state, actions);
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
  if (isReadOnly()) return;
  state.data = nextData;
  state.saveFailed = save(getStorage(), state.data) === 'failed';
}

function rerender() {
  renderRoute();
}

const actions = {
  navigate(hash) {
    window.location.hash = hash;
  },
  addHabit(input) {
    commit(addHabit(state.data, input, { id: crypto.randomUUID(), createdAt: new Date().toISOString() }));
    actions.navigate('#/');
  },
  updateHabit(habitId, input) {
    commit(updateHabit(state.data, habitId, input));
    actions.navigate(`#/habit/${encodeURIComponent(habitId)}`);
  },
  deleteHabit(habitId) {
    commit(deleteHabit(state.data, habitId));
    actions.navigate('#/');
  },
  setWeekStartsOn(weekStartsOn) {
    commit(setWeekStartsOn(state.data, weekStartsOn));
    rerender();
  },
  deleteAllData() {
    if (isReadOnly()) return;
    state.saveFailed = clearAll(getStorage()) === 'failed';
    state.data = emptyData();
    actions.navigate('#/');
  },
  // The only way out of read-only mode, and the only write allowed while in it.
  // The user asks for it on the data problem screen after a confirm step.
  resetAllData() {
    if (!isReadOnly()) return;
    state.saveFailed = clearAll(getStorage()) === 'failed';
    state.data = emptyData();
    state.loadStatus = 'empty';
    state.raw = null;
    state.loadError = null;
    // Setting the same hash fires no hashchange, so render directly in that case.
    if (window.location.hash === '#/') rerender();
    else actions.navigate('#/');
  },
  importData(data) {
    commit(data);
    actions.navigate('#/');
  },
  toggleDay(habitId, date) {
    commit(toggleDone(state.data, habitId, date, state.todayDate));
    rerender();
  },
  toggleToday(habitId) {
    actions.toggleDay(habitId, state.todayDate);
  },
};

window.addEventListener('hashchange', renderRoute);
if (!window.location.hash) {
  window.location.replace('#/');
} else {
  renderRoute();
}
