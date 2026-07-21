const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM shim
const elementStore = {};
const mockElement = (id) => ({
    id: id,
    textContent: '',
    innerHTML: '',
    classList: { toggle: () => {}, remove: () => {}, add: () => {}, contains: () => false },
    onclick: null,
    contains: () => false,
});

global.window = global;
global.document = {
    getElementById: (id) => {
        if (!elementStore[id]) elementStore[id] = mockElement(id);
        return elementStore[id];
    },
    querySelector: () => mockElement('mock'),
    createElement: (tag) => {
        const el = mockElement(tag);
        el.getContext = () => null;
        el.click = () => {};
        el.width = 0;
        el.height = 0;
        return el;
    },
    body: { appendChild: () => {}, removeChild: () => {} },
    addEventListener: () => {},
};
global.Image = class { set src(v) { if (this.onerror) this.onerror(); } };
global.alert = () => {};

// Where Node exposes a global `navigator` (Node 21+), it's a getter-only property (no
// setter), so a plain `global.navigator = {...}` silently no-ops. Use defineProperty to
// actually mock it. Older Node (e.g. CI's Node 20) has no `navigator` global at all, so
// there's nothing to restore a descriptor for — just delete the mock in that case.
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');
const mockNavigator = (value) => {
    Object.defineProperty(global, 'navigator', { value, configurable: true, writable: true });
};
const restoreNavigator = () => {
    if (originalNavigatorDescriptor) {
        Object.defineProperty(global, 'navigator', originalNavigatorDescriptor);
    } else {
        delete global.navigator;
    }
};
global.FirebaseService = { getActivePlayerDatabase: () => ({}) };
let lastSheetData = null;
let lastWriteOpts = null;
global.XLSX = {
    utils: {
        book_new: () => ({}),
        json_to_sheet: (data) => {
            lastSheetData = data;
            return {};
        },
        book_append_sheet: () => {},
    },
    write: (workbook, opts) => {
        lastWriteOpts = opts;
        return new Uint8Array([1, 2, 3]);
    },
};

// Load the module
require('../js/features/generator/download-controller.js');

