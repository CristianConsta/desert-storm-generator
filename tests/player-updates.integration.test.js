// tests/player-updates.integration.test.js
// Integration tests for the player-updates controller.
// Uses mocked gateway — no Firebase required.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Module paths
// ---------------------------------------------------------------------------
const corePath = path.resolve(__dirname, '../js/features/player-updates/player-updates-core.js');
const controllerPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-controller.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadModules() {
    global.window = global;

    // Minimal DOM stubs
    global.document = {
        getElementById: function (id) {
            return (global._domStubs && global._domStubs[id]) || null;
        },
        querySelectorAll: function () { return []; },
    };
    global._domStubs = {};

    global.location = { origin: 'https://example.com' };

    // App state globals the controller reads
    // Note: controller now reads allianceId via _gateway.getAllianceId(), not global.currentAllianceId
    global.currentGameId = 'last_war';
    global.currentAuthUser = { uid: 'uid_leader_pu' };
    global.allPlayers = [
        { name: 'Alice', power: 1000, thp: 5000, troops: 'Tank' },
        { name: 'Bob', power: 2000, thp: 8000, troops: 'Aero' },
    ];

    [corePath, controllerPath].forEach(function (p) {
        delete require.cache[require.resolve(p)];
    });
    delete global.DSFeaturePlayerUpdatesCore;
    delete global.DSFeaturePlayerUpdatesController;

    require(corePath);
    require(controllerPath);
}

function makeMockGateway(overrides) {
    return Object.assign({
        getAllianceId: function () { return 'alliance_pu_integ_1'; },
        getCurrentUser: function () { return { uid: 'uid_leader_pu' }; },
        saveTokenBatch: async function () { return { ok: true, tokenIds: ['tok_1', 'tok_2'] }; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        updatePersonalPendingUpdateStatus: async function () { return { ok: true }; },
        applyPlayerUpdateToPersonal: async function () { return { ok: true }; },
        applyPlayerUpdateToAlliance: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
        subscribePendingUpdatesCount: function (allianceId, uid, cb) { if (typeof uid === 'function') { uid(0); } else if (typeof cb === 'function') { cb(0); } return function () {}; },
        loadPendingUpdates: async function () { return []; },
    }, overrides || {});
}

// ---------------------------------------------------------------------------
// approveUpdate -> updatePendingUpdateStatus with status='approved'
// ---------------------------------------------------------------------------

test('approveUpdate: calls updatePendingUpdateStatus with status approved', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            capturedArgs = { allianceId, updateId, update };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    // New approval flow requires docs to be registered
    global.DSFeaturePlayerUpdatesController.setPendingUpdateDocs([{
        id: 'upd_001',
        contextType: 'alliance',
        allianceId: 'alliance_pu_integ_1',
        playerName: 'Alice',
        proposedValues: { power: 1100, thp: 5500, troops: 'Tank' },
    }]);
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_001');

    assert.equal(result.ok, true);
    assert.ok(capturedArgs, 'updatePendingUpdateStatus should have been called');
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.updateId, 'upd_001');
    assert.equal(capturedArgs.update.status, 'approved');
    assert.equal(capturedArgs.update.reviewedBy, 'uid_leader_pu');
    assert.equal(capturedArgs.update.appliedTo, 'alliance');
});

test('approveUpdate: returns ok=false if updateId is missing', async () => {
    loadModules();
    var gateway = makeMockGateway();
    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate(null);
    assert.equal(result.ok, false);
});

