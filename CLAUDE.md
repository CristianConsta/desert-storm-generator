# CLAUDE.md — Events Team Generator

## Project Overview

A vanilla JavaScript SPA for generating team assignments for mobile game events (Desert Storm, Canyon Storm). Uses Firebase Auth + Firestore for persistence. No build step — files are served directly.

## Commands

```bash
# Run unit + integration tests
npm test
# → Runs tests/*.test.js (*.core.test.js, *.integration.test.js, *.feature.test.js, etc.)

# Build & watch
npm run build    # esbuild: js/main-entry.js → dist/bundle.js
npm run dev      # esbuild watch mode (auto-rebuild on file changes)

# Local development
# Option 1: Direct browser — Open index.html in browser (no dev server needed)
#   Requires firebase-config.js with real Firebase credentials
# Option 2: Bundled — npm run dev, then load dist/bundle.js in HTML

# Deploy
# Push to main → GitHub Actions auto-deploys to GitHub Pages
# Requires FIREBASE_CONFIG_JS secret set in GitHub repository settings

# Firestore rules tests (requires Firestore emulator)
npm run test:rules

# E2E tests (Playwright)
npm run test:e2e          # all projects
npm run test:e2e:smoke    # @smoke tagged tests only
```

## Architecture

### Module Pattern
Every JS file uses the IIFE pattern — **do not deviate from this**:
```js
(function initModuleName(global) {
  // module code
  global.ModuleName = { ... };
})(window);
```

### Directory Layout
```
index.html              # Entry point — loads all scripts via <script> tags
app.js                  # Top-level app state and wiring
firebase-module.js      # Firebase IIFE (Auth + Firestore operations)
translations.js         # i18n string dictionaries
styles.css              # All CSS
player-update.html      # Standalone page for player-facing updates
player-update.css       # CSS for player-update page
js/
  main-entry.js         # esbuild entry point (requires all modules for bundling)
  app-init.js           # Startup callbacks
  core/
    assignment.js           # Team assignment algorithm
    assignment-registry.js  # Registry of assignment strategies
    buildings.js            # Building normalization
    events.js               # Event registry and defaults
    games.js                # Game definitions (Desert Storm, Canyon Storm, etc.)
    generator-assignment.js # Generator-specific assignment logic
    i18n.js                 # Translation engine
    player-table.js         # Player data model
    firestore-utils.js      # Firestore query and snapshot utilities
    reliability.js          # Data reliability checks and retries
    theme-colors.js         # Runtime bridge for reading CSS tokens in JS
  services/
    firebase-service.js # Adapter wrapping FirebaseManager (enables testing)
  features/
    alliance/           # Alliance management feature
      alliance-controller.js
    buildings/          # Buildings config feature
      buildings-config-manager.js
      coordinate-picker-controller.js
    event-history/      # Event history feature
      event-history-core.js
      event-history-actions.js
      event-history-view.js
      event-history-controller.js
    events-manager/     # Event selection and registry management
      event-selector-view.js
      events-manager-actions.js
      events-manager-controller.js
      events-registry-controller.js
      events-image-processor.js
      events-map-controller.js
    generator/          # Team generation feature
      download-controller.js
      generator-actions.js
      generator-controller.js
      generator-view.js
      team-selection-core.js
    notifications/      # In-app notifications feature
      notifications-controller.js
      notifications-core.js
    player-updates/     # Player updates feature
      player-updates-core.js
      player-updates-actions.js
      player-updates-view.js
      player-updates-controller.js
    players-management/ # Player CRUD feature
      player-data-upload.js
      players-management-actions.js
      players-management-controller.js
      players-management-core.js
      players-management-view.js
  player-update/
    player-update.js    # Player-facing update page logic
  shared/
    data/
      data-gateway-contract.js
      firebase-alliance-gateway.js
      firebase-auth-gateway.js
      firebase-event-history-gateway.js
      firebase-events-gateway.js
      firebase-gateway-utils.js
      firebase-notifications-gateway.js
      firebase-player-updates-gateway.js
      firebase-players-gateway.js
    state/
      app-state-store.js
      state-store-contract.js
  shell/
    bootstrap/          # App shell bootstrap (IIFE and ESM variants)
    navigation/         # Navigation controller
    overlays/           # Modal and notifications-sheet controllers
    theme-controller.js # Theme switching and persistence
    game-metadata-admin-controller.js # Game metadata admin
  ui/
    alliance-panel-ui.js
    event-buildings-editor-ui.js
    event-list-ui.js
    player-table-ui.js
e2e/                    # Playwright E2E tests (run with npm run test:e2e)
  *.e2e.js
vendor/                 # Vendored Firebase + SheetJS (no npm for browser code)
tests/                  # Node built-in test runner tests
  firestore-rules/      # Firestore security rules tests (requires emulator)
    *.rules.test.js
  *.core.test.js        # Unit tests
  *.integration.test.js # Integration tests
  *.feature.test.js     # Feature/controller tests
scripts/
  build.js              # esbuild build script
  ...                   # Firestore migration scripts (Node + firebase-admin)
dist/                   # Generated bundle (do not edit manually)
  bundle.js             # esbuild output
```

