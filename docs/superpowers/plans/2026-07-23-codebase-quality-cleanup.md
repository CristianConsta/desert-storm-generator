# Codebase Quality Cleanup (Tier 1 + Tier 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified dead code, fix a CI lint blind spot, consolidate duplicated ID-normalization logic, collapse one confirmed 3-level indirection chain, and tighten a cross-tenant Firestore write hole — the concrete Tier 1 (security/correctness) + Tier 2 ("quick-and-dirty" cleanup) items from the 2026-07-23 codebase audit (`.planning/codebase/CONCERNS.md`).

**Architecture:** No architectural change. This plan only removes duplication and dead code within the existing IIFE/`window`-global module system; it does not introduce new patterns, frameworks, or abstractions.

**Tech Stack:** Vanilla JS (IIFE modules), `node:test` + `node:assert/strict`, ESLint flat config, Firestore Security Rules + `@firebase/rules-unit-testing` (emulator).

## Global Constraints

- Follow the IIFE module pattern exactly (`(function initX(global) { ...; global.DSX = {...}; })(window);`) — do not deviate (CLAUDE.md "Module Pattern").
- No TypeScript, no new npm packages for browser code, no new bundler.
- Every bug fix must include a regression test that fails without the fix (CLAUDE.md rule #5).
- Run `npm test` after every task; do not proceed to the next task if it fails.
- **Task 5 (Firestore rules) touches production security rules.** Do not run `firebase deploy --only firestore:rules` at the end of Task 5 — stop after the emulator test passes and confirm with the user before any live deploy.
- Commit after each task (not after each step) using the repo's existing commit style (`fix:`/`refactor:`/`docs:` prefix).

---

### Task 1: Remove orphaned player-updates token-generation dead code

**Context:** `openTokenGenerationModal()` (the token-generation entry point) has been deliberately stubbed/blocked since invites moved to the Players Management "shared invite" flow (`createPersonalSharedUpdateInvite`/`createAllianceSharedUpdateInvite` in `app.js`, which use a completely different `?shared=` URL scheme). Verified via repo-wide grep: `renderTokenModal`, `buildTokenDoc`, `buildUpdateLink`, `generateToken`, and `formatLinksForMessaging` have zero production callers — every reference outside their own module is from tests. The `?token=` *consumption* path in `js/player-update/player-update.js` (for previously-generated links) is untouched and stays.

**Files:**
- Modify: `js/features/player-updates/player-updates-view.js:81-129` (delete `renderTokenModal` + its comment), `:619` (delete export)
- Modify: `js/features/player-updates/player-updates-controller.js:73-86` (delete `openTokenGenerationModal` + its comment), `:588` (delete export)
- Modify: `js/features/player-updates/player-updates-core.js:6-49` (delete `generateToken`, `buildTokenDoc`, `buildUpdateLink`), `:173-175` (delete their 3 export lines)
- Modify: `tests/player-updates.integration.test.js:69-99` (delete both `openTokenGenerationModal` tests + banner), `:406-417` (delete `buildTokenDoc` test)
- Modify: `tests/player-updates.race.integration.test.js:104-142` (delete the concurrent-`openTokenGenerationModal` test + banner), `:226` (delete assertion), `:237-240` (delete 4 assertions, keep `validateProposedValues`/`calculateDeltas`)
- Modify: `tests/player-updates.core.test.js:18-84` (delete `generateToken` + `buildUpdateLink` test blocks), `:221-272` (delete `formatLinksForMessaging` test block)
- Modify: `CLAUDE.md` — Section 10 "Player Updates" (Codebase Feature Map) — remove the `openTokenGenerationModal(playerNames)` reference so it no longer documents a blocked path as live.

- [ ] **Step 1: Delete `renderTokenModal` from the view module**

In `js/features/player-updates/player-updates-view.js`, delete lines 81-129 (the `// Render token generation modal...` comment through the closing `}` of `renderTokenModal`), so `_cloneProposedValues` (ends line 79) is immediately followed by `renderReviewPanel` (currently starting line 131).

Then in the same file, find the export object near the end (`global.DSFeaturePlayerUpdatesView = { ... }`) and delete the line:
```js
        renderTokenModal: renderTokenModal,
```

- [ ] **Step 2: Delete `openTokenGenerationModal` from the controller module**

In `js/features/player-updates/player-updates-controller.js`, delete lines 73-86:
```js
    // Deprecated on purpose:
    // Invite generation is allowed only from Players Management invite button flow.
    function openTokenGenerationModal() {
        var message = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_invite_from_players_page_only')
            : 'Player update invites can only be generated from Players Management.';
        if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('[PlayerUpdatesController] Blocked legacy invite generation path. Use Players Management invite button.');
        }
        if (typeof global.alert === 'function') {
            global.alert(message);
        }
        return { ok: false, error: 'invite_generation_restricted' };
    }
```

Then in the same file's `global.DSFeaturePlayerUpdatesController = { ... }` export block (around line 585), delete the line:
```js
        openTokenGenerationModal: openTokenGenerationModal,
```

- [ ] **Step 3: Delete `generateToken`, `buildTokenDoc`, `buildUpdateLink` from the core module**

In `js/features/player-updates/player-updates-core.js`, delete lines 6-49 in full:
```js
    function generateToken() {
        var bytes = new Uint8Array(TOKEN_HEX_LENGTH / 2);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function buildTokenDoc(playerName, allianceId, gameId, createdByUid, options) {
        var opts = options || {};
        var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : DEFAULT_EXPIRY_HOURS;
        var now = new Date();
        var expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

        return {
            token: generateToken(),
            playerName: playerName || null,
            allianceId: allianceId || null,
            gameId: gameId || null,
            createdByUid: createdByUid || null,
            createdAt: now,
            expiresAt: expiresAt,
            used: false,
            usedAt: null,
            usedByAnonUid: null,
            linkedEventId: opts.linkedEventId || null,
            currentSnapshot: opts.currentSnapshot || {},
        };
    }

    function buildUpdateLink(token, allianceId, lang, gameId) {
        var origin = global.location && global.location.origin ? global.location.origin : '';
        var link = (
            origin +
            '/player-update.html' +
            '?token=' + encodeURIComponent(token) +
            '&alliance=' + encodeURIComponent(allianceId) +
            '&lang=' + encodeURIComponent(lang)
        );
        if (gameId) {
            link += '&gid=' + encodeURIComponent(gameId);
        }
        return link;
    }

```

Leave `VALID_TROOPS`, `DEFAULT_EXPIRY_HOURS`, `TOKEN_HEX_LENGTH` constants in place only if still referenced elsewhere in the file — check with:
```bash
grep -n "DEFAULT_EXPIRY_HOURS\|TOKEN_HEX_LENGTH" js/features/player-updates/player-updates-core.js
```
If either constant now has zero remaining references after the deletion, delete its declaration line too (they were only used by the deleted functions).

Then in the same file's `global.DSFeaturePlayerUpdatesCore = { ... }` export block (around line 173), delete these 3 lines:
```js
        generateToken: generateToken,
        buildTokenDoc: buildTokenDoc,
        buildUpdateLink: buildUpdateLink,
```

- [ ] **Step 4: Delete the now-orphaned tests**

In `tests/player-updates.integration.test.js`, delete lines 69-99:
```js
// ---------------------------------------------------------------------------
// openTokenGenerationModal (legacy path) is intentionally blocked
// ---------------------------------------------------------------------------

test('openTokenGenerationModal: blocks legacy path and does not call saveTokenBatch', async () => {
    loadModules();

    var batchCalled = false;
    var alertMessage = '';
    global.alert = function (msg) { alertMessage = String(msg || ''); };

    var gateway = makeMockGateway({
        saveTokenBatch: async function () { batchCalled = true; return { ok: true, tokenIds: [] }; },
    });

    global.DSFeaturePlayerUpdatesController.init(gateway);
    const result = global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice', 'Bob']);
    await new Promise(function (resolve) { setTimeout(resolve, 20); });

    assert.equal(result && result.ok, false);
    assert.equal(result && result.error, 'invite_generation_restricted');
    assert.equal(batchCalled, false, 'saveTokenBatch must not be called from legacy path');
    assert.ok(alertMessage.includes('Players Management'), 'alert should route user to Players Management flow');
});

test('openTokenGenerationModal: remains blocked even if controller is not initialized', () => {
    loadModules();
    const result = global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice']);
    assert.equal(result && result.ok, false);
    assert.equal(result && result.error, 'invite_generation_restricted');
});

```
And delete lines 406-417 (now shifted up by 31 lines after the first deletion — re-locate by content, not line number):
```js
test('buildTokenDoc: includes playerName in token doc shape', () => {
    // Regression for token scope enforcement in Firestore rules.
    loadModules();
    const doc = global.DSFeaturePlayerUpdatesCore.buildTokenDoc(
        'Alice',
        'alliance_pu_integ_1',
        'last_war',
        'uid_leader_pu',
        { expiryHours: 48 }
    );
    assert.equal(doc.playerName, 'Alice', 'Token doc must preserve invited playerName');
});
```

In `tests/player-updates.race.integration.test.js`, delete lines 104-142:
```js
// ---------------------------------------------------------------------------
// Legacy invite generation path is blocked even under concurrent calls
// ---------------------------------------------------------------------------

test('race condition: two concurrent openTokenGenerationModal calls stay blocked and skip gateway writes', async () => {
    loadModules();

    var callCount = 0;
    var warnings = [];
    var alertCount = 0;
    global.alert = function () { alertCount++; };
    global.console = Object.assign({}, console, {
        warn: function () { warnings.push([].slice.call(arguments).join(' ')); },
    });

    var gateway = {
        saveTokenBatch: async function () {
            callCount++;
            return { ok: true, tokenIds: ['tok_1'] };
        },
        updatePendingUpdateStatus: async function () { return { ok: true }; },
        revokeToken: async function () { return { ok: true }; },
    };

    global.DSFeaturePlayerUpdatesController.init(gateway);

    // Fire both concurrently
    const result1 = global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice']);
    const result2 = global.DSFeaturePlayerUpdatesController.openTokenGenerationModal(['Alice']);

    // Allow microtasks to settle
    await new Promise(function (resolve) { setTimeout(resolve, 20); });

    assert.equal(result1 && result1.error, 'invite_generation_restricted');
    assert.equal(result2 && result2.error, 'invite_generation_restricted');
    assert.equal(callCount, 0, 'Legacy path must never call saveTokenBatch');
    assert.ok(warnings.length >= 1, 'Controller should log warning for blocked legacy path');
    assert.equal(alertCount, 2, 'User guidance alert should be shown on blocked calls');
});

```
Then in the same file, find:
```js
    assert.equal(typeof ctrl.openTokenGenerationModal, 'function');
```
and delete that one line (keep the rest of the `phase1b regression: DSFeaturePlayerUpdatesController exposes all required methods` test).

Then find:
```js
    assert.equal(typeof core.generateToken, 'function');
    assert.equal(typeof core.buildTokenDoc, 'function');
    assert.equal(typeof core.buildUpdateLink, 'function');
    assert.equal(typeof core.formatLinksForMessaging, 'function');
```
and delete only the first 3 lines (`generateToken`, `buildTokenDoc`, `buildUpdateLink`) — **keep** `formatLinksForMessaging`'s assertion removed too since it's also being deleted in Step 5 below. So delete all 4 lines, leaving:
```js
    assert.equal(typeof core.validateProposedValues, 'function');
    assert.equal(typeof core.calculateDeltas, 'function');
```

In `tests/player-updates.core.test.js`, delete lines 18-84 (the `generateToken` and `buildUpdateLink` test sections, keeping the `loadModule()` helper above them and the `validateProposedValues` tests below):
```js
// ---------------------------------------------------------------------------
// generateToken
// ---------------------------------------------------------------------------

test('generateToken: returns a string of length 32', () => {
    loadModule();
    const token = global.DSFeaturePlayerUpdatesCore.generateToken();
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 32);
});

test('generateToken: contains only hex characters [0-9a-f]', () => {
    loadModule();
    const token = global.DSFeaturePlayerUpdatesCore.generateToken();
    assert.match(token, /^[0-9a-f]+$/);
});

test('generateToken: two consecutive calls return different values', () => {
    loadModule();
    const a = global.DSFeaturePlayerUpdatesCore.generateToken();
    const b = global.DSFeaturePlayerUpdatesCore.generateToken();
    assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// buildUpdateLink
// ---------------------------------------------------------------------------

test('buildUpdateLink: contains ?token= param', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('abc', 'alliance1', 'en', 'last_war');
    assert.ok(link.includes('?token=abc'), `Expected ?token=abc in: ${link}`);
});

test('buildUpdateLink: contains &alliance= param', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('abc', 'alliance1', 'en', 'last_war');
    assert.ok(link.includes('&alliance=alliance1'), `Expected &alliance=alliance1 in: ${link}`);
});

test('buildUpdateLink: contains &lang= param', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('abc', 'alliance1', 'fr', 'last_war');
    assert.ok(link.includes('&lang=fr'), `Expected &lang=fr in: ${link}`);
});

test('buildUpdateLink: contains &gid= param when gameId is provided', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('abc', 'alliance1', 'fr', 'last_war');
    assert.ok(link.includes('&gid=last_war'), `Expected &gid=last_war in: ${link}`);
});

test('buildUpdateLink: special chars in params are encoded', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('a b+c', 'all&id', 'en', 'game id');
    // token, alliance and gid should be URL-encoded
    assert.ok(!link.includes(' '), 'Spaces should be encoded');
    assert.ok(link.includes('a%20b'), 'Space in token should be %20');
    assert.ok(link.includes('all%26id'), '& in alliance should be %26');
    assert.ok(link.includes('game%20id'), 'Space in gid should be %20');
});

test('buildUpdateLink: buildUpdateLink("abc", "alliance1", "fr", "last_war") produces correct query string', () => {
    loadModule();
    const link = global.DSFeaturePlayerUpdatesCore.buildUpdateLink('abc', 'alliance1', 'fr', 'last_war');
    assert.ok(link.endsWith('?token=abc&alliance=alliance1&lang=fr&gid=last_war'), `Link should end with correct query: ${link}`);
});

```
And delete the `formatLinksForMessaging` block (originally lines 221-272, now shifted — re-locate by content):
```js
// ---------------------------------------------------------------------------
// formatLinksForMessaging
// ---------------------------------------------------------------------------

test('formatLinksForMessaging: contains all player names', () => {
    loadModule();
    const players = [
        { playerName: 'Alice', link: 'https://example.com/player-update.html?token=abc&aid=a1&lang=en' },
        { playerName: 'Bob', link: 'https://example.com/player-update.html?token=def&aid=a1&lang=en' },
    ];
    const result = global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging(players);
    assert.ok(result.includes('Alice'), 'Should contain Alice');
    assert.ok(result.includes('Bob'), 'Should contain Bob');
});

test('formatLinksForMessaging: contains all links', () => {
    loadModule();
    const players = [
        { playerName: 'Alice', link: 'https://example.com/player-update.html?token=abc' },
        { playerName: 'Bob', link: 'https://example.com/player-update.html?token=def' },
    ];
    const result = global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging(players);
    assert.ok(result.includes('token=abc'));
    assert.ok(result.includes('token=def'));
});

test('formatLinksForMessaging: each player is on its own line', () => {
    loadModule();
    const players = [
        { playerName: 'Alice', link: 'https://example.com/?token=abc' },
        { playerName: 'Bob', link: 'https://example.com/?token=def' },
        { playerName: 'Charlie', link: 'https://example.com/?token=ghi' },
    ];
    const result = global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging(players);
    const lines = result.split('\n');
    assert.equal(lines.length, 3, 'Should have 3 lines, one per player');
    assert.ok(lines[0].includes('Alice'));
    assert.ok(lines[1].includes('Bob'));
    assert.ok(lines[2].includes('Charlie'));
});

test('formatLinksForMessaging: empty array returns empty string', () => {
    loadModule();
    const result = global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging([]);
    assert.equal(result, '');
});

test('formatLinksForMessaging: non-array returns empty string', () => {
    loadModule();
    const result = global.DSFeaturePlayerUpdatesCore.formatLinksForMessaging(null);
    assert.equal(result, '');
});

```
Also remove `formatLinksForMessaging` from `player-updates-core.js`'s function body and export line (it has zero production callers, same as the others — delete the function definition right after the (already-deleted) `buildUpdateLink`, and its export line in the `global.DSFeaturePlayerUpdatesCore = {...}` block).

- [ ] **Step 5: Update CLAUDE.md Section 10 to stop documenting the removed flow**

In `CLAUDE.md`, under "### 10. Player Updates", find:
```
Generate tokens: DSFeaturePlayerUpdatesController.openTokenGenerationModal(playerNames)
  → DSFeaturePlayerUpdatesCore.buildTokenDoc() → gateway.saveTokenBatch()
  → Firestore write: update_tokens/{tokenId}
  → DSFeaturePlayerUpdatesCore.buildUpdateLink(tokenHex) → URL to player-update.html
```
Replace with:
```
Generate shared invite: Players Management invite button → app.js `onInviteButtonClick`/`onSharedInviteClick` handlers
  → FirebaseService.createPersonalSharedUpdateInvite() / createAllianceSharedUpdateInvite()
  → Firestore write: shared_update_invites/{inviteId}
  → URL to player-update.html?shared={inviteId}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass, with the deleted test names no longer appearing in output. No new failures.

- [ ] **Step 7: Commit**

```bash
git add js/features/player-updates/ tests/player-updates.integration.test.js tests/player-updates.race.integration.test.js tests/player-updates.core.test.js CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor: remove orphaned player-updates token-generation code

Invite generation moved to the Players Management shared-invite flow
(?shared= links) a while ago; openTokenGenerationModal/renderTokenModal/
buildTokenDoc/buildUpdateLink/generateToken/formatLinksForMessaging had
zero production callers left, only tests. The consumption side
(player-update.js reading update_tokens for old links) is untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fix CI lint coverage gap

**Context:** `package.json`'s `lint` script is `eslint --cache app.js firebase-module.js js/**/*.js tests/**/*.js e2e/**/*.js`. Bash (used by GitHub Actions) doesn't expand `**` recursively unless `globstar` is set, so `js/**/*.js` only matches one directory level deep — CI silently never lints ~47 of 71 files under `js/`. Verified locally: running `eslint` with a *quoted* glob (so ESLint's own engine expands it, not the shell) surfaces exactly 8 real errors: 3× `DSThemeColors is not defined` in `coordinate-picker-controller.js`, 4× `XLSX is not defined` in `download-controller.js`, and 1× `t is not defined` in `player-updates-view.js` (already removed by Task 1's dead-code deletion). `DSThemeColors` and `XLSX` are legitimate cross-file/lazy-loaded runtime globals (matching the codebase's established lazy-global-lookup convention), not bugs — they just need to be declared for ESLint.

**Files:**
- Modify: `package.json` (`lint` script — quote the globs)
- Modify: `eslint.config.js` (add a scoped globals override)

**Interfaces:**
- Depends on: Task 1 must be done first (removes the `t is not defined` error at `player-updates-view.js:120` by deleting that function entirely).

- [ ] **Step 1: Confirm current error count before the fix (sanity check)**

Run: `npx eslint --no-cache "js/**/*.js"`
Expected: `8 errors` (3 `DSThemeColors`, 4 `XLSX`, 1 `t` — if Task 1 already ran, expect only 7 errors since the `t` one is gone).

- [ ] **Step 2: Quote the glob in `package.json` so ESLint's engine expands it, not the shell**

In `package.json`, change:
```json
    "lint": "eslint --cache app.js firebase-module.js js/**/*.js tests/**/*.js e2e/**/*.js",
```
to:
```json
    "lint": "eslint --cache app.js firebase-module.js \"js/**/*.js\" \"tests/**/*.js\" \"e2e/**/*.js\"",
```

- [ ] **Step 3: Add scoped globals for the two files with legitimate cross-file runtime globals**

In `eslint.config.js`, after the existing `files: ['app.js', 'firebase-module.js', 'js/app-init.js', 'js/core/i18n.js']` block (lines 21-27), add a new block:
```js
  {
    files: [
      'js/features/buildings/coordinate-picker-controller.js',
      'js/features/generator/download-controller.js',
    ],
    languageOptions: {
      globals: {
        DSThemeColors: 'readonly',
        XLSX: 'readonly',
      },
    },
  },
```

- [ ] **Step 4: Verify the fix — no errors, only the pre-existing warnings**

Run: `npm run lint`
Expected: Exit code 0, `0 errors` (warnings are fine — `no-unused-vars` is a warning, not an error, per the existing rule config).

- [ ] **Step 5: Run the full test suite (lint doesn't touch test behavior, but confirm nothing else broke)**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json eslint.config.js
git commit -m "$(cat <<'EOF'
fix: CI lint glob silently skipped ~47 of 71 files under js/

bash (used by GitHub Actions) doesn't expand ** recursively unless
globstar is set, so js/**/*.js only matched one directory level deep.
Quoting the glob lets ESLint's own engine expand it instead, fixing
the gap for every shell. Also declares DSThemeColors/XLSX as known
runtime globals for the two files that legitimately reference them
lazily (not bugs — same pattern as the existing app.js/firebase-module.js
no-undef exceptions, just scoped to two specific globals instead of
disabling no-undef entirely).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Consolidate `normalizeGameId`/`normalizeEventId` onto `js/core/games.js`/`js/core/events.js`

**Context:** The same regex-based normalization (`trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')`) is independently hand-copied in `firebase-infra.js`, `js/core/games.js`, `js/core/events.js`, `js/features/events-manager/events-registry-controller.js`, and `js/services/firebase-service.js`. Verified: `js/services/firebase-service.js:681`'s `normalizeEventId` is **not** actually identical — it only does `value.trim()`, silently skipping the lowercase/char-stripping step everyone else applies. This is a live divergence bug: an event ID with mixed case or special characters would resolve to a different Firestore path depending on which module normalized it. `js/core/games.js`/`js/core/events.js` are already loaded early (`js/main-entry.js` lines 11-12) and have no dependencies, but currently don't export their `normalizeGameId`/`normalizeEventId` functions — only use them internally.

**Files:**
- Modify: `js/core/games.js:93-103` (export `normalizeGameId`)
- Modify: `js/core/events.js:266-279` (export `normalizeEventId`)
- Modify: `firebase-infra.js:78-98` (delegate both functions)
- Modify: `js/features/events-manager/events-registry-controller.js:50-64` (delegate both functions)
- Modify: `js/services/firebase-service.js:408-415`, `:681-686` (delegate both functions — fixes the divergence bug)
- Test: `tests/firebase-service.test.js` (add regression test proving the fix)

**Interfaces:**
- Produces: `window.DSCoreGames.normalizeGameId(value): string`, `window.DSCoreEvents.normalizeEventId(value): string` — the new canonical, exported functions every other module delegates to.

- [ ] **Step 1: Export `normalizeGameId` from `js/core/games.js`**

In `js/core/games.js`, change the export object (lines 93-103) from:
```js
    global.DSCoreGames = {
        GAME_CATALOG: GAME_CATALOG,
        GAME_METADATA_SUPER_ADMIN_UID: GAME_METADATA_SUPER_ADMIN_UID,
        getDefaultGameId: getDefaultGameId,
        getGame: getGame,
        listGameIds: listGameIds,
        listAvailableGames: listAvailableGames,
        isKnownGame: isKnownGame,
        isGameMetadataSuperAdmin: isGameMetadataSuperAdmin,
        canEditGameMetadata: canEditGameMetadata,
    };
```
to:
```js
    global.DSCoreGames = {
        GAME_CATALOG: GAME_CATALOG,
        GAME_METADATA_SUPER_ADMIN_UID: GAME_METADATA_SUPER_ADMIN_UID,
        getDefaultGameId: getDefaultGameId,
        getGame: getGame,
        listGameIds: listGameIds,
        listAvailableGames: listAvailableGames,
        isKnownGame: isKnownGame,
        isGameMetadataSuperAdmin: isGameMetadataSuperAdmin,
        canEditGameMetadata: canEditGameMetadata,
        normalizeGameId: normalizeGameId,
    };
```

- [ ] **Step 2: Export `normalizeEventId` from `js/core/events.js`**

In `js/core/events.js`, change the export object (lines 266-279) from:
```js
    global.DSCoreEvents = {
        EVENT_REGISTRY: EVENT_REGISTRY,
        LEGACY_EVENT_REGISTRY: LEGACY_EVENT_REGISTRY,
        getEvent: getEvent,
        getEventIds: getEventIds,
        cloneEventRegistry: cloneEventRegistry,
        setEventRegistry: setEventRegistry,
        upsertEvent: upsertEvent,
        removeEvent: removeEvent,
        slugifyEventId: slugifyEventId,
        cloneEventBuildings: cloneEventBuildings,
        cloneDefaultPositions: cloneDefaultPositions,
        cloneLegacyEventRegistry: cloneLegacyEventRegistry,
    };
```
to:
```js
    global.DSCoreEvents = {
        EVENT_REGISTRY: EVENT_REGISTRY,
        LEGACY_EVENT_REGISTRY: LEGACY_EVENT_REGISTRY,
        getEvent: getEvent,
        getEventIds: getEventIds,
        cloneEventRegistry: cloneEventRegistry,
        setEventRegistry: setEventRegistry,
        upsertEvent: upsertEvent,
        removeEvent: removeEvent,
        slugifyEventId: slugifyEventId,
        cloneEventBuildings: cloneEventBuildings,
        cloneDefaultPositions: cloneDefaultPositions,
        cloneLegacyEventRegistry: cloneLegacyEventRegistry,
        normalizeEventId: normalizeEventId,
    };
```

- [ ] **Step 3: Run existing core tests to confirm the new exports don't break anything**

Run: `npx node --test tests/games.core.test.js tests/events.core.test.js tests/events.core.extended.test.js`
Expected: All pass (adding an export key doesn't change any existing behavior).

- [ ] **Step 4: Delegate `firebase-infra.js`'s copies to the core modules**

In `firebase-infra.js`, change (lines 78-98):
```js
    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    function normalizeGameId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
```
to:
```js
    function normalizeEventId(value) {
        return (global.DSCoreEvents && typeof global.DSCoreEvents.normalizeEventId === 'function')
            ? global.DSCoreEvents.normalizeEventId(value)
            : '';
    }

    function normalizeGameId(value) {
        return (global.DSCoreGames && typeof global.DSCoreGames.normalizeGameId === 'function')
            ? global.DSCoreGames.normalizeGameId(value)
            : '';
    }
```
(This is the codebase's own established lazy-lookup-at-call-time convention — see `js/main-entry.js` require order: `firebase-infra.js` loads at line 6, before `js/core/games.js`/`js/core/events.js` at lines 11-12, but since the lookup happens inside the function body — called only after full app boot — load order doesn't matter.)

- [ ] **Step 5: Delegate `events-registry-controller.js`'s copies**

In `js/features/events-manager/events-registry-controller.js`, change:
```js
    function normalizeGameId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }
```
to:
```js
    function normalizeGameId(value) {
        return (global.DSCoreGames && typeof global.DSCoreGames.normalizeGameId === 'function')
            ? global.DSCoreGames.normalizeGameId(value)
            : '';
    }

    function normalizeEventId(value) {
        return (global.DSCoreEvents && typeof global.DSCoreEvents.normalizeEventId === 'function')
            ? global.DSCoreEvents.normalizeEventId(value)
            : '';
    }
```

- [ ] **Step 6: Run the controller's existing tests to confirm behavior is unchanged**

Run: `npx node --test tests/events-registry-controller.feature.test.js`
Expected: All pass, including `normalizeEventId: converts to lowercase and replaces special chars` and `normalizeGameId` tests (around lines 159-183) — since the delegated behavior is byte-identical for valid string inputs.

- [ ] **Step 7: Delegate `firebase-service.js`'s `normalizeGameId` (identical behavior, just deduplicating)**

In `js/services/firebase-service.js`, change:
```js
    function normalizeGameId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }
```
to:
```js
    function normalizeGameId(value) {
        return (global.DSCoreGames && typeof global.DSCoreGames.normalizeGameId === 'function')
            ? global.DSCoreGames.normalizeGameId(value)
            : '';
    }
```

- [ ] **Step 8: Write the failing regression test for `firebase-service.js`'s `normalizeEventId` divergence bug**

In `tests/firebase-service.test.js`, add a new test after the existing `'firebase service delegates calls to FirebaseManager'` test (which already sets up `global.FirebaseManager` with a `getEventMeta` mock and calls `loadModule()`):
```js
test('firebase service normalizeEventId fully normalizes eventId (not just trim)', () => {
  let capturedEventId = null;
  global.FirebaseManager = {
    getEventMeta: (eventId) => { capturedEventId = eventId; return null; },
  };
  loadModule();

  global.FirebaseService.getEventMeta('Desert Storm!', { gameId: 'last_war' });
  assert.equal(capturedEventId, 'desert_storm', 'eventId must be lowercased and stripped of special characters before reaching FirebaseManager');
});
```
This test file's `loadModule()` (near the top of the file) needs `js/core/events.js` required so the delegation resolves for real instead of falling to the `''` fallback branch. Find `loadModule()` and add the require alongside the existing gateway requires:
```js
  require(gatewayUtilsPath);
  require(authGatewayPath);
  require(playersGatewayPath);
  require(eventsGatewayPath);
  require(allianceGatewayPath);
  require(notificationsGatewayPath);
  require(modulePath);
```
becomes:
```js
  require(gatewayUtilsPath);
  require(authGatewayPath);
  require(playersGatewayPath);
  require(eventsGatewayPath);
  require(allianceGatewayPath);
  require(notificationsGatewayPath);
  require(coreEventsPath);
  require(modulePath);
```
And add the path constant near the other `const ...Path = path.resolve(...)` lines at the top of the file:
```js
const coreEventsPath = path.resolve(__dirname, '../js/core/events.js');
```
Also add `delete global.DSCoreEvents;` and `delete require.cache[require.resolve(coreEventsPath)];` alongside this file's existing cache-clearing lines in `loadModule()`, following the same pattern already used for the other required modules in that function.

- [ ] **Step 9: Run the new test to verify it currently fails (before the fix)**

Run: `npx node --test tests/firebase-service.test.js`
Expected: FAIL on `firebase service normalizeEventId fully normalizes eventId (not just trim)` — actual value is `'Desert Storm!'` (trim-only), not `'desert_storm'`.

- [ ] **Step 10: Fix `firebase-service.js`'s `normalizeEventId`**

In `js/services/firebase-service.js`, change:
```js
    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim();
    }
```
to:
```js
    function normalizeEventId(value) {
        return (global.DSCoreEvents && typeof global.DSCoreEvents.normalizeEventId === 'function')
            ? global.DSCoreEvents.normalizeEventId(value)
            : '';
    }
```

- [ ] **Step 11: Run the test again to verify it passes**

Run: `npx node --test tests/firebase-service.test.js`
Expected: PASS — `capturedEventId` is now `'desert_storm'`.

- [ ] **Step 12: Run the full test suite**

Run: `npm test`
Expected: All tests pass. Pay attention to any test that relied on `firebase-service.js`'s old trim-only `normalizeEventId` behavior with a mixed-case or special-character event ID — if one fails, that test was asserting the bug; update its expectation to the correct normalized value rather than reverting the fix.

- [ ] **Step 13: Commit**

```bash
git add firebase-infra.js js/core/games.js js/core/events.js js/features/events-manager/events-registry-controller.js js/services/firebase-service.js tests/firebase-service.test.js
git commit -m "$(cat <<'EOF'
fix: consolidate normalizeGameId/normalizeEventId onto js/core, fix divergence bug

The same regex normalization was hand-copied in firebase-infra.js,
events-registry-controller.js, and firebase-service.js. The
firebase-service.js copy of normalizeEventId had silently drifted to
trim-only (no lowercasing/char-stripping), which would resolve a
mixed-case or special-character event ID to a different Firestore
path than every other module — a "data not found" bug with no error.
js/core/games.js and js/core/events.js are now the single source of
truth; everything else delegates via the codebase's existing
lazy-global-lookup convention.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Collapse the 3-level `createGameMetadataLogoDataUrl` indirection in `app.js`

**Context:** Verified via grep that `createGameMetadataLogoDataUrl` has exactly one call site in `app.js` (line 2141, inside the `DSGameMetadataAdminController.init({...})` dependency object) and one definition (line 2206) that only that call site uses. The real implementation lives 2 layers down in `events-registry-controller.js:1017` → `events-image-processor.js`. This task removes both of `app.js`'s unnecessary layers, leaving one direct reference.

**Files:**
- Modify: `app.js:2141`, `:2206` (delete one line, change another)

- [ ] **Step 1: Point the dependency object directly at the controller**

In `app.js`, inside `window.DSGameMetadataAdminController.init({...})` (around line 2128), change:
```js
    createGameMetadataLogoDataUrl: function (f) { return createGameMetadataLogoDataUrl(f); },
```
to:
```js
    createGameMetadataLogoDataUrl: function (f) { return window.DSEventsRegistryController.createGameMetadataLogoDataUrl(f); },
```

- [ ] **Step 2: Delete the now-unused app.js-level wrapper**

In `app.js`, in the "Thin wrappers — delegate to controller" block, delete this line entirely:
```js
function createGameMetadataLogoDataUrl(f) { return window.DSEventsRegistryController.createGameMetadataLogoDataUrl(f); }
```

- [ ] **Step 3: Confirm no other reference to the deleted identifier remains**

Run: `grep -n "createGameMetadataLogoDataUrl" app.js`
Expected: exactly one line — the one from Step 1 (the closure inside the `deps` object). If anything else shows up, stop and investigate before proceeding (do not delete the wrapper if another call site depends on it).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: All tests pass — this changes only which reference is used, not behavior.

- [ ] **Step 5: Run the build to confirm no bundling error**

Run: `npm run build`
Expected: Succeeds, no undefined-reference errors.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "$(cat <<'EOF'
refactor: collapse 3-level indirection for createGameMetadataLogoDataUrl

app.js had two of its own wrapper layers around the same
DSEventsRegistryController delegation (one closing over the other),
on top of a third layer inside the controller itself. Point the
dependency-injection object directly at the controller method instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Tighten the `games/{gameId}/events` Firestore write rule

**Context:** `firestore.rules:491` currently allows **any signed-in user** — not just members of an alliance in that game — to write to any game's shared event definitions (`buildingConfig`, `buildingPositions`, logos, maps). This is a real cross-tenant write hole, flagged as a `// TODO` in the rules file itself. Events are shared per-*game* (not per-alliance — multiple alliances can share one game), so the correct check is "is this user a member of *some* alliance within this game," not "is this user a member of *the specific* alliance that owns this event" (events have no `allianceId` field). The data model already has exactly what's needed for this: `games/{gameId}/user_state/{uid}` stores `{ allianceId, playerSource, migrationVersion }` per user per game — if `allianceId` is set there, the user belongs to an alliance in that game.

**⚠️ This task modifies live Firestore security rules. Do not run `firebase deploy --only firestore:rules` at the end — stop after the emulator test passes and get explicit confirmation before deploying.**

**Files:**
- Modify: `firestore.rules` (add `isGameAllianceMember` helper, tighten the `events` write rule)
- Test: Create `tests/firestore-rules/game-events.rules.test.js`

- [ ] **Step 1: Add the `isGameAllianceMember` helper**

In `firestore.rules`, immediately after the closing `}` of the existing `isAllianceMember` function (right before `function isAnonymous() {`, around line 533), add:
```
    // Helper: check if the current user is a member of ANY alliance within
    // the given game (via their per-game user_state doc). Used for
    // game-level shared resources (like `events`) that aren't scoped to one
    // specific alliance.
    function isGameAllianceMember(gameId) {
      return signedIn()
        && exists(/databases/$(database)/documents/games/$(gameId)/user_state/$(request.auth.uid))
        && get(/databases/$(database)/documents/games/$(gameId)/user_state/$(request.auth.uid)).data.allianceId != null;
    }
```

- [ ] **Step 2: Tighten the `events` write rule**

In `firestore.rules`, change:
```
      // Shared event definitions (game-level, all signed-in users can read/write)
      match /events/{eventId} {
        allow read: if signedIn();
        allow write: if signedIn(); // TODO: tighten to alliance membership check in Phase 2.x
      }
```
to:
```
      // Shared event definitions (game-level, all signed-in users can read;
      // only members of an alliance within this game can write)
      match /events/{eventId} {
        allow read: if signedIn();
        allow write: if isGameAllianceMember(gameId);
      }
```

- [ ] **Step 3: Write the failing regression test**

Create `tests/firestore-rules/game-events.rules.test.js`:
```js
// tests/firestore-rules/game-events.rules.test.js
// Firestore security rules tests for games/{gameId}/events write authorization.
// Requires the Firestore emulator:
//   firebase emulators:exec --only firestore "node --test tests/firestore-rules/game-events.rules.test.js"

const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ID = 'demo-desert-storm-generator';
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
```

- [ ] **Step 4: Run the new test against the emulator to verify it fails without the fix**

First, temporarily revert Step 2's rule change (put back `allow write: if signedIn();`) to confirm the test catches the hole:
Run: `firebase emulators:exec --only firestore "node --test tests/firestore-rules/game-events.rules.test.js"`
Expected: FAIL on `'game events: signed-in user with NO alliance membership in this game CANNOT write'` (the outsider's write currently succeeds — that's the bug).

If the Firestore emulator isn't available in this environment, skip live emulator execution and instead visually re-verify the old rule text (`allow write: if signedIn();`) would trivially pass for any authenticated UID regardless of `user_state` — note this in the commit message if the emulator step was skipped.

- [ ] **Step 5: Re-apply Step 2's fix and run the test again**

Re-apply the rule change from Step 2.
Run: `firebase emulators:exec --only firestore "node --test tests/firestore-rules/game-events.rules.test.js"`
Expected: All 3 tests PASS.

- [ ] **Step 6: Run the full existing rules test suite to confirm no regression in other rules**

Run: `npm run test:rules`
Expected: All existing rules tests still pass (this change only touches the `events` write rule; `event_history`, `alliances`, `games`, `soloplayers` etc. rules are untouched).

- [ ] **Step 7: Commit — but do NOT deploy**

```bash
git add firestore.rules tests/firestore-rules/game-events.rules.test.js
git commit -m "$(cat <<'EOF'
fix: close cross-tenant write hole in games/{gameId}/events rule

Any signed-in user (not just alliance members of that game) could
write to any game's shared event definitions — buildingConfig, logos,
maps. Adds isGameAllianceMember(gameId), which checks the user's
per-game user_state doc for an allianceId, matching how events are
actually shared (per-game, across all alliances in that game, not
per-specific-alliance — event docs have no allianceId field of their
own).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**STOP HERE.** Tell the user the commit is ready locally but the rules have NOT been deployed to production Firestore. Ask for explicit confirmation before running:
```bash
firebase deploy --only firestore:rules --project last-war-game-desert-storm
```

---

## Explicitly Out of Scope (flagged, not silently dropped)

- **Super-admin hardcoded UID → custom claims** (Tier 1 #3 from the audit): requires running an Admin SDK script against production Firebase Auth to set the custom claim *before* any rules change that depends on it — a live production action needing its own explicit go-ahead, not bundled into this plan.
- **Full removal of the remaining ~29 `app.js` "thin wrapper" facade functions** (only `createGameMetadataLogoDataUrl`'s 3-level chain is fixed in Task 4): each wrapper has multiple call sites scattered across a 5149-line file; doing this safely means reviewing every call site individually, not a mechanical find-and-replace. Worth a dedicated follow-up pass with fresh context, not folded into this one.