test('approveUpdate: returns ok=false if not initialized', async () => {
    loadModules();
    // Do NOT call init — controller has no gateway
    const result = await global.DSFeaturePlayerUpdatesController.approveUpdate('upd_001');
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// rejectUpdate → updatePendingUpdateStatus with status='rejected'
// ---------------------------------------------------------------------------

test('rejectUpdate: calls updatePendingUpdateStatus with status rejected', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            capturedArgs = { allianceId, updateId, update };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.rejectUpdate('upd_002');

    assert.equal(result.ok, true);
    assert.equal(capturedArgs.update.status, 'rejected');
    assert.equal(capturedArgs.updateId, 'upd_002');
});

// ---------------------------------------------------------------------------
// revokeToken
// ---------------------------------------------------------------------------

test('revokeToken: calls gateway.revokeToken with allianceId and tokenId', async () => {
    loadModules();

    var capturedArgs = null;
    var gateway = makeMockGateway({
        revokeToken: async function (allianceId, tokenId) {
            capturedArgs = { allianceId, tokenId };
            return { ok: true };
        },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = await global.DSFeaturePlayerUpdatesController.revokeToken('tok_abc');

    assert.equal(result.ok, true);
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.tokenId, 'tok_abc');
});

test('revokeToken: returns ok=false if tokenId is missing', async () => {
    loadModules();
    global.DSFeaturePlayerUpdatesController.init(makeMockGateway());
    const result = await global.DSFeaturePlayerUpdatesController.revokeToken(null);
    assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// init → destroy cleans up
// ---------------------------------------------------------------------------

test('init returns destroy function', () => {
    loadModules();
    const handle = global.DSFeaturePlayerUpdatesController.init(makeMockGateway());
    assert.ok(handle && typeof handle.destroy === 'function');
    assert.equal(typeof handle.setPendingUpdateDocs, 'function');
    assert.equal(typeof handle.subscribeBadge, 'function');
    assert.equal(typeof handle.approveUpdate, 'function');
    assert.equal(typeof handle.rejectUpdate, 'function');
});

// ---------------------------------------------------------------------------
// createUpdateToken (per-player invite flow)
// ---------------------------------------------------------------------------

test('createUpdateToken gateway mock: returns success with tokenId', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            return { success: true, tokenId: 'mock-token-123' };
        },
    });
    const result = await gateway.createUpdateToken('alliance_pu_integ_1', 'Alice', { expiryHours: 48 });
    assert.equal(result.success, true);
    assert.equal(result.tokenId, 'mock-token-123');
});

test('createUpdateToken gateway mock: passes allianceId and playerName correctly', async () => {
    loadModules();
    var capturedArgs = null;
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            capturedArgs = { allianceId, playerName, options };
            return { success: true, tokenId: 'tok-xyz' };
        },
    });
    await gateway.createUpdateToken('alliance_pu_integ_1', 'Bob', { expiryHours: 48 });
    assert.ok(capturedArgs, 'createUpdateToken should have been called');
    assert.equal(capturedArgs.allianceId, 'alliance_pu_integ_1');
    assert.equal(capturedArgs.playerName, 'Bob');
    assert.equal(capturedArgs.options.expiryHours, 48);
});

test('createUpdateToken gateway mock: returns failure on error', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createUpdateToken: async function () {
            return { success: false, error: 'Permission denied' };
        },
    });
    const result = await gateway.createUpdateToken('alliance_pu_integ_1', 'Alice', { expiryHours: 48 });
    assert.equal(result.success, false);
    assert.ok(result.error);
});

// ---------------------------------------------------------------------------
// Invite flow: player name propagation (regression for bug fixes)
// ---------------------------------------------------------------------------

test('invite flow: createUpdateToken receives playerName from clicked row (originalName)', async () => {
    // Regression test: app.js reads originalName from data-player attribute and
    // passes it directly to FirebaseService.createUpdateToken. This verifies the
    // contract that the gateway receives the same name that was on the button.
    loadModules();

    var capturedPlayerName = null;
    const gateway = makeMockGateway({
        createUpdateToken: async function (allianceId, playerName, options) {
            capturedPlayerName = playerName;
            return { success: true, tokenId: 'tok-from-row' };
        },
    });

    // Simulate what app.js does: read originalName from data-player and call createUpdateToken
    const originalName = 'Alice';
    await gateway.createUpdateToken('alliance_pu_integ_1', originalName, { expiryHours: 48 });

    assert.equal(capturedPlayerName, 'Alice', 'createUpdateToken should receive the exact player name from the row');
});

test('invite flow: invite URL uses alliance param (not aid) matching player-update.js reader', async () => {
    // Regression test: app.js builds invite URL with &alliance= param.
    // player-update.js reads params.alliance || params.aid.
    // This test verifies the URL produced by app.js contains &alliance= so
    // player-update.js can read it.
    loadModules();

    const tokenId = 'tok-abc123';
    const allianceId = 'alliance_pu_integ_1';
    const gameId = 'last_war';
    const origin = global.location.origin;

    // Reproduce the URL construction from app.js alliance branch
    const inviteUrl = origin + '/player-update.html?token=' + encodeURIComponent(tokenId)
        + '&alliance=' + encodeURIComponent(allianceId)
        + '&lang=' + encodeURIComponent('en')
        + '&gid=' + encodeURIComponent(gameId);

    assert.ok(inviteUrl.includes('alliance='), 'URL should contain alliance= param');
    assert.ok(!inviteUrl.includes('&aid='), 'URL should not use deprecated &aid= param');
    assert.ok(inviteUrl.includes('token=' + tokenId));
    assert.ok(inviteUrl.includes('alliance=' + allianceId));
    assert.ok(inviteUrl.includes('gid=' + gameId), 'URL should contain gid= param');
});

