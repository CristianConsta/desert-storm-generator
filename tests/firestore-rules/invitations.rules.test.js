// tests/firestore-rules/invitations.rules.test.js
// Reproduces the exact query shapes firebase-module.js issues for alliance invitations,
// which the existing rules tests never covered (they only test .doc(id).get(), never
// .where()/.collectionGroup() list queries — a different rule-evaluation path entirely).
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/invitations.rules.test.js"

const test = require('node:test');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

const GAME_ID = 'last_war';
const ALLIANCE_ID = 'alliance1';
const INVITER_UID = 'uid_inviter';
const INVITER_EMAIL = 'inviter@example.com';
const INVITEE_EMAIL = 'invitee@example.com';

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

function authedDb(uid, email) {
    return testEnv.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

async function seedAllianceAndInvitation() {
    await seedDoc(`games/${GAME_ID}/alliances/${ALLIANCE_ID}`, {
        createdBy: INVITER_UID,
        members: { [INVITER_UID]: true },
    });
    await seedDoc(`games/${GAME_ID}/alliances/${ALLIANCE_ID}/invitations/inv1`, {
        gameId: GAME_ID,
        allianceId: ALLIANCE_ID,
        invitedBy: INVITER_UID,
        invitedEmail: INVITEE_EMAIL,
        status: 'pending',
    });
}

test('sendInvitation()-style duplicate-check query succeeds for an alliance member (catches duplicates from any inviter)', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb(INVITER_UID, INVITER_EMAIL);

    const query = db
        .collection(`games/${GAME_ID}/alliances/${ALLIANCE_ID}/invitations`)
        .where('invitedEmail', '==', INVITEE_EMAIL)
        .where('status', '==', 'pending')
        .get();

    await assertSucceeds(query);
});

test('the same duplicate-check query is denied for a non-alliance-member', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb('uid_outsider', 'outsider@example.com');

    const query = db
        .collection(`games/${GAME_ID}/alliances/${ALLIANCE_ID}/invitations`)
        .where('invitedEmail', '==', INVITEE_EMAIL)
        .where('status', '==', 'pending')
        .get();

    await assertFails(query);
});

test('checkInvitations()-style collectionGroup query (sent invites) succeeds for the inviter', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb(INVITER_UID, INVITER_EMAIL);

    const query = db.collectionGroup('invitations')
        .where('gameId', '==', GAME_ID)
        .where('invitedBy', '==', INVITER_UID)
        .get();

    await assertSucceeds(query);
});

test('checkInvitations()-style collectionGroup query (received invites) succeeds for the invitee', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb('uid_invitee', INVITEE_EMAIL);

    const query = db.collectionGroup('invitations')
        .where('gameId', '==', GAME_ID)
        .where('invitedEmail', '==', INVITEE_EMAIL)
        .where('status', '==', 'pending')
        .get();

    await assertSucceeds(query);
});

test('collectionGroup query is denied when querying for someone else\'s invitedBy', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb('uid_outsider', 'outsider@example.com');

    const query = db.collectionGroup('invitations')
        .where('gameId', '==', GAME_ID)
        .where('invitedBy', '==', INVITER_UID) // trying to read someone else's sent invites
        .get();

    await assertFails(query);
});

test('invitee can read their own invitation by document id (regression: lower() was called as a bare function, which does not exist in Firestore rules — always errored)', async () => {
    await seedAllianceAndInvitation();
    const db = authedDb('uid_invitee', INVITEE_EMAIL);
    await assertSucceeds(
        db.doc(`games/${GAME_ID}/alliances/${ALLIANCE_ID}/invitations/inv1`).get()
    );
});
