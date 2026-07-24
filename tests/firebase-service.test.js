const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const gatewayUtilsPath = path.resolve(__dirname, '../js/shared/data/firebase-gateway-utils.js');
const authGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-auth-gateway.js');
const playersGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-players-gateway.js');
const eventsGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-events-gateway.js');
const allianceGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-alliance-gateway.js');
const notificationsGatewayPath = path.resolve(__dirname, '../js/shared/data/firebase-notifications-gateway.js');
const coreEventsPath = path.resolve(__dirname, '../js/core/events.js');
const coreGamesPath = path.resolve(__dirname, '../js/core/games.js');
const modulePath = path.resolve(__dirname, '../js/services/firebase-service.js');

function loadModule() {
  global.window = global;
  delete global.DSSharedFirebaseGatewayUtils;
  delete global.DSSharedFirebaseAuthGateway;
  delete global.DSSharedFirebasePlayersGateway;
  delete global.DSSharedFirebaseEventsGateway;
  delete global.DSSharedFirebaseAllianceGateway;
  delete global.DSSharedFirebaseNotificationsGateway;
  delete global.DSCoreEvents;
  delete global.DSCoreGames;
  delete global.FirebaseService;
  delete require.cache[require.resolve(gatewayUtilsPath)];
  delete require.cache[require.resolve(authGatewayPath)];
  delete require.cache[require.resolve(playersGatewayPath)];
  delete require.cache[require.resolve(eventsGatewayPath)];
  delete require.cache[require.resolve(allianceGatewayPath)];
  delete require.cache[require.resolve(notificationsGatewayPath)];
  delete require.cache[require.resolve(coreEventsPath)];
  delete require.cache[require.resolve(coreGamesPath)];
  delete require.cache[require.resolve(modulePath)];
  require(gatewayUtilsPath);
  require(authGatewayPath);
  require(playersGatewayPath);
  require(eventsGatewayPath);
  require(allianceGatewayPath);
  require(notificationsGatewayPath);
  require(coreEventsPath);
  require(coreGamesPath);
  require(modulePath);
}