describe('DSDownloadController', () => {
    beforeEach(() => {
        lastSheetData = null;
        lastWriteOpts = null;
    });

    it('exports all expected methods', () => {
        const ctrl = global.DSDownloadController;
        assert.ok(ctrl, 'DSDownloadController should be defined');
        assert.equal(typeof ctrl.openDownloadModal, 'function');
        assert.equal(typeof ctrl.closeDownloadModal, 'function');
        assert.equal(typeof ctrl.downloadTeamExcel, 'function');
        assert.equal(typeof ctrl.downloadTeamMap, 'function');
        assert.equal(typeof ctrl.getMapHeaderTitle, 'function');
        assert.equal(typeof ctrl.getActiveEventAvatarDataUrl, 'function');
        assert.equal(typeof ctrl.loadActiveEventAvatarForHeader, 'function');
        assert.equal(typeof ctrl.fitCanvasHeaderText, 'function');
        assert.equal(typeof ctrl.drawGeneratedMapHeader, 'function');
        assert.equal(typeof ctrl.generateMapWithoutBackground, 'function');
        assert.equal(typeof ctrl.generateMap, 'function');
    });

    it('getMapHeaderTitle returns correct format for team A', () => {
        const deps = {
            getCurrentEvent: () => 'desert_storm',
            getEventDisplayName: () => 'Desert Storm',
        };
        const title = global.DSDownloadController.getMapHeaderTitle('A', deps);
        assert.equal(title, 'TEAM A ASSIGNMENTS - Desert Storm');
    });

    it('getMapHeaderTitle returns correct format for team B', () => {
        const deps = {
            getCurrentEvent: () => 'canyon_storm',
            getEventDisplayName: () => 'Canyon Storm',
        };
        const title = global.DSDownloadController.getMapHeaderTitle('B', deps);
        assert.equal(title, 'TEAM B ASSIGNMENTS - Canyon Storm');
    });

    it('getActiveEventAvatarDataUrl returns empty string when no event', () => {
        const deps = {
            getActiveEvent: () => null,
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns empty string when logoDataUrl is not a string', () => {
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: 123 }),
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns empty for empty logo', () => {
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: '   ' }),
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, '');
    });

    it('getActiveEventAvatarDataUrl returns data url when valid', () => {
        const dataUrl = 'data:image/png;base64,abc123';
        const deps = {
            getActiveEvent: () => ({ logoDataUrl: dataUrl }),
            isImageDataUrl: (val) => val === dataUrl,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = global.DSDownloadController.getActiveEventAvatarDataUrl(deps);
        assert.equal(result, dataUrl);
    });

    it('loadActiveEventAvatarForHeader returns null when no avatar', async () => {
        const deps = {
            getActiveEvent: () => null,
            isImageDataUrl: () => false,
            EVENT_LOGO_DATA_URL_LIMIT: 220000,
        };
        const result = await global.DSDownloadController.loadActiveEventAvatarForHeader(deps);
        assert.equal(result, null);
    });

    it('closeDownloadModal calls setActiveDownloadTeam with null', () => {
        let calledWith = undefined;
        const deps = {
            setActiveDownloadTeam: (v) => { calledWith = v; },
            closeModalOverlay: () => {},
        };
        global.DSDownloadController.closeDownloadModal(deps);
        assert.equal(calledWith, null);
    });

    it('downloadTeamExcel alerts when no assignments', async () => {
        let alertCalled = false;
        global.alert = () => { alertCalled = true; };
        const deps = {
            ensureXLSXLoaded: async () => {},
            t: (key) => key,
            showMessage: () => {},
            getAssignmentsA: () => [],
            getAssignmentsB: () => [],
        };
        await global.DSDownloadController.downloadTeamExcel('A', deps);
        assert.ok(alertCalled);
    });

    it('downloadTeamMap alerts when no assignments', async () => {
        let alertCalled = false;
        global.alert = () => { alertCalled = true; };
        const deps = {
            t: (key) => key,
            showMessage: () => {},
            getAssignmentsA: () => [],
            getAssignmentsB: () => [],
        };
        await global.DSDownloadController.downloadTeamMap('B', deps);
        assert.ok(alertCalled);
    });

    it('downloadTeamExcel appends substitutes with replaced starters column and downloads via Blob', async () => {
        let createdObjectUrl = null;
        let capturedAnchor = null;
        const originalCreateObjectURL = global.URL.createObjectURL;
        const originalRevokeObjectURL = global.URL.revokeObjectURL;
        global.URL.createObjectURL = () => {
            createdObjectUrl = 'blob:mock-xlsx-url';
            return createdObjectUrl;
        };
        global.URL.revokeObjectURL = () => {};
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') capturedAnchor = el;
            return el;
        };

        const deps = {
            ensureXLSXLoaded: async () => {},
            t: (key) => key,
            showMessage: () => {},
            getAssignmentsA: () => [
                { building: 'HQ', priority: 1, player: 'Alice' },
            ],
            getAssignmentsB: () => [],
            getSubstitutesA: () => [
                { name: 'ReserveOne', replacementStarterNames: ['Alice', 'Bob'] },
            ],
            getSubstitutesB: () => [],
            getActiveEvent: () => ({ excelPrefix: 'desert_storm' }),
        };

        try {
            await global.DSDownloadController.downloadTeamExcel('A', deps);

            assert.ok(Array.isArray(lastSheetData), 'Excel sheet data should be captured');
            assert.equal(lastSheetData.length, 2);
            assert.deepEqual(lastSheetData[0], {
                excel_header_building: 'HQ',
                excel_header_priority: 1,
                excel_header_player: 'Alice',
                excel_header_replaces: '',
            });
            assert.deepEqual(lastSheetData[1], {
                excel_header_building: 'excel_substitute_building',
                excel_header_priority: '',
                excel_header_player: 'ReserveOne',
                excel_header_replaces: 'Alice, Bob',
            });
            assert.equal(lastWriteOpts.bookType, 'xlsx');
            assert.equal(lastWriteOpts.type, 'array');
            assert.ok(capturedAnchor, 'anchor element should have been created for the fallback download');
            assert.equal(capturedAnchor.download, 'desert_storm_team_A_assignments.xlsx');
            assert.equal(capturedAnchor.href, createdObjectUrl);
        } finally {
            document.createElement = originalCreateElement;
            global.URL.createObjectURL = originalCreateObjectURL;
            global.URL.revokeObjectURL = originalRevokeObjectURL;
        }
    });

    it('fitCanvasHeaderText returns original text when maxWidth is non-finite', () => {
        const result = global.DSDownloadController.fitCanvasHeaderText({}, 'hello', NaN, 'bold 40px Arial');
        assert.equal(result, 'hello');
    });

    it('fitCanvasHeaderText returns original text when maxWidth is zero', () => {
        const result = global.DSDownloadController.fitCanvasHeaderText({}, 'hello', 0, 'bold 40px Arial');
        assert.equal(result, 'hello');
    });

    it('triggerCanvasPngDownload uses a Blob object URL instead of a data: URI (Android download fix)', async () => {
        const fakeBlob = { size: 123, type: 'image/png' };
        let toBlobType = null;
        let toBlobCallback = null;
        const fakeCanvas = {
            toBlob: (cb, type) => {
                toBlobCallback = cb;
                toBlobType = type;
            },
        };

        let createdObjectUrl = null;
        let revokedUrl = null;
        const originalCreateObjectURL = global.URL.createObjectURL;
        const originalRevokeObjectURL = global.URL.revokeObjectURL;
        global.URL.createObjectURL = (blob) => {
            assert.equal(blob, fakeBlob, 'createObjectURL should receive the blob produced by toBlob');
            createdObjectUrl = 'blob:mock-url-1';
            return createdObjectUrl;
        };
        global.URL.revokeObjectURL = (url) => { revokedUrl = url; };

        let capturedAnchor = null;
        let clicked = false;
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                capturedAnchor = el;
                const originalClick = el.click;
                el.click = function (...args) {
                    clicked = true;
                    return originalClick.apply(el, args);
                };
            }
            return el;
        };

        try {
            const promise = global.DSDownloadController.triggerCanvasPngDownload(fakeCanvas, 'team_A_test.png');

            assert.equal(toBlobType, 'image/png');
            assert.equal(typeof toBlobCallback, 'function', 'canvas.toBlob should be called synchronously');

            toBlobCallback(fakeBlob);
            await promise;

            assert.equal(createdObjectUrl, 'blob:mock-url-1');
            assert.ok(capturedAnchor, 'an anchor element should have been created');
            assert.equal(capturedAnchor.href, createdObjectUrl);
            assert.equal(capturedAnchor.download, 'team_A_test.png');
            assert.ok(clicked, 'anchor.click() should have been invoked');
            assert.equal(revokedUrl, createdObjectUrl, 'the object URL should be revoked after triggering the download');
        } finally {
            document.createElement = originalCreateElement;
            global.URL.createObjectURL = originalCreateObjectURL;
            global.URL.revokeObjectURL = originalRevokeObjectURL;
        }
    });

    it('triggerFileDownload uses navigator.share() with a File when the Web Share API supports files (iOS Safari fix)', async () => {
        const fakeBlob = { type: 'image/png' };
        const originalFile = global.File;
        global.File = class {
            constructor(parts, name, options) {
                this.parts = parts;
                this.name = name;
                this.type = options && options.type;
            }
        };
        let sharedWith = null;
        mockNavigator({
            share: (data) => {
                sharedWith = data;
                return Promise.resolve();
            },
            canShare: (data) => Array.isArray(data.files) && data.files.length === 1,
        });

        let anchorCreated = false;
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            if (tag === 'a') anchorCreated = true;
            return originalCreateElement(tag);
        };

        try {
            await global.DSDownloadController.triggerFileDownload(fakeBlob, 'team_A_test.png');

            assert.ok(sharedWith, 'navigator.share should have been called');
            assert.equal(sharedWith.files.length, 1);
            assert.equal(sharedWith.files[0].name, 'team_A_test.png');
            assert.ok(!anchorCreated, 'should not fall back to anchor download when share succeeds');
        } finally {
            document.createElement = originalCreateElement;
            restoreNavigator();
            global.File = originalFile;
        }
    });

    it('triggerFileDownload falls back to Blob+anchor download when the Web Share API is unavailable', async () => {
        const fakeBlob = { type: 'image/png' };
        mockNavigator({});

        let createdObjectUrl = null;
        let capturedAnchor = null;
        const originalCreateObjectURL = global.URL.createObjectURL;
        global.URL.createObjectURL = () => {
            createdObjectUrl = 'blob:mock-fallback-url';
            return createdObjectUrl;
        };
        global.URL.revokeObjectURL = () => {};
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') capturedAnchor = el;
            return el;
        };

        try {
            await global.DSDownloadController.triggerFileDownload(fakeBlob, 'team_A_test.png');

            assert.ok(capturedAnchor, 'anchor fallback should be used when navigator.share is unavailable');
            assert.equal(capturedAnchor.href, createdObjectUrl);
            assert.equal(capturedAnchor.download, 'team_A_test.png');
        } finally {
            document.createElement = originalCreateElement;
            global.URL.createObjectURL = originalCreateObjectURL;
            restoreNavigator();
        }
    });

    it('triggerFileDownload falls back to Blob+anchor download when navigator.share() rejects (e.g. lost user activation)', async () => {
        const fakeBlob = { type: 'image/png' };
        const originalFile = global.File;
        global.File = class {
            constructor(parts, name, options) {
                this.name = name;
                this.type = options && options.type;
            }
        };
        mockNavigator({
            share: () => Promise.reject(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' })),
            canShare: () => true,
        });

        let capturedAnchor = null;
        const originalCreateObjectURL = global.URL.createObjectURL;
        global.URL.createObjectURL = () => 'blob:mock-retry-url';
        global.URL.revokeObjectURL = () => {};
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') capturedAnchor = el;
            return el;
        };

        try {
            await global.DSDownloadController.triggerFileDownload(fakeBlob, 'team_A_test.png');

            assert.ok(capturedAnchor, 'anchor fallback should still fire when share() rejects with a non-abort error');
            assert.equal(capturedAnchor.download, 'team_A_test.png');
        } finally {
            document.createElement = originalCreateElement;
            global.URL.createObjectURL = originalCreateObjectURL;
            restoreNavigator();
            global.File = originalFile;
        }
    });

    it('triggerFileDownload does not fall back when the user cancels the native share sheet (AbortError)', async () => {
        const fakeBlob = { type: 'image/png' };
        const originalFile = global.File;
        global.File = class {
            constructor(parts, name, options) {
                this.name = name;
                this.type = options && options.type;
            }
        };
        mockNavigator({
            share: () => Promise.reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
            canShare: () => true,
        });

        let anchorCreated = false;
        const originalCreateElement = document.createElement;
        document.createElement = (tag) => {
            if (tag === 'a') anchorCreated = true;
            return originalCreateElement(tag);
        };

        try {
            await global.DSDownloadController.triggerFileDownload(fakeBlob, 'team_A_test.png');
            assert.ok(!anchorCreated, 'cancelling the share sheet should not trigger a second, silent download');
        } finally {
            document.createElement = originalCreateElement;
            restoreNavigator();
            global.File = originalFile;
        }
    });
});
