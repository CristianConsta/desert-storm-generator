// tests/firestore-rules/games.rules.test.js
// Firestore security rules tests for games/{gameId} super-admin restriction.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/games.rules.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator-games';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
const REGULAR_UID = 'uid_regular_user';
const GAME_ID = 'last_war';

let testEnv;

test.before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: fs.readFileSync(RULES_PATH, 'utf8'),
        },
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

function unauthDb() {
    return testEnv.unauthenticatedContext().firestore();
}

// ---------------------------------------------------------------------------
// Setup: seed a game doc to use in read/update/delete tests.
// ---------------------------------------------------------------------------

test.before(async () => {
    await seedDoc(`games/${GAME_ID}`, {
        name: 'Last War',
        createdBy: SUPER_ADMIN_UID,
    });
});

// ---------------------------------------------------------------------------
// games/{gameId} — read
// ---------------------------------------------------------------------------

test('games: signed-in user can read game doc', async () => {
    const db = authedDb(REGULAR_UID);
    await assertSucceeds(
        db.collection('games').doc(GAME_ID).get()
    );
});

test('games: super-admin can read game doc', async () => {
    const db = authedDb(SUPER_ADMIN_UID);
    await assertSucceeds(
        db.collection('games').doc(GAME_ID).get()
    );
});

test('games: unauthenticated user CANNOT read game doc', async () => {
    const db = unauthDb();
    await assertFails(
        db.collection('games').doc(GAME_ID).get()
    );
});

// ---------------------------------------------------------------------------
// games/{gameId} — create
// ---------------------------------------------------------------------------

test('games: super-admin can create game doc', async () => {
    const db = authedDb(SUPER_ADMIN_UID);
    await assertSucceeds(
        db.collection('games').doc('new_game_1').set({
            name: 'Canyon Storm',
            createdBy: SUPER_ADMIN_UID,
        })
    );
});

test('games: non-admin authenticated user CANNOT create game doc', async () => {
    const db = authedDb(REGULAR_UID);
    await assertFails(
        db.collection('games').doc('new_game_2').set({
            name: 'Canyon Storm',
            createdBy: REGULAR_UID,
        })
    );
});

test('games: unauthenticated user CANNOT create game doc', async () => {
    const db = unauthDb();
    await assertFails(
        db.collection('games').doc('new_game_3').set({
            name: 'Canyon Storm',
        })
    );
});

// ---------------------------------------------------------------------------
// games/{gameId} — update
// ---------------------------------------------------------------------------

test('games: super-admin can update game doc', async () => {
    const db = authedDb(SUPER_ADMIN_UID);
    await assertSucceeds(
        db.collection('games').doc(GAME_ID).update({
            name: 'Last War Updated',
        })
    );
});

test('games: non-admin authenticated user CANNOT update game doc', async () => {
    const db = authedDb(REGULAR_UID);
    await assertFails(
        db.collection('games').doc(GAME_ID).update({
            name: 'Hacked Name',
        })
    );
});

test('games: unauthenticated user CANNOT update game doc', async () => {
    const db = unauthDb();
    await assertFails(
        db.collection('games').doc(GAME_ID).update({
            name: 'Hacked Name',
        })
    );
});

// ---------------------------------------------------------------------------
// games/{gameId} — delete
// ---------------------------------------------------------------------------

test('games: super-admin can delete game doc', async () => {
    await seedDoc(`games/game_to_delete`, {
        name: 'Temp Game',
        createdBy: SUPER_ADMIN_UID,
    });

    const db = authedDb(SUPER_ADMIN_UID);
    await assertSucceeds(
        db.collection('games').doc('game_to_delete').delete()
    );
});

test('games: non-admin authenticated user CANNOT delete game doc', async () => {
    const db = authedDb(REGULAR_UID);
    await assertFails(
        db.collection('games').doc(GAME_ID).delete()
    );
});

test('games: unauthenticated user CANNOT delete game doc', async () => {
    const db = unauthDb();
    await assertFails(
        db.collection('games').doc(GAME_ID).delete()
    );
});