const NOT_LOADED = { success: false, error: 'Firebase not loaded' };
const profilePayload = { displayName: 'Ana', nickname: 'A', avatarDataUrl: '', theme: 'standard' };
const scenarios = [
  { method: 'init', args: [], fallback: false },
  { method: 'setAuthCallback', args: [() => {}], fallback: null },
  { method: 'setDataLoadCallback', args: [() => {}], fallback: null },
  { method: 'setAllianceDataCallback', args: [() => {}], fallback: null },
  { method: 'signInWithGoogle', args: [], fallback: NOT_LOADED },
  { method: 'signInWithEmail', args: ['user@example.com', 'password'], fallback: NOT_LOADED },
  { method: 'signUpWithEmail', args: ['new@example.com', 'password'], fallback: NOT_LOADED },
  { method: 'resetPassword', args: ['user@example.com'], fallback: NOT_LOADED },
  { method: 'signOut', args: [], fallback: NOT_LOADED },
  { method: 'deleteUserAccountAndData', args: [], fallback: NOT_LOADED },
  { method: 'getCurrentUser', args: [], fallback: null },
  { method: 'isSignedIn', args: [], fallback: false },
  { method: 'loadUserData', args: [{ uid: 'user-1' }], fallback: NOT_LOADED },
  { method: 'saveUserData', args: [{ scope: 'all' }], fallback: NOT_LOADED },
  { method: 'uploadPlayerDatabase', args: ['players.csv'], reject: NOT_LOADED },
  { method: 'getPlayerDatabase', args: [], fallback: {} },
  { method: 'getAlliancePlayerDatabase', args: [], fallback: {} },
  { method: 'upsertPlayerEntry', args: ['personal', 'Old Name', { name: 'New Name' }], fallback: NOT_LOADED },
  { method: 'removePlayerEntry', args: ['personal', 'To Delete'], fallback: NOT_LOADED },
  { method: 'getAllEventData', args: [], fallback: {} },
  { method: 'getEventIds', args: [], fallback: [] },
  { method: 'getEventMeta', args: ['desert_storm'], fallback: null },
  { method: 'upsertEvent', args: ['test_event', { name: 'Test Event' }], fallback: null },
  { method: 'removeEvent', args: ['test_event'], fallback: false },
  { method: 'setEventMetadata', args: ['test_event', { name: 'Updated' }], fallback: null },
  { method: 'getActivePlayerDatabase', args: [], fallback: {} },
  { method: 'getUserProfile', args: [], fallback: { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' } },
  { method: 'setUserProfile', args: [profilePayload], fallback: { displayName: '', nickname: '', avatarDataUrl: '', theme: 'standard' } },
  { method: 'getPlayerSource', args: [], fallback: 'personal' },
  { method: 'getBuildingConfig', args: ['desert_storm'], fallback: null },
  { method: 'setBuildingConfig', args: ['desert_storm', [{ name: 'HQ' }]], fallback: null },
  { method: 'getBuildingConfigVersion', args: ['desert_storm'], fallback: 0 },
  { method: 'setBuildingConfigVersion', args: ['desert_storm', 5], fallback: null },
  { method: 'getBuildingPositions', args: ['desert_storm'], fallback: null },
  { method: 'setBuildingPositions', args: ['desert_storm', { HQ: [10, 20] }], fallback: null },
  { method: 'getBuildingPositionsVersion', args: ['desert_storm'], fallback: 0 },
  { method: 'setBuildingPositionsVersion', args: ['desert_storm', 6], fallback: null },
  { method: 'getGlobalDefaultBuildingConfig', args: ['desert_storm'], fallback: null },
  { method: 'getGlobalDefaultBuildingConfigVersion', args: [], fallback: 0 },
  { method: 'getGlobalDefaultBuildingPositions', args: ['desert_storm'], fallback: {} },
  { method: 'getGlobalDefaultBuildingPositionsVersion', args: [], fallback: 0 },
  { method: 'createAlliance', args: ['Alpha'], fallback: NOT_LOADED },
  { method: 'leaveAlliance', args: [], fallback: NOT_LOADED },
  { method: 'loadAllianceData', args: [], fallback: NOT_LOADED },
  { method: 'sendInvitation', args: ['ally@example.com'], fallback: NOT_LOADED },
  { method: 'checkInvitations', args: [], fallback: [] },
  { method: 'acceptInvitation', args: ['invite-1'], fallback: NOT_LOADED },
  { method: 'rejectInvitation', args: ['invite-2'], fallback: NOT_LOADED },
  { method: 'revokeInvitation', args: ['invite-3'], fallback: NOT_LOADED },
  { method: 'resendInvitation', args: ['invite-4'], fallback: NOT_LOADED },
  { method: 'uploadAlliancePlayerDatabase', args: ['alliance.csv'], reject: NOT_LOADED },
  { method: 'setPlayerSource', args: ['alliance'], fallback: NOT_LOADED },
  { method: 'getAllianceId', args: [], fallback: null },
  { method: 'createUpdateToken', args: ['ally-1', 'Alice', { expiryHours: 48 }], fallback: { success: false, error: 'Firebase not loaded' } },
  { method: 'getAllianceName', args: [], fallback: null },
  { method: 'getAllianceData', args: [], fallback: null },
  { method: 'getPendingInvitations', args: [], fallback: [] },
  { method: 'getSentInvitations', args: [], fallback: [] },
  { method: 'getInvitationNotifications', args: [], fallback: [] },
  { method: 'getAllianceMembers', args: [], fallback: {} },
];

test('firebase service returns safe fallbacks when manager is missing', async () => {
  delete global.FirebaseManager;
  loadModule();
  assert.equal(global.FirebaseService.isAvailable(), false);
  assert.deepEqual(await global.FirebaseService.signOut(), { success: false, error: 'Firebase not loaded' });
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), { success: false, error: 'Firebase not loaded' });
  assert.equal(global.FirebaseService.getPlayerSource(), 'personal');
  assert.deepEqual(global.FirebaseService.getAllEventData(), {});
  assert.deepEqual(global.FirebaseService.getEventIds(), []);
  assert.equal(global.FirebaseService.getEventMeta('desert_storm'), null);
  assert.equal(global.FirebaseService.upsertEvent('test_event', { name: 'Test' }), null);
  assert.equal(global.FirebaseService.removeEvent('test_event'), false);
  assert.equal(global.FirebaseService.setEventMetadata('test_event', { name: 'Test' }), null);
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 0);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), null);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 0);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), {});
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 0);
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: false,
    MULTIGAME_READ_FALLBACK_ENABLED: false,
    MULTIGAME_DUAL_WRITE_ENABLED: false,
    MULTIGAME_GAME_SELECTOR_ENABLED: false,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_ENABLED'), false);
  assert.deepEqual(global.FirebaseService.listAvailableGames(), [{
    id: 'last_war',
    name: 'Last War: Survival',
    logo: '',
    company: 'FirstFun',
    troopModel: {
      categories: [
        { id: 'tank', label: 'Tank' },
        { id: 'aero', label: 'Aero' },
        { id: 'missile', label: 'Missile' },
      ],
      fallbackCategory: 'unknown',
    },
    playerImportSchema: {
      id: 'last_war_players_v1',
      templateFileName: 'player_database_template.xlsx',
      sheetName: 'Players',
      headerRowIndex: 9,
      columns: [
        { key: 'name', header: 'Player Name', required: true },
        { key: 'power', header: 'E1 Total Power(M)', required: true },
        { key: 'troops', header: 'E1 Troops', required: true },
      ],
    },
    assignmentAlgorithmIds: ['balanced_round_robin'],
  }]);
  assert.deepEqual(global.FirebaseService.getActiveGame(), { gameId: '', source: 'none' });
  const setActiveResult = global.FirebaseService.setActiveGame('last_war');
  assert.equal(setActiveResult.success, true);
  assert.equal(setActiveResult.gameId, 'last_war');
  assert.equal(global.FirebaseService.requireActiveGame(), 'last_war');
  global.FirebaseService.clearActiveGame();
  assert.throws(() => global.FirebaseService.requireActiveGame(), (error) => error && error.code === 'missing-active-game');
  assert.equal(global.FirebaseService.getMigrationVersion(), 0);
  assert.equal(global.FirebaseService.getMigratedToGameSubcollectionsAt(), null);
  assert.deepEqual(global.FirebaseService.getObservabilityCounters(), {
    dualWriteMismatchCount: 0,
    invitationContextMismatchCount: 0,
    fallbackReadHitCount: 0,
  });
  assert.equal(global.FirebaseService.resetObservabilityCounters(), false);
});