### State Management
- Global state lives on `window` via IIFE exports (e.g., `window.DSAssignment`)
- App-level state in `app.js`: `allPlayers`, `currentAuthUser`, `activeDownloadTeam`, etc.
- Firestore is source of truth; real-time listeners via `setDataLoadCallback`

### i18n
- HTML elements use `data-i18n="key"` attributes
- Applied by calling `DSI18N.applyTranslations()`
- Supported languages: EN, FR, DE, IT, KO, RO
- All user-visible strings must be added to `translations.js`
- **MANDATORY**: When adding or modifying any i18n key, you MUST add the translation for ALL 6 languages (EN, FR, DE, IT, KO, RO). Never add a key to only one language. The `tests/i18n-keys.core.test.js` test enforces parity and will fail if any language is missing a key.

### Theming & CSS Variables
- **All color values must use `--ds-*` design tokens** — never hardcode hex/rgba in `styles.css` or JS canvas code. The only place raw color values belong is in token declarations inside `:root` blocks.
- **Token naming**: `--ds-{category}-{variant}` (e.g., `--ds-surface-base`, `--ds-text-primary`, `--ds-accent-primary`).
- **4 themes supported**: `standard` (default dark), `last-war` (dark green), `light`, `system` (auto from OS). Theme is set via `data-theme` attribute on `<html>`.
- **Token declarations live in two files**: `styles.css` (used by `index.html`) and `theme-variables.css` (used by `player-update.html`). Keep them in sync.
- **MANDATORY: When adding a new `--ds-*` token**, you MUST declare it in ALL theme blocks:
  1. `:root` (standard/default dark theme) in `styles.css`
  2. `:root[data-theme='last-war']` in `styles.css`
  3. `:root[data-theme='light']` in `styles.css`
  4. All 3 matching blocks in `theme-variables.css`

  Failing to declare a token in all blocks causes silent CSS fallback (usually transparent/white), breaking the theme.
- **MANDATORY: When using `var(--ds-*)` in CSS**, verify the token is declared in the default `:root` block. Grep for `--ds-your-token-name:` (with colon) to confirm it exists as a declaration, not just a reference.
- **JS canvas colors**: Use `DSThemeColors.get('token-name')` with a hardcoded fallback: `DSThemeColors.get('accent-primary') || '#F0C040'`. The fallback ensures canvas rendering works even if the DOM isn't ready.
- **`DSThemeColors`** (`js/core/theme-colors.js`): Runtime bridge for reading CSS tokens in JS. API: `get(name)`, `getRgb(name)`, `getAlpha(name, alpha)`, `teamConfig(team)`, `reliabilityColor(tier)`. Cache auto-invalidates on theme switch.
- **Old unprefixed variables** (`--gold`, `--bg-0`, `--panel-bg`, etc.) are deprecated. Do not add new references to them. They exist only in the light theme block for backward compatibility and will be removed.
- **Theme persistence**: Theme is saved in both `localStorage` (`ds_theme`) and Firebase user profile (`profile.theme`). On page load, `updateUserHeaderIdentity()` reads `profile.theme` from Firebase and calls `applyPlatformTheme()`. If the theme is not saved to the Firebase profile (via `setUserProfile`), the local selection will be overridden on next profile read. Always include `theme` in `setUserProfile()` calls.
- **MANDATORY: When adding a new theme**, update ALL of these locations:
  1. `DSThemeController.SUPPORTED_THEMES` Set in `js/shell/theme-controller.js`
  2. `USER_PROFILE_THEMES` Set in `firebase-module.js` (line ~67) — controls which themes `normalizeUserProfile()` accepts. Missing entries silently fall back to `'standard'`.
  3. `<option>` in `#settingsThemeSelect` in `index.html`
  4. i18n key `settings_theme_{name}` in `translations.js` (all 6 languages)
  5. `:root[data-theme='{name}']` CSS block in both `styles.css` and `theme-variables.css`

## Adding New Pages

Every top-level page/view in `index.html` **must** be placed inside the `<div class="container">` wrapper (line ~140) so its width matches the header. If the page lives outside `.container` (e.g., after modals or overlays), wrap it in its own `<div class="container">`.

**Required HTML structure for a new page:**
```html
<div id="myNewPage" class="view-section hidden">
    <div class="container">
        <div class="app-view screen-shell">
            <div class="page-header screen-header">
                <h2 class="config-title" data-i18n="my_page_title">My Page</h2>
            </div>
            <div class="card screen-panel">
                <!-- page content here -->
            </div>
        </div>
    </div>
</div>
```

**Checklist when adding a new page:**
1. Place inside `.container` or wrap in `<div class="container">` — ensures max-width matches the header
2. Use `class="view-section hidden"` on the outermost div — `hidden` by default, toggled by navigation
3. Use `app-view screen-shell` → `page-header screen-header` → `card screen-panel` nesting for consistent spacing
4. Add `data-i18n` attributes for the title — with translations in all 6 languages
5. Add the page ID to `hideAllMainPages()` in `app.js` so it hides when navigating away
6. Add the page ID to `setPageView()` in `app.js` if it should be treated as a named page view
7. Add a nav button handler in `bindStaticUiActions()` (app.js) or `initializeApplicationUiRuntime()`

## Key Conventions

