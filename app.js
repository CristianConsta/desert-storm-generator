// ============================================================
// I18N
// ============================================================

function t(key, params) {
    return window.DSI18N.t(key, params);
}

function refreshLanguageDependentText() {
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl && typeof allPlayers !== 'undefined') {
        if (typeof FirebaseService !== 'undefined') {
            const gameplayContext = getGameplayContext();
            const source = FirebaseService.getPlayerSource && FirebaseService.getPlayerSource(gameplayContext || undefined);
            const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
            playerCountEl.textContent = t('player_count_with_source', { count: allPlayers.length, source: sourceLabel });
        } else {
            playerCountEl.textContent = t('player_count', { count: allPlayers.length });
        }
    }
    const uploadHintEl = document.getElementById('uploadHint');
    if (uploadHintEl && typeof allPlayers !== 'undefined') {
        uploadHintEl.textContent = allPlayers.length > 0 ? t('upload_hint') : '';
    }
}

function onI18nApplied() {
    renderAllEventSelectors();
    renderEventsList();
    updateEventEditorTitle();
    updateEventEditorState();
    refreshLanguageDependentText();
    renderPlayersManagementPanel();
    renderPlayersTable();
    renderBuildingsTable();
    updateTeamCounters();
    syncAssignmentAlgorithmControl();
    const navMenuBtn = document.getElementById('navMenuBtn');
    if (navMenuBtn) {
        navMenuBtn.title = t('navigation_menu');
        navMenuBtn.setAttribute('aria-label', t('navigation_menu'));
    }
    const navMenuPanel = document.getElementById('navMenuPanel');
    if (navMenuPanel) {
        navMenuPanel.setAttribute('aria-label', t('navigation_menu'));
    }
    const profileBtn = document.getElementById('headerProfileBtn');
    if (profileBtn) {
        profileBtn.title = t('settings_button');
        profileBtn.setAttribute('aria-label', t('settings_button'));
    }
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.title = t('notifications_title');
    }
    updateUserHeaderIdentity(currentAuthUser);
    updateActiveGameBadge();
    refreshGameSelectorMenuAvailability();
    syncNavigationMenuState();
    const coordOverlay = document.getElementById('coordPickerOverlay');
    if (coordOverlay && !coordOverlay.classList.contains('hidden')) {
        updateCoordLabel();
    }
    const downloadOverlay = document.getElementById('downloadModalOverlay');
    if (downloadOverlay && !downloadOverlay.classList.contains('hidden') && activeDownloadTeam) {
        const team = activeDownloadTeam;
        document.getElementById('downloadModalTitle').textContent = t('download_modal_title', { team: team });
        document.getElementById('downloadModalSubtitle').textContent = t('download_modal_subtitle', { team: team });
    }
    updateOnboardingTooltip();
}

function applyTranslations() {
    window.DSI18N.applyTranslations();
}

function initLanguage() {
    window.DSI18N.init({
        onApply: () => {
            onI18nApplied();
        },
    });
}

const UI_MOTION_MS = Object.freeze({
    panel: 170,
});

function clearPanelMotionTimer(element) {
    if (!element || !element.dataset) {
        return;
    }
    const timerId = Number(element.dataset.motionTimerId || 0);
    if (timerId) {
        clearTimeout(timerId);
    }
    delete element.dataset.motionTimerId;
}

function scheduleFrame(callback) {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(callback);
    } else {
        setTimeout(callback, 0);
    }
}

function setPanelVisibility(element, shouldOpen) {
    if (!element) {
        return;
    }
    clearPanelMotionTimer(element);
    element.style.setProperty('--panel-motion-ms', `${UI_MOTION_MS.panel}ms`);
    if (shouldOpen) {
        element.classList.remove('hidden');
        scheduleFrame(() => {
            element.classList.add('ui-open');
        });
        return;
    }
    element.classList.remove('ui-open');
    const timerId = setTimeout(() => {
        element.classList.add('hidden');
    }, UI_MOTION_MS.panel);
    if (element.dataset) {
        element.dataset.motionTimerId = String(timerId);
    }
}

function openModalOverlay(overlay, options) {
    if (!(overlay instanceof HTMLElement)) {
        return;
    }
    const focusSelector = options && typeof options.initialFocusSelector === 'string'
        ? options.initialFocusSelector
        : null;
    if (window.DSShellModalController && typeof window.DSShellModalController.open === 'function') {
        window.DSShellModalController.open({
            overlay: overlay,
            initialFocusSelector: focusSelector,
        });
        return;
    }
    overlay.classList.remove('hidden');
    const focusTarget = focusSelector ? overlay.querySelector(focusSelector) : null;
    if (focusTarget instanceof HTMLElement) {
        scheduleFrame(() => focusTarget.focus());
    }
}

function closeModalOverlay(overlay) {
    if (!(overlay instanceof HTMLElement)) {
        return false;
    }
    if (window.DSShellModalController && typeof window.DSShellModalController.close === 'function') {
        return window.DSShellModalController.close({
            overlay: overlay,
        });
    }
    overlay.classList.add('hidden');
    return true;
}

function listSelectableGames() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.listAvailableGames !== 'function') {
        return [];
    }
    const games = FirebaseService.listAvailableGames();
    if (!Array.isArray(games)) {
        return [];
    }
    const metadataById = new Map();
    const _gmCache = DSGameMetadataAdminController.getGameMetadataCatalogCache();
    if (Array.isArray(_gmCache)) {
        _gmCache
            .map(normalizeGameMetadataEntry)
            .filter(Boolean)
            .forEach((metadata) => {
                metadataById.set(metadata.id, metadata);
            });
    }
    return games
        .map((game) => {
            const id = game && typeof game.id === 'string' ? game.id.trim() : '';
            if (!id) {
                return null;
            }
            const catalogName = game && typeof game.name === 'string' && game.name.trim()
                ? game.name.trim()
                : id;
            const catalogLogo = game && typeof game.logo === 'string' ? game.logo.trim() : '';
            const metadata = metadataById.get(id) || null;
            const name = metadata && typeof metadata.name === 'string' && metadata.name.trim()
                ? metadata.name.trim()
                : catalogName;
            const logo = metadata && typeof metadata.logo === 'string' && metadata.logo.trim()
                ? metadata.logo.trim()
                : catalogLogo;
            return { id, name, logo };
        })
        .filter(Boolean);
}

function getSelectableGameById(gameId) {
    const normalizedId = typeof gameId === 'string' ? gameId.trim() : '';
    if (!normalizedId) {
        return null;
    }
    const selectableGame = listSelectableGames().find((game) => game.id === normalizedId) || null;
    if (selectableGame) {
        return selectableGame;
    }
    const _gmCache2 = DSGameMetadataAdminController.getGameMetadataCatalogCache();
    const cachedGame = Array.isArray(_gmCache2)
        ? _gmCache2.find((game) => game && game.id === normalizedId)
        : null;
    return cachedGame ? normalizeGameMetadataEntry(cachedGame) : null;
}

function resolveActiveGameName(gameId) {
    const selectedGame = getSelectableGameById(gameId);
    if (selectedGame && selectedGame.name) {
        return selectedGame.name;
    }
    if (!gameId) {
        return '';
    }
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.listAvailableGames !== 'function') {
        return gameId;
    }
    const games = FirebaseService.listAvailableGames();
    const match = Array.isArray(games) ? games.find((game) => game && game.id === gameId) : null;
    if (match && typeof match.name === 'string' && match.name.trim()) {
        return match.name.trim();
    }
    return gameId;
}

function updateActiveGameBadge(forcedGameId) {
    const badge = document.getElementById('activeGameBadge');
    const image = document.getElementById('activeGameBadgeImage');
    const initials = document.getElementById('activeGameBadgeInitials');
    if (!badge) {
        return;
    }
    const activeGameId = typeof forcedGameId === 'string' && forcedGameId.trim()
        ? forcedGameId.trim()
        : getActiveGame();
    if (!activeGameId) {
        badge.classList.add('hidden');
        badge.setAttribute('title', '');
        if (image) {
            image.src = '';
            image.classList.add('hidden');
        }
        if (initials) {
            initials.textContent = '';
        }
        return;
    }
    const selectedGame = getSelectableGameById(activeGameId);
    const gameName = selectedGame && selectedGame.name ? selectedGame.name : resolveActiveGameName(activeGameId);
    const gameLogo = selectedGame && typeof selectedGame.logo === 'string' ? selectedGame.logo.trim() : '';
    const fallbackAvatar = generateGameAvatarDataUrl(gameName || activeGameId, activeGameId);
    applyAvatar(gameLogo || fallbackAvatar, image, initials, getAvatarInitials(gameName || activeGameId, 'G'));
    badge.classList.remove('hidden');
    badge.setAttribute('title', gameName || activeGameId);
}

function refreshGameSelectorMenuAvailability() {
    const switchBtn = document.getElementById('navSwitchGameBtn');
    if (!switchBtn) {
        return;
    }
    const hasGames = listSelectableGames().length > 0;
    switchBtn.classList.toggle('hidden', !hasGames);
    switchBtn.disabled = !hasGames;
}

function getActiveGameContext() { return DSGameSelectorController.getActiveGameContext(); }
function getActiveGame() { return getActiveGameContext().gameId; }

function setActiveGame(gameId) {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.setActiveGame !== 'function') {
        return { success: false, code: 'firebase-service-unavailable' };
    }
    const result = FirebaseService.setActiveGame(gameId);
    if (result && result.success && result.gameId) {
        window.__ACTIVE_GAME_ID = result.gameId;
        updateActiveGameBadge(result.gameId);
    }
    return result;
}

function ensureActiveGameContext() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.ensureActiveGame !== 'function') {
        return '';
    }
    const context = FirebaseService.ensureActiveGame();
    const gameId = context && typeof context.gameId === 'string' ? context.gameId : '';
    window.__ACTIVE_GAME_ID = gameId;
    updateActiveGameBadge(gameId);
    return gameId;
}

function enforceGameplayContext(s) { return DSGameSelectorController.enforceGameplayContext(s); }
function getGameplayContext(s) { return DSGameSelectorController.getGameplayContext(s); }
function getEventGameplayContext(e, s) { return DSGameSelectorController.getEventGameplayContext(e, s); }
function setGameSelectorSelection(g) { return DSGameSelectorController.setGameSelectorSelection(g); }
function closeGameSelector(f) { return DSGameSelectorController.closeGameSelector(f); }
function openGameSelector(o) { return DSGameSelectorController.openGameSelector(o); }
function handleGameSelectorOverlayClick(e) { return DSGameSelectorController.handleGameSelectorOverlayClick(e); }
function handleGameSelectorListClick(e) { return DSGameSelectorController.handleGameSelectorListClick(e); }
function handleGameSelectorListKeydown(e) { return DSGameSelectorController.handleGameSelectorListKeydown(e); }

function normalizeFilterPanels() {
    const troopsFilterBtn = document.getElementById('troopsFilterBtn');
    if (troopsFilterBtn) {
        troopsFilterBtn.classList.remove('active');
    }
    document.querySelectorAll('.filter-dropdown-panel').forEach((panel) => {
        const defaultVal = panel.id === 'troopsFilterPanel' ? '' : 'power-desc';
        panel.querySelectorAll('.filter-option').forEach((opt) => {
            opt.classList.toggle('selected', opt.dataset.value === defaultVal);
        });
    });
}

function resetTransientPlanningState(options) {
    const config = options && typeof options === 'object' ? options : {};
    teamSelections.teamA = [];
    teamSelections.teamB = [];
    assignmentsA = [];
    assignmentsB = [];
    substitutesA = [];
    substitutesB = [];
    closeDownloadModal();

    const searchFilterInput = document.getElementById('searchFilter');
    if (searchFilterInput) {
        searchFilterInput.value = '';
    }
    currentTroopsFilter = '';
    currentSortFilter = 'power-desc';
    normalizeFilterPanels();

    if (config.renderPlayersTable !== false) {
        renderPlayersTable();
    }
    updateTeamCounters();
}

function confirmGameSelectorChoice() { return DSGameSelectorController.confirmGameSelectorChoice(); }
function showPostAuthGameSelector() { return DSGameSelectorController.showPostAuthGameSelector(); }
function resetPostAuthGameSelectorState() { return DSGameSelectorController.resetPostAuthGameSelectorState(); }
function isPostAuthGameSelectionPending() { return DSGameSelectorController.isPostAuthGameSelectionPending(); }

function syncGameMetadataMenuAvailability() { return DSGameMetadataAdminController.syncGameMetadataMenuAvailability(); }
function normalizeGameMetadataEntry(e) { return DSGameMetadataAdminController.normalizeGameMetadataEntry(e); }
function generateGameAvatarDataUrl(n, i) { return DSGameMetadataAdminController.generateGameAvatarDataUrl(n, i); }
async function refreshGameMetadataCatalogCache(o) { return DSGameMetadataAdminController.refreshGameMetadataCatalogCache(o); }
function openGameMetadataOverlay() { return DSGameMetadataAdminController.openGameMetadataOverlay(); }
function closeGameMetadataOverlay() { return DSGameMetadataAdminController.closeGameMetadataOverlay(); }
function handleGameMetadataOverlayClick(e) { return DSGameMetadataAdminController.handleGameMetadataOverlayClick(e); }
function handleGameMetadataSelectionChange() { return DSGameMetadataAdminController.handleGameMetadataSelectionChange(); }
function triggerGameMetadataLogoUpload() { return DSGameMetadataAdminController.triggerGameMetadataLogoUpload(); }
function removeGameMetadataLogo() { return DSGameMetadataAdminController.removeGameMetadataLogo(); }
function handleGameMetadataLogoChange(e) { return DSGameMetadataAdminController.handleGameMetadataLogoChange(e); }
function saveGameMetadata() { return DSGameMetadataAdminController.saveGameMetadata(); }
function updateGameMetadataLogoPreview() { return DSGameMetadataAdminController.updateGameMetadataLogoPreview(); }

window.t = t;
window.initLanguage = initLanguage;
window.applyTranslations = applyTranslations;
window.updateGenerateEventLabels = updateGenerateEventLabels;
window.loadPlayerData = loadPlayerData;
window.loadBuildingConfig = loadBuildingConfig;
window.loadBuildingPositions = loadBuildingPositions;
window.updateAllianceHeaderDisplay = updateAllianceHeaderDisplay;
window.checkAndDisplayNotifications = checkAndDisplayNotifications;
window.initOnboarding = initOnboarding;
window.startNotificationPolling = startNotificationPolling;
window.stopNotificationPolling = stopNotificationPolling;
window.setActiveGame = setActiveGame;
window.getActiveGame = getActiveGame;
window.updateActiveGameBadge = updateActiveGameBadge;
window.refreshGameMetadataCatalogCache = refreshGameMetadataCatalogCache;
window.showPostAuthGameSelector = showPostAuthGameSelector;
window.resetPostAuthGameSelectorState = resetPostAuthGameSelectorState;
window.isPostAuthGameSelectionPending = isPostAuthGameSelectionPending;
window.initializeApplicationUiRuntime = initializeApplicationUiRuntime;
window.updateUserHeaderIdentity = updateUserHeaderIdentity;
window.handleAllianceDataRealtimeUpdate = handleAllianceDataRealtimeUpdate;

// ============================================================
// ONBOARDING TOUR (delegated to DSOnboardingController)
// ============================================================
function initOnboarding() { window.DSOnboardingController.initOnboarding(); }
function updateOnboardingTooltip() { window.DSOnboardingController.updateOnboardingTooltip(); }

