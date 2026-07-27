const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'demo-desert-storm-generator-legacy';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

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
  if (testEnv) {
    await testEnv.cleanup();
  }
});

async function seedDoc(docPath, data) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc(docPath).set(data);
  });
}

function authedDb(uid, email) {
  return testEnv.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

test('users/{uid}/games/{gameId} is readable/writable only by owner', async () => {
  const alice = authedDb('alice', 'alice@example.com');
  const bob = authedDb('bob', 'bob@example.com');

  await assertSucceeds(
    alice.doc('users/alice/games/last_war').set({ playerSource: 'personal' })
  );
  await assertSucceeds(
    alice.doc('users/alice/games/last_war').get()
  );
  await assertFails(
    bob.doc('users/alice/games/last_war').get()
  );
  await assertFails(
    bob.doc('users/alice/games/last_war').set({ playerSource: 'alliance' })
  );
});

test('alliance doc is readable only by members/creator', async () => {
  await seedDoc('games/last_war/alliances/a1', {
    gameId: 'last_war',
    createdBy: 'owner',
    name: 'Alpha',
    members: {
      owner: { email: 'owner@example.com' },
      member1: { email: 'member1@example.com' },
    },
  });

  const member = authedDb('member1', 'member1@example.com');
  const outsider = authedDb('outsider', 'outsider@example.com');

  await assertSucceeds(
    member.doc('games/last_war/alliances/a1').get()
  );
  await assertFails(
    outsider.doc('games/last_war/alliances/a1').get()
  );
});

test('alliance create/update follows membership and game scope checks', async () => {
  const owner = authedDb('owner', 'owner@example.com');
  const invitee = authedDb('member2', 'member2@example.com');
  const outsider = authedDb('outsider', 'outsider@example.com');

  await assertSucceeds(
    owner.doc('games/last_war/alliances/new-alliance').set({
      gameId: 'last_war',
      name: 'New Alliance',
      createdBy: 'owner',
      members: {
        owner: { email: 'owner@example.com', role: 'member' },
      },
      playerDatabase: {},
      metadata: { totalPlayers: 0 },
    })
  );

  await assertFails(
    owner.doc('games/last_war/alliances/invalid-alliance').set({
      gameId: 'last_war',
      name: 'Invalid Alliance',
      createdBy: 'other-user',
      members: {
        owner: { email: 'owner@example.com', role: 'member' },
      },
      playerDatabase: {},
      metadata: { totalPlayers: 0 },
    })
  );

  await assertSucceeds(
    owner.doc('games/last_war/alliances/new-alliance').set({
      gameId: 'last_war',
      playerDatabase: {
        Alpha: { power: 10, troops: 'Tank' },
      },
    }, { merge: true })
  );

  await assertSucceeds(
    invitee.doc('games/last_war/alliances/new-alliance').set({
      gameId: 'last_war',
      members: {
        owner: { email: 'owner@example.com', role: 'member' },
        member2: { email: 'member2@example.com', role: 'member' },
      },
    }, { merge: true })
  );

  await assertFails(
    outsider.doc('games/last_war/alliances/new-alliance').set({
      gameId: 'last_war',
      name: 'Blocked update',
    }, { merge: true })
  );
});

test('invitation create requires alliance actor; read/update limited to inviter or invitee', async () => {
  await seedDoc('games/last_war/alliances/a1', {
    gameId: 'last_war',
    createdBy: 'owner',
    name: 'Alpha',
    members: {
      owner: { email: 'owner@example.com', role: 'member' },
    },
  });

  const inviter = authedDb('owner', 'owner@example.com');
  const invitee = authedDb('member2', 'member2@example.com');
  const outsider = authedDb('outsider', 'outsider@example.com');

  await assertSucceeds(
    inviter.doc('games/last_war/invitations/inv1').set({
      gameId: 'last_war',
      allianceId: 'a1',
      invitedBy: 'owner',
      invitedEmail: 'member2@example.com',
      status: 'pending',
    })
  );

  await assertSucceeds(
    inviter.doc('games/last_war/invitations/inv1').get()
  );
  await assertSucceeds(
    invitee.doc('games/last_war/invitations/inv1').get()
  );
  await assertFails(
    outsider.doc('games/last_war/invitations/inv1').get()
  );

  await assertSucceeds(
    invitee.doc('games/last_war/invitations/inv1').update({
      status: 'accepted',
      gameId: 'last_war',
    })
  );

  await assertFails(
    outsider.doc('games/last_war/invitations/inv1').update({
      status: 'revoked',
      gameId: 'last_war',
    })
  );

  await assertFails(
    outsider.doc('games/last_war/invitations/inv2').set({
      gameId: 'last_war',
      allianceId: 'a1',
      invitedBy: 'outsider',
      invitedEmail: 'target@example.com',
      status: 'pending',
    })
  );
});

test('only configured super admin can write game metadata docs', async () => {
  const superAdminUid = '2z2BdO8aVsUovqQWWL9WCRMdV933';
  const superAdmin = authedDb(superAdminUid, 'constantinescu.cristian@gmail.com');
  const normalUser = authedDb('alice', 'alice@example.com');

  await assertSucceeds(
    superAdmin.doc('games/last_war').set({
      name: 'Last War: Survival',
      logo: '',
      company: '',
    })
  );

  await assertFails(
    normalUser.doc('games/last_war').set({
      name: 'Blocked',
      logo: '',
      company: '',
    })
  );
});

test('legacy root alliances and invitations are read-only for authenticated users', async () => {
  await seedDoc('alliances/legacy-a1', { name: 'Legacy A1' });
  await seedDoc('invitations/legacy-i1', { status: 'pending' });
  const user = authedDb('alice', 'alice@example.com');

  await assertSucceeds(user.doc('alliances/legacy-a1').get());
  await assertSucceeds(user.doc('invitations/legacy-i1').get());
  await assertFails(user.doc('alliances/legacy-a1').set({ name: 'Blocked legacy write' }));
  await assertFails(user.doc('invitations/legacy-i1').set({ status: 'blocked' }));

  // Sanity: game-scoped paths remain valid for signed-in users.
  await assertSucceeds(user.doc('games/last_war').get());
  assert.ok(true);
});