- **File naming**: kebab-case (`player-table-ui.js`)
- **Functions**: camelCase
- **CSS variables**: `--ds-{category}-{variant}` (see Theming section below)
- **No TypeScript** — pure ES6+ JavaScript
- **esbuild only** — `npm run build` bundles `js/main-entry.js` → `dist/bundle.js`; do not introduce other bundlers
- **No npm packages for browser code** — use vendored libs in `vendor/`
- **Mobile-first** — use safe-area insets, test on small viewports

## Testing

Tests live in `tests/` and use Node's built-in `node:test` module. No Jest, no Mocha.

Test categories:

1. **Unit tests**: `*.core.test.js` — isolated module tests (assignment logic, data transforms, etc.)
2. **Integration tests**: `*.integration.test.js` — test data flows across modules, mock Firestore operations
3. **Feature tests**: `*.feature.test.js` — controller/feature behavior tests
4. **Firestore rules tests**: `tests/firestore-rules/*.rules.test.js` — security rules validation (requires Firestore emulator)
5. **E2E tests**: `e2e/*.e2e.js` — Playwright end-to-end tests against live Firebase

The `firebase-service.js` adapter exists specifically to make Firebase mockable in tests.

Run unit/integration/feature tests: `npm test`
Run Firestore rules tests: `npm run test:rules`
Run E2E tests: `npm run test:e2e`

## Firebase / Secrets

- `firebase-config.js` — **gitignored**, contains Firebase API keys. Copy from `firebase-config.example.js` for local dev.
- `scripts/PATH_TO_SERVICE_ACCOUNT.json` — **gitignored**, service account for migration scripts.
- GitHub Actions creates `firebase-config.js` from the `FIREBASE_CONFIG_JS` secret at deploy time.

## Firestore Data Model

See the detailed Firestore Data Model section below (after the Codebase Feature Map) for the full collection hierarchy, field schemas, and collection→code mapping.

## Bundle Boot Sequence (critical knowledge)

The app loads via a dynamic `<script defer>` in the inline script block of `index.html`. Because `defer` is **ignored on dynamically created scripts**, the bundle may execute after `DOMContentLoaded` has already fired. This means:

- **Never rely solely on `DOMContentLoaded` listeners** in bundled code. Always check `document.readyState` first and fall back to immediate/deferred execution.
- **`app-shell-bootstrap.js`** uses `setTimeout(boot, 0)` when `readyState !== 'loading'` so that all modules in the bundle finish initialising before `boot()` runs.
- **`firebase-module.js`** uses the same `readyState` guard for `FirebaseManager.init()`.
- **`firebase-auth-module.js`** buffers the auth callback if `configure()` hasn't been called yet (timing: `app-init.js` IIFE runs before `DOMContentLoaded` → `init()` → `configure()`).
- **Module require order matters**: `main-entry.js` defines the require chain. `app-shell-bootstrap.js` runs before `app.js`, so boot must defer to ensure `window.initializeApplicationUiRuntime` exists.
- When adding new `DOMContentLoaded` listeners in bundled modules, always use the readyState pattern:
  ```js
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handler);
  } else {
      setTimeout(handler, 0); // defer to let sibling modules finish
  }
  ```

## E2E Testing

- Tests use `file://` URLs (no dev server) with Playwright
- **Edge is not installed locally** — edge-desktop and edge-mobile projects will fail locally; only chrome-desktop and chrome-mobile work
- The `navigateTo()` helper in `e2e/helpers.js` only knows about pages in its `expectedPageByNavId` map. Event History (`#eventHistoryView`) is NOT in this map — navigate to it via `page.evaluate(() => document.getElementById('navEventHistoryBtn').click())`
- The E2E mock (`injectMockFirebase`) replaces `window.FirebaseManager` via `Object.defineProperty` with a no-op setter to prevent the real module from overwriting it
- `player-update.html` E2E tests (`11-invite-flow.e2e.js:396+`) have pre-existing failures related to Firebase anonymous auth in the standalone page
- Always run `npm run build` before E2E tests — tests load `dist/bundle.js`, not individual source files
- When modifying shell bootstrap or module initialization, always run both `npm test` (unit) AND chrome-desktop E2E to catch timing regressions

## CI/CD Pipeline

Deploy workflow (`.github/workflows/pages.yml`) has 3 jobs:
1. **`lint-and-unit`**: checkout → npm ci → lint + budgets → coverage (includes all tests) → build → upload bundle artifact
2. **`e2e-smoke`**: optional (manual trigger only), runs Playwright smoke tests
3. **`package-and-deploy`**: sparse checkout → download bundle artifact → stage files → deploy to GitHub Pages

Key design decisions:
- **`test:coverage` replaces `test:unit`** — they run the same tests; `test:coverage` wraps them in c8. Never run both in CI.
- **Bundle is built once** in lint-and-unit and passed via `actions/upload-artifact` to deploy job. Never rebuild in deploy.
- **Sparse checkout** in deploy job — only fetches files needed for `_site/`, not the full repo.
- **Deploy files list** must stay in sync with what `index.html` and `player-update.html` load via `<script>`/`<link>` tags. When adding a new top-level JS/CSS file, update the `Stage deploy files` step.

## Implementation Rules

These rules apply to ALL future code changes in this repository:

