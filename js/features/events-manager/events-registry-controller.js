(function initEventsRegistryController(global) {
    'use strict';

    // ---- constants ----
    var DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';
    var MAP_PREVIEW = 'preview';
    var MAP_EXPORT = 'export';
    var MAP_CANVAS_WIDTH = 1080;
    var MAP_CANVAS_FALLBACK_HEIGHT = 720;
    var MAP_GRID_STEP = 90;
    var MAP_UPLOAD_MAX_SIDE = MAP_CANVAS_WIDTH;
    var BUILDING_POSITIONS_VERSION = 2;
    var BUILDING_CONFIG_VERSION = 2;
    var MAX_BUILDING_SLOTS_TOTAL = 20;
    var MIN_BUILDING_SLOTS = 0;

    var textColors = { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' };
    var bgColors = { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)',
                      4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' };

    // ---- per-event runtime state (module-private) ----
    var buildingConfigs = {};
    var buildingPositionsMap = {};
    var coordMapWarningShown = {};

    var PROTECTED_EVENT_IDS = null; // lazily initialised

    // ---- deps injected by app.js via init() ----
    var deps = null;

    function ensureDeps() {
        if (!deps) {
            throw new Error('DSEventsRegistryController.init() must be called before use');
        }
    }

    // ---- helpers ----

    function getEventIds() {
        return global.DSCoreEvents.getEventIds();
    }

    function normalizeAssignmentAlgorithmId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase();
    }

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

    function normalizeMapPurpose(purpose) {
        return purpose === MAP_EXPORT ? MAP_EXPORT : MAP_PREVIEW;
    }

    function resolveDefaultAssignmentAlgorithmId(gameId) {
        var normalizedGameId = normalizeGameId(gameId);
        if (global.DSAssignmentRegistry && typeof global.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
            var algorithms = global.DSAssignmentRegistry.listAlgorithmsForGame(normalizedGameId);
            if (Array.isArray(algorithms) && algorithms.length > 0 && algorithms[0] && typeof algorithms[0].id === 'string') {
                var normalized = normalizeAssignmentAlgorithmId(algorithms[0].id);
                if (normalized) {
                    return normalized;
                }
            }
        }
        return DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    function getProtectedEventIds() {
        if (!PROTECTED_EVENT_IDS) {
            PROTECTED_EVENT_IDS = new Set(
                Object.keys(global.DSCoreEvents.cloneLegacyEventRegistry ? global.DSCoreEvents.cloneLegacyEventRegistry() : {
                    desert_storm: true,
                    canyon_battlefield: true,
                })
            );
        }
        return PROTECTED_EVENT_IDS;
    }

    function isImageDataUrl(value, maxLength) {
        return global.DSEventsImageProcessor.isImageDataUrl(value, maxLength);
    }

    function hashString(value) {
        return global.DSEventsImageProcessor.hashString(value);
    }

    // ---- map runtime state (delegated to DSEventsMapController) ----

    function ensureMapRuntimeState(eventId, purpose) {
        return global.DSEventsMapController.ensureMapRuntimeState(eventId, purpose);
    }

    function getMapRuntimeStateFn(eventId, purpose) {
        return global.DSEventsMapController.getMapRuntimeState(eventId, purpose);
    }

    function deleteMapRuntimeStateForEvent(eventId) {
        global.DSEventsMapController.deleteMapRuntimeStateForEvent(eventId);
    }

    // ---- event runtime state ----

    function ensureEventRuntimeState(eventId) {
        var event = normalizeEventId(eventId);
        if (!event) {
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(buildingConfigs, event)) {
            buildingConfigs[event] = null;
        }
        if (!Object.prototype.hasOwnProperty.call(buildingPositionsMap, event)) {
            buildingPositionsMap[event] = {};
        }
        global.DSEventsMapController.ensureMapRuntimeState(event, MAP_PREVIEW);
        global.DSEventsMapController.ensureMapRuntimeState(event, MAP_EXPORT);
        if (!Object.prototype.hasOwnProperty.call(coordMapWarningShown, event)) {
            coordMapWarningShown[event] = false;
        }
    }

    function resetMapStateForEvent(eventId) {
        var event = normalizeEventId(eventId);
        if (!event) {
            return;
        }
        ensureEventRuntimeState(event);
        global.DSEventsMapController.resetMapStateForEvent(event);
        coordMapWarningShown[event] = false;
    }

    function syncRuntimeStateWithRegistry() {
        var eventIds = getEventIds();
        var eventIdSet = new Set(eventIds);

        eventIds.forEach(function (eventId) { ensureEventRuntimeState(eventId); });

        Object.keys(buildingConfigs).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete buildingConfigs[eventId];
            }
        });
        Object.keys(buildingPositionsMap).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete buildingPositionsMap[eventId];
            }
        });
        global.DSEventsMapController.cleanupOrphanedMapState(eventIdSet);
        Object.keys(coordMapWarningShown).forEach(function (eventId) {
            if (!eventIdSet.has(eventId)) {
                delete coordMapWarningShown[eventId];
            }
        });

        var currentEvent = deps.getCurrentEvent();
        if (!eventIdSet.has(currentEvent)) {
            deps.setCurrentEvent(eventIds[0] || 'desert_storm');
        }
    }

    // ---- active event ----

    function getActiveEvent() {
        var currentEvent = deps.getCurrentEvent();
        var active = global.DSCoreEvents.getEvent(currentEvent);
        if (active) {
            return active;
        }
        var firstId = getEventIds()[0];
        if (firstId) {
            deps.setCurrentEvent(firstId);
            return global.DSCoreEvents.getEvent(firstId);
        }
        return null;
    }

    // ---- display helpers ----

    function getEventDisplayName(eventId) {
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.resolveEventDisplayName === 'function'
        ) {
            return global.DSFeatureEventsManagerSelector.resolveEventDisplayName(eventId, {
                getEvent: function (id) { return global.DSCoreEvents.getEvent(id); },
                translate: deps.t,
            });
        }

        var event = global.DSCoreEvents.getEvent(eventId);
        if (!event) {
            return eventId;
        }
        if (typeof event.name === 'string' && event.name.trim()) {
            return event.name.trim();
        }
        if (event.titleKey) {
            var translated = deps.t(event.titleKey);
            if (translated && translated !== event.titleKey) {
                return translated;
            }
        }
        return event.name || eventId;
    }

    function createEventSelectorButton(eventId) {
        var currentEvent = deps.getCurrentEvent();
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.createEventSelectorButton === 'function'
        ) {
            return global.DSFeatureEventsManagerSelector.createEventSelectorButton({
                document: document,
                eventId: eventId,
                currentEvent: currentEvent,
                displayName: getEventDisplayName(eventId),
                onSelect: switchEvent,
            });
        }

        var button = document.createElement('button');
        button.className = 'event-btn' + (eventId === currentEvent ? ' active' : '');
        button.type = 'button';
        button.dataset.event = eventId;
        button.textContent = getEventDisplayName(eventId);
        button.addEventListener('click', function () { switchEvent(eventId); });
        return button;
    }

    function renderEventSelector(containerId) {
        var currentEvent = deps.getCurrentEvent();
        if (
            global.DSFeatureEventsManagerSelector
            && typeof global.DSFeatureEventsManagerSelector.renderEventSelector === 'function'
        ) {
            global.DSFeatureEventsManagerSelector.renderEventSelector({
                document: document,
                containerId: containerId,
                eventIds: getEventIds(),
                currentEvent: currentEvent,
                getDisplayName: getEventDisplayName,
                onSelect: switchEvent,
            });
            return;
        }

        var container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        var eventIds = getEventIds();
        container.innerHTML = '';
        eventIds.forEach(function (eventId) {
            container.appendChild(createEventSelectorButton(eventId));
        });
    }

    function renderAllEventSelectors() {
        renderEventSelector('selectionEventSelector');
    }

    // ---- storage normalization ----

    function normalizeStoredEventsData(rawData) {
        var source = rawData && typeof rawData === 'object' ? rawData : {};
        var normalized = {};
        Object.keys(source).forEach(function (rawId) {
            var eventId = normalizeEventId(rawId);
            if (!eventId) {
                return;
            }
            var entry = source[rawId];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            normalized[eventId] = {
                name: typeof entry.name === 'string' ? entry.name.trim().slice(0, deps.EVENT_NAME_LIMIT) : '',
                logoDataUrl: isImageDataUrl(entry.logoDataUrl, deps.EVENT_LOGO_DATA_URL_LIMIT) ? entry.logoDataUrl.trim() : '',
                mapDataUrl: isImageDataUrl(entry.mapDataUrl, deps.EVENT_MAP_DATA_URL_LIMIT) ? entry.mapDataUrl.trim() : '',
                assignmentAlgorithmId: normalizeAssignmentAlgorithmId(entry.assignmentAlgorithmId),
                buildingConfig: Array.isArray(entry.buildingConfig) ? entry.buildingConfig : null,
                buildingPositions: entry.buildingPositions && typeof entry.buildingPositions === 'object' ? entry.buildingPositions : null,
            };
        });
        return normalized;
    }

    function buildRegistryFromStorage() {
        var legacyRegistry = global.DSCoreEvents.cloneLegacyEventRegistry
            ? global.DSCoreEvents.cloneLegacyEventRegistry()
            : global.DSCoreEvents.cloneEventRegistry();
        var nextRegistry = {};

        Object.keys(legacyRegistry).forEach(function (eventId) {
            nextRegistry[eventId] = Object.assign({}, legacyRegistry[eventId]);
        });

        var storedEvents = (function () {
            var FirebaseService = deps.getFirebaseService();
            if (!FirebaseService || !FirebaseService.getAllEventData) {
                return {};
            }
            var gameplayContext = deps.getGameplayContext();
            if (!gameplayContext) {
                return {};
            }
            return normalizeStoredEventsData(FirebaseService.getAllEventData(gameplayContext));
        })();

        Object.keys(storedEvents).forEach(function (eventId) {
            var stored = storedEvents[eventId];
            var base = nextRegistry[eventId] || {};
            var gameplayContext = deps.getGameplayContext();
            var baseBuildings = Array.isArray(base.buildings) ? base.buildings : [];
            var storedBuildings = Array.isArray(stored.buildingConfig)
                ? deps.normalizeBuildingConfig(stored.buildingConfig, stored.buildingConfig)
                : null;
            var buildings = Array.isArray(storedBuildings) && storedBuildings.length > 0
                ? storedBuildings
                : baseBuildings;
            var validNames = new Set(buildings.map(function (item) { return item.name; }));
            var defaultPositions = stored.buildingPositions
                ? global.DSCoreBuildings.normalizeBuildingPositions(stored.buildingPositions, validNames)
                : (base.defaultPositions || {});
            var mapDataUrl = stored.mapDataUrl || '';
            var nextName = stored.name || base.name || eventId;
            var nextAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(stored.assignmentAlgorithmId)
                || normalizeAssignmentAlgorithmId(base.assignmentAlgorithmId)
                || resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : '');
            var preserveTitleKey = !stored.name || !base.name || stored.name === base.name;

            nextRegistry[eventId] = Object.assign({}, base, {
                id: eventId,
                name: nextName,
                titleKey: preserveTitleKey ? (base.titleKey || '') : '',
                mapFile: mapDataUrl || '',
                previewMapFile: mapDataUrl || '',
                exportMapFile: mapDataUrl || '',
                mapTitle: nextName.toUpperCase().slice(0, 50),
                excelPrefix: normalizeEventId(base.excelPrefix || eventId) || eventId,
                logoDataUrl: stored.logoDataUrl || '',
                mapDataUrl: mapDataUrl,
                assignmentAlgorithmId: nextAssignmentAlgorithmId,
                buildings: buildings,
                defaultPositions: defaultPositions,
                buildingAnchors: base.buildingAnchors || {},
            });
        });

        global.DSCoreEvents.setEventRegistry(nextRegistry);
        syncRuntimeStateWithRegistry();
        getEventIds().forEach(function (eventId) { resetMapStateForEvent(eventId); });
    }

    // ---- map loading ----

    function getEventMapFile(eventId) {
        ensureEventRuntimeState(eventId);
        return global.DSEventsMapController.getEventMapFile(eventId);
    }

    function loadMapImage(eventId, purpose) {
        var eid = eventId || deps.getCurrentEvent();
        ensureEventRuntimeState(eid);
        return global.DSEventsMapController.loadMapImage(eid, purpose, deps.getCurrentEvent);
    }

    // ---- switch event ----

    function switchEvent(eventId) {
        ensureDeps();
        var activeGameId = deps.enforceGameplayContext();
        if (!activeGameId) {
            return;
        }
        var currentEvent = deps.getCurrentEvent();
        var targetEventId = normalizeEventId(eventId);
        if (!targetEventId || !global.DSCoreEvents.getEvent(targetEventId)) return;
        if (targetEventId === currentEvent) {
            deps.setEventEditorCurrentId(targetEventId);
            deps.setEventEditorIsEditMode(false);
            applySelectedEventToEditor();
            renderEventsList();
            updateEventEditorState();
            return;
        }
        ensureEventRuntimeState(targetEventId);
        deps.setCurrentEvent(targetEventId);
        deps.setEventEditorCurrentId(targetEventId);
        deps.setEventEditorIsEditMode(false);

        renderAllEventSelectors();
        renderEventsList();
        updateEventEditorTitle();
        applySelectedEventToEditor();
        refreshEventEditorDeleteState();
        updateEventEditorState();

        deps.loadBuildingConfig();
        deps.loadBuildingPositions();

        if (deps.isConfigurationPageVisible()) {
            deps.renderBuildingsTable();
        }

        var coordOverlay = document.getElementById('coordPickerOverlay');
        if (coordOverlay && !coordOverlay.classList.contains('hidden')) {
            deps.refreshCoordinatesPickerForCurrentEvent();
        }

        deps.clearAssignments();

        updateGenerateEventLabels();

        var coordOverlayVisible = coordOverlay && !coordOverlay.classList.contains('hidden');
        var exportMapState = getMapRuntimeStateFn(targetEventId, MAP_EXPORT);
        if (coordOverlayVisible && exportMapState && !exportMapState.loaded) {
            loadMapImage(targetEventId, MAP_EXPORT).catch(function () {
                console.warn(targetEventId + ' export map failed to load');
            });
        }
    }

    function updateGenerateEventLabels() {
        var activeEvent = getActiveEvent();
        var label = activeEvent ? activeEvent.mapTitle : '';
        var elA = document.getElementById('generateEventLabelA');
        var elB = document.getElementById('generateEventLabelB');
        if (elA) elA.textContent = label;
        if (elB) elB.textContent = label;
    }

    // ---- avatar ----

    function generateEventAvatarDataUrl(nameSeed, idSeed) {
        return global.DSEventsImageProcessor.generateEventAvatarDataUrl(nameSeed, idSeed, deps);
    }

    // ---- editor UI ----

    function updateEventLogoPreview() {
        var image = document.getElementById('eventLogoPreviewImage');
        if (!image) {
            return;
        }
        var nameInput = document.getElementById('eventNameInput');
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var seedName = nameInput && typeof nameInput.value === 'string' && nameInput.value.trim()
            ? nameInput.value.trim()
            : (eventEditorCurrentId || 'Event');
        image.src = deps.getEventDraftLogoDataUrl() || generateEventAvatarDataUrl(seedName, eventEditorCurrentId || seedName);
    }

    function getEventMapPreviewSource(eventId) {
        if (!eventId) {
            return '';
        }
        var event = global.DSCoreEvents.getEvent(eventId);
        if (!event) {
            return '';
        }
        return event.mapDataUrl || '';
    }

    function updateEventMapPreview() {
        var image = document.getElementById('eventMapPreviewImage');
        var placeholder = document.getElementById('eventMapPreviewPlaceholder');
        if (!image || !placeholder) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventDraftMapRemoved = deps.getEventDraftMapRemoved();
        var fallbackMapSource = eventDraftMapRemoved ? '' : getEventMapPreviewSource(eventEditorCurrentId);
        var mapSource = deps.getEventDraftMapDataUrl() || fallbackMapSource;
        if (mapSource) {
            image.src = mapSource;
            image.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            image.src = '';
            image.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
    }

    function updateEventEditorTitle() {
        var titleEl = document.getElementById('eventEditorTitle');
        if (!titleEl) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            titleEl.textContent = deps.t('events_manager_create_title');
            return;
        }
        var event = global.DSCoreEvents.getEvent(eventEditorCurrentId);
        var eventName = event ? (event.name || eventEditorCurrentId) : eventEditorCurrentId;
        titleEl.textContent = deps.getEventEditorIsEditMode()
            ? deps.t('events_manager_edit_title', { name: eventName })
            : eventName;
    }

    function isEventMapAvailable(eventId) {
        if (!eventId) {
            return false;
        }
        return Boolean(getEventMapPreviewSource(eventId));
    }

    function updateEventCoordinatesButton() {
        var button = document.getElementById('eventCoordinatesBtn');
        var row = document.getElementById('eventCoordinatesRow');
        if (!button) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var hasDraftMap = Boolean(deps.getEventDraftMapDataUrl());
        var hasSavedMap = !deps.getEventDraftMapRemoved() && isEventMapAvailable(eventEditorCurrentId);
        var showButton = hasDraftMap || hasSavedMap;
        if (row) {
            row.classList.toggle('hidden', !showButton);
        }
        button.classList.toggle('hidden', !showButton);
        button.disabled = !showButton;
    }

    function updateEventMapActionButtons(readOnly) {
        var uploadBtn = document.getElementById('eventMapUploadBtn');
        var removeBtn = document.getElementById('eventMapRemoveBtn');
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var hasDraftMap = Boolean(deps.getEventDraftMapDataUrl());
        var hasSavedMap = !deps.getEventDraftMapRemoved() && isEventMapAvailable(eventEditorCurrentId);
        var hasMap = hasDraftMap || hasSavedMap;
        var canEditMap = !readOnly;

        if (uploadBtn) {
            var showUpload = canEditMap && !hasMap;
            uploadBtn.classList.toggle('hidden', !showUpload);
            uploadBtn.disabled = !showUpload;
        }
        if (removeBtn) {
            var showRemove = canEditMap && hasMap;
            removeBtn.classList.toggle('hidden', !showRemove);
            removeBtn.disabled = !showRemove;
        }
    }

    function updateEventEditorState() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventEditorIsEditMode = deps.getEventEditorIsEditMode();
        var isNewDraft = !eventEditorCurrentId;
        var readOnly = !isNewDraft && !eventEditorIsEditMode;

        var eventNameInput = document.getElementById('eventNameInput');
        if (eventNameInput) {
            eventNameInput.disabled = readOnly;
        }

        ['eventLogoUploadBtn', 'eventLogoRandomBtn', 'eventAddBuildingBtn', 'eventSaveBtn', 'eventCancelEditBtn', 'eventAssignmentAlgorithmInput'].forEach(function (id) {
            var element = document.getElementById(id);
            if (element) {
                element.disabled = readOnly;
            }
        });

        ['eventLogoInput', 'eventMapInput'].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                input.disabled = readOnly;
            }
        });

        var rows = document.querySelectorAll(
            '#eventBuildingsEditorBody input, #eventBuildingsEditorBody button[data-action="remove-row"], #eventBuildingsEditorBody .display-toggle-btn'
        );
        rows.forEach(function (element) {
            element.disabled = readOnly;
        });

        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = readOnly || !eventEditorCurrentId || getProtectedEventIds().has(eventEditorCurrentId);
        }

        var editBtn = document.getElementById('eventEditModeBtn');
        if (editBtn) {
            var showEditBtn = !isNewDraft && !eventEditorIsEditMode;
            editBtn.classList.toggle('hidden', !showEditBtn);
            editBtn.disabled = !showEditBtn;
            editBtn.title = deps.t('events_manager_edit_action');
            editBtn.setAttribute('aria-label', deps.t('events_manager_edit_action'));
        }

        var cancelBtn = document.getElementById('eventCancelEditBtn');
        if (cancelBtn) {
            var showCancelBtn = eventEditorIsEditMode;
            cancelBtn.classList.toggle('hidden', !showCancelBtn);
            cancelBtn.disabled = !showCancelBtn;
            cancelBtn.title = deps.t('settings_cancel');
            cancelBtn.setAttribute('aria-label', deps.t('settings_cancel'));
        }

        var wikiBtn = document.getElementById('eventWikiBtn');
        if (wikiBtn) {
            var showWikiBtn = !isNewDraft;
            wikiBtn.classList.toggle('hidden', !showWikiBtn);
            wikiBtn.disabled = !showWikiBtn;
            wikiBtn.title = deps.t('events_manager_wiki_btn');
            wikiBtn.setAttribute('aria-label', deps.t('events_manager_wiki_btn'));
        }

        var logoUploadBtn = document.getElementById('eventLogoUploadBtn');
        var logoRandomBtn = document.getElementById('eventLogoRandomBtn');
        var addBuildingBtn = document.getElementById('eventAddBuildingBtn');
        if (addBuildingBtn) {
            addBuildingBtn.title = deps.t('events_manager_add_building');
            addBuildingBtn.setAttribute('aria-label', deps.t('events_manager_add_building'));
        }
        if (logoUploadBtn) {
            logoUploadBtn.title = deps.t('events_manager_logo_upload');
            logoUploadBtn.setAttribute('aria-label', deps.t('events_manager_logo_upload'));
            logoUploadBtn.classList.toggle('hidden', readOnly);
        }
        if (logoRandomBtn) {
            logoRandomBtn.title = deps.t('events_manager_logo_randomize');
            logoRandomBtn.setAttribute('aria-label', deps.t('events_manager_logo_randomize'));
            logoRandomBtn.classList.toggle('hidden', readOnly);
        }

        var mapUploadBtn = document.getElementById('eventMapUploadBtn');
        var mapRemoveBtn = document.getElementById('eventMapRemoveBtn');
        if (mapUploadBtn) {
            mapUploadBtn.title = deps.t('events_manager_map_upload');
            mapUploadBtn.setAttribute('aria-label', deps.t('events_manager_map_upload'));
        }
        if (mapRemoveBtn) {
            mapRemoveBtn.title = deps.t('events_manager_map_remove');
            mapRemoveBtn.setAttribute('aria-label', deps.t('events_manager_map_remove'));
        }

        updateEventMapActionButtons(readOnly);
        updateEventCoordinatesButton();
        updateEventEditorTitle();
    }

    function enterEventEditMode() {
        if (!deps.getEventEditorCurrentId()) {
            return;
        }
        deps.setEventEditorIsEditMode(true);
        updateEventEditorState();
    }

    function cancelEventEditing() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var currentEvent = deps.getCurrentEvent();
        if (!eventEditorCurrentId) {
            var fallbackEventId = (currentEvent && global.DSCoreEvents.getEvent(currentEvent))
                ? currentEvent
                : (getEventIds()[0] || '');
            deps.setEventEditorCurrentId(fallbackEventId);
            eventEditorCurrentId = fallbackEventId;
        }

        if (!eventEditorCurrentId || !global.DSCoreEvents.getEvent(eventEditorCurrentId)) {
            startNewEventDraft();
            return;
        }

        deps.setEventEditorIsEditMode(false);
        applySelectedEventToEditor();
        renderEventsList();
        refreshEventEditorDeleteState();
        var statusEl = document.getElementById('eventsStatus');
        if (statusEl) {
            statusEl.replaceChildren();
        }
    }

    function openCoordinatesPickerFromEditor() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            deps.showMessage('eventsStatus', deps.t('events_manager_coordinates_save_first'), 'warning');
            return;
        }
        if ((!isEventMapAvailable(eventEditorCurrentId) || deps.getEventDraftMapRemoved()) && !deps.getEventDraftMapDataUrl()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_coordinates_missing_map'), 'warning');
            return;
        }
        if (deps.getCurrentEvent() !== eventEditorCurrentId) {
            switchEvent(eventEditorCurrentId);
        }
        deps.openCoordinatesPicker();
    }

    function openEventWiki() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            return;
        }
        if (global.FirebaseService && typeof global.FirebaseService.getEventWikiUrl === 'function') {
            var url = global.FirebaseService.getEventWikiUrl(eventEditorCurrentId);
            if (url) {
                global.open(url, '_blank', 'noopener,noreferrer');
            }
        }
    }

    // ---- building editor delegation ----

    function createEditorBuildingRow(rowData) {
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.createEditorBuildingRow === 'function') {
            return global.DSEventBuildingsEditorUI.createEditorBuildingRow({
                rowData: rowData,
                translate: deps.t,
                escapeAttribute: deps.escapeAttribute,
                clampSlots: deps.clampSlots,
                clampPriority: deps.clampPriority,
                minSlots: MIN_BUILDING_SLOTS,
                maxSlots: MAX_BUILDING_SLOTS_TOTAL,
            });
        }
        return document.createElement('tr');
    }

    function renderEventBuildingsEditor(buildings) {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.renderEventBuildingsEditor === 'function') {
            global.DSEventBuildingsEditorUI.renderEventBuildingsEditor({
                tbody: tbody,
                buildings: buildings,
                defaultRows: [{ name: '', slots: 0, priority: 1, showOnMap: true }],
                createRow: createEditorBuildingRow,
            });
            return;
        }
        if (tbody) {
            tbody.innerHTML = '';
            tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
        }
    }

    function addEventBuildingRow() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.addEventBuildingRow === 'function') {
            global.DSEventBuildingsEditorUI.addEventBuildingRow({
                tbody: tbody,
                canEdit: deps.getEventEditorIsEditMode(),
                createRow: createEditorBuildingRow,
                rowData: { name: '', slots: 0, priority: 1, showOnMap: true },
            });
            return;
        }
        if (!deps.getEventEditorIsEditMode() || !tbody) {
            return;
        }
        tbody.appendChild(createEditorBuildingRow({ name: '', slots: 0, priority: 1, showOnMap: true }));
    }

    function readEventBuildingsEditor() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.readEventBuildingsEditor === 'function') {
            return global.DSEventBuildingsEditorUI.readEventBuildingsEditor({
                tbody: tbody,
                translate: deps.t,
                clampSlots: deps.clampSlots,
                clampPriority: deps.clampPriority,
            });
        }
        if (!tbody) {
            return { buildings: [], error: deps.t('events_manager_buildings_required') };
        }
        return { buildings: [], error: null };
    }

    function bindEventEditorTableActions() {
        var tbody = document.getElementById('eventBuildingsEditorBody');
        if (global.DSEventBuildingsEditorUI && typeof global.DSEventBuildingsEditorUI.bindEventEditorTableActions === 'function') {
            global.DSEventBuildingsEditorUI.bindEventEditorTableActions({
                tbody: tbody,
                canEdit: function () { return deps.getEventEditorIsEditMode(); },
                ensureAtLeastOneRow: function () { addEventBuildingRow(); },
            });
            return;
        }
    }

    function setEditorName(value) {
        var input = document.getElementById('eventNameInput');
        if (input) {
            input.value = value || '';
        }
    }

    // ---- algorithm select ----

    function getEventAlgorithmSelectElement() {
        return document.getElementById('eventAssignmentAlgorithmInput');
    }

    function listSelectableAssignmentAlgorithmsForActiveGame() {
        var gameplayContext = deps.getGameplayContext();
        var gameId = gameplayContext ? gameplayContext.gameId : '';
        if (global.DSAssignmentRegistry && typeof global.DSAssignmentRegistry.listAlgorithmsForGame === 'function') {
            var algorithms = global.DSAssignmentRegistry.listAlgorithmsForGame(gameId);
            if (Array.isArray(algorithms) && algorithms.length > 0) {
                return algorithms
                    .filter(function (entry) { return entry && typeof entry.id === 'string'; })
                    .map(function (entry) {
                        return {
                            id: normalizeAssignmentAlgorithmId(entry.id),
                            name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.id,
                        };
                    })
                    .filter(function (entry) { return !!entry.id; });
            }
        }
        return [{
            id: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
            name: 'Balanced Round Robin',
        }];
    }

    function renderEventAssignmentAlgorithmOptions(selectedAlgorithmId) {
        var select = getEventAlgorithmSelectElement();
        if (!select) {
            return;
        }
        var algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
        var fallbackId = algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
        var selectedId = normalizeAssignmentAlgorithmId(selectedAlgorithmId) || fallbackId;
        select.innerHTML = '';
        algorithms.forEach(function (algorithm) {
            var option = document.createElement('option');
            option.value = algorithm.id;
            option.textContent = algorithm.name;
            select.appendChild(option);
        });
        var hasSelected = algorithms.some(function (algorithm) { return algorithm.id === selectedId; });
        select.value = hasSelected ? selectedId : fallbackId;
    }

    function getSelectedEventAssignmentAlgorithmId() {
        var select = getEventAlgorithmSelectElement();
        var selected = select && typeof select.value === 'string' ? normalizeAssignmentAlgorithmId(select.value) : '';
        if (selected) {
            return selected;
        }
        var algorithms = listSelectableAssignmentAlgorithmsForActiveGame();
        return algorithms[0] ? algorithms[0].id : DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    // ---- apply/render ----

    function applySelectedEventToEditor() {
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var currentEvent = deps.getCurrentEvent();
        if (!eventEditorCurrentId) {
            deps.setEventEditorCurrentId(currentEvent);
            eventEditorCurrentId = currentEvent;
        }
        var event = global.DSCoreEvents.getEvent(eventEditorCurrentId);
        if (!event) {
            startNewEventDraft();
            return;
        }
        setEditorName(event.name || eventEditorCurrentId);
        deps.setEventDraftLogoDataUrl(event.logoDataUrl || generateEventAvatarDataUrl(event.name || eventEditorCurrentId, eventEditorCurrentId));
        deps.setEventDraftMapDataUrl(event.mapDataUrl || '');
        deps.setEventDraftMapRemoved(false);
        renderEventAssignmentAlgorithmOptions(event.assignmentAlgorithmId);
        updateEventLogoPreview();
        updateEventMapPreview();
        renderEventBuildingsEditor(Array.isArray(event.buildings) ? event.buildings : []);
        updateEventEditorState();
    }

    function renderEventsList() {
        var currentEvent = deps.getCurrentEvent();
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (global.DSEventListUI && typeof global.DSEventListUI.renderEventsList === 'function') {
            global.DSEventListUI.renderEventsList({
                listElement: document.getElementById('eventsList'),
                eventIds: getEventIds(),
                getEventById: function (eventId) { return global.DSCoreEvents.getEvent(eventId); },
                currentEventId: currentEvent,
                eventEditorCurrentId: eventEditorCurrentId,
                generateAvatarDataUrl: generateEventAvatarDataUrl,
                translate: deps.t,
                getWikiUrl: function (eventId) {
                    if (global.FirebaseService && typeof global.FirebaseService.getEventWikiUrl === 'function') {
                        return global.FirebaseService.getEventWikiUrl(eventId);
                    }
                    return '';
                },
                onSelectEvent: function (eventId) {
                    deps.setEventEditorCurrentId(eventId);
                    switchEvent(eventId);
                },
                onStartNewEvent: function () {
                    startNewEventDraft();
                    renderEventsList();
                },
            });
            return;
        }

        var listEl = document.getElementById('eventsList');
        if (!listEl) {
            return;
        }
    }

    function startNewEventDraft() {
        deps.setEventEditorCurrentId('');
        deps.setEventEditorIsEditMode(true);
        setEditorName('');
        var gameplayContext = deps.getGameplayContext();
        renderEventAssignmentAlgorithmOptions(resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : ''));
        deps.setEventDraftLogoDataUrl('');
        deps.setEventDraftMapDataUrl('');
        deps.setEventDraftMapRemoved(false);
        updateEventLogoPreview();
        updateEventMapPreview();
        renderEventBuildingsEditor([{ name: 'Bomb Squad', slots: 4, priority: 1, showOnMap: true }]);
        updateEventEditorState();
        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
    }

    function refreshEventEditorDeleteState() {
        var deleteBtn = document.getElementById('eventDeleteBtn');
        if (!deleteBtn) {
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        deleteBtn.disabled = !eventEditorCurrentId || getProtectedEventIds().has(eventEditorCurrentId) || !deps.getEventEditorIsEditMode();
    }

    // ---- upload triggers ----

    function triggerEventLogoUpload() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var input = document.getElementById('eventLogoInput');
        if (input) {
            input.click();
        }
    }

    function triggerEventMapUpload() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        var input = document.getElementById('eventMapInput');
        if (input) {
            input.click();
        }
    }

    function removeEventLogo() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        deps.setEventDraftLogoDataUrl('');
        var input = document.getElementById('eventLogoInput');
        if (input) {
            input.value = '';
        }
        updateEventLogoPreview();
    }

    function removeEventMap() {
        if (!deps.getEventEditorIsEditMode()) {
            return;
        }
        deps.setEventDraftMapDataUrl('');
        deps.setEventDraftMapRemoved(true);
        var input = document.getElementById('eventMapInput');
        if (input) {
            input.value = '';
        }
        updateEventMapPreview();
        updateEventEditorState();
    }

    // ---- image processing (delegated to DSEventsImageProcessor) ----

    function createEventImageDataUrl(file, options) {
        return global.DSEventsImageProcessor.createEventImageDataUrl(file, options, deps);
    }

    function createContainedSquareImageDataUrl(sourceDataUrl, options) {
        return global.DSEventsImageProcessor.createContainedSquareImageDataUrl(sourceDataUrl, options, deps);
    }

    function createGameMetadataLogoDataUrl(file) {
        return global.DSEventsImageProcessor.createGameMetadataLogoDataUrl(file, deps);
    }

    // ---- file change handlers ----

    async function handleEventLogoChange(event) {
        var input = event && event.target ? event.target : document.getElementById('eventLogoInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            deps.setEventDraftLogoDataUrl(await createEventImageDataUrl(file, {
                maxBytes: deps.AVATAR_MAX_UPLOAD_BYTES,
                minDimension: deps.AVATAR_MIN_DIMENSION,
                maxSide: 320,
                maxDataUrlLength: deps.EVENT_LOGO_DATA_URL_LIMIT,
                tooLargeMessage: deps.t('events_manager_logo_too_large'),
            }));
            updateEventLogoPreview();
            deps.showMessage('eventsStatus', deps.t('events_manager_logo_saved'), 'success');
        } catch (error) {
            deps.showMessage('eventsStatus', error.message || deps.t('events_manager_image_process_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    async function handleEventMapChange(event) {
        var input = event && event.target ? event.target : document.getElementById('eventMapInput');
        var file = input && input.files ? input.files[0] : null;
        if (!file) {
            return;
        }
        try {
            deps.setEventDraftMapDataUrl(await createEventImageDataUrl(file, {
                maxBytes: 4 * 1024 * 1024,
                minDimension: 320,
                maxSide: MAP_UPLOAD_MAX_SIDE,
                maxDataUrlLength: deps.EVENT_MAP_DATA_URL_LIMIT,
                tooLargeMessage: deps.t('events_manager_map_too_large'),
            }));
            deps.setEventDraftMapRemoved(false);
            updateEventMapPreview();
            updateEventEditorState();
            deps.showMessage('eventsStatus', deps.t('events_manager_map_saved'), 'success');
        } catch (error) {
            deps.showMessage('eventsStatus', error.message || deps.t('events_manager_image_process_failed'), 'error');
        } finally {
            if (input) {
                input.value = '';
            }
        }
    }

    // ---- event definition build ----

    function buildEventDefinition(eventId, name, buildings, assignmentAlgorithmId) {
        var existing = global.DSCoreEvents.getEvent(eventId) || {};
        var mapDataUrl = deps.getEventDraftMapDataUrl() || '';
        var logoDataUrl = deps.getEventDraftLogoDataUrl() || generateEventAvatarDataUrl(name, eventId);
        var gameplayContext = deps.getGameplayContext();
        var normalizedAssignmentAlgorithmId = normalizeAssignmentAlgorithmId(assignmentAlgorithmId)
            || normalizeAssignmentAlgorithmId(existing.assignmentAlgorithmId)
            || resolveDefaultAssignmentAlgorithmId(gameplayContext ? gameplayContext.gameId : '');
        var validNames = new Set(buildings.map(function (item) { return item.name; }));
        var currentPositions = buildingPositionsMap[eventId] || (existing.defaultPositions || {});
        var normalizedPositions = global.DSCoreBuildings.normalizeBuildingPositions(currentPositions, validNames);
        return {
            id: eventId,
            name: name,
            titleKey: existing.titleKey || '',
            mapFile: mapDataUrl || '',
            previewMapFile: mapDataUrl || '',
            exportMapFile: mapDataUrl || '',
            mapTitle: name.toUpperCase().slice(0, 50),
            excelPrefix: normalizeEventId(existing.excelPrefix || eventId) || eventId,
            logoDataUrl: logoDataUrl,
            mapDataUrl: mapDataUrl,
            assignmentAlgorithmId: normalizedAssignmentAlgorithmId,
            buildings: buildings,
            defaultPositions: normalizedPositions,
            buildingAnchors: existing.buildingAnchors || {},
        };
    }

    // ---- save / delete ----

    async function saveEventDefinition() {
        var gameplayContext = deps.getGameplayContext('eventsStatus');
        if (!gameplayContext) {
            return;
        }
        if (!deps.getEventEditorIsEditMode()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_edit_first'), 'warning');
            return;
        }
        var nameInput = document.getElementById('eventNameInput');
        var rawName = nameInput && typeof nameInput.value === 'string' ? nameInput.value.trim() : '';
        var eventName = rawName.slice(0, deps.EVENT_NAME_LIMIT);
        if (!eventName) {
            deps.showMessage('eventsStatus', deps.t('events_manager_name_required'), 'error');
            return;
        }

        var result = readEventBuildingsEditor();
        if (result.error) {
            deps.showMessage('eventsStatus', result.error, 'error');
            return;
        }
        var buildings = result.buildings;

        var existingIds = getEventIds();
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        var eventId = eventEditorCurrentId || global.DSCoreEvents.slugifyEventId(eventName, existingIds);
        var eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
        var assignmentAlgorithmId = getSelectedEventAssignmentAlgorithmId();
        var definition = buildEventDefinition(eventId, eventName, buildings, assignmentAlgorithmId);
        var isNewEvent = !eventEditorCurrentId;

        global.DSCoreEvents.upsertEvent(eventId, definition);
        ensureEventRuntimeState(eventId);
        buildingConfigs[eventId] = deps.normalizeBuildingConfig(buildings, buildings);
        var validNames = new Set(buildings.map(function (item) { return item.name; }));
        buildingPositionsMap[eventId] = global.DSCoreBuildings.normalizeBuildingPositions(
            buildingPositionsMap[eventId] || definition.defaultPositions || {},
            validNames
        );
        resetMapStateForEvent(eventId);

        var FirebaseService = deps.getFirebaseService();
        if (FirebaseService) {
            if (FirebaseService.upsertEvent) {
                FirebaseService.upsertEvent(eventId, {
                    id: eventId,
                    name: definition.name,
                    logoDataUrl: definition.logoDataUrl,
                    mapDataUrl: definition.mapDataUrl,
                    assignmentAlgorithmId: definition.assignmentAlgorithmId,
                    buildingConfig: buildingConfigs[eventId],
                    buildingPositions: buildingPositionsMap[eventId],
                }, eventContext);
            }
            FirebaseService.setBuildingConfig(eventId, buildingConfigs[eventId], eventContext);
            FirebaseService.setBuildingConfigVersion(eventId, deps.getTargetBuildingConfigVersion(), eventContext);
            FirebaseService.setBuildingPositions(eventId, buildingPositionsMap[eventId], eventContext);
            FirebaseService.setBuildingPositionsVersion(eventId, deps.getTargetBuildingPositionsVersion(), eventContext);
            var saveResult = await FirebaseService.saveUserData(undefined, gameplayContext);
            if (!saveResult || !saveResult.success) {
                deps.showMessage('eventsStatus', deps.t('events_manager_save_failed', { error: (saveResult && saveResult.error) || 'unknown' }), 'error');
                return;
            }
        }

        deps.setEventEditorCurrentId(eventId);
        deps.setCurrentEvent(eventId);
        deps.setEventEditorIsEditMode(false);
        syncRuntimeStateWithRegistry();
        renderAllEventSelectors();
        renderEventsList();
        refreshEventEditorDeleteState();
        updateEventEditorState();
        updateGenerateEventLabels();
        deps.loadBuildingConfig();
        deps.loadBuildingPositions();
        deps.renderBuildingsTable();
        deps.showMessage('eventsStatus', deps.t('events_manager_saved'), 'success');

        if (isNewEvent && definition.mapDataUrl) {
            deps.openCoordinatesPicker();
        }
    }

    async function deleteSelectedEvent() {
        var gameplayContext = deps.getGameplayContext('eventsStatus');
        if (!gameplayContext) {
            return;
        }
        if (!deps.getEventEditorIsEditMode()) {
            deps.showMessage('eventsStatus', deps.t('events_manager_edit_first'), 'warning');
            return;
        }
        var eventEditorCurrentId = deps.getEventEditorCurrentId();
        if (!eventEditorCurrentId) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_pick_event'), 'error');
            return;
        }
        if (getProtectedEventIds().has(eventEditorCurrentId)) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_protected'), 'warning');
            return;
        }
        if (!confirm(deps.t('events_manager_delete_confirm'))) {
            return;
        }

        var eventId = eventEditorCurrentId;
        var eventContext = { gameId: gameplayContext.gameId, eventId: eventId };
        var removed = global.DSCoreEvents.removeEvent(eventId);
        if (!removed) {
            deps.showMessage('eventsStatus', deps.t('events_manager_delete_failed'), 'error');
            return;
        }

        delete buildingConfigs[eventId];
        delete buildingPositionsMap[eventId];
        deleteMapRuntimeStateForEvent(eventId);
        delete coordMapWarningShown[eventId];

        var FirebaseService = deps.getFirebaseService();
        if (FirebaseService && FirebaseService.removeEvent) {
            FirebaseService.removeEvent(eventId, eventContext);
            var result = await FirebaseService.saveUserData(undefined, gameplayContext);
            if (!result || !result.success) {
                deps.showMessage('eventsStatus', deps.t('events_manager_delete_failed'), 'error');
                return;
            }
        }

        syncRuntimeStateWithRegistry();
        var firstEvent = getEventIds()[0] || '';
        if (firstEvent) {
            deps.setCurrentEvent(firstEvent);
        }
        startNewEventDraft();
        renderAllEventSelectors();
        renderEventsList();
        updateGenerateEventLabels();
        deps.loadBuildingConfig();
        deps.loadBuildingPositions();
        deps.renderBuildingsTable();
        deps.showMessage('eventsStatus', deps.t('events_manager_deleted'), 'success');
    }

    // ---- public API ----

    global.DSEventsRegistryController = {
        // init
        init: function (dependencies) {
            deps = dependencies;
        },

        // constants
        DEFAULT_ASSIGNMENT_ALGORITHM_ID: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
        MAP_PREVIEW: MAP_PREVIEW,
        MAP_EXPORT: MAP_EXPORT,
        MAP_CANVAS_WIDTH: MAP_CANVAS_WIDTH,
        MAP_CANVAS_FALLBACK_HEIGHT: MAP_CANVAS_FALLBACK_HEIGHT,
        MAP_GRID_STEP: MAP_GRID_STEP,
        MAP_UPLOAD_MAX_SIDE: MAP_UPLOAD_MAX_SIDE,
        BUILDING_POSITIONS_VERSION: BUILDING_POSITIONS_VERSION,
        BUILDING_CONFIG_VERSION: BUILDING_CONFIG_VERSION,
        MAX_BUILDING_SLOTS_TOTAL: MAX_BUILDING_SLOTS_TOTAL,
        MIN_BUILDING_SLOTS: MIN_BUILDING_SLOTS,
        textColors: textColors,
        bgColors: bgColors,

        // state accessors
        getBuildingConfigs: function () { return buildingConfigs; },
        getBuildingPositionsMap: function () { return buildingPositionsMap; },
        getCoordMapWarningShown: function () { return coordMapWarningShown; },
        getProtectedEventIds: getProtectedEventIds,

        // normalizers
        normalizeEventId: normalizeEventId,
        normalizeAssignmentAlgorithmId: normalizeAssignmentAlgorithmId,
        normalizeGameId: normalizeGameId,
        normalizeMapPurpose: normalizeMapPurpose,
        normalizeStoredEventsData: normalizeStoredEventsData,
        isImageDataUrl: isImageDataUrl,
        hashString: hashString,
        resolveDefaultAssignmentAlgorithmId: resolveDefaultAssignmentAlgorithmId,

        // event ids / active event
        getEventIds: getEventIds,
        getActiveEvent: getActiveEvent,
        getEventDisplayName: getEventDisplayName,

        // runtime state management
        ensureEventRuntimeState: ensureEventRuntimeState,
        resetMapStateForEvent: resetMapStateForEvent,
        syncRuntimeStateWithRegistry: syncRuntimeStateWithRegistry,
        getMapRuntimeState: getMapRuntimeStateFn,
        deleteMapRuntimeStateForEvent: deleteMapRuntimeStateForEvent,

        // map
        getEventMapFile: getEventMapFile,
        loadMapImage: loadMapImage,

        // registry
        buildRegistryFromStorage: buildRegistryFromStorage,

        // event switching
        switchEvent: switchEvent,
        updateGenerateEventLabels: updateGenerateEventLabels,

        // avatar
        generateEventAvatarDataUrl: generateEventAvatarDataUrl,

        // editor UI
        updateEventLogoPreview: updateEventLogoPreview,
        updateEventMapPreview: updateEventMapPreview,
        updateEventEditorTitle: updateEventEditorTitle,
        updateEventEditorState: updateEventEditorState,
        updateEventCoordinatesButton: updateEventCoordinatesButton,
        updateEventMapActionButtons: updateEventMapActionButtons,
        isEventMapAvailable: isEventMapAvailable,
        getEventMapPreviewSource: getEventMapPreviewSource,
        enterEventEditMode: enterEventEditMode,
        cancelEventEditing: cancelEventEditing,
        openCoordinatesPickerFromEditor: openCoordinatesPickerFromEditor,
        openEventWiki: openEventWiki,

        // building editor
        createEditorBuildingRow: createEditorBuildingRow,
        renderEventBuildingsEditor: renderEventBuildingsEditor,
        addEventBuildingRow: addEventBuildingRow,
        readEventBuildingsEditor: readEventBuildingsEditor,
        bindEventEditorTableActions: bindEventEditorTableActions,
        setEditorName: setEditorName,

        // algorithm
        listSelectableAssignmentAlgorithmsForActiveGame: listSelectableAssignmentAlgorithmsForActiveGame,
        renderEventAssignmentAlgorithmOptions: renderEventAssignmentAlgorithmOptions,
        getSelectedEventAssignmentAlgorithmId: getSelectedEventAssignmentAlgorithmId,

        // apply / render
        applySelectedEventToEditor: applySelectedEventToEditor,
        renderEventsList: renderEventsList,
        renderAllEventSelectors: renderAllEventSelectors,
        renderEventSelector: renderEventSelector,
        createEventSelectorButton: createEventSelectorButton,
        startNewEventDraft: startNewEventDraft,
        refreshEventEditorDeleteState: refreshEventEditorDeleteState,

        // uploads
        triggerEventLogoUpload: triggerEventLogoUpload,
        triggerEventMapUpload: triggerEventMapUpload,
        removeEventLogo: removeEventLogo,
        removeEventMap: removeEventMap,

        // image processing
        createEventImageDataUrl: createEventImageDataUrl,
        createContainedSquareImageDataUrl: createContainedSquareImageDataUrl,
        createGameMetadataLogoDataUrl: createGameMetadataLogoDataUrl,

        // file handlers
        handleEventLogoChange: handleEventLogoChange,
        handleEventMapChange: handleEventMapChange,

        // event definition
        buildEventDefinition: buildEventDefinition,
        saveEventDefinition: saveEventDefinition,
        deleteSelectedEvent: deleteSelectedEvent,
    };
})(window);
