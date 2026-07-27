const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { stubNormalizeGameId } = require('./helpers/normalize-stubs.js');

const modulePath = path.resolve(__dirname, '../js/services/firebase-service.js');
const coreGamesPath = path.resolve(__dirname, '../js/core/games.js');
const coreEventsPath = path.resolve(__dirname, '../js/core/events.js');

function loadModule() {
  global.window = global;
  delete global.FirebaseService;
  // Only load the real core modules when a test hasn't already installed its
  // own DSCoreGames/DSCoreEvents stub (several tests below intentionally
  // provide a minimal fallback-catalog stub and must not have it clobbered).
  if (!global.DSCoreGames) {
    delete require.cache[require.resolve(coreGamesPath)];
    require(coreGamesPath);
  }
  if (!global.DSCoreEvents) {
    delete require.cache[require.resolve(coreEventsPath)];
    require(coreEventsPath);
  }
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
}

function makeLocalStorage(seed) {
  const store = { ...(seed || {}) };
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    dump: () => ({ ...store }),
  };
}

test.afterEach(() => {
  delete global.FirebaseManager;
  delete global.FirebaseService;
  delete global.DSCoreGames;
  delete global.DSCoreEvents;
  delete global.localStorage;
  delete require.cache[require.resolve(modulePath)];
});

// ── Fallbacks when FirebaseManager is absent ─────────────────────────────────

test('isAvailable returns false when FirebaseManager is missing', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), false);
});

test('auth fallbacks return not-loaded result', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.signInWithGoogle(), notLoaded);
  assert.deepEqual(await global.FirebaseService.signInWithEmail('a@b.com', 'pw'), notLoaded);
  assert.deepEqual(await global.FirebaseService.signUpWithEmail('a@b.com', 'pw'), notLoaded);
  assert.deepEqual(await global.FirebaseService.resetPassword('a@b.com'), notLoaded);
  assert.deepEqual(await global.FirebaseService.signOut(), notLoaded);
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), notLoaded);
  assert.equal(global.FirebaseService.isSignedIn(), false);
});

test('player data fallbacks return safe empty values', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.deepEqual(global.FirebaseService.getPlayerDatabase(), {});
  assert.deepEqual(global.FirebaseService.getAlliancePlayerDatabase(), {});
  assert.deepEqual(global.FirebaseService.getActivePlayerDatabase(), {});
  assert.equal(global.FirebaseService.getPlayerSource(), 'personal');
});

test('player mutation fallbacks return not-loaded result', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.upsertPlayerEntry('personal', 'Alice', {}), notLoaded);
  assert.deepEqual(await global.FirebaseService.removePlayerEntry('personal', 'Alice'), notLoaded);
  assert.deepEqual(await global.FirebaseService.setPlayerSource('alliance'), notLoaded);
  assert.deepEqual(await global.FirebaseService.saveUserData({}), notLoaded);
});

test('building config fallbacks return safe empty values', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.getBuildingConfig('desert_storm'), null);
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getBuildingPositions('desert_storm'), null);
  assert.equal(global.FirebaseService.getBuildingPositionsVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfig('desert_storm'), null);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 0);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
});

test('building setters return null when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.setBuildingConfig('desert_storm', []), null);
  assert.equal(global.FirebaseService.setBuildingConfigVersion('desert_storm', 1), null);
  assert.equal(global.FirebaseService.setBuildingPositions('desert_storm', {}), null);
  assert.equal(global.FirebaseService.setBuildingPositionsVersion('desert_storm', 1), null);
});

test('user profile fallbacks return empty profile', () => {
  delete global.FirebaseManager;
  loadModule();
  const profile = global.FirebaseService.getUserProfile();
  assert.equal(profile.displayName, '');
  assert.equal(profile.nickname, '');
  assert.equal(profile.avatarDataUrl, '');
});

test('alliance fallbacks return safe empty values', async () => {
  delete global.FirebaseManager;
  loadModule();
  const notLoaded = { success: false, error: 'Firebase not loaded' };
  assert.deepEqual(await global.FirebaseService.createAlliance('Clan X'), notLoaded);
  assert.deepEqual(await global.FirebaseService.leaveAlliance(), notLoaded);
  assert.deepEqual(await global.FirebaseService.loadAllianceData(), notLoaded);
  assert.deepEqual(await global.FirebaseService.sendInvitation('user@x.com'), notLoaded);
  assert.deepEqual(await global.FirebaseService.checkInvitations(), []);
  assert.deepEqual(await global.FirebaseService.acceptInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.rejectInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.revokeInvitation('id1'), notLoaded);
  assert.deepEqual(await global.FirebaseService.resendInvitation('id1'), notLoaded);
  assert.equal(global.FirebaseService.getAllianceId(), null);
  assert.equal(global.FirebaseService.getAllianceName(), null);
  assert.equal(global.FirebaseService.getAllianceData(), null);
  assert.deepEqual(global.FirebaseService.getPendingInvitations(), []);
  assert.deepEqual(global.FirebaseService.getSentInvitations(), []);
  assert.deepEqual(global.FirebaseService.getInvitationNotifications(), []);
  assert.deepEqual(global.FirebaseService.getAllianceMembers(), {});
});

