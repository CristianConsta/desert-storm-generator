(function initGameMetadataAdminController(global) {
    'use strict';

    var GAME_METADATA_SUPER_ADMIN_UID = '2z2BdO8aVsUovqQWWL9WCRMdV933';

    var gameMetadataCatalogCache = [];
    var gameMetadataDraftLogoDataUrl = '';

    // Deps injected via init()
    var t;
    var showMessage;
    var getFirebaseService;
    var getCurrentAuthUser;
    var getActiveGame;
    var ensureActiveGameContext;
    var updateActiveGameBadge;
    var refreshGameSelectorMenuAvailability;
    var applyAvatar;
    var getAvatarInitials;
    var closeNavigationMenu;
    var generateEventAvatarDataUrl;
    var createGameMetadataLogoDataUrl;
    var getSelectableGameById;

    function init(deps) {
        t = deps.t;
        showMessage = deps.showMessage;
        getFirebaseService = deps.getFirebaseService;
        getCurrentAuthUser = deps.getCurrentAuthUser;
        getActiveGame = deps.getActiveGame;
        ensureActiveGameContext = deps.ensureActiveGameContext;
        updateActiveGameBadge = deps.updateActiveGameBadge;
        refreshGameSelectorMenuAvailability = deps.refreshGameSelectorMenuAvailability;
        applyAvatar = deps.applyAvatar;
        getAvatarInitials = deps.getAvatarInitials;
        closeNavigationMenu = deps.closeNavigationMenu;
        generateEventAvatarDataUrl = deps.generateEventAvatarDataUrl;
        createGameMetadataLogoDataUrl = deps.createGameMetadataLogoDataUrl;
        getSelectableGameById = deps.getSelectableGameById;
    }

    function isGameMetadataSuperAdmin(userOrUid) {
        var FirebaseService = getFirebaseService();
        if (typeof FirebaseService !== 'undefined' && FirebaseService !== null && typeof FirebaseService.isGameMetadataSuperAdmin === 'function') {
            return FirebaseService.isGameMetadataSuperAdmin(userOrUid);
        }
        if (typeof userOrUid === 'string') {
            return userOrUid.trim() === GAME_METADATA_SUPER_ADMIN_UID;
        }
        var uid = userOrUid && typeof userOrUid === 'object' && typeof userOrUid.uid === 'string'
            ? userOrUid.uid.trim()
            : '';
        return uid === GAME_METADATA_SUPER_ADMIN_UID;
    }

    function syncGameMetadataMenuAvailability() {
        var allowed = isGameMetadataSuperAdmin(getCurrentAuthUser());
        var targets = [
            document.getElementById('navGameMetadataBtn'),
            document.getElementById('sidebarGameMetadataBtn')
        ];
        targets.forEach(function(btn) {
            if (!btn) return;
            btn.classList.toggle('hidden', !allowed);
            btn.disabled = !allowed;
        });
        if (!allowed) {
            closeGameMetadataOverlay();
        }
    }

    function clearGameMetadataForm() {
        var nameInput = document.getElementById('gameMetadataNameInput');
        var companyInput = document.getElementById('gameMetadataCompanyInput');
        if (nameInput) {
            nameInput.value = '';
        }
        if (companyInput) {
            companyInput.value = '';
        }
        var logoInput = document.getElementById('gameMetadataLogoInput');
        if (logoInput) {
            logoInput.value = '';
        }
        gameMetadataDraftLogoDataUrl = '';
        updateGameMetadataLogoPreview();
    }

    function clearGameMetadataStatus() {
        var status = document.getElementById('gameMetadataStatus');
        if (status) {
            status.replaceChildren();
        }
    }

    function setGameMetadataFormDisabled(disabled) {
        [
            'gameMetadataSelect',
            'gameMetadataNameInput',
            'gameMetadataLogoUploadBtn',
            'gameMetadataLogoRemoveBtn',
            'gameMetadataLogoInput',
            'gameMetadataCompanyInput',
            'gameMetadataSaveBtn',
        ]
            .forEach(function (id) {
                var element = document.getElementById(id);
                if (element) {
                    element.disabled = disabled;
                }
            });
    }

    function normalizeGameMetadataEntry(entry) {
        var source = entry && typeof entry === 'object' ? entry : {};
        var id = typeof source.id === 'string' ? source.id.trim() : '';
        if (!id) {
            return null;
        }
        return {
            id: id,
            name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : id,
            logo: typeof source.logo === 'string' ? source.logo.trim() : '',
            company: typeof source.company === 'string' ? source.company : '',
        };
    }

    function resolveSelectedMetadataGameId() {
        var select = document.getElementById('gameMetadataSelect');
        if (!select || typeof select.value !== 'string') {
            return '';
        }
        return select.value.trim();
    }

    function resolveGameMetadataDraftName() {
        var nameInput = document.getElementById('gameMetadataNameInput');
        var explicitName = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
        if (explicitName) {
            return explicitName;
        }
        var selectedGameId = resolveSelectedMetadataGameId();
        var selectedGame = selectedGameId ? getSelectableGameById(selectedGameId) : null;
        if (selectedGame && selectedGame.name) {
            return selectedGame.name;
        }
        return selectedGameId || 'Game';
    }

    function generateGameAvatarDataUrl(nameSeed, idSeed) {
        return generateEventAvatarDataUrl(nameSeed || 'Game', (idSeed || '') + '|game-avatar');
    }

    function updateGameMetadataLogoPreview() {
        var previewImage = document.getElementById('gameMetadataLogoPreviewImage');
        var previewInitials = document.getElementById('gameMetadataLogoPreviewInitials');
        if (!previewImage || !previewInitials) {
            return;
        }
        var selectedGameId = resolveSelectedMetadataGameId();
        var seedName = resolveGameMetadataDraftName();
        var fallbackAvatar = generateGameAvatarDataUrl(seedName, selectedGameId || seedName);
        applyAvatar(gameMetadataDraftLogoDataUrl || fallbackAvatar, previewImage, previewInitials, getAvatarInitials(seedName, 'G'));
    }

    function renderGameMetadataSelect(games, preferredGameId) {
        var select = document.getElementById('gameMetadataSelect');
        if (!select) {
            return '';
        }
        select.replaceChildren();
        var normalizedGames = Array.isArray(games) ? games.map(normalizeGameMetadataEntry).filter(Boolean) : [];
        normalizedGames.forEach(function (game) {
            var option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            select.appendChild(option);
        });

        var preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
        if (preferred && normalizedGames.some(function (game) { return game.id === preferred; })) {
            select.value = preferred;
        } else if (normalizedGames.length > 0) {
            select.value = normalizedGames[0].id;
        } else {
            select.value = '';
        }
        return select.value;
    }

    async function reloadGameMetadataCatalog(preferredGameId) {
        var preferred = typeof preferredGameId === 'string' ? preferredGameId.trim() : '';
        await refreshGameMetadataCatalogCache({ silent: true, preferredGameId: preferred });
        return renderGameMetadataSelect(gameMetadataCatalogCache, preferred);
    }

    async function refreshGameMetadataCatalogCache(options) {
        var FirebaseService = getFirebaseService();
        if (typeof FirebaseService === 'undefined' || FirebaseService === null || typeof FirebaseService.listGameMetadata !== 'function') {
            return gameMetadataCatalogCache;
        }
        var config = options && typeof options === 'object' ? options : {};
        var silent = config.silent === true;
        var preferredGameId = typeof config.preferredGameId === 'string' ? config.preferredGameId.trim() : '';
        try {
            var games = await FirebaseService.listGameMetadata();
            gameMetadataCatalogCache = Array.isArray(games) ? games.map(normalizeGameMetadataEntry).filter(Boolean) : [];
            var activeGameId = preferredGameId || getActiveGame() || '';
            updateActiveGameBadge(activeGameId);
            refreshGameSelectorMenuAvailability();
            return gameMetadataCatalogCache;
        } catch (error) {
            if (!silent) {
                console.warn('Failed to refresh game metadata catalog cache:', error);
            }
            return gameMetadataCatalogCache;
        }
    }

    function fillGameMetadataForm(game) {
        var metadata = normalizeGameMetadataEntry(game);
        if (!metadata) {
            clearGameMetadataForm();
            return;
        }
        var nameInput = document.getElementById('gameMetadataNameInput');
        var companyInput = document.getElementById('gameMetadataCompanyInput');
        if (nameInput) {
            nameInput.value = metadata.name || '';
        }
        if (companyInput) {
            companyInput.value = metadata.company || '';
        }
        var logoInput = document.getElementById('gameMetadataLogoInput');
        if (logoInput) {
            logoInput.value = '';
        }
        gameMetadataDraftLogoDataUrl = metadata.logo || '';
        updateGameMetadataLogoPreview();
    }

    function formatGameMetadataError(errorOrResult) {
        if (errorOrResult && typeof errorOrResult === 'object') {
            if (errorOrResult.errorKey) {
                return t(errorOrResult.errorKey, errorOrResult.errorParams || {});
            }
            if (typeof errorOrResult.error === 'string' && errorOrResult.error.trim()) {
                return errorOrResult.error;
            }
            if (typeof errorOrResult.message === 'string' && errorOrResult.message.trim()) {
                return errorOrResult.message;
            }
        }
        return String(errorOrResult || 'unknown');
    }

    async function loadGameMetadataForSelection(gameId) {
        var FirebaseService = getFirebaseService();
        var normalizedGameId = typeof gameId === 'string' ? gameId.trim() : '';
        if (!normalizedGameId) {
            clearGameMetadataForm();
            return;
        }
        setGameMetadataFormDisabled(true);
        try {
            var metadata = null;
            if (typeof FirebaseService !== 'undefined' && FirebaseService !== null && typeof FirebaseService.getGameMetadata === 'function') {
                metadata = await FirebaseService.getGameMetadata(normalizedGameId);
            }
            if (!metadata) {
                metadata = gameMetadataCatalogCache.find(function (game) { return game && game.id === normalizedGameId; }) || null;
            }
            if (!metadata) {
                showMessage('gameMetadataStatus', t('game_metadata_unknown_game'), 'error');
                clearGameMetadataForm();
                return;
            }
            fillGameMetadataForm(metadata);
        } catch (error) {
            showMessage('gameMetadataStatus', t('game_metadata_load_failed', { error: formatGameMetadataError(error) }), 'error');
            clearGameMetadataForm();
        } finally {
            setGameMetadataFormDisabled(false);
        }
    }

    async function openGameMetadataOverlay() {
        closeNavigationMenu();
        if (!isGameMetadataSuperAdmin(getCurrentAuthUser())) {
            alert(t('game_metadata_forbidden'));
            return;
        }
        var overlay = document.getElementById('gameMetadataOverlay');
        if (!overlay) {
            return;
        }
        overlay.classList.remove('hidden');
        clearGameMetadataStatus();
        clearGameMetadataForm();

        try {
            showMessage('gameMetadataStatus', t('message_upload_processing'), 'processing');
            var preferredGameId = getActiveGame() || ensureActiveGameContext() || '';
            var selectedGameId = await reloadGameMetadataCatalog(preferredGameId);
            clearGameMetadataStatus();
            if (!selectedGameId) {
                showMessage('gameMetadataStatus', t('game_selector_no_games'), 'warning');
                return;
            }
            await loadGameMetadataForSelection(selectedGameId);
        } catch (error) {
            showMessage('gameMetadataStatus', t('game_metadata_load_failed', { error: formatGameMetadataError(error) }), 'error');
        }
    }

    function closeGameMetadataOverlay() {
        var overlay = document.getElementById('gameMetadataOverlay');
        if (!overlay) {
            return;
        }
        overlay.classList.add('hidden');
        clearGameMetadataStatus();
    }

    function handleGameMetadataOverlayClick(event) {
        if (event && event.target && event.target.id === 'gameMetadataOverlay') {
            closeGameMetadataOverlay();
        }
    }

    async function handleGameMetadataSelectionChange() {
        clearGameMetadataStatus();
        var selectedGameId = resolveSelectedMetadataGameId();
        await loadGameMetadataForSelection(selectedGameId);
    }

    function triggerGameMetadataLogoUpload() {
        var input = document.getElementById('gameMetadataLogoInput');
        if (input) {
            input.click();
        }
    }

    function removeGameMetadataLogo() {
        gameMetadataDraftLogoDataUrl = '';
        var input = document.getElementById('gameMetadataLogoInput');
        if (input) {
            input.value = '';
        }
        updateGameMetadataLogoPreview();
    }

    async function handleGameMetadataLogoChange(event) {
        var input = event && event.target ? event.target : document.getElementById('gameMetadataLogoInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            gameMetadataDraftLogoDataUrl = await createGameMetadataLogoDataUrl(file);
            updateGameMetadataLogoPreview();
        } catch (error) {
            showMessage('gameMetadataStatus', error.message || t('events_manager_image_process_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    async function saveGameMetadata() {
        var FirebaseService = getFirebaseService();
        if (typeof FirebaseService === 'undefined' || FirebaseService === null || typeof FirebaseService.setGameMetadata !== 'function') {
            showMessage('gameMetadataStatus', t('error_firebase_not_loaded'), 'error');
            return;
        }
        if (!isGameMetadataSuperAdmin(getCurrentAuthUser())) {
            showMessage('gameMetadataStatus', t('game_metadata_forbidden'), 'error');
            return;
        }
        var selectedGameId = resolveSelectedMetadataGameId();
        if (!selectedGameId) {
            showMessage('gameMetadataStatus', t('game_metadata_unknown_game'), 'error');
            return;
        }
        var nameInput = document.getElementById('gameMetadataNameInput');
        var companyInput = document.getElementById('gameMetadataCompanyInput');
        var nameValue = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
        var resolvedLogoDataUrl = gameMetadataDraftLogoDataUrl || generateGameAvatarDataUrl(nameValue || selectedGameId, selectedGameId);

        var payload = {
            name: nameValue,
            logo: resolvedLogoDataUrl,
            company: companyInput && typeof companyInput.value === 'string' ? companyInput.value.trim() : '',
        };

        setGameMetadataFormDisabled(true);
        showMessage('gameMetadataStatus', t('message_upload_processing'), 'processing');
        try {
            var result = await FirebaseService.setGameMetadata(selectedGameId, payload);
            if (!result || !result.success) {
                showMessage('gameMetadataStatus', formatGameMetadataError(result), 'error');
                return;
            }

            await reloadGameMetadataCatalog(selectedGameId);
            await loadGameMetadataForSelection(selectedGameId);
            showMessage('gameMetadataStatus', t('game_metadata_saved'), 'success');
            updateActiveGameBadge();
        } catch (error) {
            showMessage('gameMetadataStatus', formatGameMetadataError(error), 'error');
        } finally {
            setGameMetadataFormDisabled(false);
        }
    }

    global.DSGameMetadataAdminController = {
        init: init,
        isGameMetadataSuperAdmin: isGameMetadataSuperAdmin,
        syncGameMetadataMenuAvailability: syncGameMetadataMenuAvailability,
        normalizeGameMetadataEntry: normalizeGameMetadataEntry,
        getGameMetadataCatalogCache: function () { return gameMetadataCatalogCache; },
        refreshGameMetadataCatalogCache: refreshGameMetadataCatalogCache,
        openGameMetadataOverlay: openGameMetadataOverlay,
        closeGameMetadataOverlay: closeGameMetadataOverlay,
        handleGameMetadataOverlayClick: handleGameMetadataOverlayClick,
        handleGameMetadataSelectionChange: handleGameMetadataSelectionChange,
        triggerGameMetadataLogoUpload: triggerGameMetadataLogoUpload,
        removeGameMetadataLogo: removeGameMetadataLogo,
        handleGameMetadataLogoChange: handleGameMetadataLogoChange,
        saveGameMetadata: saveGameMetadata,
        updateGameMetadataLogoPreview: updateGameMetadataLogoPreview,
        generateGameAvatarDataUrl: generateGameAvatarDataUrl,
    };
})(window);
