// tests/firestore-rules/alliance-membership.rules.test.js
// Firestore security rules tests for the games/{gameId}/alliances/{allianceId}
// self-join update branch (the "invitees can self-join" path used by
// acceptInvitation()).
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/alliance-membership.rules.test.js"

const test = require('node:test');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const GAME_ID = 'last_war';
const ALLIANCE_ID = 'alliance_membership_test';
const EXISTING_MEMBER_UID = 'uid_existing_member';
const SELF_JOINER_UID = 'uid_self_joiner';
const ATTACKER_UID = 'uid_attacker';

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

function allianceDoc(db) {
    return db.collection('games').doc(GAME_ID).collection('alliances').doc(ALLIANCE_ID);
}

async function resetAllianceDoc() {
    await seedDoc(`games/${GAME_ID}/alliances/${ALLIANCE_ID}`, {
        name: 'Test Alliance',
        createdBy: EXISTING_MEMBER_UID,
        gameId: GAME_ID,
        members: {
            [EXISTING_MEMBER_UID]: { email: 'existing@example.com', role: 'owner' },
        },
    });
}

test.beforeEach(async () => {
    await resetAllianceDoc();
});

// ---------------------------------------------------------------------------
// Legitimate self-join: adding only the caller's own member entry
// ---------------------------------------------------------------------------

test('alliance self-join: uninvited-but-narrow write adding only the caller\'s own member entry succeeds', async () => {
    const db = authedDb(SELF_JOINER_UID);
    await assertSucceeds(
        allianceDoc(db).update({
            [`members.${SELF_JOINER_UID}`]: { email: 'joiner@example.com', role: 'member' },
        })
    );
});

// ---------------------------------------------------------------------------
// Attack: full members-map replacement that evicts the existing member
// ---------------------------------------------------------------------------

test('alliance self-join: replacing the entire members map (evicting the existing member) is rejected', async () => {
    const db = authedDb(ATTACKER_UID);
    await assertFails(
        allianceDoc(db).update({
            members: {
                [ATTACKER_UID]: { email: 'attacker@example.com', role: 'member' },
            },
        })
    );
});

// ---------------------------------------------------------------------------
// Attack: adding self while also modifying another member's entry
// ---------------------------------------------------------------------------

test('alliance self-join: adding self while tampering with another member\'s entry is rejected', async () => {
    const db = authedDb(ATTACKER_UID);
    await assertFails(
        allianceDoc(db).update({
            [`members.${ATTACKER_UID}`]: { email: 'attacker@example.com', role: 'member' },
            [`members.${EXISTING_MEMBER_UID}`]: { email: 'hijacked@example.com', role: 'member' },
        })
    );
});

// ---------------------------------------------------------------------------
// Attack: adding self while touching a top-level field outside `members`
// ---------------------------------------------------------------------------

test('alliance self-join: adding self while changing another top-level field (e.g. name) is rejected', async () => {
    const db = authedDb(ATTACKER_UID);
    await assertFails(
        allianceDoc(db).update({
            [`members.${ATTACKER_UID}`]: { email: 'attacker@example.com', role: 'member' },
            name: 'Renamed By Attacker',
        })
    );
});

// ---------------------------------------------------------------------------
// Existing member/actor path is unaffected by the self-join narrowing
// ---------------------------------------------------------------------------

test('alliance self-join: an existing alliance actor can still update arbitrary fields (isAllianceActor branch, unaffected)', async () => {
    const db = authedDb(EXISTING_MEMBER_UID);
    await assertSucceeds(
        allianceDoc(db).update({
            name: 'Renamed By Owner',
        })
    );
});