1. **NO DUPLICATION.** Grep the codebase for existing code before creating new. Reuse when there's overlap. Never duplicate without explicitly stating why. If functionality is too different to reuse directly, extract shared logic into clean, composable functions.
2. **SECURITY-FIRST.** Secrets in env vars only (never commit `firebase-config.js`). Validate input server-side. Parameterized queries. No custom crypto. Sanitize user-provided data before writing to Firestore or rendering to DOM. Rely on Firestore Security Rules for access control — not client-side checks alone. Refer to community best practices before inventing custom flows.
3. **SINGLE RESPONSIBILITY.** One function, one job. Name by sole purpose. Keep testable in isolation. Validate input, handle database logic, and manage side effects in separate functions.
4. **FRAMEWORK-FIRST.** Check if the framework already does it. Use community libraries before building custom. List the standard option first; only go custom with strong justification. In this repo, browser dependencies must be vendored (see `vendor/`), not installed via npm.
5. **END-TO-END.** Complete one feature fully before starting the next. Commit every 30 minutes of work. Test before moving on — new logic must include corresponding unit or feature tests, bug fixes must include a regression test that fails without the fix.
6. **LEARN FROM MISTAKES.** After each validated bug fix, append an entry to `.planning/codebase/mistakes.md` documenting: what went wrong, root cause, and how to avoid it. Consult this file before new implementations to avoid repeating past errors.
7. **When rules clash, apply this priority:**
   - *DRY vs. SRP:* If extracting duplicate code would create one giant, complex function, keep some duplication. Two simple functions beat one monster function.
   - *Security vs. Simplicity:* Always choose security. Secure complexity beats simple vulnerability every time.
   - *Framework vs. Custom:* If a framework solution feels like overkill, use it anyway. What seems like overkill today saves weeks of maintenance tomorrow.

## What NOT to Do

- Do not introduce a new build tool (esbuild is the only approved bundler)
- Do not add npm packages that need to be bundled for the browser
- Do not convert to TypeScript
- Do not break the IIFE module pattern
- Do not add inline `<script>` logic to `index.html` — keep JS in separate files
- Do not commit `firebase-config.js` or service account files
- Do not use bare `document.addEventListener('DOMContentLoaded', ...)` in bundled modules — use the readyState guard pattern (see Bundle Boot Sequence above)
- Do not add CSS `var(--ds-*)` references without verifying the token is declared in ALL theme blocks (see Theming section)
- Do not save user preferences to Firebase without including ALL settings fields — partial saves cause stale values to overwrite fresh local state on the next profile read
- Do not run `test:unit` and `test:coverage` separately in CI — they execute the same tests; use `test:coverage` alone
- Do not add duplicate steps across CI jobs (e.g., `npm ci` + `npm run build` in both lint and deploy jobs) — use artifacts to pass outputs between jobs

---

## Codebase Feature Map

### 1. App Bootstrap & Bundle Loading

**Init trigger:** `index.html` inline `<script>` dynamically creates `<script defer src="dist/bundle.js">` (defer is ignored on dynamic scripts). Bundle requires all modules in order defined in `js/main-entry.js`.

**Boot sequence:**
```
bundle.js evaluated
  → all IIFE modules execute, populating window.DS* globals
  → app.js top-level code runs
  → js/app-init.js IIFE runs:
      initLanguage() → DSI18N.init() → applyTranslations()
      updateGenerateEventLabels()
      initializeFirebaseCallbacks()
        → FirebaseService.setAuthCallback(...)
        → FirebaseService.setDataLoadCallback(...)
        → FirebaseService.setAllianceDataCallback(...)
  → app-shell-bootstrap.js:
      if readyState !== 'loading' → setTimeout(boot, 0)
      else → DOMContentLoaded → boot()
  → boot()
      → createRootController() → DSAppShellContracts.createFeatureController(base)
      → rootController.init() → initializeApplicationUiRuntime() [app.js]
          → bindStaticUiActions()  (ALL click/change handlers wired here)
          → DSOnboardingController.init() + bindOnboardingListeners()
          → buildRegistryFromStorage(), renderAllEventSelectors(), renderEventsList()
          → startNewEventDraft(), switchEvent(currentEvent)
          → updateUserHeaderIdentity(), updateActiveGameBadge()
```

### 2. Firebase Init & Auth

**Files:** `firebase-infra.js` → `DSFirebaseInfra` | `firebase-auth-module.js` → `DSFirebaseAuth` | `firebase-module.js` → `FirebaseManager` | `js/services/firebase-service.js` → `FirebaseService`

**Call chain:**
```
FirebaseManager.init() [DOMContentLoaded or readyState guard]:
  → DSFirebaseInfra.setDb(db)
  → DSFirebaseAuth.configure(deps)  ← injects getAuth, get/setOnAuthCallback, etc.
  → firebase.auth().onAuthStateChanged(DSFirebaseAuth.handleAuthStateChanged)

handleAuthStateChanged(user):
  → signed in: deps.triggerPostSignInLoad(user) → loads Firestore data
               deps.getOnAuthCallback()(true, user) → app-init.js callback
  → signed out: deps.applySignOutState()
                deps.getOnAuthCallback()(false, null)

app-init.js authCallback(isSignedIn, user):
  → true: syncSignedInGameContext(), show #mainApp, hide #loginScreen,
          updateUserHeaderIdentity(user), applyTranslations(),
          showPostAuthGameSelector() if no game, initOnboarding(),
          notificationsController.startPolling()
  → false: show #loginScreen, hide #mainApp, clearActiveGame(),
           notificationsController.stopPolling()
```