test('callback setters return null when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.setAuthCallback(() => {}), null);
  assert.equal(global.FirebaseService.setDataLoadCallback(() => {}), null);
  assert.equal(global.FirebaseService.setAllianceDataCallback(() => {}), null);
});

test('feature flag helpers return default rollout values when manager is absent', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: false,
    MULTIGAME_READ_FALLBACK_ENABLED: false,
    MULTIGAME_DUAL_WRITE_ENABLED: false,
    MULTIGAME_GAME_SELECTOR_ENABLED: false,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED'), false);
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('UNKNOWN_FLAG'), false);
});

test('listAvailableGames falls back to DSCoreGames when manager is absent', () => {
  delete global.FirebaseManager;
  global.DSCoreGames = {
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.listAvailableGames(), [{ id: 'last_war', name: 'Last War: Survival' }]);
});

test('isGameMetadataSuperAdmin fallback validates configured super-admin uid', () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.isGameMetadataSuperAdmin('2z2BdO8aVsUovqQWWL9WCRMdV933'), true);
  assert.equal(global.FirebaseService.isGameMetadataSuperAdmin({ uid: '2z2BdO8aVsUovqQWWL9WCRMdV933' }), true);
  assert.equal(global.FirebaseService.isGameMetadataSuperAdmin('not-admin'), false);
});

test('listGameMetadata falls back to core game catalog when manager is absent', async () => {
  delete global.FirebaseManager;
  global.DSCoreGames = {
    listAvailableGames: () => ([
      { id: 'last_war', name: 'Last War: Survival' },
      { id: 'desert_ops', name: 'Desert Ops' },
    ]),
  };
  loadModule();
  const games = await global.FirebaseService.listGameMetadata();
  assert.deepEqual(games, [
    { id: 'last_war', name: 'Last War: Survival' },
    { id: 'desert_ops', name: 'Desert Ops' },
  ]);
});

test('ensureActiveGame uses default game id from catalog', () => {
  delete global.FirebaseManager;
  global.DSCoreGames = {
    getDefaultGameId: () => 'last_war',
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
    normalizeGameId: stubNormalizeGameId,
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.ensureActiveGame(), { gameId: 'last_war', source: 'default' });
  assert.equal(global.FirebaseService.requireActiveGame(), 'last_war');
});

test('setActiveGame rejects unknown game id when catalog is available', () => {
  delete global.FirebaseManager;
  global.DSCoreGames = {
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
    normalizeGameId: stubNormalizeGameId,
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.setActiveGame('unknown_game'), {
    success: false,
    code: 'unknown-game-id',
    error: 'Unknown game id',
  });
});

test('setActiveGame accepts ids exposed by manager game catalog', () => {
  global.DSCoreGames = {
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
    normalizeGameId: stubNormalizeGameId,
  };
  global.FirebaseManager = {
    listAvailableGames: () => ([
      { id: 'last_war', name: 'Last War: Survival' },
      { id: 'desert_ops', name: 'Desert Ops' },
    ]),
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.setActiveGame('desert_ops'), {
    success: true,
    gameId: 'desert_ops',
    changed: true,
  });
});

test('active game selection is persisted per signed-in user', () => {
  global.localStorage = makeLocalStorage({});
  global.FirebaseManager = {
    getCurrentUser: () => ({ uid: 'uid-1' }),
  };
  loadModule();

  const firstSet = global.FirebaseService.setActiveGame('last_war');
  assert.equal(firstSet.success, true);
  assert.deepEqual(global.localStorage.dump(), {
    'ds_active_game_id::uid-1': 'last_war',
  });
});

test('legacy active game key is migrated into user-scoped key', () => {
  global.localStorage = makeLocalStorage({
    ds_active_game_id: 'last_war',
  });
  global.FirebaseManager = {
    getCurrentUser: () => ({ uid: 'uid-2' }),
  };
  loadModule();

  const context = global.FirebaseService.getActiveGame();
  assert.equal(context.gameId, 'last_war');
  assert.equal(context.source, 'storage-legacy');
  assert.deepEqual(global.localStorage.dump(), {
    'ds_active_game_id::uid-2': 'last_war',
  });
});

