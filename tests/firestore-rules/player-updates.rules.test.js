// tests/firestore-rules/player-updates.rules.test.js
// Firestore security rules tests for update_tokens and pending_updates.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/player-updates.rules.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator-pu';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const ALLIANCE_ID = 'alliance_pu_test_1';
const MEMBER_UID = 'uid_member_pu_leader';
const OUTSIDER_UID = 'uid_outsider_pu';
const PERSONAL_UID = 'uid_personal_pu_owner';
const TOKEN_ID = 'token_abc_1';
const PERSONAL_TOKEN_ID = 'personal_token_abc_1';
const UPDATE_ID = 'update_pu_1';

let testEnv;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Node's test runner does not guarantee multiple top-level test.before()
// hooks run in registration order relative to each other's async work —
// a later hook can start before an earlier one's awaited promise settles.
// All setup steps (env init + the three seed blocks below) are combined
// into one hook to remove that race.
test.before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(RULES_PATH, 'utf8'),
        },
    });

    // Seed the alliance doc with MEMBER_UID as a member.
    await seedDoc(`games/last_war/alliances/${ALLIANCE_ID}`, {
        gameId: 'last_war',
        createdBy: MEMBER_UID,
        members: { [MEMBER_UID]: true },
    });

    // Seed update_tokens docs used by the "read" test block below.
    // submissionCount/maxSubmissions are included on every token doc because
    // production always writes them (see firebase-module.js createUpdateToken());
    // tokenHasRemainingSubmissions() throws (rather than defaulting) when a
    // doc is missing them entirely, since Firestore rules map/field access
    // errors on an absent key instead of returning null.
    // Seed a valid (unexpired, unused) token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`, {
        token: 'valid_token_1234',
        playerName: 'Alice',
        playerKey: 'alice_key',
        gameId: 'last_war',
        used: false,
        expiresAt: futureTimestamp(),
        submissionCount: 0,
        maxSubmissions: 3,
    });

    // Seed an expired token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`, {
        token: 'expired_token_1234',
        playerName: 'Bob',
        playerKey: 'bob_key',
        gameId: 'last_war',
        used: false,
        expiresAt: pastTimestamp(),
        submissionCount: 0,
        maxSubmissions: 3,
    });

    // Seed an already-used token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`, {
        token: 'used_token_1234',
        playerName: 'Charlie',
        playerKey: 'charlie_key',
        gameId: 'last_war',
        used: true,
        expiresAt: futureTimestamp(),
        submissionCount: 1,
        maxSubmissions: 3,
    });

    // Seed a token for scope-violation tests (used=false, but wrong playerName/gameId attempts)
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_scope_test`, {
        token: 'scope_test_token',
        playerName: 'Dave',
        playerKey: 'dave_key',
        gameId: 'last_war',
        used: false,
        expiresAt: futureTimestamp(),
        submissionCount: 0,
        maxSubmissions: 3,
    });

    // Seed a personal update token for PERSONAL_UID
    await seedDoc(`users/${PERSONAL_UID}/update_tokens/${PERSONAL_TOKEN_ID}`, {
        contextType: 'personal',
        ownerUid: PERSONAL_UID,
        playerName: 'Eve',
        playerKey: 'eve_key',
        gameId: 'last_war',
        used: false,
        expiresAt: futureTimestamp(),
        submissionCount: 0,
        maxSubmissions: 3,
    });

    // Seed a used personal token for negative test
    await seedDoc(`users/${PERSONAL_UID}/update_tokens/personal_token_used`, {
        contextType: 'personal',
        ownerUid: PERSONAL_UID,
        playerName: 'Eve',
        playerKey: 'eve_key',
        gameId: 'last_war',
        used: true,
        expiresAt: futureTimestamp(),
        submissionCount: 1,
        maxSubmissions: 3,
    });

    // Seed pending_updates doc used by the "read/update by alliance member" test block below.
    await seedDoc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`, {
        tokenId: TOKEN_ID,
        playerName: 'Alice',
        playerKey: 'alice_key',
        gameId: 'last_war',
        status: 'pending',
        proposedValues: { power: 3000, thp: 30000, troops: 'Tank' },
    });
});

test.after(async () => {
    if (testEnv) await testEnv.cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedDoc(docPath, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(docPath).set(data);
    });
}

function authedDb(uid) {
    return testEnv.authenticatedContext(uid).firestore();
}