**Auth operations:** `handleGoogleSignIn()` → `FirebaseService.signInWithGoogle()` | `handleEmailSignIn()` → `FirebaseService.signInWithEmail()` | `handleSignOut()` → `FirebaseService.signOut()` | Create account / password reset via `DSAuthUiController`

### 3. Navigation

**Menu toggle:** `#navMenuBtn` click → `toggleNavigationMenu()` [app.js] → `DSShellNavigationController.syncMenuVisibility()` → toggles `hidden`/`ui-open` on `#navMenuPanel`

**Page switching:** All call `hideAllMainPages()` then show target:

| Button | Function | Shows |
|---|---|---|
| `#navGeneratorBtn` / `#mobileNavGeneratorBtn` | `showGeneratorPage()` | `#selectionSection` + `#configPage` |
| `#navPlayersBtn` / `#mobileNavPlayersBtn` | `showPlayersManagementPage()` | `#playersManagementPage` |
| `#navConfigBtn` / `#mobileNavConfigBtn` | `showConfigurationPage()` | `#configPage` |
| `#navAllianceBtn` / `#mobileNavAllianceBtn` | `showAlliancePage()` | `#alliancePage` |
| `#navSupportBtn` | `showSupportPage()` | `#supportPage` |
| `#navEventHistoryBtn` | inline handler | `#eventHistoryView` via `_eventHistoryController` |
| `#navPlayerUpdatesBtn` | inline handler | `#playerUpdatesReviewView` via `refreshPlayerUpdatesPanel()` |

Navigation state tracked via `currentPageView` in `app.js`. Mobile bottom nav (`#mobileBottomNav`) mirrors desktop. `DSShellNavigationController` provides `syncNavigationButtons()` and `applyPageVisibility()`.

### 4. Generator / Team Assignment

```
Player selection: #playersTableBody click (delegated)
  → .team-a-btn/.team-b-btn → toggleTeam(name, team) [app.js]
      → DSFeatureGeneratorTeamSelection.toggleTeamSelection()
      → teamSelections.teamA/teamB updated → updateTeamCounters()

Team generation: #generateBtnA/#generateBtnB click → generateTeamAssignments(team) [app.js]
  → enforceGameplayContext()
  → refreshBuildingConfigForAssignments()
  → preparePlayersForAssignment() via DSCoreGeneratorAssignment
  → resolveCurrentEventAssignmentSelection() via DSAssignmentRegistry
  → DSCoreAssignment.assignTeamToBuildings(players, buildingConfig)
  → assignmentsA/assignmentsB stored → openDownloadModal(team)

Download: DSDownloadController.downloadTeamExcel()
  → lazy loads vendor/xlsx.full.min.js → builds XLSX → XLSX.writeFile()
  DSDownloadController.downloadTeamMap()
  → draws canvas with map + markers → <a download> click
```

**Key globals:** `teamSelections`, `assignmentsA/B`, `substitutesA/B`, `allPlayers`, `activeDownloadTeam`, `DSCoreAssignment`, `DSAssignmentRegistry`, `DSFeatureGeneratorTeamSelection`, `DSFeatureGeneratorController`, `DSDownloadController`, `DSCoreGeneratorAssignment`

### 5. Players Management

```
Add: #playersMgmtAddForm submit → PlayersManagementController.submitAddPlayer()
  → handlePlayersManagementAddPlayer() [app.js]
  → FirebaseService.upsertPlayerEntry(source, null, playerData)
  → Firestore write → loadPlayerData() → re-renders

Edit: #playersMgmtTableBody click (delegated)
  → btn[data-pm-action="edit"] → inline edit mode (DSFeaturePlayersManagementView)
  → btn[data-pm-action="save"] → FirebaseService.upsertPlayerEntry()
  → btn[data-pm-action="cancel"] → exits edit mode, restores original
  → btn[data-pm-action="delete"] → confirm() → FirebaseService.removePlayerEntry()

Upload: #uploadPlayerBtn → #playerFileInput → DSPlayerDataUpload.uploadPlayerData()
  → XLSX.read() → normalizes → FirebaseService.uploadPlayerDatabase()

Search/Filter: #playersMgmtSearchFilter input → handlePlayersManagementFilterChange()
  → renderPlayersManagementPanel() with filtered/sorted list
```

**Key globals:** `DSFeaturePlayersManagementController`, `DSFeaturePlayersManagementView`, `DSFeaturePlayersManagementActions`, `DSFeaturePlayersManagementCore`, `DSPlayerDataUpload`, `DSPlayerTableUI`

### 6. Events Manager

```
Registry: buildRegistryFromStorage() → DSCoreEvents.buildRegistryFromStorage()
  → reads localStorage('ds_events_v2') → populates event registry

Selection: #eventSelect change → switchEvent(eventId) [app.js]
  → currentEvent = eventId → updateGenerateEventLabels() → renderBuildingsTable()

Create/Edit: #eventEditModeBtn → enterEventEditMode()
  → #saveEventBtn → DSCoreEvents.upsertEvent() → FirebaseService.saveEventData()
  → Firestore write: users/{uid}/games/{gameId}/events/{eventId}
  → Logo: DSEventsImageProcessor.processLogoFile()
  → Map: DSEventsMapController.processMapFile()
```

