/**
 * FIREBASE MODULE FOR DESERT STORM & CANYON BATTLEFIELD
 * =====================================================
 * 
 * This module handles all Firebase functionality:
 * - Authentication (Google + Email/Password)
 * - Firestore database operations
 * - Player database management
 * - Backup/restore functionality
 * 
 * USAGE:
 * 1. Include Firebase SDKs in your HTML
 * 2. Include this file
 * 3. Call FirebaseManager.init()
 * 4. Use provided functions
 */

const FirebaseManager = (function() {

    // Capture module references at load time (survives test cleanup of global)
    var DSFirebaseInfra = (typeof window !== 'undefined' && window.DSFirebaseInfra) || (typeof global !== 'undefined' && global.DSFirebaseInfra);
    var DSFirebaseAuth = (typeof window !== 'undefined' && window.DSFirebaseAuth) || (typeof global !== 'undefined' && global.DSFirebaseAuth);

    // Firebase configuration - loaded from firebase-config.js
    // DO NOT hardcode your API key here - use firebase-config.js instead
    let firebaseConfig = null;
    
    // Check if config is loaded from firebase-config.js (global const or window property)
    if (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) {
        firebaseConfig = FIREBASE_CONFIG;
        console.log('✅ Firebase config loaded from firebase-config.js');
    } else if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
        firebaseConfig = window.FIREBASE_CONFIG;
        console.log('✅ Firebase config loaded from window.FIREBASE_CONFIG');
    } else {
        console.error('❌ Firebase config not found!');
        console.error('Please create firebase-config.js with your Firebase credentials');
        console.error('For GitHub Pages, ensure FIREBASE_CONFIG_JS secret is configured.');
    }
    
    function createEmptyEventEntry(overrides) {
        const source = overrides && typeof overrides === 'object' ? overrides : {};
        return {
            name: typeof source.name === 'string' ? source.name : '',
            logoDataUrl: typeof source.logoDataUrl === 'string' ? source.logoDataUrl : '',
            mapDataUrl: typeof source.mapDataUrl === 'string' ? source.mapDataUrl : '',
            assignmentAlgorithmId: typeof source.assignmentAlgorithmId === 'string'
                ? source.assignmentAlgorithmId
                : DEFAULT_ASSIGNMENT_ALGORITHM_ID,
            buildingConfig: null,
            buildingConfigVersion: 0,
            buildingPositions: null,
            buildingPositionsVersion: 0,
        };
    }

    function createEmptyEventData() {
        return {};
    }

    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    const MAX_PLAYER_DATABASE_SIZE = 100;
    const PLAYER_POWER_HEADER = '1st Team Power (M)';
    const LEGACY_PLAYER_POWER_HEADERS = ['E1 Total Power(M)', 'E1 Power (M)'];
    const MAX_PROFILE_TEXT_LEN = 60;
    const MAX_AVATAR_DATA_URL_LEN = 400000;
    const USER_PROFILE_THEMES = new Set(['standard', 'last-war', 'light', 'system']);
    const INVITE_MAX_RESENDS = 3;
    const INVITE_REMINDER_DAY1_MS = 24 * 60 * 60 * 1000;
    const INVITE_REMINDER_DAY3_MS = 3 * INVITE_REMINDER_DAY1_MS;
    const LEGACY_EVENT_IDS = [
    "canyon_battlefield",
    "desert_storm"
];
    const LEGACY_EVENT_NAME_DEFAULTS = {
    "canyon_battlefield": "Canyon Storm",
    "desert_storm": "Desert Storm"
};
    const LEGACY_EVENT_BUILDING_DEFAULTS = {
    "canyon_battlefield": [
        {
            "name": "Bomb Squad",
            "priority": 5,
            "slots": 3,
            "label": "Bomb Squad",
            "showOnMap": false
        },
        {
            "name": "Data Center 1",
            "priority": 4,
            "slots": 1,
            "label": "Data Center 1",
            "showOnMap": true
        },
        {
            "name": "Data Center 2",
            "priority": 4,
            "slots": 1,
            "label": "Data Center 2",
            "showOnMap": true
        },
        {
            "name": "Power Plant",
            "priority": 2,
            "slots": 3,
            "label": "Power Plant",
            "showOnMap": true
        },
        {
            "name": "Virus Lab",
            "priority": 1,
            "slots": 4,
            "label": "Virus Lab",
            "showOnMap": true
        },
        {
            "name": "East Serum Factory",
            "priority": 3,
            "slots": 1,
            "label": "East Serum Factory",
            "showOnMap": true
        },
        {
            "name": "West Serum Factory",
            "priority": 3,
            "slots": 1,
            "label": "West Serum Factory",
            "showOnMap": true
        },
        {
            "name": "East Defense System",
            "priority": 3,
            "slots": 1,
            "label": "East Defense System",
            "showOnMap": true
        },
        {
            "name": "West Defense System",
            "priority": 3,
            "slots": 1,
            "label": "West Defense System",
            "showOnMap": true
        },
        {
            "name": "Sample Warehouse 1",
            "priority": 6,
            "slots": 1,
            "label": "Sample Warehouse 1",
            "showOnMap": true
        },
        {
            "name": "Sample Warehouse 2",
            "priority": 6,
            "slots": 1,
            "label": "Sample Warehouse 2",
            "showOnMap": true
        },
        {
            "name": "Sample Warehouse 3",
            "priority": 6,
            "slots": 1,
            "label": "Sample Warehouse 3",
            "showOnMap": true
        },
        {
            "name": "Sample Warehouse 4",
            "priority": 6,
            "slots": 1,
            "label": "Sample Warehouse 4",
            "showOnMap": true
        }
    ],
    "desert_storm": [
        {
            "name": "Bomb Squad",
            "priority": 1,
            "slots": 4,
            "label": "Bomb Squad",
            "showOnMap": false
        },
        {
            "name": "Oil Refinery 1",
            "priority": 3,
            "slots": 2,
            "label": "Oil Refinery 1",
            "showOnMap": true
        },
        {
            "name": "Oil Refinery 2",
            "priority": 3,
            "slots": 2,
            "label": "Oil Refinery 2",
            "showOnMap": true
        },
        {
            "name": "Field Hospital 1",
            "priority": 4,
            "slots": 2,
            "label": "Field Hospital 1",
            "showOnMap": true
        },
        {
            "name": "Field Hospital 2",
            "priority": 4,
            "slots": 2,
            "label": "Field Hospital 2",
            "showOnMap": true
        },
        {
            "name": "Field Hospital 3",
            "priority": 4,
            "slots": 2,
            "label": "Field Hospital 3",
            "showOnMap": true
        },
        {
            "name": "Field Hospital 4",
            "priority": 4,
            "slots": 2,
            "label": "Field Hospital 4",
            "showOnMap": true
        },
        {
            "name": "Info Center",
            "priority": 5,
            "slots": 2,
            "label": "Info Center",
            "showOnMap": true
        },
        {
            "name": "Science Hub",
            "priority": 5,
            "slots": 2,
            "label": "Science Hub",
            "showOnMap": true
        }
    ]
};
    const LEGACY_EVENT_MEDIA_DEFAULTS = {
    "canyon_battlefield": {
        "logoDataUrl": "data:image/jpeg;base64,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",
        "mapDataUrl": "data:image/jpeg;base64,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"
    },
    "desert_storm": {
        "logoDataUrl": "data:image/jpeg;base64,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",
        "mapDataUrl": "data:image/jpeg;base64,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"
    }
};
    const LEGACY_EVENT_POSITIONS_DEFAULTS = {
    "canyon_battlefield": {
        "Virus Lab": [
            670,
            786
        ],
        "Power Plant": [
            640,
            415
        ],
        "East Defense System": [
            13,
            934
        ],
        "West Defense System": [
            851,
            557
        ],
        "Data Center 2": [
            627,
            235
        ],
        "Data Center 1": [
            250,
            237
        ],
        "West Serum Factory": [
            861,
            908
        ],
        "East Serum Factory": [
            21,
            559
        ],
        "Sample Warehouse 2": [
            297,
            1137
        ],
        "Sample Warehouse 1": [
            5,
            1136
        ],
        "Sample Warehouse 4": [
            822,
            1144
        ],
        "Sample Warehouse 3": [
            561,
            1145
        ]
    },
    "desert_storm": {
        "Bomb Squad": [
            1040,
            1376
        ],
        "undefined": [
            1581,
            1156
        ],
        "Field Hospital 4": [
            757,
            45
        ],
        "Field Hospital 1": [
            25,
            464
        ],
        "Field Hospital 3": [
            243,
            653
        ],
        "Science Hub": [
            695,
            665
        ],
        "Field Hospital 2": [
            872,
            328
        ],
        "Oil Refinery 2": [
            868,
            543
        ],
        "Oil Refinery 1": [
            14,
            238
        ],
        "Info Center": [
            196,
            47
        ]
    }
};
    const GLOBAL_COORD_OWNER_EMAIL = 'constantinescu.cristian@gmail.com';
    const GLOBAL_COORDS_COLLECTION = 'app_config';
    const GLOBAL_COORDS_DOC_ID = 'default_event_positions';
    const GLOBAL_BUILDING_CONFIG_DOC_ID = 'default_event_building_config';
    const GAME_METADATA_OVERRIDES_DOC_ID = 'game_metadata_overrides';
    const EVENT_NAME_MAX_LEN = 30;
    const MAX_EVENT_LOGO_DATA_URL_LEN = 300000;
    const MAX_EVENT_MAP_DATA_URL_LEN = 950000;
    const DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';
    const EVENT_MEDIA_SUBCOLLECTION = 'event_media';
    const GAMES_COLLECTION = 'games';
    const USER_GAMES_SUBCOLLECTION = 'games';
    const GAME_ALLIANCES_SUBCOLLECTION = 'alliances';
    const GAME_INVITATIONS_SUBCOLLECTION = 'invitations';
    const GAME_PLAYERS_SUBCOLLECTION = 'players';
    const GAME_EVENTS_SUBCOLLECTION = 'events';
    const GAME_METADATA_CACHE_TTL_MS = 30000;
    const DEFAULT_GAME_ID = 'last_war';
    const ACTIVE_GAME_STORAGE_KEY = 'ds_active_game_id';
    const GAME_SUBCOLLECTION_MIGRATION_VERSION = 1;
    const GAME_USER_STATE_SUBCOLLECTION = 'user_state';
    const GAME_SOLOPLAYERS_SUBCOLLECTION = 'soloplayers';
    const GAME_SOLOPLAYER_PLAYERS_SUBCOLLECTION = 'players';
    const GAME_ALLIANCE_PLAYERS_SUBCOLLECTION = 'alliance_players';
    const GAME_EVENT_HISTORY_SUBCOLLECTION = 'event_history';
    const GAME_CENTRIC_MIGRATION_VERSION = 2;
    const DEFAULT_PLAYER_IMPORT_SCHEMA = Object.freeze({
        id: 'last_war_players_v1',
        templateFileName: 'player_database_template.xlsx',
        sheetName: 'Players',
        headerRowIndex: 9,
        columns: Object.freeze([
            Object.freeze({ key: 'name', header: 'Player Name', required: true }),
            Object.freeze({ key: 'power', header: 'E1 Total Power(M)', required: true }),
            Object.freeze({ key: 'troops', header: 'E1 Troops', required: true }),
        ]),
    });
    const GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
    const MULTIGAME_FLAG_DEFAULTS = Object.freeze({
        MULTIGAME_ENABLED: false,
        MULTIGAME_READ_FALLBACK_ENABLED: false,
        MULTIGAME_DUAL_WRITE_ENABLED: false,
        MULTIGAME_GAME_SELECTOR_ENABLED: false,
        MULTIGAME_STRICT_MODE: false,
    });
    const MULTIGAME_FLAG_KEYS = Object.keys(MULTIGAME_FLAG_DEFAULTS);

    // Private variables
    let auth = null;
    let db = null;
    let currentUser = null;
    let playerDatabase = {};
    // Per-event building data: { [eventId]: { name, logoDataUrl, mapDataUrl, buildingConfig, buildingConfigVersion, buildingPositions, buildingPositionsVersion } }
    let eventData = createEmptyEventData();
    let allianceId = null;
    let allianceName = null;
    let allianceData = null;
    let playerSource = 'personal';
    let pendingInvitations = [];
    let sentInvitations = [];
    let invitationNotifications = [];
    let userProfile = { displayName: '', nickname: '', avatarDataUrl: '' };
    let activeGameplayGameId = DEFAULT_GAME_ID;
    let activeAllianceGameId = DEFAULT_GAME_ID;
    let activeAllianceDocScope = 'game';
    let onAuthCallback = null;
    let onDataLoadCallback = null;
    let onAllianceDataCallback = null;
    const SAVE_DEBOUNCE_MS = 1500;
    let lastSavedUserState = null;
    let saveDebounceTimer = null;
    let pendingSavePromise = null;
    let pendingSaveResolve = null;
    let pendingSaveContext = null;
    let saveLifecycleHandlersBound = false;
    let allianceDocUnsubscribe = null;
    let activeUserDataLoadRequestId = 0;
    let activeAllianceLoadRequestId = 0;
    let activeInvitationLoadRequestId = 0;

    let globalDefaultEventPositions = {};
    let globalDefaultPositionsVersion = 0;
    let globalDefaultEventBuildingConfig = {};
    let globalDefaultBuildingConfigVersion = 0;
    let gameMetadataCache = { expiresAt: 0, entries: null };
    let migrationVersion = 0;
    let migratedToGameSubcollectionsAt = null;
    // observabilityCounters moved to DSFirebaseInfra

    function normalizeFeatureFlagValue(value, fallbackValue) { return DSFirebaseInfra.normalizeFeatureFlagValue(value, fallbackValue); }

    function readRuntimeFeatureFlagOverrides() { return DSFirebaseInfra.readRuntimeFeatureFlagOverrides(); }
    function resolveFeatureFlags(overrides) { return DSFirebaseInfra.resolveFeatureFlags(overrides); }
    function isFeatureFlagEnabled(flagName, overrides) { return DSFirebaseInfra.isFeatureFlagEnabled(flagName, overrides); }
    function isStrictModeEnabled(overrides) { return DSFirebaseInfra.isStrictModeEnabled(overrides); }
    function isLegacyFallbackAllowed(overrides) { return DSFirebaseInfra.isLegacyFallbackAllowed(overrides); }
    function createStrictModeError(message, details) { return DSFirebaseInfra.createStrictModeError(message, details); }

    function emptyGlobalEventPositions(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = {};
        LEGACY_EVENT_IDS.forEach((eventId) => {
            normalized[eventId] = {};
        });
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            if (!normalized[eid]) {
                normalized[eid] = {};
            }
        });
        return normalized;
    }

    function emptyGlobalBuildingConfig(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = {};
        LEGACY_EVENT_IDS.forEach((eventId) => {
            normalized[eventId] = null;
        });
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(normalized, eid)) {
                normalized[eid] = null;
            }
        });
        return normalized;
    }

    function normalizeEventId(value) { return DSFirebaseInfra.normalizeEventId(value); }
    function normalizeGameId(value) { return DSFirebaseInfra.normalizeGameId(value); }

    function getUserGameDocRef(userId, gameId) { return DSFirebaseInfra.getUserGameDocRef(userId, gameId); }
    function getGameDocRef(gameId) { return DSFirebaseInfra.getGameDocRef(gameId); }
    function getGameAllianceCollectionRef(gameId) { return DSFirebaseInfra.getGameAllianceCollectionRef(gameId); }
    function getGameAllianceDocRef(gameId, allianceDocId) { return DSFirebaseInfra.getGameAllianceDocRef(gameId, allianceDocId); }
    function getLegacyAllianceCollectionRef() { return DSFirebaseInfra.getLegacyAllianceCollectionRef(); }
    function getLegacyAllianceDocRef(allianceDocId) { return DSFirebaseInfra.getLegacyAllianceDocRef(allianceDocId); }
    function getGameInvitationCollectionRef(gameId, allianceIdParam) { return DSFirebaseInfra.getGameInvitationCollectionRef(gameId, allianceIdParam); }
    function getGameInvitationDocRef(gameId, allianceIdParam, invitationId) { return DSFirebaseInfra.getGameInvitationDocRef(gameId, allianceIdParam, invitationId); }
    function findInvitationById(gameId, invitationId) { return DSFirebaseInfra.findInvitationById(gameId, invitationId); }
    function getUserGamePlayersCollectionRef(userId, gameId) { return DSFirebaseInfra.getUserGamePlayersCollectionRef(userId, gameId); }
    function getUserGameEventsCollectionRef(userId, gameId) { return DSFirebaseInfra.getUserGameEventsCollectionRef(userId, gameId); }
    function getUserGameEventMediaCollectionRef(userId, gameId) { return DSFirebaseInfra.getUserGameEventMediaCollectionRef(userId, gameId); }
    function getGameUserStateDocRef(gameId, uid) { return DSFirebaseInfra.getGameUserStateDocRef(gameId, uid); }
    function getSoloplayerDocRef(gameId, uid) { return DSFirebaseInfra.getSoloplayerDocRef(gameId, uid); }
    function getSoloplayerPlayersCollectionRef(gameId, uid) { return DSFirebaseInfra.getSoloplayerPlayersCollectionRef(gameId, uid); }
    function getAlliancePlayersCollectionRef(gameId, allianceId) { return DSFirebaseInfra.getAlliancePlayersCollectionRef(gameId, allianceId); }
    function getGameScopedEventsCollectionRef(gameId) { return DSFirebaseInfra.getGameScopedEventsCollectionRef(gameId); }
    function getGameEventHistoryCollectionRef(gameId) { return DSFirebaseInfra.getGameEventHistoryCollectionRef(gameId); }
    function getGameSoloUpdateTokensCollectionRef(gameId, uid) { return DSFirebaseInfra.getGameSoloUpdateTokensCollectionRef(gameId, uid); }
    function getGameSoloPendingUpdatesCollectionRef(gameId, uid) { return DSFirebaseInfra.getGameSoloPendingUpdatesCollectionRef(gameId, uid); }
    function getGameSoloSharedUpdateInvitesCollectionRef(gameId, uid) { return DSFirebaseInfra.getGameSoloSharedUpdateInvitesCollectionRef(gameId, uid); }
    function getGameSoloSharedUpdateInviteCandidatesCollectionRef(gameId, uid, inviteId) { return DSFirebaseInfra.getGameSoloSharedUpdateInviteCandidatesCollectionRef(gameId, uid, inviteId); }
    function getGameAllianceUpdateTokensCollectionRef(gameId, allianceId) { return DSFirebaseInfra.getGameAllianceUpdateTokensCollectionRef(gameId, allianceId); }
    function getGameAlliancePendingUpdatesCollectionRef(gameId, allianceId) { return DSFirebaseInfra.getGameAlliancePendingUpdatesCollectionRef(gameId, allianceId); }
    function getGameAllianceSharedUpdateInvitesCollectionRef(gameId, allianceId) { return DSFirebaseInfra.getGameAllianceSharedUpdateInvitesCollectionRef(gameId, allianceId); }
    function getGameAllianceSharedUpdateInviteCandidatesCollectionRef(gameId, allianceId, inviteId) { return DSFirebaseInfra.getGameAllianceSharedUpdateInviteCandidatesCollectionRef(gameId, allianceId, inviteId); }

    function createStableDocId(rawValue, prefix) { return DSFirebaseInfra.createStableDocId(rawValue, prefix); }
    function getPlayerDocId(playerName) { return DSFirebaseInfra.getPlayerDocId(playerName); }
    function getEventDocId(eventId) { return DSFirebaseInfra.getEventDocId(eventId); }
    function parseMigrationVersion(value) { return DSFirebaseInfra.parseMigrationVersion(value); }

    function updateMigrationMarkersFromUserData(data) {
        const source = data && typeof data === 'object' ? data : {};
        migrationVersion = parseMigrationVersion(source.migrationVersion);
        migratedToGameSubcollectionsAt = source.migratedToGameSubcollectionsAt || null;
    }

    function extractLegacyGameScopedData(legacyData, gameId) {
        const source = legacyData && typeof legacyData === 'object' ? legacyData : null;
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        if (!source) {
            return null;
        }

        if (source.games && typeof source.games === 'object') {
            const mappedGameData = source.games[normalizedGameId];
            if (mappedGameData && typeof mappedGameData === 'object') {
                return mappedGameData;
            }
        }

        if (normalizedGameId === DEFAULT_GAME_ID) {
            return source;
        }
        return null;
    }

    function getNonEmptyPlayerDatabaseMap(source) {
        if (!source || typeof source !== 'object') {
            return null;
        }
        const map = source.playerDatabase;
        if (!map || typeof map !== 'object') {
            return null;
        }
        return Object.keys(map).length > 0 ? map : null;
    }

    function extractLegacyPlayerDatabaseFallback(legacyData, gameId) {
        const source = legacyData && typeof legacyData === 'object' ? legacyData : null;
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        if (!source) {
            return {};
        }

        const mappedGameData = source.games
            && typeof source.games === 'object'
            && source.games[normalizedGameId]
            && typeof source.games[normalizedGameId] === 'object'
            ? source.games[normalizedGameId]
            : null;

        const mappedPlayers = getNonEmptyPlayerDatabaseMap(mappedGameData);
        if (mappedPlayers) {
            return mappedPlayers;
        }

        if (normalizedGameId === DEFAULT_GAME_ID) {
            const rootPlayers = getNonEmptyPlayerDatabaseMap(source);
            if (rootPlayers) {
                return rootPlayers;
            }
        }

        return {};
    }

    function resolveGameScopedReadPayload(options) {
        const source = options && typeof options === 'object' ? options : {};
        const normalizedGameId = normalizeGameId(source.gameId) || DEFAULT_GAME_ID;
        const gameData = source.gameData && typeof source.gameData === 'object' ? source.gameData : null;
        const allowLegacyFallback = source.allowLegacyFallback === true;
        const legacyData = allowLegacyFallback
            ? extractLegacyGameScopedData(source.legacyData, normalizedGameId)
            : null;

        if (gameData) {
            return {
                gameId: normalizedGameId,
                source: 'game',
                usedLegacyFallback: false,
                data: gameData,
            };
        }
        if (legacyData) {
            return {
                gameId: normalizedGameId,
                source: 'legacy',
                usedLegacyFallback: true,
                data: legacyData,
            };
        }
        return {
            gameId: normalizedGameId,
            source: 'none',
            usedLegacyFallback: false,
            data: null,
        };
    }

    function incrementObservabilityCounter(counterKey, amount) { DSFirebaseInfra.incrementObservabilityCounter(counterKey, amount); }
    function getObservabilityCounters() { return DSFirebaseInfra.getObservabilityCounters(); }
    function resetObservabilityCounters() { DSFirebaseInfra.resetObservabilityCounters(); }
    function normalizeGameContextInput(context) { return DSFirebaseInfra.normalizeGameContextInput(context); }
    function normalizeUid(value) { return DSFirebaseInfra.normalizeUid(value); }
    function resolveScopedActiveGameStorageKey(userOrUid) { return DSFirebaseInfra.resolveScopedActiveGameStorageKey(userOrUid); }
    function resolveGameplayContext(methodName, context) { return DSFirebaseInfra.resolveGameplayContext(methodName, context); }
    function getResolvedGameId(methodName, context) { return DSFirebaseInfra.getResolvedGameId(methodName, context); }
    function resolveInitialAuthGameId(userOrUid) { return DSFirebaseInfra.resolveInitialAuthGameId(userOrUid); }

    function isActiveGameplayGameId(gameId) {
        const targetGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        return (normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID) === targetGameId;
    }

    function resetAllianceRuntimeState() {
        allianceId = null;
        allianceName = null;
        allianceData = null;
        activeAllianceDocScope = 'game';
        pendingInvitations = [];
        sentInvitations = [];
        invitationNotifications = [];
    }

    async function resolveUserGameAssociationState(gameId) {
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        const allowLegacyFallback = isLegacyFallbackAllowed();
        if (!currentUser || !db) {
            return {
                gameId: normalizedGameId,
                allianceId: null,
                allianceName: null,
                playerSource: 'personal',
            };
        }

        const gameRef = getUserGameDocRef(currentUser.uid, normalizedGameId);
        if (gameRef) {
            const gameDoc = await getDocWithPermissionTolerantFallback(gameRef, { label: 'game association profile' });
            if (gameDoc.exists) {
                const gameData = gameDoc.data || {};
                return {
                    gameId: normalizedGameId,
                    allianceId: typeof gameData.allianceId === 'string' ? gameData.allianceId : null,
                    allianceName: typeof gameData.allianceName === 'string' ? gameData.allianceName : null,
                    playerSource: gameData.playerSource === 'alliance' ? 'alliance' : 'personal',
                };
            }
        }

        if (!allowLegacyFallback) {
            return {
                gameId: normalizedGameId,
                allianceId: null,
                allianceName: null,
                playerSource: 'personal',
            };
        }

        const legacyUserRef = db.collection('users').doc(currentUser.uid);
        const legacyUserDoc = await getDocWithPermissionTolerantFallback(legacyUserRef, { label: 'legacy association profile' });
        if (legacyUserDoc.exists) {
            const legacyRoot = legacyUserDoc.data && typeof legacyUserDoc.data === 'object' ? legacyUserDoc.data : {};
            let legacyScoped = null;
            if (
                legacyRoot.games
                && typeof legacyRoot.games === 'object'
                && legacyRoot.games[normalizedGameId]
                && typeof legacyRoot.games[normalizedGameId] === 'object'
            ) {
                legacyScoped = legacyRoot.games[normalizedGameId];
            } else if (normalizedGameId === DEFAULT_GAME_ID) {
                legacyScoped = legacyRoot;
            }
            if (legacyScoped) {
                return {
                    gameId: normalizedGameId,
                    allianceId: typeof legacyScoped.allianceId === 'string' ? legacyScoped.allianceId : null,
                    allianceName: typeof legacyScoped.allianceName === 'string' ? legacyScoped.allianceName : null,
                    playerSource: legacyScoped.playerSource === 'alliance' ? 'alliance' : 'personal',
                };
            }
        }

        return {
            gameId: normalizedGameId,
            allianceId: null,
            allianceName: null,
            playerSource: 'personal',
        };
    }

    async function setActiveAllianceGameContext(gameId) {
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        if (activeAllianceGameId === normalizedGameId) {
            return;
        }
        stopAllianceDocListener();
        resetAllianceRuntimeState();
        activeAllianceGameId = normalizedGameId;
        const state = await resolveUserGameAssociationState(normalizedGameId);
        allianceId = state.allianceId || null;
        allianceName = state.allianceName || null;
        playerSource = state.playerSource === 'alliance' ? 'alliance' : 'personal';
    }

    async function persistUserGameAssociationState(gameId, overrides) {
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        if (!currentUser || !db) {
            return;
        }
        const source = overrides && typeof overrides === 'object' ? overrides : {};
        const nextAllianceId = Object.prototype.hasOwnProperty.call(source, 'allianceId')
            ? (source.allianceId || null)
            : (allianceId || null);
        const nextAllianceName = Object.prototype.hasOwnProperty.call(source, 'allianceName')
            ? (source.allianceName || null)
            : (allianceName || null);
        const nextPlayerSource = Object.prototype.hasOwnProperty.call(source, 'playerSource')
            ? (source.playerSource === 'alliance' ? 'alliance' : 'personal')
            : (playerSource === 'alliance' ? 'alliance' : 'personal');

        const gameRef = getUserGameDocRef(currentUser.uid, normalizedGameId);
        if (gameRef) {
            await gameRef.set({
                allianceId: nextAllianceId,
                allianceName: nextAllianceName,
                playerSource: nextPlayerSource,
                metadata: {
                    lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                },
            }, { merge: true });
        }

        // Dual-write to new game-centric user_state path
        try {
            const newStateRef = getGameUserStateDocRef(normalizedGameId, currentUser.uid);
            if (newStateRef) {
                await newStateRef.set({
                    allianceId: nextAllianceId,
                    allianceName: nextAllianceName,
                    playerSource: nextPlayerSource,
                    metadata: {
                        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                    },
                }, { merge: true });
            }
        } catch (dualWriteErr) {
            console.warn('⚠️ Dual-write to game user_state (association) failed:', dualWriteErr.message);
        }

    }

    function normalizeEventName(value, fallback) {
        const raw = typeof value === 'string' ? value.trim() : '';
        const resolved = raw || (typeof fallback === 'string' ? fallback : '');
        return resolved.slice(0, EVENT_NAME_MAX_LEN);
    }

    function sanitizeEventImageDataUrl(value, maxLength) {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw || !raw.startsWith('data:image/')) {
            return '';
        }
        if (raw.length > maxLength) {
            return '';
        }
        return raw;
    }

    function getDefaultEventName(eventId) {
        const mappedName = LEGACY_EVENT_NAME_DEFAULTS[eventId];
        if (typeof mappedName === 'string' && mappedName.trim()) {
            return mappedName.trim().slice(0, EVENT_NAME_MAX_LEN);
        }
        return eventId;
    }

    function cloneDefaultLegacyBuildingConfig(eventId) {
        const defaults = LEGACY_EVENT_BUILDING_DEFAULTS[eventId];
        if (!Array.isArray(defaults)) {
            return [];
        }
        return defaults.map((item) => ({
            ...item,
            showOnMap: item && item.showOnMap !== false,
        }));
    }

    function cloneDefaultLegacyMedia(eventId) {
        const media = LEGACY_EVENT_MEDIA_DEFAULTS[eventId];
        if (!media || typeof media !== 'object') {
            return { logoDataUrl: '', mapDataUrl: '' };
        }
        return {
            logoDataUrl: sanitizeEventImageDataUrl(media.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN),
            mapDataUrl: sanitizeEventImageDataUrl(media.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN),
        };
    }

    function cloneDefaultLegacyPositions(eventId) {
        const defaults = LEGACY_EVENT_POSITIONS_DEFAULTS[eventId];
        if (!defaults || typeof defaults !== 'object') {
            return null;
        }
        const normalized = normalizePositionsMap(defaults);
        return Object.keys(normalized).length > 0 ? normalized : null;
    }

    function normalizeBuildingConfigForDefaults(config) {
        if (!Array.isArray(config)) {
            return null;
        }
        const normalized = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return;
            }
            const next = { name: name };
            if (typeof item.label === 'string' && item.label.trim()) {
                next.label = item.label.trim();
            }
            next.showOnMap = item.showOnMap !== false;
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            normalized.push(next);
        });
        return normalized.length > 0 ? normalized : null;
    }

    function ensureLegacyEventEntriesWithDefaults(map) {
        const target = map && typeof map === 'object' ? map : {};
        let changed = false;
        LEGACY_EVENT_IDS.forEach((eventId) => {
            if (!target[eventId]) {
                target[eventId] = createEmptyEventEntry({ name: getDefaultEventName(eventId) });
                changed = true;
            }
            const entry = target[eventId];
            if (!entry.name) {
                entry.name = getDefaultEventName(eventId);
                changed = true;
            }

            const normalizedLogoDataUrl = sanitizeEventImageDataUrl(entry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            if (entry.logoDataUrl !== normalizedLogoDataUrl) {
                entry.logoDataUrl = normalizedLogoDataUrl;
                changed = true;
            }
            const normalizedMapDataUrl = sanitizeEventImageDataUrl(entry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            if (entry.mapDataUrl !== normalizedMapDataUrl) {
                entry.mapDataUrl = normalizedMapDataUrl;
                changed = true;
            }
            const defaultMedia = cloneDefaultLegacyMedia(eventId);
            if (!entry.logoDataUrl && defaultMedia.logoDataUrl) {
                entry.logoDataUrl = defaultMedia.logoDataUrl;
                changed = true;
            }
            if (!entry.mapDataUrl && defaultMedia.mapDataUrl) {
                entry.mapDataUrl = defaultMedia.mapDataUrl;
                changed = true;
            }

            const normalizedConfig = normalizeBuildingConfigForDefaults(entry.buildingConfig);
            if (!Array.isArray(normalizedConfig) || normalizedConfig.length === 0) {
                entry.buildingConfig = cloneDefaultLegacyBuildingConfig(eventId);
                if (!Number.isFinite(Number(entry.buildingConfigVersion)) || Number(entry.buildingConfigVersion) <= 0) {
                    entry.buildingConfigVersion = 1;
                }
                changed = true;
            } else if (!Array.isArray(entry.buildingConfig) || entry.buildingConfig.length !== normalizedConfig.length) {
                entry.buildingConfig = normalizedConfig;
                changed = true;
            }

            const normalizedPositions = normalizePositionsMap(entry.buildingPositions);
            if (Object.keys(normalizedPositions).length === 0) {
                const defaultPositions = cloneDefaultLegacyPositions(eventId);
                if (defaultPositions) {
                    entry.buildingPositions = defaultPositions;
                    if (!Number.isFinite(Number(entry.buildingPositionsVersion)) || Number(entry.buildingPositionsVersion) <= 0) {
                        entry.buildingPositionsVersion = 1;
                    }
                    changed = true;
                }
            } else if (
                !entry.buildingPositions
                || typeof entry.buildingPositions !== 'object'
                || Object.keys(entry.buildingPositions).length !== Object.keys(normalizedPositions).length
            ) {
                entry.buildingPositions = normalizedPositions;
                changed = true;
            }
        });
        return { events: target, changed: changed };
    }

    function ensureLegacyEventEntries(map) {
        const target = map && typeof map === 'object' ? map : {};
        LEGACY_EVENT_IDS.forEach((eventId) => {
            if (!target[eventId]) {
                target[eventId] = createEmptyEventEntry({ name: getDefaultEventName(eventId) });
            }
            const entry = target[eventId];
            if (!entry.name) {
                entry.name = getDefaultEventName(eventId);
            }
        });
        return target;
    }

    eventData = ensureLegacyEventEntriesWithDefaults(eventData).events;
    globalDefaultEventPositions = emptyGlobalEventPositions();
    globalDefaultEventBuildingConfig = emptyGlobalBuildingConfig();

    function normalizeCoordinatePair(value) {
        if (!Array.isArray(value) || value.length < 2) {
            return null;
        }
        const x = Number(value[0]);
        const y = Number(value[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }
        return [Math.round(x), Math.round(y)];
    }

    function normalizePositionsMap(positions) {
        if (!positions || typeof positions !== 'object') {
            return {};
        }
        const normalized = {};
        Object.entries(positions).forEach(([name, coords]) => {
            if (typeof name !== 'string' || !name.trim()) {
                return;
            }
            const pair = normalizeCoordinatePair(coords);
            if (pair) {
                normalized[name] = pair;
            }
        });
        return normalized;
    }

    function normalizeEventPositionsPayload(payload) {
        const source = payload && typeof payload === 'object'
            ? payload
            : {};
        const normalized = emptyGlobalEventPositions(source);
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            normalized[eid] = normalizePositionsMap(source[rawId]);
        });
        return normalized;
    }

    function hasAnyPositions(events) {
        if (!events || typeof events !== 'object') {
            return false;
        }
        return Object.keys(events).some((eid) => Object.keys(events[eid] || {}).length > 0);
    }

    function toMillis(value) { return DSFirebaseInfra.toMillis(value); }

    function extractVersionFromUserData(data) {
        if (!data || typeof data !== 'object') {
            return 0;
        }
        const metadata = data.metadata && typeof data.metadata === 'object'
            ? data.metadata
            : {};
        const metaVersion = Math.max(
            toMillis(metadata.lastModified),
            toMillis(metadata.lastUpload)
        );
        let eventVersion = 0;
        if (data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                const positionsVersion = Number(entry.buildingPositionsVersion);
                if (Number.isFinite(positionsVersion) && positionsVersion > eventVersion) {
                    eventVersion = positionsVersion;
                }
                const configVersion = Number(entry.buildingConfigVersion);
                if (Number.isFinite(configVersion) && configVersion > eventVersion) {
                    eventVersion = configVersion;
                }
            });
        } else {
            const legacyPositionsVersion = Number(data.buildingPositionsVersion);
            if (Number.isFinite(legacyPositionsVersion) && legacyPositionsVersion > 0) {
                eventVersion = legacyPositionsVersion;
            }
            const legacyConfigVersion = Number(data.buildingConfigVersion);
            if (Number.isFinite(legacyConfigVersion) && legacyConfigVersion > eventVersion) {
                eventVersion = legacyConfigVersion;
            }
        }
        return Math.max(metaVersion, eventVersion);
    }

    function extractPositionsFromUserData(data) {
        const events = emptyGlobalEventPositions(data && data.events ? data.events : null);
        if (data && data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                events[eid] = normalizePositionsMap(entry.buildingPositions);
            });
            return events;
        }
        if (data && data.buildingPositions && typeof data.buildingPositions === 'object') {
            events.desert_storm = normalizePositionsMap(data.buildingPositions);
        }
        return events;
    }

    function setGlobalDefaultPositions(events, version) {
        globalDefaultEventPositions = normalizeEventPositionsPayload(events);
        const parsedVersion = Number(version);
        globalDefaultPositionsVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function normalizeBuildingConfigArray(config) {
        if (!Array.isArray(config)) {
            return null;
        }
        const normalized = [];
        config.forEach((item) => {
            if (!item || typeof item !== 'object') {
                return;
            }
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            if (!name) {
                return;
            }
            const next = { name: name };
            if (typeof item.label === 'string' && item.label.trim()) {
                next.label = item.label.trim();
            }
            next.showOnMap = item.showOnMap !== false;
            const slots = Number(item.slots);
            if (Number.isFinite(slots)) {
                next.slots = Math.round(slots);
            }
            const priority = Number(item.priority);
            if (Number.isFinite(priority)) {
                next.priority = Math.round(priority);
            }
            normalized.push(next);
        });
        return normalized.length > 0 ? normalized : null;
    }

    function clonePlayerImportSchema(schema) {
        return JSON.parse(JSON.stringify(schema && typeof schema === 'object' ? schema : DEFAULT_PLAYER_IMPORT_SCHEMA));
    }

    function normalizePlayerImportSchema(schema) {
        const source = schema && typeof schema === 'object' ? schema : DEFAULT_PLAYER_IMPORT_SCHEMA;
        const sheetName = typeof source.sheetName === 'string' && source.sheetName.trim()
            ? source.sheetName.trim()
            : DEFAULT_PLAYER_IMPORT_SCHEMA.sheetName;
        const templateFileName = typeof source.templateFileName === 'string' && source.templateFileName.trim()
            ? source.templateFileName.trim()
            : DEFAULT_PLAYER_IMPORT_SCHEMA.templateFileName;
        const headerRowIndexRaw = Number(source.headerRowIndex);
        const headerRowIndex = Number.isFinite(headerRowIndexRaw) && headerRowIndexRaw >= 0
            ? Math.floor(headerRowIndexRaw)
            : DEFAULT_PLAYER_IMPORT_SCHEMA.headerRowIndex;
        const columns = Array.isArray(source.columns) && source.columns.length > 0
            ? source.columns
                .map((column) => {
                    const key = typeof column.key === 'string' ? column.key.trim() : '';
                    const header = typeof column.header === 'string' ? column.header.trim() : '';
                    if (!key || !header) {
                        return null;
                    }
                    return {
                        key: key,
                        header: header,
                        required: column.required !== false,
                    };
                })
                .filter(Boolean)
            : clonePlayerImportSchema(DEFAULT_PLAYER_IMPORT_SCHEMA).columns;
        return {
            id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : DEFAULT_PLAYER_IMPORT_SCHEMA.id,
            templateFileName: templateFileName,
            sheetName: sheetName,
            headerRowIndex: headerRowIndex,
            columns: columns,
        };
    }

    function getPlayerImportSchema(gameId) {
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        if (typeof window !== 'undefined' && window.DSCoreGames && typeof window.DSCoreGames.getGame === 'function') {
            const game = window.DSCoreGames.getGame(normalizedGameId);
            if (game && game.playerImportSchema && typeof game.playerImportSchema === 'object') {
                return normalizePlayerImportSchema(game.playerImportSchema);
            }
        }
        return normalizePlayerImportSchema(DEFAULT_PLAYER_IMPORT_SCHEMA);
    }

    function resolvePlayerImportColumnMap(schema) {
        const normalizedSchema = normalizePlayerImportSchema(schema);
        const map = {};
        normalizedSchema.columns.forEach((column) => {
            map[column.key] = column;
        });
        return {
            schema: normalizedSchema,
            nameColumn: map.name || { key: 'name', header: 'Player Name', required: true },
            powerColumn: map.power || { key: 'power', header: 'E1 Total Power(M)', required: false },
            troopsColumn: map.troops || { key: 'troops', header: 'E1 Troops', required: false },
            requiredColumns: normalizedSchema.columns.filter((column) => column.required !== false),
        };
    }

    function parseWorkbookPlayers(workbook, schema) {
        const columnMap = resolvePlayerImportColumnMap(schema);
        const normalizedSchema = columnMap.schema;
        const sheet = workbook && workbook.Sheets ? workbook.Sheets[normalizedSchema.sheetName] : null;
        if (!sheet) {
            return {
                success: false,
                errorKey: 'players_upload_schema_mismatch',
                error: 'players_upload_schema_mismatch',
                errorParams: {
                    sheet: normalizedSchema.sheetName,
                    columns: columnMap.requiredColumns.map((column) => column.header).join(', '),
                },
            };
        }

        const headerRows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            range: normalizedSchema.headerRowIndex,
            blankrows: false,
        });
        const headerRow = Array.isArray(headerRows) && Array.isArray(headerRows[0]) ? headerRows[0] : [];
        const normalizedHeaders = new Set(headerRow
            .map((header) => (typeof header === 'string' ? header.trim() : ''))
            .filter(Boolean));
        const missingRequiredHeaders = columnMap.requiredColumns
            .map((column) => column.header)
            .filter((header) => !normalizedHeaders.has(header));
        if (missingRequiredHeaders.length > 0) {
            return {
                success: false,
                errorKey: 'players_upload_schema_mismatch',
                error: 'players_upload_schema_mismatch',
                errorParams: {
                    sheet: normalizedSchema.sheetName,
                    columns: missingRequiredHeaders.join(', '),
                },
            };
        }

        const rows = XLSX.utils.sheet_to_json(sheet, {
            range: normalizedSchema.headerRowIndex,
        });
        const nextDatabase = {};
        const skippedPlayers = [];
        let skippedCount = 0;
        const nowIso = new Date().toISOString();

        rows.forEach((row) => {
            const name = normalizeEditablePlayerName(row[columnMap.nameColumn.header]);
            const power = row[columnMap.powerColumn.header];
            const troops = row[columnMap.troopsColumn.header];
            if (name) {
                nextDatabase[name] = {
                    power: normalizeEditablePlayerPower(power),
                    troops: normalizeEditablePlayerTroops(troops),
                    lastUpdated: nowIso,
                };
            } else {
                skippedCount += 1;
                skippedPlayers.push(`Row with no name (power: ${power || 'none'}, troops: ${troops || 'none'})`);
            }
        });

        return {
            success: true,
            nextDatabase: nextDatabase,
            skippedCount: skippedCount,
            skippedPlayers: skippedPlayers,
        };
    }

    function isGameMetadataSuperAdmin(userOrUid) {
        if (typeof userOrUid === 'string') {
            return userOrUid.trim() === GAME_METADATA_SUPER_ADMIN_UID;
        }
        return !!(userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string' && userOrUid.uid.trim() === GAME_METADATA_SUPER_ADMIN_UID);
    }

    function getCatalogGames() {
        if (typeof window !== 'undefined' && window.DSCoreGames && typeof window.DSCoreGames.listAvailableGames === 'function') {
            const games = window.DSCoreGames.listAvailableGames();
            if (Array.isArray(games)) {
                return games.map((game) => JSON.parse(JSON.stringify(game)));
            }
        }
        return [{
            id: DEFAULT_GAME_ID,
            name: 'Last War: Survival',
            logo: '',
            company: '',
        }];
    }

    function sanitizeGameMetadataPayload(payload, baseGame) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const base = baseGame && typeof baseGame === 'object' ? baseGame : {};
        const nameValue = Object.prototype.hasOwnProperty.call(source, 'name') ? source.name : base.name;
        const logoValue = Object.prototype.hasOwnProperty.call(source, 'logo') ? source.logo : base.logo;
        const companyValue = Object.prototype.hasOwnProperty.call(source, 'company') ? source.company : base.company;
        return {
            name: typeof nameValue === 'string' ? nameValue.trim().slice(0, 80) : '',
            logo: typeof logoValue === 'string' ? logoValue.trim().slice(0, MAX_EVENT_LOGO_DATA_URL_LEN) : '',
            company: typeof companyValue === 'string' ? companyValue.trim().slice(0, 80) : '',
        };
    }

    function mergeGameMetadataOverridesIntoMap(byId, overrides) {
        if (!(byId instanceof Map) || !overrides || typeof overrides !== 'object') {
            return;
        }
        Object.keys(overrides).forEach((rawGameId) => {
            const gameId = normalizeGameId(rawGameId);
            if (!gameId || !byId.has(gameId)) {
                return;
            }
            const current = byId.get(gameId);
            const merged = sanitizeGameMetadataPayload(overrides[rawGameId], current);
            byId.set(gameId, {
                ...current,
                ...merged,
            });
        });
    }

    function createGameMetadataWritePayload(normalizedGameId, sanitized) {
        return {
            games: {
                [normalizedGameId]: {
                    name: sanitized.name,
                    logo: sanitized.logo,
                    company: sanitized.company,
                    metadata: {
                        updatedBy: currentUser.uid,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    },
                },
            },
            metadata: {
                updatedBy: currentUser.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
        };
    }

    async function setGameMetadataConfigOverride(normalizedGameId, sanitized) {
        if (!db) {
            throw new Error('Firestore not initialized');
        }
        await db.collection(GLOBAL_COORDS_COLLECTION).doc(GAME_METADATA_OVERRIDES_DOC_ID).set(
            createGameMetadataWritePayload(normalizedGameId, sanitized),
            { merge: true }
        );
    }

    function cloneGameMetadataEntries(entries) {
        if (!Array.isArray(entries)) {
            return [];
        }
        return entries.map((entry) => {
            const game = entry && typeof entry === 'object' ? entry : {};
            return {
                id: typeof game.id === 'string' ? game.id : '',
                name: typeof game.name === 'string' ? game.name : '',
                logo: typeof game.logo === 'string' ? game.logo : '',
                company: typeof game.company === 'string' ? game.company : '',
            };
        });
    }

    function invalidateGameMetadataCache() {
        gameMetadataCache = {
            expiresAt: 0,
            entries: null,
        };
    }

    function readCachedGameMetadata() {
        if (!gameMetadataCache || !Array.isArray(gameMetadataCache.entries)) {
            return null;
        }
        if (Date.now() > Number(gameMetadataCache.expiresAt || 0)) {
            invalidateGameMetadataCache();
            return null;
        }
        return cloneGameMetadataEntries(gameMetadataCache.entries);
    }

    function writeGameMetadataCache(entries) {
        gameMetadataCache = {
            expiresAt: Date.now() + GAME_METADATA_CACHE_TTL_MS,
            entries: cloneGameMetadataEntries(entries),
        };
    }

    async function listGameMetadata() {
        const cached = readCachedGameMetadata();
        if (cached) {
            return cached;
        }
        const catalogGames = getCatalogGames();
        const strictMode = isStrictModeEnabled();
        const byId = new Map();
        catalogGames.forEach((game) => {
            const id = normalizeGameId(game.id);
            if (!id) {
                return;
            }
            byId.set(id, {
                id: id,
                name: typeof game.name === 'string' ? game.name : id,
                logo: typeof game.logo === 'string' ? game.logo : '',
                company: typeof game.company === 'string' ? game.company : '',
            });
        });

        if (db) {
            try {
                const snapshot = await db.collection(GAMES_COLLECTION).get();
                const collectionOverrides = {};
                snapshot.docs.forEach((doc) => {
                    const gameId = normalizeGameId(doc.id);
                    if (!gameId) {
                        return;
                    }
                    collectionOverrides[gameId] = doc.data() || {};
                });
                mergeGameMetadataOverridesIntoMap(byId, collectionOverrides);
            } catch (error) {
                console.warn('Failed to read game metadata overrides:', error);
            }
            if (!strictMode) {
                try {
                    const configDocRef = db.collection(GLOBAL_COORDS_COLLECTION).doc(GAME_METADATA_OVERRIDES_DOC_ID);
                    const configDoc = await getDocWithPermissionTolerantFallback(configDocRef, { label: 'game metadata overrides' });
                    if (configDoc.exists && configDoc.data && typeof configDoc.data.games === 'object') {
                        mergeGameMetadataOverridesIntoMap(byId, configDoc.data.games);
                    }
                } catch (error) {
                    console.warn('Failed to read game metadata overrides from app config:', error);
                }
            }
        }

        const resolved = Array.from(byId.values());
        writeGameMetadataCache(resolved);
        return cloneGameMetadataEntries(resolved);
    }

    async function getGameMetadata(gameId) {
        const normalizedGameId = normalizeGameId(gameId);
        if (!normalizedGameId) {
            return null;
        }
        const games = await listGameMetadata();
        return games.find((game) => game.id === normalizedGameId) || null;
    }

    async function setGameMetadata(gameId, payload) {
        if (!currentUser) {
            return { success: false, errorKey: 'game_metadata_forbidden', error: 'game_metadata_forbidden' };
        }
        if (!isGameMetadataSuperAdmin(currentUser)) {
            return { success: false, errorKey: 'game_metadata_forbidden', error: 'game_metadata_forbidden' };
        }
        const normalizedGameId = normalizeGameId(gameId);
        if (!normalizedGameId) {
            return { success: false, errorKey: 'game_metadata_unknown_game', error: 'game_metadata_unknown_game' };
        }
        const baseGame = getCatalogGames().find((game) => normalizeGameId(game.id) === normalizedGameId);
        if (!baseGame) {
            return { success: false, errorKey: 'game_metadata_unknown_game', error: 'game_metadata_unknown_game' };
        }
        const sanitized = sanitizeGameMetadataPayload(payload, baseGame);
        const strictMode = isStrictModeEnabled();
        try {
            const gameDocRef = getGameDocRef(normalizedGameId);
            if (!gameDocRef) {
                return { success: false, errorKey: 'game_metadata_unknown_game', error: 'game_metadata_unknown_game' };
            }
            const primaryPayload = {
                name: sanitized.name,
                logo: sanitized.logo,
                company: sanitized.company,
                attributes: firebase.firestore.FieldValue.delete(),
                metadata: {
                    updatedBy: currentUser.uid,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                },
            };
            const primaryOptions = { mergeFields: ['name', 'logo', 'company', 'attributes', 'metadata'] };
            let primaryWriteSucceeded = false;
            try {
                await gameDocRef.set(primaryPayload, primaryOptions);
                primaryWriteSucceeded = true;
            } catch (primaryError) {
                if (!isPermissionDeniedError(primaryError)) {
                    throw primaryError;
                }
                if (strictMode) {
                    throw createStrictModeError(
                        'Strict mode blocked game metadata fallback write. Check rules for games/{gameId}.',
                        { gameId: normalizedGameId, operation: 'setGameMetadata.primary' }
                    );
                }
            }

            if (!strictMode) {
                try {
                    await setGameMetadataConfigOverride(normalizedGameId, sanitized);
                } catch (fallbackError) {
                    if (!primaryWriteSucceeded) {
                        throw fallbackError;
                    }
                    console.warn('Failed to mirror game metadata to app config override:', fallbackError);
                }
            }
            invalidateGameMetadataCache();

            return {
                success: true,
                game: {
                    id: normalizedGameId,
                    name: sanitized.name,
                    logo: sanitized.logo,
                    company: sanitized.company,
                },
            };
        } catch (error) {
            return { success: false, error: error.message || String(error) };
        }
    }

    function normalizeAssignmentAlgorithmId(value, fallback) {
        const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (raw) {
            return raw;
        }
        const fallbackRaw = typeof fallback === 'string' ? fallback.trim().toLowerCase() : '';
        return fallbackRaw || DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    function sanitizeEventEntry(eventId, payload, fallbackEntry) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const fallback = fallbackEntry && typeof fallbackEntry === 'object' ? fallbackEntry : {};
        const fallbackName = fallback.name || getDefaultEventName(eventId) || eventId;
        const normalized = createEmptyEventEntry({
            name: normalizeEventName(source.name, fallbackName),
            logoDataUrl: sanitizeEventImageDataUrl(source.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN),
            mapDataUrl: sanitizeEventImageDataUrl(source.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN),
            assignmentAlgorithmId: normalizeAssignmentAlgorithmId(source.assignmentAlgorithmId, fallback.assignmentAlgorithmId),
        });

        const normalizedConfig = normalizeBuildingConfigArray(source.buildingConfig);
        normalized.buildingConfig = Array.isArray(normalizedConfig)
            ? normalizedConfig
            : (Array.isArray(fallback.buildingConfig) ? normalizeBuildingConfigArray(fallback.buildingConfig) : null);

        const configVersion = Number(source.buildingConfigVersion);
        normalized.buildingConfigVersion = Number.isFinite(configVersion) && configVersion > 0
            ? Math.round(configVersion)
            : (Number.isFinite(Number(fallback.buildingConfigVersion)) ? Math.round(Number(fallback.buildingConfigVersion)) : 0);

        const normalizedPositions = normalizePositionsMap(source.buildingPositions);
        normalized.buildingPositions = Object.keys(normalizedPositions).length > 0
            ? normalizedPositions
            : (fallback.buildingPositions && typeof fallback.buildingPositions === 'object' ? normalizePositionsMap(fallback.buildingPositions) : null);

        const positionsVersion = Number(source.buildingPositionsVersion);
        normalized.buildingPositionsVersion = Number.isFinite(positionsVersion) && positionsVersion > 0
            ? Math.round(positionsVersion)
            : (Number.isFinite(Number(fallback.buildingPositionsVersion)) ? Math.round(Number(fallback.buildingPositionsVersion)) : 0);

        return normalized;
    }

    function normalizeEventsMap(payload, fallbackMap) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const fallback = fallbackMap && typeof fallbackMap === 'object' ? fallbackMap : {};
        const normalized = {};

        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            normalized[eventId] = sanitizeEventEntry(eventId, source[rawId], fallback[eventId]);
        });

        ensureLegacyEventEntries(normalized);
        return normalized;
    }

    function getEventMediaMap(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const media = {};
        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = source[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const logoDataUrl = sanitizeEventImageDataUrl(entry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const mapDataUrl = sanitizeEventImageDataUrl(entry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            if (!logoDataUrl && !mapDataUrl) {
                return;
            }
            media[eventId] = { logoDataUrl, mapDataUrl };
        });
        return media;
    }

    function buildEventsWithoutMedia(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const stripped = {};
        Object.keys(source).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = source[rawId];
            stripped[eventId] = sanitizeEventEntry(eventId, {
                name: entry && typeof entry.name === 'string' ? entry.name : '',
                logoDataUrl: '',
                mapDataUrl: '',
                assignmentAlgorithmId: entry ? entry.assignmentAlgorithmId : DEFAULT_ASSIGNMENT_ALGORITHM_ID,
                buildingConfig: entry ? entry.buildingConfig : null,
                buildingConfigVersion: entry ? entry.buildingConfigVersion : 0,
                buildingPositions: entry ? entry.buildingPositions : null,
                buildingPositionsVersion: entry ? entry.buildingPositionsVersion : 0,
            }, createEmptyEventEntry({ name: getDefaultEventName(eventId) }));
        });
        ensureLegacyEventEntries(stripped);
        return stripped;
    }

    function applyEventMediaToEvents(mediaMap) {
        const media = mediaMap && typeof mediaMap === 'object' ? mediaMap : {};
        Object.keys(media).forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const entry = media[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            ensureEventEntry(eventId);
            eventData[eventId].logoDataUrl = sanitizeEventImageDataUrl(entry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            eventData[eventId].mapDataUrl = sanitizeEventImageDataUrl(entry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
        });
    }

    async function loadEventMediaForUser(uid, gameId) {
        if (!db || !uid) {
            return {};
        }
        // Try new game-centric path first: games/{gameId}/events/{eventId} (media as fields on event doc)
        const newEventsCollection = getGameScopedEventsCollectionRef(gameId);
        if (newEventsCollection) {
            try {
                const newSnapshot = await newEventsCollection.get();
                if (newSnapshot && !newSnapshot.empty) {
                    const media = {};
                    newSnapshot.forEach((doc) => {
                        const eventId = normalizeEventId(doc.id);
                        if (!eventId) { return; }
                        const data = doc.data() || {};
                        const logoDataUrl = sanitizeEventImageDataUrl(data.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
                        const mapDataUrl = sanitizeEventImageDataUrl(data.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
                        if (!logoDataUrl && !mapDataUrl) { return; }
                        media[eventId] = { logoDataUrl, mapDataUrl };
                    });
                    if (Object.keys(media).length > 0) {
                        return media;
                    }
                }
            } catch (newPathErr) {
                if (!isPermissionDeniedError(newPathErr)) {
                    console.warn('⚠️ New-path event media read failed, falling back to legacy:', newPathErr.message);
                }
            }
        }
        // Fallback: old path users/{uid}/games/{gameId}/event_media/{eventId}
        const eventMediaCollection = getUserGameEventMediaCollectionRef(uid, gameId);
        if (!eventMediaCollection) {
            return {};
        }
        try {
            const snapshot = await eventMediaCollection.get();
            const media = {};
            snapshot.forEach((doc) => {
                const eventId = normalizeEventId(doc.id);
                if (!eventId) {
                    return;
                }
                const data = doc.data() || {};
                const logoDataUrl = sanitizeEventImageDataUrl(data.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
                const mapDataUrl = sanitizeEventImageDataUrl(data.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
                if (!logoDataUrl && !mapDataUrl) {
                    return;
                }
                media[eventId] = { logoDataUrl, mapDataUrl };
            });
            return media;
        } catch (error) {
            console.warn('⚠️ Failed to load event media docs:', error.message || error);
            return {};
        }
    }

    async function saveEventMediaDiff(uid, gameId, previousMediaMap, nextMediaMap) {
        if (!db || !uid) {
            return;
        }
        const eventMediaCollection = getUserGameEventMediaCollectionRef(uid, gameId);
        if (!eventMediaCollection) {
            return;
        }
        const previous = previousMediaMap && typeof previousMediaMap === 'object' ? previousMediaMap : {};
        const next = nextMediaMap && typeof nextMediaMap === 'object' ? nextMediaMap : {};
        const ids = new Set([...Object.keys(previous), ...Object.keys(next)]);
        if (ids.size === 0) {
            return;
        }
        const batch = db.batch();
        let changes = 0;
        ids.forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const prevEntry = previous[eventId] || { logoDataUrl: '', mapDataUrl: '' };
            const nextEntry = next[eventId] || { logoDataUrl: '', mapDataUrl: '' };
            const prevLogo = sanitizeEventImageDataUrl(prevEntry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const prevMap = sanitizeEventImageDataUrl(prevEntry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            const nextLogo = sanitizeEventImageDataUrl(nextEntry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
            const nextMap = sanitizeEventImageDataUrl(nextEntry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
            if (prevLogo === nextLogo && prevMap === nextMap) {
                return;
            }
            const ref = eventMediaCollection.doc(eventId);
            if (!nextLogo && !nextMap) {
                batch.delete(ref);
            } else {
                batch.set(ref, {
                    logoDataUrl: nextLogo,
                    mapDataUrl: nextMap,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            changes += 1;
        });
        if (changes > 0) {
            await batch.commit();
        }
        // Dual-write: also store media fields on game-scoped event docs
        const newEventsCollection = getGameScopedEventsCollectionRef(gameId);
        if (newEventsCollection) {
            try {
                const newBatch = db.batch();
                let newChanges = 0;
                ids.forEach((rawId) => {
                    const eventId = normalizeEventId(rawId);
                    if (!eventId) { return; }
                    const nextEntry = next[eventId] || { logoDataUrl: '', mapDataUrl: '' };
                    const nextLogo = sanitizeEventImageDataUrl(nextEntry.logoDataUrl, MAX_EVENT_LOGO_DATA_URL_LEN);
                    const nextMap = sanitizeEventImageDataUrl(nextEntry.mapDataUrl, MAX_EVENT_MAP_DATA_URL_LEN);
                    const newRef = newEventsCollection.doc(eventId);
                    newBatch.set(newRef, {
                        logoDataUrl: nextLogo,
                        mapDataUrl: nextMap,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    newChanges += 1;
                });
                if (newChanges > 0) {
                    await newBatch.commit();
                }
            } catch (dualWriteErr) {
                console.warn('⚠️ Dual-write event media to game-scoped events failed:', dualWriteErr.message);
            }
        }
    }

    function normalizeEventBuildingConfigPayload(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const normalized = emptyGlobalBuildingConfig(source);
        Object.keys(source).forEach((rawId) => {
            const eid = normalizeEventId(rawId);
            if (!eid) {
                return;
            }
            normalized[eid] = normalizeBuildingConfigArray(source[rawId]);
        });
        return normalized;
    }

    function hasAnyBuildingConfig(payload) {
        if (!payload || typeof payload !== 'object') {
            return false;
        }
        return Object.keys(payload).some((eid) => Array.isArray(payload[eid]) && payload[eid].length > 0);
    }

    function extractBuildingConfigFromUserData(data) {
        const result = emptyGlobalBuildingConfig(data && data.events ? data.events : null);
        if (data && data.events && typeof data.events === 'object') {
            Object.keys(data.events).forEach((rawId) => {
                const eid = normalizeEventId(rawId);
                if (!eid) {
                    return;
                }
                const entry = data.events[rawId];
                if (!entry || typeof entry !== 'object') {
                    return;
                }
                result[eid] = normalizeBuildingConfigArray(entry.buildingConfig);
            });
            return result;
        }
        if (data && Array.isArray(data.buildingConfig)) {
            result.desert_storm = normalizeBuildingConfigArray(data.buildingConfig);
        }
        return result;
    }

    function setGlobalDefaultBuildingConfig(payload, version) {
        globalDefaultEventBuildingConfig = normalizeEventBuildingConfigPayload(payload);
        const parsedVersion = Number(version);
        globalDefaultBuildingConfigVersion = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 0;
    }

    function getGlobalDefaultBuildingConfig(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventBuildingConfig[eid] || null));
    }

    function getGlobalDefaultBuildingConfigVersion() {
        return globalDefaultBuildingConfigVersion;
    }

    function getGlobalDefaultBuildingPositions(eventId) {
        const eid = eventId || 'desert_storm';
        return JSON.parse(JSON.stringify(globalDefaultEventPositions[eid] || {}));
    }

    function getGlobalDefaultBuildingPositionsVersion() {
        return globalDefaultPositionsVersion;
    }

    function applyGlobalDefaultBuildingConfigToEventData(options) {
        const opts = options && typeof options === 'object' ? options : {};
        const overwriteExisting = opts.overwriteExisting === true;
        const targetEventIds = Array.isArray(opts.eventIds) && opts.eventIds.length > 0 ? opts.eventIds : Object.keys(globalDefaultEventBuildingConfig || {});
        let changed = false;

        targetEventIds.forEach((rawId) => {
            const eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            const sharedConfig = normalizeBuildingConfigArray(globalDefaultEventBuildingConfig[eventId]);
            if (!Array.isArray(sharedConfig) || sharedConfig.length === 0) {
                return;
            }

            const eid = ensureEventEntry(eventId);
            const existingConfig = normalizeBuildingConfigArray(eventData[eid].buildingConfig);
            const hasExisting = Array.isArray(existingConfig) && existingConfig.length > 0;
            if (hasExisting && !overwriteExisting) {
                return;
            }

            eventData[eid].buildingConfig = sharedConfig;
            if (globalDefaultBuildingConfigVersion > 0) {
                eventData[eid].buildingConfigVersion = globalDefaultBuildingConfigVersion;
            }
            changed = true;
        });

        return changed;
    }

    function isPermissionDeniedError(error) { return DSFirebaseInfra.isPermissionDeniedError(error); }

    function applyPermissionDeniedLoadFallbackState() {
        stopAllianceDocListener();
        playerDatabase = {};
        eventData = ensureLegacyEventEntriesWithDefaults(createEmptyEventData()).events;
        allianceId = null;
        allianceName = null;
        allianceData = null;
        activeGameplayGameId = DEFAULT_GAME_ID;
        activeAllianceGameId = DEFAULT_GAME_ID;
        playerSource = 'personal';
        pendingInvitations = [];
        sentInvitations = [];
        invitationNotifications = [];
        userProfile = normalizeUserProfile(null);
        migrationVersion = 0;
        migratedToGameSubcollectionsAt = null;
        rememberLastSavedUserState();
    }

    async function getDocWithPermissionTolerantFallback(ref, options) {
        const label = options && typeof options.label === 'string' && options.label
            ? options.label
            : 'document';
        if (!ref || typeof ref.get !== 'function') {
            return { exists: false, data: null, permissionDenied: false };
        }
        try {
            const doc = await ref.get();
            const exists = !!(doc && doc.exists);
            return {
                exists: exists,
                data: exists ? (doc.data() || {}) : null,
                permissionDenied: false,
            };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                console.warn(`⚠️ Firestore rules denied ${label} read; continuing with available scopes.`);
                return { exists: false, data: null, permissionDenied: true };
            }
            throw error;
        }
    }

    function logOptionalSharedDefaultsIssue(message, error) {
        const details = (error && (error.message || error.code)) ? (error.message || error.code) : String(error || 'unknown');
        if (isPermissionDeniedError(error)) {
            console.info(`${message} (optional feature disabled by Firestore rules):`, details);
            return;
        }
        console.warn(message, details);
    }

    async function tryLoadGlobalDefaultsDoc() {
        try {
            const defaultsDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).get();
            if (!defaultsDoc.exists) {
                return false;
            }
            const data = defaultsDoc.data() || {};
            const events = normalizeEventPositionsPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyPositions(events)) {
                return false;
            }
            setGlobalDefaultPositions(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load shared coordinate defaults:', error);
            return false;
        }
    }

    async function tryLoadGlobalDefaultsFromOwnerUser() {
        if (currentUser && currentUser.email && currentUser.email.toLowerCase() === GLOBAL_COORD_OWNER_EMAIL) {
            const localOwnerEvents = extractPositionsFromUserData({ events: eventData });
            if (hasAnyPositions(localOwnerEvents)) {
                const localVersion = Math.max(extractVersionFromUserData({ events: eventData }), 1);
                setGlobalDefaultPositions(localOwnerEvents, localVersion);
                return true;
            }
        }
        try {
            let query = await db.collection('users')
                .where('metadata.emailLower', '==', GLOBAL_COORD_OWNER_EMAIL)
                .limit(1)
                .get();
            if (query.empty) {
                query = await db.collection('users')
                    .where('metadata.email', '==', GLOBAL_COORD_OWNER_EMAIL)
                    .limit(1)
                    .get();
            }
            if (query.empty) {
                return false;
            }

            const ownerData = query.docs[0].data() || {};
            const events = extractPositionsFromUserData(ownerData);
            if (!hasAnyPositions(events)) {
                return false;
            }
            const version = Math.max(extractVersionFromUserData(ownerData), 1);
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load owner coordinate defaults:', error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingPositions() {
        if (!db) {
            setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
            return false;
        }
        const fromSharedDoc = await tryLoadGlobalDefaultsDoc();
        if (fromSharedDoc) {
            return true;
        }
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        return tryLoadGlobalDefaultsFromOwnerUser();
    }

    async function maybePublishGlobalDefaultsFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractPositionsFromUserData(userData || {});
        if (!hasAnyPositions(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_COORDS_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultPositions(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to publish shared coordinate defaults:', error);
            return false;
        }
    }

    async function loadGlobalDefaultBuildingConfig() {
        if (!db) {
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
        try {
            const configDoc = await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).get();
            if (!configDoc.exists) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            const data = configDoc.data() || {};
            const events = normalizeEventBuildingConfigPayload(data.events || {});
            const version = Number(data.version);
            if (!hasAnyBuildingConfig(events)) {
                setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                return false;
            }
            setGlobalDefaultBuildingConfig(events, Number.isFinite(version) && version > 0 ? version : 0);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to load shared building config defaults:', error);
            setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
            return false;
        }
    }

    async function maybePublishGlobalBuildingConfigFromCurrentUser(userData) {
        if (!currentUser || !currentUser.email || currentUser.email.toLowerCase() !== GLOBAL_COORD_OWNER_EMAIL) {
            return false;
        }
        const events = extractBuildingConfigFromUserData(userData || {});
        if (!hasAnyBuildingConfig(events)) {
            return false;
        }
        const version = Math.max(Date.now(), extractVersionFromUserData(userData || {}), 1);
        try {
            await db.collection(GLOBAL_COORDS_COLLECTION).doc(GLOBAL_BUILDING_CONFIG_DOC_ID).set({
                sourceEmail: GLOBAL_COORD_OWNER_EMAIL,
                version: version,
                events: events,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            setGlobalDefaultBuildingConfig(events, version);
            return true;
        } catch (error) {
            logOptionalSharedDefaultsIssue('Unable to publish shared building config defaults:', error);
            return false;
        }
    }

    function normalizeUserProfile(profile) {
        const next = profile && typeof profile === 'object' ? profile : {};
        const displayName = typeof next.displayName === 'string' ? next.displayName.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        const nickname = typeof next.nickname === 'string' ? next.nickname.trim().slice(0, MAX_PROFILE_TEXT_LEN) : '';
        let avatarDataUrl = typeof next.avatarDataUrl === 'string' ? next.avatarDataUrl.trim() : '';
        const themeRaw = typeof next.theme === 'string' ? next.theme.trim().toLowerCase() : '';
        const theme = USER_PROFILE_THEMES.has(themeRaw) ? themeRaw : 'standard';
        if (!avatarDataUrl.startsWith('data:image/') || avatarDataUrl.length > MAX_AVATAR_DATA_URL_LEN) {
            avatarDataUrl = '';
        }
        return { displayName, nickname, avatarDataUrl, theme };
    }

    function cloneJson(value) { return DSFirebaseInfra.cloneJson(value); }
    function isPlainObject(value) { return DSFirebaseInfra.isPlainObject(value); }
    function areJsonEqual(a, b) { return DSFirebaseInfra.areJsonEqual(a, b); }

    function getUserStateDiff(lastState, currentState) {
        const changedFields = [];

        if (!lastState || !areJsonEqual(lastState.playerDatabase, currentState.playerDatabase)) {
            changedFields.push('playerDatabase');
        }
        if (!lastState || !areJsonEqual(lastState.events, currentState.events)) {
            changedFields.push('events');
        }
        const mediaChanged = !lastState || !areJsonEqual(lastState.eventMedia, currentState.eventMedia);
        if (mediaChanged) {
            changedFields.push('eventMedia');
        }
        if (!lastState || !areJsonEqual(lastState.userProfile, currentState.userProfile)) {
            changedFields.push('userProfile');
        }

        return {
            changedFields: changedFields,
            mediaChanged: mediaChanged,
        };
    }

    function getCurrentPersistedUserState() {
        return {
            playerDatabase: playerDatabase || {},
            events: buildEventsWithoutMedia(eventData),
            eventMedia: getEventMediaMap(eventData),
            userProfile: normalizeUserProfile(userProfile),
        };
    }

    function buildGameScopedUserPayload(currentState, changedFields) {
        const state = currentState && typeof currentState === 'object' ? currentState : getCurrentPersistedUserState();
        const changed = Array.isArray(changedFields) ? changedFields : [];
        const payload = {};

        if (changed.includes('playerDatabase')) {
            payload.playerDatabase = state.playerDatabase || {};
        }
        if (changed.includes('events')) {
            payload.events = state.events || {};
        }
        if (changed.includes('userProfile')) {
            payload.userProfile = state.userProfile || normalizeUserProfile(null);
        }

        payload.playerSource = playerSource || 'personal';
        payload.allianceId = allianceId || null;
        payload.allianceName = allianceName || null;

        payload.metadata = {
            totalPlayers: state.playerDatabase ? Object.keys(state.playerDatabase).length : 0,
            lastModified: firebase.firestore.FieldValue.serverTimestamp(),
        };

        return payload;
    }

    async function persistGameScopedPrimaryWrite(currentState, changedFields, context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }
        const gameId = getResolvedGameId('persistGameScopedPrimaryWrite', context);
        const gameRef = getUserGameDocRef(currentUser.uid, gameId);
        if (!gameRef) {
            return { success: false, error: 'Unable to resolve game document reference' };
        }

        const payload = buildGameScopedUserPayload(currentState, changedFields);
        const mergeFields = [
            'playerSource',
            'allianceId',
            'allianceName',
            'metadata',
        ];
        if (Array.isArray(changedFields)) {
            if (changedFields.includes('playerDatabase')) {
                mergeFields.push('playerDatabase');
            }
            if (changedFields.includes('events')) {
                mergeFields.push('events');
            }
            if (changedFields.includes('userProfile')) {
                mergeFields.push('userProfile');
            }
        }
        try {
            await gameRef.set(payload, { mergeFields: mergeFields });
            await db.collection('users').doc(currentUser.uid).set({
                migrationVersion: GAME_SUBCOLLECTION_MIGRATION_VERSION,
                migratedToGameSubcollectionsAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActiveGameId: gameId,
            }, { merge: true });
            migrationVersion = Math.max(migrationVersion, GAME_SUBCOLLECTION_MIGRATION_VERSION);
            migratedToGameSubcollectionsAt = new Date().toISOString();
            // Dual-write to new game-centric user_state path
            const newStateRef = getGameUserStateDocRef(gameId, currentUser.uid);
            if (newStateRef) {
                const stateFields = {};
                if (payload.playerSource !== undefined) { stateFields.playerSource = payload.playerSource; }
                if (payload.allianceId !== undefined) { stateFields.allianceId = payload.allianceId; }
                if (payload.allianceName !== undefined) { stateFields.allianceName = payload.allianceName; }
                if (payload.userProfile !== undefined) { stateFields.userProfile = payload.userProfile; }
                if (Object.keys(stateFields).length > 0) {
                    stateFields.metadata = { lastModified: firebase.firestore.FieldValue.serverTimestamp() };
                    try {
                        await newStateRef.set(stateFields, { merge: true });
                    } catch (dualWriteErr) {
                        console.warn('⚠️ Dual-write to game user_state failed:', dualWriteErr.message);
                    }
                }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message || String(error) };
        }
    }

    function rememberLastSavedUserState(state) {
        const source = state && typeof state === 'object' ? state : getCurrentPersistedUserState();
        lastSavedUserState = cloneJson(source);
    }

    function clearSaveQueue() {
        if (saveDebounceTimer) {
            clearTimeout(saveDebounceTimer);
            saveDebounceTimer = null;
        }
        if (typeof pendingSaveResolve === 'function') {
            pendingSaveResolve({ success: false, cancelled: true, error: 'Save cancelled' });
        }
        pendingSavePromise = null;
        pendingSaveResolve = null;
        pendingSaveContext = null;
    }

    function resetSaveState() {
        lastSavedUserState = null;
        clearSaveQueue();
    }

    function flushQueuedSaveOnLifecycle() {
        if (!pendingSavePromise || !saveDebounceTimer) {
            return;
        }
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
        flushQueuedSave().catch((error) => {
            console.warn('Unable to flush queued save during lifecycle change:', error);
        });
    }

    function bindSaveLifecycleHandlers() {
        if (saveLifecycleHandlersBound || typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }
        saveLifecycleHandlersBound = true;
        window.addEventListener('pagehide', flushQueuedSaveOnLifecycle);
        window.addEventListener('beforeunload', flushQueuedSaveOnLifecycle);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                flushQueuedSaveOnLifecycle();
            }
        });
    }
    
    /**
     * Initialize Firebase
     */
    function init() {
        try {
            if (!firebaseConfig) {
                throw new Error('Firebase configuration not loaded. Please create firebase-config.js');
            }
            
            firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
            db = firebase.firestore();
            DSFirebaseInfra.setDb(db);
            DSFirebaseAuth.configure({
                getAuth: function () { return auth; },
                getCurrentUser: function () { return currentUser; },
                setCurrentUser: function (u) { currentUser = u; },
                getOnAuthCallback: function () { return onAuthCallback; },
                setOnAuthCallback: function (cb) { onAuthCallback = cb; },
                applySignOutState: function () {
                    stopAllianceDocListener();
                    playerDatabase = {};
                    eventData = ensureLegacyEventEntriesWithDefaults(createEmptyEventData()).events;
                    allianceId = null; allianceName = null; allianceData = null;
                    activeGameplayGameId = DEFAULT_GAME_ID; activeAllianceGameId = DEFAULT_GAME_ID;
                    playerSource = 'personal';
                    pendingInvitations = []; sentInvitations = []; invitationNotifications = [];
                    userProfile = normalizeUserProfile(null);
                    setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
                    setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
                    migrationVersion = 0; migratedToGameSubcollectionsAt = null;
                    resetSaveState();
                },
                triggerPostSignInLoad: function (user) {
                    resetSaveState();
                    loadUserData(user, { gameId: resolveInitialAuthGameId(user.uid) });
                },
                invalidateGameMetadataCache: function () { invalidateGameMetadataCache(); },
                stopAllianceDocListener: function () { stopAllianceDocListener(); },
            });
            bindSaveLifecycleHandlers();

            // Set up auth state observer
            auth.onAuthStateChanged(DSFirebaseAuth.handleAuthStateChanged);
            
            console.log('✅ Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            return false;
        }
    }
    
    function handleAuthStateChanged(user) { return DSFirebaseAuth.handleAuthStateChanged(user); }
    function setAuthCallback(callback) { DSFirebaseAuth.setAuthCallback(callback); }
    
    /**
     * Set callback for data load
     */
    function setDataLoadCallback(callback) {
        onDataLoadCallback = callback;
    }

    function setAllianceDataCallback(callback) {
        onAllianceDataCallback = callback;
    }

    function emitAllianceDataUpdate() {
        if (typeof onAllianceDataCallback === 'function') {
            onAllianceDataCallback(allianceData);
        }
    }

    function stopAllianceDocListener() {
        if (typeof allianceDocUnsubscribe === 'function') {
            allianceDocUnsubscribe();
        }
        allianceDocUnsubscribe = null;
    }

    function startAllianceDocListener(gameId, options) {
        stopAllianceDocListener();
        if (!db || !currentUser || !allianceId) {
            return;
        }

        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        const currentAllianceId = allianceId;
        const requestedScopeRaw = options && options.scope === 'legacy' ? 'legacy' : 'game';
        const requestedScope = (requestedScopeRaw === 'legacy' && isLegacyFallbackAllowed()) ? 'legacy' : 'game';
        const allianceRef = options && options.ref
            ? options.ref
            : (
                requestedScope === 'legacy'
                    ? getLegacyAllianceDocRef(currentAllianceId)
                    : getGameAllianceDocRef(normalizedGameId, currentAllianceId)
            );
        if (!allianceRef) {
            return;
        }
        activeAllianceDocScope = requestedScope;
        allianceDocUnsubscribe = allianceRef.onSnapshot((doc) => {
            if (
                !currentUser
                || allianceId !== currentAllianceId
                || activeAllianceGameId !== normalizedGameId
                || activeAllianceDocScope !== requestedScope
            ) {
                return;
            }

            if (!doc.exists) {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                activeAllianceDocScope = 'game';
                if (playerSource === 'alliance') {
                    playerSource = 'personal';
                }
                stopAllianceDocListener();
                persistUserGameAssociationState(normalizedGameId, {
                    allianceId: null,
                    allianceName: null,
                    playerSource: 'personal',
                }).catch((error) => {
                    console.warn('Failed to persist alliance reset after doc removal:', error);
                });
                emitAllianceDataUpdate();
                return;
            }

            const data = doc.data() || {};
            if (requestedScope === 'game' && normalizeGameId(data.gameId) && normalizeGameId(data.gameId) !== normalizedGameId) {
                incrementObservabilityCounter('invitationContextMismatchCount', 1);
                return;
            }
            if (!data.members || !data.members[currentUser.uid]) {
                allianceId = null;
                allianceName = null;
                allianceData = null;
                activeAllianceDocScope = 'game';
                if (playerSource === 'alliance') {
                    playerSource = 'personal';
                }
                stopAllianceDocListener();
                persistUserGameAssociationState(normalizedGameId, {
                    allianceId: null,
                    allianceName: null,
                    playerSource: 'personal',
                }).catch((error) => {
                    console.warn('Failed to persist alliance reset after membership loss:', error);
                });
                emitAllianceDataUpdate();
                return;
            }

            allianceData = {
                ...data,
                playerDatabase: {},
            };
            activeAllianceDocScope = requestedScope;
            if (typeof data.name === 'string' && data.name.trim()) {
                allianceName = data.name.trim();
            }
            emitAllianceDataUpdate();

            // Keep alliance roster sourced strictly from alliance_players subcollection.
            try {
                const alliancePlayersRef = getAlliancePlayersCollectionRef(normalizedGameId, currentAllianceId);
                if (alliancePlayersRef) {
                    alliancePlayersRef.get().then((apSnapshot) => {
                        if (
                            !currentUser
                            || allianceId !== currentAllianceId
                            || activeAllianceGameId !== normalizedGameId
                            || activeAllianceDocScope !== requestedScope
                            || !allianceData
                        ) {
                            return;
                        }
                        const subcollectionPlayers = {};
                        if (apSnapshot && Array.isArray(apSnapshot.docs)) {
                            apSnapshot.docs.forEach((playerDoc) => {
                                const playerData = playerDoc.data() || {};
                                const playerName = normalizeEditablePlayerName(playerData.name || '');
                                if (!playerName) {
                                    return;
                                }
                                subcollectionPlayers[playerName] = {
                                    power: normalizeEditablePlayerPower(playerData.power),
                                    troops: normalizeEditablePlayerTroops(playerData.troops),
                                    thp: normalizeEditablePlayerThp(playerData.thp),
                                    lastUpdated: typeof playerData.lastUpdated === 'string'
                                        ? playerData.lastUpdated
                                        : new Date().toISOString(),
                                };
                            });
                        }
                        allianceData = {
                            ...allianceData,
                            playerDatabase: normalizePlayerDatabaseMap(subcollectionPlayers),
                        };
                        emitAllianceDataUpdate();
                    }).catch((apError) => {
                        console.warn('⚠️ Alliance players subcollection listener refresh failed:', apError.message);
                        if (
                            !currentUser
                            || allianceId !== currentAllianceId
                            || activeAllianceGameId !== normalizedGameId
                            || activeAllianceDocScope !== requestedScope
                            || !allianceData
                        ) {
                            return;
                        }
                        allianceData = {
                            ...allianceData,
                            playerDatabase: {},
                        };
                        emitAllianceDataUpdate();
                    });
                }
            } catch (apRefError) {
                console.warn('⚠️ Alliance players subcollection ref build failed:', apRefError.message);
            }
        }, (error) => {
            console.warn('Alliance listener error:', error);
        });
    }
    
    
    function isPasswordProvider(user) { return DSFirebaseAuth.isPasswordProvider(user); }

    // ============================================================
    // AUTHENTICATION FUNCTIONS (delegated to DSFirebaseAuth)
    // ============================================================
    function signInWithGoogle() { return DSFirebaseAuth.signInWithGoogle(); }
    function signInWithEmail(email, password) { return DSFirebaseAuth.signInWithEmail(email, password); }
    function signUpWithEmail(email, password) { return DSFirebaseAuth.signUpWithEmail(email, password); }
    function resetPassword(email) { return DSFirebaseAuth.resetPassword(email); }
    function signOut() { return DSFirebaseAuth.signOut(); }
    function isReauthRequiredError(error) { return DSFirebaseAuth.isReauthRequiredError(error); }

    async function deleteDocsByRefs(refs) {
        if (!Array.isArray(refs) || refs.length === 0) {
            return;
        }
        const chunkSize = 400;
        for (let i = 0; i < refs.length; i += chunkSize) {
            const chunk = refs.slice(i, i + chunkSize);
            const batch = db.batch();
            chunk.forEach((ref) => {
                batch.delete(ref);
            });
            await batch.commit();
        }
    }

    async function collectInvitationRefs(uid, emailLower) {
        const refMap = new Map();
        const strictMode = isStrictModeEnabled();
        if (!db) {
            return [];
        }
        const addRefsFromSnapshot = (snapshot) => {
            snapshot.docs.forEach((doc) => refMap.set(doc.ref.path, doc.ref));
        };
        const safeQuery = async (fn) => {
            try {
                const snapshot = await fn();
                addRefsFromSnapshot(snapshot);
            } catch (error) {
                console.warn('Invitation cleanup query skipped:', error.message || error);
            }
        };
        if (uid) {
            if (!strictMode) {
                await safeQuery(() => db.collection('invitations')
                    .where('invitedBy', '==', uid)
                    .get());
            }
            // Query game-scoped invitations (now under alliances/{allianceId}/invitations/)
            if (typeof db.collectionGroup === 'function') {
                await safeQuery(() => db.collectionGroup(GAME_INVITATIONS_SUBCOLLECTION)
                    .where('invitedBy', '==', uid)
                    .get());
            }
        }
        if (emailLower) {
            if (!strictMode) {
                await safeQuery(() => db.collection('invitations')
                    .where('invitedEmail', '==', emailLower)
                    .get());
            }
            if (typeof db.collectionGroup === 'function') {
                await safeQuery(() => db.collectionGroup(GAME_INVITATIONS_SUBCOLLECTION)
                    .where('invitedEmail', '==', emailLower)
                    .get());
            }
        }
        return Array.from(refMap.values());
    }

    async function cleanupAllianceMembership(uid, emailLower) {
        if (!allianceId || !uid) {
            return;
        }
        try {
            const allianceRef = getGameAllianceDocRef(activeAllianceGameId, allianceId);
            if (!allianceRef) {
                return;
            }
            const snap = await allianceRef.get();
            if (!snap.exists) {
                return;
            }
            const data = snap.data() || {};
            const members = data.members && typeof data.members === 'object' ? data.members : {};
            const memberIds = Object.keys(members);
            const onlyCurrentMember = memberIds.length === 1 && memberIds[0] === uid;
            if (onlyCurrentMember && data.createdBy === uid) {
                await allianceRef.delete();
                return;
            }
            const memberPath = `members.${uid}`;
            await allianceRef.update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });
        } catch (error) {
            console.warn('Failed to clean alliance membership during account deletion:', error.message || error);
        }
    }

    async function deleteUserAccountAndData() {
        const authUser = (auth && auth.currentUser) || currentUser;
        if (!authUser) {
            return { success: false, error: 'No user signed in' };
        }

        const uid = authUser.uid;
        const email = authUser.email || '';
        const emailLower = email ? email.toLowerCase() : '';
        const dataDeletionErrors = [];

        try {
            await cleanupAllianceMembership(uid, emailLower);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const invitationRefs = await collectInvitationRefs(uid, emailLower);
            await deleteDocsByRefs(invitationRefs);
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        try {
            const userDocIds = Array.from(new Set([uid, email, emailLower].filter(Boolean)));
            for (const docId of userDocIds) {
                try {
                    await db.collection('users').doc(docId).delete();
                } catch (error) {
                    if (docId === uid) {
                        throw error;
                    }
                    console.warn(`Skipping optional user doc delete (${docId}):`, error.message || error);
                }
            }
        } catch (error) {
            dataDeletionErrors.push(error);
        }

        playerDatabase = {};
        eventData = ensureLegacyEventEntriesWithDefaults(createEmptyEventData()).events;
        stopAllianceDocListener();
        allianceId = null;
        allianceName = null;
        allianceData = null;
        activeGameplayGameId = DEFAULT_GAME_ID;
        activeAllianceGameId = DEFAULT_GAME_ID;
        playerSource = 'personal';
        pendingInvitations = [];
        sentInvitations = [];
        invitationNotifications = [];
        userProfile = normalizeUserProfile(null);
        setGlobalDefaultPositions(emptyGlobalEventPositions(), 0);
        setGlobalDefaultBuildingConfig(emptyGlobalBuildingConfig(), 0);
        migrationVersion = 0;
        migratedToGameSubcollectionsAt = null;
        resetSaveState();

        try {
            await authUser.delete();
            return { success: dataDeletionErrors.length === 0, dataDeleted: true, accountDeleted: true };
        } catch (error) {
            if (isReauthRequiredError(error)) {
                try {
                    await auth.signOut();
                } catch (signOutError) {
                    console.warn('Failed to sign out after reauth-required delete:', signOutError.message || signOutError);
                }
                return {
                    success: false,
                    dataDeleted: true,
                    accountDeleted: false,
                    reauthRequired: true,
                    error: error.message,
                };
            }
            return {
                success: false,
                dataDeleted: dataDeletionErrors.length === 0,
                accountDeleted: false,
                error: error.message,
            };
        }
    }
    
    function getCurrentUser() { return DSFirebaseAuth.getCurrentUser(); }
    function isSignedIn() { return DSFirebaseAuth.isSignedIn(); }
    
    // ============================================================
    // DATABASE FUNCTIONS
    // ============================================================
    
    /**
     * Load user data from Firestore
     */
    async function loadUserData(user, context) {
        const gameId = getResolvedGameId('loadUserData', context);
        const strictMode = isStrictModeEnabled(context);
        const loadRequestId = ++activeUserDataLoadRequestId;
        const isStaleLoad = () => loadRequestId !== activeUserDataLoadRequestId;
        try {
            console.log('Loading data for UID:', user.uid);
            activeGameplayGameId = gameId;
            const userDocRef = db.collection('users').doc(user.uid);
            const gameDocRef = getUserGameDocRef(user.uid, gameId);
            const gameRead = await getDocWithPermissionTolerantFallback(gameDocRef, { label: 'game-scoped profile' });
            const gameScopedData = gameRead.exists ? gameRead.data : null;
            const legacyRead = await getDocWithPermissionTolerantFallback(userDocRef, { label: 'legacy user profile' });
            const legacyUserData = legacyRead.exists ? legacyRead.data : null;
            const readDenied = gameRead.permissionDenied === true;
            const resolvedRead = resolveGameScopedReadPayload({
                gameId: gameId,
                gameData: gameScopedData,
                legacyData: legacyUserData,
                allowLegacyFallback: isLegacyFallbackAllowed(context),
            });
            if (isStaleLoad()) {
                return { success: true, stale: true };
            }
            if (resolvedRead.usedLegacyFallback) {
                incrementObservabilityCounter('fallbackReadHitCount', 1);
                console.log(`↩️ Using legacy user data fallback for game "${gameId}"`);
            }
            if (readDenied && !resolvedRead.data) {
                if (isStaleLoad()) {
                    return { success: true, stale: true };
                }
                if (strictMode) {
                    const strictErrorMessage = `MULTIGAME_STRICT_MODE: game-scoped profile unavailable for users/${user.uid}/games/${gameId}`;
                    console.error(`❌ ${strictErrorMessage}`);
                    return {
                        success: false,
                        strictMode: true,
                        errorKey: 'strict_mode_game_profile_unavailable',
                        error: strictErrorMessage,
                    };
                }
                console.warn('⚠️ Firestore rules denied game-scoped profile read; continuing with local defaults for this session.');
                applyPermissionDeniedLoadFallbackState();
                activeGameplayGameId = gameId;
                activeAllianceGameId = gameId;
                if (onDataLoadCallback) {
                    onDataLoadCallback(playerDatabase);
                }
                return {
                    success: true,
                    data: playerDatabase,
                    playerCount: 0,
                    limitedByPermissions: true,
                };
            }
            updateMigrationMarkersFromUserData(gameScopedData || legacyUserData);

            if (resolvedRead.data) {
                const data = resolvedRead.data;
                const [playersSubcollectionRead, eventsSubcollectionRead] = await Promise.all([
                    loadGameScopedPlayersFromSubcollection(user.uid, gameId),
                    loadGameScopedEventsFromSubcollection(user.uid, gameId),
                ]);
                if (isStaleLoad()) {
                    return { success: true, stale: true };
                }
                let shouldPersistLegacyDefaults = false;
                let rawPlayerDatabase = playersSubcollectionRead.hasData
                    ? playersSubcollectionRead.data
                    : (data.playerDatabase && typeof data.playerDatabase === 'object'
                        ? data.playerDatabase
                        : {});
                if (!playersSubcollectionRead.hasData) {
                    const gameScopedPlayerCount = rawPlayerDatabase && typeof rawPlayerDatabase === 'object'
                        ? Object.keys(rawPlayerDatabase).length
                        : 0;
                    if (gameScopedPlayerCount === 0 && isLegacyFallbackAllowed(context)) {
                        const legacyPlayerFallback = extractLegacyPlayerDatabaseFallback(legacyUserData, gameId);
                        if (legacyPlayerFallback && typeof legacyPlayerFallback === 'object' && Object.keys(legacyPlayerFallback).length > 0) {
                            rawPlayerDatabase = legacyPlayerFallback;
                            console.log(`↩️ Recovered player database from legacy payload for game "${gameId}"`);
                        }
                    }
                }
                const normalizedPlayerDatabase = normalizePlayerDatabaseMap(rawPlayerDatabase);
                playerDatabase = normalizedPlayerDatabase;
                let shouldPersistNormalizedPlayerDatabase = !areJsonEqual(rawPlayerDatabase, normalizedPlayerDatabase)
                    || !playersSubcollectionRead.hasData;
                let shouldPersistNormalizedPlayerSource = false;
                allianceId = data.allianceId || null;
                allianceName = data.allianceName || null;
                activeAllianceGameId = gameId;
                playerSource = data.playerSource === 'alliance' ? 'alliance' : 'personal';
                if (playerSource === 'alliance' && !allianceId) {
                    playerSource = 'personal';
                    shouldPersistNormalizedPlayerSource = true;
                }
                userProfile = normalizeUserProfile(data.userProfile || data.profile || null);

                if (
                    resolvedRead.source === 'game'
                    && (migrationVersion < GAME_SUBCOLLECTION_MIGRATION_VERSION || !migratedToGameSubcollectionsAt)
                ) {
                    try {
                        await userDocRef.set({
                            migrationVersion: GAME_SUBCOLLECTION_MIGRATION_VERSION,
                            migratedToGameSubcollectionsAt: firebase.firestore.FieldValue.serverTimestamp(),
                            lastActiveGameId: gameId,
                        }, { merge: true });
                        migrationVersion = GAME_SUBCOLLECTION_MIGRATION_VERSION;
                        migratedToGameSubcollectionsAt = new Date().toISOString();
                    } catch (markerErr) {
                        console.warn('⚠️ Failed to persist game-subcollection migration markers:', markerErr);
                    }
                }

                // Load per-event building data
                if (eventsSubcollectionRead.hasData) {
                    eventData = ensureLegacyEventEntries(eventsSubcollectionRead.data);
                } else if (data.events && typeof data.events === 'object') {
                    eventData = ensureLegacyEventEntries(normalizeEventsMap(data.events));
                } else if (
                    Array.isArray(data.buildingConfig)
                    || (data.buildingPositions && typeof data.buildingPositions === 'object')
                    || typeof data.buildingConfigVersion === 'number'
                ) {
                    // Migration: old top-level fields → move to events.desert_storm
                    console.log('🔄 Migrating old building data to per-event schema...');
                    eventData = ensureLegacyEventEntries(createEmptyEventData());
                    eventData.desert_storm = sanitizeEventEntry('desert_storm', {
                        name: getDefaultEventName('desert_storm'),
                        buildingConfig: Array.isArray(data.buildingConfig) ? data.buildingConfig : null,
                        buildingConfigVersion: typeof data.buildingConfigVersion === 'number' ? data.buildingConfigVersion : 0,
                        buildingPositions: data.buildingPositions && typeof data.buildingPositions === 'object' ? data.buildingPositions : null,
                        buildingPositionsVersion: typeof data.buildingPositionsVersion === 'number' ? data.buildingPositionsVersion : 0
                    }, eventData.desert_storm);
                    // Save migrated data and remove old top-level fields
                    try {
                        const batch = db.batch();
                        if (gameDocRef) {
                            batch.set(gameDocRef, {
                                events: buildEventsWithoutMedia(eventData),
                            }, { merge: true });
                        }
                        if (gameId === DEFAULT_GAME_ID) {
                            batch.update(userDocRef, {
                                buildingConfig: firebase.firestore.FieldValue.delete(),
                                buildingConfigVersion: firebase.firestore.FieldValue.delete(),
                                buildingPositions: firebase.firestore.FieldValue.delete(),
                                buildingPositionsVersion: firebase.firestore.FieldValue.delete(),
                            });
                        }
                        await batch.commit();
                        console.log('✅ Migration complete');
                    } catch (migErr) {
                        console.warn('⚠️ Migration save failed (will retry next load):', migErr);
                    }
                } else {
                    // Existing doc with no event config: bootstrap legacy defaults once.
                    const ensuredLegacy = ensureLegacyEventEntriesWithDefaults(createEmptyEventData());
                    eventData = ensuredLegacy.events;
                    shouldPersistLegacyDefaults = ensuredLegacy.changed;
                }

                const inlineMedia = getEventMediaMap(eventData);
                const storedMedia = await loadEventMediaForUser(user.uid, gameId);
                const mergedMedia = Object.assign({}, inlineMedia, storedMedia);
                eventData = buildEventsWithoutMedia(eventData);
                applyEventMediaToEvents(mergedMedia);

                if (Object.keys(inlineMedia).length > 0) {
                    shouldPersistLegacyDefaults = true;
                    try {
                        await saveEventMediaDiff(user.uid, gameId, storedMedia, mergedMedia);
                        console.log('✅ Migrated inline event media to subcollection docs');
                    } catch (mediaErr) {
                        console.warn('⚠️ Failed to migrate inline event media:', mediaErr);
                    }
                }

                if (!playersSubcollectionRead.hasData) {
                    try {
                        await persistGameScopedPlayersSubcollection(user.uid, gameId, playerDatabase);
                    } catch (playersMigrationErr) {
                        console.warn('⚠️ Failed to migrate players map into players subcollection:', playersMigrationErr);
                    }
                }
                if (!eventsSubcollectionRead.hasData) {
                    try {
                        await persistGameScopedEventsSubcollection(user.uid, gameId, eventData);
                    } catch (eventsMigrationErr) {
                        console.warn('⚠️ Failed to migrate events map into events subcollection:', eventsMigrationErr);
                    }
                }

                if (shouldPersistLegacyDefaults) {
                    try {
                        await gameDocRef.set({
                            events: buildEventsWithoutMedia(eventData),
                        }, { merge: true });
                        console.log('✅ Bootstrap default events saved for user');
                    } catch (defaultErr) {
                        console.warn('⚠️ Failed to persist legacy default events:', defaultErr);
                    }
                }
                if (shouldPersistNormalizedPlayerDatabase) {
                    try {
                        await gameDocRef.set({
                            playerDatabase: playerDatabase,
                        }, { merge: true });
                        console.log('✅ Player database normalized and saved for user');
                    } catch (normalizeErr) {
                        console.warn('⚠️ Failed to persist normalized player database:', normalizeErr);
                    }
                }
                if (shouldPersistNormalizedPlayerSource) {
                    try {
                        await persistUserGameAssociationState(gameId, {
                            playerSource: playerSource,
                        });
                        console.log('✅ Player source normalized and saved for user');
                    } catch (sourceErr) {
                        console.warn('⚠️ Failed to persist normalized player source:', sourceErr);
                    }
                }

                console.log(`✅ Loaded ${Object.keys(playerDatabase).length} players`);

                if (allianceId) {
                    await loadAllianceData({ gameId: gameId });
                }
                await checkInvitations({ gameId: gameId });
                rememberLastSavedUserState();

                if (onDataLoadCallback) {
                    if (isStaleLoad()) {
                        return { success: true, stale: true };
                    }
                    onDataLoadCallback(playerDatabase);
                }

                return {
                    success: true,
                    data: playerDatabase,
                    playerCount: Object.keys(playerDatabase).length
                };
            } else {
                if (isStaleLoad()) {
                    return { success: true, stale: true };
                }
                console.log('ℹ️ No existing data found');
                playerDatabase = {};
                eventData = ensureLegacyEventEntriesWithDefaults(createEmptyEventData()).events;
                allianceId = null;
                allianceName = null;
                activeAllianceGameId = gameId;
                playerSource = 'personal';
                userProfile = normalizeUserProfile(null);
                migrationVersion = 0;
                migratedToGameSubcollectionsAt = null;
                await loadGlobalDefaultBuildingPositions();
                await loadGlobalDefaultBuildingConfig();
                applyGlobalDefaultBuildingConfigToEventData({
                    eventIds: LEGACY_EVENT_IDS,
                    overwriteExisting: true,
                });
                await checkInvitations({ gameId: gameId });
                rememberLastSavedUserState();
                return { success: true, data: {}, playerCount: 0 };
            }
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                if (isStaleLoad()) {
                    return { success: true, stale: true };
                }
                if (strictMode) {
                    const strictErrorMessage = `MULTIGAME_STRICT_MODE: permission denied while loading users/${user.uid}/games/${gameId}`;
                    console.error(`❌ ${strictErrorMessage}`);
                    return {
                        success: false,
                        strictMode: true,
                        errorKey: 'strict_mode_game_profile_permission_denied',
                        error: strictErrorMessage,
                    };
                }
                console.warn('⚠️ Firestore rules denied user data read; continuing with local defaults for this session.');
                applyPermissionDeniedLoadFallbackState();
                activeGameplayGameId = gameId;
                activeAllianceGameId = gameId;
                if (onDataLoadCallback) {
                    onDataLoadCallback(playerDatabase);
                }
                return {
                    success: true,
                    data: playerDatabase,
                    playerCount: 0,
                    limitedByPermissions: true,
                };
            }
            console.error('❌ Failed to load data:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Save user data to Firestore
     */
    async function persistChangedUserData(context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }
        const gameId = getResolvedGameId('persistChangedUserData', context);

        const currentState = getCurrentPersistedUserState();
        const stateDiff = getUserStateDiff(lastSavedUserState, currentState);
        const changedFields = stateDiff.changedFields;
        const mediaChanged = stateDiff.mediaChanged;

        if (changedFields.length === 0 && !mediaChanged) {
            return { success: true, skipped: true };
        }

        try {
            console.log(`💾 Saving data (${changedFields.join(', ')})...`);
            const primaryWriteResult = await persistGameScopedPrimaryWrite(currentState, changedFields, { gameId: gameId });
            if (!primaryWriteResult.success) {
                throw new Error(`Primary game write failed: ${primaryWriteResult.error || 'unknown'}`);
            }

            if (changedFields.includes('playerDatabase')) {
                await persistGameScopedPlayersSubcollection(currentUser.uid, gameId, currentState.playerDatabase);
            }
            if (changedFields.includes('events')) {
                await persistGameScopedEventsSubcollection(currentUser.uid, gameId, currentState.events);
            }

            if (mediaChanged) {
                const previousMedia = lastSavedUserState && lastSavedUserState.eventMedia ? lastSavedUserState.eventMedia : {};
                await saveEventMediaDiff(currentUser.uid, gameId, previousMedia, currentState.eventMedia);
            }
            rememberLastSavedUserState(currentState);
            return { success: true, changedFields };
        } catch (error) {
            console.error('❌ Failed to save data:', error);
            return { success: false, error: error.message };
        }
    }

    async function flushQueuedSave() {
        if (!pendingSavePromise) {
            return;
        }
        saveDebounceTimer = null;
        const resolve = pendingSaveResolve;
        const context = pendingSaveContext;
        pendingSaveResolve = null;
        pendingSaveContext = null;
        const result = await persistChangedUserData(context);
        pendingSavePromise = null;
        if (typeof resolve === 'function') {
            resolve(result);
        }
    }

    async function saveUserData(options, context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const gameContext = resolveGameplayContext('saveUserData', context);
        const immediate = !!(options && options.immediate === true);

        if (!pendingSavePromise) {
            pendingSavePromise = new Promise((resolve) => {
                pendingSaveResolve = resolve;
            });
            pendingSaveContext = gameContext;
        } else if (
            gameContext
            && pendingSaveContext
            && pendingSaveContext.gameId
            && gameContext.gameId
            && pendingSaveContext.gameId !== gameContext.gameId
        ) {
            if (saveDebounceTimer) {
                clearTimeout(saveDebounceTimer);
                saveDebounceTimer = null;
            }
            await flushQueuedSave();
            pendingSavePromise = new Promise((resolve) => {
                pendingSaveResolve = resolve;
            });
            pendingSaveContext = gameContext;
        } else {
            pendingSaveContext = gameContext;
        }

        if (immediate) {
            if (saveDebounceTimer) {
                clearTimeout(saveDebounceTimer);
                saveDebounceTimer = null;
            }
            flushQueuedSave();
        } else if (!saveDebounceTimer) {
            saveDebounceTimer = setTimeout(flushQueuedSave, SAVE_DEBOUNCE_MS);
        }

        return pendingSavePromise;
    }
    
    /**
     * Upload player database from Excel
     */
    async function uploadPlayerDatabase(file, context) {
        const gameId = getResolvedGameId('uploadPlayerDatabase', context);
        const importSchema = getPlayerImportSchema(gameId);
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});

                    const parsed = parseWorkbookPlayers(workbook, importSchema);
                    if (!parsed.success) {
                        reject(parsed);
                        return;
                    }
                    const nextDatabase = parsed.nextDatabase;
                    const skippedCount = parsed.skippedCount;
                    const skippedPlayers = parsed.skippedPlayers;

                    const addedCount = Object.keys(nextDatabase).length;
                    if (addedCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }

                    // Replace existing database with parsed data.
                    playerDatabase = nextDatabase;
                    
                    // Save to Firestore
                    const saveResult = await saveUserData(undefined, { gameId: gameId });
                    
                    if (saveResult.success) {
                        console.log(`✅ Uploaded ${addedCount} players`);
                        if (skippedCount > 0) {
                            console.warn(`⚠️ Skipped ${skippedCount} rows with no player name:`, skippedPlayers);
                        }
                        
                        let message = `✅ ${addedCount} players stored in cloud`;
                        if (skippedCount > 0) {
                            message += ` (${skippedCount} skipped - missing name)`;
                        }
                        
                        resolve({ 
                            success: true, 
                            playerCount: addedCount,
                            skippedCount: skippedCount,
                            message: message
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to process Excel file:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Get player database
     */
    function getPlayerDatabase(context) {
        const gameId = getResolvedGameId('getPlayerDatabase', context);
        if (!isActiveGameplayGameId(gameId)) {
            return {};
        }
        return normalizePlayerDatabaseMap(playerDatabase);
    }

    function resolveEventId(eventId) {
        const normalized = normalizeEventId(eventId || '');
        return normalized || 'desert_storm';
    }

    function ensureEventEntry(eventId, seed) {
        const eid = resolveEventId(eventId);
        if (!eventData[eid]) {
            eventData[eid] = sanitizeEventEntry(eid, seed || {}, createEmptyEventEntry({ name: getDefaultEventName(eid) }));
        } else if (!eventData[eid].name) {
            eventData[eid].name = getDefaultEventName(eid);
        }
        return eid;
    }

    function getAllEventData(context) {
        const gameId = getResolvedGameId('getAllEventData', context);
        if (!isActiveGameplayGameId(gameId)) {
            return {};
        }
        return JSON.parse(JSON.stringify(eventData));
    }

    function getEventIds(context) {
        const gameId = getResolvedGameId('getEventIds', context);
        if (!isActiveGameplayGameId(gameId)) {
            return [];
        }
        return Object.keys(eventData);
    }

    function getEventMeta(eventId, context) {
        const gameId = getResolvedGameId('getEventMeta', context);
        if (!isActiveGameplayGameId(gameId)) {
            return null;
        }
        const eid = resolveEventId(eventId);
        const entry = eventData[eid];
        if (!entry) {
            return null;
        }
        return {
            id: eid,
            name: entry.name || getDefaultEventName(eid),
            logoDataUrl: entry.logoDataUrl || '',
            mapDataUrl: entry.mapDataUrl || '',
            assignmentAlgorithmId: normalizeAssignmentAlgorithmId(entry.assignmentAlgorithmId),
        };
    }

    function upsertEvent(eventId, payload, context) {
        const gameId = getResolvedGameId('upsertEvent', context);
        if (!isActiveGameplayGameId(gameId)) {
            return null;
        }
        const requestedId = resolveEventId(eventId || (payload && payload.id) || (payload && payload.name));
        const existing = eventData[requestedId] || createEmptyEventEntry({ name: getDefaultEventName(requestedId) });
        const sanitized = sanitizeEventEntry(requestedId, payload || {}, existing);
        eventData[requestedId] = sanitized;
        return getEventMeta(requestedId, { gameId: gameId });
    }

    function removeEvent(eventId, context) {
        const gameId = getResolvedGameId('removeEvent', context);
        if (!isActiveGameplayGameId(gameId)) {
            return false;
        }
        const eid = resolveEventId(eventId);
        if (LEGACY_EVENT_IDS.includes(eid)) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(eventData, eid)) {
            return false;
        }
        delete eventData[eid];
        return true;
    }

    /**
     * Get building configuration for an event
     */
    function getBuildingConfig(eventId, context) {
        const gameId = getResolvedGameId('getBuildingConfig', context);
        if (!isActiveGameplayGameId(gameId)) {
            return null;
        }
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingConfig : null;
    }

    /**
     * Set building configuration for an event
     */
    function setBuildingConfig(eventId, config, context) {
        const gameId = getResolvedGameId('setBuildingConfig', context);
        if (!isActiveGameplayGameId(gameId)) {
            return;
        }
        const eid = ensureEventEntry(eventId);
        eventData[eid].buildingConfig = normalizeBuildingConfigArray(config);
    }

    function getBuildingConfigVersion(eventId, context) {
        const gameId = getResolvedGameId('getBuildingConfigVersion', context);
        if (!isActiveGameplayGameId(gameId)) {
            return 0;
        }
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingConfigVersion : 0;
    }

    function setBuildingConfigVersion(eventId, version, context) {
        const gameId = getResolvedGameId('setBuildingConfigVersion', context);
        if (!isActiveGameplayGameId(gameId)) {
            return;
        }
        const eid = ensureEventEntry(eventId);
        const numeric = Number(version);
        eventData[eid].buildingConfigVersion = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
    }

    /**
     * Get building positions for an event
     */
    function getBuildingPositions(eventId, context) {
        const gameId = getResolvedGameId('getBuildingPositions', context);
        if (!isActiveGameplayGameId(gameId)) {
            return null;
        }
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingPositions : null;
    }

    /**
     * Set building positions for an event
     */
    function setBuildingPositions(eventId, positions, context) {
        const gameId = getResolvedGameId('setBuildingPositions', context);
        if (!isActiveGameplayGameId(gameId)) {
            return;
        }
        const eid = ensureEventEntry(eventId);
        eventData[eid].buildingPositions = normalizePositionsMap(positions);
    }

    function getBuildingPositionsVersion(eventId, context) {
        const gameId = getResolvedGameId('getBuildingPositionsVersion', context);
        if (!isActiveGameplayGameId(gameId)) {
            return 0;
        }
        const eid = ensureEventEntry(eventId);
        return eventData[eid] ? eventData[eid].buildingPositionsVersion : 0;
    }

    function setBuildingPositionsVersion(eventId, version, context) {
        const gameId = getResolvedGameId('setBuildingPositionsVersion', context);
        if (!isActiveGameplayGameId(gameId)) {
            return;
        }
        const eid = ensureEventEntry(eventId);
        const numeric = Number(version);
        eventData[eid].buildingPositionsVersion = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
    }

    function setEventMetadata(eventId, metadata, context) {
        const gameId = getResolvedGameId('setEventMetadata', context);
        if (!isActiveGameplayGameId(gameId)) {
            return null;
        }
        const eid = ensureEventEntry(eventId, metadata);
        const source = metadata && typeof metadata === 'object' ? metadata : {};
        const current = eventData[eid] || createEmptyEventEntry({ name: getDefaultEventName(eid) });
        eventData[eid] = sanitizeEventEntry(eid, {
            name: Object.prototype.hasOwnProperty.call(source, 'name') ? source.name : current.name,
            logoDataUrl: Object.prototype.hasOwnProperty.call(source, 'logoDataUrl') ? source.logoDataUrl : current.logoDataUrl,
            mapDataUrl: Object.prototype.hasOwnProperty.call(source, 'mapDataUrl') ? source.mapDataUrl : current.mapDataUrl,
            assignmentAlgorithmId: Object.prototype.hasOwnProperty.call(source, 'assignmentAlgorithmId')
                ? source.assignmentAlgorithmId
                : current.assignmentAlgorithmId,
            buildingConfig: current.buildingConfig,
            buildingConfigVersion: current.buildingConfigVersion,
            buildingPositions: current.buildingPositions,
            buildingPositionsVersion: current.buildingPositionsVersion,
        }, current);
        return getEventMeta(eid, { gameId: gameId });
    }

    /**
     * Get player count
     */
    function getPlayerCount() {
        return Object.keys(playerDatabase).length;
    }
    
    /**
     * Get player by name
     */
    function getPlayer(name) {
        return playerDatabase[name] || null;
    }

    function normalizeEditablePlayerName(name) {
        return typeof name === 'string' ? name.trim() : '';
    }

    function normalizeEditablePlayerPower(power) {
        const parsed = Number(power);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return parsed;
    }

    function normalizeEditablePlayerTroops(troops) {
        const value = typeof troops === 'string' ? troops.trim() : '';
        if (value === 'Tank' || value === 'Aero' || value === 'Missile') {
            return value;
        }
        return 'Unknown';
    }

    function normalizeEditablePlayerThp(thp) {
        const parsed = Number(thp);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return parsed;
    }

    function getPlayerRowPowerValue(row) {
        if (!row || typeof row !== 'object') {
            return 0;
        }
        if (Object.prototype.hasOwnProperty.call(row, PLAYER_POWER_HEADER)) {
            return row[PLAYER_POWER_HEADER];
        }
        for (let index = 0; index < LEGACY_PLAYER_POWER_HEADERS.length; index += 1) {
            const legacyHeader = LEGACY_PLAYER_POWER_HEADERS[index];
            if (Object.prototype.hasOwnProperty.call(row, legacyHeader)) {
                return row[legacyHeader];
            }
        }
        return 0;
    }

    function normalizePlayerDatabaseMap(database) {
        if (!database || typeof database !== 'object') {
            return {};
        }
        const normalized = {};
        Object.keys(database).forEach((rawName) => {
            const name = normalizeEditablePlayerName(rawName);
            if (!name) {
                return;
            }
            const entry = database[rawName] && typeof database[rawName] === 'object' ? database[rawName] : {};
            normalized[name] = {
                ...entry,
                power: normalizeEditablePlayerPower(entry.power),
                troops: normalizeEditablePlayerTroops(entry.troops),
                thp: normalizeEditablePlayerThp(
                    entry.thp ?? entry.totalHeroPower ?? entry['Total Hero Power'] ?? entry.THP
                ),
            };
        });
        return normalized;
    }

    function createPlayerDocPayload(playerName, entry) {
        const name = normalizeEditablePlayerName(playerName);
        if (!name) {
            return null;
        }
        const source = entry && typeof entry === 'object' ? entry : {};
        return {
            name: name,
            power: normalizeEditablePlayerPower(source.power),
            troops: normalizeEditablePlayerTroops(source.troops),
            thp: normalizeEditablePlayerThp(source.thp),
            lastUpdated: typeof source.lastUpdated === 'string' ? source.lastUpdated : new Date().toISOString(),
            metadata: {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
        };
    }

    function createEventDocPayload(eventId, entry) {
        const eid = resolveEventId(eventId);
        const sanitized = sanitizeEventEntry(eid, entry || {}, createEmptyEventEntry({ name: getDefaultEventName(eid) }));
        return {
            id: eid,
            name: sanitized.name || getDefaultEventName(eid),
            logoDataUrl: sanitized.logoDataUrl || '',
            mapDataUrl: sanitized.mapDataUrl || '',
            assignmentAlgorithmId: normalizeAssignmentAlgorithmId(sanitized.assignmentAlgorithmId),
            buildingConfig: Array.isArray(sanitized.buildingConfig) ? sanitized.buildingConfig : [],
            buildingConfigVersion: Number.isFinite(Number(sanitized.buildingConfigVersion))
                ? Number(sanitized.buildingConfigVersion)
                : 0,
            buildingPositions: sanitized.buildingPositions && typeof sanitized.buildingPositions === 'object'
                ? sanitized.buildingPositions
                : {},
            buildingPositionsVersion: Number.isFinite(Number(sanitized.buildingPositionsVersion))
                ? Number(sanitized.buildingPositionsVersion)
                : 0,
            metadata: {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            },
        };
    }

    async function loadGameScopedPlayersFromSubcollection(userId, gameId) {
        // Try new game-centric path first
        const newPlayersCollection = getSoloplayerPlayersCollectionRef(gameId, userId);
        if (newPlayersCollection) {
            try {
                const newSnapshot = await newPlayersCollection.get();
                if (newSnapshot && !newSnapshot.empty) {
                    const nextDatabase = {};
                    newSnapshot.docs.forEach((doc) => {
                        const data = doc.data() || {};
                        const playerName = normalizeEditablePlayerName(data.name || '');
                        if (!playerName) { return; }
                        nextDatabase[playerName] = {
                            power: normalizeEditablePlayerPower(data.power),
                            troops: normalizeEditablePlayerTroops(data.troops),
                            thp: normalizeEditablePlayerThp(data.thp),
                            lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString(),
                        };
                    });
                    if (Object.keys(nextDatabase).length > 0) {
                        return {
                            hasData: true,
                            data: normalizePlayerDatabaseMap(nextDatabase),
                            permissionDenied: false,
                        };
                    }
                }
            } catch (newPathError) {
                if (!isPermissionDeniedError(newPathError)) {
                    console.warn('⚠️ New-path player read failed, falling back to legacy:', newPathError.message);
                }
            }
        }
        // Fall back to old path
        const playersCollection = getUserGamePlayersCollectionRef(userId, gameId);
        if (!playersCollection) {
            return { hasData: false, data: {}, permissionDenied: false };
        }
        try {
            const snapshot = await playersCollection.get();
            if (!snapshot || snapshot.empty) {
                return { hasData: false, data: {}, permissionDenied: false };
            }
            const nextDatabase = {};
            snapshot.docs.forEach((doc) => {
                const data = doc.data() || {};
                const playerName = normalizeEditablePlayerName(data.name || '');
                if (!playerName) {
                    return;
                }
                nextDatabase[playerName] = {
                    power: normalizeEditablePlayerPower(data.power),
                    troops: normalizeEditablePlayerTroops(data.troops),
                    thp: normalizeEditablePlayerThp(data.thp),
                    lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString(),
                };
            });
            return {
                hasData: Object.keys(nextDatabase).length > 0,
                data: normalizePlayerDatabaseMap(nextDatabase),
                permissionDenied: false,
            };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                return { hasData: false, data: {}, permissionDenied: true };
            }
            throw error;
        }
    }

    async function loadGameScopedEventsFromSubcollection(userId, gameId) {
        // Try new game-centric path first
        const newEventsCollection = getGameScopedEventsCollectionRef(gameId);
        if (newEventsCollection) {
            try {
                const newSnapshot = await newEventsCollection.get();
                if (newSnapshot && !newSnapshot.empty) {
                    const nextEvents = {};
                    newSnapshot.docs.forEach((doc) => {
                        const data = doc.data() || {};
                        const eventId = resolveEventId(data.id || doc.id);
                        if (!eventId) { return; }
                        nextEvents[eventId] = sanitizeEventEntry(eventId, data, createEmptyEventEntry({ name: getDefaultEventName(eventId) }));
                    });
                    if (Object.keys(nextEvents).length > 0) {
                        return {
                            hasData: true,
                            data: ensureLegacyEventEntries(nextEvents),
                            permissionDenied: false,
                        };
                    }
                }
            } catch (newPathError) {
                if (!isPermissionDeniedError(newPathError)) {
                    console.warn('⚠️ New-path events read failed, falling back to legacy:', newPathError.message);
                }
            }
        }
        // Fall back to old path
        const eventsCollection = getUserGameEventsCollectionRef(userId, gameId);
        if (!eventsCollection) {
            return { hasData: false, data: {}, permissionDenied: false };
        }
        try {
            const snapshot = await eventsCollection.get();
            if (!snapshot || snapshot.empty) {
                return { hasData: false, data: {}, permissionDenied: false };
            }
            const nextEvents = {};
            snapshot.docs.forEach((doc) => {
                const data = doc.data() || {};
                const eventId = resolveEventId(data.id || doc.id);
                if (!eventId) {
                    return;
                }
                nextEvents[eventId] = sanitizeEventEntry(eventId, data, createEmptyEventEntry({ name: getDefaultEventName(eventId) }));
            });
            return {
                hasData: Object.keys(nextEvents).length > 0,
                data: ensureLegacyEventEntries(nextEvents),
                permissionDenied: false,
            };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                return { hasData: false, data: {}, permissionDenied: true };
            }
            throw error;
        }
    }

    async function persistGameScopedPlayersSubcollection(userId, gameId, nextDatabase) {
        const playersCollection = getUserGamePlayersCollectionRef(userId, gameId);
        if (!playersCollection) {
            return { success: false, error: 'invalid-player-subcollection-context' };
        }
        const snapshot = await playersCollection.get();
        const desiredDocs = new Map();
        Object.keys(nextDatabase || {}).forEach((playerName) => {
            const payload = createPlayerDocPayload(playerName, nextDatabase[playerName]);
            if (!payload) {
                return;
            }
            const docId = getPlayerDocId(playerName);
            desiredDocs.set(docId, payload);
        });

        const batch = db.batch();
        desiredDocs.forEach((payload, docId) => {
            batch.set(playersCollection.doc(docId), payload, { merge: true });
        });
        snapshot.docs.forEach((doc) => {
            if (!desiredDocs.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });
        await batch.commit();
        // Dual-write to new game-centric soloplayer path
        try {
            const newPlayersCollection = getSoloplayerPlayersCollectionRef(gameId, userId);
            if (newPlayersCollection) {
                const newSnapshot = await newPlayersCollection.get();
                const newBatch = db.batch();
                desiredDocs.forEach((payload, docId) => {
                    newBatch.set(newPlayersCollection.doc(docId), payload, { merge: true });
                });
                newSnapshot.docs.forEach((doc) => {
                    if (!desiredDocs.has(doc.id)) { newBatch.delete(doc.ref); }
                });
                await newBatch.commit();
            }
        } catch (dualWriteErr) {
            console.warn('⚠️ Dual-write to soloplayer players subcollection failed:', dualWriteErr.message);
        }
        return { success: true };
    }

    async function persistGameScopedEventsSubcollection(userId, gameId, nextEvents) {
        const eventsCollection = getUserGameEventsCollectionRef(userId, gameId);
        if (!eventsCollection) {
            return { success: false, error: 'invalid-event-subcollection-context' };
        }
        const snapshot = await eventsCollection.get();
        const desiredDocs = new Map();
        Object.keys(nextEvents || {}).forEach((eventId) => {
            const docId = getEventDocId(eventId);
            desiredDocs.set(docId, createEventDocPayload(eventId, nextEvents[eventId]));
        });

        const batch = db.batch();
        desiredDocs.forEach((payload, docId) => {
            batch.set(eventsCollection.doc(docId), payload, { merge: true });
        });
        snapshot.docs.forEach((doc) => {
            if (!desiredDocs.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });
        await batch.commit();
        // Dual-write to new game-centric events path
        try {
            const newEventsCollection = getGameScopedEventsCollectionRef(gameId);
            if (newEventsCollection) {
                const newSnapshot = await newEventsCollection.get();
                const newBatch = db.batch();
                desiredDocs.forEach((payload, docId) => {
                    newBatch.set(newEventsCollection.doc(docId), payload, { merge: true });
                });
                newSnapshot.docs.forEach((doc) => {
                    if (!desiredDocs.has(doc.id)) { newBatch.delete(doc.ref); }
                });
                await newBatch.commit();
            }
        } catch (dualWriteErr) {
            console.warn('⚠️ Dual-write to game-scoped events subcollection failed:', dualWriteErr.message);
        }
        return { success: true };
    }

    function getMutablePlayerDatabaseForSource(source) {
        if (source === 'personal') {
            return normalizePlayerDatabaseMap(playerDatabase);
        }
        if (source === 'alliance') {
            if (!allianceData || typeof allianceData !== 'object' || !allianceData.playerDatabase || typeof allianceData.playerDatabase !== 'object') {
                return {};
            }
            return normalizePlayerDatabaseMap(allianceData.playerDatabase);
        }
        return null;
    }

    async function persistPlayerDatabaseForSource(source, nextDatabase, context) {
        const gameId = getResolvedGameId('persistPlayerDatabaseForSource', context);
        if (source === 'personal') {
            const previousDatabase = playerDatabase;
            playerDatabase = nextDatabase;
            const saveResult = await saveUserData({ immediate: true }, { gameId: gameId });
            if (!saveResult.success) {
                playerDatabase = previousDatabase;
                return { success: false, error: saveResult.error || 'save-failed' };
            }
            return { success: true };
        }

        if (source === 'alliance') {
            if (!currentUser || !allianceId) {
                return { success: false, errorKey: 'players_list_error_no_alliance' };
            }
            const allianceRef = getGameAllianceDocRef(gameId, allianceId);
            if (!allianceRef) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }
            const playersCollectionRef = getAlliancePlayersCollectionRef(gameId, allianceId);
            if (!playersCollectionRef) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }
            try {
                const apSnapshot = await playersCollectionRef.get();
                const desiredDocs = new Map();
                Object.keys(nextDatabase).forEach((playerName) => {
                    const payload = createPlayerDocPayload(playerName, nextDatabase[playerName]);
                    if (!payload) { return; }
                    desiredDocs.set(getPlayerDocId(playerName), payload);
                });
                const apBatch = db.batch();
                desiredDocs.forEach((payload, docId) => {
                    apBatch.set(playersCollectionRef.doc(docId), payload, { merge: true });
                });
                apSnapshot.docs.forEach((doc) => {
                    if (!desiredDocs.has(doc.id)) { apBatch.delete(doc.ref); }
                });
                await apBatch.commit();
            } catch (subcollectionWriteErr) {
                return {
                    success: false,
                    error: subcollectionWriteErr && subcollectionWriteErr.message ? subcollectionWriteErr.message : 'alliance_players_write_failed',
                };
            }

            // Keep alliance doc metadata fresh, without persisting legacy playerDatabase map field.
            try {
                await allianceRef.set({
                    metadata: {
                        totalPlayers: Object.keys(nextDatabase).length,
                        lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                    },
                }, { mergeFields: ['metadata'] });
            } catch (metadataWriteErr) {
                console.warn('⚠️ Failed to update alliance metadata after alliance_players write:', metadataWriteErr.message);
            }

            if (!allianceData || typeof allianceData !== 'object') {
                allianceData = {};
            }
            allianceData.playerDatabase = nextDatabase;
            if (!allianceData.metadata || typeof allianceData.metadata !== 'object') {
                allianceData.metadata = {};
            }
            allianceData.metadata.totalPlayers = Object.keys(nextDatabase).length;
            allianceData.metadata.lastModified = new Date().toISOString();
            return { success: true };
        }

        return { success: false, errorKey: 'players_list_error_invalid_source' };
    }

    async function upsertPlayerEntry(source, originalName, nextPlayer, context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const normalizedSource = source === 'alliance' ? 'alliance' : (source === 'personal' ? 'personal' : '');
        if (!normalizedSource) {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (normalizedSource === 'alliance' && (!allianceId || !allianceData)) {
            return { success: false, errorKey: 'players_list_error_no_alliance' };
        }

        const previousName = normalizeEditablePlayerName(originalName);
        const nextName = normalizeEditablePlayerName(nextPlayer && nextPlayer.name);
        if (!nextName) {
            return { success: false, errorKey: 'players_list_error_name_required' };
        }

        const power = normalizeEditablePlayerPower(nextPlayer && nextPlayer.power);
        const troops = normalizeEditablePlayerTroops(nextPlayer && nextPlayer.troops);
        const thp = normalizeEditablePlayerThp(nextPlayer && nextPlayer.thp);
        const nowIso = new Date().toISOString();

        const nextDatabase = getMutablePlayerDatabaseForSource(normalizedSource);
        if (!nextDatabase || typeof nextDatabase !== 'object') {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }

        if (previousName && !Object.prototype.hasOwnProperty.call(nextDatabase, previousName)) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        if (previousName !== nextName && Object.prototype.hasOwnProperty.call(nextDatabase, nextName)) {
            return { success: false, errorKey: 'players_list_error_duplicate_name' };
        }

        const isAddingNewPlayer = !previousName && !Object.prototype.hasOwnProperty.call(nextDatabase, nextName);
        if (isAddingNewPlayer && Object.keys(nextDatabase).length >= MAX_PLAYER_DATABASE_SIZE) {
            return {
                success: false,
                errorKey: 'players_list_error_max_players',
                errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
            };
        }

        if (previousName && previousName !== nextName) {
            delete nextDatabase[previousName];
        }

        nextDatabase[nextName] = {
            power: power,
            troops: troops,
            thp: thp,
            lastUpdated: nowIso,
        };

        const persistResult = await persistPlayerDatabaseForSource(normalizedSource, nextDatabase, context);
        if (!persistResult.success) {
            return persistResult;
        }

        return { success: true, name: nextName, source: normalizedSource };
    }

    async function removePlayerEntry(source, playerName, context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }

        const normalizedSource = source === 'alliance' ? 'alliance' : (source === 'personal' ? 'personal' : '');
        if (!normalizedSource) {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (normalizedSource === 'alliance' && (!allianceId || !allianceData)) {
            return { success: false, errorKey: 'players_list_error_no_alliance' };
        }

        const normalizedName = normalizeEditablePlayerName(playerName);
        if (!normalizedName) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        const nextDatabase = getMutablePlayerDatabaseForSource(normalizedSource);
        if (!nextDatabase || typeof nextDatabase !== 'object') {
            return { success: false, errorKey: 'players_list_error_invalid_source' };
        }
        if (!Object.prototype.hasOwnProperty.call(nextDatabase, normalizedName)) {
            return { success: false, errorKey: 'players_list_error_not_found' };
        }

        delete nextDatabase[normalizedName];
        const persistResult = await persistPlayerDatabaseForSource(normalizedSource, nextDatabase, context);
        if (!persistResult.success) {
            return persistResult;
        }

        return { success: true, name: normalizedName, source: normalizedSource };
    }

    async function clearPersonalPlayerDatabase(context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }
        const result = await persistPlayerDatabaseForSource('personal', {}, context);
        if (!result.success) return result;
        return { success: true };
    }

    async function fillPersonalPlayerDatabase(players, context) {
        if (!currentUser) {
            return { success: false, error: 'No user signed in' };
        }
        if (!Array.isArray(players) || players.length === 0) {
            return { success: false, error: 'No players provided' };
        }
        const now = new Date().toISOString();
        const nextDatabase = {};
        players.forEach(function (p) {
            const name = normalizeEditablePlayerName(p.name);
            if (name) {
                nextDatabase[name] = {
                    power: typeof p.power === 'number' ? p.power : 0,
                    thp: typeof p.thp === 'number' ? p.thp : 0,
                    troops: normalizeEditablePlayerTroops(p.troops),
                    lastUpdated: now,
                };
            }
        });
        const result = await persistPlayerDatabaseForSource('personal', nextDatabase, context);
        if (!result.success) return result;
        return { success: true, playerCount: Object.keys(nextDatabase).length };
    }

    // ============================================================
    // ALLIANCE FUNCTIONS
    // ============================================================

    async function createAlliance(name, context) {
        if (!currentUser) return { success: false, error: 'Not signed in' };
        if (!name || name.length > 40) return { success: false, error: 'Name must be 1-40 characters' };
        const gameId = getResolvedGameId('createAlliance', context);

        try {
            await setActiveAllianceGameContext(gameId);
            const members = {};
            members[currentUser.uid] = {
                email: currentUser.email,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                role: 'member'
            };

            const allianceCollection = getGameAllianceCollectionRef(gameId);
            if (!allianceCollection) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }
            const docRef = await allianceCollection.add({
                gameId: gameId,
                name: name,
                createdBy: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                members: members,
                playerDatabase: {},
                metadata: {
                    totalPlayers: 0,
                    lastUpload: null,
                    lastModified: firebase.firestore.FieldValue.serverTimestamp()
                }
            });

            const id = docRef.id;
            allianceId = id;
            allianceName = name;
            activeAllianceGameId = gameId;
            await persistUserGameAssociationState(gameId, {
                allianceId: id,
                allianceName: name,
            });

            await loadAllianceData({ gameId: gameId });
            return { success: true, allianceId: id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function loadAllianceData(context) {
        const gameId = getResolvedGameId('loadAllianceData', context);
        const strictMode = isStrictModeEnabled(context);
        const loadRequestId = ++activeAllianceLoadRequestId;
        const isStaleLoad = () => loadRequestId !== activeAllianceLoadRequestId;
        await setActiveAllianceGameContext(gameId);
        if (isStaleLoad()) {
            return { success: true, stale: true };
        }
        if (!currentUser || !allianceId) {
            stopAllianceDocListener();
            allianceData = null;
            activeAllianceDocScope = 'game';
            emitAllianceDataUpdate();
            return;
        }
        try {
            const gameAllianceRef = getGameAllianceDocRef(gameId, allianceId);
            if (!gameAllianceRef) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }

            let selectedDocRef = gameAllianceRef;
            let selectedScope = 'game';
            let selectedData = null;
            let gameAlliancePermissionDenied = false;

            const gameAllianceRead = await getDocWithPermissionTolerantFallback(gameAllianceRef, { label: 'game alliance data' });
            gameAlliancePermissionDenied = gameAllianceRead.permissionDenied === true;
            if (isStaleLoad()) {
                return { success: true, stale: true };
            }
            if (gameAllianceRead.exists) {
                selectedScope = 'game';
                selectedData = gameAllianceRead.data || {};
            } else if (isLegacyFallbackAllowed(context)) {
                const legacyAllianceRef = getLegacyAllianceDocRef(allianceId);
                if (legacyAllianceRef) {
                    const legacyAllianceRead = await getDocWithPermissionTolerantFallback(legacyAllianceRef, { label: 'legacy alliance data' });
                    if (isStaleLoad()) {
                        return { success: true, stale: true };
                    }
                    if (legacyAllianceRead.exists) {
                        selectedDocRef = legacyAllianceRef;
                        selectedScope = 'legacy';
                        selectedData = legacyAllianceRead.data || {};
                    }
                }
            }

            if (strictMode && gameAlliancePermissionDenied) {
                const strictErrorMessage = `MULTIGAME_STRICT_MODE: alliance doc unavailable at games/${gameId}/alliances/${allianceId}`;
                console.error(`❌ ${strictErrorMessage}`);
                return {
                    success: false,
                    strictMode: true,
                    errorKey: 'strict_mode_alliance_unavailable',
                    error: strictErrorMessage,
                };
            }

            if (selectedData) {
                allianceData = selectedData;
                if (selectedScope === 'game' && normalizeGameId(allianceData.gameId) && normalizeGameId(allianceData.gameId) !== gameId) {
                    incrementObservabilityCounter('invitationContextMismatchCount', 1);
                    return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
                }
                if (!allianceData.members || !allianceData.members[currentUser.uid]) {
                    stopAllianceDocListener();
                    allianceId = null;
                    allianceName = null;
                    allianceData = null;
                    activeAllianceDocScope = 'game';
                    playerSource = 'personal';
                    await persistUserGameAssociationState(gameId, {
                        allianceId: null,
                        allianceName: null,
                        playerSource: 'personal',
                    });
                    emitAllianceDataUpdate();
                } else {
                    allianceData = {
                        ...allianceData,
                        playerDatabase: {},
                    };
                    // Alliance players source of truth: alliance_players subcollection.
                    try {
                        const alliancePlayersRef = getAlliancePlayersCollectionRef(gameId, allianceId);
                        if (alliancePlayersRef) {
                            const apSnapshot = await alliancePlayersRef.get();
                            const subcollectionPlayers = {};
                            if (apSnapshot && Array.isArray(apSnapshot.docs)) {
                                apSnapshot.docs.forEach((doc) => {
                                    const data = doc.data() || {};
                                    const playerName = normalizeEditablePlayerName(data.name || '');
                                    if (!playerName) { return; }
                                    subcollectionPlayers[playerName] = {
                                        power: normalizeEditablePlayerPower(data.power),
                                        troops: normalizeEditablePlayerTroops(data.troops),
                                        thp: normalizeEditablePlayerThp(data.thp),
                                        lastUpdated: typeof data.lastUpdated === 'string' ? data.lastUpdated : new Date().toISOString(),
                                    };
                                });
                            }
                            allianceData.playerDatabase = normalizePlayerDatabaseMap(subcollectionPlayers);
                        }
                    } catch (apError) {
                        console.warn('⚠️ Alliance players subcollection read failed; alliance roster unavailable:', apError.message);
                        allianceData.playerDatabase = {};
                    }
                    if (typeof allianceData.name === 'string' && allianceData.name.trim()) {
                        allianceName = allianceData.name.trim();
                    }
                    activeAllianceDocScope = selectedScope;
                    startAllianceDocListener(gameId, {
                        scope: selectedScope,
                        ref: selectedDocRef,
                    });
                    emitAllianceDataUpdate();
                }
            } else {
                stopAllianceDocListener();
                allianceId = null;
                allianceName = null;
                allianceData = null;
                activeAllianceDocScope = 'game';
                playerSource = 'personal';
                await persistUserGameAssociationState(gameId, {
                    allianceId: null,
                    allianceName: null,
                    playerSource: 'personal',
                });
                emitAllianceDataUpdate();
            }
            return { success: true };
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                if (strictMode) {
                    const strictErrorMessage = `MULTIGAME_STRICT_MODE: permission denied while loading alliance data for game "${gameId}"`;
                    console.error(`❌ ${strictErrorMessage}`);
                    return {
                        success: false,
                        strictMode: true,
                        errorKey: 'strict_mode_alliance_permission_denied',
                        error: strictErrorMessage,
                    };
                }
                console.info('Alliance data read skipped (optional feature disabled by Firestore rules):', error.message || error.code);
                stopAllianceDocListener();
                allianceData = null;
                activeAllianceDocScope = 'game';
                if (playerSource === 'alliance') {
                    playerSource = 'personal';
                }
                emitAllianceDataUpdate();
                return {
                    success: true,
                    degraded: true,
                    playerSource: playerSource,
                    warning: 'permission-denied',
                };
            } else {
                console.error('Failed to load alliance data:', error);
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async function leaveAlliance(context) {
        const gameId = getResolvedGameId('leaveAlliance', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const memberPath = `members.${currentUser.uid}`;
            const allianceRef = getGameAllianceDocRef(gameId, allianceId);
            if (!allianceRef) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }
            await allianceRef.update({
                [memberPath]: firebase.firestore.FieldValue.delete()
            });

            stopAllianceDocListener();
            allianceId = null;
            allianceName = null;
            allianceData = null;
            playerSource = 'personal';

            await persistUserGameAssociationState(gameId, {
                allianceId: null,
                allianceName: null,
                playerSource: 'personal',
            });

            emitAllianceDataUpdate();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    function timestampToMillis(value) { return DSFirebaseInfra.timestampToMillis(value); }

    function invitationSortKey(invitation) {
        if (!invitation || typeof invitation !== 'object') {
            return 0;
        }
        return timestampToMillis(invitation.lastSentAt) || timestampToMillis(invitation.createdAt);
    }

    function sortInvitationsNewestFirst(a, b) {
        return invitationSortKey(b) - invitationSortKey(a);
    }

    function getInviterDisplayName() {
        const displayName = userProfile && typeof userProfile.displayName === 'string' ? userProfile.displayName.trim() : '';
        if (displayName) {
            return displayName;
        }
        const nickname = userProfile && typeof userProfile.nickname === 'string' ? userProfile.nickname.trim() : '';
        if (nickname) {
            return nickname;
        }
        const providerName = currentUser && typeof currentUser.displayName === 'string' ? currentUser.displayName.trim() : '';
        return providerName || '';
    }

    function isAllianceMemberEmail(email) {
        const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        if (!normalizedEmail || !allianceData || !allianceData.members || typeof allianceData.members !== 'object') {
            return false;
        }
        return Object.values(allianceData.members).some((member) => {
            const memberEmail = member && typeof member.email === 'string' ? member.email.toLowerCase() : '';
            return memberEmail === normalizedEmail;
        });
    }

    function normalizeInvitationRecord(doc) {
        const data = doc && typeof doc.data === 'function'
            ? (doc.data() || {})
            : (doc && doc.data && typeof doc.data === 'object' ? doc.data : {});
        const resendCountRaw = Number(data.resendCount);
        const maxResendRaw = Number(data.maxResendCount);
        const resendCount = Number.isFinite(resendCountRaw) && resendCountRaw > 0 ? Math.floor(resendCountRaw) : 0;
        const maxResendCount = Number.isFinite(maxResendRaw) && maxResendRaw > 0 ? Math.floor(maxResendRaw) : INVITE_MAX_RESENDS;

        return {
            id: doc && typeof doc.id === 'string' ? doc.id : '',
            gameId: typeof data.gameId === 'string' ? normalizeGameId(data.gameId) : '',
            allianceId: typeof data.allianceId === 'string' ? data.allianceId : '',
            allianceName: typeof data.allianceName === 'string' ? data.allianceName : '',
            invitedEmail: typeof data.invitedEmail === 'string' ? data.invitedEmail : '',
            invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : '',
            inviterEmail: typeof data.inviterEmail === 'string' ? data.inviterEmail : '',
            inviterName: typeof data.inviterName === 'string' ? data.inviterName : '',
            status: typeof data.status === 'string' ? data.status : 'pending',
            resendCount: resendCount,
            maxResendCount: maxResendCount,
            createdAt: data.createdAt || null,
            lastSentAt: data.lastSentAt || data.createdAt || null,
            reminderDay1SentAt: data.reminderDay1SentAt || null,
            reminderDay3SentAt: data.reminderDay3SentAt || null,
            respondedAt: data.respondedAt || null,
            revokedAt: data.revokedAt || null,
            updatedAt: data.updatedAt || null,
            _ref: doc && doc.ref ? doc.ref : null,
        };
    }

    function isInvitationContextMismatch(invitation, expectedGameId) {
        if (!invitation || typeof invitation !== 'object') {
            return false;
        }
        const targetGameId = normalizeGameId(expectedGameId) || DEFAULT_GAME_ID;
        const invitationGameId = normalizeGameId(invitation.gameId);
        if (!invitationGameId) {
            return true;
        }
        return invitationGameId !== targetGameId;
    }

    function stripInvitationPrivateFields(invitation) {
        if (!invitation || typeof invitation !== 'object') {
            return invitation;
        }
        const clone = { ...invitation };
        delete clone._ref;
        return clone;
    }

    function buildInvitationNotifications(invitations) {
        const notifications = [];
        invitations.forEach((invitation) => {
            if (!invitation || typeof invitation !== 'object') {
                return;
            }
            const invitationId = typeof invitation.id === 'string' ? invitation.id : '';
            if (!invitationId) {
                return;
            }

            const basePayload = {
                invitationId: invitationId,
                gameId: invitation.gameId || '',
                allianceId: invitation.allianceId || '',
                allianceName: invitation.allianceName || '',
                invitedEmail: invitation.invitedEmail || '',
                invitedBy: invitation.invitedBy || '',
                inviterEmail: invitation.inviterEmail || '',
                inviterName: invitation.inviterName || '',
            };

            notifications.push({
                ...basePayload,
                id: `invite:${invitationId}`,
                notificationType: 'invitation_pending',
                createdAt: invitation.lastSentAt || invitation.createdAt || null,
            });

            if (timestampToMillis(invitation.reminderDay1SentAt)) {
                notifications.push({
                    ...basePayload,
                    id: `invite:${invitationId}:day1`,
                    notificationType: 'invite_reminder_day1',
                    createdAt: invitation.reminderDay1SentAt,
                });
            }

            if (timestampToMillis(invitation.reminderDay3SentAt)) {
                notifications.push({
                    ...basePayload,
                    id: `invite:${invitationId}:day3`,
                    notificationType: 'invite_reminder_day3',
                    createdAt: invitation.reminderDay3SentAt,
                });
            }
        });

        notifications.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
        return notifications;
    }

    async function markPendingInvitationReminders(invitations) {
        if (!Array.isArray(invitations) || invitations.length === 0) {
            return;
        }

        const now = Date.now();
        const writes = [];

        invitations.forEach((invitation) => {
            if (!invitation || invitation.status !== 'pending' || !invitation._ref) {
                return;
            }

            const lastSentMillis = timestampToMillis(invitation.lastSentAt) || timestampToMillis(invitation.createdAt);
            if (!lastSentMillis) {
                return;
            }

            const ageMs = now - lastSentMillis;
            const hasDay1Reminder = timestampToMillis(invitation.reminderDay1SentAt) > 0;
            const hasDay3Reminder = timestampToMillis(invitation.reminderDay3SentAt) > 0;
            const shouldSetDay1 = ageMs >= INVITE_REMINDER_DAY1_MS && !hasDay1Reminder;
            const shouldSetDay3 = ageMs >= INVITE_REMINDER_DAY3_MS && !hasDay3Reminder;

            if (!shouldSetDay1 && !shouldSetDay3) {
                return;
            }

            const payload = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            };

            if (shouldSetDay1 || (shouldSetDay3 && !hasDay1Reminder)) {
                payload.reminderDay1SentAt = firebase.firestore.FieldValue.serverTimestamp();
                invitation.reminderDay1SentAt = new Date(now);
            }

            if (shouldSetDay3) {
                payload.reminderDay3SentAt = firebase.firestore.FieldValue.serverTimestamp();
                invitation.reminderDay3SentAt = new Date(now);
            }

            writes.push(invitation._ref.update(payload));
        });

        if (writes.length === 0) {
            return;
        }

        try {
            await Promise.all(writes);
        } catch (error) {
            console.warn('Failed to persist invitation reminder timestamps:', error);
        }
    }

    async function sendInvitation(email, context) {
        const gameId = getResolvedGameId('sendInvitation', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) return { success: false, error: 'Email is required' };

        const currentUserEmail = currentUser && typeof currentUser.email === 'string'
            ? currentUser.email.toLowerCase()
            : '';
        if (currentUserEmail && normalizedEmail === currentUserEmail) {
            return { success: false, errorKey: 'alliance_error_invite_self' };
        }
        if (isAllianceMemberEmail(normalizedEmail)) {
            return { success: false, errorKey: 'alliance_error_invitee_already_member' };
        }

        try {
            const invitationCollection = getGameInvitationCollectionRef(gameId, allianceId);
            if (!invitationCollection) {
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const existing = await invitationCollection
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();

            if (!existing.empty) {
                return { success: false, errorKey: 'alliance_invite_pending_exists' };
            }

            const inviteRef = await invitationCollection.add({
                gameId: gameId,
                allianceId: allianceId,
                allianceName: allianceName,
                invitedEmail: normalizedEmail,
                invitedBy: currentUser.uid,
                inviterEmail: currentUser.email,
                inviterName: getInviterDisplayName(),
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastSentAt: firebase.firestore.FieldValue.serverTimestamp(),
                resendCount: 0,
                maxResendCount: INVITE_MAX_RESENDS,
                reminderDay1SentAt: null,
                reminderDay3SentAt: null,
                respondedAt: null,
                revokedAt: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations({ gameId: gameId });
            return { success: true, invitationId: inviteRef.id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function checkInvitations(context) {
        const gameId = getResolvedGameId('checkInvitations', context);
        const strictMode = isStrictModeEnabled(context);
        const loadRequestId = ++activeInvitationLoadRequestId;
        const isStaleLoad = () => loadRequestId !== activeInvitationLoadRequestId;
        await setActiveAllianceGameContext(gameId);
        if (isStaleLoad()) {
            return [];
        }
        if (!currentUser || !currentUser.email) {
            pendingInvitations = [];
            sentInvitations = [];
            invitationNotifications = [];
            return invitationNotifications;
        }

        try {
            if (!db || typeof db.collectionGroup !== 'function') {
                return [];
            }
            const normalizedEmail = currentUser.email.toLowerCase();
            // Use collectionGroup to query invitations across all alliances
            const invitationsGroup = db.collectionGroup(GAME_INVITATIONS_SUBCOLLECTION);
            const pendingReceivedPromise = invitationsGroup
                .where('gameId', '==', gameId)
                .where('invitedEmail', '==', normalizedEmail)
                .where('status', '==', 'pending')
                .get();
            const pendingSentPromise = invitationsGroup
                .where('gameId', '==', gameId)
                .where('invitedBy', '==', currentUser.uid)
                .get();

            const [receivedSnapshot, sentSnapshot] = await Promise.all([pendingReceivedPromise, pendingSentPromise]);
            if (isStaleLoad()) {
                return [];
            }

            pendingInvitations = receivedSnapshot.docs
                .map((doc) => normalizeInvitationRecord(doc))
                .filter((invite) => invite.status === 'pending')
                .filter((invite) => {
                    if (isInvitationContextMismatch(invite, gameId)) {
                        incrementObservabilityCounter('invitationContextMismatchCount', 1);
                        return false;
                    }
                    return true;
                })
                .sort(sortInvitationsNewestFirst);
            await markPendingInvitationReminders(pendingInvitations);
            if (isStaleLoad()) {
                return [];
            }

            sentInvitations = sentSnapshot.docs
                .map((doc) => normalizeInvitationRecord(doc))
                .filter((invite) => invite.status === 'pending')
                .filter((invite) => {
                    if (isInvitationContextMismatch(invite, gameId)) {
                        incrementObservabilityCounter('invitationContextMismatchCount', 1);
                        return false;
                    }
                    return true;
                })
                .filter((invite) => !allianceId || invite.allianceId === allianceId)
                .sort(sortInvitationsNewestFirst);

            invitationNotifications = buildInvitationNotifications(pendingInvitations);
            return getInvitationNotifications({ gameId: gameId });
        } catch (error) {
            if (isPermissionDeniedError(error)) {
                if (strictMode) {
                    const strictErrorMessage = `MULTIGAME_STRICT_MODE: permission denied while reading invitations for game "${gameId}"`;
                    console.error(`❌ ${strictErrorMessage}`);
                    pendingInvitations = [];
                    sentInvitations = [];
                    invitationNotifications = [];
                    return [];
                }
                console.info('Invitation reads skipped (optional feature disabled by Firestore rules):', error.message || error.code);
            } else {
                console.error('Failed to check invitations:', error);
            }
            pendingInvitations = [];
            sentInvitations = [];
            invitationNotifications = [];
            return [];
        }
    }

    /**
     * Resolves an invitation ref from cached invitations or via collectionGroup lookup.
     */
    async function resolveInvitationRef(gameId, invitationId) {
        // Check cached invitations first (they have _ref from the query)
        var cached = pendingInvitations.concat(sentInvitations).find(function(inv) {
            return inv.id === invitationId && inv._ref;
        });
        if (cached && cached._ref) {
            return cached._ref;
        }
        // Fallback: collectionGroup lookup
        var found = await findInvitationById(gameId, invitationId);
        return found ? found.ref : null;
    }

    async function acceptInvitation(invitationId, context) {
        const gameId = getResolvedGameId('acceptInvitation', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invitationRef = await resolveInvitationRef(gameId, invitationId);
            if (!invitationRef) {
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invDoc = await invitationRef.get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };

            const inv = invDoc.data();
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };
            if (isInvitationContextMismatch(inv, gameId)) {
                incrementObservabilityCounter('invitationContextMismatchCount', 1);
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invitedEmail = typeof inv.invitedEmail === 'string' ? inv.invitedEmail.toLowerCase() : '';
            const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
            if (!invitedEmail || !userEmail || invitedEmail !== userEmail) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            if (allianceId) {
                await leaveAlliance({ gameId: gameId });
            }

            const memberPath = `members.${currentUser.uid}`;
            const allianceRef = getGameAllianceDocRef(gameId, inv.allianceId);
            if (!allianceRef) {
                return { success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' };
            }
            await allianceRef.update({
                [memberPath]: {
                    email: currentUser.email,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    role: 'member'
                }
            });

            await invitationRef.update({
                status: 'accepted',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            allianceId = inv.allianceId;
            allianceName = inv.allianceName;
            activeAllianceGameId = gameId;
            await persistUserGameAssociationState(gameId, {
                allianceId: inv.allianceId,
                allianceName: inv.allianceName
            });

            await loadAllianceData({ gameId: gameId });
            await checkInvitations({ gameId: gameId });
            return { success: true, allianceId: inv.allianceId, allianceName: inv.allianceName };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function rejectInvitation(invitationId, context) {
        const gameId = getResolvedGameId('rejectInvitation', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser) return { success: false, error: 'Not signed in' };

        try {
            const invitationRef = await resolveInvitationRef(gameId, invitationId);
            if (!invitationRef) {
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invDoc = await invitationRef.get();
            if (!invDoc.exists) return { success: false, error: 'Invitation not found' };
            const inv = invDoc.data() || {};
            if (inv.status !== 'pending') return { success: false, error: 'Invitation already responded to' };
            if (isInvitationContextMismatch(inv, gameId)) {
                incrementObservabilityCounter('invitationContextMismatchCount', 1);
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invitedEmail = typeof inv.invitedEmail === 'string' ? inv.invitedEmail.toLowerCase() : '';
            const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
            if (!invitedEmail || !userEmail || invitedEmail !== userEmail) {
                return { success: false, error: 'Invitation does not belong to this user' };
            }

            await invitationRef.update({
                status: 'rejected',
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations({ gameId: gameId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function revokeInvitation(invitationId, context) {
        const gameId = getResolvedGameId('revokeInvitation', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const invitationRef = await resolveInvitationRef(gameId, invitationId);
            if (!invitationRef) {
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invitationDoc = await invitationRef.get();
            if (!invitationDoc.exists) {
                return { success: false, errorKey: 'alliance_invite_not_found' };
            }

            const invitation = invitationDoc.data() || {};
            if (invitation.status !== 'pending') {
                return { success: false, errorKey: 'alliance_invite_not_pending' };
            }
            if (isInvitationContextMismatch(invitation, gameId)) {
                incrementObservabilityCounter('invitationContextMismatchCount', 1);
                return { success: false, errorKey: 'invalid-invitation-context', error: 'invalid-invitation-context' };
            }
            if (invitation.invitedBy !== currentUser.uid) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }
            if (invitation.allianceId !== allianceId) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }

            await invitationRef.update({
                status: 'revoked',
                revokedAt: firebase.firestore.FieldValue.serverTimestamp(),
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations({ gameId: gameId });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function resendInvitation(invitationId, context) {
        const gameId = getResolvedGameId('resendInvitation', context);
        await setActiveAllianceGameContext(gameId);
        if (!currentUser || !allianceId) return { success: false, error: 'Not in an alliance' };

        try {
            const invitationRef = await resolveInvitationRef(gameId, invitationId);
            if (!invitationRef) {
                return { success: false, error: 'invalid-invitation-context', errorKey: 'invalid-invitation-context' };
            }
            const invitationDoc = await invitationRef.get();
            if (!invitationDoc.exists) {
                return { success: false, errorKey: 'alliance_invite_not_found' };
            }

            const invitation = invitationDoc.data() || {};
            if (invitation.status !== 'pending') {
                return { success: false, errorKey: 'alliance_invite_not_pending' };
            }
            if (isInvitationContextMismatch(invitation, gameId)) {
                incrementObservabilityCounter('invitationContextMismatchCount', 1);
                return { success: false, errorKey: 'invalid-invitation-context', error: 'invalid-invitation-context' };
            }
            if (invitation.invitedBy !== currentUser.uid) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }
            if (invitation.allianceId !== allianceId) {
                return { success: false, errorKey: 'alliance_invite_not_owner' };
            }

            const resendCountRaw = Number(invitation.resendCount);
            const resendCount = Number.isFinite(resendCountRaw) && resendCountRaw > 0 ? Math.floor(resendCountRaw) : 0;
            if (resendCount >= INVITE_MAX_RESENDS) {
                return {
                    success: false,
                    errorKey: 'alliance_invite_resend_limit',
                    errorParams: { max: INVITE_MAX_RESENDS },
                };
            }

            const nextResendCount = resendCount + 1;
            await invitationRef.update({
                resendCount: nextResendCount,
                maxResendCount: INVITE_MAX_RESENDS,
                inviterEmail: currentUser.email || invitation.inviterEmail || '',
                inviterName: getInviterDisplayName(),
                lastSentAt: firebase.firestore.FieldValue.serverTimestamp(),
                reminderDay1SentAt: null,
                reminderDay3SentAt: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            await checkInvitations({ gameId: gameId });
            return {
                success: true,
                resendCount: nextResendCount,
                maxResendCount: INVITE_MAX_RESENDS,
                remainingResends: Math.max(0, INVITE_MAX_RESENDS - nextResendCount),
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async function uploadAlliancePlayerDatabase(file, context) {
        const gameId = getResolvedGameId('uploadAlliancePlayerDatabase', context);
        await setActiveAllianceGameContext(gameId);
        const importSchema = getPlayerImportSchema(gameId);
        if (!currentUser || !allianceId) {
            return Promise.reject({ success: false, error: 'Not in an alliance' });
        }

        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const parsed = parseWorkbookPlayers(workbook, importSchema);
                    if (!parsed.success) {
                        reject(parsed);
                        return;
                    }
                    const alliancePlayerDB = parsed.nextDatabase;
                    Object.keys(alliancePlayerDB).forEach((name) => {
                        alliancePlayerDB[name].updatedBy = currentUser.uid;
                    });

                    const addedCount = Object.keys(alliancePlayerDB).length;
                    if (addedCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }

                    const allianceRef = getGameAllianceDocRef(gameId, allianceId);
                    if (!allianceRef) {
                        reject({ success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' });
                        return;
                    }
                    const uploadPlayersCollectionRef = getAlliancePlayersCollectionRef(gameId, allianceId);
                    if (!uploadPlayersCollectionRef) {
                        reject({ success: false, error: 'invalid-alliance-context', errorKey: 'invalid-alliance-context' });
                        return;
                    }
                    try {
                        const uploadApSnapshot = await uploadPlayersCollectionRef.get();
                        const uploadDesiredDocs = new Map();
                        Object.keys(alliancePlayerDB).forEach((playerName) => {
                            const payload = createPlayerDocPayload(playerName, alliancePlayerDB[playerName]);
                            if (!payload) { return; }
                            uploadDesiredDocs.set(getPlayerDocId(playerName), payload);
                        });
                        const uploadApBatch = db.batch();
                        uploadDesiredDocs.forEach((payload, docId) => {
                            uploadApBatch.set(uploadPlayersCollectionRef.doc(docId), payload, { merge: true });
                        });
                        uploadApSnapshot.docs.forEach((doc) => {
                            if (!uploadDesiredDocs.has(doc.id)) { uploadApBatch.delete(doc.ref); }
                        });
                        await uploadApBatch.commit();
                    } catch (subcollectionWriteErr) {
                        reject({ success: false, error: subcollectionWriteErr.message || 'alliance_players_write_failed' });
                        return;
                    }

                    // Keep alliance doc metadata fresh, without persisting legacy playerDatabase map field.
                    try {
                        await allianceRef.set({
                            metadata: {
                                totalPlayers: addedCount,
                                lastUpload: new Date().toISOString(),
                                lastModified: firebase.firestore.FieldValue.serverTimestamp(),
                            },
                        }, { mergeFields: ['metadata'] });
                    } catch (metadataWriteErr) {
                        console.warn('⚠️ Failed to update alliance metadata after alliance upload:', metadataWriteErr.message);
                    }

                    if (allianceData) {
                        allianceData.playerDatabase = alliancePlayerDB;
                    }

                    resolve({
                        success: true,
                        playerCount: addedCount,
                        message: `${addedCount} players uploaded to alliance`
                    });
                } catch (error) {
                    reject({ success: false, error: error.message });
                }
            };
            reader.onerror = () => reject({ success: false, error: 'Failed to read file' });
            reader.readAsArrayBuffer(file);
        });
    }

    function getAlliancePlayerDatabase(context) {
        const gameId = getResolvedGameId('getAlliancePlayerDatabase', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return {};
        }
        return normalizePlayerDatabaseMap(allianceData && allianceData.playerDatabase ? allianceData.playerDatabase : {});
    }

    function getActivePlayerDatabase(context) {
        const gameId = getResolvedGameId('getActivePlayerDatabase', context);
        if (!isActiveGameplayGameId(gameId)) {
            return {};
        }
        if (playerSource === 'alliance') {
            if (allianceData && allianceData.playerDatabase) {
                return normalizePlayerDatabaseMap(allianceData.playerDatabase);
            }
            return normalizePlayerDatabaseMap(playerDatabase);
        }
        return normalizePlayerDatabaseMap(playerDatabase);
    }

    function getUserProfile(context) {
        const gameId = getResolvedGameId('getUserProfile', context);
        if (!isActiveGameplayGameId(gameId)) {
            return normalizeUserProfile(null);
        }
        return normalizeUserProfile(userProfile);
    }

    function setUserProfile(profile, context) {
        const gameId = getResolvedGameId('setUserProfile', context);
        if (!isActiveGameplayGameId(gameId)) {
            return getUserProfile({ gameId: gameId });
        }
        userProfile = normalizeUserProfile(profile);
        return getUserProfile({ gameId: gameId });
    }

    async function setPlayerSource(source, context) {
        const gameId = getResolvedGameId('setPlayerSource', context);
        const strictMode = isStrictModeEnabled(context);
        await setActiveAllianceGameContext(gameId);
        if (source !== 'personal' && source !== 'alliance') {
            return { success: false, error: 'Invalid player source' };
        }
        if (source === 'alliance' && !allianceId) {
            playerSource = 'personal';
            return { success: false, error: 'Not in an alliance' };
        }

        const previousSource = playerSource;
        playerSource = source;
        if (currentUser) {
            try {
                await persistUserGameAssociationState(gameId, {
                    playerSource: source,
                });
            } catch (error) {
                if (isPermissionDeniedError(error)) {
                    playerSource = previousSource;
                    if (strictMode) {
                        const strictErrorMessage = `MULTIGAME_STRICT_MODE: unable to persist users/${currentUser.uid}/games/${gameId}.playerSource`;
                        console.error(`❌ ${strictErrorMessage}`);
                        return {
                            success: false,
                            strictMode: true,
                            errorKey: 'strict_mode_player_source_unsynced',
                            error: strictErrorMessage,
                        };
                    }
                    console.warn('Player source switched locally; Firestore persistence denied by rules.');
                    return {
                        success: true,
                        persisted: false,
                        warning: 'permission-denied',
                        warningMessage: 'Source changed locally, but cloud sync was denied by Firestore rules.',
                    };
                }
                throw error;
            }
        }
        return { success: true, persisted: true };
    }

    function getAllianceId(context) {
        const gameId = getResolvedGameId('getAllianceId', context);
        return (normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) === gameId ? allianceId : null;
    }
    function getAllianceName(context) {
        const gameId = getResolvedGameId('getAllianceName', context);
        return (normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) === gameId ? allianceName : null;
    }
    function getAllianceData(context) {
        const gameId = getResolvedGameId('getAllianceData', context);
        return (normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) === gameId ? allianceData : null;
    }
    function getPlayerSource(context) {
        const gameId = getResolvedGameId('getPlayerSource', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return 'personal';
        }
        if (playerSource === 'alliance' && (!allianceData || typeof allianceData !== 'object')) {
            return 'personal';
        }
        return playerSource;
    }
    function getPendingInvitations(context) {
        const gameId = getResolvedGameId('getPendingInvitations', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return [];
        }
        return pendingInvitations.map(stripInvitationPrivateFields);
    }
    function getSentInvitations(context) {
        const gameId = getResolvedGameId('getSentInvitations', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return [];
        }
        return sentInvitations.map(stripInvitationPrivateFields);
    }
    function getInvitationNotifications(context) {
        const gameId = getResolvedGameId('getInvitationNotifications', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return [];
        }
        return invitationNotifications.map(stripInvitationPrivateFields);
    }
    function getAllianceMembers(context) {
        const gameId = getResolvedGameId('getAllianceMembers', context);
        if ((normalizeGameId(activeAllianceGameId) || DEFAULT_GAME_ID) !== gameId) {
            return {};
        }
        return allianceData && allianceData.members ? allianceData.members : {};
    }

    function getMigrationVersion() {
        return migrationVersion;
    }

    function getMigratedToGameSubcollectionsAt() {
        return migratedToGameSubcollectionsAt;
    }

    // ============================================================
    // BACKUP & RESTORE FUNCTIONS
    // ============================================================
    
    /**
     * Export player database as Excel
     */
    function exportBackup() {
        const players = Object.keys(playerDatabase).map(name => ({
            'Player Name': name,
            [PLAYER_POWER_HEADER]: playerDatabase[name].power,
            'E1 Troops': playerDatabase[name].troops,
            'THP': normalizeEditablePlayerThp(playerDatabase[name].thp),
            'Last Updated': playerDatabase[name].lastUpdated
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(players);
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        
        // Add metadata sheet
        const metadata = [
            ['Total Players', Object.keys(playerDatabase).length],
            ['Export Date', new Date().toISOString()],
            ['Account Email', currentUser ? currentUser.email : 'N/A']
        ];
        const wsMeta = XLSX.utils.aoa_to_sheet(metadata);
        XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');
        
        const emailSlug = currentUser && currentUser.email ? currentUser.email.replace('@', '_') : 'unknown';
        const filename = `backup_${emailSlug}_${Date.now()}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        console.log('✅ Backup exported:', filename);
        return { success: true, filename: filename };
    }
    
    /**
     * Restore player database from Excel backup
     */
    async function restoreFromBackup(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size > MAX_UPLOAD_BYTES) {
                reject({ success: false, error: 'File too large (max 5MB)' });
                return;
            }

            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    
                    if (!workbook.Sheets['Players']) {
                        reject({ success: false, error: 'Invalid backup file' });
                        return;
                    }
                    
                    const sheet = workbook.Sheets['Players'];
                    const players = XLSX.utils.sheet_to_json(sheet);
                    
                    const restored = {};
                    const nowIso = new Date().toISOString();
                    players.forEach(row => {
                        const name = normalizeEditablePlayerName(row['Player Name']);
                        if (name) {
                            restored[name] = {
                                power: normalizeEditablePlayerPower(getPlayerRowPowerValue(row)),
                                troops: normalizeEditablePlayerTroops(row['E1 Troops']),
                                thp: normalizeEditablePlayerThp(row['Total Hero Power'] ?? row['THP']),
                                lastUpdated: row['Last Updated'] || nowIso,
                            };
                        }
                    });

                    const restoredCount = Object.keys(restored).length;
                    if (restoredCount > MAX_PLAYER_DATABASE_SIZE) {
                        reject({
                            success: false,
                            errorKey: 'players_list_error_max_players',
                            errorParams: { max: MAX_PLAYER_DATABASE_SIZE },
                            error: `Maximum ${MAX_PLAYER_DATABASE_SIZE} players allowed.`,
                        });
                        return;
                    }
                    
                    playerDatabase = restored;
                    const saveResult = await saveUserData(undefined, {
                        gameId: normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID,
                    });
                    
                    if (saveResult.success) {
                        console.log(`✅ Restored ${restoredCount} players`);
                        resolve({ 
                            success: true, 
                            playerCount: restoredCount,
                            message: `✅ Database restored: ${restoredCount} players`
                        });
                    } else {
                        reject(saveResult);
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to restore backup:', error);
                    reject({ success: false, error: error.message });
                }
            };
            
            reader.onerror = () => {
                reject({ success: false, error: 'Failed to read file' });
            };
            
            reader.readAsArrayBuffer(file);
        });
    }
    
    // ============================================================
    // TEMPLATE GENERATION FUNCTIONS
    // ============================================================
    
    /**
     * Generate player database template
     */
    function generatePlayerDatabaseTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['PLAYER DATABASE TEMPLATE'],
            ['Fill this template with ALL your alliance members'],
            ['Update this file monthly or when player stats change'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (exact names from game)'],
            [`2. Fill ${PLAYER_POWER_HEADER} column (numeric value, e.g., 65.0)`],
            ['3. Fill E1 Troops column (Tank, Aero, or Missile)'],
            ['4. Fill THP column (Total Hero Power, numeric value, e.g., 120.5). Leave empty for 0.'],
            ['5. Upload to generator - data saved to cloud forever!'],
            ['']
        ];
        
        const headers = [['Player Name', PLAYER_POWER_HEADER, 'E1 Troops', 'THP']];
        const example = [
            ['Example Player', 65.0, 'Tank', 120.5],
            ['', '', '', ''],
            ['', '', '', '']
        ];
        
        const data = [...instructions, ...headers, ...example];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 20}, {wch: 20}, {wch: 15}, {wch: 22}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Players');
        XLSX.writeFile(wb, 'player_database_template.xlsx');
        
        console.log('✅ Player database template downloaded');
    }
    
    /**
     * Generate team roster template
     */
    function generateTeamRosterTemplate() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            ['TEAM ROSTER TEMPLATE'],
            ['Fill this template before each battle with weekly assignments'],
            [''],
            ['Instructions:'],
            ['1. Fill Player Name column (must match names in player database)'],
            ['2. Fill Team column with "A" or "B"'],
            ['3. Upload to generator - system matches with database automatically'],
            ['4. Generate assignments and download maps!'],
            [''],
            ['Required: 20 players per team (40 total)'],
            ['']
        ];
        
        const headers = [['Player Name', 'Team']];
        const examples = [
            ['Example Player 1', 'A'],
            ['Example Player 2', 'A'],
            ['Example Player 3', 'B'],
            ['', ''],
            ['', '']
        ];
        
        const data = [...instructions, ...headers, ...examples];
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [{wch: 25}, {wch: 10}];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Roster');
        XLSX.writeFile(wb, 'team_roster_template.xlsx');
        
        console.log('✅ Team roster template downloaded');
    }
    
    // ============================================================
    // EVENT HISTORY & PLAYER STATS
    // ============================================================

    async function saveEventHistoryRecord(allianceId, record) {
        try {
            if (!db) {
                return { ok: false, error: 'Not available' };
            }
            var recordWithTimestamp = Object.assign({}, record, {
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                allianceId: allianceId || null,
            });
            var docRef;
            if (allianceId) {
                docRef = await db.collection('alliances').doc(allianceId)
                    .collection('event_history').add(recordWithTimestamp);
            }
            // Write to game-scoped event_history (primary for solo, dual-write for alliance)
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newHistoryCollection = getGameEventHistoryCollectionRef(resolvedGameId);
                    if (newHistoryCollection) {
                        if (docRef) {
                            await newHistoryCollection.doc(docRef.id).set(recordWithTimestamp);
                        } else {
                            // Solo player — game-scoped is the primary path
                            docRef = await newHistoryCollection.add(recordWithTimestamp);
                        }
                    }
                } catch (gameWriteErr) {
                    console.warn('⚠️ Game-scoped event_history write failed:', gameWriteErr.message);
                }
            }
            if (!docRef) {
                return { ok: false, error: 'No write path available' };
            }
            return { ok: true, historyId: docRef.id };
        } catch (err) {
            console.error('saveEventHistoryRecord error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function saveAttendanceBatch(allianceIdParam, historyId, attendanceDocs) {
        try {
            if (!db || !historyId) {
                return { ok: false, error: 'Not available' };
            }
            // Write to alliance path if available
            if (allianceIdParam) {
                var batch = db.batch();
                var basePath = db.collection('alliances').doc(allianceIdParam)
                    .collection('event_history').doc(historyId)
                    .collection('attendance');
                attendanceDocs.forEach(function(entry) {
                    var ref = basePath.doc(entry.docId);
                    batch.set(ref, entry.doc);
                });
                await batch.commit();
            }
            // Write to game-scoped path (primary for solo, dual-write for alliance)
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newHistoryCollection = getGameEventHistoryCollectionRef(resolvedGameId);
                    if (newHistoryCollection) {
                        var newStatsBatch = db.batch();
                        attendanceDocs.forEach(function(entry) {
                            var ref = newHistoryCollection.doc(historyId).collection('player_stats').doc(entry.docId);
                            newStatsBatch.set(ref, entry.doc);
                        });
                        await newStatsBatch.commit();
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game event_history player_stats failed:', dualWriteErr.message);
                }
            }
            return { ok: true };
        } catch (err) {
            console.error('saveAttendanceBatch error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function loadEventHistoryRecords(allianceIdParam, filters) {
        var f = filters && typeof filters === 'object' ? filters : {};

        function applyFilters(baseQuery) {
            var q = baseQuery;
            if (f.eventTypeId) {
                q = q.where('eventTypeId', '==', f.eventTypeId);
            }
            if (f.activeOnly) {
                q = q.where('active', '==', true);
            }
            if (f.gameId) {
                q = q.where('gameId', '==', f.gameId);
            }
            q = q.orderBy('createdAt', 'desc');
            if (f.limit && typeof f.limit === 'number') {
                q = q.limit(f.limit);
            } else {
                q = q.limit(50);
            }
            return q;
        }

        function snapshotToResults(snapshot) {
            var results = [];
            snapshot.forEach(function(doc) {
                results.push(Object.assign({ id: doc.id }, doc.data()));
            });
            return results;
        }

        // Scope visibility at the application layer:
        // - Own records: always shown (personal and alliance source)
        // - Other alliance members' records: only shown when playerSource === 'alliance'
        //   (missing playerSource treated as 'alliance' for backward compat with old records)
        // - Solo users: see only their own records
        function filterByContext(records) {
            if (allianceIdParam) {
                return records.filter(function(r) {
                    if (r.createdByUid === currentUser.uid) return true;
                    var source = r.playerSource || 'alliance';
                    return r.allianceId === allianceIdParam && source === 'alliance';
                });
            }
            if (currentUser) {
                return records.filter(function(r) { return r.createdByUid === currentUser.uid; });
            }
            return [];
        }

        // Try game-centric path first
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        if (resolvedGameId) {
            try {
                var newHistoryRef = getGameEventHistoryCollectionRef(resolvedGameId);
                if (newHistoryRef) {
                    var newSnapshot = await applyFilters(newHistoryRef).get();
                    if (newSnapshot) {
                        // Always return game-scoped results on success (even if empty),
                        // so a successful empty result doesn't fall through to legacy path.
                        return filterByContext(snapshotToResults(newSnapshot));
                    }
                }
            } catch (newPathErr) {
                console.warn('⚠️ New-path event history read failed, falling back to legacy:', newPathErr.message);
            }
        }
        // Fall back to alliance path
        try {
            if (!db || !allianceIdParam) {
                return [];
            }
            var query = db.collection('alliances').doc(allianceIdParam)
                .collection('event_history');
            var snapshot = await applyFilters(query).get();
            return snapshotToResults(snapshot);
        } catch (err) {
            console.error('loadEventHistoryRecords error:', err);
            return [];
        }
    }

    async function loadEventAttendance(allianceIdParam, historyId) {
        // Try new game-centric path first (player_stats subcollection under event_history)
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        if (resolvedGameId && historyId) {
            try {
                var newHistoryRef = getGameEventHistoryCollectionRef(resolvedGameId);
                if (newHistoryRef) {
                    var newSnapshot = await newHistoryRef.doc(historyId).collection('player_stats').get();
                    if (newSnapshot && !newSnapshot.empty) {
                        var newResults = [];
                        newSnapshot.forEach(function(doc) {
                            newResults.push(Object.assign({ docId: doc.id }, doc.data()));
                        });
                        return newResults;
                    }
                }
            } catch (newPathErr) {
                console.warn('⚠️ New-path event attendance read failed, falling back to legacy:', newPathErr.message);
            }
        }
        // Fall back to old path
        try {
            if (!db || !allianceIdParam || !historyId) {
                return [];
            }
            var snapshot = await db.collection('alliances').doc(allianceIdParam)
                .collection('event_history').doc(historyId)
                .collection('attendance').get();
            var results = [];
            snapshot.forEach(function(doc) {
                results.push(Object.assign({ docId: doc.id }, doc.data()));
            });
            return results;
        } catch (err) {
            console.error('loadEventAttendance error:', err);
            return [];
        }
    }

    async function updateAttendanceStatus(allianceIdParam, historyId, docId, status, markedBy) {
        try {
            if (!db || !historyId || !docId) {
                return { ok: false, error: 'Not available' };
            }
            var updatePayload = {
                status: status,
                markedBy: markedBy,
                markedAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            // Write to alliance path if available
            if (allianceIdParam) {
                await db.collection('alliances').doc(allianceIdParam)
                    .collection('event_history').doc(historyId)
                    .collection('attendance').doc(docId)
                    .update(updatePayload);
            }
            // Write to game-scoped path (primary for solo, dual-write for alliance)
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newRef = getGameEventHistoryCollectionRef(resolvedGameId);
                    if (newRef) {
                        await newRef.doc(historyId).collection('player_stats').doc(docId).update(updatePayload);
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write updateAttendanceStatus to game-scoped path failed:', dualWriteErr.message);
                }
            }
            return { ok: true };
        } catch (err) {
            console.error('updateAttendanceStatus error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function finalizeEventHistory(allianceIdParam, historyId, playerStatsUpdates) {
        try {
            if (!db || !historyId) {
                return { ok: false, error: 'Not available' };
            }
            var updates = Array.isArray(playerStatsUpdates) ? playerStatsUpdates : [];
            // Write to alliance path if available
            if (allianceIdParam) {
                var batch = db.batch();
                var historyRef = db.collection('alliances').doc(allianceIdParam)
                    .collection('event_history').doc(historyId);
                batch.update(historyRef, {
                    finalized: true,
                    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                updates.forEach(function(entry) {
                    var statsRef = db.collection('alliances').doc(allianceIdParam)
                        .collection('player_stats').doc(entry.docId);
                    batch.set(statsRef, Object.assign({}, entry.stats, {
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    }), { merge: true });
                });
                await batch.commit();
            }
            // Dual-write finalization to game-scoped paths
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newHistoryCollection = getGameEventHistoryCollectionRef(resolvedGameId);
                    if (newHistoryCollection) {
                        var newBatch = db.batch();
                        newBatch.update(newHistoryCollection.doc(historyId), {
                            finalized: true,
                            completedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        });
                        updates.forEach(function(entry) {
                            // In the new model, player_stats live under event_history
                            var newStatsRef = newHistoryCollection.doc(historyId).collection('player_stats').doc(entry.docId);
                            newBatch.set(newStatsRef, Object.assign({}, entry.stats, {
                                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            }), { merge: true });
                        });
                        await newBatch.commit();
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game event_history finalization failed:', dualWriteErr.message);
                }
            }
            return { ok: true };
        } catch (err) {
            console.error('finalizeEventHistory error:', err);
            return { ok: false, error: err.message };
        }
    }

    // Enforce max N active history records per eventTypeId.
    // Soft-deletes (sets active=false) on oldest records beyond the limit.
    async function enforceEventHistoryLimit(allianceIdParam, eventTypeId, limit) {
        try {
            if (!db || !eventTypeId) {
                return { ok: true };
            }
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            var historyRef = null;
            if (resolvedGameId) {
                historyRef = getGameEventHistoryCollectionRef(resolvedGameId);
            }
            if (!historyRef && allianceIdParam) {
                historyRef = db.collection('alliances').doc(allianceIdParam).collection('event_history');
            }
            if (!historyRef) {
                return { ok: true };
            }

            var snapshot = await historyRef
                .where('eventTypeId', '==', eventTypeId)
                .where('active', '==', true)
                .orderBy('createdAt', 'asc')
                .get();

            if (!snapshot || snapshot.size <= limit) {
                return { ok: true };
            }

            // Soft-delete oldest records beyond the limit
            var excess = snapshot.size - limit;
            var batch = db.batch();
            var count = 0;
            snapshot.forEach(function(doc) {
                if (count < excess) {
                    batch.update(doc.ref, { active: false });
                    // Also update alliance path if dual-writing
                    if (allianceIdParam && resolvedGameId) {
                        try {
                            var allianceRef = db.collection('alliances').doc(allianceIdParam)
                                .collection('event_history').doc(doc.id);
                            batch.update(allianceRef, { active: false });
                        } catch (_e) { /* best-effort dual-write */ }
                    }
                }
                count++;
            });
            await batch.commit();
            return { ok: true, deactivated: excess };
        } catch (err) {
            console.warn('enforceEventHistoryLimit error:', err.message);
            return { ok: false, error: err.message };
        }
    }

    async function deactivateHistoryRecord(allianceIdParam, historyId) {
        try {
            if (!db || !historyId) {
                return { ok: false, error: 'Not available' };
            }
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                var gameRef = getGameEventHistoryCollectionRef(resolvedGameId);
                if (gameRef) {
                    await gameRef.doc(historyId).update({ active: false });
                }
            }
            if (allianceIdParam) {
                try {
                    await db.collection('alliances').doc(allianceIdParam)
                        .collection('event_history').doc(historyId).update({ active: false });
                } catch (_e) { /* best-effort dual-write */ }
            }
            return { ok: true };
        } catch (err) {
            console.error('deactivateHistoryRecord error:', err);
            return { ok: false, error: err.message };
        }
    }

    // Canonical aliases — gateway contract uses these exact names
    async function saveHistoryRecord(allianceId, record) {
        return saveEventHistoryRecord(allianceId, record);
    }

    async function loadHistoryRecords(allianceId, filters) {
        return loadEventHistoryRecords(allianceId, filters);
    }

    async function loadAttendance(allianceId, historyId) {
        return loadEventAttendance(allianceId, historyId);
    }

    async function finalizeHistory(allianceId, historyId, playerStatsUpdates) {
        return finalizeEventHistory(allianceId, historyId, playerStatsUpdates);
    }

    async function loadPlayerStats(allianceIdParam, playerDocIds) {
        try {
            if (!db || !allianceIdParam || !Array.isArray(playerDocIds) || playerDocIds.length === 0) {
                return {};
            }
            var result = {};
            // Try game-scoped path first: player_stats now live under event_history
            // But loadPlayerStats reads by docId from a flat collection — in the new model
            // player_stats are nested under event_history/{historyId}/player_stats.
            // For backward compat, still read from root alliance player_stats.
            // The finalizeEventHistory dual-write already writes to the new nested path.
            var collection = db.collection('alliances').doc(allianceIdParam)
                .collection('player_stats');
            var promises = playerDocIds.map(function(docId) {
                return collection.doc(docId).get().then(function(doc) {
                    if (doc.exists) {
                        result[docId] = doc.data();
                    }
                });
            });
            await Promise.all(promises);
            return result;
        } catch (err) {
            console.error('loadPlayerStats error:', err);
            return {};
        }
    }

    async function upsertPlayerStats(allianceIdParam, docId, stats) {
        try {
            if (!db || !allianceIdParam || !docId) {
                return { ok: false, error: 'Not available' };
            }
            var payload = Object.assign({}, stats, {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('alliances').doc(allianceIdParam)
                .collection('player_stats').doc(docId)
                .set(payload, { merge: true });
            // Note: In the new model, player_stats are nested under event_history/{historyId}/player_stats.
            // The dual-write for those happens in finalizeEventHistory. This flat collection
            // is legacy-only and will be removed at cutover.
            return { ok: true };
        } catch (err) {
            console.error('upsertPlayerStats error:', err);
            return { ok: false, error: err.message };
        }
    }

    function subscribePendingFinalizationCount(allianceIdParam, callback) {
        if (!db || !allianceIdParam || typeof callback !== 'function') {
            return function noop() {};
        }
        var counts = { legacy: 0, game: 0 };
        var unsubFns = [];

        function emit() {
            // If game-scoped subscription has data, prefer it; otherwise use legacy
            callback(counts.game > 0 ? counts.game : counts.legacy);
        }

        var legacyUnsub = db.collection('alliances').doc(allianceIdParam)
            .collection('event_history')
            .where('active', '==', true)
            .where('finalized', '==', false)
            .onSnapshot(function(snapshot) {
                counts.legacy = snapshot.size;
                emit();
            }, function(err) {
                console.error('subscribePendingFinalizationCount error:', err);
                counts.legacy = 0;
                emit();
            });
        unsubFns.push(legacyUnsub);

        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        var newHistoryRef = resolvedGameId ? getGameEventHistoryCollectionRef(resolvedGameId) : null;
        if (newHistoryRef) {
            try {
                var gameUnsub = newHistoryRef
                    .where('active', '==', true)
                    .onSnapshot(function(snapshot) {
                        var count = 0;
                        snapshot.forEach(function(doc) {
                            var data = doc.data();
                            if (data.allianceId === allianceIdParam && data.finalized === false) {
                                count++;
                            }
                        });
                        counts.game = count;
                        emit();
                    }, function(err) {
                        console.warn('⚠️ subscribePendingFinalizationCount game-scoped error:', err.message);
                        counts.game = 0;
                        emit();
                    });
                unsubFns.push(gameUnsub);
            } catch (err) {
                console.warn('⚠️ subscribePendingFinalizationCount could not subscribe to game-scoped path:', err.message);
            }
        }

        return function unsubscribe() {
            unsubFns.forEach(function(fn) { fn(); });
        };
    }

    // ============================================================
    // PLAYER UPDATES (TOKENS & PENDING UPDATES)
    // ============================================================

    function hasTokenSnapshotValues(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            return false;
        }
        var hasPower = snapshot.power !== null && snapshot.power !== undefined && snapshot.power !== '';
        var hasThp = snapshot.thp !== null && snapshot.thp !== undefined && snapshot.thp !== '';
        var hasTroops = typeof snapshot.troops === 'string' && snapshot.troops.trim() !== '';
        return hasPower || hasThp || hasTroops;
    }

    function getTokenMaxSubmissions(tokenDoc) {
        var parsed = tokenDoc && tokenDoc.maxSubmissions != null ? Number(tokenDoc.maxSubmissions) : NaN;
        if (!Number.isFinite(parsed) || parsed <= 0) {
            return 1;
        }
        return Math.floor(parsed);
    }

    function getTokenSubmissionCount(tokenDoc) {
        var parsed = tokenDoc && tokenDoc.submissionCount != null ? Number(tokenDoc.submissionCount) : 0;
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return Math.floor(parsed);
    }

    function isTokenAvailable(tokenDoc) {
        if (!tokenDoc || typeof tokenDoc !== 'object') {
            return false;
        }
        if (tokenDoc.used === true) {
            return false;
        }
        return getTokenSubmissionCount(tokenDoc) < getTokenMaxSubmissions(tokenDoc);
    }

    function getPlayerEntryByName(playerMap, playerName) {
        if (!playerMap || typeof playerMap !== 'object') {
            return null;
        }
        var normalizedName = normalizeEditablePlayerName(playerName);
        if (!normalizedName) {
            return null;
        }
        if (Object.prototype.hasOwnProperty.call(playerMap, normalizedName)) {
            return playerMap[normalizedName];
        }

        var wanted = normalizedName.toLowerCase();
        var keys = Object.keys(playerMap);
        for (var i = 0; i < keys.length; i += 1) {
            var candidate = normalizeEditablePlayerName(keys[i]).toLowerCase();
            if (candidate === wanted) {
                return playerMap[keys[i]];
            }
        }
        return null;
    }

    function getPlayerEntryByKey(playerMap, playerKey) {
        if (!playerMap || typeof playerMap !== 'object') {
            return null;
        }
        var normalizedKey = typeof playerKey === 'string' ? playerKey.trim() : '';
        if (!normalizedKey) {
            return null;
        }
        var keys = Object.keys(playerMap);
        for (var i = 0; i < keys.length; i += 1) {
            var candidateName = normalizeEditablePlayerName(keys[i]);
            if (!candidateName) {
                continue;
            }
            if (getPlayerDocId(candidateName) === normalizedKey) {
                return {
                    name: candidateName,
                    entry: playerMap[keys[i]],
                };
            }
        }
        return null;
    }

    function buildSnapshotFromEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return {};
        }
        return {
            power: normalizeEditablePlayerPower(entry.power),
            thp: normalizeEditablePlayerThp(entry.thp),
            troops: normalizeEditablePlayerTroops(entry.troops),
        };
    }

    function buildSharedInviteSearchPrefixes(playerName) {
        var normalized = normalizeEditablePlayerName(playerName).toLowerCase();
        if (!normalized || normalized.length < 3) {
            return [];
        }
        var prefixes = [];
        for (var index = 3; index <= normalized.length; index += 1) {
            prefixes.push(normalized.slice(0, index));
        }
        return prefixes;
    }

    function buildPowerBand(powerValue) {
        var numericPower = normalizeEditablePlayerPower(powerValue);
        var bandStart = Math.floor(numericPower / 50) * 50;
        var bandEnd = bandStart + 49;
        return {
            code: String(bandStart) + '-' + String(bandEnd),
            min: bandStart,
            max: bandEnd,
            label: String(bandStart) + '-' + String(bandEnd) + 'M',
        };
    }

    function buildSharedInviteCandidateDoc(playerName, entry) {
        var normalizedName = normalizeEditablePlayerName(playerName);
        if (!normalizedName) {
            return null;
        }
        var snapshot = buildSnapshotFromEntry(entry);
        var powerBand = buildPowerBand(snapshot.power);
        return {
            playerName: normalizedName,
            playerKey: getPlayerDocId(normalizedName),
            searchName: normalizedName.toLowerCase(),
            searchPrefixes: buildSharedInviteSearchPrefixes(normalizedName),
            verifyTroops: normalizeEditablePlayerTroops(snapshot.troops),
            verifyPowerBand: powerBand.code,
            verifyPowerBandLabel: powerBand.label,
            currentSnapshot: snapshot,
        };
    }

    function resolveTokenPlayerContext(contextType, playerName, playerKey, gameId) {
        var resolvedGameId = normalizeGameId(gameId || activeGameplayGameId) || DEFAULT_GAME_ID;
        var primaryMap = {};
        var fallbackMap = {};

        if (contextType === 'alliance') {
            if (allianceData && typeof allianceData === 'object' && allianceData.playerDatabase && typeof allianceData.playerDatabase === 'object') {
                primaryMap = normalizePlayerDatabaseMap(allianceData.playerDatabase);
            } else {
                primaryMap = getAlliancePlayerDatabase({ gameId: resolvedGameId });
            }
            fallbackMap = getPlayerDatabase({ gameId: resolvedGameId });
        } else {
            primaryMap = getPlayerDatabase({ gameId: resolvedGameId });
            fallbackMap = getAlliancePlayerDatabase({ gameId: resolvedGameId });
        }

        var fromKey = getPlayerEntryByKey(primaryMap, playerKey) || getPlayerEntryByKey(fallbackMap, playerKey);
        var resolvedName = fromKey && fromKey.name ? fromKey.name : '';
        var entry = fromKey && fromKey.entry ? fromKey.entry : null;

        if (!entry) {
            entry = getPlayerEntryByName(primaryMap, playerName) || getPlayerEntryByName(fallbackMap, playerName);
        }
        if (!resolvedName) {
            resolvedName = normalizeEditablePlayerName(playerName);
        }

        var snapshot = buildSnapshotFromEntry(entry);
        return {
            playerName: resolvedName || normalizeEditablePlayerName(playerName) || '',
            playerKey: (resolvedName ? getPlayerDocId(resolvedName) : (typeof playerKey === 'string' ? playerKey.trim() : '')) || '',
            currentSnapshot: hasTokenSnapshotValues(snapshot) ? snapshot : {},
        };
    }

    function resolveTokenCurrentSnapshot(contextType, playerName, gameId) {
        return resolveTokenPlayerContext(contextType, playerName, '', gameId).currentSnapshot;
    }

    async function saveTokenBatch(allianceIdParam, tokenDocs) {
        try {
            if (!db || !allianceIdParam || !Array.isArray(tokenDocs)) {
                return { ok: false, error: 'Not available' };
            }
            var batch = db.batch();
            var tokenIds = [];
            var collection = db.collection('alliances').doc(allianceIdParam)
                .collection('update_tokens');
            tokenDocs.forEach(function(entry) {
                var ref = collection.doc();
                tokenIds.push(ref.id);
                batch.set(ref, Object.assign({}, entry.doc, {
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                }));
            });
            await batch.commit();
            // Dual-write to game-scoped alliance update_tokens
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newTokensCollection = getGameAllianceUpdateTokensCollectionRef(resolvedGameId, allianceIdParam);
                    if (newTokensCollection) {
                        var newBatch = db.batch();
                        tokenIds.forEach(function(tokenId, idx) {
                            var entry = tokenDocs[idx];
                            newBatch.set(newTokensCollection.doc(tokenId), Object.assign({}, entry.doc, {
                                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            }));
                        });
                        await newBatch.commit();
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game alliance update_tokens failed:', dualWriteErr.message);
                }
            }
            return { ok: true, tokenIds: tokenIds };
        } catch (err) {
            console.error('saveTokenBatch error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function loadPendingUpdates(allianceIdParam, status) {
        // Try new game-centric alliance path first
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        if (resolvedGameId && allianceIdParam) {
            try {
                var newRef = getGameAlliancePendingUpdatesCollectionRef(resolvedGameId, allianceIdParam);
                if (newRef) {
                    var newQuery = newRef;
                    if (status && status !== 'all') {
                        newQuery = newQuery.where('status', '==', status);
                    }
                    var newSnapshot = await newQuery.get();
                    if (newSnapshot && !newSnapshot.empty) {
                        var newResults = [];
                        newSnapshot.forEach(function(doc) {
                            var tokenData = Object.assign({ id: doc.id }, doc.data());
                            if (isTokenAvailable(tokenData)) {
                                newResults.push(tokenData);
                            }
                        });
                        return newResults;
                    }
                }
            } catch (newPathErr) {
                console.warn('⚠️ New-path pending updates read failed, falling back to legacy:', newPathErr.message);
            }
        }
        // Fall back to old path
        try {
            if (!db || !allianceIdParam) {
                return [];
            }
            var query = db.collection('alliances').doc(allianceIdParam)
                .collection('pending_updates');
            if (status && status !== 'all') {
                query = query.where('status', '==', status);
            }
            var snapshot = await query.get();
            var results = [];
            snapshot.forEach(function(doc) {
                results.push(Object.assign({ id: doc.id }, doc.data()));
            });
            return results;
        } catch (err) {
            console.error('loadPendingUpdates error:', err);
            return [];
        }
    }

    function buildGameIdCandidates(primaryGameId) {
        var seen = {};
        var candidates = [];
        function pushCandidate(candidate) {
            var normalized = normalizeGameId(candidate);
            if (!normalized || seen[normalized]) {
                return;
            }
            seen[normalized] = true;
            candidates.push(normalized);
        }
        pushCandidate(primaryGameId);
        pushCandidate(activeGameplayGameId);
        pushCandidate(DEFAULT_GAME_ID);
        return candidates;
    }

    async function updatePendingUpdateStatus(allianceIdParam, updateId, decision, gameIdParam) {
        try {
            if (!db || !allianceIdParam || !updateId) {
                return { ok: false, error: 'Not available' };
            }
            var updateTasks = [];
            var candidateGameIds = buildGameIdCandidates(gameIdParam);
            candidateGameIds.forEach(function(candidateGameId) {
                var newRef = getGameAlliancePendingUpdatesCollectionRef(candidateGameId, allianceIdParam);
                if (newRef) {
                    updateTasks.push(
                        newRef.doc(updateId).update(decision).catch(function(err) {
                            console.warn('⚠️ Game-scoped alliance pending_updates status update failed (' + candidateGameId + '):', err && err.message ? err.message : err);
                            throw err;
                        })
                    );
                }
            });
            updateTasks.push(
                db.collection('alliances').doc(allianceIdParam)
                    .collection('pending_updates').doc(updateId)
                    .update(decision)
                    .catch(function(err) {
                        console.warn('⚠️ Legacy alliance pending_updates status update failed:', err && err.message ? err.message : err);
                        throw err;
                    })
            );

            var settled = await Promise.allSettled(updateTasks);
            var succeeded = settled.some(function(result) { return result.status === 'fulfilled'; });
            if (succeeded) {
                return { ok: true };
            }

            var firstError = settled.find(function(result) { return result.status === 'rejected'; });
            var reason = firstError ? firstError.reason : null;
            return { ok: false, error: reason && reason.message ? reason.message : 'status_update_failed' };
        } catch (err) {
            console.error('updatePendingUpdateStatus error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function revokeToken(allianceIdParam, tokenId) {
        try {
            if (!db || !allianceIdParam || !tokenId) {
                return { ok: false, error: 'Not available' };
            }
            await db.collection('alliances').doc(allianceIdParam)
                .collection('update_tokens').doc(tokenId)
                .update({
                    used: true,
                    usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
            // Dual-write to game-scoped alliance update_tokens
            var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newRef = getGameAllianceUpdateTokensCollectionRef(resolvedGameId, allianceIdParam);
                    if (newRef) {
                        await newRef.doc(tokenId).update({
                            used: true,
                            usedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game alliance update_tokens revoke failed:', dualWriteErr.message);
                }
            }
            return { ok: true };
        } catch (err) {
            console.error('revokeToken error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function createUpdateToken(allianceIdParam, playerName, options) {
        try {
            if (!db || !allianceIdParam || !playerName) {
                return { success: false, error: 'Not available' };
            }
            var opts = options && typeof options === 'object' ? options : {};
            var tokenGameId = normalizeGameId(opts.gameId || activeGameplayGameId) || null;
            var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : 48;
            var maxSubmissions = Number.isFinite(Number(opts.maxSubmissions)) && Number(opts.maxSubmissions) > 0
                ? Math.floor(Number(opts.maxSubmissions))
                : 3;
            var expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            var resolvedTokenPlayer = resolveTokenPlayerContext(
                'alliance',
                playerName,
                typeof opts.playerKey === 'string' ? opts.playerKey : '',
                tokenGameId || DEFAULT_GAME_ID
            );
            var tokenPlayerName = resolvedTokenPlayer.playerName || normalizeEditablePlayerName(playerName) || playerName;
            var tokenPlayerKey = resolvedTokenPlayer.playerKey || getPlayerDocId(tokenPlayerName);
            if (!tokenPlayerKey) {
                return { success: false, error: 'missing_player_key' };
            }
            var currentSnapshot = (opts.currentSnapshot && typeof opts.currentSnapshot === 'object')
                ? buildSnapshotFromEntry(opts.currentSnapshot)
                : (resolvedTokenPlayer.currentSnapshot || {});
            var tokenDoc = {
                contextType: 'alliance',
                allianceId: allianceIdParam,
                ownerUid: currentUser ? currentUser.uid : null,
                gameId: tokenGameId,
                playerName: tokenPlayerName,
                playerKey: tokenPlayerKey,
                expiryHours: expiryHours,
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                maxSubmissions: maxSubmissions,
                submissionCount: 0,
                used: false,
                lastSubmittedAt: null,
                lastSubmittedByAnonUid: null,
                currentSnapshot: currentSnapshot,
                createdBy: currentUser ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            var docRef = await db.collection('alliances').doc(allianceIdParam)
                .collection('update_tokens')
                .add(tokenDoc);
            // Dual-write to game-scoped alliance update_tokens
            var resolvedGameId = normalizeGameId(tokenGameId || activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newTokensCollection = getGameAllianceUpdateTokensCollectionRef(resolvedGameId, allianceIdParam);
                    if (newTokensCollection) {
                        await newTokensCollection.doc(docRef.id).set(tokenDoc);
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game alliance update_tokens create failed:', dualWriteErr.message);
                }
            }
            return { success: true, tokenId: docRef.id };
        } catch (err) {
            console.error('createUpdateToken error:', err);
            return { success: false, error: err.message };
        }
    }

    async function loadActiveTokens(allianceIdParam) {
        // Try new game-centric alliance path first
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        if (resolvedGameId && allianceIdParam) {
            try {
                var newRef = getGameAllianceUpdateTokensCollectionRef(resolvedGameId, allianceIdParam);
                if (newRef) {
                    var newSnapshot = await newRef.where('used', '==', false).get();
                    if (newSnapshot && !newSnapshot.empty) {
                        var newResults = [];
                        newSnapshot.forEach(function(doc) {
                            newResults.push(Object.assign({ id: doc.id }, doc.data()));
                        });
                        return newResults;
                    }
                }
            } catch (newPathErr) {
                console.warn('⚠️ New-path active tokens read failed, falling back to legacy:', newPathErr.message);
            }
        }
        // Fall back to old path
        try {
            if (!db || !allianceIdParam) {
                return [];
            }
            var snapshot = await db.collection('alliances').doc(allianceIdParam)
                .collection('update_tokens')
                .where('used', '==', false)
                .get();
            var results = [];
            snapshot.forEach(function(doc) {
                var tokenData = Object.assign({ id: doc.id }, doc.data());
                if (isTokenAvailable(tokenData)) {
                    results.push(tokenData);
                }
            });
            return results;
        } catch (err) {
            console.error('loadActiveTokens error:', err);
            return [];
        }
    }

    async function createPersonalUpdateToken(uid, playerName, options) {
        try {
            if (!db || !uid || !playerName) {
                return { success: false, error: 'Not available' };
            }
            var opts = options && typeof options === 'object' ? options : {};
            var tokenGameId = normalizeGameId(opts.gameId || activeGameplayGameId) || null;
            var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : 48;
            var maxSubmissions = Number.isFinite(Number(opts.maxSubmissions)) && Number(opts.maxSubmissions) > 0
                ? Math.floor(Number(opts.maxSubmissions))
                : 3;
            var expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            var resolvedTokenPlayer = resolveTokenPlayerContext(
                'personal',
                playerName,
                typeof opts.playerKey === 'string' ? opts.playerKey : '',
                tokenGameId || DEFAULT_GAME_ID
            );
            var tokenPlayerName = resolvedTokenPlayer.playerName || normalizeEditablePlayerName(playerName) || playerName;
            var tokenPlayerKey = resolvedTokenPlayer.playerKey || getPlayerDocId(tokenPlayerName);
            if (!tokenPlayerKey) {
                return { success: false, error: 'missing_player_key' };
            }
            var currentSnapshot = (opts.currentSnapshot && typeof opts.currentSnapshot === 'object')
                ? buildSnapshotFromEntry(opts.currentSnapshot)
                : (resolvedTokenPlayer.currentSnapshot || {});
            var tokenDoc = {
                contextType: 'personal',
                ownerUid: uid,
                gameId: tokenGameId,
                allianceId: null,
                playerName: tokenPlayerName,
                playerKey: tokenPlayerKey,
                expiryHours: expiryHours,
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                maxSubmissions: maxSubmissions,
                submissionCount: 0,
                used: false,
                lastSubmittedAt: null,
                lastSubmittedByAnonUid: null,
                currentSnapshot: currentSnapshot,
                createdBy: currentUser ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            var docRef = await db.collection('users').doc(uid)
                .collection('update_tokens')
                .add(tokenDoc);
            // Dual-write to game-scoped solo update_tokens
            var resolvedGameId = normalizeGameId(tokenGameId || activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newTokensCollection = getGameSoloUpdateTokensCollectionRef(resolvedGameId, uid);
                    if (newTokensCollection) {
                        await newTokensCollection.doc(docRef.id).set(tokenDoc);
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game solo update_tokens create failed:', dualWriteErr.message);
                }
            }
            return { success: true, tokenId: docRef.id };
        } catch (err) {
            console.error('createPersonalUpdateToken error:', err);
            return { success: false, error: err.message };
        }
    }

    async function createPersonalSharedUpdateInvite(uid, players, options) {
        try {
            if (!db || !uid || !Array.isArray(players) || players.length === 0) {
                return { success: false, error: 'missing_players' };
            }
            var opts = options && typeof options === 'object' ? options : {};
            var inviteGameId = normalizeGameId(opts.gameId || activeGameplayGameId) || DEFAULT_GAME_ID;
            var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : 48;
            var expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            var maxVerificationAttempts = Number.isFinite(Number(opts.maxVerificationAttempts)) && Number(opts.maxVerificationAttempts) > 0
                ? Math.floor(Number(opts.maxVerificationAttempts))
                : 3;
            var inviteCollection = getGameSoloSharedUpdateInvitesCollectionRef(inviteGameId, uid);
            if (!inviteCollection) {
                return { success: false, error: 'Not available' };
            }
            var candidateDocs = players.map(function(player) {
                return buildSharedInviteCandidateDoc(player && player.name, player);
            }).filter(function(candidate) {
                return !!(candidate && candidate.playerKey);
            });
            if (candidateDocs.length === 0) {
                return { success: false, error: 'missing_players' };
            }
            var inviteRef = inviteCollection.doc();
            var batch = db.batch();
            var inviteDoc = {
                contextType: 'personal',
                ownerUid: uid,
                allianceId: null,
                gameId: inviteGameId,
                active: true,
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                searchMinLength: 3,
                maxSearchResults: 3,
                maxVerificationAttempts: maxVerificationAttempts,
                playerCount: candidateDocs.length,
                createdBy: currentUser ? currentUser.uid : uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            batch.set(inviteRef, inviteDoc);
            candidateDocs.forEach(function(candidate) {
                var candidateRef = getGameSoloSharedUpdateInviteCandidatesCollectionRef(inviteGameId, uid, inviteRef.id).doc(candidate.playerKey);
                batch.set(candidateRef, candidate);
            });
            await batch.commit();
            return { success: true, inviteId: inviteRef.id };
        } catch (err) {
            console.error('createPersonalSharedUpdateInvite error:', err);
            return { success: false, error: err.message };
        }
    }

    async function createAllianceSharedUpdateInvite(allianceIdParam, players, options) {
        try {
            if (!db || !allianceIdParam || !Array.isArray(players) || players.length === 0) {
                return { success: false, error: 'missing_players' };
            }
            var opts = options && typeof options === 'object' ? options : {};
            var inviteGameId = normalizeGameId(opts.gameId || activeGameplayGameId) || DEFAULT_GAME_ID;
            var expiryHours = typeof opts.expiryHours === 'number' ? opts.expiryHours : 48;
            var expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
            var maxVerificationAttempts = Number.isFinite(Number(opts.maxVerificationAttempts)) && Number(opts.maxVerificationAttempts) > 0
                ? Math.floor(Number(opts.maxVerificationAttempts))
                : 3;
            var inviteCollection = getGameAllianceSharedUpdateInvitesCollectionRef(inviteGameId, allianceIdParam);
            if (!inviteCollection) {
                return { success: false, error: 'Not available' };
            }
            var candidateDocs = players.map(function(player) {
                return buildSharedInviteCandidateDoc(player && player.name, player);
            }).filter(function(candidate) {
                return !!(candidate && candidate.playerKey);
            });
            if (candidateDocs.length === 0) {
                return { success: false, error: 'missing_players' };
            }
            var inviteRef = inviteCollection.doc();
            var batch = db.batch();
            var inviteDoc = {
                contextType: 'alliance',
                ownerUid: currentUser ? currentUser.uid : null,
                allianceId: allianceIdParam,
                gameId: inviteGameId,
                active: true,
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                searchMinLength: 3,
                maxSearchResults: 3,
                maxVerificationAttempts: maxVerificationAttempts,
                playerCount: candidateDocs.length,
                createdBy: currentUser ? currentUser.uid : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            batch.set(inviteRef, inviteDoc);
            candidateDocs.forEach(function(candidate) {
                var candidateRef = getGameAllianceSharedUpdateInviteCandidatesCollectionRef(inviteGameId, allianceIdParam, inviteRef.id).doc(candidate.playerKey);
                batch.set(candidateRef, candidate);
            });
            await batch.commit();
            return { success: true, inviteId: inviteRef.id };
        } catch (err) {
            console.error('createAllianceSharedUpdateInvite error:', err);
            return { success: false, error: err.message };
        }
    }

    async function createPersonalPendingUpdate(uid, pendingUpdateDoc) {
        try {
            if (!db || !uid || !pendingUpdateDoc) {
                return { ok: false, error: 'Not available' };
            }
            if (!(pendingUpdateDoc.playerKey && typeof pendingUpdateDoc.playerKey === 'string' && pendingUpdateDoc.playerKey.trim())) {
                return { ok: false, error: 'missing_player_key' };
            }
            var docRef = await db.collection('users').doc(uid)
                .collection('pending_updates')
                .add(pendingUpdateDoc);
            // Dual-write to game-scoped solo pending_updates
            var resolvedGameId = normalizeGameId((pendingUpdateDoc && pendingUpdateDoc.gameId) || activeGameplayGameId) || DEFAULT_GAME_ID;
            if (resolvedGameId) {
                try {
                    var newRef = getGameSoloPendingUpdatesCollectionRef(resolvedGameId, uid);
                    if (newRef) {
                        await newRef.doc(docRef.id).set(pendingUpdateDoc);
                    }
                } catch (dualWriteErr) {
                    console.warn('⚠️ Dual-write to game solo pending_updates create failed:', dualWriteErr.message);
                }
            }
            return { ok: true, updateId: docRef.id };
        } catch (err) {
            console.error('createPersonalPendingUpdate error:', err);
            return { ok: false, error: err.message };
        }
    }

    async function loadPersonalPendingUpdates(uid, status) {
        // Try new game-centric solo path first
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        if (resolvedGameId && uid) {
            try {
                var newRef = getGameSoloPendingUpdatesCollectionRef(resolvedGameId, uid);
                if (newRef) {
                    var newQuery = newRef;
                    if (status && status !== 'all') {
                        newQuery = newQuery.where('status', '==', status);
                    }
                    var newSnapshot = await newQuery.get();
                    if (newSnapshot && !newSnapshot.empty) {
                        var newResults = [];
                        newSnapshot.forEach(function(doc) {
                            newResults.push(Object.assign({ id: doc.id }, doc.data()));
                        });
                        return newResults;
                    }
                }
            } catch (newPathErr) {
                console.warn('⚠️ New-path personal pending updates read failed, falling back to legacy:', newPathErr.message);
            }
        }
        // Fall back to old path
        try {
            if (!db || !uid) {
                return [];
            }
            var query = db.collection('users').doc(uid)
                .collection('pending_updates');
            if (status && status !== 'all') {
                query = query.where('status', '==', status);
            }
            var snapshot = await query.get();
            var results = [];
            snapshot.forEach(function(doc) {
                results.push(Object.assign({ id: doc.id }, doc.data()));
            });
            return results;
        } catch (err) {
            console.error('loadPersonalPendingUpdates error:', err);
            return [];
        }
    }

    async function updatePersonalPendingUpdateStatus(uid, updateId, decision, gameIdParam) {
        try {
            if (!db || !uid || !updateId) {
                return { ok: false, error: 'Not available' };
            }
            var updateTasks = [];
            var candidateGameIds = buildGameIdCandidates(gameIdParam);
            candidateGameIds.forEach(function(candidateGameId) {
                var newRef = getGameSoloPendingUpdatesCollectionRef(candidateGameId, uid);
                if (newRef) {
                    updateTasks.push(
                        newRef.doc(updateId).update(decision).catch(function(err) {
                            console.warn('⚠️ Game-scoped solo pending_updates status update failed (' + candidateGameId + '):', err && err.message ? err.message : err);
                            throw err;
                        })
                    );
                }
            });
            updateTasks.push(
                db.collection('users').doc(uid)
                    .collection('pending_updates').doc(updateId)
                    .update(decision)
                    .catch(function(err) {
                        console.warn('⚠️ Legacy solo pending_updates status update failed:', err && err.message ? err.message : err);
                        throw err;
                    })
            );

            var settled = await Promise.allSettled(updateTasks);
            var succeeded = settled.some(function(result) { return result.status === 'fulfilled'; });
            if (succeeded) {
                return { ok: true };
            }

            var firstError = settled.find(function(result) { return result.status === 'rejected'; });
            var reason = firstError ? firstError.reason : null;
            return { ok: false, error: reason && reason.message ? reason.message : 'status_update_failed' };
        } catch (err) {
            console.error('updatePersonalPendingUpdateStatus error:', err);
            return { ok: false, error: err.message };
        }
    }

    // ── Event Wiki ──────────────────────────────────────────────────────────

    async function loadEventWiki(eventId, context) {
        if (!db || !eventId) {
            return { success: false, error: 'Not available' };
        }
        try {
            var gameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            var source = getPlayerSource(context);
            var docRef = null;
            if (source === 'alliance' && allianceId) {
                docRef = getAllianceEventWikiDocRef(gameId, allianceId, eventId);
            } else {
                var user = currentUser;
                if (!user) { return { success: false, error: 'Not signed in' }; }
                docRef = getSoloEventWikiDocRef(gameId, user.uid, eventId);
            }
            if (!docRef) { return { success: false, error: 'Invalid path' }; }
            var snap = await docRef.get();
            if (!snap.exists) {
                return { success: true, data: null };
            }
            return { success: true, data: snap.data() };
        } catch (err) {
            console.error('loadEventWiki error:', err);
            return { success: false, error: err.message };
        }
    }

    async function saveEventWiki(eventId, wikiData, context) {
        if (!db || !eventId || !wikiData) {
            return { success: false, error: 'Not available' };
        }
        try {
            var gameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            var source = getPlayerSource(context);
            var user = currentUser;
            if (!user) { return { success: false, error: 'Not signed in' }; }
            var docRef = null;
            if (source === 'alliance' && allianceId) {
                docRef = getAllianceEventWikiDocRef(gameId, allianceId, eventId);
            } else {
                docRef = getSoloEventWikiDocRef(gameId, user.uid, eventId);
            }
            if (!docRef) { return { success: false, error: 'Invalid path' }; }
            var payload = Object.assign({}, wikiData, {
                eventId: eventId,
                gameId: gameId,
                lastEditedBy: user.uid,
                lastEditedByName: user.displayName || '',
                lastEditedAt: firebase.firestore.FieldValue.serverTimestamp(),
                ownerType: source === 'alliance' && allianceId ? 'alliance' : 'personal',
            });
            // Set createdBy only on first save
            var snap = await docRef.get();
            if (!snap.exists) {
                payload.createdBy = user.uid;
                payload.createdByName = user.displayName || '';
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            await docRef.set(payload, { merge: true });
            return { success: true };
        } catch (err) {
            console.error('saveEventWiki error:', err);
            return { success: false, error: err.message };
        }
    }

    async function deleteEventWiki(eventId, context) {
        if (!db || !eventId) {
            return { success: false, error: 'Not available' };
        }
        try {
            var gameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
            var source = getPlayerSource(context);
            var user = currentUser;
            if (!user) { return { success: false, error: 'Not signed in' }; }
            var docRef = null;
            if (source === 'alliance' && allianceId) {
                docRef = getAllianceEventWikiDocRef(gameId, allianceId, eventId);
            } else {
                docRef = getSoloEventWikiDocRef(gameId, user.uid, eventId);
            }
            if (!docRef) { return { success: false, error: 'Invalid path' }; }
            await docRef.delete();
            return { success: true };
        } catch (err) {
            console.error('deleteEventWiki error:', err);
            return { success: false, error: err.message };
        }
    }

    function getEventWikiUrl(eventId, context) {
        var gameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;
        var source = getPlayerSource(context);
        var base = 'event-wiki.html';
        var params = 'game=' + encodeURIComponent(gameId) + '&event=' + encodeURIComponent(eventId);
        if (source === 'alliance' && allianceId) {
            params += '&aid=' + encodeURIComponent(allianceId);
        } else if (currentUser) {
            params += '&uid=' + encodeURIComponent(currentUser.uid);
        }
        return base + '?' + params;
    }

    function getSoloEventWikiDocRef(gameId, uid, eventId) {
        return DSFirebaseInfra.getSoloEventWikiDocRef(gameId, uid, eventId);
    }
    function getAllianceEventWikiDocRef(gameId, allianceId, eventId) {
        return DSFirebaseInfra.getAllianceEventWikiDocRef(gameId, allianceId, eventId);
    }

    function subscribePendingUpdatesCount(allianceIdParam, uidParam, callback) {
        // Support old 2-arg call: subscribePendingUpdatesCount(allianceId, callback)
        if (typeof uidParam === 'function') {
            callback = uidParam;
            uidParam = null;
        }
        if (!db || typeof callback !== 'function') {
            return function noop() {};
        }

        var counts = { alliance: 0, personal: 0, gameAlliance: 0, gamePersonal: 0 };
        var unsubFns = [];
        var resolvedGameId = normalizeGameId(activeGameplayGameId) || DEFAULT_GAME_ID;

        function emit() {
            // Use game-scoped counts if available, otherwise fall back to legacy
            var allianceCount = counts.gameAlliance > 0 ? counts.gameAlliance : counts.alliance;
            var personalCount = counts.gamePersonal > 0 ? counts.gamePersonal : counts.personal;
            callback(allianceCount + personalCount);
        }

        if (allianceIdParam) {
            var unsubAlliance = db.collection('alliances').doc(allianceIdParam)
                .collection('pending_updates')
                .where('status', '==', 'pending')
                .onSnapshot(function(snap) {
                    counts.alliance = snap.size;
                    emit();
                }, function() { counts.alliance = 0; emit(); });
            unsubFns.push(unsubAlliance);

            // Also subscribe to game-scoped alliance pending_updates
            if (resolvedGameId) {
                try {
                    var newAllianceRef = getGameAlliancePendingUpdatesCollectionRef(resolvedGameId, allianceIdParam);
                    if (newAllianceRef) {
                        var unsubGameAlliance = newAllianceRef
                            .where('status', '==', 'pending')
                            .onSnapshot(function(snap) {
                                counts.gameAlliance = snap.size;
                                emit();
                            }, function() { counts.gameAlliance = 0; emit(); });
                        unsubFns.push(unsubGameAlliance);
                    }
                } catch (err) {
                    console.warn('⚠️ subscribePendingUpdatesCount game-alliance subscription failed:', err.message);
                }
            }
        }

        if (uidParam) {
            var unsubPersonal = db.collection('users').doc(uidParam)
                .collection('pending_updates')
                .where('status', '==', 'pending')
                .onSnapshot(function(snap) {
                    counts.personal = snap.size;
                    emit();
                }, function() { counts.personal = 0; emit(); });
            unsubFns.push(unsubPersonal);

            // Also subscribe to game-scoped personal pending_updates
            if (resolvedGameId) {
                try {
                    var newPersonalRef = getGameSoloPendingUpdatesCollectionRef(resolvedGameId, uidParam);
                    if (newPersonalRef) {
                        var unsubGamePersonal = newPersonalRef
                            .where('status', '==', 'pending')
                            .onSnapshot(function(snap) {
                                counts.gamePersonal = snap.size;
                                emit();
                            }, function() { counts.gamePersonal = 0; emit(); });
                        unsubFns.push(unsubGamePersonal);
                    }
                } catch (err) {
                    console.warn('⚠️ subscribePendingUpdatesCount game-personal subscription failed:', err.message);
                }
            }
        }

        return function unsubscribe() {
            unsubFns.forEach(function(fn) { fn(); });
        };
    }

    function resolvePlayerNameByKey(source, playerKey, gameId) {
        var normalizedKey = typeof playerKey === 'string' ? playerKey.trim() : '';
        if (!normalizedKey) {
            return '';
        }
        var gameContext = resolveGameplayContext('resolvePlayerNameByKey', gameId || null);
        var playerMap = source === 'alliance'
            ? getAlliancePlayerDatabase(gameContext)
            : getPlayerDatabase(gameContext);
        if (!playerMap || typeof playerMap !== 'object') {
            return '';
        }
        var names = Object.keys(playerMap);
        for (var i = 0; i < names.length; i += 1) {
            var candidateName = normalizeEditablePlayerName(names[i]);
            if (!candidateName) {
                continue;
            }
            if (getPlayerDocId(candidateName) === normalizedKey) {
                return candidateName;
            }
        }
        return '';
    }

    async function applyPlayerUpdateToPersonal(playerName, proposedValues, gameId, identifiers) {
        if (!currentUser) {
            return { ok: false, error: 'Not signed in' };
        }
        if (!proposedValues || proposedValues.power == null || proposedValues.thp == null || proposedValues.troops == null) {
            return { ok: false, error: 'snapshot_integrity_error' };
        }
        var identifiersBag = identifiers && typeof identifiers === 'object' ? identifiers : {};
        var resolvedPlayerName = resolvePlayerNameByKey('personal', identifiersBag.playerKey, gameId) || playerName;
        var nextPlayer = {
            name: resolvedPlayerName,
            power: proposedValues.power,
            thp: proposedValues.thp,
            troops: proposedValues.troops,
        };
        var gameContext = resolveGameplayContext('applyPlayerUpdateToPersonal', gameId || null);
        var result = await upsertPlayerEntry('personal', resolvedPlayerName, nextPlayer, gameContext);
        if (!result.success) {
            console.error('[FirebaseManager] applyPlayerUpdateToPersonal failed', {
                gameId: gameId || null,
                playerName: playerName,
                resolvedPlayerName: resolvedPlayerName,
                playerKey: identifiersBag.playerKey || '',
                error: result.errorKey || result.error || 'unknown',
            });
        }
        return result.success ? { ok: true } : { ok: false, error: result.errorKey || result.error };
    }

    async function applyPlayerUpdateToAlliance(playerName, proposedValues, gameId, identifiers) {
        if (!proposedValues || proposedValues.power == null || proposedValues.thp == null || proposedValues.troops == null) {
            return { ok: false, error: 'snapshot_integrity_error' };
        }
        var identifiersBag = identifiers && typeof identifiers === 'object' ? identifiers : {};
        var requestedGameId = normalizeGameId(gameId || activeGameplayGameId) || DEFAULT_GAME_ID;
        await setActiveAllianceGameContext(requestedGameId);
        var requestedAllianceId = typeof identifiersBag.allianceId === 'string' ? identifiersBag.allianceId.trim() : '';
        if (!allianceId && requestedAllianceId) {
            allianceId = requestedAllianceId;
        }
        if (requestedAllianceId && allianceId && requestedAllianceId !== allianceId) {
            return { ok: false, error: 'invalid-alliance-context' };
        }
        if (!currentUser || !allianceId) {
            return { ok: false, error: 'Not in alliance' };
        }
        if (!allianceData || typeof allianceData !== 'object') {
            var loadResult = await loadAllianceData({ gameId: requestedGameId });
            if (loadResult && loadResult.success === false) {
                return { ok: false, error: loadResult.errorKey || loadResult.error || 'players_list_error_no_alliance' };
            }
        }
        var resolvedPlayerName = resolvePlayerNameByKey('alliance', identifiersBag.playerKey, gameId) || playerName;
        var nextPlayer = {
            name: resolvedPlayerName,
            power: proposedValues.power,
            thp: proposedValues.thp,
            troops: proposedValues.troops,
        };
        var gameContext = resolveGameplayContext('applyPlayerUpdateToAlliance', gameId || null);
        var result = await upsertPlayerEntry('alliance', resolvedPlayerName, nextPlayer, gameContext);
        if (!result.success) {
            console.error('[FirebaseManager] applyPlayerUpdateToAlliance failed', {
                gameId: gameId || null,
                requestedGameId: requestedGameId,
                playerName: playerName,
                resolvedPlayerName: resolvedPlayerName,
                playerKey: identifiersBag.playerKey || '',
                allianceId: allianceId || null,
                requestedAllianceId: requestedAllianceId || null,
                error: result.errorKey || result.error || 'unknown',
            });
        }
        return result.success ? { ok: true } : { ok: false, error: result.errorKey || result.error };
    }

    // ============================================================
    // PUBLIC API
    // ============================================================

    return {
        // Initialization
        init: init,
        setAuthCallback: setAuthCallback,
        setDataLoadCallback: setDataLoadCallback,
        setAllianceDataCallback: setAllianceDataCallback,
        getFeatureFlags: resolveFeatureFlags,
        isFeatureFlagEnabled: isFeatureFlagEnabled,
        
        // Authentication
        signInWithGoogle: signInWithGoogle,
        signInWithEmail: signInWithEmail,
        signUpWithEmail: signUpWithEmail,
        resetPassword: resetPassword,
        signOut: signOut,
        deleteUserAccountAndData: deleteUserAccountAndData,
        getCurrentUser: getCurrentUser,
        isSignedIn: isSignedIn,
        
        // Database operations
        loadUserData: function loadUserDataGameAware(user, context) {
            const gameContext = resolveGameplayContext('loadUserData', context);
            return loadUserData(user, gameContext);
        },
        saveUserData: function saveUserDataGameAware(options, context) {
            const gameContext = resolveGameplayContext('saveUserData', context);
            return saveUserData(options, gameContext);
        },
        uploadPlayerDatabase: function uploadPlayerDatabaseGameAware(file, context) {
            const gameContext = resolveGameplayContext('uploadPlayerDatabase', context);
            return uploadPlayerDatabase(file, gameContext);
        },
        getPlayerDatabase: function getPlayerDatabaseGameAware(context) {
            const gameContext = resolveGameplayContext('getPlayerDatabase', context);
            return getPlayerDatabase(gameContext);
        },
        getPlayerCount: getPlayerCount,
        getPlayer: getPlayer,
        upsertPlayerEntry: function upsertPlayerEntryGameAware(source, originalName, nextPlayer, context) {
            const gameContext = resolveGameplayContext('upsertPlayerEntry', context);
            return upsertPlayerEntry(source, originalName, nextPlayer, gameContext);
        },
        removePlayerEntry: function removePlayerEntryGameAware(source, playerName, context) {
            const gameContext = resolveGameplayContext('removePlayerEntry', context);
            return removePlayerEntry(source, playerName, gameContext);
        },
        clearPersonalPlayerDatabase: function clearPersonalPlayerDatabaseGameAware(context) {
            const gameContext = resolveGameplayContext('clearPersonalPlayerDatabase', context);
            return clearPersonalPlayerDatabase(gameContext);
        },
        fillPersonalPlayerDatabase: function fillPersonalPlayerDatabaseGameAware(players, context) {
            const gameContext = resolveGameplayContext('fillPersonalPlayerDatabase', context);
            return fillPersonalPlayerDatabase(players, gameContext);
        },
        getAllEventData: function getAllEventDataGameAware(context) {
            const gameContext = resolveGameplayContext('getAllEventData', context);
            return getAllEventData(gameContext);
        },
        getEventIds: function getEventIdsGameAware(context) {
            const gameContext = resolveGameplayContext('getEventIds', context);
            return getEventIds(gameContext);
        },
        getEventMeta: function getEventMetaGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('getEventMeta', context);
            return getEventMeta(eventId, gameContext);
        },
        upsertEvent: function upsertEventGameAware(eventId, payload, context) {
            const gameContext = resolveGameplayContext('upsertEvent', context);
            return upsertEvent(eventId, payload, gameContext);
        },
        removeEvent: function removeEventGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('removeEvent', context);
            return removeEvent(eventId, gameContext);
        },
        setEventMetadata: function setEventMetadataGameAware(eventId, metadata, context) {
            const gameContext = resolveGameplayContext('setEventMetadata', context);
            return setEventMetadata(eventId, metadata, gameContext);
        },

        // Building config
        getBuildingConfig: function getBuildingConfigGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingConfig', context);
            return getBuildingConfig(eventId, gameContext);
        },
        setBuildingConfig: function setBuildingConfigGameAware(eventId, config, context) {
            const gameContext = resolveGameplayContext('setBuildingConfig', context);
            return setBuildingConfig(eventId, config, gameContext);
        },
        getBuildingConfigVersion: function getBuildingConfigVersionGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingConfigVersion', context);
            return getBuildingConfigVersion(eventId, gameContext);
        },
        setBuildingConfigVersion: function setBuildingConfigVersionGameAware(eventId, version, context) {
            const gameContext = resolveGameplayContext('setBuildingConfigVersion', context);
            return setBuildingConfigVersion(eventId, version, gameContext);
        },
        getBuildingPositions: function getBuildingPositionsGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingPositions', context);
            return getBuildingPositions(eventId, gameContext);
        },
        setBuildingPositions: function setBuildingPositionsGameAware(eventId, positions, context) {
            const gameContext = resolveGameplayContext('setBuildingPositions', context);
            return setBuildingPositions(eventId, positions, gameContext);
        },
        getBuildingPositionsVersion: function getBuildingPositionsVersionGameAware(eventId, context) {
            const gameContext = resolveGameplayContext('getBuildingPositionsVersion', context);
            return getBuildingPositionsVersion(eventId, gameContext);
        },
        setBuildingPositionsVersion: function setBuildingPositionsVersionGameAware(eventId, version, context) {
            const gameContext = resolveGameplayContext('setBuildingPositionsVersion', context);
            return setBuildingPositionsVersion(eventId, version, gameContext);
        },
        getGlobalDefaultBuildingConfig: getGlobalDefaultBuildingConfig,
        getGlobalDefaultBuildingConfigVersion: getGlobalDefaultBuildingConfigVersion,
        getGlobalDefaultBuildingPositions: getGlobalDefaultBuildingPositions,
        getGlobalDefaultBuildingPositionsVersion: getGlobalDefaultBuildingPositionsVersion,
        
        // Backup & restore
        exportBackup: exportBackup,
        restoreFromBackup: restoreFromBackup,
        
        // Templates
        generatePlayerDatabaseTemplate: generatePlayerDatabaseTemplate,
        generateTeamRosterTemplate: generateTeamRosterTemplate,

        // Game metadata admin
        isGameMetadataSuperAdmin: isGameMetadataSuperAdmin,
        listGameMetadata: listGameMetadata,
        getGameMetadata: getGameMetadata,
        setGameMetadata: setGameMetadata,

        // Alliance
        createAlliance: function createAllianceGameAware(name, context) {
            const gameContext = resolveGameplayContext('createAlliance', context);
            return createAlliance(name, gameContext);
        },
        leaveAlliance: function leaveAllianceGameAware(context) {
            const gameContext = resolveGameplayContext('leaveAlliance', context);
            return leaveAlliance(gameContext);
        },
        loadAllianceData: function loadAllianceDataGameAware(context) {
            const gameContext = resolveGameplayContext('loadAllianceData', context);
            return loadAllianceData(gameContext);
        },
        sendInvitation: function sendInvitationGameAware(email, context) {
            const gameContext = resolveGameplayContext('sendInvitation', context);
            return sendInvitation(email, gameContext);
        },
        checkInvitations: function checkInvitationsGameAware(context) {
            const gameContext = resolveGameplayContext('checkInvitations', context);
            return checkInvitations(gameContext);
        },
        acceptInvitation: function acceptInvitationGameAware(invitationId, context) {
            const gameContext = resolveGameplayContext('acceptInvitation', context);
            return acceptInvitation(invitationId, gameContext);
        },
        rejectInvitation: function rejectInvitationGameAware(invitationId, context) {
            const gameContext = resolveGameplayContext('rejectInvitation', context);
            return rejectInvitation(invitationId, gameContext);
        },
        revokeInvitation: function revokeInvitationGameAware(invitationId, context) {
            const gameContext = resolveGameplayContext('revokeInvitation', context);
            return revokeInvitation(invitationId, gameContext);
        },
        resendInvitation: function resendInvitationGameAware(invitationId, context) {
            const gameContext = resolveGameplayContext('resendInvitation', context);
            return resendInvitation(invitationId, gameContext);
        },
        uploadAlliancePlayerDatabase: function uploadAlliancePlayerDatabaseGameAware(file, context) {
            const gameContext = resolveGameplayContext('uploadAlliancePlayerDatabase', context);
            return uploadAlliancePlayerDatabase(file, gameContext);
        },
        getAlliancePlayerDatabase: function getAlliancePlayerDatabaseGameAware(context) {
            const gameContext = resolveGameplayContext('getAlliancePlayerDatabase', context);
            return getAlliancePlayerDatabase(gameContext);
        },
        getActivePlayerDatabase: function getActivePlayerDatabaseGameAware(context) {
            const gameContext = resolveGameplayContext('getActivePlayerDatabase', context);
            return getActivePlayerDatabase(gameContext);
        },
        getUserProfile: function getUserProfileGameAware(context) {
            const gameContext = resolveGameplayContext('getUserProfile', context);
            return getUserProfile(gameContext);
        },
        setUserProfile: function setUserProfileGameAware(profile, context) {
            const gameContext = resolveGameplayContext('setUserProfile', context);
            return setUserProfile(profile, gameContext);
        },
        setPlayerSource: function setPlayerSourceGameAware(source, context) {
            const gameContext = resolveGameplayContext('setPlayerSource', context);
            return setPlayerSource(source, gameContext);
        },
        getAllianceId: function getAllianceIdGameAware(context) {
            const gameContext = resolveGameplayContext('getAllianceId', context);
            return getAllianceId(gameContext);
        },
        getAllianceName: function getAllianceNameGameAware(context) {
            const gameContext = resolveGameplayContext('getAllianceName', context);
            return getAllianceName(gameContext);
        },
        getAllianceData: function getAllianceDataGameAware(context) {
            const gameContext = resolveGameplayContext('getAllianceData', context);
            return getAllianceData(gameContext);
        },
        getPlayerSource: function getPlayerSourceGameAware(context) {
            const gameContext = resolveGameplayContext('getPlayerSource', context);
            return getPlayerSource(gameContext);
        },
        getPendingInvitations: function getPendingInvitationsGameAware(context) {
            const gameContext = resolveGameplayContext('getPendingInvitations', context);
            return getPendingInvitations(gameContext);
        },
        getSentInvitations: function getSentInvitationsGameAware(context) {
            const gameContext = resolveGameplayContext('getSentInvitations', context);
            return getSentInvitations(gameContext);
        },
        getInvitationNotifications: function getInvitationNotificationsGameAware(context) {
            const gameContext = resolveGameplayContext('getInvitationNotifications', context);
            return getInvitationNotifications(gameContext);
        },
        getAllianceMembers: function getAllianceMembersGameAware(context) {
            const gameContext = resolveGameplayContext('getAllianceMembers', context);
            return getAllianceMembers(gameContext);
        },
        getMigrationVersion: getMigrationVersion,
        getMigratedToGameSubcollectionsAt: getMigratedToGameSubcollectionsAt,
        resolveGameScopedReadPayload: resolveGameScopedReadPayload,
        resolveGameplayContext: resolveGameplayContext,
        getObservabilityCounters: getObservabilityCounters,
        resetObservabilityCounters: resetObservabilityCounters,

        // Event History
        saveEventHistoryRecord: saveEventHistoryRecord,
        saveAttendanceBatch: saveAttendanceBatch,
        loadEventHistoryRecords: loadEventHistoryRecords,
        loadEventAttendance: loadEventAttendance,
        enforceEventHistoryLimit: enforceEventHistoryLimit,
        deactivateHistoryRecord: deactivateHistoryRecord,
        updateAttendanceStatus: updateAttendanceStatus,
        finalizeEventHistory: finalizeEventHistory,
        loadPlayerStats: loadPlayerStats,
        upsertPlayerStats: upsertPlayerStats,
        subscribePendingFinalizationCount: subscribePendingFinalizationCount,
        // Canonical gateway-contract aliases
        saveHistoryRecord: saveHistoryRecord,
        loadHistoryRecords: loadHistoryRecords,
        loadAttendance: loadAttendance,
        finalizeHistory: finalizeHistory,

        // Player Updates
        createUpdateToken: createUpdateToken,
        saveTokenBatch: saveTokenBatch,
        loadPendingUpdates: loadPendingUpdates,
        updatePendingUpdateStatus: updatePendingUpdateStatus,
        revokeToken: revokeToken,
        loadActiveTokens: loadActiveTokens,
        subscribePendingUpdatesCount: subscribePendingUpdatesCount,
        applyPlayerUpdateToPersonal: applyPlayerUpdateToPersonal,
        applyPlayerUpdateToAlliance: applyPlayerUpdateToAlliance,
        createPersonalSharedUpdateInvite: createPersonalSharedUpdateInvite,
        createAllianceSharedUpdateInvite: createAllianceSharedUpdateInvite,
        // Personal Player Updates
        createPersonalUpdateToken: createPersonalUpdateToken,
        createPersonalPendingUpdate: createPersonalPendingUpdate,
        loadPersonalPendingUpdates: loadPersonalPendingUpdates,
        updatePersonalPendingUpdateStatus: updatePersonalPendingUpdateStatus,
        // Event Wiki
        loadEventWiki: loadEventWiki,
        saveEventWiki: saveEventWiki,
        deleteEventWiki: deleteEventWiki,
        getEventWikiUrl: getEventWikiUrl,
        // Game-centric path builders (v2 migration)
        getGameUserStateDocRef: getGameUserStateDocRef,
        getSoloplayerDocRef: getSoloplayerDocRef,
        getSoloplayerPlayersCollectionRef: getSoloplayerPlayersCollectionRef,
        getAlliancePlayersCollectionRef: getAlliancePlayersCollectionRef,
        getGameScopedEventsCollectionRef: getGameScopedEventsCollectionRef,
        getGameEventHistoryCollectionRef: getGameEventHistoryCollectionRef,
        getGameSoloUpdateTokensCollectionRef: getGameSoloUpdateTokensCollectionRef,
        getGameSoloPendingUpdatesCollectionRef: getGameSoloPendingUpdatesCollectionRef,
        getGameSoloSharedUpdateInvitesCollectionRef: getGameSoloSharedUpdateInvitesCollectionRef,
        getGameSoloSharedUpdateInviteCandidatesCollectionRef: getGameSoloSharedUpdateInviteCandidatesCollectionRef,
        getGameAllianceUpdateTokensCollectionRef: getGameAllianceUpdateTokensCollectionRef,
        getGameAlliancePendingUpdatesCollectionRef: getGameAlliancePendingUpdatesCollectionRef,
        getGameAllianceSharedUpdateInvitesCollectionRef: getGameAllianceSharedUpdateInvitesCollectionRef,
        getGameAllianceSharedUpdateInviteCandidatesCollectionRef: getGameAllianceSharedUpdateInviteCandidatesCollectionRef,
        GAME_CENTRIC_MIGRATION_VERSION: GAME_CENTRIC_MIGRATION_VERSION,
    };
    
})();

// Expose for adapters that read from window/global object
if (typeof window !== 'undefined') {
    window.FirebaseManager = FirebaseManager;
}

// Auto-initialize on load
if (typeof firebase !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            FirebaseManager.init();
        });
    } else {
        FirebaseManager.init();
    }
}