function anonDb(anonUid) {
    return testEnv.authenticatedContext(anonUid || 'anon_uid_pu_1', {
        firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
}

function unauthDb() {
    return testEnv.unauthenticatedContext().firestore();
}

// Helper: get a future timestamp (server-side Firestore Timestamp-like object)
function futureTimestamp() {
    // Use a plain JS Date far in the future — rules compare against request.time
    return new Date(Date.now() + 48 * 60 * 60 * 1000);
}

function pastTimestamp() {
    return new Date(Date.now() - 48 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// update_tokens — create
// ---------------------------------------------------------------------------

test('update_tokens: alliance member can create update_tokens', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/${TOKEN_ID}`).set({
            token: 'abcdef1234567890abcdef1234567890',
            allianceId: ALLIANCE_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            createdBy: MEMBER_UID,
            expiresAt: futureTimestamp(),
            used: false,
            usedAt: null,
            usedByAnonUid: null,
            submissionCount: 0,
            maxSubmissions: 3,
        })
    );
});

test('update_tokens: non-member CANNOT create update_tokens', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_outsider`).set({
            token: 'aaaa',
            used: false,
            expiresAt: futureTimestamp(),
        })
    );
});

test('update_tokens: anonymous user CANNOT create update_tokens', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_anon`).set({
            token: 'anon_token',
            used: false,
            expiresAt: futureTimestamp(),
        })
    );
});

test('update_tokens: alliance member CANNOT create update_tokens without playerKey', async () => {
    const db = authedDb(MEMBER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_missing_player_key`).set({
            token: 'missing_key_token',
            allianceId: ALLIANCE_ID,
            playerName: 'Alice',
            gameId: 'last_war',
            createdBy: MEMBER_UID,
            expiresAt: futureTimestamp(),
            used: false,
        })
    );
});

// ---------------------------------------------------------------------------
// update_tokens — read (anonymous access for valid tokens)
// ---------------------------------------------------------------------------

test('update_tokens: anonymous user can read unexpired, unused token', async () => {
    const db = anonDb();
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`).get()
    );
});

test('update_tokens: anonymous user CANNOT read expired token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`).get()
    );
});

test('update_tokens: anonymous user CANNOT read already-used token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`).get()
    );
});

test('update_tokens: unauthenticated user CANNOT read any token', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_valid`).get()
    );
});

test('update_tokens: alliance member can read any token', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_expired`).get()
    );
});

// ---------------------------------------------------------------------------
// update_tokens — update (anonymous can only mark as used)
// ---------------------------------------------------------------------------

test('update_tokens: anonymous user can update token to mark as used (only used, usedAt, usedByAnonUid)', async () => {
    // Seed a fresh valid token with maxSubmissions: 1, so this single
    // submission both increments submissionCount and reaches the limit —
    // matching how js/player-update/player-update.js writes tokenUpdate
    // (submissionCount/lastSubmittedAt/lastSubmittedByAnonUid always; used/usedAt
    // only once the limit is reached).
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_to_use`, {
        token: 'token_to_use_value',
        playerName: 'Diana',
        playerKey: 'diana_key',
        used: false,
        expiresAt: futureTimestamp(),
        usedAt: null,
        usedByAnonUid: null,
        submissionCount: 0,
        maxSubmissions: 1,
    });

    const db = anonDb('anon_uid_uses_token');
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_to_use`).update({
            submissionCount: 1,
            lastSubmittedAt: new Date(),
            lastSubmittedByAnonUid: 'anon_uid_uses_token',
            usedByAnonUid: 'anon_uid_uses_token',
            used: true,
            usedAt: new Date(),
        })
    );
});

test('update_tokens: anonymous user CANNOT update token playerName field', async () => {
    // Seed another valid token
    await seedDoc(`alliances/${ALLIANCE_ID}/update_tokens/token_tamper`, {
        token: 'token_tamper_value',
        playerName: 'Eve',
        playerKey: 'eve_key',
        used: false,
        expiresAt: futureTimestamp(),
        usedAt: null,
        usedByAnonUid: null,
        submissionCount: 0,
        maxSubmissions: 3,
    });

    const db = anonDb('anon_uid_tampers');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_tamper`).update({
            submissionCount: 1,
            used: true,
            usedAt: new Date(),
            usedByAnonUid: 'anon_uid_tampers',
            playerName: 'Hacked',  // not allowed
        })
    );
});

test('update_tokens: anonymous user CANNOT update already-used token', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/update_tokens/token_used`).update({
            used: true,
            usedAt: new Date(),
            usedByAnonUid: 'anon_uid_pu_1',
        })
    );
});

// ---------------------------------------------------------------------------
// pending_updates — create (anonymous only, with token cross-reference)
// Alliance path
// ---------------------------------------------------------------------------