**Key globals:** `currentEvent`, `DSCoreEvents`, `DSEventSelectorView`, `DSFeatureEventsManagerController`, `DSEventsRegistryController`, `DSEventsImageProcessor`, `DSEventsMapController`, `DSEventListUI`

### 7. Alliance

```
Create: onCreateAlliance() → FirebaseService.createAlliance(name, context)
  → Firestore write: games/{gameId}/alliances/{allianceId}

Invite: onSendInvitation() → FirebaseService.sendInvitation(email, context)
  → Firestore write: alliances/{id}/invitations/{inviteId}

Accept: onAcceptInvitation(id) → FirebaseService.acceptInvitation(id, context)
  → Firestore update: invitation status, user joins members

Leave: onLeaveAlliance() → FirebaseService.leaveAlliance(context)
  → Firestore: removes membership, clears alliance reference

Real-time: FirebaseService.setAllianceDataCallback() → handleAllianceDataRealtimeUpdate()
  → renderAlliancePanel(), updateAllianceHeaderDisplay()
```

**Key globals:** `DSFeatureAllianceController`, `DSAlliancePanelUI`, `getAllianceFeatureController`

### 8. Notifications

```
Polling: notificationsController.startPolling() (after sign-in)
  → setInterval(60s) → checkAndDisplayNotifications() [app.js]
      → FirebaseService.checkInvitations() → updates #notificationBadge

Sheet: #notificationBtn click → toggleNotificationsPanel()
  → DSShellNotificationsSheetController.setSheetState(open/closed)
  → renderNotifications()
```

**Key globals:** `DSFeatureNotificationsController`, `DSFeatureNotificationsCore`, `DSShellNotificationsSheetController`

### 9. Event History

```
Init: setDataLoadCallback → DSFeatureEventHistoryController.init(FirebaseService)
  → subscribePendingFinalizationCount() → real-time listener on event_history

Show: #navEventHistoryBtn → _eventHistoryController.showEventHistoryView()
  → loadHistoryRecords() → DSFeatureEventHistoryView.renderHistoryList()

Save: DSFeatureEventHistoryController.saveAssignmentAsHistory(assignment)
  → DSFeatureEventHistoryCore.buildHistoryRecord() → gateway.saveHistoryRecord()
  → Firestore write: alliances/{id}/event_history/{historyId}

Finalize: finalizeAttendance(historyId)
  → DSCoreReliability.recalculatePlayerStats()
  → gateway.finalizeHistory() → Firestore: finalized=true + player_stats writes
```

**Key globals:** `DSFeatureEventHistoryController/Core/View/Actions`, `_eventHistoryController`

### 10. Player Updates

```
Init: setDataLoadCallback → DSFeaturePlayerUpdatesController.init(FirebaseService)
      setAllianceDataCallback → _playerUpdatesController.subscribeBadge()

Generate shared invite: Players Management invite button → app.js `onInviteButtonClick`/`onSharedInviteClick` handlers
  → FirebaseService.createPersonalSharedUpdateInvite() / createAllianceSharedUpdateInvite()
  → Firestore write: shared_update_invites/{inviteId}
  → URL to player-update.html?shared={inviteId}

Player-facing: player-update.html?shared=... → js/player-update/player-update.js
  → validates token → player fills form → creates pending_updates doc

Review: #navPlayerUpdatesBtn → refreshPlayerUpdatesPanel()
  → loadPendingUpdates() → DSFeaturePlayerUpdatesView.renderReviewPanel()
  → Approve: applyPlayerUpdateToPersonal/Alliance → Firestore writes
  → Reject: updatePendingUpdateStatus → status='rejected'
```

**Key globals:** `DSFeaturePlayerUpdatesController/Core/View/Actions`, `_playerUpdatesController`

### 11. Buildings Config

```
Load: setDataLoadCallback → loadBuildingConfig() [app.js]
  → DSBuildingsConfigManager.loadBuildingConfig(deps) → FirebaseService.getBuildingConfig()

Edit: Buildings table inline editing via DSBuildingsConfigManager.toggleBuildingFieldEdit()
Save: #saveBuildingConfigBtn → DSBuildingsConfigManager.saveBuildingConfig()
  → FirebaseService.saveBuildingConfig(eventId, config, context)

Coordinate picker: #mapCoordinatesBtn → DSCoordinatePickerController.openCoordinatesPicker()
  → canvas click → stores x,y per building
  → #coordSaveBtn → DSBuildingsConfigManager.saveBuildingPositions()
```

**Key globals:** `DSBuildingsConfigManager`, `DSCoordinatePickerController`, `DSCoreBuildings`

### 12. Settings / User Profile

```
Open: #headerProfileBtn or #navSettingsBtn → DSAuthUiController.openSettingsModal()
  → DSShellModalController.open({ overlay: #settingsModal })

Save: #settingsSaveBtn → DSAuthUiController.saveSettings()
  → FirebaseService.saveUserProfile() → updateUserHeaderIdentity()

Avatar: #settingsAvatarUploadBtn → #settingsAvatarInput change
  → DSAuthUiController.handleSettingsAvatarChange() → canvas resize → data URL

Delete account: #settingsDeleteBtn → DSAuthUiController.deleteAccountFromSettings()
  → FirebaseService.deleteAccount() → firebase.auth().currentUser.delete()
```