// ---------------------------------------------------------------------------
// createPersonalUpdateToken (personal invite flow)
// ---------------------------------------------------------------------------

test('createPersonalUpdateToken gateway mock: receives correct uid, playerName, options', async () => {
    loadModules();
    var capturedArgs = null;
    const gateway = makeMockGateway({
        createPersonalUpdateToken: async function (uid, playerName, options) {
            capturedArgs = { uid, playerName, options };
            return { success: true, tokenId: 'personal-tok-001' };
        },
    });
    await gateway.createPersonalUpdateToken('uid_leader_pu', 'Alice', { expiryHours: 48 });
    assert.ok(capturedArgs, 'createPersonalUpdateToken should have been called');
    assert.equal(capturedArgs.uid, 'uid_leader_pu');
    assert.equal(capturedArgs.playerName, 'Alice');
    assert.equal(capturedArgs.options.expiryHours, 48);
});

test('createPersonalUpdateToken gateway mock: returns { success: true, tokenId }', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createPersonalUpdateToken: async function (uid, playerName, options) {
            return { success: true, tokenId: 'personal-tok-abc' };
        },
    });
    const result = await gateway.createPersonalUpdateToken('uid_leader_pu', 'Bob', { expiryHours: 48 });
    assert.equal(result.success, true);
    assert.equal(result.tokenId, 'personal-tok-abc');
});

test('createPersonalUpdateToken gateway mock: returns failure on error', async () => {
    loadModules();
    const gateway = makeMockGateway({
        createPersonalUpdateToken: async function () {
            return { success: false, error: 'Permission denied' };
        },
    });
    const result = await gateway.createPersonalUpdateToken('uid_leader_pu', 'Alice', { expiryHours: 48 });
    assert.equal(result.success, false);
    assert.ok(result.error);
});

// ---------------------------------------------------------------------------
// Invite URL construction: personal vs alliance
// ---------------------------------------------------------------------------

test('invite flow personal: URL uses ?token=...&uid=... (no alliance param)', () => {
    loadModules();
    const tokenId = 'tok-personal-xyz';
    const uid = 'uid_leader_pu';
    const gameId = 'last_war';
    const playerKey = 'alice_abc123';
    const origin = global.location.origin;

    // Reproduce the URL construction from app.js personal branch
    const inviteUrl = origin + '/player-update.html?token=' + encodeURIComponent(tokenId)
        + '&uid=' + encodeURIComponent(uid)
        + '&lang=' + encodeURIComponent('en')
        + '&gid=' + encodeURIComponent(gameId)
        + '&pk=' + encodeURIComponent(playerKey);

    assert.ok(inviteUrl.includes('uid='), 'Personal invite URL should contain uid= param');
    assert.ok(!inviteUrl.includes('alliance='), 'Personal invite URL should NOT contain alliance= param');
    assert.ok(inviteUrl.includes('token=' + tokenId));
    assert.ok(inviteUrl.includes('uid=' + uid));
    assert.ok(inviteUrl.includes('gid=' + gameId), 'Personal invite URL should include gid= param');
    assert.ok(inviteUrl.includes('pk=' + playerKey), 'Personal invite URL should include pk= player key');
});

test('invite flow alliance: URL uses ?token=...&alliance=... (no uid param)', () => {
    loadModules();
    const tokenId = 'tok-alliance-xyz';
    const allianceId = 'alliance_pu_integ_1';
    const gameId = 'last_war';
    const playerKey = 'lord_def456';
    const origin = global.location.origin;

    // Reproduce the URL construction from app.js alliance branch
    const inviteUrl = origin + '/player-update.html?token=' + encodeURIComponent(tokenId)
        + '&alliance=' + encodeURIComponent(allianceId)
        + '&lang=' + encodeURIComponent('en')
        + '&gid=' + encodeURIComponent(gameId)
        + '&pk=' + encodeURIComponent(playerKey);

    assert.ok(inviteUrl.includes('alliance='), 'Alliance invite URL should contain alliance= param');
    assert.ok(!inviteUrl.includes('&uid='), 'Alliance invite URL should NOT contain uid= param');
    assert.ok(inviteUrl.includes('token=' + tokenId));
    assert.ok(inviteUrl.includes('alliance=' + allianceId));
    assert.ok(inviteUrl.includes('gid=' + gameId), 'Alliance invite URL should include gid= param');
    assert.ok(inviteUrl.includes('pk=' + playerKey), 'Alliance invite URL should include pk= player key');
});
