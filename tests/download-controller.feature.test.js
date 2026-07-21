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
global.FirebaseService = { getActivePlayerDatabase: () => ({}) };
let lastSheetData = null;
let lastWriteFileArgs = null;
global.XLSX = {
    utils: {
        book_new: () => ({}),
        json_to_sheet: (data) => {
            lastSheetData = data;
            return {};
        },
        book_append_sheet: () => {},
    },
    writeFile: (workbook, fileName) => {
        lastWriteFileArgs = { workbook, fileName };
    },
};

// Load the module
require('../js/features/generator/download-controller.js');

describe('DSDownloadController', () => {
    beforeEach(() => {
        lastSheetData = null;
        lastWriteFileArgs = null;
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

    it('downloadTeamExcel appends substitutes with replaced starters column', async () => {
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
        assert.equal(lastWriteFileArgs.fileName, 'desert_storm_team_A_assignments.xlsx');
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
});