**Key globals:** `DSAuthUiController`, `currentAuthUser`

### 13. i18n

```
Init: app-init.js → initLanguage() → DSI18N.init({ onApply: onI18nApplied })
  → reads localStorage('ds_language') → applyTranslations()
  → querySelectorAll('[data-i18n]') → el.textContent = t(key)
  → querySelectorAll('[data-i18n-placeholder]') → el.placeholder = t(key)
  → onI18nApplied() re-renders dynamic content

Switch: #languageSelect change → DSI18N.setLanguage(lang)
  → localStorage.setItem('ds_language', lang) → applyTranslations()
```

**Key globals:** `DSI18N`, `window.translations` (from `translations.js`), `window.t` (shorthand from `app.js`)

### 14. Game Selector

```
Post-auth (no active game): showPostAuthGameSelector()
  → DSGameSelectorController.showPostAuthGameSelector()
  → FirebaseService.listAvailableGames() → render options
  → user picks → confirmGameSelectorChoice() → applyGameSwitch(gameId)
      → FirebaseService.setActiveGame(gameId) → localStorage + window.__ACTIVE_GAME_ID
      → loadPlayerData(), updateAllianceHeaderDisplay()

Switch: #navSwitchGameBtn → openGameSelector({ requireChoice: false })
```

**Key globals:** `DSGameSelectorController`, `__ACTIVE_GAME_ID`, `getActiveGame()`, `setActiveGame()`, `getGameplayContext()`

### 15. Onboarding Tour

```
After sign-in → initOnboarding() → DSOnboardingController.initOnboarding()
  → if localStorage('ds_onboarding_done'): skip
  → 11 steps targeting nav buttons, panels, and action buttons
  → #onboardingNextBtn → showOnboardingStep(next)
  → #onboardingSkip or last step → completeOnboarding()
      → localStorage.setItem('ds_onboarding_done', '1')
```

**Key globals:** `DSOnboardingController`

### 16. Data Gateway Architecture

```
Feature controllers → FirebaseService (adapter) → FirebaseManager (facade) → DSFirebaseInfra (paths) → Firestore
```

**Gateway files** in `js/shared/data/`: Each exports `createGateway(utils)` returning async methods. All use `gatewayUtils.withManager(fn, fallback)`.

| Gateway | Key methods |
|---|---|
| `firebase-auth-gateway.js` | signIn, signOut, getUser |
| `firebase-players-gateway.js` | uploadPlayerDatabase, upsertPlayerEntry, removePlayerEntry |
| `firebase-events-gateway.js` | saveEventData, loadEventData, deleteEvent |
| `firebase-alliance-gateway.js` | createAlliance, sendInvitation, acceptInvitation, leaveAlliance |
| `firebase-notifications-gateway.js` | checkInvitations, dismissNotification |
| `firebase-event-history-gateway.js` | saveHistoryRecord, loadHistoryRecords, finalizeHistory |
| `firebase-player-updates-gateway.js` | saveTokenBatch, loadPendingUpdates, applyPlayerUpdate* |
| `firebase-gateway-utils.js` | createUtils(runtime) → { manager(), withManager() } |

**State store:** `DSAppStateStore.createStore(initialState)` — holds navigation, generator, playersManagement, eventHistory, playerUpdates state. Interface: `getState()`, `setState(updater)`, `subscribe(listener)`.

---

## Firestore Data Model

```
users/{uid}/                              ← legacy (read for migration)
  app_config/settings                     ← user preferences (legacy)
  players/{playerId}                      ← player records (legacy)
  events/{eventId}                        ← event configs (legacy)
  games/{gameId}/                         ← per-game user data
    players/{playerId}                    ← { name, power, thp, troops, notes }
    events/{eventId}                      ← { name, logoDataUrl, mapDataUrl, assignmentAlgorithmId,
                                               buildingConfig, buildingConfigVersion,
                                               buildingPositions, buildingPositionsVersion }
    event_media/{eventId}                 ← large binary event assets
    user_state/{uid}                      ← { displayName, nickname, theme, avatarDataUrl,
                                               allianceId, playerSource, migrationVersion }

games/{gameId}/                           ← shared game-level data
  alliances/{allianceId}/                 ← { name, ownerId, memberUids[], createdAt, gameId }
    members/{uid}                         ← membership records
    invitations/{inviteId}                ← { toEmail, toUid, fromUid, inviterName, status,
                                               gameId, createdAt, resendCount }
    alliance_players/{playerId}           ← { name, power, thp, troops, notes }
    update_tokens/{tokenId}               ← { token, playerName, allianceId, createdByUid,
                                               expiresAt, used, gameId, currentSnapshot }
    pending_updates/{updateId}            ← { playerName, proposedValues, status,
                                               submittedAt, reviewedBy, contextType }
    event_history/{historyId}             ← legacy dual-write (alliance path, read as fallback)
      attendance/{playerDocId}            ← legacy attendance subcollection
  user_state/{uid}                        ← { allianceId, playerSource, migrationVersion }
  soloplayers/{uid}/                      ← non-alliance user data
    players/{playerId}                    ← personal player DB
    update_tokens/{tokenId}               ← personal update tokens
    pending_updates/{updateId}            ← personal pending updates
  event_history/{historyId}               ← { eventName, eventTypeId, team, players[],
                                               gameId, createdByUid, createdAt,
                                               active, finalized, finalizedAt }
                                            Single collection for all users (solo + alliance).
                                            Alliance members share records via allianceId field.
                                            10-entry limit per eventTypeId enforced on write.
    player_stats/{playerDocId}            ← { playerName, team, status, markedBy, markedAt }
```

