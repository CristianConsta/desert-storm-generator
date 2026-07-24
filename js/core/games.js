(function initGamesCore(global) {
    const GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';
    const DEFAULT_GAME_ID = 'last_war';

    const GAME_CATALOG = {
        last_war: {
            id: 'last_war',
            name: 'Last War: Survival',
            logo: '',
            company: 'FirstFun',
            troopModel: {
                categories: [
                    { id: 'tank', label: 'Tank' },
                    { id: 'aero', label: 'Aero' },
                    { id: 'missile', label: 'Missile' },
                ],
                fallbackCategory: 'unknown',
            },
            playerImportSchema: {
                id: 'last_war_players_v1',
                templateFileName: 'player_database_template.xlsx',
                sheetName: 'Players',
                headerRowIndex: 9,
                columns: [
                    { key: 'name', header: 'Player Name', required: true },
                    { key: 'power', header: 'E1 Total Power(M)', required: true },
                    { key: 'troops', header: 'E1 Troops', required: true },
                ],
            },
            assignmentAlgorithmIds: ['balanced_round_robin'],
        },
    };

    function cloneDeep(value) {
        return JSON.parse(JSON.stringify(value));
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

    function listGameIds() {
        return Object.keys(GAME_CATALOG);
    }

    function getDefaultGameId() {
        return DEFAULT_GAME_ID;
    }

    function getGame(gameId) {
        const normalizedId = normalizeGameId(gameId);
        if (!normalizedId || !Object.prototype.hasOwnProperty.call(GAME_CATALOG, normalizedId)) {
            return null;
        }
        return cloneDeep(GAME_CATALOG[normalizedId]);
    }

    function listAvailableGames() {
        return listGameIds()
            .map((gameId) => getGame(gameId))
            .filter(Boolean);
    }

    function isKnownGame(gameId) {
        return !!getGame(gameId);
    }

    function extractUid(userOrUid) {
        if (typeof userOrUid === 'string') {
            return userOrUid.trim();
        }
        if (userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string') {
            return userOrUid.uid.trim();
        }
        return '';
    }

    function isGameMetadataSuperAdmin(userOrUid) {
        return extractUid(userOrUid) === GAME_METADATA_SUPER_ADMIN_UID;
    }

    function canEditGameMetadata(userOrUid, gameId) {
        return isKnownGame(gameId) && isGameMetadataSuperAdmin(userOrUid);
    }

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
})(window);
