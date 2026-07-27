// tests/firestore-rules/game-events.rules.test.js
// Firestore security rules tests for games/{gameId}/events write authorization.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/game-events.rules.test.js"

const test = require('node:test');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator-game-events';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const GAME_ID = 'last_war';
const ALLIANCE_MEMBER_UID = 'uid_alliance_member';
const OUTSIDER_UID = 'uid_outsider';
const EVENT_ID = 'desert_storm';

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

async function seedDoc(docPath, data) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().doc(docPath).set(data);
    });
}

function authedDb(uid) {
    return testEnv.authenticatedContext(uid).firestore();
}

test.before(async () => {
    await seedDoc(`games/${GAME_ID}/user_state/${ALLIANCE_MEMBER_UID}`, {
        allianceId: 'alliance_1',
        playerSource: 'alliance',
    });
    await seedDoc(`games/${GAME_ID}/alliances/alliance_1`, {
        name: 'Test Alliance',
        members: { [ALLIANCE_MEMBER_UID]: true },
    });
    await seedDoc(`games/${GAME_ID}/events/${EVENT_ID}`, {
        name: 'Desert Storm',
        buildingConfig: [],
    });
});

test('game events: alliance member CAN write to shared event definitions', async () => {
    const db = authedDb(ALLIANCE_MEMBER_UID);
    await assertSucceeds(
        db.collection('games').doc(GAME_ID).collection('events').doc(EVENT_ID).set({
            name: 'Desert Storm Updated',
            buildingConfig: [],
        })
    );
});

test('game events: signed-in user with NO alliance membership in this game CANNOT write', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertFails(
        db.collection('games').doc(GAME_ID).collection('events').doc(EVENT_ID).set({
            name: 'Hacked Event',
            buildingConfig: [],
        })
    );
});

test('game events: any signed-in user can still read shared event definitions', async () => {
    const db = authedDb(OUTSIDER_UID);
    await assertSucceeds(
        db.collection('games').doc(GAME_ID).collection('events').doc(EVENT_ID).get()
    );
});