function bindStaticUiActions() {
    const on = (id, eventName, handler) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(eventName, handler);
        }
    };

    on('googleSignInBtn', 'click', handleGoogleSignIn);
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            handleEmailSignIn();
        });
    }
    on('showSignUpBtn', 'click', showSignUpForm);
    on('passwordResetBtn', 'click', handlePasswordReset);

    function refreshPlayerUpdatesPanel() {
        const fs = window.FirebaseService;
        const container = document.getElementById('playerUpdatesReviewContainer');
        if (!container || !window.DSFeaturePlayerUpdatesView || !fs) {
            if (container && window.DSFeaturePlayerUpdatesView) {
                window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
            }
            return;
        }
        const allianceId = fs.getAllianceId ? fs.getAllianceId() : null;
        const currentUser = fs.getCurrentUser ? fs.getCurrentUser() : null;
        const uid = currentUser ? currentUser.uid : null;

        function hasUsableSnapshot(snapshot) {
            if (!snapshot || typeof snapshot !== 'object') {
                return false;
            }
            const hasPower = snapshot.power !== null && snapshot.power !== undefined && snapshot.power !== '';
            const hasThp = snapshot.thp !== null && snapshot.thp !== undefined && snapshot.thp !== '';
            const hasTroops = typeof snapshot.troops === 'string' && snapshot.troops.trim() !== '';
            return hasPower || hasThp || hasTroops;
        }

        function normalizeLookupName(name) {
            return typeof name === 'string' ? name.trim().toLowerCase() : '';
        }

        function findPlayerSnapshotByName(playerMap, playerName) {
            if (!playerMap || typeof playerMap !== 'object') {
                return null;
            }
            const trimmedName = typeof playerName === 'string' ? playerName.trim() : '';
            if (!trimmedName) {
                return null;
            }

            var entry = playerMap[trimmedName];
            if (!entry) {
                const wanted = normalizeLookupName(trimmedName);
                const keys = Object.keys(playerMap);
                for (let i = 0; i < keys.length; i += 1) {
                    if (normalizeLookupName(keys[i]) === wanted) {
                        entry = playerMap[keys[i]];
                        break;
                    }
                }
            }

            if (!entry || typeof entry !== 'object') {
                return null;
            }
            const snapshot = {
                power: entry.power,
                thp: entry.thp,
                troops: entry.troops,
            };
            return hasUsableSnapshot(snapshot) ? snapshot : null;
        }

        function findPlayerSnapshotByKey(playerMap, playerKey) {
            if (!playerMap || typeof playerMap !== 'object') {
                return null;
            }
            const normalizedKey = typeof playerKey === 'string' ? playerKey.trim() : '';
            if (!normalizedKey) {
                return null;
            }
            const docIdResolver = window.DSFirebaseInfra && typeof window.DSFirebaseInfra.getPlayerDocId === 'function'
                ? window.DSFirebaseInfra.getPlayerDocId
                : null;
            if (!docIdResolver) {
                return null;
            }
            const keys = Object.keys(playerMap);
            const matchedName = keys.find(function(name) {
                return docIdResolver(name) === normalizedKey;
            });
            if (!matchedName || !playerMap[matchedName] || typeof playerMap[matchedName] !== 'object') {
                return null;
            }
            const entry = playerMap[matchedName];
            const snapshot = {
                power: entry.power,
                thp: entry.thp,
                troops: entry.troops,
            };
            return hasUsableSnapshot(snapshot) ? snapshot : null;
        }

        function findSnapshotInLoadedPlayers(playerName) {
            const players = Array.isArray(window.allPlayers) ? window.allPlayers : [];
            if (!players.length) {
                return null;
            }
            const wanted = normalizeLookupName(playerName);
            if (!wanted) {
                return null;
            }
            let match = players.find(function(player) {
                return normalizeLookupName(player && player.name) === wanted;
            });
            if (!match || typeof match !== 'object') {
                return null;
            }
            const snapshot = {
                power: match.power,
                thp: match.thp,
                troops: match.troops,
            };
            return hasUsableSnapshot(snapshot) ? snapshot : null;
        }

        function hydrateMissingSnapshots(updates) {
            if (!Array.isArray(updates) || updates.length === 0) {
                return Array.isArray(updates) ? updates : [];
            }

            let alliancePlayerMap = {};
            let personalPlayerMap = {};
            try {
                if (allianceId && typeof fs.getAlliancePlayerDatabase === 'function') {
                    alliancePlayerMap = fs.getAlliancePlayerDatabase(gameplayContext || undefined) || {};
                }
            } catch {
                alliancePlayerMap = {};
            }
            try {
                if (uid && typeof fs.getPlayerDatabase === 'function') {
                    personalPlayerMap = fs.getPlayerDatabase(gameplayContext || undefined) || {};
                }
            } catch {
                personalPlayerMap = {};
            }

            return updates.map(function(update) {
                if (!update || typeof update !== 'object' || hasUsableSnapshot(update.currentSnapshot)) {
                    return update;
                }

                const sourcePrefersAlliance = update.contextType === 'alliance';
                let snapshot = sourcePrefersAlliance
                    ? findPlayerSnapshotByKey(alliancePlayerMap, update.playerKey)
                    : findPlayerSnapshotByKey(personalPlayerMap, update.playerKey);

                if (!snapshot) {
                    snapshot = sourcePrefersAlliance
                        ? findPlayerSnapshotByName(alliancePlayerMap, update.playerName)
                        : findPlayerSnapshotByName(personalPlayerMap, update.playerName);
                }

                if (!snapshot) {
                    snapshot = sourcePrefersAlliance
                        ? findPlayerSnapshotByKey(personalPlayerMap, update.playerKey)
                        : findPlayerSnapshotByKey(alliancePlayerMap, update.playerKey);
                }

                if (!snapshot) {
                    snapshot = sourcePrefersAlliance
                        ? findPlayerSnapshotByName(personalPlayerMap, update.playerName)
                        : findPlayerSnapshotByName(alliancePlayerMap, update.playerName);
                }
                if (!snapshot) {
                    snapshot = findSnapshotInLoadedPlayers(update.playerName);
                }
                if (!snapshot) {
                    return update;
                }

                return Object.assign({}, update, {
                    currentSnapshot: snapshot,
                });
            });
        }

        var alliancePromise = (allianceId && fs.loadPendingUpdates)
            ? fs.loadPendingUpdates(allianceId, 'pending').catch(function() { return []; })
            : Promise.resolve([]);
        var personalPromise = (uid && fs.loadPersonalPendingUpdates)
            ? fs.loadPersonalPendingUpdates(uid, 'pending').catch(function() { return []; })
            : Promise.resolve([]);

        Promise.all([alliancePromise, personalPromise]).then(function(results) {
            var combined = (results[0] || []).concat(results[1] || []);
            combined = hydrateMissingSnapshots(combined);
            // Register docs with controller so approveUpdate/rejectUpdate can look up metadata
            var playerUpdatesControllerHandle = window._playerUpdatesController || window.DSFeaturePlayerUpdatesController;
            if (playerUpdatesControllerHandle
                && typeof playerUpdatesControllerHandle.setPendingUpdateDocs === 'function') {
                playerUpdatesControllerHandle.setPendingUpdateDocs(combined);
            }
            window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, combined);
        }).catch(function() {
            window.DSFeaturePlayerUpdatesView.renderReviewPanel(container, []);
        });
    }
    window.refreshPlayerUpdatesPanel = refreshPlayerUpdatesPanel;

    on('navMenuBtn', 'click', toggleNavigationMenu);
    on('navGeneratorBtn', 'click', showGeneratorPage);
    on('navConfigBtn', 'click', showConfigurationPage);
    on('navPlayersBtn', 'click', showPlayersManagementPage);
    on('navAllianceBtn', 'click', showAlliancePage);
    on('navSupportBtn', 'click', showSupportPage);
    on('navEventHistoryBtn', 'click', function() {
        hideAllMainPages();
        if (window._eventHistoryController && typeof window._eventHistoryController.showEventHistoryView === 'function') {
            window._eventHistoryController.showEventHistoryView();
        }
        var eventHistoryView = document.getElementById('eventHistoryView');
        if (eventHistoryView) {
            eventHistoryView.classList.remove('hidden');
        }
        resumePendingOnboardingStep();
        closeNavigationMenu();
    });
    on('navPlayerUpdatesBtn', 'click', function() {
        hideAllMainPages();
        const playerUpdatesReviewView = document.getElementById('playerUpdatesReviewView');
        if (playerUpdatesReviewView) {
            const allViewSections = document.querySelectorAll('.view-section');
            allViewSections.forEach(function(s) { s.classList.add('hidden'); });
            playerUpdatesReviewView.classList.remove('hidden');
        }
        refreshPlayerUpdatesPanel();
        closeNavigationMenu();
    });
    on('mobileNavGeneratorBtn', 'click', showGeneratorPage);
    on('mobileNavPlayersBtn', 'click', showPlayersManagementPage);
    on('mobileNavHistoryBtn', 'click', function() {
        hideAllMainPages();
        if (window._eventHistoryController && typeof window._eventHistoryController.showEventHistoryView === 'function') {
            window._eventHistoryController.showEventHistoryView();
        }
        var eventHistoryView = document.getElementById('eventHistoryView');
        if (eventHistoryView) eventHistoryView.classList.remove('hidden');
        resumePendingOnboardingStep();
        closeMobileMoreSheet();
    });
    on('mobileNavMoreBtn', 'click', toggleMobileMoreSheet);

    // Sidebar navigation (desktop)
    on('sidebarGeneratorBtn', 'click', showGeneratorPage);
    on('sidebarPlayersBtn', 'click', showPlayersManagementPage);
    on('sidebarConfigBtn', 'click', showConfigurationPage);
    on('sidebarAllianceBtn', 'click', showAlliancePage);
    on('sidebarSettingsBtn', 'click', openSettingsModal);
    on('sidebarSupportBtn', 'click', showSupportPage);
    on('sidebarGameMetadataBtn', 'click', openGameMetadataOverlay);
    on('sidebarSignOutBtn', 'click', function() { handleSignOut(); });
    on('sidebarEventHistoryBtn', 'click', function() {
        hideAllMainPages();
        if (window._eventHistoryController && typeof window._eventHistoryController.showEventHistoryView === 'function') {
            window._eventHistoryController.showEventHistoryView();
        }
        var eventHistoryView = document.getElementById('eventHistoryView');
        if (eventHistoryView) eventHistoryView.classList.remove('hidden');
        resumePendingOnboardingStep();
    });
    on('sidebarPlayerUpdatesBtn', 'click', function() {
        hideAllMainPages();
        const playerUpdatesReviewView = document.getElementById('playerUpdatesReviewView');
        if (playerUpdatesReviewView) {
            var allViewSections = document.querySelectorAll('.view-section');
            allViewSections.forEach(function(s) { s.classList.add('hidden'); });
            playerUpdatesReviewView.classList.remove('hidden');
        }
        refreshPlayerUpdatesPanel();
    });

    // Mobile "More" sheet items
    on('moreSheetConfigBtn', 'click', function() { closeMobileMoreSheet(); showConfigurationPage(); });
    on('moreSheetAllianceBtn', 'click', function() { closeMobileMoreSheet(); showAlliancePage(); });
    on('moreSheetEventHistoryBtn', 'click', function() {
        closeMobileMoreSheet();
        hideAllMainPages();
        if (window._eventHistoryController && typeof window._eventHistoryController.showEventHistoryView === 'function') {
            window._eventHistoryController.showEventHistoryView();
        }
        var eventHistoryView = document.getElementById('eventHistoryView');
        if (eventHistoryView) eventHistoryView.classList.remove('hidden');
        resumePendingOnboardingStep();
    });
    on('moreSheetPlayerUpdatesBtn', 'click', function() {
        closeMobileMoreSheet();
        hideAllMainPages();
        const playerUpdatesReviewView = document.getElementById('playerUpdatesReviewView');
        if (playerUpdatesReviewView) {
            var allViewSections = document.querySelectorAll('.view-section');
            allViewSections.forEach(function(s) { s.classList.add('hidden'); });
            playerUpdatesReviewView.classList.remove('hidden');
        }
        refreshPlayerUpdatesPanel();
    });
    on('moreSheetSettingsBtn', 'click', function() { closeMobileMoreSheet(); openSettingsModal(); });
    on('moreSheetSupportBtn', 'click', function() { closeMobileMoreSheet(); showSupportPage(); });
    on('moreSheetSignOutBtn', 'click', function() { closeMobileMoreSheet(); handleSignOut(); });

    on('navGameMetadataBtn', 'click', openGameMetadataOverlay);
    on('navSettingsBtn', 'click', openSettingsModal);
    on('navSwitchGameBtn', 'click', () => {
        openGameSelector({ requireChoice: false });
    });
    on('navSignOutBtn', 'click', () => {
        closeNavigationMenu();
        handleSignOut();
    });
    on('headerProfileBtn', 'click', openSettingsModal);
    on('allianceDisplay', 'click', () => {
        const controller = getAllianceFeatureController();
        if (controller && typeof controller.openPanel === 'function') {
            controller.openPanel();
            return;
        }
        showAlliancePage();
    });
    on('allianceCreateBtn', 'click', () => {
        const controller = getAllianceFeatureController();
        if (controller && typeof controller.openPanel === 'function') {
            controller.openPanel();
            return;
        }
        showAlliancePage();
    });
    on('notificationBtn', 'click', () => {
        const controller = getNotificationsFeatureController();
        if (controller && typeof controller.togglePanel === 'function') {
            controller.togglePanel();
            return;
        }
        toggleNotificationsPanel();
    });
    on('notificationsPanelCloseBtn', 'click', () => {
        const controller = getNotificationsFeatureController();
        if (controller && typeof controller.togglePanel === 'function') {
            controller.togglePanel();
            return;
        }
        toggleNotificationsPanel();
    });

    on('settingsModal', 'click', handleModalOverlayDismissClick);
    on('settingsModalCloseBtn', 'click', closeSettingsModal);
    on('settingsAvatarUploadBtn', 'click', triggerSettingsAvatarUpload);
    on('settingsAvatarRemoveBtn', 'click', removeSettingsAvatar);
    on('settingsAvatarInput', 'change', handleSettingsAvatarChange);
    on('settingsDeleteBtn', 'click', deleteAccountFromSettings);
    on('settingsCancelBtn', 'click', closeSettingsModal);
    on('settingsSaveBtn', 'click', saveSettings);
    on('gameSelectorOverlay', 'click', handleGameSelectorOverlayClick);
    on('gameSelectorCancelBtn', 'click', () => closeGameSelector(false));
    on('gameSelectorConfirmBtn', 'click', confirmGameSelectorChoice);
    on('gameSelectorList', 'click', handleGameSelectorListClick);
    on('gameSelectorList', 'keydown', handleGameSelectorListKeydown);
    on('gameSelectorInput', 'change', () => {
        const status = document.getElementById('gameSelectorStatus');
        if (status) {
            status.replaceChildren();
        }
        setGameSelectorSelection(document.getElementById('gameSelectorInput').value);
    });
    on('gameMetadataOverlay', 'click', handleGameMetadataOverlayClick);
    on('gameMetadataCloseBtn', 'click', () => closeGameMetadataOverlay());
    on('gameMetadataSelect', 'change', handleGameMetadataSelectionChange);
    on('gameMetadataNameInput', 'input', updateGameMetadataLogoPreview);
    on('gameMetadataLogoUploadBtn', 'click', triggerGameMetadataLogoUpload);
    on('gameMetadataLogoRemoveBtn', 'click', removeGameMetadataLogo);
    on('gameMetadataLogoInput', 'change', handleGameMetadataLogoChange);
    on('gameMetadataSaveBtn', 'click', saveGameMetadata);

    on('uploadPersonalBtn', 'click', uploadToPersonal);
    on('uploadAllianceBtn', 'click', uploadToAlliance);
    on('uploadBothBtn', 'click', uploadToBoth);
    on('uploadTargetModal', 'click', handleModalOverlayDismissClick);
    on('uploadTargetCloseBtn', 'click', closeUploadTargetModal);
    on('selectionSourcePersonalBtn', 'click', () => switchPlayerSource('personal', 'selectionSourceStatus'));
    on('selectionSourceAllianceBtn', 'click', () => switchPlayerSource('alliance', 'selectionSourceStatus'));

    on('coordPickerOverlay', 'click', handleModalOverlayDismissClick);
    on('coordCloseBtn', 'click', closeCoordinatesPicker);
    on('coordPrevBtn', 'click', prevCoordBuilding);
    on('coordNextBtn', 'click', nextCoordBuilding);
    on('coordSaveBtn', 'click', saveBuildingPositions);

    on('searchFilter', 'input', filterPlayers);
    on('clearAllBtn', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.clearAllSelections === 'function') {
            controller.clearAllSelections();
            return;
        }
        clearAllSelections();
    });
    on('uploadPanelHeader', 'click', toggleUploadPanel);
    on('playersListPanelHeader', 'click', togglePlayersListPanel);
    on('playersMgmtAddPanelHeader', 'click', () => togglePlayersManagementAddPanel());
    on('playersMgmtSourcePersonalBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.switchSource === 'function') {
            controller.switchSource('personal');
            return;
        }
        switchPlayersManagementSource('personal');
    });
    on('playersMgmtSourceAllianceBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.switchSource === 'function') {
            controller.switchSource('alliance');
            return;
        }
        switchPlayersManagementSource('alliance');
    });
    const playersMgmtAddForm = document.getElementById('playersMgmtAddForm');
    if (playersMgmtAddForm) {
        playersMgmtAddForm.addEventListener('submit', (event) => {
            const controller = getPlayersManagementFeatureController();
            if (controller && typeof controller.submitAddPlayer === 'function') {
                controller.submitAddPlayer(event);
                return;
            }
            event.preventDefault();
            handlePlayersManagementAddPlayer();
        });
    }
    on('playersMgmtSearchFilter', 'input', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtTroopsFilter', 'change', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtSortFilter', 'change', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleFilterChange === 'function') {
            controller.handleFilterChange(event);
            return;
        }
        handlePlayersManagementFilterChange(event);
    });
    on('playersMgmtClearFiltersBtn', 'click', () => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.clearFilters === 'function') {
            controller.clearFilters();
            return;
        }
        clearPlayersManagementFilters();
    });
    on('playersMgmtSharedInviteBtn', 'click', function () {
        handlePlayersManagementSharedInvite(document.getElementById('playersMgmtSharedInviteBtn'));
    });
    on('assignmentAlgorithmBalanced', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('assignmentAlgorithmAggressive', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('assignmentAlgorithmSelect', 'change', (event) => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.changeAlgorithm === 'function') {
            controller.changeAlgorithm(event);
            return;
        }
        handleAssignmentAlgorithmChange(event);
    });
    on('downloadTemplateBtn', 'click', downloadPlayerTemplate);
    on('uploadPlayerBtn', 'click', () => {
        const input = document.getElementById('playerFileInput');
        if (input) input.click();
    });
    on('playerFileInput', 'change', uploadPlayerData);
    on('clearAllPlayersBtn', 'click', function () {
        handleClearAllPlayers(document.getElementById('clearAllPlayersBtn'));
    });

    on('eventsPanelHeader', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.toggleEventsPanel === 'function') {
            controller.toggleEventsPanel();
            return;
        }
        toggleEventsPanel();
    });
    on('eventEditModeBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.enterEditMode === 'function') {
            controller.enterEditMode();
            return;
        }
        enterEventEditMode();
    });
    on('eventLogoUploadBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.triggerLogoUpload === 'function') {
            controller.triggerLogoUpload();
            return;
        }
        triggerEventLogoUpload();
    });
    on('eventLogoRandomBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.removeLogo === 'function') {
            controller.removeLogo();
            return;
        }
        removeEventLogo();
    });
    on('eventLogoInput', 'change', (event) => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.handleLogoChange === 'function') {
            controller.handleLogoChange(event);
            return;
        }
        handleEventLogoChange(event);
    });
    on('eventMapUploadBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.triggerMapUpload === 'function') {
            controller.triggerMapUpload();
            return;
        }
        triggerEventMapUpload();
    });
    on('eventMapRemoveBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.removeMap === 'function') {
            controller.removeMap();
            return;
        }
        removeEventMap();
    });
    on('eventMapInput', 'change', (event) => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.handleMapChange === 'function') {
            controller.handleMapChange(event);
            return;
        }
        handleEventMapChange(event);
    });
    on('eventAddBuildingBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.addBuildingRow === 'function') {
            controller.addBuildingRow();
            return;
        }
        addEventBuildingRow();
    });
    on('eventSaveBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.saveEvent === 'function') {
            controller.saveEvent();
            return;
        }
        saveEventDefinition();
    });
    on('eventCancelEditBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.cancelEdit === 'function') {
            controller.cancelEdit();
            return;
        }
        cancelEventEditing();
    });
    on('eventDeleteBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.deleteEvent === 'function') {
            controller.deleteEvent();
            return;
        }
        deleteSelectedEvent();
    });
    on('eventWikiBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.openEventWiki === 'function') {
            controller.openEventWiki();
        }
    });

    on('mapCoordinatesBtn', 'click', () => {
        const controller = getEventsManagerFeatureController();
        if (controller && typeof controller.openCoordinatesPicker === 'function') {
            controller.openCoordinatesPicker();
            return;
        }
        openCoordinatesPickerFromEditor();
    });
    on('downloadModalOverlay', 'click', handleModalOverlayDismissClick);
    on('downloadModalCloseBtn', 'click', closeDownloadModal);
    on('generateBtnA', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('A');
            return;
        }
        generateTeamAssignments('A');
    });
    on('generateBtnB', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('B');
            return;
        }
        generateTeamAssignments('B');
    });
    // Mobile generate buttons (mirror desktop handlers)
    on('mobileGenBtnA', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('A');
            return;
        }
        generateTeamAssignments('A');
    });
    on('mobileGenBtnB', 'click', () => {
        const controller = getGeneratorFeatureController();
        if (controller && typeof controller.generateAssignments === 'function') {
            controller.generateAssignments('B');
            return;
        }
        generateTeamAssignments('B');
    });
    on('supportCopyDiscordBtn', 'click', copySupportDiscordHandle);
    on('supportOpenDiscordBtn', 'click', openSupportDiscordProfile);
    on('supportReportBugBtn', 'click', () => openSupportIssueComposer('bug'));
    on('supportRequestFeatureBtn', 'click', () => openSupportIssueComposer('feature'));

    function closeHintsModal() {
        const overlay = document.getElementById('hintsModal');
        if (overlay) {
            closeModalOverlay(overlay);
        }
    }
    on('hintsCloseBtn', 'click', closeHintsModal);
    on('hintsSkipBtn', 'click', closeHintsModal);
    on('hintsGotItBtn', 'click', closeHintsModal);

    syncAssignmentAlgorithmControl();
    updateClearAllButtonVisibility();
}

// ── Dismiss event wiring (runs once DOM is ready) ──
let appUiRuntimeInitialized = false;

function initializeApplicationUiRuntime() {
    if (appUiRuntimeInitialized) {
        return;
    }
    appUiRuntimeInitialized = true;

    bindStaticUiActions();

    // Onboarding: init deps and bind click/skip listeners
    window.DSOnboardingController.init({ t: t, openNavigationMenu: openNavigationMenu });
    window.DSOnboardingController.bindOnboardingListeners();

    const settingsDisplayNameInput = document.getElementById('settingsDisplayNameInput');
    if (settingsDisplayNameInput) {
        settingsDisplayNameInput.addEventListener('input', updateSettingsAvatarPreview);
    }
    const settingsNicknameInput = document.getElementById('settingsNicknameInput');
    if (settingsNicknameInput) {
        settingsNicknameInput.addEventListener('input', updateSettingsAvatarPreview);
    }

    // Pointer-first canvas interaction improves mobile precision.
    const coordCanvas = document.getElementById('coordCanvas');
    if (coordCanvas) {
        coordCanvas.style.touchAction = 'none';
        coordCanvas.addEventListener('pointerdown', coordCanvasClick, { passive: false });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeNavigationMenu();
            closeSettingsModal();
            closeGameSelector(false);
            const invitePopover = document.querySelector('.invite-link-popover');
            if (invitePopover) { invitePopover.remove(); }
        }
    });

    bindEventEditorTableActions();
    const eventNameInput = document.getElementById('eventNameInput');
    if (eventNameInput) {
        eventNameInput.addEventListener('input', () => {
            if (!eventDraftLogoDataUrl) {
                updateEventLogoPreview();
            }
        });
    }
    buildRegistryFromStorage();
    renderAllEventSelectors();
    renderEventsList();
    startNewEventDraft();
    switchEvent(currentEvent);
    updateUserHeaderIdentity(currentAuthUser);
    const activeGameContext = getActiveGameContext();
    window.__ACTIVE_GAME_ID = activeGameContext.gameId;
    updateActiveGameBadge(activeGameContext.gameId);
    refreshGameSelectorMenuAvailability();
    if (typeof refreshGameMetadataCatalogCache === 'function') {
        refreshGameMetadataCatalogCache({ silent: true }).catch(() => {});
    }
}

// ============================================================
// INITIALIZATION CHECK
// ============================================================

const XLSX_SCRIPT_SRC = 'vendor/xlsx.full.min.js';
let xlsxLoadPromise = null;

function loadScriptOnce(src, markerName) {
    if (markerName && typeof window[markerName] !== 'undefined') {
        return Promise.resolve(true);
    }
    const existingScript = document.querySelector(`script[data-src="${src}"]`);
    if (existingScript) {
        return new Promise((resolve, reject) => {
            existingScript.addEventListener('load', () => resolve(true), { once: true });
            existingScript.addEventListener('error', () => reject(new Error(`Failed loading ${src}`)), { once: true });
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.async = false;
        script.dataset.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => reject(new Error(`Failed loading ${src}`));
        document.head.appendChild(script);
    });
}

async function ensureXLSXLoaded() {
    if (typeof XLSX !== 'undefined') {
        return true;
    }
    if (!xlsxLoadPromise) {
        xlsxLoadPromise = loadScriptOnce(XLSX_SCRIPT_SRC, 'XLSX').catch((error) => {
            xlsxLoadPromise = null;
            throw error;
        });
    }
    await xlsxLoadPromise;
    return true;
}

// Check if Firebase modules are loaded
if (typeof firebase === 'undefined') {
    alert(t('error_firebase_sdk_missing'));
    console.error('Firebase SDK failed to load from CDN');
}

if (typeof FirebaseService === 'undefined') {
    alert(t('error_firebase_module_missing'));
    console.error('FirebaseService not defined - firebase-module.js not loaded');
}

// ============================================================
// GLOBAL STATE
// ============================================================

let allPlayers = [];
let teamSelections = {
    teamA: [],  // Array of { name: string, role: 'starter'|'substitute' }
    teamB: []
};
let assignmentsA = [];
let assignmentsB = [];
let substitutesA = [];
let substitutesB = [];
let currentAuthUser = null;

const PROFILE_TEXT_LIMIT = window.DSAuthUiController.PROFILE_TEXT_LIMIT;
const PROFILE_AVATAR_DATA_URL_LIMIT = window.DSAuthUiController.PROFILE_AVATAR_DATA_URL_LIMIT;
const AVATAR_MIN_DIMENSION = window.DSAuthUiController.AVATAR_MIN_DIMENSION;
const AVATAR_MAX_UPLOAD_BYTES = window.DSAuthUiController.AVATAR_MAX_UPLOAD_BYTES;
const EVENT_NAME_LIMIT = 30;
const EVENT_LOGO_DATA_URL_LIMIT = 220000;
const EVENT_MAP_DATA_URL_LIMIT = 950000;
const SUPPORT_DISCORD_HANDLE = 'flashguru2000';
const SUPPORT_DISCORD_URL = 'https://discord.com/users/1239126582388592667';
const SUPPORT_REPO_ISSUES_NEW_URL = 'https://github.com/CristianConsta/events-team-generator/issues/new';
const ASSIGNMENT_ALGO_BALANCED = 'balanced';
const ASSIGNMENT_ALGO_AGGRESSIVE = 'aggressive';
const ASSIGNMENT_ALGO_DEFAULT = ASSIGNMENT_ALGO_BALANCED;
const PLAYERS_MANAGEMENT_DEFAULT_SORT = 'power-desc';
let currentAssignmentAlgorithm = ASSIGNMENT_ALGO_DEFAULT;
let currentPageView = 'generator';
let currentEvent = 'desert_storm';
let eventEditorCurrentId = '';
let eventDraftLogoDataUrl = '';
let eventDraftMapDataUrl = '';
let eventDraftMapRemoved = false;
let eventEditorIsEditMode = false;
const appStateStore = (
    window.DSAppStateStore
    && typeof window.DSAppStateStore.createDefaultStore === 'function'
)
    ? window.DSAppStateStore.createDefaultStore({
        navigation: {
            currentView: currentPageView,
        },
        generator: {
            assignmentAlgorithm: currentAssignmentAlgorithm,
            teamSelections: teamSelections,
        },
        playersManagement: {
            filters: {
                searchTerm: '',
                troopsFilter: '',
                sortFilter: PLAYERS_MANAGEMENT_DEFAULT_SORT,
            },
        },
    })
    : null;
const appStateContract = (
    window.DSStateStoreContract
    && typeof window.DSStateStoreContract.createStateStoreContract === 'function'
    && appStateStore
)
    ? window.DSStateStoreContract.createStateStoreContract(appStateStore)
    : null;

function getAppRuntimeState() {
    if (appStateContract && typeof appStateContract.getState === 'function') {
        return appStateContract.getState();
    }
    return {
        navigation: { currentView: currentPageView },
        generator: {
            assignmentAlgorithm: currentAssignmentAlgorithm,
            teamSelections: teamSelections,
        },
        playersManagement: {
            filters: {
                searchTerm: '',
                troopsFilter: '',
                sortFilter: PLAYERS_MANAGEMENT_DEFAULT_SORT,
            },
        },
    };
}

function setAppRuntimeState(patch) {
    if (appStateContract && typeof appStateContract.setState === 'function') {
        appStateContract.setState(patch);
    }
}

function getCurrentPageViewState() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectNavigationView === 'function'
    ) {
        return window.DSAppStateStore.selectors.selectNavigationView(getAppRuntimeState());
    }
    return currentPageView;
}

function setCurrentPageViewState(nextView) {
    currentPageView = nextView;
    setAppRuntimeState({
        navigation: {
            currentView: nextView,
        },
    });
}

