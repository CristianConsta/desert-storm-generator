/**
 * FIREBASE INFRASTRUCTURE UTILITIES
 * ==================================
 *
 * Stateless infrastructure extracted from firebase-module.js (Phase 4).
 * Provides: collection/path ref builders, normalization helpers,
 * feature flags, game context resolvers, observability counters,
 * and pure utility functions.
 *
 * Depends on: Firestore `db` instance via setDb() / getDb().
 * Export: window.DSFirebaseInfra
 */

(function initFirebaseInfra(global) {
    'use strict';

    // ── db holder ────────────────────────────────────────────────────────────
    let db = null;

    function setDb(dbInstance) {
        db = dbInstance;
    }

    function getDb() {
        return db;
    }

    // ── Constants ────────────────────────────────────────────────────────────
    const DEFAULT_GAME_ID = 'last_war';
    const ACTIVE_GAME_STORAGE_KEY = 'ds_active_game_id';
    const GAMES_COLLECTION = 'games';
    const USER_GAMES_SUBCOLLECTION = 'games';
    const GAME_ALLIANCES_SUBCOLLECTION = 'alliances';
    const GAME_INVITATIONS_SUBCOLLECTION = 'invitations';
    const GAME_PLAYERS_SUBCOLLECTION = 'players';
    const GAME_EVENTS_SUBCOLLECTION = 'events';
    const EVENT_MEDIA_SUBCOLLECTION = 'event_media';
    const GAME_USER_STATE_SUBCOLLECTION = 'user_state';
    const GAME_SOLOPLAYERS_SUBCOLLECTION = 'soloplayers';
    const GAME_SOLOPLAYER_PLAYERS_SUBCOLLECTION = 'players';
    const GAME_ALLIANCE_PLAYERS_SUBCOLLECTION = 'alliance_players';
    const GAME_EVENT_HISTORY_SUBCOLLECTION = 'event_history';
    const GAME_EVENT_WIKI_SUBCOLLECTION = 'event_wiki';

    const MULTIGAME_FLAG_DEFAULTS = Object.freeze({
        MULTIGAME_ENABLED: false,
        MULTIGAME_READ_FALLBACK_ENABLED: false,
        MULTIGAME_DUAL_WRITE_ENABLED: false,
        MULTIGAME_GAME_SELECTOR_ENABLED: false,
        MULTIGAME_STRICT_MODE: false,
    });
    const MULTIGAME_FLAG_KEYS = Object.keys(MULTIGAME_FLAG_DEFAULTS);

    // ── Normalization helpers ────────────────────────────────────────────────

    function normalizeFeatureFlagValue(value, fallbackValue) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (!normalized) {
                return fallbackValue;
            }
            if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
                return true;
            }
            if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
                return false;
            }
        }
        return fallbackValue;
    }

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

    function normalizeGameContextInput(context) {
        if (typeof context === 'string') {
            return normalizeGameId(context);
        }
        if (context && typeof context === 'object' && typeof context.gameId === 'string') {
            return normalizeGameId(context.gameId);
        }
        return '';
    }

    function normalizeUid(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim();
    }

    // ── Feature flags ────────────────────────────────────────────────────────

    function readRuntimeFeatureFlagOverrides() {
        if (typeof window === 'undefined' || !window || typeof window !== 'object') {
            return {};
        }
        const runtimeFlags = window.__MULTIGAME_FLAGS;
        if (!runtimeFlags || typeof runtimeFlags !== 'object') {
            return {};
        }
        return runtimeFlags;
    }

    function resolveFeatureFlags(overrides) {
        const runtimeOverrides = readRuntimeFeatureFlagOverrides();
        const scopedOverrides = overrides && typeof overrides === 'object' ? overrides : {};
        const mergedFlags = {
            ...runtimeOverrides,
            ...scopedOverrides,
        };
        const resolvedFlags = {};
        MULTIGAME_FLAG_KEYS.forEach((flagName) => {
            const fallbackValue = MULTIGAME_FLAG_DEFAULTS[flagName];
            resolvedFlags[flagName] = normalizeFeatureFlagValue(mergedFlags[flagName], fallbackValue);
        });
        return resolvedFlags;
    }

    function isFeatureFlagEnabled(flagName, overrides) {
        if (!Object.prototype.hasOwnProperty.call(MULTIGAME_FLAG_DEFAULTS, flagName)) {
            return false;
        }
        const resolvedFlags = resolveFeatureFlags(overrides);
        return resolvedFlags[flagName] === true;
    }

    function isStrictModeEnabled(overrides) {
        return isFeatureFlagEnabled('MULTIGAME_STRICT_MODE', overrides);
    }

    function isLegacyFallbackAllowed(overrides) {
        return !isStrictModeEnabled(overrides);
    }

    function createStrictModeError(message, details) {
        const err = new Error(typeof message === 'string' && message ? message : 'Strict mode blocked legacy fallback');
        err.code = 'strict-mode-blocked';
        if (details && typeof details === 'object') {
            err.details = details;
        }
        return err;
    }

    // ── Collection & path reference builders ─────────────────────────────────

    function getUserGameDocRef(userId, gameId) {
        if (!db || !userId) {
            return null;
        }
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        return db.collection('users').doc(userId).collection(USER_GAMES_SUBCOLLECTION).doc(normalizedGameId);
    }

    function getGameDocRef(gameId) {
        if (!db) {
            return null;
        }
        const normalizedGameId = normalizeGameId(gameId) || DEFAULT_GAME_ID;
        return db.collection(GAMES_COLLECTION).doc(normalizedGameId);
    }

    function getGameAllianceCollectionRef(gameId) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef) {
            return null;
        }
        return gameRef.collection(GAME_ALLIANCES_SUBCOLLECTION);
    }

    function getGameAllianceDocRef(gameId, allianceDocId) {
        const collectionRef = getGameAllianceCollectionRef(gameId);
        const normalizedAllianceDocId = typeof allianceDocId === 'string' ? allianceDocId.trim() : '';
        if (!collectionRef || !normalizedAllianceDocId) {
            return null;
        }
        return collectionRef.doc(normalizedAllianceDocId);
    }

    function getLegacyAllianceCollectionRef() {
        if (!db) {
            return null;
        }
        return db.collection('alliances');
    }

    function getLegacyAllianceDocRef(allianceDocId) {
        const collectionRef = getLegacyAllianceCollectionRef();
        const normalizedAllianceDocId = typeof allianceDocId === 'string' ? allianceDocId.trim() : '';
        if (!collectionRef || !normalizedAllianceDocId) {
            return null;
        }
        return collectionRef.doc(normalizedAllianceDocId);
    }

    function getGameInvitationCollectionRef(gameId, allianceIdParam) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef) {
            return null;
        }
        const normalizedAllianceId = typeof allianceIdParam === 'string' ? allianceIdParam.trim() : '';
        if (!normalizedAllianceId) {
            return null;
        }
        return gameRef.collection('alliances').doc(normalizedAllianceId)
            .collection(GAME_INVITATIONS_SUBCOLLECTION);
    }

    function getGameInvitationDocRef(gameId, allianceIdParam, invitationId) {
        const collectionRef = getGameInvitationCollectionRef(gameId, allianceIdParam);
        const normalizedInvitationId = typeof invitationId === 'string' ? invitationId.trim() : '';
        if (!collectionRef || !normalizedInvitationId) {
            return null;
        }
        return collectionRef.doc(normalizedInvitationId);
    }

    async function findInvitationById(gameId, invitationId) {
        if (!db || !invitationId || typeof db.collectionGroup !== 'function') {
            return null;
        }
        try {
            var snapshot = await db.collectionGroup(GAME_INVITATIONS_SUBCOLLECTION)
                .where('gameId', '==', gameId)
                .get();
            for (var i = 0; i < snapshot.docs.length; i++) {
                if (snapshot.docs[i].id === invitationId) {
                    return { ref: snapshot.docs[i].ref, data: snapshot.docs[i].data() };
                }
            }
        } catch (err) {
            console.warn('findInvitationById collectionGroup fallback failed:', err.message);
        }
        return null;
    }

    function getUserGamePlayersCollectionRef(userId, gameId) {
        const gameRef = getUserGameDocRef(userId, gameId);
        if (!gameRef) {
            return null;
        }
        return gameRef.collection(GAME_PLAYERS_SUBCOLLECTION);
    }

    function getUserGameEventsCollectionRef(userId, gameId) {
        const gameRef = getUserGameDocRef(userId, gameId);
        if (!gameRef) {
            return null;
        }
        return gameRef.collection(GAME_EVENTS_SUBCOLLECTION);
    }

    function getUserGameEventMediaCollectionRef(userId, gameId) {
        const gameRef = getUserGameDocRef(userId, gameId);
        if (!gameRef) {
            return null;
        }
        return gameRef.collection(EVENT_MEDIA_SUBCOLLECTION);
    }

    function getGameUserStateDocRef(gameId, uid) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef || !uid) { return null; }
        return gameRef.collection(GAME_USER_STATE_SUBCOLLECTION).doc(uid);
    }

    function getSoloplayerDocRef(gameId, uid) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef || !uid) { return null; }
        return gameRef.collection(GAME_SOLOPLAYERS_SUBCOLLECTION).doc(uid);
    }

    function getSoloplayerPlayersCollectionRef(gameId, uid) {
        const soloRef = getSoloplayerDocRef(gameId, uid);
        if (!soloRef) { return null; }
        return soloRef.collection(GAME_SOLOPLAYER_PLAYERS_SUBCOLLECTION);
    }

    function getAlliancePlayersCollectionRef(gameId, allianceId) {
        const allianceRef = getGameAllianceDocRef(gameId, allianceId);
        if (!allianceRef) { return null; }
        return allianceRef.collection(GAME_ALLIANCE_PLAYERS_SUBCOLLECTION);
    }

    function getGameScopedEventsCollectionRef(gameId) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef) { return null; }
        return gameRef.collection(GAME_EVENTS_SUBCOLLECTION);
    }

    function getGameEventHistoryCollectionRef(gameId) {
        const gameRef = getGameDocRef(gameId);
        if (!gameRef) { return null; }
        return gameRef.collection(GAME_EVENT_HISTORY_SUBCOLLECTION);
    }

    function getGameSoloUpdateTokensCollectionRef(gameId, uid) {
        const soloRef = getSoloplayerDocRef(gameId, uid);
        if (!soloRef) { return null; }
        return soloRef.collection('update_tokens');
    }

    function getGameSoloPendingUpdatesCollectionRef(gameId, uid) {
        const soloRef = getSoloplayerDocRef(gameId, uid);
        if (!soloRef) { return null; }
        return soloRef.collection('pending_updates');
    }

    function getGameSoloSharedUpdateInvitesCollectionRef(gameId, uid) {
        const soloRef = getSoloplayerDocRef(gameId, uid);
        if (!soloRef) { return null; }
        return soloRef.collection('shared_update_invites');
    }

    function getGameSoloSharedUpdateInviteCandidatesCollectionRef(gameId, uid, inviteId) {
        const invitesRef = getGameSoloSharedUpdateInvitesCollectionRef(gameId, uid);
        const normalizedInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
        if (!invitesRef || !normalizedInviteId) { return null; }
        return invitesRef.doc(normalizedInviteId).collection('candidates');
    }

    function getGameAllianceUpdateTokensCollectionRef(gameId, allianceId) {
        const allianceRef = getGameAllianceDocRef(gameId, allianceId);
        if (!allianceRef) { return null; }
        return allianceRef.collection('update_tokens');
    }

    function getGameAlliancePendingUpdatesCollectionRef(gameId, allianceId) {
        const allianceRef = getGameAllianceDocRef(gameId, allianceId);
        if (!allianceRef) { return null; }
        return allianceRef.collection('pending_updates');
    }

    function getGameAllianceSharedUpdateInvitesCollectionRef(gameId, allianceId) {
        const allianceRef = getGameAllianceDocRef(gameId, allianceId);
        if (!allianceRef) { return null; }
        return allianceRef.collection('shared_update_invites');
    }

    function getGameAllianceSharedUpdateInviteCandidatesCollectionRef(gameId, allianceId, inviteId) {
        const invitesRef = getGameAllianceSharedUpdateInvitesCollectionRef(gameId, allianceId);
        const normalizedInviteId = typeof inviteId === 'string' ? inviteId.trim() : '';
        if (!invitesRef || !normalizedInviteId) { return null; }
        return invitesRef.doc(normalizedInviteId).collection('candidates');
    }

    function getSoloEventWikiCollectionRef(gameId, uid) {
        const soloRef = getSoloplayerDocRef(gameId, uid);
        if (!soloRef) { return null; }
        return soloRef.collection(GAME_EVENT_WIKI_SUBCOLLECTION);
    }

    function getSoloEventWikiDocRef(gameId, uid, eventId) {
        const collRef = getSoloEventWikiCollectionRef(gameId, uid);
        const normalizedId = typeof eventId === 'string' ? eventId.trim() : '';
        if (!collRef || !normalizedId) { return null; }
        return collRef.doc(normalizedId);
    }

    function getAllianceEventWikiCollectionRef(gameId, allianceId) {
        const allianceRef = getGameAllianceDocRef(gameId, allianceId);
        if (!allianceRef) { return null; }
        return allianceRef.collection(GAME_EVENT_WIKI_SUBCOLLECTION);
    }

    function getAllianceEventWikiDocRef(gameId, allianceId, eventId) {
        const collRef = getAllianceEventWikiCollectionRef(gameId, allianceId);
        const normalizedId = typeof eventId === 'string' ? eventId.trim() : '';
        if (!collRef || !normalizedId) { return null; }
        return collRef.doc(normalizedId);
    }

    // ── Game context resolvers ───────────────────────────────────────────────

    function resolveScopedActiveGameStorageKey(userOrUid) {
        const userUid = normalizeUid(
            typeof userOrUid === 'string'
                ? userOrUid
                : (userOrUid && typeof userOrUid === 'object' ? userOrUid.uid : '')
        );
        if (!userUid) {
            return '';
        }
        return `${ACTIVE_GAME_STORAGE_KEY}::${userUid}`;
    }

    function resolveGameplayContext(methodName, context) {
        const explicitGameId = normalizeGameContextInput(context);
        if (explicitGameId) {
            return { gameId: explicitGameId, explicit: true };
        }
        return { gameId: DEFAULT_GAME_ID, explicit: false };
    }

    function getResolvedGameId(methodName, context) {
        const gameplayContext = resolveGameplayContext(methodName, context);
        return gameplayContext && gameplayContext.gameId ? gameplayContext.gameId : DEFAULT_GAME_ID;
    }

    function resolveInitialAuthGameId(userOrUid) {
        if (typeof window !== 'undefined') {
            const fromGlobal = normalizeGameId(window.__ACTIVE_GAME_ID);
            if (fromGlobal) {
                return fromGlobal;
            }
            try {
                if (window.localStorage && typeof window.localStorage.getItem === 'function') {
                    const scopedStorageKey = resolveScopedActiveGameStorageKey(userOrUid);
                    if (scopedStorageKey) {
                        const fromScopedStorage = normalizeGameId(window.localStorage.getItem(scopedStorageKey));
                        if (fromScopedStorage) {
                            return fromScopedStorage;
                        }
                    }
                    const fromStorage = normalizeGameId(window.localStorage.getItem(ACTIVE_GAME_STORAGE_KEY));
                    if (fromStorage) {
                        if (scopedStorageKey && typeof window.localStorage.setItem === 'function') {
                            try {
                                window.localStorage.setItem(scopedStorageKey, fromStorage);
                            } catch (scopedWriteError) {
                                // Best effort migration to user-scoped key only.
                            }
                        }
                        return fromStorage;
                    }
                }
            } catch (error) {
                // Ignore storage access issues and use default.
            }
        }
        return DEFAULT_GAME_ID;
    }

    // ── Pure utilities ───────────────────────────────────────────────────────

    function createStableDocId(rawValue, prefix) {
        const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
        const base = raw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 72);
        let hash = 0;
        for (let index = 0; index < raw.length; index += 1) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(index);
            hash |= 0;
        }
        const hashPart = Math.abs(hash).toString(36);
        return `${base || (prefix || 'doc')}_${hashPart}`;
    }

    function getPlayerDocId(playerName) {
        return createStableDocId(playerName, 'player');
    }

    function getEventDocId(eventId) {
        const normalizedEventId = normalizeEventId(eventId);
        if (normalizedEventId) {
            return normalizedEventId;
        }
        return createStableDocId(eventId, 'event');
    }

    function parseMigrationVersion(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return Math.floor(parsed);
    }

    function cloneJson(value) {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        if (!value || typeof value !== 'object') {
            return false;
        }
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    function areJsonEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        if (Array.isArray(a) || Array.isArray(b)) {
            if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
                return false;
            }
            for (let i = 0; i < a.length; i += 1) {
                if (!areJsonEqual(a[i], b[i])) {
                    return false;
                }
            }
            return true;
        }
        if (isPlainObject(a) || isPlainObject(b)) {
            if (!isPlainObject(a) || !isPlainObject(b)) {
                return false;
            }
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) {
                return false;
            }
            for (let i = 0; i < aKeys.length; i += 1) {
                const key = aKeys[i];
                if (!Object.prototype.hasOwnProperty.call(b, key)) {
                    return false;
                }
                if (!areJsonEqual(a[key], b[key])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    function toMillis(value) {
        if (!value) {
            return 0;
        }
        if (typeof value.toMillis === 'function') {
            const ms = Number(value.toMillis());
            return Number.isFinite(ms) && ms > 0 ? ms : 0;
        }
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) && value > 0 ? value : 0;
        }
        return 0;
    }

    function timestampToMillis(value) {
        if (!value) {
            return 0;
        }
        if (typeof value.toMillis === 'function') {
            return value.toMillis();
        }
        if (typeof value.toDate === 'function') {
            return value.toDate().getTime();
        }
        if (value instanceof Date) {
            return value.getTime();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        const parsed = new Date(value).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function isPermissionDeniedError(error) {
        if (!error) return false;
        const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
        const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
        return code.includes('permission-denied') || message.includes('missing or insufficient permissions');
    }

    // ── Observability ────────────────────────────────────────────────────────

    const observabilityCounters = {
        dualWriteMismatchCount: 0,
        invitationContextMismatchCount: 0,
        fallbackReadHitCount: 0,
    };

    function incrementObservabilityCounter(counterKey, amount) {
        if (!Object.prototype.hasOwnProperty.call(observabilityCounters, counterKey)) {
            return;
        }
        const delta = Number(amount);
        const increment = Number.isFinite(delta) && delta > 0 ? Math.floor(delta) : 1;
        observabilityCounters[counterKey] += increment;
    }

    function getObservabilityCounters() {
        return {
            dualWriteMismatchCount: Number(observabilityCounters.dualWriteMismatchCount) || 0,
            invitationContextMismatchCount: Number(observabilityCounters.invitationContextMismatchCount) || 0,
            fallbackReadHitCount: Number(observabilityCounters.fallbackReadHitCount) || 0,
        };
    }

    function resetObservabilityCounters() {
        observabilityCounters.dualWriteMismatchCount = 0;
        observabilityCounters.invitationContextMismatchCount = 0;
        observabilityCounters.fallbackReadHitCount = 0;
    }

    // ── Public API ───────────────────────────────────────────────────────────

    global.DSFirebaseInfra = {
        // db access
        setDb: setDb,
        getDb: getDb,
        // constants
        DEFAULT_GAME_ID: DEFAULT_GAME_ID,
        ACTIVE_GAME_STORAGE_KEY: ACTIVE_GAME_STORAGE_KEY,
        MULTIGAME_FLAG_DEFAULTS: MULTIGAME_FLAG_DEFAULTS,
        MULTIGAME_FLAG_KEYS: MULTIGAME_FLAG_KEYS,
        // normalization
        normalizeFeatureFlagValue: normalizeFeatureFlagValue,
        normalizeEventId: normalizeEventId,
        normalizeGameId: normalizeGameId,
        normalizeGameContextInput: normalizeGameContextInput,
        normalizeUid: normalizeUid,
        // feature flags
        readRuntimeFeatureFlagOverrides: readRuntimeFeatureFlagOverrides,
        resolveFeatureFlags: resolveFeatureFlags,
        isFeatureFlagEnabled: isFeatureFlagEnabled,
        isStrictModeEnabled: isStrictModeEnabled,
        isLegacyFallbackAllowed: isLegacyFallbackAllowed,
        createStrictModeError: createStrictModeError,
        // collection/path ref builders
        getUserGameDocRef: getUserGameDocRef,
        getGameDocRef: getGameDocRef,
        getGameAllianceCollectionRef: getGameAllianceCollectionRef,
        getGameAllianceDocRef: getGameAllianceDocRef,
        getLegacyAllianceCollectionRef: getLegacyAllianceCollectionRef,
        getLegacyAllianceDocRef: getLegacyAllianceDocRef,
        getGameInvitationCollectionRef: getGameInvitationCollectionRef,
        getGameInvitationDocRef: getGameInvitationDocRef,
        findInvitationById: findInvitationById,
        getUserGamePlayersCollectionRef: getUserGamePlayersCollectionRef,
        getUserGameEventsCollectionRef: getUserGameEventsCollectionRef,
        getUserGameEventMediaCollectionRef: getUserGameEventMediaCollectionRef,
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
        getSoloEventWikiCollectionRef: getSoloEventWikiCollectionRef,
        getSoloEventWikiDocRef: getSoloEventWikiDocRef,
        getAllianceEventWikiCollectionRef: getAllianceEventWikiCollectionRef,
        getAllianceEventWikiDocRef: getAllianceEventWikiDocRef,
        // game context resolvers
        resolveScopedActiveGameStorageKey: resolveScopedActiveGameStorageKey,
        resolveGameplayContext: resolveGameplayContext,
        getResolvedGameId: getResolvedGameId,
        resolveInitialAuthGameId: resolveInitialAuthGameId,
        // pure utilities
        createStableDocId: createStableDocId,
        getPlayerDocId: getPlayerDocId,
        getEventDocId: getEventDocId,
        parseMigrationVersion: parseMigrationVersion,
        cloneJson: cloneJson,
        isPlainObject: isPlainObject,
        areJsonEqual: areJsonEqual,
        toMillis: toMillis,
        timestampToMillis: timestampToMillis,
        isPermissionDeniedError: isPermissionDeniedError,
        // observability
        incrementObservabilityCounter: incrementObservabilityCounter,
        getObservabilityCounters: getObservabilityCounters,
        resetObservabilityCounters: resetObservabilityCounters,
    };

})(typeof window !== 'undefined' ? window : global);
