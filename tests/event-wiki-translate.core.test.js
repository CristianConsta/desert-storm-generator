const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const eventWikiPath = path.resolve(__dirname, '../js/event-wiki/event-wiki.js');

function reset(modulePath) {
    delete require.cache[require.resolve(modulePath)];
}

function loadEventWiki() {
    global.window = global;
    if (!global.location) {
        global.location = { search: '', href: '' };
    }
    if (!global.localStorage) {
        global.localStorage = { getItem: function() { return null; }, setItem: function() {} };
    }
    if (!global.document) {
        global.document = {
            readyState: 'complete',
            getElementById: function() { return null; },
            addEventListener: function() {},
            createElement: function(tag) {
                var el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    textContent: '',
                    innerHTML: '',
                    outerHTML: '',
                    childNodes: [],
                    children: [],
                    nodeType: 1,
                    dataset: {},
                    parentNode: null,
                    style: {},
                    classList: {
                        add: function() {},
                        remove: function() {},
                        toggle: function() {},
                    },
                    addEventListener: function() {},
                    appendChild: function(child) {
                        el.children.push(child);
                        child.parentNode = el;
                        return child;
                    },
                    replaceChild: function(newChild, oldChild) {
                        var idx = el.children.indexOf(oldChild);
                        if (idx >= 0) el.children[idx] = newChild;
                        newChild.parentNode = el;
                    },
                    querySelectorAll: function() { return []; },
                    setAttribute: function() {},
                };
                // Mock innerHTML setter to parse basic HTML for testing
                var _innerHTML = '';
                Object.defineProperty(el, 'innerHTML', {
                    get: function() { return _innerHTML; },
                    set: function(val) { _innerHTML = val; },
                });
                return el;
            },
        };
    }
    delete global.DSEventWiki;
    reset(eventWikiPath);
    require(eventWikiPath);
    return global.DSEventWiki;
}

// ── simpleHash ──────────────────────────────────────────────────────────

test('simpleHash returns deterministic string hash', () => {
    const wiki = loadEventWiki();
    const hash1 = wiki._simpleHash('hello world');
    const hash2 = wiki._simpleHash('hello world');
    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, 'string');
});

test('simpleHash returns different hashes for different inputs', () => {
    const wiki = loadEventWiki();
    const hash1 = wiki._simpleHash('hello');
    const hash2 = wiki._simpleHash('world');
    assert.notEqual(hash1, hash2);
});

test('simpleHash handles empty string', () => {
    const wiki = loadEventWiki();
    const hash = wiki._simpleHash('');
    assert.equal(hash, '0');
});

// ── restoreMediaInHtml ──────────────────────────────────────────────────

test('restoreMediaInHtml replaces placeholders with media elements', () => {
    const wiki = loadEventWiki();
    var html = '<p>Text before {{MEDIA_0}} and after {{MEDIA_1}}</p>';
    var media = ['<img src="data:image/png;base64,abc">', '<iframe src="https://youtube.com"></iframe>'];
    var result = wiki._restoreMediaInHtml(html, media);
    assert.ok(result.includes('<img src="data:image/png;base64,abc">'));
    assert.ok(result.includes('<iframe src="https://youtube.com"></iframe>'));
    assert.ok(!result.includes('{{MEDIA_'));
});

test('restoreMediaInHtml preserves placeholders when media list is short', () => {
    const wiki = loadEventWiki();
    var html = '<p>{{MEDIA_0}} and {{MEDIA_5}}</p>';
    var media = ['<img src="test.jpg">'];
    var result = wiki._restoreMediaInHtml(html, media);
    assert.ok(result.includes('<img src="test.jpg">'));
    assert.ok(result.includes('{{MEDIA_5}}'));
});

test('restoreMediaInHtml handles no placeholders', () => {
    const wiki = loadEventWiki();
    var html = '<p>No media here</p>';
    var result = wiki._restoreMediaInHtml(html, []);
    assert.equal(result, '<p>No media here</p>');
});

test('resolveDeepLApiBase falls back to the default worker URL', () => {
    const wiki = loadEventWiki();
    assert.equal(wiki._resolveDeepLApiBase(), 'https://deepl-proxy.constantinescu-cristian.workers.dev');
});

test('resolveDeepLApiBase respects a configured proxy override', () => {
    global.DEEPL_PROXY_URL = 'https://example.workers.dev/translate';
    const wiki = loadEventWiki();
    assert.equal(wiki._resolveDeepLApiBase(), 'https://example.workers.dev/translate');
    delete global.DEEPL_PROXY_URL;
});