function getCurrentAssignmentAlgorithmState() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectAssignmentAlgorithm === 'function'
    ) {
        return window.DSAppStateStore.selectors.selectAssignmentAlgorithm(getAppRuntimeState());
    }
    return currentAssignmentAlgorithm;
}

function setCurrentAssignmentAlgorithmState(nextValue) {
    currentAssignmentAlgorithm = nextValue;
    setAppRuntimeState({
        generator: {
            assignmentAlgorithm: nextValue,
        },
    });
}

function syncGeneratorTeamSelectionsState() {
    setAppRuntimeState({
        generator: {
            teamSelections: {
                teamA: Array.isArray(teamSelections.teamA) ? teamSelections.teamA : [],
                teamB: Array.isArray(teamSelections.teamB) ? teamSelections.teamB : [],
            },
        },
    });
}

function syncPlayersManagementFilterState() {
    setAppRuntimeState({
        playersManagement: {
            filters: {
                searchTerm: playersManagementSearchTerm,
                troopsFilter: playersManagementTroopsFilter,
                sortFilter: playersManagementSortFilter,
            },
        },
    });
}

// Helper functions for starter/substitute counts
function getStarterCount(teamKey) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getStarterCount === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getStarterCount(teamSelections, teamKey);
    }
    return teamSelections[teamKey].filter(p => p.role === 'starter').length;
}

function getSubstituteCount(teamKey) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getSubstituteCount === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getSubstituteCount(teamSelections, teamKey);
    }
    return teamSelections[teamKey].filter(p => p.role === 'substitute').length;
}

function normalizeAssignmentAlgorithm(value) {
    if (
        window.DSCoreGeneratorAssignment
        && typeof window.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm === 'function'
    ) {
        return window.DSCoreGeneratorAssignment.normalizeAssignmentAlgorithm(value);
    }
    return value === ASSIGNMENT_ALGO_AGGRESSIVE ? ASSIGNMENT_ALGO_AGGRESSIVE : ASSIGNMENT_ALGO_BALANCED;
}

function syncAssignmentAlgorithmControl() {
    const normalized = normalizeAssignmentAlgorithm(getCurrentAssignmentAlgorithmState());
    if (
        window.DSFeatureGeneratorView
        && typeof window.DSFeatureGeneratorView.syncAssignmentAlgorithmControl === 'function'
    ) {
        window.DSFeatureGeneratorView.syncAssignmentAlgorithmControl({
            document: document,
            value: normalized,
        });
        return;
    }

    const radioInputs = document.querySelectorAll('input[name="assignmentAlgorithm"]');
    if (radioInputs && radioInputs.length > 0) {
        radioInputs.forEach((input) => {
            if (input instanceof HTMLInputElement) {
                input.checked = input.value === normalized;
            }
        });
        return;
    }

    const select = document.getElementById('assignmentAlgorithmSelect');
    if (select) {
        select.value = normalized;
    }
}

function handleAssignmentAlgorithmChange(event) {
    const controller = getGeneratorFeatureController();
    if (controller && typeof controller.changeAlgorithm === 'function') {
        controller.changeAlgorithm(event);
        return;
    }

    if (event && event.target instanceof HTMLInputElement && event.target.type === 'radio' && !event.target.checked) {
        return;
    }
    const next = normalizeAssignmentAlgorithm(event && event.target ? event.target.value : ASSIGNMENT_ALGO_DEFAULT);
    setCurrentAssignmentAlgorithmState(next);
    syncAssignmentAlgorithmControl();
}

let generatorFeatureController = null;
function getGeneratorFeatureController() {
    if (generatorFeatureController) {
        return generatorFeatureController;
    }
    if (
        window.DSFeatureGeneratorController
        && typeof window.DSFeatureGeneratorController.createController === 'function'
    ) {
        generatorFeatureController = window.DSFeatureGeneratorController.createController({
            document: document,
            generatorActions: window.DSFeatureGeneratorActions,
            generatorView: window.DSFeatureGeneratorView,
            defaultAlgorithm: ASSIGNMENT_ALGO_DEFAULT,
            normalizeAssignmentAlgorithm: normalizeAssignmentAlgorithm,
            setAssignmentAlgorithm: setCurrentAssignmentAlgorithmState,
            syncAssignmentAlgorithmControl: syncAssignmentAlgorithmControl,
            toggleTeamSelection: (playerName, team) => toggleTeam(playerName, team),
            setPlayerRole: (playerName, role) => togglePlayerRole(playerName, role),
            clearPlayerSelection: (playerName) => clearPlayerSelection(playerName),
            clearAllSelections: () => clearAllSelections(),
            generateAssignments: (team) => generateTeamAssignments(team),
            roleLimits: {
                maxTotal: 30,
                maxStarters: 20,
                maxSubstitutes: 10,
            },
        });
    }
    return generatorFeatureController;
}

let playersManagementFeatureController = null;
function getPlayersManagementFeatureController() {
    if (playersManagementFeatureController) {
        return playersManagementFeatureController;
    }
    if (
        window.DSFeaturePlayersManagementController
        && typeof window.DSFeaturePlayersManagementController.createController === 'function'
    ) {
        playersManagementFeatureController = window.DSFeaturePlayersManagementController.createController({
            document: document,
            handleAddPlayer: handlePlayersManagementAddPlayer,
            handleTableAction: handlePlayersManagementTableAction,
            handleFilterChange: handlePlayersManagementFilterChange,
            clearFilters: clearPlayersManagementFilters,
            switchSource: switchPlayersManagementSource,
            focusAddNameField: () => {
                const input = document.getElementById('playersMgmtNewName');
                if (input && typeof input.focus === 'function') {
                    input.focus();
                }
            },
        });
    }
    return playersManagementFeatureController;
}

let eventsManagerFeatureController = null;
function getEventsManagerFeatureController() {
    if (eventsManagerFeatureController) {
        return eventsManagerFeatureController;
    }
    if (
        window.DSFeatureEventsManagerController
        && typeof window.DSFeatureEventsManagerController.createController === 'function'
    ) {
        eventsManagerFeatureController = window.DSFeatureEventsManagerController.createController({
            toggleEventsPanel: toggleEventsPanel,
            enterEditMode: enterEventEditMode,
            triggerLogoUpload: triggerEventLogoUpload,
            removeLogo: removeEventLogo,
            handleLogoChange: handleEventLogoChange,
            triggerMapUpload: triggerEventMapUpload,
            removeMap: removeEventMap,
            handleMapChange: handleEventMapChange,
            addBuildingRow: addEventBuildingRow,
            saveEvent: saveEventDefinition,
            cancelEdit: cancelEventEditing,
            deleteEvent: deleteSelectedEvent,
            openCoordinatesPicker: openCoordinatesPickerFromEditor,
            openEventWiki: function() { window.DSEventsRegistryController.openEventWiki(); },
        });
    }
    return eventsManagerFeatureController;
}

let allianceFeatureController = null;
function getAllianceFeatureController() {
    if (allianceFeatureController) {
        return allianceFeatureController;
    }
    if (
        window.DSFeatureAllianceController
        && typeof window.DSFeatureAllianceController.createController === 'function'
    ) {
        allianceFeatureController = window.DSFeatureAllianceController.createController({
            renderPanel: renderAlliancePanel,
            createAlliance: handleCreateAlliance,
            sendInvitation: handleSendInvitation,
            leaveAlliance: handleLeaveAlliance,
            acceptInvitation: handleAcceptInvitation,
            rejectInvitation: handleRejectInvitation,
            resendInvitation: handleResendInvitation,
            revokeInvitation: handleRevokeInvitation,
            openPanel: openAlliancePanel,
            closePanel: closeAlliancePanel,
        });
    }
    return allianceFeatureController;
}

let notificationsFeatureController = null;
function getNotificationsFeatureController() {
    if (notificationsFeatureController) {
        return notificationsFeatureController;
    }
    if (
        window.DSFeatureNotificationsController
        && typeof window.DSFeatureNotificationsController.createController === 'function'
    ) {
        notificationsFeatureController = window.DSFeatureNotificationsController.createController({
            checkAndDisplay: checkAndDisplayNotifications,
            render: renderNotifications,
            togglePanel: toggleNotificationsPanel,
            closePanel: closeNotificationsPanel,
            startPolling: startNotificationPolling,
            stopPolling: stopNotificationPolling,
            openAllianceInvite: openAllianceInvitesFromNotification,
        });
    }
    return notificationsFeatureController;
}

let uploadPanelExpanded = true;
let playersListPanelExpanded = true;
let playersManagementAddPanelExpanded = false;
let playersManagementAddPanelInit = false;
let playersManagementEditingName = '';
let playersManagementSearchTerm = '';
let playersManagementTroopsFilter = '';
let playersManagementSortFilter = PLAYERS_MANAGEMENT_DEFAULT_SORT;
let eventsPanelExpanded = true;
let activeDownloadTeam = null;
syncPlayersManagementFilterState();

// Theme functions (delegated to DSThemeController)
function normalizeThemePreference(theme) { return window.DSThemeController.normalizeThemePreference(theme); }
function getStoredThemePreference() { return window.DSThemeController.getStoredThemePreference(); }
function applyPlatformTheme(theme, options) { return window.DSThemeController.applyPlatformTheme(theme, options); }
function getCurrentAppliedTheme() { return window.DSThemeController.getCurrentAppliedTheme(); }

function isConfigurationPageVisible() {
    return getCurrentPageViewState() === 'configuration';
}

function closeNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncMenuVisibility === 'function'
    ) {
        window.DSShellNavigationController.syncMenuVisibility({
            panel: panel,
            menuButton: menuBtn,
            open: false,
            setPanelVisibility: setPanelVisibility,
        });
        return;
    }
    if (panel) {
        setPanelVisibility(panel, false);
    }
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'false');
    }
}

function openNavigationMenu() {
    const panel = document.getElementById('navMenuPanel');
    const menuBtn = document.getElementById('navMenuBtn');
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncMenuVisibility === 'function'
    ) {
        window.DSShellNavigationController.syncMenuVisibility({
            panel: panel,
            menuButton: menuBtn,
            open: true,
            setPanelVisibility: setPanelVisibility,
        });
        return;
    }
    if (panel) {
        setPanelVisibility(panel, true);
    }
    if (menuBtn) {
        menuBtn.setAttribute('aria-expanded', 'true');
    }
}

function toggleNavigationMenu(event) {
    if (event) {
        event.stopPropagation();
    }
    const panel = document.getElementById('navMenuPanel');
    if (!panel) {
        return;
    }
    if (panel.classList.contains('ui-open')) {
        closeNavigationMenu();
    } else {
        openNavigationMenu();
    }
}

function toggleMobileMoreSheet() {
    var sheet = document.getElementById('mobileMoreSheet');
    if (!sheet) return;
    var isOpen = !sheet.classList.contains('hidden');
    sheet.classList.toggle('hidden', isOpen);
    var moreBtn = document.getElementById('mobileNavMoreBtn');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    // Close sheet when clicking scrim
    if (!isOpen) {
        sheet.addEventListener('click', function onScrimClick(e) {
            if (e.target === sheet) {
                closeMobileMoreSheet();
                sheet.removeEventListener('click', onScrimClick);
            }
        });
    }
}

