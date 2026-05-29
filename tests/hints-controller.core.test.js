const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modulePath = path.resolve(__dirname, '../js/shell/hints-controller.js');

function makeStorage() {
    const store = {};
    return {
        getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
        setItem(key, value) { store[key] = String(value); },
        removeItem(key) { delete store[key]; },
    };
}

function loadModule(localStorage, sessionStorage) {
    delete require.cache[require.resolve(modulePath)];
    delete global.DSHintsController;
    global.window = global;
    global.localStorage = localStorage;
    global.sessionStorage = sessionStorage;
    require(modulePath);
}

test('selectNextHint returns the first unviewed hint', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    loadModule(ls, ss);

    const { HINTS, selectNextHint } = global.DSHintsController;
    const result = selectNextHint(HINTS, []);
    assert.equal(result.id, 'mass-invite');
});

test('selectNextHint skips already-viewed hints', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    loadModule(ls, ss);

    const { HINTS, selectNextHint } = global.DSHintsController;
    const result = selectNextHint(HINTS, ['mass-invite']);
    assert.equal(result.id, 'team-colors');
});

test('selectNextHint returns null when all hints have been viewed', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    loadModule(ls, ss);

    const { HINTS, selectNextHint } = global.DSHintsController;
    const allIds = HINTS.map(function (h) { return h.id; });
    const result = selectNextHint(HINTS, allIds);
    assert.equal(result, null);
});

test('shouldShowHints returns false when hints already shown this session', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    ls.setItem('ds_onboarding_done', '1');
    ss.setItem('ds_hints_shown_this_session', 'true');
    loadModule(ls, ss);

    const { shouldShowHints } = global.DSHintsController;
    assert.equal(shouldShowHints(true), false);
});

test('shouldShowHints returns true when onboarding complete and not yet shown this session', () => {
    const ls = makeStorage();
    const ss = makeStorage();
    loadModule(ls, ss);

    const { shouldShowHints } = global.DSHintsController;
    assert.equal(shouldShowHints(true), true);
});