test('pending_updates: anonymous user can create pending_updates with valid token cross-reference', async () => {
    // TOKEN_ID was created above with playerName: 'Alice', gameId: 'last_war', used: false
    const db = anonDb('anon_uid_creates_update');
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/${UPDATE_ID}`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create with wrong playerName (scope violation)', async () => {
    const db = anonDb('anon_uid_scope_test_1');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_wrong_name`).set({
            tokenId: 'token_scope_test',
            playerName: 'NotDave',  // token has playerName: 'Dave'
            playerKey: 'dave_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create with wrong gameId (scope violation)', async () => {
    const db = anonDb('anon_uid_scope_test_2');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_wrong_game`).set({
            tokenId: 'token_scope_test',
            playerName: 'Dave',
            playerKey: 'dave_key',
            gameId: 'canyon_storm',  // token has gameId: 'last_war'
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create with used token', async () => {
    const db = anonDb('anon_uid_scope_test_3');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_used_token`).set({
            tokenId: 'token_used',
            playerName: 'Charlie',
            playerKey: 'charlie_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create without tokenId', async () => {
    const db = anonDb('anon_uid_scope_test_4');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_no_token`).set({
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create without playerKey', async () => {
    const db = anonDb('anon_uid_scope_test_no_key');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_no_player_key`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create without playerName', async () => {
    const db = anonDb('anon_uid_scope_test_5');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_no_player`).set({
            tokenId: TOKEN_ID,
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create with status != pending', async () => {
    const db = anonDb('anon_uid_scope_test_6');
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_status`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'approved',  // must be 'pending'
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with power > 9999', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_power`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            status: 'pending',
            proposedValues: {
                power: 10000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with power < 0', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_neg_power`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            status: 'pending',
            proposedValues: {
                power: -1,
                thp: 50000,
                troops: 'Missile',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with thp > 99999', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_thp`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 100000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates: anonymous user CANNOT create pending_updates with invalid troops value', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_bad_troops`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Cavalry',  // not in ['Tank', 'Aero', 'Missile']
            },
        })
    );
});

test('pending_updates: alliance member CANNOT create pending_updates (not anonymous)', async () => {
    const db = authedDb(MEMBER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_by_member`).set({
            tokenId: TOKEN_ID,
            playerName: 'Alice',
            playerKey: 'alice_key',
            gameId: 'last_war',
            status: 'pending',
            proposedValues: {
                power: 5000,
                thp: 50000,
                troops: 'Tank',
            },
        })
    );
});

// ---------------------------------------------------------------------------
// pending_updates — create (personal path)
// ---------------------------------------------------------------------------

test('pending_updates (personal): anonymous user can create with valid token cross-reference', async () => {
    // PERSONAL_TOKEN_ID seeded above with playerName: 'Eve', gameId: 'last_war', used: false
    const db = anonDb('anon_uid_personal_create');
    await assertSucceeds(
        db.doc(`users/${PERSONAL_UID}/pending_updates/personal_update_1`).set({
            ownerUid: PERSONAL_UID,
            tokenId: PERSONAL_TOKEN_ID,
            playerName: 'Eve',
            playerKey: 'eve_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 3000,
                thp: 30000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates (personal): anonymous user CANNOT create with wrong playerName', async () => {
    const db = anonDb('anon_uid_personal_wrong_name');
    await assertFails(
        db.doc(`users/${PERSONAL_UID}/pending_updates/personal_update_wrong_name`).set({
            ownerUid: PERSONAL_UID,
            tokenId: PERSONAL_TOKEN_ID,
            playerName: 'NotEve',  // token has playerName: 'Eve'
            playerKey: 'eve_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 3000,
                thp: 30000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates (personal): anonymous user CANNOT create with wrong gameId', async () => {
    const db = anonDb('anon_uid_personal_wrong_game');
    await assertFails(
        db.doc(`users/${PERSONAL_UID}/pending_updates/personal_update_wrong_game`).set({
            ownerUid: PERSONAL_UID,
            tokenId: PERSONAL_TOKEN_ID,
            playerName: 'Eve',
            playerKey: 'eve_key',
            gameId: 'canyon_storm',  // token has gameId: 'last_war'
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 3000,
                thp: 30000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates (personal): anonymous user CANNOT create with used token', async () => {
    const db = anonDb('anon_uid_personal_used_token');
    await assertFails(
        db.doc(`users/${PERSONAL_UID}/pending_updates/personal_update_used_token`).set({
            ownerUid: PERSONAL_UID,
            tokenId: 'personal_token_used',
            playerName: 'Eve',
            playerKey: 'eve_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 3000,
                thp: 30000,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates (personal): anonymous user CANNOT create with wrong ownerUid', async () => {
    const db = anonDb('anon_uid_personal_wrong_owner');
    await assertFails(
        db.doc(`users/${PERSONAL_UID}/pending_updates/personal_update_wrong_owner`).set({
            ownerUid: 'some_other_uid',  // must match path uid
            tokenId: PERSONAL_TOKEN_ID,
            playerName: 'Eve',
            playerKey: 'eve_key',
            gameId: 'last_war',
            submittedAt: new Date(),
            status: 'pending',
            proposedValues: {
                power: 3000,
                thp: 30000,
                troops: 'Aero',
            },
        })
    );
});

// ---------------------------------------------------------------------------
// pending_updates — read and update (alliance member)
// ---------------------------------------------------------------------------

test('pending_updates: alliance member can read pending_updates', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: alliance member can update pending_updates (approve)', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).update({
            status: 'approved',
            reviewedBy: MEMBER_UID,
            reviewedAt: new Date(),
        })
    );
});

test('pending_updates: alliance member can update reviewedProposedValues during review', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).update({
            status: 'approved',
            reviewedBy: MEMBER_UID,
            reviewedAt: new Date(),
            reviewedProposedValues: {
                power: 3100,
                thp: 30100,
                troops: 'Aero',
            },
        })
    );
});

test('pending_updates: non-member CANNOT read pending_updates', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: anonymous user CANNOT read pending_updates', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});

test('pending_updates: unauthenticated user CANNOT read pending_updates', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/pending_updates/update_seeded`).get()
    );
});