function closeMobileMoreSheet() {
    var sheet = document.getElementById('mobileMoreSheet');
    if (sheet) sheet.classList.add('hidden');
    var moreBtn = document.getElementById('mobileNavMoreBtn');
    if (moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
}

function syncNavigationMenuState() {
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.syncNavigationButtons === 'function'
    ) {
        window.DSShellNavigationController.syncNavigationButtons({
            currentView: getCurrentPageViewState(),
            entries: [
                { view: 'generator', button: document.getElementById('navGeneratorBtn') },
                { view: 'configuration', button: document.getElementById('navConfigBtn') },
                { view: 'players', button: document.getElementById('navPlayersBtn') },
                { view: 'alliance', button: document.getElementById('navAllianceBtn') },
                { view: 'support', button: document.getElementById('navSupportBtn') },
                { view: 'generator', button: document.getElementById('mobileNavGeneratorBtn') },
                { view: 'players', button: document.getElementById('mobileNavPlayersBtn') },
                // Sidebar buttons
                { view: 'generator', button: document.getElementById('sidebarGeneratorBtn') },
                { view: 'players', button: document.getElementById('sidebarPlayersBtn') },
                { view: 'configuration', button: document.getElementById('sidebarConfigBtn') },
                { view: 'alliance', button: document.getElementById('sidebarAllianceBtn') },
                { view: 'support', button: document.getElementById('sidebarSupportBtn') },
            ],
        });
        return;
    }

    const generatorBtn = document.getElementById('navGeneratorBtn');
    const configBtn = document.getElementById('navConfigBtn');
    const playersBtn = document.getElementById('navPlayersBtn');
    const allianceBtn = document.getElementById('navAllianceBtn');
    const supportBtn = document.getElementById('navSupportBtn');
    const mobileGeneratorBtn = document.getElementById('mobileNavGeneratorBtn');
    const mobileConfigBtn = document.getElementById('mobileNavConfigBtn');
    const mobilePlayersBtn = document.getElementById('mobileNavPlayersBtn');
    const mobileAllianceBtn = document.getElementById('mobileNavAllianceBtn');
    if (generatorBtn) {
        const isActive = getCurrentPageViewState() === 'generator';
        generatorBtn.classList.toggle('active', isActive);
        generatorBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (configBtn) {
        const isActive = getCurrentPageViewState() === 'configuration';
        configBtn.classList.toggle('active', isActive);
        configBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (playersBtn) {
        const isActive = getCurrentPageViewState() === 'players';
        playersBtn.classList.toggle('active', isActive);
        playersBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (allianceBtn) {
        const isActive = getCurrentPageViewState() === 'alliance';
        allianceBtn.classList.toggle('active', isActive);
        allianceBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (supportBtn) {
        const isActive = getCurrentPageViewState() === 'support';
        supportBtn.classList.toggle('active', isActive);
        supportBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileGeneratorBtn) {
        const isActive = getCurrentPageViewState() === 'generator';
        mobileGeneratorBtn.classList.toggle('active', isActive);
        mobileGeneratorBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileConfigBtn) {
        const isActive = getCurrentPageViewState() === 'configuration';
        mobileConfigBtn.classList.toggle('active', isActive);
        mobileConfigBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobilePlayersBtn) {
        const isActive = getCurrentPageViewState() === 'players';
        mobilePlayersBtn.classList.toggle('active', isActive);
        mobilePlayersBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
    if (mobileAllianceBtn) {
        const isActive = getCurrentPageViewState() === 'alliance';
        mobileAllianceBtn.classList.toggle('active', isActive);
        mobileAllianceBtn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
}

function resumePendingOnboardingStep() {
    window.DSOnboardingController.resumePendingOnboardingStep();
}

function updateFloatingButtonsVisibility() {
    const bar = document.getElementById('floatingButtons');
    const selectionSection = document.getElementById('selectionSection');
    if (!bar || !selectionSection) {
        return;
    }
    const hasPlayers = Array.isArray(allPlayers) && allPlayers.length > 0;
    const shouldShow = getCurrentPageViewState() === 'generator' && !selectionSection.classList.contains('hidden') && hasPlayers;
    bar.style.display = shouldShow ? 'flex' : 'none';

    // Toggle mobile generate buttons in mobile bottom nav
    var mobileNav = document.getElementById('mobileBottomNav');
    if (mobileNav) {
        mobileNav.classList.toggle('mobile-gen-active', shouldShow);
    }

    reserveSpaceForFooter();
}

function hideAllMainPages() {
    var pages = ['generatorPage', 'configurationPage', 'playersManagementPage', 'alliancePage', 'supportPage', 'eventHistoryView', 'playerUpdatesReviewView'];
    pages.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    updateFloatingButtonsVisibility();
}

function setPageView(view) {
    // Hide any feature view-sections (Event History, Player Updates) when switching to a main page
    var allViewSections = document.querySelectorAll('.view-section');
    allViewSections.forEach(function(s) { s.classList.add('hidden'); });
    var featureViews = ['eventHistoryView', 'playerUpdatesReviewView'];
    featureViews.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const generatorPage = document.getElementById('generatorPage');
    const configurationPage = document.getElementById('configurationPage');
    const playersManagementPage = document.getElementById('playersManagementPage');
    const alliancePage = document.getElementById('alliancePage');
    const supportPage = document.getElementById('supportPage');
    if (!generatorPage || !configurationPage || !playersManagementPage || !alliancePage || !supportPage) {
        return;
    }

    if (view === 'configuration') {
        setCurrentPageViewState('configuration');
    } else if (view === 'players') {
        setCurrentPageViewState('players');
    } else if (view === 'alliance') {
        setCurrentPageViewState('alliance');
    } else if (view === 'support') {
        setCurrentPageViewState('support');
    } else {
        setCurrentPageViewState('generator');
    }
    let currentView = getCurrentPageViewState();
    if (
        window.DSShellNavigationController
        && typeof window.DSShellNavigationController.applyPageVisibility === 'function'
    ) {
        currentView = window.DSShellNavigationController.applyPageVisibility({
            currentView: currentView,
            pages: {
                generator: generatorPage,
                configuration: configurationPage,
                players: playersManagementPage,
                alliance: alliancePage,
                support: supportPage,
            },
        });
    } else {
        generatorPage.classList.toggle('hidden', currentView !== 'generator');
        configurationPage.classList.toggle('hidden', currentView !== 'configuration');
        playersManagementPage.classList.toggle('hidden', currentView !== 'players');
        alliancePage.classList.toggle('hidden', currentView !== 'alliance');
        supportPage.classList.toggle('hidden', currentView !== 'support');
    }
    syncNavigationMenuState();
    closeNavigationMenu();
    closeNotificationsPanel();

    if (currentView === 'configuration') {
        loadBuildingConfig();
        loadBuildingPositions();
        renderBuildingsTable();
        renderEventsList();
        refreshEventEditorDeleteState();
    } else if (currentView === 'players') {
        renderPlayersManagementPanel();
    } else if (currentView === 'alliance') {
        renderAlliancePanel();
    }

    updateFloatingButtonsVisibility();
    resumePendingOnboardingStep();
}

function showConfigurationPage() {
    setPageView('configuration');
}

function showGeneratorPage() {
    setPageView('generator');
}

function showPlayersManagementPage() {
    setPageView('players');
}

function showAlliancePage() {
    setPageView('alliance');
    Promise.resolve()
        .then(async () => {
            if (typeof FirebaseService !== 'undefined' && FirebaseService.isSignedIn()) {
                const gameplayContext = getGameplayContext();
                await FirebaseService.loadAllianceData(gameplayContext || undefined);
            }
            await checkAndDisplayNotifications();
        })
        .then(() => {
            if (getCurrentPageViewState() === 'alliance') {
                renderAlliancePanel();
                updateAllianceHeaderDisplay();
            }
        })
        .catch(() => {
            // Ignore transient refresh failures when opening alliance page.
        });
}

function showSupportPage() {
    setPageView('support');
}

function copySupportDiscordHandle() {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        showMessage('supportStatus', `Discord contact: @${SUPPORT_DISCORD_HANDLE}`, 'warning');
        return;
    }
    navigator.clipboard.writeText(SUPPORT_DISCORD_HANDLE)
        .then(() => {
            showMessage('supportStatus', `Discord handle copied: @${SUPPORT_DISCORD_HANDLE}`, 'success');
        })
        .catch(() => {
            showMessage('supportStatus', `Discord contact: @${SUPPORT_DISCORD_HANDLE}`, 'warning');
        });
}

function openSupportDiscordProfile() {
    const newWindow = window.open(SUPPORT_DISCORD_URL, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
        showMessage('supportStatus', 'Popup blocked. Open discord.com and add @flashguru2000.', 'warning');
        return;
    }
    showMessage('supportStatus', 'Discord opened in a new tab. Add @flashguru2000.', 'success');
}

function openSupportIssueComposer(issueType) {
    const titleInput = document.getElementById('supportIssueTitle');
    const detailsInput = document.getElementById('supportIssueDetails');
    const customTitle = titleInput ? titleInput.value.trim() : '';
    const customDetails = detailsInput ? detailsInput.value.trim() : '';
    const normalizedType = issueType === 'bug' ? 'bug' : 'feature';
    const isBug = normalizedType === 'bug';
    const defaultTitle = isBug ? '[Bug] Short summary' : '[Feature] Short summary';
    const issueTitle = (customTitle || defaultTitle).slice(0, 120);
    const details = customDetails || (isBug
        ? 'Describe what happened, expected behavior, and steps to reproduce.'
        : 'Describe the feature, why it helps, and expected behavior.');
    const body = [
        isBug ? '### Bug report' : '### Feature request',
        '',
        details,
        '',
        '### Context',
        '- Submitted from Support page',
        `- Date: ${new Date().toISOString()}`,
        '',
    ].join('\n');
    const params = new URLSearchParams();
    params.set('title', issueTitle);
    params.set('body', body);
    params.set('labels', isBug ? 'bug' : 'enhancement');
    const issueUrl = `${SUPPORT_REPO_ISSUES_NEW_URL}?${params.toString()}`;
    const newWindow = window.open(issueUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
        showMessage('supportStatus', 'Popup blocked. Please open repository issues manually.', 'warning');
        return;
    }
    showMessage('supportStatus', 'Issue draft opened in GitHub. Submit to save it in repository issues.', 'success');
}

function getSignInDisplayName(user) {
    if (!user || typeof user.displayName !== 'string') {
        return '';
    }
    return user.displayName.trim().slice(0, PROFILE_TEXT_LIMIT);
}

function getProfileFromService() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getUserProfile) {
        return { displayName: '', nickname: '', avatarDataUrl: '', theme: getStoredThemePreference() };
    }
    const activeGameId = getActiveGame() || ensureActiveGameContext();
    const profileContext = activeGameId ? { gameId: activeGameId } : undefined;
    const profile = FirebaseService.getUserProfile(profileContext);
    if (!profile || typeof profile !== 'object') {
        return { displayName: '', nickname: '', avatarDataUrl: '', theme: getStoredThemePreference() };
    }
    return {
        displayName: typeof profile.displayName === 'string' ? profile.displayName.trim().slice(0, PROFILE_TEXT_LIMIT) : '',
        nickname: typeof profile.nickname === 'string' ? profile.nickname.trim().replace(/^@+/, '').slice(0, PROFILE_TEXT_LIMIT) : '',
        avatarDataUrl: typeof profile.avatarDataUrl === 'string' ? profile.avatarDataUrl.trim().slice(0, PROFILE_AVATAR_DATA_URL_LIMIT) : '',
        theme: normalizeThemePreference(profile.theme || getStoredThemePreference()),
    };
}

function getAvatarInitials(primaryName, secondaryName) {
    const preferred = [primaryName, secondaryName]
        .filter((value) => typeof value === 'string' && value.trim())
        .map((value) => value.trim())[0] || '';
    if (!preferred) {
        return 'U';
    }
    const tokens = preferred.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) {
        return tokens[0].slice(0, 2).toUpperCase();
    }
    return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

function applyAvatar(dataUrl, imageEl, initialsEl, initials) {
    if (!imageEl || !initialsEl) {
        return;
    }
    if (dataUrl) {
        imageEl.src = dataUrl;
        imageEl.classList.remove('hidden');
        initialsEl.classList.add('hidden');
    } else {
        imageEl.src = '';
        imageEl.classList.add('hidden');
        initialsEl.textContent = initials;
        initialsEl.classList.remove('hidden');
    }
}

// Auth UI / Settings / Identity (delegated to DSAuthUiController)
function updateUserHeaderIdentity(user) { window.DSAuthUiController.updateUserHeaderIdentity(user); }
function openSettingsModal() { window.DSAuthUiController.openSettingsModal(); }
function closeSettingsModal() { window.DSAuthUiController.closeSettingsModal(); }

function handleModalOverlayDismissClick(event) {
    if (!event || !(event.currentTarget instanceof HTMLElement) || event.target !== event.currentTarget) {
        return;
    }
    if (event.currentTarget.id === 'settingsModal') {
        closeSettingsModal();
        return;
    }
    if (event.currentTarget.id === 'uploadTargetModal') {
        closeUploadTargetModal();
        return;
    }
    if (event.currentTarget.id === 'coordPickerOverlay') {
        closeCoordinatesPicker();
        return;
    }
    if (event.currentTarget.id === 'downloadModalOverlay') {
        closeDownloadModal();
    }
}

function triggerSettingsAvatarUpload() { window.DSAuthUiController.triggerSettingsAvatarUpload(); }
function removeSettingsAvatar() { window.DSAuthUiController.removeSettingsAvatar(); }
function updateSettingsAvatarPreview() { window.DSAuthUiController.updateSettingsAvatarPreview(); }
function readFileAsDataUrl(file) { return window.DSAuthUiController.readFileAsDataUrl(file); }
function loadImageFromDataUrl(dataUrl) { return window.DSAuthUiController.loadImageFromDataUrl(dataUrl); }
function isAllowedAvatarFile(file) { return window.DSAuthUiController.isAllowedAvatarFile(file); }
function handleSettingsAvatarChange(event) { return window.DSAuthUiController.handleSettingsAvatarChange(event); }
function saveSettings() { return window.DSAuthUiController.saveSettings(); }
function deleteAccountFromSettings() { return window.DSAuthUiController.deleteAccountFromSettings(); }

// ============================================================
// EVENT REGISTRY — delegated to DSEventsRegistryController
// ============================================================

const EVENT_REGISTRY = window.DSCoreEvents.EVENT_REGISTRY;
const DEFAULT_ASSIGNMENT_ALGORITHM_ID = window.DSEventsRegistryController.DEFAULT_ASSIGNMENT_ALGORITHM_ID;
const MAP_EXPORT = window.DSEventsRegistryController.MAP_EXPORT;
const MAP_CANVAS_WIDTH = window.DSEventsRegistryController.MAP_CANVAS_WIDTH;
const MAP_CANVAS_FALLBACK_HEIGHT = window.DSEventsRegistryController.MAP_CANVAS_FALLBACK_HEIGHT;
const MAP_GRID_STEP = window.DSEventsRegistryController.MAP_GRID_STEP;
const BUILDING_POSITIONS_VERSION = window.DSEventsRegistryController.BUILDING_POSITIONS_VERSION;
const BUILDING_CONFIG_VERSION = window.DSEventsRegistryController.BUILDING_CONFIG_VERSION;
const MAX_BUILDING_SLOTS_TOTAL = window.DSEventsRegistryController.MAX_BUILDING_SLOTS_TOTAL;
const MIN_BUILDING_SLOTS = window.DSEventsRegistryController.MIN_BUILDING_SLOTS;
// Initialise the controller with app.js dependencies
window.DSEventsRegistryController.init({
    // translation
    t: function () { return t.apply(null, arguments); },
    // state accessors
    getCurrentEvent: function () { return currentEvent; },
    setCurrentEvent: function (v) { currentEvent = v; },
    getEventEditorCurrentId: function () { return eventEditorCurrentId; },
    setEventEditorCurrentId: function (v) { eventEditorCurrentId = v; },
    getEventEditorIsEditMode: function () { return eventEditorIsEditMode; },
    setEventEditorIsEditMode: function (v) { eventEditorIsEditMode = v; },
    getEventDraftLogoDataUrl: function () { return eventDraftLogoDataUrl; },
    setEventDraftLogoDataUrl: function (v) { eventDraftLogoDataUrl = v; },
    getEventDraftMapDataUrl: function () { return eventDraftMapDataUrl; },
    setEventDraftMapDataUrl: function (v) { eventDraftMapDataUrl = v; },
    getEventDraftMapRemoved: function () { return eventDraftMapRemoved; },
    setEventDraftMapRemoved: function (v) { eventDraftMapRemoved = v; },
    // constants
    EVENT_NAME_LIMIT: EVENT_NAME_LIMIT,
    EVENT_LOGO_DATA_URL_LIMIT: EVENT_LOGO_DATA_URL_LIMIT,
    EVENT_MAP_DATA_URL_LIMIT: EVENT_MAP_DATA_URL_LIMIT,
    AVATAR_MAX_UPLOAD_BYTES: AVATAR_MAX_UPLOAD_BYTES,
    AVATAR_MIN_DIMENSION: AVATAR_MIN_DIMENSION,
    // app helpers
    enforceGameplayContext: function () { return enforceGameplayContext(); },
    getGameplayContext: function (statusId) { return getGameplayContext(statusId); },
    getFirebaseService: function () { return typeof FirebaseService !== 'undefined' ? FirebaseService : null; },
    showMessage: function (id, msg, type) { return showMessage(id, msg, type); },
    normalizeBuildingConfig: function (a, b) { return normalizeBuildingConfig(a, b); },
    loadBuildingConfig: function () { return loadBuildingConfig(); },
    loadBuildingPositions: function () { return loadBuildingPositions(); },
    renderBuildingsTable: function () { return renderBuildingsTable(); },
    isConfigurationPageVisible: function () { return isConfigurationPageVisible(); },
    refreshCoordinatesPickerForCurrentEvent: function () { return refreshCoordinatesPickerForCurrentEvent(); },
    openCoordinatesPicker: function () { return openCoordinatesPicker(); },
    getTargetBuildingConfigVersion: function () { return getTargetBuildingConfigVersion(); },
    getTargetBuildingPositionsVersion: function () { return getTargetBuildingPositionsVersion(); },
    getAvatarInitials: function (a, b) { return getAvatarInitials(a, b); },
    escapeAttribute: function (s) { return escapeAttribute(s); },
    clampSlots: function (v) { return clampSlots(v); },
    clampPriority: function (v) { return clampPriority(v); },
    isAllowedAvatarFile: function (f) { return isAllowedAvatarFile(f); },
    readFileAsDataUrl: function (f) { return readFileAsDataUrl(f); },
    loadImageFromDataUrl: function (u) { return loadImageFromDataUrl(u); },
    clearAssignments: function () { assignmentsA = []; assignmentsB = []; substitutesA = []; substitutesB = []; },
});

currentEvent = window.DSEventsRegistryController.getEventIds()[0] || 'desert_storm';

// Initialize auth UI controller
window.DSAuthUiController.init({
    t: function () { return t.apply(null, arguments); },
    showMessage: function (id, msg, type) { return showMessage(id, msg, type); },
    getFirebaseService: function () { return typeof FirebaseService !== 'undefined' ? FirebaseService : null; },
    getCurrentAuthUser: function () { return currentAuthUser; },
    setCurrentAuthUser: function (user) { currentAuthUser = user; },
    getProfileFromService: function () { return getProfileFromService(); },
    getSignInDisplayName: function (user) { return getSignInDisplayName(user); },
    applyAvatar: function (url, img, el, initials) { return applyAvatar(url, img, el, initials); },
    getAvatarInitials: function (a, b) { return getAvatarInitials(a, b); },
    applyPlatformTheme: function (theme) { return applyPlatformTheme(theme); },
    normalizeThemePreference: function (theme) { return normalizeThemePreference(theme); },
    getCurrentAppliedTheme: function () { return getCurrentAppliedTheme(); },
    getStoredThemePreference: function () { return getStoredThemePreference(); },
    getGameplayContext: function (statusId) { return getGameplayContext(statusId); },
    openModalOverlay: function (el, opts) { return openModalOverlay(el, opts); },
    closeModalOverlay: function (el) { return closeModalOverlay(el); },
    closeNavigationMenu: function () { return closeNavigationMenu(); },
    syncGameMetadataMenuAvailability: function () { return syncGameMetadataMenuAvailability(); },
});

// Initialize game metadata admin controller
window.DSGameMetadataAdminController.init({
    t: function () { return t.apply(null, arguments); },
    showMessage: function (id, msg, type) { return showMessage(id, msg, type); },
    getFirebaseService: function () { return typeof FirebaseService !== 'undefined' ? FirebaseService : null; },
    getCurrentAuthUser: function () { return currentAuthUser; },
    getActiveGame: function () { return getActiveGame(); },
    ensureActiveGameContext: function () { return ensureActiveGameContext(); },
    updateActiveGameBadge: function (id) { return updateActiveGameBadge(id); },
    refreshGameSelectorMenuAvailability: function () { return refreshGameSelectorMenuAvailability(); },
    applyAvatar: function (url, img, el, initials) { return applyAvatar(url, img, el, initials); },
    getAvatarInitials: function (a, b) { return getAvatarInitials(a, b); },
    closeNavigationMenu: function () { return closeNavigationMenu(); },
    generateEventAvatarDataUrl: function (n, i) { return generateEventAvatarDataUrl(n, i); },
    createGameMetadataLogoDataUrl: function (f) { return window.DSEventsRegistryController.createGameMetadataLogoDataUrl(f); },
    getSelectableGameById: function (id) { return getSelectableGameById(id); },
});

// Initialize game selector controller
window.DSGameSelectorController.init({
    t: function () { return t.apply(null, arguments); },
    showMessage: function (id, msg, type) { return showMessage(id, msg, type); },
    getFirebaseService: function () { return typeof FirebaseService !== 'undefined' ? FirebaseService : null; },
    getActiveGame: function () { return getActiveGame(); },
    setActiveGame: function (id) { return setActiveGame(id); },
    ensureActiveGameContext: function () { return ensureActiveGameContext(); },
    applyAvatar: function (url, img, el, initials) { return applyAvatar(url, img, el, initials); },
    getAvatarInitials: function (a, b) { return getAvatarInitials(a, b); },
    generateGameAvatarDataUrl: function (n, i) { return generateGameAvatarDataUrl(n, i); },
    closeNavigationMenu: function () { return closeNavigationMenu(); },
    normalizeEventId: function (v) { return normalizeEventId(v); },
    getCurrentEvent: function () { return currentEvent; },
    listSelectableGames: function () { return listSelectableGames(); },
    getSelectableGameById: function (id) { return getSelectableGameById(id); },
    resolveActiveGameName: function (id) { return resolveActiveGameName(id); },
    refreshGameSelectorMenuAvailability: function () { return refreshGameSelectorMenuAvailability(); },
    refreshGameMetadataCatalogCache: function (o) { return refreshGameMetadataCatalogCache(o); },
    resetTransientPlanningState: function (o) { return resetTransientPlanningState(o); },
    loadPlayerData: function () { return loadPlayerData(); },
    updateAllianceHeaderDisplay: function () { return updateAllianceHeaderDisplay(); },
    renderAlliancePanel: function () { return renderAlliancePanel(); },
    getCurrentPageView: function () { return currentPageView; },
    closeDownloadModal: function () { return closeDownloadModal(); },
});

// Thin wrappers — delegate to controller
function normalizeAssignmentAlgorithmId(v) { return window.DSEventsRegistryController.normalizeAssignmentAlgorithmId(v); }
function normalizeGameId(v) { return window.DSEventsRegistryController.normalizeGameId(v); }
function normalizeEventId(v) { return window.DSEventsRegistryController.normalizeEventId(v); }
function resolveDefaultAssignmentAlgorithmId(g) { return window.DSEventsRegistryController.resolveDefaultAssignmentAlgorithmId(g); }
function getActiveEvent() { return window.DSEventsRegistryController.getActiveEvent(); }
function getEventDisplayName(id) { return window.DSEventsRegistryController.getEventDisplayName(id); }
function renderAllEventSelectors() { return window.DSEventsRegistryController.renderAllEventSelectors(); }
function buildRegistryFromStorage() { return window.DSEventsRegistryController.buildRegistryFromStorage(); }
function ensureEventRuntimeState(id) { return window.DSEventsRegistryController.ensureEventRuntimeState(id); }
function syncRuntimeStateWithRegistry() { return window.DSEventsRegistryController.syncRuntimeStateWithRegistry(); }
function getMapRuntimeState(id, p) { return window.DSEventsRegistryController.getMapRuntimeState(id, p); }
function getEventMapFile(id, p) { return window.DSEventsRegistryController.getEventMapFile(id, p); }
function loadMapImage(id, p) { return window.DSEventsRegistryController.loadMapImage(id, p); }
function isImageDataUrl(v, m) { return window.DSEventsRegistryController.isImageDataUrl(v, m); }
function switchEvent(id) { return window.DSEventsRegistryController.switchEvent(id); }
function updateGenerateEventLabels() { return window.DSEventsRegistryController.updateGenerateEventLabels(); }
function generateEventAvatarDataUrl(n, i) { return window.DSEventsRegistryController.generateEventAvatarDataUrl(n, i); }
function updateEventLogoPreview() { return window.DSEventsRegistryController.updateEventLogoPreview(); }
function updateEventEditorTitle() { return window.DSEventsRegistryController.updateEventEditorTitle(); }
function updateEventEditorState() { return window.DSEventsRegistryController.updateEventEditorState(); }
function enterEventEditMode() { return window.DSEventsRegistryController.enterEventEditMode(); }
function cancelEventEditing() { return window.DSEventsRegistryController.cancelEventEditing(); }
function openCoordinatesPickerFromEditor() { return window.DSEventsRegistryController.openCoordinatesPickerFromEditor(); }
function addEventBuildingRow() { return window.DSEventsRegistryController.addEventBuildingRow(); }
function bindEventEditorTableActions() { return window.DSEventsRegistryController.bindEventEditorTableActions(); }
function applySelectedEventToEditor() { return window.DSEventsRegistryController.applySelectedEventToEditor(); }
function renderEventsList() { return window.DSEventsRegistryController.renderEventsList(); }
function startNewEventDraft() { return window.DSEventsRegistryController.startNewEventDraft(); }
function refreshEventEditorDeleteState() { return window.DSEventsRegistryController.refreshEventEditorDeleteState(); }
function triggerEventLogoUpload() { return window.DSEventsRegistryController.triggerEventLogoUpload(); }
function triggerEventMapUpload() { return window.DSEventsRegistryController.triggerEventMapUpload(); }
function removeEventLogo() { return window.DSEventsRegistryController.removeEventLogo(); }
function removeEventMap() { return window.DSEventsRegistryController.removeEventMap(); }
function handleEventLogoChange(e) { return window.DSEventsRegistryController.handleEventLogoChange(e); }
function handleEventMapChange(e) { return window.DSEventsRegistryController.handleEventMapChange(e); }
function saveEventDefinition() { return window.DSEventsRegistryController.saveEventDefinition(); }
function deleteSelectedEvent() { return window.DSEventsRegistryController.deleteSelectedEvent(); }

// State objects now live in the controller — provide property-like access for remaining app.js code
var buildingConfigs = window.DSEventsRegistryController.getBuildingConfigs();
var buildingPositionsMap = window.DSEventsRegistryController.getBuildingPositionsMap();
var coordMapWarningShown = window.DSEventsRegistryController.getCoordMapWarningShown();
// ============================================================
// FIREBASE INTEGRATION
// ============================================================
// Callback wiring moved to js/app-init.js

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

function escapeAttribute(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

function getTroopLabel(troop) {
    switch (troop) {
        case 'Tank':
            return t('troops_filter_tank');
        case 'Aero':
            return t('troops_filter_aero');
        case 'Missile':
            return t('troops_filter_missile');
        default:
            return troop;
    }
}

// Auth action handlers (delegated to DSAuthUiController)
function handleGoogleSignIn() { return window.DSAuthUiController.handleGoogleSignIn(); }
function handleEmailSignIn() { return window.DSAuthUiController.handleEmailSignIn(); }
function showSignUpForm() { window.DSAuthUiController.showSignUpForm(); }
function handlePasswordReset() { return window.DSAuthUiController.handlePasswordReset(); }
function handleSignOut() { return window.DSAuthUiController.handleSignOut(); }

// ============================================================
// COLLAPSIBLE PANEL
// ============================================================

function toggleUploadPanel() {
    uploadPanelExpanded = !uploadPanelExpanded;
    const content = document.getElementById('uploadContent');
    const icon = document.getElementById('uploadExpandIcon');
    
    if (uploadPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function togglePlayersListPanel() {
    playersListPanelExpanded = !playersListPanelExpanded;
    const content = document.getElementById('playersListContent');
    const icon = document.getElementById('playersListExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (playersListPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function togglePlayersManagementAddPanel(forceExpanded) {
    if (typeof forceExpanded === 'boolean') {
        playersManagementAddPanelExpanded = forceExpanded;
    } else {
        playersManagementAddPanelExpanded = !playersManagementAddPanelExpanded;
    }

    const content = document.getElementById('playersMgmtAddPanelContent');
    const icon = document.getElementById('playersMgmtAddExpandIcon');
    if (!content || !icon) {
        return;
    }

    content.classList.toggle('collapsed', !playersManagementAddPanelExpanded);
    icon.classList.toggle('rotated', playersManagementAddPanelExpanded);
}

function renderPlayersManagementAddPanel() {
    const content = document.getElementById('playersMgmtAddPanelContent');
    const icon = document.getElementById('playersMgmtAddExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (!playersManagementAddPanelInit) {
        playersManagementAddPanelExpanded = window.innerWidth >= 900 || allPlayers.length < 10;
        playersManagementAddPanelInit = true;
    }
    togglePlayersManagementAddPanel(playersManagementAddPanelExpanded);
}

function translatePlayersManagementError(result) {
    if (result && result.errorKey) {
        return t(result.errorKey, result.errorParams || {});
    }
    if (result && result.error) {
        return result.error;
    }
    return t('error_generic', { error: 'unknown' });
}

function getPlayersManagementActiveSource() {
    if (typeof FirebaseService === 'undefined' || typeof FirebaseService.getPlayerSource !== 'function') {
        return 'personal';
    }
    const gameplayContext = getGameplayContext();
    return FirebaseService.getPlayerSource(gameplayContext || undefined) === 'alliance' ? 'alliance' : 'personal';
}

async function refreshPlayersDataAfterMutation(source) {
    if (typeof FirebaseService === 'undefined') {
        return;
    }
    const gameplayContext = getGameplayContext();

    if (source === 'alliance' && typeof FirebaseService.loadAllianceData === 'function') {
        await FirebaseService.loadAllianceData(gameplayContext || undefined);
    } else if (
        source === 'personal'
        && typeof FirebaseService.getCurrentUser === 'function'
        && typeof FirebaseService.loadUserData === 'function'
    ) {
        const user = FirebaseService.getCurrentUser();
        if (user && user.uid) {
            await FirebaseService.loadUserData(user, gameplayContext || undefined);
        }
    }

    loadPlayerData();
}

function getPlayersDatabaseBySource(source) {
    if (typeof FirebaseService === 'undefined') {
        return {};
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return {};
    }
    if (source === 'alliance') {
        if (typeof FirebaseService.getAlliancePlayerDatabase === 'function') {
            const allianceDb = FirebaseService.getAlliancePlayerDatabase(gameplayContext);
            return allianceDb && typeof allianceDb === 'object' ? allianceDb : {};
        }
        return {};
    }
    if (typeof FirebaseService.getPlayerDatabase === 'function') {
        const personalDb = FirebaseService.getPlayerDatabase(gameplayContext);
        return personalDb && typeof personalDb === 'object' ? personalDb : {};
    }
    return {};
}

function buildSharedInvitePlayerPayload(source) {
    const db = getPlayersDatabaseBySource(source);
    if (!db || typeof db !== 'object') {
        return [];
    }
    return Object.keys(db).map(function(name) {
        const entry = db[name] && typeof db[name] === 'object' ? db[name] : {};
        return {
            name: name,
            power: Number.isFinite(Number(entry.power)) ? Number(entry.power) : 0,
            thp: Number.isFinite(Number(entry.thp)) ? Number(entry.thp) : 0,
            troops: typeof entry.troops === 'string' && entry.troops.trim()
                ? entry.troops.trim()
                : 'Unknown',
        };
    }).filter(function(player) {
        return typeof player.name === 'string' && player.name.trim().length > 0;
    });
}

function normalizePlayerRecordForUi(name, entry) {
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.normalizePlayerRecordForUi(name, entry);
    }

    const raw = entry && typeof entry === 'object' ? entry : {};
    const power = Number(raw.power);
    const thp = Number(raw.thp);
    return {
        name: String(name || ''),
        power: Number.isFinite(power) ? power : 0,
        troops: typeof raw.troops === 'string' && raw.troops.trim() ? raw.troops.trim() : 'Unknown',
        thp: Number.isFinite(thp) ? thp : 0,
    };
}

function buildPlayersManagementRows(source) {
    const db = getPlayersDatabaseBySource(source);
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.buildRowsFromDatabase === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.buildRowsFromDatabase(db);
    }
    return Object.keys(db).map((name) => normalizePlayerRecordForUi(name, db[name]));
}

function hasActivePlayersManagementFilters() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectPlayersManagementFilters === 'function'
    ) {
        const filters = window.DSAppStateStore.selectors.selectPlayersManagementFilters(getAppRuntimeState());
        return filters.searchTerm.length > 0
            || filters.troopsFilter !== ''
            || filters.sortFilter !== PLAYERS_MANAGEMENT_DEFAULT_SORT;
    }

    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.hasActiveFilters === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.hasActiveFilters({
            searchTerm: playersManagementSearchTerm,
            troopsFilter: playersManagementTroopsFilter,
            sortFilter: playersManagementSortFilter,
        });
    }
    return playersManagementSearchTerm.length > 0
        || playersManagementTroopsFilter !== ''
        || playersManagementSortFilter !== PLAYERS_MANAGEMENT_DEFAULT_SORT;
}

function syncPlayersManagementFilterStateFromUi() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');

    const nextFilterState = {
        searchTerm: searchInput ? String(searchInput.value || '').trim() : '',
        troopsFilter: troopsSelect ? String(troopsSelect.value || '').trim() : '',
        sortFilter: sortSelect ? String(sortSelect.value || '').trim() : '',
    };

    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.normalizeFilterState === 'function'
    ) {
        const normalized = window.DSFeaturePlayersManagementCore.normalizeFilterState(nextFilterState);
        playersManagementSearchTerm = normalized.searchTerm;
        playersManagementTroopsFilter = normalized.troopsFilter;
        playersManagementSortFilter = normalized.sortFilter;
        syncPlayersManagementFilterState();
        return;
    }

    playersManagementSearchTerm = nextFilterState.searchTerm;
    playersManagementTroopsFilter = nextFilterState.troopsFilter;
    playersManagementSortFilter = nextFilterState.sortFilter || PLAYERS_MANAGEMENT_DEFAULT_SORT;
    syncPlayersManagementFilterState();
}