test('signOut clears in-memory active game but keeps user default for next sign-in', async () => {
  global.localStorage = makeLocalStorage({});
  let currentUser = { uid: 'uid-3' };
  global.FirebaseManager = {
    getCurrentUser: () => currentUser,
    signOut: async () => {
      currentUser = null;
      return { success: true };
    },
  };
  loadModule();

  global.FirebaseService.setActiveGame('last_war');
  await global.FirebaseService.signOut();
  assert.deepEqual(global.FirebaseService.getActiveGame(), { gameId: '', source: 'none' });

  currentUser = { uid: 'uid-3' };
  assert.deepEqual(global.FirebaseService.getActiveGame(), { gameId: 'last_war', source: 'storage' });
});

// ── Delegation when FirebaseManager is present ───────────────────────────────

test('isAvailable returns true when FirebaseManager exists', () => {
  global.FirebaseManager = { dummy: true };
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), true);
});

test('getPlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getPlayerDatabase: () => ({ Alice: { name: 'Alice', power: 100, troops: 'Tank' } }),
  };
  loadModule();
  const db = global.FirebaseService.getPlayerDatabase();
  assert.ok(db.Alice);
  assert.equal(db.Alice.name, 'Alice');
});

test('getAlliancePlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getAlliancePlayerDatabase: () => ({ Bob: { name: 'Bob', power: 200, troops: 'Aero' } }),
  };
  loadModule();
  assert.ok(global.FirebaseService.getAlliancePlayerDatabase().Bob);
});

test('getActivePlayerDatabase delegates to manager', () => {
  global.FirebaseManager = {
    getActivePlayerDatabase: () => ({ Dave: { name: 'Dave', power: 50, troops: 'Missile' } }),
  };
  loadModule();
  assert.ok(global.FirebaseService.getActivePlayerDatabase().Dave);
});

test('getBuildingConfig delegates to manager', () => {
  const config = [{ name: 'HQ', slots: 2, priority: 1 }];
  global.FirebaseManager = { getBuildingConfig: () => config };
  loadModule();
  assert.deepEqual(global.FirebaseService.getBuildingConfig('desert_storm'), config);
});

test('event-scoped getters accept { gameId, eventId } context object', () => {
  let receivedEventId = '';
  let receivedContext = null;
  global.FirebaseManager = {
    getBuildingConfig: (eventId, context) => {
      receivedEventId = eventId;
      receivedContext = context;
      return [{ name: 'HQ', slots: 1, priority: 1 }];
    },
  };
  loadModule();
  const result = global.FirebaseService.getBuildingConfig({
    gameId: 'last_war',
    eventId: 'desert_storm',
  });
  assert.equal(receivedEventId, 'desert_storm');
  assert.equal(receivedContext.gameId, 'last_war');
  assert.equal(Array.isArray(result), true);
});

test('getBuildingPositions delegates to manager', () => {
  const positions = { HQ: [100, 200] };
  global.FirebaseManager = { getBuildingPositions: () => positions };
  loadModule();
  assert.deepEqual(global.FirebaseService.getBuildingPositions('desert_storm'), positions);
});

test('getBuildingPositionsVersion delegates to manager', () => {
  global.FirebaseManager = { getBuildingPositionsVersion: () => 7 };
  loadModule();
  assert.equal(global.FirebaseService.getBuildingPositionsVersion('desert_storm'), 7);
});

test('getUserProfile delegates to manager', () => {
  const profile = { displayName: 'Alice', nickname: 'A', avatarDataUrl: 'data:...' };
  global.FirebaseManager = { getUserProfile: () => profile };
  loadModule();
  assert.deepEqual(global.FirebaseService.getUserProfile(), profile);
});

test('getUserProfile passes explicit game context to manager', () => {
  let receivedContext = null;
  const profile = { displayName: 'Alice', nickname: 'A', avatarDataUrl: 'data:...' };
  global.FirebaseManager = {
    getUserProfile: (context) => {
      receivedContext = context;
      return profile;
    },
  };
  loadModule();
  const result = global.FirebaseService.getUserProfile({ gameId: 'last_war' });
  assert.equal(receivedContext.gameId, 'last_war');
  assert.deepEqual(result, profile);
});

