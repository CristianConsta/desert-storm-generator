// tests/firestore-rules/event-history.rules.test.js
// Firestore security rules tests for event_history, attendance, and player_stats.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/event-history.rules.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator-event-history';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const ALLIANCE_ID = 'alliance_test_1';
const MEMBER_UID = 'uid_member_alice';
const OUTSIDER_UID = 'uid_outsider_bob';
const HISTORY_ID = 'history_doc_1';

let testEnv;

// Node's test runner does not guarantee multiple top-level test.before()
// hooks run in registration order relative to each other's async work —
// a second hook can start before the first one's awaited promise settles.
// Both setup steps are combined into one hook to remove that race.
test.before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(RULES_PATH, 'utf8'),
        },
    });
    // The isAllianceMember() rule function reads games/last_war/alliances/{id}.
    await seedDoc(`games/last_war/alliances/${ALLIANCE_ID}`, {
        gameId: 'last_war',
        createdBy: MEMBER_UID,
        members: { [MEMBER_UID]: true },
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

function anonDb() {
    return testEnv.authenticatedContext('anon_uid_1', {
        firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
}

function unauthDb() {
    return testEnv.unauthenticatedContext().firestore();
}

// ---------------------------------------------------------------------------
// event_history — read
// ---------------------------------------------------------------------------

test('event_history: alliance member can read event_history doc', async () => {
    await seedDoc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}`, {
        eventName: 'Desert Storm #1',
        createdBy: MEMBER_UID,
        finalized: false,
    });

    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc(HISTORY_ID).get()
    );
});

test('event_history: non-alliance authenticated user CANNOT read event_history', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc(HISTORY_ID).get()
    );
});

test('event_history: unauthenticated user CANNOT read event_history', async () => {
    const db = unauthDb();
    await assertFails(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc(HISTORY_ID).get()
    );
});

// ---------------------------------------------------------------------------
// event_history — create
// ---------------------------------------------------------------------------

test('event_history: alliance member can create event_history with matching createdBy', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc('new_history_1').set({
            eventName: 'Canyon Storm #1',
            createdBy: MEMBER_UID,
            finalized: false,
        })
    );
});

test('event_history: alliance member CANNOT create with mismatched createdBy', async () => {
    const db = authedDb(MEMBER_UID);
    await assertFails(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc('bad_history_1').set({
            eventName: 'Canyon Storm #1',
            createdBy: OUTSIDER_UID,  // wrong uid
            finalized: false,
        })
    );
});

test('event_history: non-member CANNOT create event_history', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.collection(`alliances/${ALLIANCE_ID}/event_history`).doc('bad_history_2').set({
            eventName: 'Desert Storm #2',
            createdBy: OUTSIDER_UID,
            finalized: false,
        })
    );
});

// ---------------------------------------------------------------------------
// attendance subcollection — read and write
// ---------------------------------------------------------------------------

test('attendance: alliance member can read attendance doc', async () => {
    await seedDoc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}/attendance/Alice`, {
        playerName: 'Alice',
        status: 'confirmed',
        team: 'teamA',
    });

    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}/attendance/Alice`).get()
    );
});

test('attendance: alliance member can write attendance doc', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}/attendance/Bob`).set({
            playerName: 'Bob',
            status: 'attended',
            team: 'teamB',
        })
    );
});

test('attendance: non-member CANNOT read attendance', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}/attendance/Alice`).get()
    );
});

test('attendance: unauthenticated user CANNOT write attendance', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/event_history/${HISTORY_ID}/attendance/Alice`).set({
            playerName: 'Alice',
            status: 'attended',
        })
    );
});

// ---------------------------------------------------------------------------
// player_stats — read and write
// ---------------------------------------------------------------------------

test('player_stats: alliance member can read player_stats', async () => {
    await seedDoc(`alliances/${ALLIANCE_ID}/player_stats/Alice`, {
        playerName: 'Alice',
        totalEvents: 5,
        attended: 4,
    });

    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/player_stats/Alice`).get()
    );
});

test('player_stats: alliance member can write player_stats', async () => {
    const db = authedDb(MEMBER_UID);
    await assertSucceeds(
        db.doc(`alliances/${ALLIANCE_ID}/player_stats/Charlie`).set({
            playerName: 'Charlie',
            totalEvents: 3,
            attended: 2,
            noShows: 1,
        })
    );
});

test('player_stats: non-member CANNOT read player_stats', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/player_stats/Alice`).get()
    );
});

test('player_stats: unauthenticated user CANNOT read player_stats', async () => {
    const db = unauthDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/player_stats/Alice`).get()
    );
});

test('player_stats: anonymous user CANNOT write player_stats', async () => {
    const db = anonDb();
    await assertFails(
        db.doc(`alliances/${ALLIANCE_ID}/player_stats/Alice`).set({
            playerName: 'Alice',
            totalEvents: 99,
        })
    );
});