function updatePlayersManagementClearFiltersButton() {
    const clearButton = document.getElementById('playersMgmtClearFiltersBtn');
    if (!clearButton) {
        return;
    }
    clearButton.hidden = !hasActivePlayersManagementFilters();
}

function applyPlayersManagementFilters(rows) {
    if (
        window.DSFeaturePlayersManagementCore
        && typeof window.DSFeaturePlayersManagementCore.applyFilters === 'function'
    ) {
        return window.DSFeaturePlayersManagementCore.applyFilters(rows, {
            searchTerm: playersManagementSearchTerm,
            troopsFilter: playersManagementTroopsFilter,
            sortFilter: playersManagementSortFilter,
        });
    }

    const filtered = Array.isArray(rows) ? rows.slice() : [];
    const term = playersManagementSearchTerm;
    const termLower = term.toLowerCase();
    const troops = playersManagementTroopsFilter;
    const sort = playersManagementSortFilter;

    const termFiltered = term
        ? filtered.filter((player) => String(player.name || '').toLowerCase().includes(termLower))
        : filtered;
    const troopsFiltered = troops
        ? termFiltered.filter((player) => String(player.troops || '').trim() === troops)
        : termFiltered;

    troopsFiltered.sort((a, b) => {
        if (sort === 'power-asc') {
            if (a.power !== b.power) {
                return a.power - b.power;
            }
            return a.name.localeCompare(b.name);
        }
        if (sort === 'name-asc') {
            return a.name.localeCompare(b.name);
        }
        if (sort === 'name-desc') {
            return b.name.localeCompare(a.name);
        }
        if (b.power !== a.power) {
            return b.power - a.power;
        }
        return a.name.localeCompare(b.name);
    });

    return troopsFiltered;
}

function renderPlayersManagementFilters() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');
    if (searchInput) {
        searchInput.value = playersManagementSearchTerm;
    }
    if (troopsSelect) {
        troopsSelect.value = playersManagementTroopsFilter;
    }
    if (sortSelect) {
        sortSelect.value = playersManagementSortFilter;
    }
    updatePlayersManagementClearFiltersButton();
}

function handlePlayersManagementFilterChange() {
    syncPlayersManagementFilterStateFromUi();
    renderPlayersManagementTable();
}

function clearPlayersManagementFilters() {
    const searchInput = document.getElementById('playersMgmtSearchFilter');
    const troopsSelect = document.getElementById('playersMgmtTroopsFilter');
    const sortSelect = document.getElementById('playersMgmtSortFilter');
    if (searchInput) {
        searchInput.value = '';
    }
    if (troopsSelect) {
        troopsSelect.value = '';
    }
    if (sortSelect) {
        sortSelect.value = PLAYERS_MANAGEMENT_DEFAULT_SORT;
    }
    playersManagementSearchTerm = '';
    playersManagementTroopsFilter = '';
    playersManagementSortFilter = PLAYERS_MANAGEMENT_DEFAULT_SORT;
    syncPlayersManagementFilterState();
    renderPlayersManagementTable();
}

function renderPlayersManagementSourceControls() {
    const controls = document.getElementById('playersMgmtSourceControls');
    const personalBtn = document.getElementById('playersMgmtSourcePersonalBtn');
    const allianceBtn = document.getElementById('playersMgmtSourceAllianceBtn');
    if (!controls || !personalBtn || !allianceBtn || typeof FirebaseService === 'undefined') {
        return;
    }

    const gameplayContext = getGameplayContext();
    const hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext || undefined));
    if (!hasAlliance) {
        controls.classList.add('hidden');
        return;
    }

    controls.classList.remove('hidden');
    const source = getPlayersManagementActiveSource();
    const personalActive = source !== 'alliance';
    const allianceActive = source === 'alliance';
    personalBtn.classList.toggle('secondary', !personalActive);
    allianceBtn.classList.toggle('secondary', !allianceActive);
    personalBtn.disabled = personalActive;
    allianceBtn.disabled = allianceActive;
}

function renderPlayersManagementSharedInviteControls() {
    const button = document.getElementById('playersMgmtSharedInviteBtn');
    const status = document.getElementById('playersMgmtSharedInviteStatus');
    if (!button) {
        return;
    }
    const source = getPlayersManagementActiveSource();
    const players = buildSharedInvitePlayerPayload(source);
    button.disabled = players.length === 0;
    if (status && !status.textContent.trim()) {
        status.textContent = players.length > 0
            ? t('players_shared_invite_ready', { count: players.length })
            : t('players_shared_invite_empty');
    }
}

function renderPlayersManagementTable() {
    const tbody = document.getElementById('playersMgmtTableBody');
    if (!tbody) {
        return;
    }

    syncPlayersManagementFilterStateFromUi();
    updatePlayersManagementClearFiltersButton();

    const source = getPlayersManagementActiveSource();
    const allRows = buildPlayersManagementRows(source);
    const rows = applyPlayersManagementFilters(allRows);
    const summaryEl = document.getElementById('playersMgmtFilterSummary');
    if (summaryEl) {
        summaryEl.textContent = t('players_list_showing_count', {
            shown: rows.length,
            total: allRows.length,
        });
    }
    tbody.innerHTML = '';

    if (rows.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.classList.add('players-mgmt-empty-row');
        let emptyHtml = `<td colspan="5"><span style="opacity: 0.7;">${escapeHtml(t('players_list_empty'))}</span>`;
        if (source === 'personal' && allRows.length === 0) {
            emptyHtml += ` <button id="fillSamplePlayersBtn" data-pm-action="fill-sample" class="secondary" type="button" style="margin-left: 8px;">${escapeHtml(t('players_fill_sample_button'))}</button>`;
        }
        emptyHtml += '</td>';
        emptyRow.innerHTML = emptyHtml;
        tbody.appendChild(emptyRow);
        return;
    }

    const playerNameHeader = escapeAttribute(t('table_header_player_name'));
    const powerHeader = escapeAttribute(t('table_header_power'));
    const thpHeader = escapeAttribute(t('table_header_thp'));
    const troopHeader = escapeAttribute(t('table_header_troop'));
    const actionsHeader = escapeAttribute(t('players_list_actions_header'));
    const fragment = document.createDocumentFragment();
    rows.forEach((player) => {
        const row = document.createElement('tr');
        row.dataset.player = player.name;
        if (playersManagementEditingName === player.name) {
            row.classList.add('players-mgmt-edit-row');
            const troopsValue = player.troops;
            row.innerHTML = `
                <td data-label="${playerNameHeader}"><input type="text" data-field="name" value="${escapeAttribute(player.name)}"></td>
                <td data-label="${powerHeader}"><input type="number" data-field="power" min="0" step="0.1" value="${escapeAttribute(String(player.power))}"></td>
                <td data-label="${thpHeader}"><input type="number" data-field="thp" min="0" step="0.1" value="${escapeAttribute(String(player.thp))}"></td>
                <td data-label="${troopHeader}">
                    <select data-field="troops">
                        <option value="Tank" ${troopsValue === 'Tank' ? 'selected' : ''}>${escapeHtml(t('troops_filter_tank'))}</option>
                        <option value="Aero" ${troopsValue === 'Aero' ? 'selected' : ''}>${escapeHtml(t('troops_filter_aero'))}</option>
                        <option value="Missile" ${troopsValue === 'Missile' ? 'selected' : ''}>${escapeHtml(t('troops_filter_missile'))}</option>
                        <option value="Unknown" ${troopsValue !== 'Tank' && troopsValue !== 'Aero' && troopsValue !== 'Missile' ? 'selected' : ''}>Unknown</option>
                    </select>
                </td>
                <td data-label="${actionsHeader}">
                    <div class="players-mgmt-actions players-mgmt-actions--edit">
                        <button type="button" class="players-mgmt-save-btn" data-pm-action="save" data-player="${escapeAttribute(player.name)}" title="${escapeHtml(t('players_list_save_button'))}" aria-label="${escapeHtml(t('players_list_save_button'))}"><span class="action-btn-text">${escapeHtml(t('players_list_save_button'))}</span><span class="action-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,8 7,12 13,4"/></svg></span></button>
                        <button type="button" class="secondary players-mgmt-cancel-btn" data-pm-action="cancel" data-player="${escapeAttribute(player.name)}" title="${escapeHtml(t('players_list_cancel_button'))}" aria-label="${escapeHtml(t('players_list_cancel_button'))}"><span class="action-btn-text">${escapeHtml(t('players_list_cancel_button'))}</span><span class="action-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg></span></button>
                    </div>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td data-label="${playerNameHeader}"><strong>${escapeHtml(player.name)}</strong></td>
                <td data-label="${powerHeader}">${escapeHtml(String(player.power))}M</td>
                <td data-label="${thpHeader}">${escapeHtml(String(player.thp))}</td>
                <td data-label="${troopHeader}">${escapeHtml(getTroopLabel(player.troops))}</td>
                <td data-label="${actionsHeader}">
                    <div class="players-mgmt-actions players-mgmt-actions--default">
                        <button type="button" class="secondary players-mgmt-edit-btn" data-pm-action="edit" data-player="${escapeAttribute(player.name)}" title="${escapeHtml(t('players_list_edit_button'))}"><span class="action-btn-text">${escapeHtml(t('players_list_edit_button'))}</span><span class="action-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5,1.5l3,3L5,14H2v-3Z"/></svg></span></button>
                        <button type="button" class="clear-btn players-mgmt-danger-btn" data-pm-action="delete" data-player="${escapeAttribute(player.name)}" title="${escapeHtml(t('players_list_delete_button'))}"><span class="action-btn-text">${escapeHtml(t('players_list_delete_button'))}</span><span class="action-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2,4h12"/><path d="M5,4V2h6v2"/><path d="M4,4l1,10h6l1,-10"/><line x1="7" y1="7" x2="7" y2="12"/><line x1="9" y1="7" x2="9" y2="12"/></svg></span></button>
                        <button type="button" class="players-mgmt-invite-btn" data-pm-action="invite" data-player="${escapeAttribute(player.name)}" title="${escapeHtml(t('players_list_invite_button'))}"><span class="invite-btn-text">${escapeHtml(t('players_list_invite_button'))}</span><span class="invite-btn-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="12" x2="12" y2="4"/><polyline points="7,4 12,4 12,9"/></svg></span></button>
                    </div>
                </td>
            `;
        }
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

function renderPlayersManagementPanel() {
    const section = document.getElementById('playersListSection');
    if (!section) {
        return;
    }

    const content = document.getElementById('playersListContent');
    const icon = document.getElementById('playersListExpandIcon');
    if (content && icon) {
        content.classList.toggle('collapsed', !playersListPanelExpanded);
        icon.classList.toggle('rotated', playersListPanelExpanded);
    }

    renderPlayersManagementSourceControls();
    renderPlayersManagementAddPanel();
    renderPlayersManagementSharedInviteControls();
    renderPlayersManagementFilters();
    renderPlayersManagementTable();

    const source = getPlayersManagementActiveSource();
    const count = buildPlayersManagementRows(source).length;
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
    const countEl = document.getElementById('playersListCount');
    if (countEl) {
        countEl.textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    }
    const hintEl = document.getElementById('playersListHint');
    if (hintEl) {
        hintEl.textContent = t('players_list_hint');
    }

    const clearBtn = document.getElementById('clearAllPlayersBtn');
    if (clearBtn) {
        const isPersonal = getPlayersManagementActiveSource() === 'personal';
        const hasPlayers = buildPlayersManagementRows('personal').length > 0;
        clearBtn.classList.toggle('hidden', !(isPersonal && hasPlayers));
    }
}

async function switchPlayersManagementSource(source) {
    const returnToPlayersPage = getCurrentPageViewState() === 'players';
    await switchPlayerSource(source, 'playersMgmtSourceStatus');
    if (returnToPlayersPage) {
        showPlayersManagementPage();
    }
    renderPlayersManagementPanel();
}

function resetPlayersManagementAddForm() {
    const nameInput = document.getElementById('playersMgmtNewName');
    const powerInput = document.getElementById('playersMgmtNewPower');
    const thpInput = document.getElementById('playersMgmtNewThp');
    const troopsSelect = document.getElementById('playersMgmtNewTroops');
    if (nameInput) {
        nameInput.value = '';
    }
    if (powerInput) {
        powerInput.value = '';
    }
    if (thpInput) {
        thpInput.value = '';
    }
    if (troopsSelect) {
        troopsSelect.value = 'Tank';
    }
}

function generateSamplePlayers(count) {
    var names = [
        'Shadow_Phoenix', 'IronFist_X', 'WarPath42', 'DragonSlayer', 'ThunderBolt99',
        'NightHawk_Z', 'StormBreaker', 'VoidWalker', 'CrimsonBlade', 'FrostGiant',
        'DarkMatter77', 'SwiftStrike', 'TigerClaw88', 'SilentArrow', 'BlitzKrieg',
        'ChaosLord', 'EagleEye_X', 'MightyQuinn', 'ViperFang', 'GhostRider66',
        'LightningFist', 'BerserkerKing', 'QuantumLeap', 'ShadowBane', 'WarlordX',
        'HyperDrive', 'SteelTitan', 'NovaBurst', 'PhantomKnight', 'IceDragon',
        'BloodMoon', 'CyberWolf', 'DoomBringer', 'TurboForce', 'AcidRain',
        'ZeroHour', 'NeonSaber', 'OmegaForce', 'TerrorByte', 'SkyHammer',
    ];
    var troops = ['Tank', 'Aero', 'Missile', 'Unknown'];
    return names.slice(0, count).map(function (name, i) {
        return {
            name: name,
            power: Math.round((10000 + Math.random() * 140000) * 10) / 10,
            thp: Math.round(Math.random() * 650 * 10) / 10,
            troops: troops[i % troops.length],
        };
    });
}

async function handleFillWithSamplePlayers() {
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }
    const source = getPlayersManagementActiveSource();
    if (source !== 'personal') return;
    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) return;

    showMessage('playersMgmtStatus', t('players_fill_sample_processing'), 'processing');
    const players = generateSamplePlayers(40);
    const result = await FirebaseService.fillPersonalPlayerDatabase(players, gameplayContext);
    if (result && result.success) {
        await refreshPlayersDataAfterMutation('personal');
        renderPlayersManagementPanel();
        showMessage('playersMgmtStatus', t('players_fill_sample_success', { count: result.playerCount }), 'success');
    } else {
        showMessage('playersMgmtStatus', t('error_generic') || 'Error adding sample players.', 'error');
    }
}

async function handleClearAllPlayers(button) {
    if (!button) return;
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }
    const source = getPlayersManagementActiveSource();
    if (source !== 'personal') return;

    if (button.getAttribute('data-confirm') !== 'pending') {
        const originalHtml = button.innerHTML;
        button.setAttribute('data-confirm', 'pending');
        button.innerHTML = '<span class="action-btn-text">' + escapeHtml(t('players_mgmt_confirm_delete')) + '</span>';
        button.classList.add('btn-confirm-pending');
        const timerId = setTimeout(function () {
            button.removeAttribute('data-confirm');
            button.innerHTML = originalHtml;
            button.classList.remove('btn-confirm-pending');
        }, 3000);
        button.dataset.confirmTimer = timerId;
        return;
    }

    clearTimeout(parseInt(button.dataset.confirmTimer, 10));
    button.removeAttribute('data-confirm');
    button.classList.remove('btn-confirm-pending');

    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) return;

    showMessage('playersMgmtStatus', t('players_clear_all_processing'), 'processing');
    const result = await FirebaseService.clearPersonalPlayerDatabase(gameplayContext);
    if (result && result.success) {
        await refreshPlayersDataAfterMutation('personal');
        renderPlayersManagementPanel();
        showMessage('playersMgmtStatus', t('players_clear_all_success'), 'success');
    } else {
        showMessage('playersMgmtStatus', t('error_generic') || 'Error clearing players.', 'error');
    }
}

async function handlePlayersManagementAddPlayer() {
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const nameInput = document.getElementById('playersMgmtNewName');
    const powerInput = document.getElementById('playersMgmtNewPower');
    const thpInput = document.getElementById('playersMgmtNewThp');
    const troopsSelect = document.getElementById('playersMgmtNewTroops');
    const source = getPlayersManagementActiveSource();
    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) {
        return;
    }
    const payload = {
        name: nameInput ? nameInput.value : '',
        power: powerInput ? powerInput.value : 0,
        thp: thpInput ? thpInput.value : 0,
        troops: troopsSelect ? troopsSelect.value : 'Unknown',
    };

    const result = await FirebaseService.upsertPlayerEntry(source, '', payload, gameplayContext);
    if (result && result.success) {
        playersManagementEditingName = '';
        showMessage('playersMgmtStatus', t('players_list_added'), 'success');
        resetPlayersManagementAddForm();
        if (window.matchMedia && window.matchMedia('(max-width: 700px)').matches) {
            togglePlayersManagementAddPanel(false);
        }
        const returnToPlayersPage = getCurrentPageViewState() === 'players';
        await refreshPlayersDataAfterMutation(source);
        if (returnToPlayersPage) {
            showPlayersManagementPage();
        }
        renderPlayersManagementPanel();
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.focusAddNameField === 'function') {
            controller.focusAddNameField();
        } else if (nameInput) {
            nameInput.focus();
        }
        return;
    }

    showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
}

