const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const appInitPath = path.resolve(__dirname, '../js/app-init.js');
const modalControllerPath = path.resolve(__dirname, '../js/shell/overlays/modal-controller.js');

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function makeClassList(initial) {
  const set = new Set(initial || []);
  return {
    add(c) { set.add(c); },
    remove(c) { set.delete(c); },
    contains(c) { return set.has(c); },
  };
}

function makeEl(initialClasses) {
  return {
    classList: makeClassList(initialClasses),
    attributes: {},
    style: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    getAttribute(key) { return this.attributes[key]; },
  };
}

function makeStorage(seed) {
  const store = Object.assign({}, seed);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
  };
}

test.afterEach(() => {
  resetModule(appInitPath);
  resetModule(modalControllerPath);
  delete global.window;
  delete global.document;
  delete global.localStorage;
  delete global.sessionStorage;
  delete global.FirebaseService;
  delete global.DSHintsController;
  delete global.DSShellModalController;
  delete global.DSI18N;
  delete global.initLanguage;
  delete global.updateGenerateEventLabels;
  delete global.applyTranslations;
  delete global.loadPlayerData;
  delete global.initOnboarding;
  delete global.updateAllianceHeaderDisplay;
  delete global.checkAndDisplayNotifications;
  delete global.startNotificationPolling;
  delete global.stopNotificationPolling;
  delete global.loadBuildingConfig;
  delete global.loadBuildingPositions;
  delete global.updateUserHeaderIdentity;
  delete global.handleAllianceDataRealtimeUpdate;
  delete global.t;
});

// Regression for the post-login hints modal not appearing: app-init.js passed
// the selector STRING '#hintsModal' to DSShellModalController.open(), which
// requires a DOM element (it reads overlay.classList). The guard rejected the
// string, the 'hidden' class was never removed, and the modal stayed invisible.
test('post-login hints flow reveals the hints modal (removes hidden class)', () => {
  global.window = global;

  const loginScreen = { style: { display: 'block' } };
  const mainApp = { style: { display: 'none' } };
  const hintsModal = makeEl(['coord-overlay', 'hidden']);
  const hintTitleEl = makeEl([]);
  const hintDescEl = makeEl([]);

  global.document = {
    getElementById(id) {
      if (id === 'loginScreen') return loginScreen;
      if (id === 'mainApp') return mainApp;
      if (id === 'hintsModal') return hintsModal;
      if (id === 'hintTitleEl') return hintTitleEl;
      if (id === 'hintDescEl') return hintDescEl;
      return { style: {} };
    },
  };

  global.localStorage = makeStorage({ ds_onboarding_done: '1' });
  global.sessionStorage = makeStorage({});

  // Load the REAL modal controller so we exercise its actual element contract.
  require(modalControllerPath);

  const hint = { id: 'mass-invite', messageKey: 'hint_mass_invite_title', descriptionKey: 'hint_mass_invite_description' };
  let markedViewed = null;
  global.DSHintsController = {
    HINTS: [hint],
    shouldShowHints: () => true,
    selectNextHint: () => hint,
    getViewedHints: () => [],
    markHintAsViewed: (id) => { markedViewed = id; },
    markHintsShownThisSession: () => {},
  };

  let applyTranslationsCalls = 0;
  global.initLanguage = () => {};
  global.updateGenerateEventLabels = () => {};
  global.applyTranslations = () => { applyTranslationsCalls += 1; };
  global.initOnboarding = () => {};
  global.startNotificationPolling = () => {};
  global.stopNotificationPolling = () => {};
  global.loadPlayerData = () => {};
  global.loadBuildingConfig = () => false;
  global.loadBuildingPositions = () => false;
  global.updateUserHeaderIdentity = () => {};
  global.updateAllianceHeaderDisplay = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.handleAllianceDataRealtimeUpdate = () => {};
  global.t = (key) => key;

  let authCallback = null;
  global.FirebaseService = {
    isAvailable: () => true,
    setAuthCallback: (callback) => { authCallback = callback; },
    setDataLoadCallback: () => {},
    setAllianceDataCallback: () => {},
    saveUserData: () => {},
  };

  // Run the deferred showHintsAfterLogin synchronously.
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn) => { fn(); return 1; };

  try {
    require(appInitPath);
    assert.equal(typeof authCallback, 'function');
    authCallback(true, { email: 'user@example.com' });
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  // The modal must be revealed.
  assert.equal(hintsModal.classList.contains('hidden'), false, 'hints modal should no longer be hidden after login');
  // And the selected hint must have been wired into the modal.
  assert.equal(hintTitleEl.getAttribute('data-i18n'), 'hint_mass_invite_title');
  assert.equal(hintDescEl.getAttribute('data-i18n'), 'hint_mass_invite_description');
  assert.equal(markedViewed, 'mass-invite');
  assert.ok(applyTranslationsCalls >= 1);
});