### Collection → Code mapping

| Collection | Read by | Written by |
|---|---|---|
| `users/{uid}/games/{gid}/players` | `FirebaseManager.loadUserData()` | `upsertPlayerEntry()`, `uploadPlayerDatabase()` |
| `users/{uid}/games/{gid}/events` | `FirebaseManager.loadUserData()` | `saveEventData()`, `saveBuildingConfig/Positions()` |
| `users/{uid}/games/{gid}/user_state` | `FirebaseManager.loadUserData()` | `saveUserProfile()`, `setPlayerSource()` |
| `alliances/{id}` | `loadAllianceData()` | `createAlliance()`, `leaveAlliance()`, `acceptInvitation()` |
| `alliances/{id}/invitations` | `checkInvitations()` | `sendInvitation()`, `acceptInvitation()`, `revokeInvitation()` |
| `alliances/{id}/alliance_players` | `getAlliancePlayerDatabase()` | `uploadAlliancePlayerDatabase()`, `applyPlayerUpdateToAlliance()` |
| `alliances/{id}/update_tokens` | `loadActiveTokens()` | `saveTokenBatch()`, `revokeToken()` |
| `alliances/{id}/pending_updates` | `loadPendingUpdates()`, `subscribePendingUpdatesCount()` | player-update.html, `updatePendingUpdateStatus()` |
| `games/{gid}/event_history` | `loadHistoryRecords()` | `saveHistoryRecord()`, `finalizeHistory()`, `enforceEventHistoryLimit()` |
| `games/{gid}/event_history/{id}/player_stats` | `loadEventAttendance()` | `saveAttendanceBatch()`, `updateAttendanceStatus()`, `finalizeHistory()` |
| `alliances/{id}/event_history` | `loadHistoryRecords()` (fallback), `subscribePendingFinalizationCount()` | `saveHistoryRecord()` (legacy dual-write) |

### Key Window Globals Reference

| Global | Source | Role |
|---|---|---|
| `FirebaseManager` | `firebase-module.js` | Primary Firestore/Auth facade |
| `FirebaseService` | `js/services/firebase-service.js` | Testable adapter over FirebaseManager |
| `DSFirebaseInfra` | `firebase-infra.js` | Path builders, feature flags |
| `DSFirebaseAuth` | `firebase-auth-module.js` | Auth lifecycle |
| `DSI18N` | `js/core/i18n.js` | i18n engine |
| `t` | `app.js` | Shorthand translation function |
| `DSCoreAssignment` | `js/core/assignment.js` | Team→building assignment |
| `DSAssignmentRegistry` | `js/core/assignment-registry.js` | Algorithm registry per game |
| `DSCoreEvents` | `js/core/events.js` | Event registry and defaults |
| `DSCoreBuildings` | `js/core/buildings.js` | Building config normalization |
| `DSCoreGeneratorAssignment` | `js/core/generator-assignment.js` | Prepare players for assignment |
| `DSCoreReliability` | `js/core/reliability.js` | Stats recalculation |
| `DSPlayerTableUI` | `js/ui/player-table-ui.js` | Player table row rendering |
| `DSAlliancePanelUI` | `js/ui/alliance-panel-ui.js` | Alliance panel HTML builder |
| `DSEventListUI` | `js/ui/event-list-ui.js` | Events list rendering |
| `DSAppShellBootstrap` | `js/shell/bootstrap/app-shell-bootstrap.js` | Boot trigger |
| `DSAppShellContracts` | `js/shell/bootstrap/app-shell-contracts.js` | Controller contract factory |
| `DSShellNavigationController` | `js/shell/navigation/navigation-controller.js` | Nav helpers |
| `DSShellModalController` | `js/shell/overlays/modal-controller.js` | Modal open/close |
| `DSShellNotificationsSheetController` | `js/shell/overlays/notifications-sheet-controller.js` | Notifications drawer |
| `DSOnboardingController` | `js/shell/onboarding-controller.js` | Tour steps |
| `DSGameSelectorController` | `js/shell/game-selector-controller.js` | Post-auth / switch game |
| `DSAuthUiController` | `js/shell/auth-ui-controller.js` | Settings, avatar, delete account |
| `DSAppStateStore` | `js/shared/state/app-state-store.js` | Observable state store |
| `__ACTIVE_GAME_ID` | runtime | Active game string |
| `allPlayers` | `app.js` | Normalized player array |
| `currentAuthUser` | `app.js` | Firebase User object |
| `currentEvent` | `app.js` | Active event ID string |
| `teamSelections` | `app.js` | `{ teamA: [], teamB: [] }` |
| `_eventHistoryController` | `app-init.js` | Runtime event history instance |
| `_playerUpdatesController` | `app-init.js` | Runtime player updates instance |