async function handlePlayersManagementSharedInvite(button) {
    if (!button) {
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtSharedInviteStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const source = getPlayersManagementActiveSource();
    const gameplayContext = getGameplayContext('playersMgmtSharedInviteStatus');
    const players = buildSharedInvitePlayerPayload(source);
    if (!gameplayContext) {
        return;
    }
    if (!players.length) {
        showMessage('playersMgmtSharedInviteStatus', t('players_shared_invite_empty'), 'error');
        return;
    }

    const originalButtonContent = button.innerHTML;
    const currentLang = (window.DSI18N && typeof window.DSI18N.getCurrentLanguage === 'function')
        ? window.DSI18N.getCurrentLanguage()
        : 'en';
    const gameId = gameplayContext.gameId || '';

    button.disabled = true;
    button.innerHTML = '<span class="action-btn-text">' + escapeHtml(t('invite_generating')) + '</span>';
    showMessage('playersMgmtSharedInviteStatus', t('players_shared_invite_generating'), 'processing');

    try {
        let result;
        let inviteUrl;
        if (source === 'personal') {
            const currentUser = FirebaseService.getCurrentUser ? FirebaseService.getCurrentUser() : null;
            const uid = currentUser ? currentUser.uid : '';
            if (!uid) {
                showMessage('playersMgmtSharedInviteStatus', t('invite_error'), 'error');
                return;
            }
            result = await FirebaseService.createPersonalSharedUpdateInvite(uid, players, {
                gameId: gameId,
                expiryHours: 48,
                maxVerificationAttempts: 3,
            });
            if (!result || !result.success) {
                showMessage('playersMgmtSharedInviteStatus', t('invite_error'), 'error');
                return;
            }
            inviteUrl = new URL('player-update.html', window.location.href).href.split('?')[0]
                + '?shared=' + encodeURIComponent(result.inviteId)
                + '&uid=' + encodeURIComponent(uid)
                + '&lang=' + encodeURIComponent(currentLang)
                + (gameId ? '&gid=' + encodeURIComponent(gameId) : '');
        } else {
            const allianceId = FirebaseService.getAllianceId ? FirebaseService.getAllianceId(gameplayContext || undefined) : '';
            if (!allianceId) {
                showMessage('playersMgmtSharedInviteStatus', t('invite_error'), 'error');
                return;
            }
            result = await FirebaseService.createAllianceSharedUpdateInvite(allianceId, players, {
                gameId: gameId,
                expiryHours: 48,
                maxVerificationAttempts: 3,
            });
            if (!result || !result.success) {
                showMessage('playersMgmtSharedInviteStatus', t('invite_error'), 'error');
                return;
            }
            inviteUrl = new URL('player-update.html', window.location.href).href.split('?')[0]
                + '?shared=' + encodeURIComponent(result.inviteId)
                + '&alliance=' + encodeURIComponent(allianceId)
                + '&lang=' + encodeURIComponent(currentLang)
                + (gameId ? '&gid=' + encodeURIComponent(gameId) : '');
        }

        showMessage('playersMgmtSharedInviteStatus', t('players_shared_invite_generated', { count: players.length }), 'success');
        showInviteLinkPopover(button, inviteUrl);
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonContent;
    }
}

async function handlePlayersManagementTableAction(event) {
    if (typeof FirebaseService === 'undefined') {
        showMessage('playersMgmtStatus', t('error_firebase_not_loaded'), 'error');
        return;
    }

    const button = event.target.closest('button[data-pm-action]');
    if (!button) {
        return;
    }

    const action = button.getAttribute('data-pm-action');
    const originalName = button.getAttribute('data-player') || '';
    const source = getPlayersManagementActiveSource();
    const gameplayContext = getGameplayContext('playersMgmtStatus');
    if (!gameplayContext) {
        return;
    }
    if (action === 'fill-sample') {
        handleFillWithSamplePlayers();
        return;
    }
    if (!action || !originalName) {
        return;
    }

    if (action === 'edit') {
        playersManagementEditingName = originalName;
        renderPlayersManagementTable();
        const editRow = document.querySelector('#playersMgmtTable tr.players-mgmt-edit-row');
        if (editRow && typeof editRow.scrollIntoView === 'function') {
            editRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return;
    }

    if (action === 'cancel') {
        playersManagementEditingName = '';
        renderPlayersManagementTable();
        return;
    }

    if (action === 'save') {
        const row = button.closest('tr');
        if (!row) {
            return;
        }
        const nameInput = row.querySelector('input[data-field="name"]');
        const powerInput = row.querySelector('input[data-field="power"]');
        const thpInput = row.querySelector('input[data-field="thp"]');
        const troopsSelect = row.querySelector('select[data-field="troops"]');
        const payload = {
            name: nameInput ? nameInput.value : '',
            power: powerInput ? powerInput.value : 0,
            thp: thpInput ? thpInput.value : 0,
            troops: troopsSelect ? troopsSelect.value : 'Unknown',
        };
        const result = await FirebaseService.upsertPlayerEntry(source, originalName, payload, gameplayContext);
        if (result && result.success) {
            playersManagementEditingName = '';
            showMessage('playersMgmtStatus', t('players_list_saved'), 'success');
            const returnToPlayersPage = getCurrentPageViewState() === 'players';
            await refreshPlayersDataAfterMutation(source);
            if (returnToPlayersPage) {
                showPlayersManagementPage();
            }
            renderPlayersManagementPanel();
            return;
        }
        showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
        return;
    }

    if (action === 'delete') {
        if (button.getAttribute('data-confirm') !== 'pending') {
            const originalText = button.textContent;
            button.setAttribute('data-confirm', 'pending');
            button.textContent = t('players_mgmt_confirm_delete');
            button.classList.add('btn-confirm-pending');
            const revert = () => {
                button.removeAttribute('data-confirm');
                button.textContent = originalText;
                button.classList.remove('btn-confirm-pending');
            };
            const timerId = setTimeout(revert, 3000);
            button.dataset.confirmTimer = timerId;
            return;
        }
        clearTimeout(parseInt(button.dataset.confirmTimer, 10));
        button.removeAttribute('data-confirm');
        const result = await FirebaseService.removePlayerEntry(source, originalName, gameplayContext);
        if (result && result.success) {
            playersManagementEditingName = '';
            const returnToPlayersPage = getCurrentPageViewState() === 'players';
            await refreshPlayersDataAfterMutation(source);
            if (returnToPlayersPage) {
                showPlayersManagementPage();
            }
            renderPlayersManagementPanel();
            showMessage('playersMgmtStatus', t('players_list_deleted'), 'success');
            return;
        }
        showMessage('playersMgmtStatus', translatePlayersManagementError(result), 'error');
    }

    if (action === 'invite') {
        button.disabled = true;
        const originalButtonContent = button.innerHTML;
        button.innerHTML = '<span class="invite-btn-text">' + escapeHtml(t('invite_generating')) + '</span>';
        let result;
        let inviteUrl;
        const sourceDb = getPlayersDatabaseBySource(source);
        const dbKeys = sourceDb && typeof sourceDb === 'object' ? Object.keys(sourceDb) : [];
        const wantedName = typeof originalName === 'string' ? originalName.trim().toLowerCase() : '';
        const canonicalPlayerName = dbKeys.find(function(name) {
            return typeof name === 'string' && name.trim().toLowerCase() === wantedName;
        }) || originalName;
        const sourceEntry = sourceDb && typeof sourceDb === 'object'
            ? sourceDb[canonicalPlayerName]
            : null;
        const currentSnapshot = sourceEntry && typeof sourceEntry === 'object'
            ? {
                power: Number.isFinite(Number(sourceEntry.power)) ? Number(sourceEntry.power) : 0,
                thp: Number.isFinite(Number(sourceEntry.thp)) ? Number(sourceEntry.thp) : 0,
                troops: typeof sourceEntry.troops === 'string' && sourceEntry.troops.trim()
                    ? sourceEntry.troops.trim()
                    : 'Unknown',
            }
            : {};
        const playerKey = (window.DSFirebaseInfra && typeof window.DSFirebaseInfra.getPlayerDocId === 'function')
            ? window.DSFirebaseInfra.getPlayerDocId(canonicalPlayerName)
            : '';
        if (!playerKey) {
            button.disabled = false;
            button.innerHTML = originalButtonContent;
            showMessage('playersMgmtStatus', t('invite_error'), 'error');
            return;
        }
        const currentLang = (window.DSI18N && typeof window.DSI18N.getCurrentLanguage === 'function')
            ? window.DSI18N.getCurrentLanguage()
            : 'en';
        if (source === 'personal') {
            const currentUser = FirebaseService.getCurrentUser ? FirebaseService.getCurrentUser() : null;
            const uid = currentUser ? currentUser.uid : null;
            if (!uid) {
                console.warn('Invite: no uid for personal invite', gameplayContext);
                button.disabled = false;
                button.innerHTML = originalButtonContent;
                showMessage('playersMgmtStatus', t('invite_error'), 'error');
                return;
            }
            const gameId = gameplayContext.gameId || '';
            result = await FirebaseService.createPersonalUpdateToken(uid, canonicalPlayerName, {
                expiryHours: 48,
                gameId: gameId,
                maxSubmissions: 3,
                playerKey: playerKey,
                currentSnapshot: currentSnapshot,
            });
            button.disabled = false;
            button.innerHTML = originalButtonContent;
            if (!result || !result.success) {
                console.warn('Invite: createPersonalUpdateToken failed', result);
                showMessage('playersMgmtStatus', t('invite_error'), 'error');
                return;
            }
            inviteUrl = new URL('player-update.html', window.location.href).href.split('?')[0]
                + '?token=' + encodeURIComponent(result.tokenId)
                + '&uid=' + encodeURIComponent(uid)
                + '&lang=' + encodeURIComponent(currentLang)
                + (gameId ? '&gid=' + encodeURIComponent(gameId) : '')
                + '&pk=' + encodeURIComponent(playerKey);
        } else {
            const allianceId = FirebaseService.getAllianceId ? FirebaseService.getAllianceId(gameplayContext) : null;
            if (!allianceId) {
                console.warn('Invite: no allianceId for gameplayContext', gameplayContext);
                button.disabled = false;
                button.innerHTML = originalButtonContent;
                showMessage('playersMgmtStatus', t('invite_error'), 'error');
                return;
            }
            const allianceGameId = (gameplayContext && gameplayContext.gameId) ? gameplayContext.gameId : '';
            result = await FirebaseService.createUpdateToken(allianceId, canonicalPlayerName, {
                expiryHours: 48,
                gameId: allianceGameId,
                maxSubmissions: 3,
                playerKey: playerKey,
                currentSnapshot: currentSnapshot,
            });
            button.disabled = false;
            button.innerHTML = originalButtonContent;
            if (!result || !result.success) {
                console.warn('Invite: createUpdateToken failed', result);
                showMessage('playersMgmtStatus', t('invite_error'), 'error');
                return;
            }
            inviteUrl = new URL('player-update.html', window.location.href).href.split('?')[0]
                + '?token=' + encodeURIComponent(result.tokenId)
                + '&alliance=' + encodeURIComponent(allianceId)
                + '&lang=' + encodeURIComponent(currentLang)
                + (allianceGameId ? '&gid=' + encodeURIComponent(allianceGameId) : '')
                + '&pk=' + encodeURIComponent(playerKey);
        }
        showInviteLinkPopover(button, inviteUrl);
    }
}

function showInviteLinkPopover(anchorButton, url) {
    const existingPopover = document.querySelector('.invite-link-popover');
    if (existingPopover) {
        existingPopover.remove();
    }
    const popover = document.createElement('div');
    popover.className = 'invite-link-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', t('invite_copy_link'));
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = url;
    input.className = 'invite-link-input';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'invite-link-copy-btn';
    copyBtn.textContent = t('invite_copy_link');
    copyBtn.addEventListener('click', function() {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function() {
                copyBtn.textContent = t('invite_link_copied');
                setTimeout(function() { copyBtn.textContent = t('invite_copy_link'); }, 2000);
            }).catch(function() {
                input.select();
                document.execCommand('copy');
                copyBtn.textContent = t('invite_link_copied');
                setTimeout(function() { copyBtn.textContent = t('invite_copy_link'); }, 2000);
            });
        } else {
            input.select();
            document.execCommand('copy');
            copyBtn.textContent = t('invite_link_copied');
            setTimeout(function() { copyBtn.textContent = t('invite_copy_link'); }, 2000);
        }
    });
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'invite-link-close-btn';
    closeBtn.setAttribute('aria-label', t('close_button'));
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', function() { popover.remove(); });
    popover.appendChild(closeBtn);
    popover.appendChild(input);
    popover.appendChild(copyBtn);
    document.body.appendChild(popover);
    const rect = anchorButton.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    popover.style.top = (rect.bottom + scrollY + 6) + 'px';
    var popoverWidth = popover.offsetWidth || 260;
    var viewportWidth = window.innerWidth;
    var idealLeft = rect.left + scrollX;
    // Keep popover within viewport with 8px margin on each side
    var maxLeft = viewportWidth - popoverWidth - 8 + scrollX;
    popover.style.left = Math.max(8, Math.min(idealLeft, maxLeft)) + 'px';
    function onOutsideClick(e) {
        if (!popover.contains(e.target) && e.target !== anchorButton) {
            popover.remove();
            document.removeEventListener('click', onOutsideClick, true);
        }
    }
    setTimeout(function() {
        document.addEventListener('click', onOutsideClick, true);
    }, 0);
}

// ============================================================
// TEMPLATE GENERATION
// ============================================================

function getActivePlayerImportSchema() {
    const defaultSchema = {
        templateFileName: 'player_database_template.xlsx',
        sheetName: 'Players',
        headerRowIndex: 9,
        columns: [
            { key: 'name', header: 'Player Name', required: true },
            { key: 'power', header: 'E1 Total Power(M)', required: true },
            { key: 'troops', header: 'E1 Troops', required: true },
        ],
    };
    const gameplayContext = getGameplayContext();
    const gameId = gameplayContext ? gameplayContext.gameId : '';
    if (window.DSCoreGames && typeof window.DSCoreGames.getGame === 'function') {
        const game = window.DSCoreGames.getGame(gameId);
        if (game && game.playerImportSchema && typeof game.playerImportSchema === 'object') {
            const schema = game.playerImportSchema;
            const columns = Array.isArray(schema.columns) && schema.columns.length > 0
                ? schema.columns
                    .map((column) => ({
                        key: typeof column.key === 'string' ? column.key.trim() : '',
                        header: typeof column.header === 'string' ? column.header.trim() : '',
                        required: column.required !== false,
                    }))
                    .filter((column) => column.key && column.header)
                : defaultSchema.columns;
            return {
                templateFileName: typeof schema.templateFileName === 'string' && schema.templateFileName.trim()
                    ? schema.templateFileName.trim()
                    : defaultSchema.templateFileName,
                sheetName: typeof schema.sheetName === 'string' && schema.sheetName.trim()
                    ? schema.sheetName.trim()
                    : defaultSchema.sheetName,
                headerRowIndex: Number.isFinite(Number(schema.headerRowIndex)) && Number(schema.headerRowIndex) >= 0
                    ? Math.floor(Number(schema.headerRowIndex))
                    : defaultSchema.headerRowIndex,
                columns: columns.length > 0 ? columns : defaultSchema.columns,
            };
        }
    }
    return defaultSchema;
}

async function downloadPlayerTemplate() {
    try {
        await ensureXLSXLoaded();
    } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        return;
    }

    const wb = XLSX.utils.book_new();
    const schema = getActivePlayerImportSchema();
    const headerRowIndex = Number.isFinite(Number(schema.headerRowIndex)) ? Math.max(0, Math.floor(Number(schema.headerRowIndex))) : 9;
    const headers = Array.isArray(schema.columns) && schema.columns.length > 0
        ? schema.columns.map((column) => column.header)
        : [t('template_header_player_name'), t('template_header_power'), t('template_header_troops')];
    
    const instructions = [
        [t('template_title')],
        [''],
        [t('template_instructions')],
        [t('template_step1')],
        [t('template_step2')],
        [t('template_step3')],
        ['THP (Total Hero Power): numeric value (e.g., 120.5). Leave empty to default to 0.'],
        [t('template_step4')],
        [t('template_step5')]
    ];
    while (instructions.length < headerRowIndex) {
        instructions.push(['']);
    }
    instructions.push(headers);
    
    const exampleValueByKey = {
        name: 'Player1',
        power: 65.0,
        troops: 'Tank',
    };
    const createExampleRow = (overrides) => schema.columns.map((column) => {
        if (!column || !column.key) {
            return '';
        }
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, column.key)) {
            return overrides[column.key];
        }
        return Object.prototype.hasOwnProperty.call(exampleValueByKey, column.key) ? exampleValueByKey[column.key] : '';
    });
    const examples = [
        createExampleRow({ name: 'Player1', power: 65.0, troops: 'Tank' }),
        createExampleRow({ name: 'Player2', power: 68.0, troops: 'Aero' }),
        createExampleRow({ name: 'Player3', power: 64.0, troops: 'Missile' }),
        createExampleRow({}),
        createExampleRow({}),
    ];
    
    const data = [...instructions, ...examples];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = headers.map((header) => ({
        wch: Math.max(15, String(header || '').length + 4),
    }));
    
    XLSX.utils.book_append_sheet(wb, ws, schema.sheetName || t('template_sheet_name'));
    XLSX.writeFile(wb, schema.templateFileName || 'player_database_template.xlsx');
    
    showMessage('uploadMessage', t('message_template_downloaded'), 'success');
}

// ============================================================
// ALLIANCE MANAGEMENT
// ============================================================

function openAlliancePanel() {
    showAlliancePage();
}

function closeAlliancePanel() {
    showGeneratorPage();
}

function renderAlliancePanel() {
    const content = document.getElementById('alliancePanelContent');
    if (!content) {
        return;
    }
    const gameplayContext = getGameplayContext();
    const hasAllianceMembership = !!(typeof FirebaseService !== 'undefined'
        && FirebaseService.getAllianceId
        && gameplayContext
        && FirebaseService.getAllianceId(gameplayContext));
    if (window.DSAlliancePanelUI && typeof window.DSAlliancePanelUI.renderAlliancePanel === 'function') {
        window.DSAlliancePanelUI.renderAlliancePanel({
            contentElement: content,
            hasAllianceMembership: hasAllianceMembership,
            getAllianceMembers: () => {
                const ctx = getGameplayContext();
                return ctx ? FirebaseService.getAllianceMembers(ctx) : {};
            },
            getAllianceName: () => {
                const ctx = getGameplayContext();
                return ctx ? FirebaseService.getAllianceName(ctx) : null;
            },
            getPendingInvitations: getPendingInvitationsList,
            getSentInvitations: getSentInvitationsList,
            getInvitationSenderDisplay: getInvitationSenderDisplay,
            formatInvitationCreatedAt: formatInvitationCreatedAt,
            getPendingInviteFocusId: () => pendingAllianceInviteFocusId,
            setPendingInviteFocusId: (value) => {
                pendingAllianceInviteFocusId = typeof value === 'string' ? value : '';
            },
            onCreateAlliance: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.createAlliance === 'function') {
                    controller.createAlliance();
                    return;
                }
                handleCreateAlliance();
            },
            onSendInvitation: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.sendInvitation === 'function') {
                    controller.sendInvitation();
                    return;
                }
                handleSendInvitation();
            },
            onLeaveAlliance: () => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.leaveAlliance === 'function') {
                    controller.leaveAlliance();
                    return;
                }
                handleLeaveAlliance();
            },
            onAcceptInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.acceptInvitation === 'function') {
                    controller.acceptInvitation(invitationId, statusElementId);
                    return;
                }
                handleAcceptInvitation(invitationId, statusElementId);
            },
            onRejectInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.rejectInvitation === 'function') {
                    controller.rejectInvitation(invitationId, statusElementId);
                    return;
                }
                handleRejectInvitation(invitationId, statusElementId);
            },
            onResendInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.resendInvitation === 'function') {
                    controller.resendInvitation(invitationId, statusElementId);
                    return;
                }
                handleResendInvitation(invitationId, statusElementId);
            },
            onRevokeInvitation: (invitationId, statusElementId) => {
                const controller = getAllianceFeatureController();
                if (controller && typeof controller.revokeInvitation === 'function') {
                    controller.revokeInvitation(invitationId, statusElementId);
                    return;
                }
                handleRevokeInvitation(invitationId, statusElementId);
            },
            translate: t,
        });
        return;
    }
    content.innerHTML = '';
}

function getPendingInvitationsList() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getPendingInvitations) {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    const invitations = FirebaseService.getPendingInvitations(gameplayContext);
    return Array.isArray(invitations) ? invitations : [];
}

function getSentInvitationsList() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.getSentInvitations) {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    const invitations = FirebaseService.getSentInvitations(gameplayContext);
    return Array.isArray(invitations) ? invitations : [];
}

function getInvitationSenderDisplay(invitation) {
    if (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.getInvitationSenderDisplay === 'function'
    ) {
        return window.DSFeatureNotificationsCore.getInvitationSenderDisplay(invitation);
    }

    if (!invitation || typeof invitation !== 'object') {
        return '';
    }
    if (typeof invitation.inviterName === 'string' && invitation.inviterName.trim()) {
        return invitation.inviterName.trim();
    }
    if (typeof invitation.inviterEmail === 'string' && invitation.inviterEmail.trim()) {
        return invitation.inviterEmail.trim();
    }
    return '';
}

function formatInvitationCreatedAt(createdAt) {
    if (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.formatInvitationCreatedAt === 'function'
    ) {
        return window.DSFeatureNotificationsCore.formatInvitationCreatedAt(createdAt);
    }

    if (!createdAt) {
        return '';
    }
    try {
        if (createdAt && typeof createdAt.toDate === 'function') {
            return createdAt.toDate().toLocaleString();
        }
        if (createdAt instanceof Date) {
            return createdAt.toLocaleString();
        }
        const value = new Date(createdAt);
        if (!Number.isNaN(value.getTime())) {
            return value.toLocaleString();
        }
    } catch (_) { // eslint-disable-line no-unused-vars
        return '';
    }
    return '';
}

function translateAllianceError(result, fallbackText) {
    if (result && result.errorKey) {
        return t(result.errorKey, result.errorParams || {});
    }
    if (result && result.error) {
        return result.error;
    }
    return fallbackText || t('error_generic', { error: 'unknown' });
}

let pendingAllianceInviteFocusId = '';

async function handleCreateAlliance() {
    const name = document.getElementById('newAllianceName').value.trim();

    if (!name || name.length > 40) {
        showMessage('allianceCreateStatus', t('alliance_error_invalid_name'), 'error');
        return;
    }

    showMessage('allianceCreateStatus', t('message_upload_processing'), 'processing');
    const gameplayContext = getGameplayContext('allianceCreateStatus');
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.createAlliance(name, gameplayContext);

    if (result.success) {
        showMessage('allianceCreateStatus', t('alliance_created'), 'success');
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
    } else {
        showMessage('allianceCreateStatus', result.error, 'error');
    }
}

async function handleSendInvitation() {
    const email = document.getElementById('inviteEmail').value.trim();
    if (!email) {
        showMessage('inviteStatus', t('alliance_error_invalid_name'), 'error');
        return;
    }

    const gameplayContext = getGameplayContext('inviteStatus');
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.sendInvitation(email, gameplayContext);
    if (result.success) {
        showMessage('inviteStatus', t('alliance_invite_sent_in_app'), 'success');
        document.getElementById('inviteEmail').value = '';
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
    } else {
        showMessage('inviteStatus', translateAllianceError(result), 'error');
    }
}

async function handleLeaveAlliance() {
    if (!confirm(t('alliance_confirm_leave'))) return;

    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.leaveAlliance(gameplayContext);
    if (result.success) {
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    }
}

async function switchPlayerSource(source, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        return;
    }
    const hasAlliance = !!(FirebaseService.getAllianceId && FirebaseService.getAllianceId(gameplayContext));
    if (source === 'alliance' && !hasAlliance) {
        showMessage(statusElementId || 'playerSourceStatus', t('players_list_error_no_alliance'), 'error');
        return;
    }

    let switchResult = null;
    try {
        if (source === 'alliance' && typeof FirebaseService.loadAllianceData === 'function') {
            await FirebaseService.loadAllianceData(gameplayContext);
        }
        switchResult = await FirebaseService.setPlayerSource(source, gameplayContext);
    } catch (error) {
        switchResult = { success: false, error: error && error.message ? error.message : 'unknown' };
    }
    loadPlayerData();
    renderAlliancePanel();

    if (switchResult && switchResult.success === false) {
        showMessage(statusElementId || 'playerSourceStatus', switchResult.error || t('error_generic', { error: 'unknown' }), 'error');
        return;
    }

    const sourceLabels = {
        personal: t('alliance_source_personal'),
        alliance: t('alliance_source_alliance'),
    };
    const sourceLabel = Object.prototype.hasOwnProperty.call(sourceLabels, source)
        ? sourceLabels[source]
        : source;
    if (switchResult && switchResult.persisted === false) {
        const fallbackMessage = switchResult.warningMessage
            || 'Player source changed locally, but cloud sync is blocked by Firestore rules.';
        showMessage(statusElementId || 'playerSourceStatus', fallbackMessage, 'warning');
        return;
    }
    showMessage(statusElementId || 'playerSourceStatus', t('alliance_source_switched', { source: sourceLabel }), 'success');
}

function updateAllianceHeaderDisplay() {
    if (typeof FirebaseService === 'undefined') return;
    const gameplayContext = getGameplayContext();
    const aid = gameplayContext ? FirebaseService.getAllianceId(gameplayContext) : null;
    const aName = gameplayContext ? FirebaseService.getAllianceName(gameplayContext) : null;
    const display = document.getElementById('allianceDisplay');
    const createBtn = document.getElementById('allianceCreateBtn');

    if (aid) {
        if (display) {
            display.textContent = '(' + (aName || aid) + ')';
            display.style.display = 'inline';
        }
        if (createBtn) createBtn.style.display = 'none';
    } else {
        if (display) display.style.display = 'none';
        if (createBtn) createBtn.style.display = 'inline-flex';
    }
}

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================

let notificationPollInterval = null;

async function checkAndDisplayNotifications() {
    if (typeof FirebaseService === 'undefined' || !FirebaseService.isSignedIn()) return;
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const notifications = await FirebaseService.checkInvitations(gameplayContext);
    var badgeState;
    if (
        window.DSFeatureNotificationsCore
        && typeof window.DSFeatureNotificationsCore.getNotificationBadgeState === 'function'
    ) {
        badgeState = window.DSFeatureNotificationsCore.getNotificationBadgeState(notifications);
    } else {
        const count = Array.isArray(notifications) ? notifications.length : 0;
        badgeState = { count: count, hasNotifications: count > 0 };
    }
    const badge = document.getElementById('notificationBadge');
    const notificationBtn = document.getElementById('notificationBtn');
    if (badge) {
        badge.textContent = badgeState.count;
        badge.style.display = badgeState.hasNotifications ? 'flex' : 'none';
    }
    if (notificationBtn) {
        notificationBtn.classList.toggle('has-notifications', badgeState.hasNotifications);
    }
}

function startNotificationPolling() {
    if (notificationPollInterval) return;
    notificationPollInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && typeof FirebaseService !== 'undefined' && FirebaseService.isSignedIn()) {
            checkAndDisplayNotifications();
        }
    }, 60000);
}

function stopNotificationPolling() {
    if (notificationPollInterval) {
        clearInterval(notificationPollInterval);
        notificationPollInterval = null;
    }
}

async function toggleNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    const triggerBtn = document.getElementById('notificationBtn');
    if (!panel) {
        return;
    }
    const isOpen = panel.classList.contains('hidden') || !panel.classList.contains('ui-open');
    if (
        window.DSShellNotificationsSheetController
        && typeof window.DSShellNotificationsSheetController.setSheetState === 'function'
    ) {
        window.DSShellNotificationsSheetController.setSheetState({
            panel: panel,
            triggerButton: triggerBtn,
            body: document.body,
            isOpen: isOpen,
            setPanelVisibility: setPanelVisibility,
        });
    } else {
        setPanelVisibility(panel, isOpen);
        if (triggerBtn) {
            triggerBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        }
        document.body.classList.toggle('notifications-sheet-open', isOpen);
    }
    if (isOpen) {
        await checkAndDisplayNotifications();
        renderNotifications();
    }
}

function closeNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    const triggerBtn = document.getElementById('notificationBtn');
    if (!panel || (panel.classList.contains('hidden') && !panel.classList.contains('ui-open'))) {
        return;
    }
    if (
        window.DSShellNotificationsSheetController
        && typeof window.DSShellNotificationsSheetController.setSheetState === 'function'
    ) {
        window.DSShellNotificationsSheetController.setSheetState({
            panel: panel,
            triggerButton: triggerBtn,
            body: document.body,
            isOpen: false,
            setPanelVisibility: setPanelVisibility,
        });
    } else {
        setPanelVisibility(panel, false);
        if (triggerBtn) {
            triggerBtn.setAttribute('aria-expanded', 'false');
        }
        document.body.classList.remove('notifications-sheet-open');
    }
}

function getNotificationItems() {
    if (typeof FirebaseService === 'undefined') {
        return [];
    }
    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return [];
    }
    if (FirebaseService.getInvitationNotifications) {
        const items = FirebaseService.getInvitationNotifications(gameplayContext);
        return Array.isArray(items) ? items : [];
    }

    const invitations = FirebaseService.getPendingInvitations ? FirebaseService.getPendingInvitations(gameplayContext) : [];
    if (!Array.isArray(invitations)) {
        return [];
    }

    return invitations.map((inv) => ({
        id: inv && inv.id ? `invite:${inv.id}` : '',
        invitationId: inv && inv.id ? inv.id : '',
        notificationType: 'invitation_pending',
        allianceId: inv && inv.allianceId ? inv.allianceId : '',
        allianceName: inv && inv.allianceName ? inv.allianceName : '',
        inviterEmail: inv && inv.inviterEmail ? inv.inviterEmail : '',
        inviterName: inv && inv.inviterName ? inv.inviterName : '',
        createdAt: inv && inv.createdAt ? inv.createdAt : null,
    }));
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    const notifications = getNotificationItems();

    if (notifications.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'notifications-empty';
        emptyState.textContent = t('notifications_empty');
        container.replaceChildren(emptyState);
        return;
    }

    container.replaceChildren();
    notifications.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'notification-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');

        const heading = document.createElement('div');
        heading.className = 'notification-card-heading';
        const allianceLabel = (typeof item.allianceName === 'string' && item.allianceName.trim())
            ? item.allianceName.trim()
            : String(item.allianceId || '');
        const title = document.createElement('strong');
        title.textContent = t('notification_alliance_label', { alliance: allianceLabel || '-' });
        heading.appendChild(title);

        const detail = document.createElement('div');
        detail.className = 'notification-card-detail';
        if (
            window.DSFeatureNotificationsCore
            && typeof window.DSFeatureNotificationsCore.getNotificationDetailText === 'function'
        ) {
            detail.textContent = window.DSFeatureNotificationsCore.getNotificationDetailText(item, t);
        } else {
            const notificationType = item && typeof item.notificationType === 'string'
                ? item.notificationType
                : 'invitation_pending';
            if (notificationType === 'invite_reminder_day1') {
                detail.textContent = t('notification_invite_reminder_day1');
            } else if (notificationType === 'invite_reminder_day3') {
                detail.textContent = t('notification_invite_reminder_day3');
            } else {
                detail.textContent = t('notification_invited_by', { email: getInvitationSenderDisplay(item) || '-' });
            }
        }

        const cta = document.createElement('div');
        cta.className = 'notification-card-cta';
        cta.textContent = t('notification_open_alliance');

        card.appendChild(heading);
        card.appendChild(detail);
        card.appendChild(cta);
        card.addEventListener('click', () => openAllianceInvitesFromNotification(item.invitationId || item.id));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAllianceInvitesFromNotification(item.invitationId || item.id);
            }
        });
        container.appendChild(card);
    });
}

function openAllianceInvitesFromNotification(invitationId) {
    pendingAllianceInviteFocusId = invitationId || '';
    closeNotificationsPanel();
    closeNavigationMenu();
    openAlliancePanel();
}

async function handleAcceptInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const invitation = getPendingInvitationsList().find((item) => item && item.id === invitationId);
    const currentAllianceId = typeof FirebaseService !== 'undefined' && FirebaseService.getAllianceId
        ? FirebaseService.getAllianceId(gameplayContext)
        : null;
    if (currentAllianceId && invitation && invitation.allianceId && currentAllianceId !== invitation.allianceId) {
        showMessage(statusElementId || 'allianceInvitesStatus', t('alliance_error_already_in_alliance'), 'error');
        return;
    }
    const allianceName = invitation && (invitation.allianceName || invitation.allianceId)
        ? String(invitation.allianceName || invitation.allianceId)
        : '';
    if (!confirm(t('alliance_confirm_join_invite', { alliance: allianceName || '-' }))) {
        return;
    }

    const result = await FirebaseService.acceptInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        updateAllianceHeaderDisplay();
        loadPlayerData();
    } else {
        showMessage(statusElementId || 'allianceInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleRejectInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.rejectInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceInvitesStatus', t('success_generic'), 'success');
    } else {
        showMessage(statusElementId || 'allianceInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleRevokeInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.revokeInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceSentInvitesStatus', t('alliance_invite_revoke_success'), 'success');
    } else {
        showMessage(statusElementId || 'allianceSentInvitesStatus', translateAllianceError(result), 'error');
    }
}

async function handleResendInvitation(invitationId, statusElementId) {
    const gameplayContext = getGameplayContext(statusElementId);
    if (!gameplayContext) {
        return;
    }
    const result = await FirebaseService.resendInvitation(invitationId, gameplayContext);
    if (result.success) {
        await checkAndDisplayNotifications();
        renderNotifications();
        renderAlliancePanel();
        showMessage(statusElementId || 'allianceSentInvitesStatus', t('alliance_invite_resend_success'), 'success');
    } else {
        showMessage(statusElementId || 'allianceSentInvitesStatus', translateAllianceError(result), 'error');
    }
}

// ============================================================
// PLAYER DATA MANAGEMENT
// ============================================================

let pendingUploadFile = null;

function _getUploadDeps() {
    return {
        t: t,
        showMessage: showMessage,
        getGameplayContext: getGameplayContext,
        FirebaseService: typeof FirebaseService !== 'undefined' ? FirebaseService : undefined,
        loadPlayerData: loadPlayerData,
        ensureXLSXLoaded: ensureXLSXLoaded,
        document: document,
        openModalOverlay: openModalOverlay,
        normalizePlayerRecordForUi: normalizePlayerRecordForUi,
        setAllPlayers: function (rows) { allPlayers = rows; },
        renderPlayersManagementPanel: renderPlayersManagementPanel,
        renderPlayersTable: renderPlayersTable,
        updateTeamCounters: updateTeamCounters,
    };
}

function _getBuildingDeps() {
    return {
        t: t,
        showMessage: showMessage,
        document: document,
        currentEvent: currentEvent,
        FirebaseService: typeof FirebaseService !== 'undefined' ? FirebaseService : undefined,
        getGameplayContext: getGameplayContext,
        getEventGameplayContext: getEventGameplayContext,
        normalizeEventId: normalizeEventId,
        getBuildingConfig: getBuildingConfig,
        setBuildingConfig: setBuildingConfig,
        getBuildingPositions: getBuildingPositions,
        setBuildingPositionsLocal: setBuildingPositionsLocal,
        getBuildingSlotsTotal: getBuildingSlotsTotal,
        normalizeBuildingConfig: normalizeBuildingConfig,
        clampPriority: clampPriority,
        clampSlots: clampSlots,
        escapeAttribute: escapeAttribute,
        isConfigurationPageVisible: isConfigurationPageVisible,
        getActiveEvent: getActiveEvent,
        getMapRuntimeState: getMapRuntimeState,
        loadMapImage: loadMapImage,
        openModalOverlay: openModalOverlay,
        closeModalOverlay: closeModalOverlay,
        getEventDisplayName: getEventDisplayName,
        switchEvent: switchEvent,
        loadBuildingConfig: loadBuildingConfig,
        loadBuildingPositions: loadBuildingPositions,
        EVENT_REGISTRY: EVENT_REGISTRY,
        MIN_BUILDING_SLOTS: MIN_BUILDING_SLOTS,
        MAX_BUILDING_SLOTS_TOTAL: MAX_BUILDING_SLOTS_TOTAL,
        BUILDING_CONFIG_VERSION: BUILDING_CONFIG_VERSION,
        BUILDING_POSITIONS_VERSION: BUILDING_POSITIONS_VERSION,
        MAP_EXPORT: MAP_EXPORT,
        MAP_CANVAS_WIDTH: MAP_CANVAS_WIDTH,
        MAP_CANVAS_FALLBACK_HEIGHT: MAP_CANVAS_FALLBACK_HEIGHT,
        MAP_GRID_STEP: MAP_GRID_STEP,
    };
}

function getTargetBuildingConfigVersion() {
    return window.DSBuildingsConfigManager.getTargetBuildingConfigVersion(BUILDING_CONFIG_VERSION, typeof FirebaseService !== 'undefined' ? FirebaseService : undefined);
}

function getTargetBuildingPositionsVersion() {
    return window.DSBuildingsConfigManager.getTargetBuildingPositionsVersion(BUILDING_POSITIONS_VERSION, typeof FirebaseService !== 'undefined' ? FirebaseService : undefined);
}

function refreshCoordinatesPickerForCurrentEvent() {
    return window.DSCoordinatePickerController.refreshCoordinatesPickerForCurrentEvent(_coordState, _getCoordDeps());
}

async function resolveAllianceUploadAccess(gameplayContext) {
    return window.DSPlayerDataUpload.resolveAllianceUploadAccess(gameplayContext, _getUploadDeps());
}

async function uploadPlayerData() {
    const activeGameId = enforceGameplayContext('uploadMessage');
    if (!activeGameId) return;
    if (typeof FirebaseService === 'undefined') {
        showMessage('uploadMessage', t('error_firebase_not_loaded'), 'error');
        return;
    }
    const fileInput = document.getElementById('playerFileInput');
    const file = fileInput.files[0];
    if (!file) return;
    try { await ensureXLSXLoaded(); } catch (error) {
        console.error(error);
        showMessage('uploadMessage', t('error_xlsx_missing'), 'error');
        fileInput.value = '';
        return;
    }
    const gameplayContext = getGameplayContext('uploadMessage');
    const hasAlliance = await resolveAllianceUploadAccess(gameplayContext);
    if (hasAlliance) {
        pendingUploadFile = file;
        openUploadTargetModal({ hasAlliance: true, gameplayContext });
    } else {
        await performUpload(file, 'personal');
    }
    fileInput.value = '';
}

function closeUploadTargetModal() {
    pendingUploadFile = null;
    const modal = document.getElementById('uploadTargetModal');
    if (modal) closeModalOverlay(modal);
}

function openUploadTargetModal(options) {
    window.DSPlayerDataUpload.openUploadTargetModal(options, _getUploadDeps());
}

async function uploadToPersonal() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'personal');
}

async function uploadToAlliance() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'alliance');
}

async function uploadToBoth() {
    const file = pendingUploadFile;
    closeUploadTargetModal();
    if (file) await performUpload(file, 'both');
}

async function performUpload(file, target) {
    return window.DSPlayerDataUpload.performUpload(file, target, _getUploadDeps());
}

function syncPlayersFromActiveDatabase(options) {
    window.DSPlayerDataUpload.syncPlayersFromActiveDatabase(options, _getUploadDeps());
}

function handleAllianceDataRealtimeUpdate() {
    if (typeof FirebaseService === 'undefined') return;
    if (getCurrentPageViewState() === 'alliance') renderAlliancePanel();
    const gameplayContext = getGameplayContext();
    const source = FirebaseService.getPlayerSource ? FirebaseService.getPlayerSource(gameplayContext || undefined) : 'personal';
    if (source === 'alliance') {
        syncPlayersFromActiveDatabase({ renderGeneratorViews: true });
    } else {
        renderPlayersManagementPanel();
    }
    updateAllianceHeaderDisplay();
    updateFloatingButtonsVisibility();
}

function loadPlayerData() {
    const gameplayContext = getGameplayContext('uploadMessage');
    if (!gameplayContext) { console.error('missing-active-game'); return; }
    if (typeof FirebaseService === 'undefined') { console.error('FirebaseService not available'); return; }
    buildRegistryFromStorage();
    syncRuntimeStateWithRegistry();
    renderAllEventSelectors();
    renderEventsList();
    updateGenerateEventLabels();
    if (!eventEditorCurrentId || !window.DSCoreEvents.getEvent(eventEditorCurrentId)) { applySelectedEventToEditor(); }
    updateEventEditorState();
    const playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);
    const count = Object.keys(playerDB).length;
    const source = FirebaseService.getPlayerSource(gameplayContext);
    const sourceLabel = source === 'alliance' ? t('player_source_alliance') : t('player_source_personal');
    renderSelectionSourceControls();
    document.getElementById('playerCount').textContent = t('player_count_with_source', { count: count, source: sourceLabel });
    if (count > 0) {
        allPlayers = Object.keys(playerDB).map((name) => normalizePlayerRecordForUi(name, playerDB[name]));
        uploadPanelExpanded = false;
        document.getElementById('uploadContent').classList.add('collapsed');
        document.getElementById('uploadExpandIcon').classList.remove('rotated');
        document.getElementById('uploadHint').textContent = t('upload_hint');
        showSelectionInterface();
    } else {
        allPlayers = [];
        teamSelections.teamA = [];
        teamSelections.teamB = [];
        assignmentsA = [];
        assignmentsB = [];
        substitutesA = [];
        substitutesB = [];
        uploadPanelExpanded = true;
        document.getElementById('uploadContent').classList.remove('collapsed');
        document.getElementById('uploadExpandIcon').classList.add('rotated');
        document.getElementById('uploadHint').textContent = '';
        document.getElementById('selectionSection').classList.remove('hidden');
        renderPlayersTable();
        updateTeamCounters();
        showPlayersManagementPage();
    }
    renderPlayersManagementPanel();
}

function loadPlayerReliabilityStats() {
    if (typeof FirebaseService === 'undefined' || !allPlayers.length) return;
    var gameplayContext = getGameplayContext();
    if (!gameplayContext) return;
    var allianceId = FirebaseService.getAllianceId ? FirebaseService.getAllianceId(gameplayContext) : null;
    if (!allianceId) return; // stats only exist for alliance players
    var utils = window.DSFirestoreUtils;
    var docIds = allPlayers.map(function(p) {
        return utils ? utils.sanitizeDocId(p.name) : p.name;
    });
    FirebaseService.loadPlayerStats(allianceId, docIds).then(function(statsObj) {
        playerStatsMap = new Map();
        allPlayers.forEach(function(p) {
            var docId = utils ? utils.sanitizeDocId(p.name) : p.name;
            if (statsObj[docId]) {
                playerStatsMap.set(p.name, statsObj[docId]);
            }
        });
        renderPlayersTable(); // re-render with stats
    }).catch(function(err) {
        console.warn('loadPlayerReliabilityStats:', err.message || err);
    });
}

function showSelectionInterface() {
    document.getElementById('selectionSection').classList.remove('hidden');
    showGeneratorPage();
    renderSelectionSourceControls();
    renderPlayersTable();
    updateTeamCounters();
    loadPlayerReliabilityStats();
}

function renderSelectionSourceControls() {
    window.DSPlayerDataUpload.renderSelectionSourceControls(_getUploadDeps());
}

function getDefaultBuildings() {
    return window.DSBuildingsConfigManager.getDefaultBuildings(currentEvent);
}

function toggleEventsPanel() {
    eventsPanelExpanded = !eventsPanelExpanded;
    const content = document.getElementById('eventsContent');
    const icon = document.getElementById('eventsExpandIcon');
    if (!content || !icon) {
        return;
    }

    if (eventsPanelExpanded) {
        content.classList.remove('collapsed');
        icon.classList.add('rotated');
    } else {
        content.classList.add('collapsed');
        icon.classList.remove('rotated');
    }
}

function getBuildingConfig() {
    ensureEventRuntimeState(currentEvent);
    if (!buildingConfigs[currentEvent]) {
        buildingConfigs[currentEvent] = getDefaultBuildings();
    }
    return buildingConfigs[currentEvent];
}

function getBuildingDisplayName(internalName) {
    return window.DSBuildingsConfigManager.getBuildingDisplayName(internalName, getBuildingConfig());
}

function isBuildingShownOnMap(internalName) {
    return window.DSBuildingsConfigManager.isBuildingShownOnMap(internalName, getBuildingConfig());
}

function toggleBuildingFieldEdit(buttonEl) {
    window.DSBuildingsConfigManager.toggleBuildingFieldEdit(buttonEl);
}

function setBuildingConfig(config) {
    ensureEventRuntimeState(currentEvent);
    buildingConfigs[currentEvent] = config;
}

function getBuildingPositions() {
    ensureEventRuntimeState(currentEvent);
    return buildingPositionsMap[currentEvent];
}

function setBuildingPositionsLocal(positions) {
    ensureEventRuntimeState(currentEvent);
    buildingPositionsMap[currentEvent] = positions;
}

function clampPriority(value, fallback) {
    return window.DSCoreBuildings.clampPriority(value, fallback);
}

function clampSlots(value, fallback) {
    return window.DSCoreBuildings.clampSlots(value, fallback, MIN_BUILDING_SLOTS, MAX_BUILDING_SLOTS_TOTAL);
}

function getBuildingSlotsTotal(config) {
    return window.DSCoreBuildings.getBuildingSlotsTotal(config);
}

function normalizeBuildingConfig(config, defaultsOverride) {
    const defaults = Array.isArray(defaultsOverride) ? defaultsOverride : getDefaultBuildings();
    return window.DSCoreBuildings.normalizeBuildingConfig(
        config,
        defaults,
        MIN_BUILDING_SLOTS,
        MAX_BUILDING_SLOTS_TOTAL
    );
}

function getEffectiveBuildingPositions() {
    return window.DSBuildingsConfigManager.getEffectiveBuildingPositions(_getBuildingDeps());
}

function getEffectiveBuildingConfig() {
    return window.DSBuildingsConfigManager.getEffectiveBuildingConfig(_getBuildingDeps());
}

function loadBuildingConfig() {
    return window.DSBuildingsConfigManager.loadBuildingConfig(_getBuildingDeps());
}

function loadBuildingPositions() {
    return window.DSBuildingsConfigManager.loadBuildingPositions(_getBuildingDeps());
}

function renderBuildingsTable() {
    window.DSBuildingsConfigManager.renderBuildingsTable(_getBuildingDeps());
}


const buildingsTableBodyEl = document.getElementById('buildingsTableBody');
if (buildingsTableBodyEl) {
    buildingsTableBodyEl.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action="toggle-edit"]');
        if (!btn) return;
        toggleBuildingFieldEdit(btn);
    });
}

function refreshBuildingConfigForAssignments() {
    return window.DSBuildingsConfigManager.refreshBuildingConfigForAssignments(_getBuildingDeps());
}

const _coordState = { coordBuildingIndex: 0, coordBuildings: [], coordCanvasMapHeight: 0, coordMapWarningShown: coordMapWarningShown };

function _getCoordDeps() {
    return Object.assign({}, _getBuildingDeps(), {
        loadBuildingConfig: loadBuildingConfig,
        loadBuildingPositions: loadBuildingPositions,
    });
}

function openCoordinatesPicker() {
    window.DSCoordinatePickerController.openCoordinatesPicker(_coordState, _getCoordDeps());
}

function closeCoordinatesPicker() {
    window.DSCoordinatePickerController.closeCoordinatesPicker(_getCoordDeps());
}

function coordCanvasClick(event) {
    window.DSCoordinatePickerController.coordCanvasClick(event, _coordState, _getCoordDeps());
}

function prevCoordBuilding() {
    window.DSCoordinatePickerController.prevCoordBuilding(_coordState, _getCoordDeps());
}

function nextCoordBuilding() {
    window.DSCoordinatePickerController.nextCoordBuilding(_coordState, _getCoordDeps());
}

async function saveBuildingPositions() {
    return window.DSBuildingsConfigManager.saveBuildingPositions(_getBuildingDeps());
}




function reserveSpaceForFooter() {
    const bar = document.getElementById('floatingButtons');
    const mobileNav = document.getElementById('mobileBottomNav');
    const barVisible = !!bar && bar.style.display !== 'none';
    const mobileNavVisible = !!mobileNav && window.matchMedia('(max-width: 768px)').matches;
    const barHeight = barVisible ? bar.getBoundingClientRect().height : 0;
    const navHeight = mobileNavVisible ? mobileNav.getBoundingClientRect().height : 0;
    const root = document.documentElement;
    if (root) {
        root.style.setProperty('--mobile-nav-runtime-height', `${Math.ceil(navHeight)}px`);
    }
    const safeAreaInset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom')) || 0;
    const totalHeight = barHeight + navHeight;
    document.body.style.paddingBottom = totalHeight > 0 ? `${Math.ceil(totalHeight + 18 + safeAreaInset)}px` : '';
}

window.addEventListener('resize', reserveSpaceForFooter);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', reserveSpaceForFooter);
    window.visualViewport.addEventListener('scroll', reserveSpaceForFooter);
}

// ============================================================
// PLAYER SELECTION INTERFACE
// ============================================================

let currentTroopsFilter = '';
let currentSortFilter = 'power-desc';
const playerRowCache = new Map();
let playerStatsMap = new Map();

function hasActivePlayerFilters() {
    const searchTerm = (document.getElementById('searchFilter')?.value || '').trim();
    return searchTerm.length > 0
        || currentTroopsFilter !== ''
        || currentSortFilter !== 'power-desc';
}

function hasAnySelectedPlayers() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectTeamSelections === 'function'
    ) {
        const selected = window.DSAppStateStore.selectors.selectTeamSelections(getAppRuntimeState());
        const teamASelected = Array.isArray(selected.teamA) ? selected.teamA.length : 0;
        const teamBSelected = Array.isArray(selected.teamB) ? selected.teamB.length : 0;
        return (teamASelected + teamBSelected) > 0;
    }

    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.hasAnySelectedPlayers === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.hasAnySelectedPlayers(teamSelections);
    }
    const teamASelected = Array.isArray(teamSelections?.teamA) ? teamSelections.teamA.length : 0;
    const teamBSelected = Array.isArray(teamSelections?.teamB) ? teamSelections.teamB.length : 0;
    return (teamASelected + teamBSelected) > 0;
}

function updateClearAllButtonVisibility() {
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (!clearAllBtn) {
        return;
    }
    clearAllBtn.hidden = !(hasActivePlayerFilters() || hasAnySelectedPlayers());
}

