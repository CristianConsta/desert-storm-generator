const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal stubs for the IIFE's global dependencies
function createGlobal() {
    const eventRegistry = {
        desert_storm: { id: 'desert_storm', name: 'Desert Storm', titleKey: 'event_desert_storm', buildings: [], defaultPositions: {}, buildingAnchors: {} },
    };
    const g = {
        DSCoreEvents: {
            EVENT_REGISTRY: eventRegistry,
            getEventIds: () => Object.keys(eventRegistry),
            getEvent: (id) => eventRegistry[id] || null,
            setEventRegistry: (r) => { Object.keys(eventRegistry).forEach((k) => delete eventRegistry[k]); Object.assign(eventRegistry, r); },
            cloneEventRegistry: () => JSON.parse(JSON.stringify(eventRegistry)),
            cloneLegacyEventRegistry: () => JSON.parse(JSON.stringify(eventRegistry)),
            upsertEvent: (id, def) => { eventRegistry[id] = def; },
            removeEvent: (id) => { if (eventRegistry[id]) { delete eventRegistry[id]; return true; } return false; },
            slugifyEventId: (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            normalizeEventId: (value) => typeof value === 'string'
                ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                : '',
        },
        DSCoreGames: {
            normalizeGameId: (value) => typeof value === 'string'
                ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
                : '',
        },
        DSCoreBuildings: {
            normalizeBuildingPositions: (pos) => pos || {},
        },
        DSAssignmentRegistry: {
            listAlgorithmsForGame: () => [{ id: 'balanced_round_robin', name: 'Balanced Round Robin' }],
        },
        DSEventsImageProcessor: {
            isImageDataUrl: function (value, maxLength) {
                var dataUrl = typeof value === 'string' ? value.trim() : '';
                if (!dataUrl || !dataUrl.startsWith('data:image/')) return false;
                return dataUrl.length <= maxLength;
            },
            hashString: function (value) {
                var input = String(value || '');
                var hash = 2166136261;
                for (var i = 0; i < input.length; i++) {
                    hash ^= input.charCodeAt(i);
                    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
                }
                return Math.abs(hash >>> 0);
            },
            generateEventAvatarDataUrl: () => '',
            createEventImageDataUrl: async () => 'data:image/jpeg;base64,test',
            createContainedSquareImageDataUrl: async () => 'data:image/jpeg;base64,test',
            createGameMetadataLogoDataUrl: async () => 'data:image/jpeg;base64,test',
        },
        DSEventsMapController: {
            MAP_PREVIEW: 'preview',
            MAP_EXPORT: 'export',
            MAP_CANVAS_WIDTH: 1080,
            MAP_CANVAS_FALLBACK_HEIGHT: 720,
            MAP_GRID_STEP: 90,
            MAP_UPLOAD_MAX_SIDE: 1080,
            textColors: { 1: '#8B0000', 2: '#B85C00', 3: '#006464', 4: '#006699', 5: '#226644', 6: '#556B2F' },
            bgColors: { 1: 'rgba(255,230,230,0.9)', 2: 'rgba(255,240,220,0.9)', 3: 'rgba(230,255,250,0.9)', 4: 'rgba(230,245,255,0.9)', 5: 'rgba(240,255,240,0.9)', 6: 'rgba(245,255,235,0.9)' },
            ensureMapRuntimeState: () => ({ image: { src: '' }, loaded: false, retries: 0, unavailable: false, promise: null, sourceSignature: '' }),
            getMapRuntimeState: () => ({ image: { src: '' }, loaded: false, retries: 0, unavailable: false, promise: null, sourceSignature: '' }),
            deleteMapRuntimeStateForEvent: () => {},
            resetMapStateForEvent: () => {},
            cleanupOrphanedMapState: () => {},
            getEventMapFile: () => null,
            loadMapImage: () => Promise.resolve(true),
            normalizeMapPurpose: (p) => p === 'export' ? 'export' : 'preview',
        },
        Image: class { constructor() { this.src = ''; this.onload = null; this.onerror = null; } },
        document: {
            createElement: (tag) => ({ tagName: tag, width: 0, height: 0, className: '', type: '', dataset: {}, textContent: '', value: '', disabled: false, innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, addEventListener() {}, appendChild() {}, getContext() { return null; }, click() {}, replaceChildren() {}, querySelectorAll() { return []; }, setAttribute() {} }),
            getElementById: () => null,
            querySelectorAll: () => [],
        },
        confirm: () => true,
        console: { log() {}, warn() {}, error() {} },
    };
    return g;
}

const controllerPath = require('node:path').resolve(__dirname, '../js/features/events-manager/events-registry-controller.js');

function loadController(g) {
    const origWindow = globalThis.window;
    const origDocument = globalThis.document;
    const origImage = globalThis.Image;
    const origConsole = globalThis.console;
    globalThis.window = g;
    globalThis.document = g.document;
    globalThis.Image = g.Image;
    globalThis.console = g.console;
    // Force re-execution of IIFE on each call
    delete require.cache[controllerPath];
    require(controllerPath);
    globalThis.window = origWindow;
    globalThis.document = origDocument;
    globalThis.Image = origImage;
    globalThis.console = origConsole;
    return g.DSEventsRegistryController;
}

function initController(ctrl, overrides) {
    const defaults = {
        t: (k) => k,
        getCurrentEvent: () => 'desert_storm',
        setCurrentEvent: () => {},
        getEventEditorCurrentId: () => '',
        setEventEditorCurrentId: () => {},
        getEventEditorIsEditMode: () => false,
        setEventEditorIsEditMode: () => {},
        getEventDraftLogoDataUrl: () => '',
        setEventDraftLogoDataUrl: () => {},
        getEventDraftMapDataUrl: () => '',
        setEventDraftMapDataUrl: () => {},
        getEventDraftMapRemoved: () => false,
        setEventDraftMapRemoved: () => {},
        EVENT_NAME_LIMIT: 30,
        EVENT_LOGO_DATA_URL_LIMIT: 220000,
        EVENT_MAP_DATA_URL_LIMIT: 950000,
        AVATAR_MAX_UPLOAD_BYTES: 2 * 1024 * 1024,
        AVATAR_MIN_DIMENSION: 96,
        enforceGameplayContext: () => 'last_war',
        getGameplayContext: () => ({ gameId: 'last_war' }),
        getFirebaseService: () => null,
        showMessage: () => {},
        normalizeBuildingConfig: (a) => a,
        loadBuildingConfig: () => {},
        loadBuildingPositions: () => {},
        renderBuildingsTable: () => {},
        isConfigurationPageVisible: () => false,
        refreshCoordinatesPickerForCurrentEvent: () => {},
        openCoordinatesPicker: () => {},
        getTargetBuildingConfigVersion: () => 2,
        getTargetBuildingPositionsVersion: () => 2,
        getAvatarInitials: (n) => (n || '').slice(0, 2).toUpperCase(),
        escapeAttribute: (s) => s,
        clampSlots: (v) => v,
        clampPriority: (v) => v,
        isAllowedAvatarFile: () => true,
        readFileAsDataUrl: () => Promise.resolve(''),
        loadImageFromDataUrl: () => Promise.resolve({ width: 100, height: 100 }),
        clearAssignments: () => {},
    };
    ctrl.init(Object.assign(defaults, overrides));
}

describe('DSEventsRegistryController', () => {
    let g, ctrl;

    let origImage;
    beforeEach(() => {
        g = createGlobal();
        origImage = globalThis.Image;
        globalThis.Image = g.Image;
        ctrl = loadController(g);
        initController(ctrl);
    });

    afterEach(() => {
        globalThis.Image = origImage;
    });

    describe('normalizeEventId', () => {
        it('lowercases and strips special chars', () => {
            assert.equal(ctrl.normalizeEventId('Desert Storm!'), 'desert_storm');
        });
        it('returns empty for non-string', () => {
            assert.equal(ctrl.normalizeEventId(42), '');
            assert.equal(ctrl.normalizeEventId(null), '');
        });
    });

    describe('normalizeAssignmentAlgorithmId', () => {
        it('trims and lowercases', () => {
            assert.equal(ctrl.normalizeAssignmentAlgorithmId('  Balanced_Round_Robin  '), 'balanced_round_robin');
        });
        it('returns empty for non-string', () => {
            assert.equal(ctrl.normalizeAssignmentAlgorithmId(undefined), '');
        });
    });

    describe('normalizeGameId', () => {
        it('normalizes game id', () => {
            assert.equal(ctrl.normalizeGameId('Last War!'), 'last_war');
        });
    });

    describe('isImageDataUrl', () => {
        it('accepts valid data URLs within limit', () => {
            assert.equal(ctrl.isImageDataUrl('data:image/png;base64,abc', 100), true);
        });
        it('rejects non-image data URLs', () => {
            assert.equal(ctrl.isImageDataUrl('data:text/plain;base64,abc', 100), false);
        });
        it('rejects URLs exceeding max length', () => {
            assert.equal(ctrl.isImageDataUrl('data:image/png;base64,' + 'x'.repeat(100), 50), false);
        });
    });

    describe('hashString', () => {
        it('returns a non-negative integer', () => {
            const h = ctrl.hashString('test');
            assert.equal(typeof h, 'number');
            assert.ok(h >= 0);
        });
        it('is deterministic', () => {
            assert.equal(ctrl.hashString('foo'), ctrl.hashString('foo'));
        });
        it('handles empty input', () => {
            assert.equal(typeof ctrl.hashString(''), 'number');
        });
    });

    describe('resolveDefaultAssignmentAlgorithmId', () => {
        it('returns first algorithm from registry', () => {
            assert.equal(ctrl.resolveDefaultAssignmentAlgorithmId('last_war'), 'balanced_round_robin');
        });
        it('returns default when no registry', () => {
            delete g.DSAssignmentRegistry;
            assert.equal(ctrl.resolveDefaultAssignmentAlgorithmId('unknown'), 'balanced_round_robin');
        });
    });

    describe('getEventIds / getActiveEvent', () => {
        it('returns event ids from registry', () => {
            const ids = ctrl.getEventIds();
            assert.ok(ids.includes('desert_storm'));
        });
        it('getActiveEvent returns the current event', () => {
            const event = ctrl.getActiveEvent();
            assert.equal(event.id, 'desert_storm');
        });
    });

    describe('getEventDisplayName', () => {
        it('returns event name', () => {
            assert.equal(ctrl.getEventDisplayName('desert_storm'), 'Desert Storm');
        });
        it('returns id for unknown event', () => {
            assert.equal(ctrl.getEventDisplayName('unknown_event'), 'unknown_event');
        });
    });

    describe('buildRegistryFromStorage', () => {
        it('populates registry from legacy data', () => {
            ctrl.buildRegistryFromStorage();
            const ids = ctrl.getEventIds();
            assert.ok(ids.includes('desert_storm'));
        });
    });

    describe('state accessors', () => {
        it('getBuildingConfigs returns mutable object', () => {
            const configs = ctrl.getBuildingConfigs();
            assert.equal(typeof configs, 'object');
        });
        it('getBuildingPositionsMap returns mutable object', () => {
            const map = ctrl.getBuildingPositionsMap();
            assert.equal(typeof map, 'object');
        });
        it('getProtectedEventIds returns a Set', () => {
            const ids = ctrl.getProtectedEventIds();
            assert.ok(ids instanceof Set);
            assert.ok(ids.has('desert_storm'));
        });
    });

    describe('ensureEventRuntimeState / resetMapStateForEvent', () => {
        it('creates building config entry for event', () => {
            ctrl.ensureEventRuntimeState('desert_storm');
            const configs = ctrl.getBuildingConfigs();
            assert.ok('desert_storm' in configs);
        });
        it('resetMapStateForEvent does not throw', () => {
            ctrl.resetMapStateForEvent('desert_storm');
        });
    });

    describe('normalizeStoredEventsData', () => {
        it('normalizes valid entries', () => {
            const result = ctrl.normalizeStoredEventsData({
                'My Event': { name: 'My Event', logoDataUrl: '', mapDataUrl: '', assignmentAlgorithmId: 'balanced_round_robin' },
            });
            assert.ok('my_event' in result);
            assert.equal(result.my_event.name, 'My Event');
        });
        it('skips invalid entries', () => {
            const result = ctrl.normalizeStoredEventsData({ '': { name: 'x' }, valid: null });
            assert.deepEqual(result, {});
        });
    });

    describe('constants', () => {
        it('exposes expected constants', () => {
            assert.equal(ctrl.MAP_PREVIEW, 'preview');
            assert.equal(ctrl.MAP_EXPORT, 'export');
            assert.equal(ctrl.MAP_CANVAS_WIDTH, 1080);
            assert.equal(ctrl.BUILDING_POSITIONS_VERSION, 2);
            assert.equal(ctrl.BUILDING_CONFIG_VERSION, 2);
            assert.equal(ctrl.MAX_BUILDING_SLOTS_TOTAL, 20);
            assert.equal(ctrl.MIN_BUILDING_SLOTS, 0);
            assert.ok(ctrl.textColors[1]);
            assert.ok(ctrl.bgColors[1]);
        });
    });
});
