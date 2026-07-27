// tests/player-updates.race.integration.test.js
// Race condition integration tests for the player-updates controller.
//
// Scenario: Two concurrent anonymous writes attempt to use the same token.
// The Firestore rule `resource.data.used == false` guarantees only the first
// succeeds; the second fails with PERMISSION_DENIED.
// We verify the controller handles the error gracefully.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const corePath = path.resolve(__dirname, '../js/features/player-updates/player-updates-core.js');
const controllerPath = path.resolve(__dirname, '../js/features/player-updates/player-updates-controller.js');

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function loadModules() {
    global.window = global;
    global.document = {
        getElementById: function () { return null; },
        querySelectorAll: function () { return []; },
    };
    global.crypto = require('node:crypto').webcrypto;
    global.location = { origin: 'https://example.com' };
    global.currentAllianceId = 'alliance_race_1';
    global.currentGameId = 'last_war';
    global.currentAuthUser = { uid: 'uid_leader_race' };
    global.allPlayers = [];
    global.alert = function () {};

    [corePath, controllerPath].forEach(function (p) {
        delete require.cache[require.resolve(p)];
    });
    delete global.DSFeaturePlayerUpdatesCore;
    delete global.DSFeaturePlayerUpdatesController;

    require(corePath);
    require(controllerPath);
}

function makePermissionDeniedError() {
    var err = new Error('PERMISSION_DENIED: Missing or insufficient permissions.');
    err.code = 'permission-denied';
    return err;
}

// ---------------------------------------------------------------------------
// Race condition: two concurrent approveUpdate calls for the same update
// First succeeds, second fails with PERMISSION_DENIED
// ---------------------------------------------------------------------------

test('race condition: first approveUpdate succeeds, second fails with PERMISSION_DENIED — both resolve without throwing', async () => {
    loadModules();

    var callCount = 0;
    var gateway = {
        getAllianceId: function () { return null; },
        getCurrentUser: function () { return { uid: 'race-user-1' }; },
        saveTokenBatch: async function () { return { ok: true, tokenIds: [] }; },
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            callCount++;
            if (callCount === 1) {
                return { ok: true };
            }
            throw makePermissionDeniedError();
        },
        updatePersonalPendingUpdateStatus: async function (uid, updateId, update) {
            callCount++;
            if (callCount === 1) {
                return { ok: true };
            }
            throw makePermissionDeniedError();
        },
        applyPlayerUpdateToPersonal: async function () { return { ok: true }; },
        applyPlayerUpdateToAlliance: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
    };

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.setPendingUpdateDocs([{
        id: 'upd_race_1',
        contextType: 'personal',
        ownerUid: 'uid_leader_race',
        playerName: 'RacePlayer',
        proposedValues: { power: 100, thp: 500, troops: 'Tank' },
    }]);

    // Fire both approvals concurrently
    const [result1, result2] = await Promise.all([
        global.DSFeaturePlayerUpdatesController.approveUpdate('upd_race_1'),
        global.DSFeaturePlayerUpdatesController.approveUpdate('upd_race_1'),
    ]);

    // First should succeed
    assert.equal(result1.ok, true, 'First approval should succeed');
    // Second should fail gracefully — not throw
    assert.equal(result2.ok, false, 'Second approval should fail gracefully');
    assert.ok(result2.error, 'Second result should carry an error message');
});

// ---------------------------------------------------------------------------
// Race condition: rejectUpdate after approveUpdate (concurrent review conflict)
// ---------------------------------------------------------------------------

test('race condition: approveUpdate and rejectUpdate concurrently — both resolve, last writer wins', async () => {
    loadModules();

    var writes = [];
    var gateway = {
        getAllianceId: function () { return null; },
        getCurrentUser: function () { return { uid: 'race-user-2' }; },
        saveTokenBatch: async function () { return { ok: true, tokenIds: [] }; },
        updatePendingUpdateStatus: async function (allianceId, updateId, update) {
            writes.push(update.status);
            await new Promise(function (resolve) { setTimeout(resolve, Math.random() * 10); });
            return { ok: true };
        },
        updatePersonalPendingUpdateStatus: async function (uid, updateId, update) {
            writes.push(update.status);
            await new Promise(function (resolve) { setTimeout(resolve, Math.random() * 10); });
            return { ok: true };
        },
        applyPlayerUpdateToPersonal: async function () { return { ok: true }; },
        applyPlayerUpdateToAlliance: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
    };

    global.DSFeaturePlayerUpdatesController.init(gateway);
    global.DSFeaturePlayerUpdatesController.setPendingUpdateDocs([{
        id: 'upd_concurrent',
        contextType: 'personal',
        ownerUid: 'uid_leader_race',
        playerName: 'ConcurrentPlayer',
        proposedValues: { power: 100, thp: 500, troops: 'Tank' },
    }]);

    const [approveResult, rejectResult] = await Promise.all([
        global.DSFeaturePlayerUpdatesController.approveUpdate('upd_concurrent'),
        global.DSFeaturePlayerUpdatesController.rejectUpdate('upd_concurrent'),
    ]);

    // Both should resolve (not throw)
    assert.equal(approveResult.ok, true);
    assert.equal(rejectResult.ok, true);
    // Both writes should have been attempted — approve writes apply + status, reject writes status
    assert.ok(writes.length >= 2);
    assert.ok(writes.includes('approved'));
    assert.ok(writes.includes('rejected'));
});

// ---------------------------------------------------------------------------
// Race condition: gateway error on revokeToken handled gracefully
// ---------------------------------------------------------------------------

test('race condition: revokeToken PERMISSION_DENIED is handled gracefully', async () => {
    loadModules();

    var gateway = {
        saveTokenBatch: async function () { return { ok: true, tokenIds: [] }; },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        revokeToken: async function () {
            throw makePermissionDeniedError();
        },
    };

    global.DSFeaturePlayerUpdatesController.init(gateway);

    // Should not throw — controller wraps in catch
    const result = await global.DSFeaturePlayerUpdatesController.revokeToken('tok_already_used');
    assert.equal(result.ok, false);
    assert.ok(result.error, 'Error message should be present');
});

// ---------------------------------------------------------------------------
// Phase 1B regression: all controller methods present
// ---------------------------------------------------------------------------

test('phase1b regression: DSFeaturePlayerUpdatesController exposes all required methods', () => {
    loadModules();
    const ctrl = global.DSFeaturePlayerUpdatesController;
    assert.ok(ctrl, 'DSFeaturePlayerUpdatesController should be defined');
    assert.equal(typeof ctrl.init, 'function');
    assert.equal(typeof ctrl.approveUpdate, 'function');
    assert.equal(typeof ctrl.rejectUpdate, 'function');
    assert.equal(typeof ctrl.revokeToken, 'function');
    assert.equal(typeof ctrl.setAutoApproveThresholds, 'function');
});

test('phase1b regression: DSFeaturePlayerUpdatesCore exposes all required methods', () => {
    loadModules();
    const core = global.DSFeaturePlayerUpdatesCore;
    assert.ok(core, 'DSFeaturePlayerUpdatesCore should be defined');
    assert.equal(typeof core.validateProposedValues, 'function');
    assert.equal(typeof core.calculateDeltas, 'function');
});