function getCurrentTeamCounts() {
    if (
        window.DSAppStateStore
        && window.DSAppStateStore.selectors
        && typeof window.DSAppStateStore.selectors.selectTeamCounts === 'function'
    ) {
        syncGeneratorTeamSelectionsState();
        return window.DSAppStateStore.selectors.selectTeamCounts(getAppRuntimeState());
    }

    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.getCurrentTeamCounts === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.getCurrentTeamCounts(teamSelections);
    }
    return {
        teamAStarterCount: getStarterCount('teamA'),
        teamASubCount: getSubstituteCount('teamA'),
        teamBStarterCount: getStarterCount('teamB'),
        teamBSubCount: getSubstituteCount('teamB'),
    };
}

function buildTeamSelectionMaps() {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.buildTeamSelectionMaps === 'function'
    ) {
        return window.DSFeatureGeneratorTeamSelection.buildTeamSelectionMaps(teamSelections);
    }
    return {
        teamA: new Map(teamSelections.teamA.map((item) => [item.name, item])),
        teamB: new Map(teamSelections.teamB.map((item) => [item.name, item])),
    };
}

function refreshVisiblePlayerRows() {
    if (!(window.DSPlayerTableUI && typeof window.DSPlayerTableUI.refreshVisiblePlayerRows === 'function')) {
        return;
    }

    const tbody = document.getElementById('playersTableBody');
    window.DSPlayerTableUI.refreshVisiblePlayerRows({
        tbody: tbody,
        allPlayers: allPlayers,
        counts: getCurrentTeamCounts(),
        selectionMaps: buildTeamSelectionMaps(),
        translate: t,
    });
}

function renderPlayersTable() {
    if (!(window.DSPlayerTableUI && typeof window.DSPlayerTableUI.renderPlayersTable === 'function')) {
        return;
    }

    const tbody = document.getElementById('playersTableBody');
    const searchTerm = (document.getElementById('searchFilter').value || '').toLowerCase();
    if (allPlayers.length === 0) {
        if (typeof window.DSPlayerTableUI.renderEmptyState === 'function') {
            window.DSPlayerTableUI.renderEmptyState(tbody, t);
        }
        updateClearAllButtonVisibility();
        return;
    }

    window.DSPlayerTableUI.renderPlayersTable({
        tbody: tbody,
        allPlayers: allPlayers,
        rowCache: playerRowCache,
        getTroopLabel: getTroopLabel,
        counts: getCurrentTeamCounts(),
        selectionMaps: buildTeamSelectionMaps(),
        searchTerm: searchTerm,
        troopsFilter: currentTroopsFilter,
        sortFilter: currentSortFilter,
        translate: t,
        playerStatsMap: playerStatsMap,
    });
    updateClearAllButtonVisibility();
}

function toggleTeam(playerName, team) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.toggleTeamSelection === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.toggleTeamSelection(teamSelections, playerName, team, {
            maxTotal: 30,
            maxStarters: 20,
            maxSubstitutes: 10,
        });
        if (!result || !result.changed) {
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        const teamKey = team === 'A' ? 'teamA' : 'teamB';
        const otherTeamKey = team === 'A' ? 'teamB' : 'teamA';

        const existingIndex = teamSelections[teamKey].findIndex(p => p.name === playerName);

        if (existingIndex > -1) {
            // Player is already on this team - remove them
            teamSelections[teamKey].splice(existingIndex, 1);
        } else {
            // Remove from other team if present
            const otherIndex = teamSelections[otherTeamKey].findIndex(p => p.name === playerName);
            if (otherIndex > -1) {
                teamSelections[otherTeamKey].splice(otherIndex, 1);
            }

            // Check total limit (30 players)
            if (teamSelections[teamKey].length >= 30) {
                return;
            }

            // Determine default role: starter if < 20 starters, otherwise substitute
            const starterCount = getStarterCount(teamKey);
            const subCount = getSubstituteCount(teamKey);

            let defaultRole;
            if (starterCount < 20) {
                defaultRole = 'starter';
            } else if (subCount < 10) {
                defaultRole = 'substitute';
            } else {
                // Both full - shouldn't happen if UI disables correctly
                return;
            }

            teamSelections[teamKey].push({
                name: playerName,
                role: defaultRole
            });
        }
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function cycleTeam(playerName, team) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.cycleTeamSelection === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.cycleTeamSelection(teamSelections, playerName, team, {
            maxTotal: 30,
            maxStarters: 20,
            maxSubstitutes: 10,
        });
        if (!result || !result.changed) {
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        // Fallback to legacy toggle when cycleTeamSelection is not available
        toggleTeam(playerName, team);
        return;
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function togglePlayerRole(playerName, newRole) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.setPlayerRole === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.setPlayerRole(teamSelections, playerName, newRole, {
            maxStarters: 20,
            maxSubstitutes: 10,
        });
        if (!result || !result.changed) {
            if (result && result.reason === 'starters_full') {
                alert(t('alert_starters_full'));
            } else if (result && result.reason === 'substitutes_full') {
                alert(t('alert_subs_full'));
            }
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        // Find which team the player is on
        let teamKey = null;
        let playerIndex = teamSelections.teamA.findIndex(p => p.name === playerName);

        if (playerIndex > -1) {
            teamKey = 'teamA';
        } else {
            playerIndex = teamSelections.teamB.findIndex(p => p.name === playerName);
            if (playerIndex > -1) {
                teamKey = 'teamB';
            }
        }

        if (!teamKey || playerIndex === -1) return;

        const currentRole = teamSelections[teamKey][playerIndex].role;
        if (currentRole === newRole) return; // No change needed

        // Check if switching is allowed
        if (newRole === 'starter') {
            if (getStarterCount(teamKey) >= 20) {
                alert(t('alert_starters_full'));
                return;
            }
        } else {
            if (getSubstituteCount(teamKey) >= 10) {
                alert(t('alert_subs_full'));
                return;
            }
        }

        // Update role
        teamSelections[teamKey][playerIndex].role = newRole;
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function clearPlayerSelection(playerName) {
    if (
        window.DSFeatureGeneratorTeamSelection
        && typeof window.DSFeatureGeneratorTeamSelection.clearPlayerSelection === 'function'
    ) {
        const result = window.DSFeatureGeneratorTeamSelection.clearPlayerSelection(teamSelections, playerName);
        if (!result || !result.changed) {
            return;
        }
        teamSelections.teamA = Array.isArray(result.teamA) ? result.teamA : [];
        teamSelections.teamB = Array.isArray(result.teamB) ? result.teamB : [];
    } else {
        const aIndex = teamSelections.teamA.findIndex(p => p.name === playerName);
        if (aIndex > -1) teamSelections.teamA.splice(aIndex, 1);

        const bIndex = teamSelections.teamB.findIndex(p => p.name === playerName);
        if (bIndex > -1) teamSelections.teamB.splice(bIndex, 1);
    }

    updateTeamCounters();
    refreshVisiblePlayerRows();
}

function clearAllSelections() {
    if (confirm(t('confirm_clear_all'))) {
        resetTransientPlanningState({ renderPlayersTable: true });
    }
}

function filterPlayers() {
    renderPlayersTable();
    updateClearAllButtonVisibility();
}

// Filter dropdown toggle & selection
(function() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    dropdowns.forEach(wrapper => {
        const btn = wrapper.querySelector('.filter-icon-btn');
        const panel = wrapper.querySelector('.filter-dropdown-panel');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(other => {
                if (other !== wrapper) other.querySelector('.filter-dropdown-panel').classList.remove('open');
            });
            panel.classList.toggle('open');
        });
    });
    document.querySelectorAll('.filter-option').forEach(option => {
        option.addEventListener('click', () => {
            const panel = option.closest('.filter-dropdown-panel');
            const wrapper = panel.closest('.filter-dropdown');
            const btn = wrapper.querySelector('.filter-icon-btn');
            const value = option.dataset.value;

            if (wrapper.id === 'troopsFilterWrapper') {
                currentTroopsFilter = value;
                btn.classList.toggle('active', value !== '');
            } else {
                currentSortFilter = value;
            }

            panel.querySelectorAll('.filter-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            panel.classList.remove('open');
            filterPlayers();
        });
    });
    document.addEventListener('click', () => {
        dropdowns.forEach(wrapper => {
            wrapper.querySelector('.filter-dropdown-panel').classList.remove('open');
        });
    });
})();

// Delegated listener for team A / team B / clear buttons in player rows
document.getElementById('playersTableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const name = btn.closest('tr')?.dataset.player;
    if (!name) return;
    const controller = getGeneratorFeatureController();
    if (btn.classList.contains('team-a-btn')) {
        cycleTeam(name, 'A');
    }
    else if (btn.classList.contains('team-b-btn')) {
        cycleTeam(name, 'B');
    }
    else if (btn.classList.contains('clear-btn')) {
        if (controller && typeof controller.clearPlayerSelection === 'function') {
            controller.clearPlayerSelection(name);
        } else {
            clearPlayerSelection(name);
        }
    }
    else if (btn.classList.contains('role-btn')) {
        const newRole = btn.dataset.role;
        if (newRole) {
            if (controller && typeof controller.setPlayerRole === 'function') {
                controller.setPlayerRole(name, newRole);
            } else {
                togglePlayerRole(name, newRole);
            }
        }
    }
});

const playersMgmtTableBody = document.getElementById('playersMgmtTableBody');
if (playersMgmtTableBody) {
    playersMgmtTableBody.addEventListener('click', (event) => {
        const controller = getPlayersManagementFeatureController();
        if (controller && typeof controller.handleTableAction === 'function') {
            controller.handleTableAction(event);
            return;
        }
        handlePlayersManagementTableAction(event);
    });
}

function updateTeamCounters() {
    syncGeneratorTeamSelectionsState();

    const teamAStarterCount = getStarterCount('teamA');
    const teamASubCount = getSubstituteCount('teamA');
    const teamBStarterCount = getStarterCount('teamB');
    const teamBSubCount = getSubstituteCount('teamB');

    // Update counter displays
    document.getElementById('teamAStarterCount').textContent = teamAStarterCount;
    document.getElementById('teamASubCount').textContent = teamASubCount;
    document.getElementById('teamBStarterCount').textContent = teamBStarterCount;
    document.getElementById('teamBSubCount').textContent = teamBSubCount;

    // Update floating button counts
    document.getElementById('teamAFloatStarterCount').textContent = teamAStarterCount;
    document.getElementById('teamAFloatSubCount').textContent = teamASubCount;
    document.getElementById('teamBFloatStarterCount').textContent = teamBStarterCount;
    document.getElementById('teamBFloatSubCount').textContent = teamBSubCount;

    const teamACounter = document.querySelector('.counter.team-a');
    const teamBCounter = document.querySelector('.counter.team-b');
    const generateBtnA = document.getElementById('generateBtnA');
    const generateBtnB = document.getElementById('generateBtnB');

    // Team A "full" state: starters at 20
    if (teamAStarterCount === 20) {
        teamACounter.classList.add('full');
    } else {
        teamACounter.classList.remove('full');
    }

    // Enable generate button if at least 1 starter
    generateBtnA.disabled = teamAStarterCount === 0;

    // Team B handling
    if (teamBStarterCount === 20) {
        teamBCounter.classList.add('full');
    } else {
        teamBCounter.classList.remove('full');
    }

    generateBtnB.disabled = teamBStarterCount === 0;

    // Sync mobile generate buttons
    var mobileGenBtnA = document.getElementById('mobileGenBtnA');
    var mobileGenBtnB = document.getElementById('mobileGenBtnB');
    var mobileGenCountA = document.getElementById('mobileGenCountA');
    var mobileGenCountB = document.getElementById('mobileGenCountB');
    if (mobileGenBtnA) { mobileGenBtnA.disabled = teamAStarterCount === 0; }
    if (mobileGenBtnB) { mobileGenBtnB.disabled = teamBStarterCount === 0; }
    if (mobileGenCountA) { mobileGenCountA.textContent = teamAStarterCount + '/20'; }
    if (mobileGenCountB) { mobileGenCountB.textContent = teamBStarterCount + '/20'; }
    var mobileGenSubCountA = document.getElementById('mobileGenSubCountA');
    var mobileGenSubCountB = document.getElementById('mobileGenSubCountB');
    if (mobileGenSubCountA) { mobileGenSubCountA.textContent = teamASubCount + '/10'; }
    if (mobileGenSubCountB) { mobileGenSubCountB.textContent = teamBSubCount + '/10'; }

    updateClearAllButtonVisibility();
}

// ============================================================
// ASSIGNMENT GENERATION
// ============================================================

function resolveCurrentEventAssignmentSelection(activeGameId) {
    const gameId = normalizeGameId(activeGameId);
    const activeEvent = getActiveEvent();
    const requestedAlgorithmId = normalizeAssignmentAlgorithmId(activeEvent && activeEvent.assignmentAlgorithmId);
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.resolveAlgorithmSelection === 'function') {
        return window.DSAssignmentRegistry.resolveAlgorithmSelection(gameId, requestedAlgorithmId);
    }
    if (window.DSAssignmentRegistry && typeof window.DSAssignmentRegistry.resolveAlgorithmForEvent === 'function') {
        const algorithm = window.DSAssignmentRegistry.resolveAlgorithmForEvent(gameId, requestedAlgorithmId);
        if (!algorithm) {
            return {
                success: false,
                error: 'unknown-assignment-algorithm',
                algorithmId: requestedAlgorithmId || '',
                gameId: gameId,
            };
        }
        return {
            success: true,
            algorithmId: normalizeAssignmentAlgorithmId(algorithm.id) || resolveDefaultAssignmentAlgorithmId(gameId),
            gameId: gameId,
            algorithm: algorithm,
        };
    }
    return {
        success: true,
        algorithmId: resolveDefaultAssignmentAlgorithmId(gameId),
        gameId: gameId,
        algorithm: {
            id: resolveDefaultAssignmentAlgorithmId(gameId),
            name: 'Balanced Round Robin',
        },
    };
}

function generateTeamAssignments(team) {
    const activeGameId = enforceGameplayContext();
    if (!activeGameId) {
        alert(t('game_selector_invalid'));
        return;
    }
    if (typeof FirebaseService === 'undefined') {
        alert(t('error_firebase_not_loaded'));
        return;
    }

    const buildingConfigOk = refreshBuildingConfigForAssignments();
    if (!buildingConfigOk) {
        alert(t('alert_total_slots_exceed', { max: MAX_BUILDING_SLOTS_TOTAL }));
        return;
    }

    const selections = team === 'A' ? teamSelections.teamA : teamSelections.teamB;
    const starters = selections.filter(p => p.role === 'starter');
    const substitutes = selections.filter(p => p.role === 'substitute');

    if (starters.length === 0) {
        alert(t('alert_select_at_least_one_starter', { team: team }));
        return;
    }

    if (starters.length > 20) {
        alert(t('alert_max_starters', { count: starters.length }));
        return;
    }

    const gameplayContext = getGameplayContext();
    if (!gameplayContext) {
        return;
    }
    const playerDB = FirebaseService.getActivePlayerDatabase(gameplayContext);

    const assignmentCore = window.DSCoreGeneratorAssignment;
    const prepared = assignmentCore && typeof assignmentCore.preparePlayersForAssignment === 'function'
        ? assignmentCore.preparePlayersForAssignment(selections, playerDB)
        : {
            starters: starters
                .map((selection) => ({
                    name: selection.name,
                    power: Number(playerDB[selection.name] && playerDB[selection.name].power) || 0,
                    troops: playerDB[selection.name] && playerDB[selection.name].troops,
                    thp: Number(playerDB[selection.name] && playerDB[selection.name].thp) || 0,
                }))
                .sort((a, b) => Number(b.power || 0) - Number(a.power || 0)),
            substitutes: substitutes
                .map((selection) => ({
                    name: selection.name,
                    power: Number(playerDB[selection.name] && playerDB[selection.name].power) || 0,
                    troops: playerDB[selection.name] && playerDB[selection.name].troops,
                    thp: Number(playerDB[selection.name] && playerDB[selection.name].thp) || 0,
                }))
                .sort((a, b) => Number(b.power || 0) - Number(a.power || 0)),
        };
    const starterPlayers = prepared.starters;
    const substitutePlayers = attachSubstituteCoverage(starterPlayers, prepared.substitutes);

    const algorithmSelection = resolveCurrentEventAssignmentSelection(activeGameId);
    if (!algorithmSelection || !algorithmSelection.success) {
        const errorCode = algorithmSelection && algorithmSelection.error ? algorithmSelection.error : 'unknown-assignment-algorithm';
        const algorithmId = algorithmSelection && algorithmSelection.algorithmId ? algorithmSelection.algorithmId : '';
        const statusMessage = t('assignment_algorithm_unknown', { id: algorithmId || 'unknown' });
        showMessage('eventsStatus', statusMessage, 'error');
        console.error('Assignment generation failed:', {
            error: errorCode,
            algorithmId: algorithmId,
            gameId: activeGameId,
            eventId: currentEvent,
        });
        alert(errorCode);
        return;
    }

    let assignments = [];
    try {
        assignments = assignTeamToBuildings(starterPlayers, algorithmSelection.algorithm);
    } catch (error) {
        const errorCode = error && error.code ? error.code : 'unknown-assignment-algorithm';
        showMessage('eventsStatus', t('assignment_algorithm_unknown', {
            id: (error && error.algorithmId) || algorithmSelection.algorithmId || 'unknown',
        }), 'error');
        console.error('Assignment execution failed:', error);
        alert(errorCode);
        return;
    }

    // Store both assignments and substitutes
    if (team === 'A') {
        assignmentsA = assignments;
        substitutesA = substitutePlayers;
    } else {
        assignmentsB = assignments;
        substitutesB = substitutePlayers;
    }

    // Auto-save to event history (fire-and-forget, non-blocking)
    if (window._eventHistoryController && typeof window._eventHistoryController.autoSave === 'function') {
        window._eventHistoryController.autoSave(team, assignments, substitutePlayers, {
            eventTypeId: currentEvent,
            eventDisplayName: getEventDisplayName(currentEvent),
            gameId: activeGameId,
            playerSource: FirebaseService.getPlayerSource(gameplayContext),
        }).catch(function(err) {
            console.error('Event history auto-save failed (non-blocking):', err);
        });
    }

    openDownloadModal(team);

    console.log(`Team ${team} assignments generated for ${starters.length} starters, ${substitutes.length} substitutes using ${algorithmSelection.algorithmId}`);
}

function attachSubstituteCoverage(starters, substitutes) {
    const assignmentCore = window.DSCoreGeneratorAssignment;
    if (assignmentCore && typeof assignmentCore.assignSubstitutesToStarters === 'function') {
        return assignmentCore.assignSubstitutesToStarters(starters, substitutes);
    }

    const orderedSubs = Array.isArray(substitutes)
        ? substitutes.map((substitute) => ({
            name: substitute.name,
            power: Number(substitute.power) || 0,
            troops: substitute.troops,
            thp: Number(substitute.thp) || 0,
            replacementStarters: [],
            replacementStarterNames: [],
            replacementStarterSummary: '',
        }))
        : [];

    (Array.isArray(starters) ? starters : []).forEach((starter, starterIndex) => {
        const substituteIndex = Math.floor(starterIndex / 2);
        if (!orderedSubs[substituteIndex]) {
            return;
        }
        orderedSubs[substituteIndex].replacementStarters.push({
            name: starter.name,
            power: Number(starter.power) || 0,
            troops: starter.troops,
            thp: Number(starter.thp) || 0,
        });
    });

    orderedSubs.forEach((substitute) => {
        substitute.replacementStarterNames = substitute.replacementStarters.map((starter) => starter.name);
        substitute.replacementStarterSummary = substitute.replacementStarterNames.join(', ');
    });

    return orderedSubs.sort((a, b) => {
        const powerDiff = (Number(b.power) || 0) - (Number(a.power) || 0);
        if (powerDiff !== 0) {
            return powerDiff;
        }
        const thpDiff = (Number(b.thp) || 0) - (Number(a.thp) || 0);
        if (thpDiff !== 0) {
            return thpDiff;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function assignTeamToBuildings(players, algorithm) {
    const algorithmId = normalizeAssignmentAlgorithmId(algorithm && algorithm.id) || DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    if (algorithmId === 'balanced_round_robin') {
        return window.DSCoreAssignment.assignTeamToBuildings(players, getEffectiveBuildingConfig());
    }
    throw Object.assign(new Error('unknown-assignment-algorithm'), {
        code: 'unknown-assignment-algorithm',
        algorithmId: algorithmId,
    });
}
// ============================================================
// DOWNLOAD MODAL (delegated to DSDownloadController)
// ============================================================

function _getDownloadDeps() {
    return {
        t: t,
        showMessage: showMessage,
        openModalOverlay: openModalOverlay,
        closeModalOverlay: closeModalOverlay,
        ensureXLSXLoaded: ensureXLSXLoaded,
        getActiveEvent: getActiveEvent,
        getEventDisplayName: getEventDisplayName,
        getEventMapFile: getEventMapFile,
        getMapRuntimeState: getMapRuntimeState,
        loadMapImage: loadMapImage,
        isImageDataUrl: isImageDataUrl,
        getEffectiveBuildingPositions: getEffectiveBuildingPositions,
        isBuildingShownOnMap: isBuildingShownOnMap,
        getBuildingConfig: getBuildingConfig,
        getBuildingDisplayName: getBuildingDisplayName,
        getGameplayContext: getGameplayContext,
        getCurrentEvent: function () { return currentEvent; },
        getAssignmentsA: function () { return assignmentsA; },
        getAssignmentsB: function () { return assignmentsB; },
        getSubstitutesA: function () { return substitutesA; },
        getSubstitutesB: function () { return substitutesB; },
        setActiveDownloadTeam: function (v) { activeDownloadTeam = v; },
        MAP_EXPORT: MAP_EXPORT,
        MAP_CANVAS_WIDTH: MAP_CANVAS_WIDTH,
        EVENT_LOGO_DATA_URL_LIMIT: EVENT_LOGO_DATA_URL_LIMIT,
    };
}

function openDownloadModal(team) {
    if (!window.DSDownloadController) return;
    window.DSDownloadController.openDownloadModal(team, _getDownloadDeps());
}

function closeDownloadModal() {
    if (!window.DSDownloadController) return;
    window.DSDownloadController.closeDownloadModal(_getDownloadDeps());
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) {
        return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = `message ${type}`;
    wrapper.textContent = String(message ?? '');
    element.replaceChildren(wrapper);
    
    if (type === 'success') {
        setTimeout(() => {
            element.replaceChildren();
        }, 5000);
    }
}

document.addEventListener('click', (event) => {
    const navMenu = document.getElementById('navMenu');
    if (navMenu && !navMenu.contains(event.target)) {
        closeNavigationMenu();
    }
    const notificationsPanel = document.getElementById('notificationsPanel');
    const notificationBtn = document.getElementById('notificationBtn');
    if (
        notificationsPanel &&
        notificationBtn &&
        !notificationsPanel.classList.contains('hidden') &&
        !notificationsPanel.contains(event.target) &&
        !notificationBtn.contains(event.target)
    ) {
        closeNotificationsPanel();
    }
});