test('getPlayerSource delegates to manager', () => {
  global.FirebaseManager = { getPlayerSource: () => 'alliance' };
  loadModule();
  assert.equal(global.FirebaseService.getPlayerSource(), 'alliance');
});

test('getAllianceId delegates to manager', () => {
  global.FirebaseManager = { getAllianceId: () => 'alliance-123' };
  loadModule();
  assert.equal(global.FirebaseService.getAllianceId(), 'alliance-123');
});

test('getAllianceName delegates to manager', () => {
  global.FirebaseManager = { getAllianceName: () => 'Clan X' };
  loadModule();
  assert.equal(global.FirebaseService.getAllianceName(), 'Clan X');
});

test('getAllianceMembers delegates to manager', () => {
  const members = { uid1: { displayName: 'Alice' } };
  global.FirebaseManager = { getAllianceMembers: () => members };
  loadModule();
  assert.deepEqual(global.FirebaseService.getAllianceMembers(), members);
});

test('getPendingInvitations delegates to manager', () => {
  const invites = [{ id: 'i1', email: 'a@b.com' }];
  global.FirebaseManager = { getPendingInvitations: () => invites };
  loadModule();
  assert.deepEqual(global.FirebaseService.getPendingInvitations(), invites);
});

test('getInvitationNotifications delegates to manager', () => {
  const notifs = [{ id: 'n1', type: 'invite' }];
  global.FirebaseManager = { getInvitationNotifications: () => notifs };
  loadModule();
  assert.deepEqual(global.FirebaseService.getInvitationNotifications(), notifs);
});

test('setAuthCallback delegates to manager', () => {
  let registeredCb;
  global.FirebaseManager = { setAuthCallback: (cb) => { registeredCb = cb; } };
  loadModule();
  const cb = () => {};
  global.FirebaseService.setAuthCallback(cb);
  assert.equal(registeredCb, cb);
});

test('setDataLoadCallback delegates to manager', () => {
  let registeredCb;
  global.FirebaseManager = { setDataLoadCallback: (cb) => { registeredCb = cb; } };
  loadModule();
  const cb = () => {};
  global.FirebaseService.setDataLoadCallback(cb);
  assert.equal(registeredCb, cb);
});

test('feature flag helpers delegate to manager', () => {
  global.FirebaseManager = {
    getFeatureFlags: () => ({
      MULTIGAME_ENABLED: true,
      MULTIGAME_READ_FALLBACK_ENABLED: true,
      MULTIGAME_DUAL_WRITE_ENABLED: true,
      MULTIGAME_GAME_SELECTOR_ENABLED: false,
    }),
  };
  loadModule();
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_DUAL_WRITE_ENABLED'), true);
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_GAME_SELECTOR_ENABLED'), false);
});

test('listAvailableGames falls back to DSCoreGames when manager does not expose listAvailableGames', () => {
  global.FirebaseManager = {};
  global.DSCoreGames = {
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.listAvailableGames(), [{ id: 'last_war', name: 'Last War: Survival' }]);
});

test('game metadata methods delegate to manager when present', async () => {
  let receivedGetId = null;
  let receivedSetArgs = null;
  let receivedAdminArg = null;
  global.FirebaseManager = {
    listGameMetadata: async () => ([{ id: 'last_war', name: 'Last War: Survival', company: '', logo: '', attributes: {} }]),
    getGameMetadata: async (gameId) => {
      receivedGetId = gameId;
      return { id: gameId, name: 'Last War: Survival', company: '', logo: '', attributes: {} };
    },
    setGameMetadata: async (gameId, payload) => {
      receivedSetArgs = { gameId, payload };
      return { success: true };
    },
    isGameMetadataSuperAdmin: (userOrUid) => {
      receivedAdminArg = userOrUid;
      return true;
    },
  };
  loadModule();

  const listed = await global.FirebaseService.listGameMetadata();
  const fetched = await global.FirebaseService.getGameMetadata('last_war');
  const saved = await global.FirebaseService.setGameMetadata('last_war', { name: 'LW' });
  const isAdmin = global.FirebaseService.isGameMetadataSuperAdmin({ uid: 'u1' });

  assert.equal(Array.isArray(listed), true);
  assert.equal(receivedGetId, 'last_war');
  assert.deepEqual(fetched, { id: 'last_war', name: 'Last War: Survival', company: '', logo: '', attributes: {} });
  assert.equal(saved.success, true);
  assert.deepEqual(receivedSetArgs, { gameId: 'last_war', payload: { name: 'LW' } });
  assert.equal(isAdmin, true);
  assert.deepEqual(receivedAdminArg, { uid: 'u1' });
});

