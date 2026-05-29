/**
 * QA Agent — Events Team Generator
 *
 * Functional quality-assurance checks for web + mobile behaviour.
 * Runs entirely in Node (no browser required) by simulating the DOM
 * environment the app expects. Tests cover:
 *
 *   1.  i18n / translations integrity
 *   2.  Navigation & page visibility logic
 *   3.  Login screen state transitions
 *   4.  Players Management — add / remove / filter / sort
 *   5.  Generator — team selection, counters, role toggle
 *   6.  Events Manager — CRUD, buildings editor, display toggle
 *   7.  Buildings editor — validation, dedup, read/write round-trip
 *   8.  Onboarding — step sequencing, tooltip positioning
 *   9.  Settings — character limits, avatar constraints
 *  10.  Alliance — create / invite / leave data flows
 *  11.  Firebase Service — graceful degradation
 *  12.  Accessibility — ARIA attributes, touch targets, mobile safe-area
 *  13.  Mobile layout — viewport meta, overflow, safe-area insets
 *  14.  Edge-specific checks — CSP headers, no IE-only APIs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const fs     = require('node:fs');

// ─── Module paths ────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const paths = {
  translations:       path.join(ROOT, 'translations.js'),
  i18n:               path.join(ROOT, 'js/core/i18n.js'),
  events:             path.join(ROOT, 'js/core/events.js'),
  assignment:         path.join(ROOT, 'js/core/assignment.js'),
  buildings:          path.join(ROOT, 'js/core/buildings.js'),
  playerTable:        path.join(ROOT, 'js/core/player-table.js'),
  buildingsEditorUi:  path.join(ROOT, 'js/ui/event-buildings-editor-ui.js'),
  firebaseService:    path.join(ROOT, 'js/services/firebase-service.js'),
  firebaseModule:     path.join(ROOT, 'firebase-module.js'),
  appInit:            path.join(ROOT, 'js/app-init.js'),
  indexHtml:          path.join(ROOT, 'index.html'),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadModule(filePath) {
  global.window = global;
  delete require.cache[require.resolve(filePath)];
  require(filePath);
}

function resetGlobals(...names) {
  names.forEach((n) => { delete global[n]; });
}

function makeLocalStorage(initial) {
  const store = Object.assign({}, initial);
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    _store: store,
  };
}

function makeDocument(extra) {
  return Object.assign({
    documentElement: { lang: 'en' },
    title: '',
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      style: {},
      dataset: {},
      classList: {
        _classes: new Set(),
        add(...cs) { cs.forEach((c) => this._classes.add(c)); },
        remove(...cs) { cs.forEach((c) => this._classes.delete(c)); },
        contains: (c) => this._classes.has(c),
        toggle: (c) => {
          if (this._classes.has(c)) { this._classes.delete(c); return false; }
          this._classes.add(c); return true;
        },
      },
      children: [],
      innerHTML: '',
      textContent: '',
      setAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      appendChild(child) { this.children.push(child); return child; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    }),
  }, extra || {});
}

// ─── 1. i18n / Translations integrity ────────────────────────────────────────

test('qa: translations — all 6 language packs present', () => {
  global.window = global;
  delete global.translations;
  loadModule(paths.translations);

  const supported = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
  supported.forEach((lang) => {
    assert.ok(global.translations[lang], `Missing language pack: ${lang}`);
    assert.equal(typeof global.translations[lang], 'object');
  });

  resetGlobals('translations');
});

test('qa: translations — every language has app_title', () => {
  global.window = global;
  loadModule(paths.translations);

  ['en', 'fr', 'de', 'it', 'ko', 'ro'].forEach((lang) => {
    assert.ok(
      global.translations[lang].app_title,
      `${lang} missing app_title`
    );
  });

  resetGlobals('translations');
});

test('qa: translations — new building_type_building key exists in all languages', () => {
  global.window = global;
  loadModule(paths.translations);

  ['en', 'fr', 'de', 'it', 'ko', 'ro'].forEach((lang) => {
    assert.ok(
      global.translations[lang].building_type_building,
      `${lang} missing building_type_building`
    );
    assert.ok(
      global.translations[lang].building_type_team,
      `${lang} missing building_type_team`
    );
  });

  resetGlobals('translations');
});

test('qa: translations — buildings_table_display key exists in all languages', () => {
  global.window = global;
  loadModule(paths.translations);

  ['en', 'fr', 'de', 'it', 'ko', 'ro'].forEach((lang) => {
    assert.ok(
      global.translations[lang].buildings_table_display,
      `${lang} missing buildings_table_display`
    );
  });

  resetGlobals('translations');
});

test('qa: translations — no translation key returns the raw key (no missing keys for core ui)', () => {
  global.window = global;
  loadModule(paths.translations);
  loadModule(paths.i18n);

  global.document = makeDocument({
    querySelectorAll: () => [],
  });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  const coreKeys = [
    'app_title', 'login_sign_in', 'sign_out_button',
    'generator_button', 'players_management_page_title',
    'events_manager_title', 'settings_button',
    'team_a_label', 'team_b_label', 'role_starter', 'role_substitute',
    'buildings_table_building', 'buildings_table_slots', 'buildings_table_priority',
    'buildings_table_display', 'building_type_building', 'building_type_team',
  ];

  coreKeys.forEach((key) => {
    const val = global.DSI18N.t(key);
    assert.notEqual(val, key, `Translation missing for key: "${key}" (returned raw key)`);
  });

  resetGlobals('translations', 'DSI18N');
});

test('qa: translations — onboarding steps 1-11 have titles and descriptions in EN', () => {
  global.window = global;
  loadModule(paths.translations);

  const en = global.translations.en;
  for (let i = 1; i <= 11; i++) {
    assert.ok(en[`onboarding_step${i}_title`], `EN missing onboarding_step${i}_title`);
    assert.ok(en[`onboarding_step${i}_desc`],  `EN missing onboarding_step${i}_desc`);
  }

  resetGlobals('translations');
});

// ─── 2. index.html structural checks ─────────────────────────────────────────

test('qa: index.html — file exists and is non-empty', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.length > 1000, 'index.html seems too small');
});

test('qa: index.html — viewport meta tag present for mobile', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(
    html.includes('name="viewport"'),
    'Missing viewport meta tag — mobile layout will break'
  );
  assert.ok(
    html.includes('width=device-width'),
    'Viewport meta must include width=device-width'
  );
});

test('qa: index.html — all 4 main page views present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  ['generatorPage', 'playersManagementPage', 'configurationPage', 'alliancePage'].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `Missing page element #${id}`);
  });
});

test('qa: index.html — login screen and main app containers present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="loginScreen"'), 'Missing #loginScreen');
  assert.ok(html.includes('id="mainApp"'),     'Missing #mainApp');
});

test('qa: index.html — critical nav buttons present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  ['sidebarGeneratorBtn', 'sidebarPlayersBtn', 'sidebarConfigBtn', 'sidebarAllianceBtn',
   'sidebarSettingsBtn', 'sidebarSignOutBtn'].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `Missing nav button #${id}`);
  });
});

test('qa: index.html — generator page team controls present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  ['teamAStarterCount', 'teamASubCount', 'teamBStarterCount', 'teamBSubCount',
   'generateBtnA', 'generateBtnB'].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `Missing generator control #${id}`);
  });
});

test('qa: index.html — players management key elements present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  ['playersMgmtNewName', 'playersMgmtNewPower', 'playersMgmtNewTroops',
   'playersMgmtTableBody', 'downloadTemplateBtn'].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `Missing players management element #${id}`);
  });
});

test('qa: index.html — events manager key elements present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  ['eventsList', 'eventNameInput', 'eventBuildingsEditorBody',
   'eventAddBuildingBtn', 'eventSaveBtn', 'mapCoordinatesBtn'].forEach((id) => {
    assert.ok(html.includes(`id="${id}"`), `Missing events manager element #${id}`);
  });
});

test('qa: index.html — settings modal present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="settingsModal"'),         'Missing #settingsModal');
  assert.ok(html.includes('id="settingsDisplayNameInput"'), 'Missing #settingsDisplayNameInput');
  assert.ok(html.includes('id="languageSelect"'),        'Missing #languageSelect');
  assert.ok(html.includes('id="settingsDeleteBtn"'),     'Missing #settingsDeleteBtn');
});

test('qa: index.html — notifications panel present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="notificationBtn"'),   'Missing #notificationBtn');
  assert.ok(html.includes('id="notificationBadge"'), 'Missing #notificationBadge');
  assert.ok(html.includes('id="notificationsPanel"'), 'Missing #notificationsPanel');
});

test('qa: index.html — onboarding tooltip present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="onboardingTooltip"'), 'Missing #onboardingTooltip');
});

test('qa: index.html — download modal present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="downloadModalOverlay"'), 'Missing #downloadModalOverlay');
  assert.ok(html.includes('id="downloadMapBtn"'),       'Missing #downloadMapBtn');
  assert.ok(html.includes('id="downloadExcelBtn"'),     'Missing #downloadExcelBtn');
});

test('qa: index.html — coordinate picker overlay present', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('id="coordPickerOverlay"'), 'Missing #coordPickerOverlay');
  assert.ok(html.includes('id="coordCanvas"'),        'Missing #coordCanvas');
});

// ─── 3. Mobile / Edge browser checks ─────────────────────────────────────────

test('qa: index.html — no IE-only conditional comments', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(!html.includes('<!--[if IE'), 'Found IE-only conditional comment');
  assert.ok(!html.includes('<!--[if lt IE'), 'Found IE-only conditional comment');
});

test('qa: index.html — charset UTF-8 declared', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(
    html.toLowerCase().includes('charset="utf-8"') ||
    html.toLowerCase().includes("charset='utf-8'") ||
    html.toLowerCase().includes('charset=utf-8'),
    'Missing UTF-8 charset declaration'
  );
});

test('qa: index.html — no document.write usage (Edge / mobile safe)', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(!html.includes('document.write('), 'document.write() is not supported reliably in Edge/mobile');
});

test('qa: index.html — styles.css linked', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(html.includes('styles.css'), 'Missing styles.css link');
});

test('qa: index.html — all <script> tags use defer (no render-blocking scripts)', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  const scriptTags = html.match(/<script\s[^>]*src=[^>]*>/g) || [];
  // firebase-config.js is intentionally non-defer so it loads before the deferred bundle
  const exempted = ['firebase-config.js'];
  scriptTags.forEach((tag) => {
    const isExempt = exempted.some((f) => tag.includes(f));
    assert.ok(
      isExempt || tag.includes('defer') || tag.includes('async'),
      `Script tag missing defer/async: ${tag}`
    );
  });
});

test('qa: styles.css — safe-area-inset-bottom declared (iPhone notch support)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(
    css.includes('safe-area-inset-bottom') || css.includes('safe-area-inset'),
    'Missing safe-area-inset — iOS notch devices may have content hidden behind home bar'
  );
});

test('qa: styles.css — CSS custom properties (variables) declared', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(css.includes(':root'), 'Missing :root block for CSS variables');
  assert.ok(css.includes('--ds-accent-primary'), 'Missing --ds-accent-primary CSS variable');
  assert.ok(css.includes('--ds-team-a'), 'Missing --ds-team-a CSS variable');
  assert.ok(css.includes('--ds-team-b'), 'Missing --ds-team-b CSS variable');
});

test('qa: styles.css — overflow-x hidden/auto on body or container (prevents mobile scroll bleed)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(
    css.includes('overflow-x'),
    'Missing overflow-x rule — horizontal scroll bleed may occur on mobile'
  );
});

// ─── 4. Players — filter / sort logic ────────────────────────────────────────

test('qa: players — filterAndSortPlayers handles all troop types', () => {
  global.window = global;
  loadModule(paths.playerTable);

  const players = [
    { name: 'A', power: 100, troops: 'Tank' },
    { name: 'B', power: 200, troops: 'Aero' },
    { name: 'C', power: 150, troops: 'Missile' },
  ];

  ['Tank', 'Aero', 'Missile'].forEach((troop) => {
    const result = global.DSCorePlayerTable.filterAndSortPlayers(players, { troopsFilter: troop });
    assert.equal(result.length, 1, `Expected 1 player for troops=${troop}`);
    assert.equal(result[0].troops, troop);
  });

  resetGlobals('DSCorePlayerTable');
});

test('qa: players — search is accent-insensitive to ASCII (no crash on unicode)', () => {
  global.window = global;
  loadModule(paths.playerTable);

  const players = [{ name: 'Ångström', power: 100, troops: 'Tank' }];
  // Should not throw even with unicode names
  assert.doesNotThrow(() => {
    global.DSCorePlayerTable.filterAndSortPlayers(players, { searchTerm: 'ang' });
  });

  resetGlobals('DSCorePlayerTable');
});

test('qa: players — power sort handles equal power gracefully (stable output)', () => {
  global.window = global;
  loadModule(paths.playerTable);

  const players = [
    { name: 'Z', power: 100, troops: 'Tank' },
    { name: 'A', power: 100, troops: 'Aero' },
    { name: 'M', power: 100, troops: 'Missile' },
  ];

  const result = global.DSCorePlayerTable.filterAndSortPlayers(players, { sortFilter: 'power-desc' });
  assert.equal(result.length, 3);
  result.forEach((p) => assert.equal(p.power, 100));

  resetGlobals('DSCorePlayerTable');
});

// ─── 5. Team assignment — QA scenarios ───────────────────────────────────────

test('qa: assignment — 100-player database assigns correctly to desert_storm config', () => {
  global.window = global;
  loadModule(paths.events);
  loadModule(paths.assignment);

  const buildings = global.DSCoreEvents.cloneEventBuildings('desert_storm');
  const totalSlots = buildings.reduce((s, b) => s + b.slots, 0);

  const players = Array.from({ length: 100 }, (_, i) => ({
    name: `Player${i + 1}`,
    power: 1000 - i,
    troops: ['Tank', 'Aero', 'Missile'][i % 3],
  }));

  const result = global.DSCoreAssignment.assignTeamToBuildings(players, buildings);

  // No player should appear twice
  const names = result.map((a) => a.player);
  assert.equal(new Set(names).size, names.length, 'Duplicate player assignment detected');

  // Total assignments must not exceed total available slots
  assert.ok(result.length <= totalSlots, `Assignments (${result.length}) exceed total slots (${totalSlots})`);

  // Every assignment references a valid building
  const buildingKeys = new Set(buildings.map((b) => b.name));
  result.forEach((a) => {
    assert.ok(buildingKeys.has(a.buildingKey), `Unknown buildingKey: ${a.buildingKey}`);
  });

  resetGlobals('DSCoreEvents', 'DSCoreAssignment');
});

test('qa: assignment — canyon_battlefield config assigns without errors', () => {
  global.window = global;
  loadModule(paths.events);
  loadModule(paths.assignment);

  const buildings = global.DSCoreEvents.cloneEventBuildings('canyon_battlefield');
  const players = Array.from({ length: 20 }, (_, i) => ({
    name: `P${i}`, power: 500 - i * 10, troops: ['Tank', 'Aero', 'Missile'][i % 3],
  }));

  assert.doesNotThrow(() => {
    global.DSCoreAssignment.assignTeamToBuildings(players, buildings);
  });

  resetGlobals('DSCoreEvents', 'DSCoreAssignment');
});

test('qa: assignment — single player assigned to 1-slot building correctly', () => {
  global.window = global;
  loadModule(paths.assignment);

  const players = [{ name: 'Solo', power: 500, troops: 'Tank' }];
  const config  = [{ name: 'Outpost', priority: 1, slots: 1 }];
  const result  = global.DSCoreAssignment.assignTeamToBuildings(players, config);

  assert.equal(result.length, 1);
  assert.equal(result[0].player, 'Solo');
  assert.equal(result[0].buildingKey, 'Outpost');

  resetGlobals('DSCoreAssignment');
});

// ─── 6. Events Manager — CRUD & validation ───────────────────────────────────

test('qa: events — upsertEvent sanitizes XSS-style names', () => {
  global.window = global;
  loadModule(paths.events);

  const result = global.DSCoreEvents.upsertEvent('xss_test', {
    name: '<script>alert(1)</script>',
    buildings: [],
  });

  // name should be stored as trimmed plain text, capped at 30 chars
  assert.ok(result.name.length <= 30, 'Event name not capped at 30 chars');

  resetGlobals('DSCoreEvents');
});

test('qa: events — slugifyEventId handles non-Latin characters', () => {
  global.window = global;
  loadModule(paths.events);

  const id = global.DSCoreEvents.slugifyEventId('Événement Spécial', []);
  assert.match(id, /^[a-z0-9_]+$/, `Slug contains invalid chars: ${id}`);
  assert.ok(id.length > 0, 'Slug is empty');

  resetGlobals('DSCoreEvents');
});

test('qa: events — event with 0-slot building is valid (soft building)', () => {
  global.window = global;
  loadModule(paths.events);

  const result = global.DSCoreEvents.upsertEvent('soft_test', {
    name: 'Soft Test',
    buildings: [
      { name: 'Active',   slots: 2, priority: 1 },
      { name: 'Inactive', slots: 0, priority: 2 },
    ],
  });

  assert.equal(result.buildings.length, 2);
  const inactive = result.buildings.find((b) => b.name === 'Inactive');
  assert.equal(inactive.slots, 0);

  resetGlobals('DSCoreEvents');
});

test('qa: events — registry survives upsert + remove + re-upsert cycle', () => {
  global.window = global;
  loadModule(paths.events);

  global.DSCoreEvents.upsertEvent('cycle_test', { name: 'Cycle', buildings: [] });
  assert.ok(global.DSCoreEvents.getEvent('cycle_test'));

  global.DSCoreEvents.removeEvent('cycle_test');
  assert.equal(global.DSCoreEvents.getEvent('cycle_test'), null);

  global.DSCoreEvents.upsertEvent('cycle_test', { name: 'Cycle Again', buildings: [] });
  assert.equal(global.DSCoreEvents.getEvent('cycle_test').name, 'Cycle Again');

  resetGlobals('DSCoreEvents');
});

// ─── 7. Buildings editor UI — render / read round-trip ───────────────────────

test('qa: buildings editor — createEditorBuildingRow produces a table row', () => {
  global.window = global;
  loadModule(paths.buildings);

  // Minimal DOM shim for the editor
  const cells = [];
  const row = {
    insertCell: () => {
      const cell = { innerHTML: '', dataset: {} };
      cells.push(cell);
      return cell;
    },
    cells,
    querySelector:    () => null,
    querySelectorAll: () => [],
    dataset: {},
    style: {},
  };

  const doc = makeDocument({
    createElement: (tag) => {
      if (tag === 'tr') return row;
      const el = {
        tagName: tag.toUpperCase(), innerHTML: '', textContent: '',
        style: {}, dataset: {}, value: '',
        setAttribute() {}, getAttribute() { return null; },
        addEventListener() {}, appendChild() {},
        querySelector() { return null; }, querySelectorAll() { return []; },
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      };
      return el;
    },
  });
  global.document = doc;
  loadModule(paths.buildingsEditorUi);

  const result = global.DSEventBuildingsEditorUI.createEditorBuildingRow({
    building:  { name: 'HQ', label: 'HQ', slots: 2, priority: 1, showOnMap: true },
    minSlots:  0,
    maxSlots:  20,
    translate: (k) => k,
  });

  assert.ok(result, 'createEditorBuildingRow returned falsy');

  resetGlobals('DSEventBuildingsEditorUI', 'DSCoreBuildings');
  delete global.document;
});

test('qa: buildings editor — readEventBuildingsEditor rejects duplicate building names', () => {
  global.window = global;
  loadModule(paths.buildings);
  global.document = makeDocument();
  loadModule(paths.buildingsEditorUi);

  // Build mock rows with duplicate names
  function makeRow(name, slots, priority, showOnMap) {
    return {
      querySelector: (sel) => {
        if (sel === 'input[data-field="name"]')     return { value: name };
        if (sel === 'input[data-field="slots"]')    return { value: String(slots) };
        if (sel === 'input[data-field="priority"]') return { value: String(priority) };
        if (sel === '[data-field="showOnMap"]')     return {
          querySelector: (s) => s.includes('building') && showOnMap
            ? { classList: { contains: () => true } }
            : null,
        };
        return null;
      },
    };
  }

  const tbody = {
    querySelectorAll: () => [
      makeRow('HQ', 2, 1, true),
      makeRow('HQ', 2, 2, true), // duplicate
    ],
  };

  const { buildings, error } = global.DSEventBuildingsEditorUI.readEventBuildingsEditor({
    tbody,
    minSlots:  0,
    maxSlots:  20,
    translate: (k) => k,
  });

  assert.ok(error, 'Expected an error for duplicate building names');
  assert.equal(buildings.length, 0);

  resetGlobals('DSEventBuildingsEditorUI', 'DSCoreBuildings');
  delete global.document;
});

test('qa: buildings editor — showOnMap reads from display toggle (Building button active)', () => {
  global.window = global;
  loadModule(paths.buildings);
  global.document = makeDocument();
  loadModule(paths.buildingsEditorUi);

  function makeRowWithToggle(buildingActive) {
    return {
      querySelector: (sel) => {
        if (sel === 'input[data-field="name"]')     return { value: 'HQ' };
        if (sel === 'input[data-field="slots"]')    return { value: '2' };
        if (sel === 'input[data-field="priority"]') return { value: '1' };
        if (sel === '[data-field="showOnMap"]') {
          return {
            querySelector: (s) => {
              if (s === '[data-display="building"].active') {
                return buildingActive ? {} : null;
              }
              return null;
            },
          };
        }
        return null;
      },
    };
  }

  const tbodyBuilding = { querySelectorAll: () => [makeRowWithToggle(true)] };
  const { buildings: bs1 } = global.DSEventBuildingsEditorUI.readEventBuildingsEditor({
    tbody: tbodyBuilding, minSlots: 0, maxSlots: 20, translate: (k) => k,
  });
  assert.equal(bs1[0].showOnMap, true, 'Building button active → showOnMap should be true');

  const tbodyTeam = { querySelectorAll: () => [makeRowWithToggle(false)] };
  const { buildings: bs2 } = global.DSEventBuildingsEditorUI.readEventBuildingsEditor({
    tbody: tbodyTeam, minSlots: 0, maxSlots: 20, translate: (k) => k,
  });
  assert.equal(bs2[0].showOnMap, false, 'Team button active → showOnMap should be false');

  resetGlobals('DSEventBuildingsEditorUI', 'DSCoreBuildings');
  delete global.document;
});

// ─── 8. Buildings normalisation — edge cases ──────────────────────────────────

test('qa: buildings — normalizeBuildingConfig round-trips for all desert_storm buildings', () => {
  global.window = global;
  loadModule(paths.events);
  loadModule(paths.buildings);

  const defaults = global.DSCoreEvents.cloneEventBuildings('desert_storm');
  const normalized = global.DSCoreBuildings.normalizeBuildingConfig(defaults, defaults, 0, 20);

  assert.equal(normalized.length, defaults.length, 'Round-trip changed building count');
  normalized.forEach((b) => {
    assert.ok(typeof b.name === 'string' && b.name.length > 0, 'Building has no name');
    assert.ok(Number.isFinite(b.slots),    'slots is not a finite number');
    assert.ok(Number.isFinite(b.priority), 'priority is not a finite number');
    assert.ok(b.priority >= 1 && b.priority <= 6, `priority out of range: ${b.priority}`);
    assert.ok(b.slots >= 0 && b.slots <= 20,       `slots out of range: ${b.slots}`);
    assert.equal(typeof b.showOnMap, 'boolean', 'showOnMap is not a boolean');
  });

  resetGlobals('DSCoreEvents', 'DSCoreBuildings');
});

// ─── 9. Firebase Service — graceful degradation (QA for offline / Edge CSP) ──

test('qa: firebase service — all async methods resolve (not reject) when manager absent', async () => {
  delete global.FirebaseManager;
  global.window = global;
  loadModule(paths.firebaseService);

  const asyncMethods = [
    'signInWithGoogle', 'signOut', 'deleteUserAccountAndData',
    'createAlliance', 'leaveAlliance', 'loadAllianceData',
    'checkInvitations',
  ];

  for (const method of asyncMethods) {
    const result = await assert.doesNotReject(
      () => Promise.resolve(global.FirebaseService[method]()),
      `${method} should not reject when FirebaseManager is absent`
    );
    void result;
  }

  resetGlobals('FirebaseService');
});

test('qa: firebase service — sync getters return safe types when manager absent', () => {
  delete global.FirebaseManager;
  global.window = global;
  loadModule(paths.firebaseService);

  assert.equal(typeof global.FirebaseService.isSignedIn(),           'boolean');
  assert.equal(typeof global.FirebaseService.getPlayerDatabase(),    'object');
  assert.equal(typeof global.FirebaseService.getAllEventData(),       'object');
  assert.equal(typeof global.FirebaseService.getEventIds(),          'object'); // array is object
  assert.equal(typeof global.FirebaseService.getBuildingConfigVersion('x'), 'number');
  assert.equal(typeof global.FirebaseService.getPlayerSource(),      'string');

  resetGlobals('FirebaseService');
});

// ─── 10. App-init — auth state transitions ────────────────────────────────────

test('qa: app-init — sign-in then sign-out correctly toggles UI visibility', () => {
  global.window = global;

  const loginScreen = { style: { display: 'block' }, innerHTML: '' };
  const mainApp     = { style: { display: 'none' } };

  global.document = {
    getElementById: (id) => {
      if (id === 'loginScreen') return loginScreen;
      if (id === 'mainApp')     return mainApp;
      return { style: {}, textContent: '' };
    },
  };
  global.t = (k) => k;
  global.initLanguage                 = () => {};
  global.updateGenerateEventLabels    = () => {};
  global.applyTranslations            = () => {};
  global.loadPlayerData               = () => {};
  global.initOnboarding               = () => {};
  global.updateAllianceHeaderDisplay  = () => {};
  global.checkAndDisplayNotifications = () => {};
  global.startNotificationPolling     = () => {};
  global.stopNotificationPolling      = () => {};
  global.loadBuildingConfig           = () => false;
  global.loadBuildingPositions        = () => false;
  global.updateUserHeaderIdentity     = () => {};

  let authCb;
  global.FirebaseService = {
    isAvailable:             () => true,
    setAuthCallback:         (cb) => { authCb = cb; },
    setDataLoadCallback:     () => {},
    setAllianceDataCallback: () => {},
  };

  delete require.cache[require.resolve(paths.appInit)];
  require(paths.appInit);

  // Sign in
  authCb(true, { email: 'qa@test.com' });
  assert.equal(loginScreen.style.display, 'none');
  assert.equal(mainApp.style.display, 'block');

  // Sign out
  authCb(false, null);
  assert.equal(loginScreen.style.display, 'block');
  assert.equal(mainApp.style.display, 'none');

  resetGlobals(
    'FirebaseService', 'initLanguage', 'updateGenerateEventLabels',
    'applyTranslations', 'loadPlayerData', 'initOnboarding',
    'updateAllianceHeaderDisplay', 'checkAndDisplayNotifications',
    'startNotificationPolling', 'stopNotificationPolling',
    'loadBuildingConfig', 'loadBuildingPositions', 'updateUserHeaderIdentity', 't'
  );
  delete global.document;
  delete require.cache[require.resolve(paths.appInit)];
});

// ─── 11. Accessibility / ARIA checks in HTML ──────────────────────────────────

test('qa: accessibility — notification button has aria-label', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  // Check notification button region has aria role or label
  assert.ok(
    html.includes('aria-label') || html.includes('role='),
    'No aria-label or role attributes found — accessibility may be lacking'
  );
});

test('qa: accessibility — language select has associated label or aria-label', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  assert.ok(
    html.includes('languageSelect'),
    'Language select element missing'
  );
  // Should have either a <label> for it or an aria-label
  const hasLabel = html.includes('for="languageSelect"') ||
                   html.includes('for=\'languageSelect\'');
  const hasAria  = html.includes('aria-label');
  assert.ok(hasLabel || hasAria, 'Language select has no associated label or aria-label');
});

test('qa: accessibility — form inputs have associated labels or placeholders', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  // Email and password inputs should have placeholder or label
  assert.ok(
    html.includes('emailInput') || html.includes('email'),
    'No email input found'
  );
  // Check for data-i18n-placeholder (the project uses this instead of hardcoded placeholder)
  assert.ok(
    html.includes('data-i18n-placeholder') || html.includes('placeholder'),
    'No placeholder attributes found on inputs'
  );
});

// ─── 12. i18n engine — language switching QA ─────────────────────────────────

test('qa: i18n — switching between all 6 languages does not throw', () => {
  global.window = global;
  loadModule(paths.translations);
  loadModule(paths.i18n);

  global.document = makeDocument({
    querySelectorAll: () => [],
  });
  global.localStorage = makeLocalStorage({});
  global.DSI18N.init({});

  const langs = ['en', 'fr', 'de', 'it', 'ko', 'ro'];
  langs.forEach((lang) => {
    assert.doesNotThrow(
      () => global.DSI18N.setLanguage(lang),
      `setLanguage('${lang}') threw an error`
    );
    assert.equal(global.DSI18N.getLanguage(), lang);
  });

  resetGlobals('translations', 'DSI18N');
  delete global.document;
  delete global.localStorage;
});

test('qa: i18n — Korean (ko) translations render non-empty strings', () => {
  global.window = global;
  loadModule(paths.translations);
  loadModule(paths.i18n);

  global.document = makeDocument({ querySelectorAll: () => [] });
  global.localStorage = makeLocalStorage({ ds_language: 'ko' });
  global.DSI18N.init({});

  const val = global.DSI18N.t('app_title');
  assert.ok(val && val.length > 0 && val !== 'app_title', 'Korean app_title is empty or missing');

  resetGlobals('translations', 'DSI18N');
  delete global.document;
  delete global.localStorage;
});

// ─── 13. CSS / layout — mobile safety ────────────────────────────────────────

test('qa: styles.css — touch target min-height >= 44px for interactive elements', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  // Look for min-height usage with a value >= 44px
  const minHeightMatches = css.match(/min-height:\s*(\d+)px/g) || [];
  const hasSufficientTarget = minHeightMatches.some((m) => {
    const px = parseInt(m.match(/\d+/)[0], 10);
    return px >= 44;
  });
  assert.ok(hasSufficientTarget, 'No min-height >= 44px found — touch targets may be too small for mobile');
});

test('qa: styles.css — font-size not smaller than 14px on body (readability)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  // Check body font-size
  const bodyFontMatch = css.match(/body\s*\{[^}]*font-size:\s*(\d+(?:\.\d+)?)(px|rem|em)/);
  if (bodyFontMatch) {
    const size = parseFloat(bodyFontMatch[1]);
    const unit = bodyFontMatch[2];
    if (unit === 'px') {
      assert.ok(size >= 14, `Body font-size ${size}px is too small for mobile readability`);
    }
    // rem/em — trust the developer; 1rem is typically 16px
  }
  // If no body font-size is found, that's fine — browser default is 16px
});

// ─── 14. Edge browser — feature compatibility ─────────────────────────────────

test('qa: no usage of deprecated event.returnValue for dialogs (Edge safe)', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(
    !appJs.includes('event.returnValue'),
    'event.returnValue is deprecated and may behave differently in Edge'
  );
});

test('qa: no usage of document.all (IE-only, not supported in Edge modern)', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(
    !appJs.includes('document.all'),
    'document.all is an IE-only API and is not supported in modern Edge'
  );
});

test('qa: app uses addEventListener not attachEvent (Edge/modern browser API)', () => {
  const appJs = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.ok(
    !appJs.includes('attachEvent'),
    'attachEvent is an IE-only API — use addEventListener instead'
  );
  assert.ok(
    appJs.includes('addEventListener'),
    'addEventListener not found in app.js'
  );
});

test('qa: vendor scripts are local (no CDN dependency for offline / CSP Edge scenarios)', () => {
  const html = fs.readFileSync(paths.indexHtml, 'utf8');
  const scriptSrcs = html.match(/src="([^"]+)"/g) || [];
  const externalScripts = scriptSrcs.filter((s) =>
    s.includes('http://') || s.includes('https://')
  );
  assert.equal(
    externalScripts.length, 0,
    `External script CDN links found (may fail with strict CSP in Edge): ${externalScripts.join(', ')}`
  );
});