test('firebase service delegates calls to FirebaseManager', async () => {
  let called = false;
  global.FirebaseManager = {
    signOut: async () => { called = true; return { success: true }; },
    deleteUserAccountAndData: async () => ({ success: true, dataDeleted: true, accountDeleted: true }),
    isSignedIn: () => true,
    getAllEventData: () => ({ desert_storm: { name: 'Desert Storm' } }),
    getEventIds: () => ['desert_storm'],
    getEventMeta: (eventId) => ({ id: eventId, name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' }),
    upsertEvent: (eventId, payload) => ({ id: eventId, name: payload.name, logoDataUrl: '', mapDataUrl: '' }),
    removeEvent: () => true,
    setEventMetadata: (eventId, payload) => ({ id: eventId, name: payload.name, logoDataUrl: '', mapDataUrl: '' }),
    getBuildingConfigVersion: () => 11,
    getGlobalDefaultBuildingConfig: () => [{ name: 'Command Center', label: 'CC' }],
    getGlobalDefaultBuildingConfigVersion: () => 456,
    getGlobalDefaultBuildingPositions: () => ({ 'Info Center': [100, 200] }),
    getGlobalDefaultBuildingPositionsVersion: () => 123,
    getFeatureFlags: () => ({
      MULTIGAME_ENABLED: true,
      MULTIGAME_READ_FALLBACK_ENABLED: false,
      MULTIGAME_DUAL_WRITE_ENABLED: true,
      MULTIGAME_GAME_SELECTOR_ENABLED: true,
    }),
    listAvailableGames: () => ([{ id: 'last_war', name: 'Last War: Survival' }]),
    getMigrationVersion: () => 1,
    getMigratedToGameSubcollectionsAt: () => '2026-02-18T00:00:00.000Z',
    getObservabilityCounters: () => ({
      dualWriteMismatchCount: 0,
      invitationContextMismatchCount: 0,
      fallbackReadHitCount: 3,
    }),
    resetObservabilityCounters: () => true,
  };
  loadModule();

  const result = await global.FirebaseService.signOut();
  assert.deepEqual(result, { success: true });
  assert.equal(called, true);
  assert.deepEqual(await global.FirebaseService.deleteUserAccountAndData(), { success: true, dataDeleted: true, accountDeleted: true });
  assert.equal(global.FirebaseService.isSignedIn(), true);
  assert.deepEqual(global.FirebaseService.getAllEventData(), { desert_storm: { name: 'Desert Storm' } });
  assert.deepEqual(global.FirebaseService.getEventIds(), ['desert_storm']);
  assert.deepEqual(global.FirebaseService.getEventMeta('desert_storm'), { id: 'desert_storm', name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' });
  assert.deepEqual(global.FirebaseService.upsertEvent('test_event', { name: 'Test' }), { id: 'test_event', name: 'Test', logoDataUrl: '', mapDataUrl: '' });
  assert.equal(global.FirebaseService.removeEvent('test_event'), true);
  assert.deepEqual(global.FirebaseService.setEventMetadata('desert_storm', { name: 'Desert Storm' }), { id: 'desert_storm', name: 'Desert Storm', logoDataUrl: '', mapDataUrl: '' });
  assert.equal(global.FirebaseService.getBuildingConfigVersion('desert_storm'), 11);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingConfig('canyon_battlefield'), [{ name: 'Command Center', label: 'CC' }]);
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingConfigVersion(), 456);
  assert.deepEqual(global.FirebaseService.getGlobalDefaultBuildingPositions('desert_storm'), { 'Info Center': [100, 200] });
  assert.equal(global.FirebaseService.getGlobalDefaultBuildingPositionsVersion(), 123);
  assert.deepEqual(global.FirebaseService.getFeatureFlags(), {
    MULTIGAME_ENABLED: true,
    MULTIGAME_READ_FALLBACK_ENABLED: false,
    MULTIGAME_DUAL_WRITE_ENABLED: true,
    MULTIGAME_GAME_SELECTOR_ENABLED: true,
  });
  assert.equal(global.FirebaseService.isFeatureFlagEnabled('MULTIGAME_DUAL_WRITE_ENABLED'), true);
  assert.deepEqual(global.FirebaseService.listAvailableGames(), [{ id: 'last_war', name: 'Last War: Survival' }]);
  const delegatedSetActiveResult = global.FirebaseService.setActiveGame('last_war');
  assert.equal(delegatedSetActiveResult.success, true);
  assert.equal(delegatedSetActiveResult.gameId, 'last_war');
  assert.equal(global.FirebaseService.requireActiveGame(), 'last_war');
  assert.equal(global.FirebaseService.getMigrationVersion(), 1);
  assert.equal(global.FirebaseService.getMigratedToGameSubcollectionsAt(), '2026-02-18T00:00:00.000Z');
  assert.deepEqual(global.FirebaseService.getObservabilityCounters(), {
    dualWriteMismatchCount: 0,
    invitationContextMismatchCount: 0,
    fallbackReadHitCount: 3,
  });
  assert.equal(global.FirebaseService.resetObservabilityCounters(), true);
});

test('firebase service normalizeEventId fully normalizes eventId (not just trim)', () => {
  let capturedEventId = null;
  global.FirebaseManager = {
    getEventMeta: (eventId) => { capturedEventId = eventId; return null; },
  };
  loadModule();

  global.FirebaseService.getEventMeta('Desert Storm!', { gameId: 'last_war' });
  assert.equal(capturedEventId, 'desert_storm', 'eventId must be lowercased and stripped of special characters before reaching FirebaseManager');
});