test('signOut clears active game context', async () => {
  global.FirebaseManager = {
    signOut: async () => ({ success: true }),
  };
  loadModule();
  assert.deepEqual(global.FirebaseService.setActiveGame('last_war'), { success: true, gameId: 'last_war', changed: true });
  await global.FirebaseService.signOut();
  assert.deepEqual(global.FirebaseService.getActiveGame(), { gameId: '', source: 'none' });
});

test('legacy game signature warning shim is retired in service layer', () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(String(message));

  try {
    global.FirebaseManager = {
      isSignedIn: () => false,
      getPlayerDatabase: () => ({}),
    };
    loadModule();

    global.FirebaseService.getPlayerDatabase();
    global.FirebaseService.getPlayerDatabase();

    assert.equal(warnings.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test('game-aware service methods accept explicit gameId context', async () => {
  let receivedContext = null;
  global.FirebaseManager = {
    isSignedIn: () => true,
    saveUserData: async (_options, context) => {
      receivedContext = context;
      return { success: true };
    },
  };
  loadModule();

  const result = await global.FirebaseService.saveUserData({ immediate: true }, { gameId: 'last_war' });
  assert.deepEqual(result, { success: true });
  assert.deepEqual(receivedContext, { gameId: 'last_war', explicit: true });
});

test('alliance and invitation methods propagate explicit game context', async () => {
  const contexts = {
    createAlliance: null,
    loadAllianceData: null,
    sendInvitation: null,
    checkInvitations: null,
    acceptInvitation: null,
    rejectInvitation: null,
    revokeInvitation: null,
    resendInvitation: null,
    getAllianceId: null,
    getAllianceName: null,
    getAllianceData: null,
    getPendingInvitations: null,
    getSentInvitations: null,
    getInvitationNotifications: null,
    getAllianceMembers: null,
    getPlayerSource: null,
  };
  global.FirebaseManager = {
    createAlliance: async (_name, context) => { contexts.createAlliance = context; return { success: true }; },
    loadAllianceData: async (context) => { contexts.loadAllianceData = context; return { success: true }; },
    sendInvitation: async (_email, context) => { contexts.sendInvitation = context; return { success: true }; },
    checkInvitations: async (context) => { contexts.checkInvitations = context; return []; },
    acceptInvitation: async (_id, context) => { contexts.acceptInvitation = context; return { success: true }; },
    rejectInvitation: async (_id, context) => { contexts.rejectInvitation = context; return { success: true }; },
    revokeInvitation: async (_id, context) => { contexts.revokeInvitation = context; return { success: true }; },
    resendInvitation: async (_id, context) => { contexts.resendInvitation = context; return { success: true }; },
    getAllianceId: (context) => { contexts.getAllianceId = context; return 'alliance-x'; },
    getAllianceName: (context) => { contexts.getAllianceName = context; return 'Alliance X'; },
    getAllianceData: (context) => { contexts.getAllianceData = context; return { id: 'alliance-x' }; },
    getPendingInvitations: (context) => { contexts.getPendingInvitations = context; return []; },
    getSentInvitations: (context) => { contexts.getSentInvitations = context; return []; },
    getInvitationNotifications: (context) => { contexts.getInvitationNotifications = context; return []; },
    getAllianceMembers: (context) => { contexts.getAllianceMembers = context; return {}; },
    getPlayerSource: (context) => { contexts.getPlayerSource = context; return 'personal'; },
  };
  loadModule();

  const context = { gameId: 'last_war' };
  await global.FirebaseService.createAlliance('Alliance X', context);
  await global.FirebaseService.loadAllianceData(context);
  await global.FirebaseService.sendInvitation('test@example.com', context);
  await global.FirebaseService.checkInvitations(context);
  await global.FirebaseService.acceptInvitation('inv-1', context);
  await global.FirebaseService.rejectInvitation('inv-1', context);
  await global.FirebaseService.revokeInvitation('inv-1', context);
  await global.FirebaseService.resendInvitation('inv-1', context);
  global.FirebaseService.getAllianceId(context);
  global.FirebaseService.getAllianceName(context);
  global.FirebaseService.getAllianceData(context);
  global.FirebaseService.getPendingInvitations(context);
  global.FirebaseService.getSentInvitations(context);
  global.FirebaseService.getInvitationNotifications(context);
  global.FirebaseService.getAllianceMembers(context);
  global.FirebaseService.getPlayerSource(context);

  Object.keys(contexts).forEach((key) => {
    assert.deepEqual(contexts[key], { gameId: 'last_war', explicit: true });
  });
});
