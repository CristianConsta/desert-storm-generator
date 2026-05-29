const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const firebaseInfraPath = path.resolve(__dirname, '../firebase-infra.js');
const firebaseAuthModulePath = path.resolve(__dirname, '../firebase-auth-module.js');
const firebaseModulePath = path.resolve(__dirname, '../firebase-module.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';

function setupGlobals() {
  global.window = global;
  global.addEventListener = () => {};
  global.alert = () => {};
  global.document = { addEventListener() {} };
  global.FIREBASE_CONFIG = {
    apiKey: 'x', authDomain: 'x', projectId: 'x',
    storageBucket: 'x', messagingSenderId: 'x', appId: 'x',
  };
  global.DSCoreGames = {
    getCatalogGames: () => [
      { id: 'last_war', name: 'Last War', logo: '', company: '' },
    ],
    normalizeGameId: (id) => (id === 'last_war' ? 'last_war' : null),
  };
}

function teardown() {
  delete global.FirebaseManager;
  delete global.DSFirebaseInfra;
  delete global.DSFirebaseAuth;
  delete global.firebase;
  delete global.DSCoreGames;
  delete global.FIREBASE_CONFIG;
  delete global.addEventListener;
  delete global.alert;
  delete global.document;
  delete require.cache[require.resolve(firebaseInfraPath)];
  delete require.cache[require.resolve(firebaseAuthModulePath)];
  delete require.cache[require.resolve(firebaseModulePath)];
}

function makeFirebaseMock(authUid) {
  let authStateChanged;
  const setCalls = [];
  const authMock = {
    onAuthStateChanged: (cb) => { authStateChanged = cb; },
    signInWithPopup: async () => {},
    signOut: async () => {},
    currentUser: null,
  };
  const docMock = () => ({
    get: async () => ({ exists: false, data: () => null }),
    set: async (data, opts) => { setCalls.push({ data, opts }); },
    onSnapshot: () => () => {},
  });
  const collMock = () => ({
    doc: docMock,
    get: async () => ({ docs: [] }),
    onSnapshot: () => () => {},
    where: () => ({ get: async () => ({ docs: [] }) }),
  });
  const firestoreFn = () => ({
    collection: collMock,
    doc: docMock,
  });
  firestoreFn.FieldValue = {
    serverTimestamp: () => 'TS',
    delete: () => 'DEL',
    arrayUnion: (...v) => v,
    arrayRemove: (...v) => v,
  };
  firestoreFn.Timestamp = { now: () => ({ toDate: () => new Date() }) };
  const initializeApp = () => {};
  global.firebase = {
    initializeApp,
    auth: () => authMock,
    firestore: firestoreFn,
  };
  global.firebase.auth.GoogleAuthProvider = function GoogleAuthProvider() {};

  return {
    async init(uid) {
      delete require.cache[require.resolve(firebaseModulePath)];
      require(firebaseInfraPath);
      require(firebaseAuthModulePath);
      require(firebaseModulePath);
      assert.equal(global.FirebaseManager.init(), true);
      await authStateChanged({
        uid: uid || authUid,
        email: 'test@example.com',
        emailVerified: true,
        providerData: [{ providerId: 'password' }],
      });
    },
    setCalls,
  };
}

// ── setGameMetadata rejects non-admin callers ────────────────────────────────

test('setGameMetadata rejects non-admin callers with forbidden error', async (t) => {
  setupGlobals();
  t.after(teardown);

  const mock = makeFirebaseMock('regular-user-uid');
  await mock.init();

  const result = await global.FirebaseManager.setGameMetadata('last_war', {
    name: 'Test', logo: '', company: 'Test Co',
  });

  assert.equal(result.success, false);
  assert.equal(result.errorKey, 'game_metadata_forbidden');
});

test('setGameMetadata succeeds for super-admin caller', async (t) => {
  setupGlobals();
  t.after(teardown);

  const mock = makeFirebaseMock(SUPER_ADMIN_UID);
  await mock.init();

  const result = await global.FirebaseManager.setGameMetadata('last_war', {
    name: 'Last War Edited', logo: 'data:image/png;base64,AA', company: 'Dev',
  });

  assert.equal(result.success, true);
  assert.equal(result.game.id, 'last_war');
});

// ── #navGameMetadataBtn menu visibility ──────────────────────────────────────
// The button uses the `hidden` class in index.html by default.
// syncGameMetadataMenuAvailability in app.js toggles it based on super-admin check.
// Since app.js relies on DOM + many globals, we test the logic extracted:
// isGameMetadataSuperAdmin must return false for non-admin → button stays hidden.

test('sidebarGameMetadataBtn defaults to hidden class in index.html', async () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(
    path.resolve(__dirname, '../index.html'), 'utf8'
  );
  const match = html.match(/<button\s+id="sidebarGameMetadataBtn"[^>]*>/);
  assert.ok(match, 'sidebarGameMetadataBtn button should exist in index.html');
  assert.ok(
    match[0].includes('hidden'),
    'sidebarGameMetadataBtn should have hidden class by default'
  );
});

test('isGameMetadataSuperAdmin returns false for non-admin uid via FirebaseManager', async (t) => {
  setupGlobals();
  t.after(teardown);

  const mock = makeFirebaseMock('non-admin-uid');
  await mock.init();

  // FirebaseManager.isGameMetadataSuperAdmin checks current user or uid string
  assert.equal(global.FirebaseManager.isGameMetadataSuperAdmin('non-admin-uid'), false);
  assert.equal(global.FirebaseManager.isGameMetadataSuperAdmin({ uid: 'non-admin-uid' }), false);
});

test('isGameMetadataSuperAdmin returns true for super-admin uid via FirebaseManager', async (t) => {
  setupGlobals();
  t.after(teardown);

  const mock = makeFirebaseMock(SUPER_ADMIN_UID);
  await mock.init();

  assert.equal(global.FirebaseManager.isGameMetadataSuperAdmin(SUPER_ADMIN_UID), true);
  assert.equal(global.FirebaseManager.isGameMetadataSuperAdmin({ uid: SUPER_ADMIN_UID }), true);
});
