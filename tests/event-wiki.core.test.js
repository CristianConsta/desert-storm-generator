const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const infraPath = path.resolve(__dirname, '../firebase-infra.js');
const eventListUiPath = path.resolve(__dirname, '../js/ui/event-list-ui.js');

function reset(modulePath) {
    delete require.cache[require.resolve(modulePath)];
}

function loadInfra() {
    global.window = global;
    delete global.DSFirebaseInfra;
    reset(infraPath);
    require(infraPath);
    return global.DSFirebaseInfra;
}

function loadEventListUi() {
    global.window = global;
    // Minimal document mock for event-list-ui
    if (!global.document) {
        global.document = {
            getElementById: function() { return null; },
            createElement: function(tag) {
                var el = {
                    tagName: tag.toUpperCase(),
                    type: '',
                    className: '',
                    textContent: '',
                    href: '',
                    target: '',
                    rel: '',
                    title: '',
                    alt: '',
                    src: '',
                    children: [],
                    classList: {
                        add: function() {},
                        remove: function() {},
                    },
                    addEventListener: function() {},
                    appendChild: function(child) { el.children.push(child); return child; },
                    setAttribute: function() {},
                };
                return el;
            },
        };
    }
    delete global.DSEventListUI;
    reset(eventListUiPath);
    require(eventListUiPath);
    return global.DSEventListUI;
}

// ── firebase-infra.js: wiki path builders ────────────────────────────────

test('DSFirebaseInfra exports wiki path builder functions', () => {
    const infra = loadInfra();
    assert.equal(typeof infra.getSoloEventWikiCollectionRef, 'function');
    assert.equal(typeof infra.getSoloEventWikiDocRef, 'function');
    assert.equal(typeof infra.getAllianceEventWikiCollectionRef, 'function');
    assert.equal(typeof infra.getAllianceEventWikiDocRef, 'function');
});

test('wiki path builders return null when db is not set', () => {
    const infra = loadInfra();
    // db is null by default
    assert.equal(infra.getSoloEventWikiCollectionRef('last_war', 'uid1'), null);
    assert.equal(infra.getSoloEventWikiDocRef('last_war', 'uid1', 'desert_storm'), null);
    assert.equal(infra.getAllianceEventWikiCollectionRef('last_war', 'alliance1'), null);
    assert.equal(infra.getAllianceEventWikiDocRef('last_war', 'alliance1', 'desert_storm'), null);
});

test('wiki path builders return null for empty params', () => {
    const infra = loadInfra();
    assert.equal(infra.getSoloEventWikiDocRef('last_war', 'uid1', ''), null);
    assert.equal(infra.getSoloEventWikiDocRef('last_war', 'uid1', '   '), null);
    assert.equal(infra.getAllianceEventWikiDocRef('last_war', 'alliance1', ''), null);
});

// ── event-list-ui.js: wiki link rendering ────────────────────────────────

test('DSEventListUI renderEventsList creates wiki links when getWikiUrl is provided', () => {
    const ui = loadEventListUi();
    var appendedChildren = [];
    var listEl = {
        innerHTML: '',
        appendChild: function(child) { appendedChildren.push(child); },
    };

    ui.renderEventsList({
        listElement: listEl,
        eventIds: ['desert_storm'],
        getEventById: function(id) {
            return { id: id, name: 'Desert Storm', buildings: [] };
        },
        currentEventId: 'desert_storm',
        generateAvatarDataUrl: function() { return ''; },
        getWikiUrl: function(eventId) {
            return 'event-wiki.html?game=last_war&event=' + eventId + '&uid=test';
        },
        onSelectEvent: function() {},
        onStartNewEvent: function() {},
    });

    // Should have 2 children: the event button + new event button
    assert.equal(appendedChildren.length, 2);
    // First child (event button) should have 3 children: avatar, textWrap, wikiLink
    var eventBtn = appendedChildren[0];
    assert.equal(eventBtn.children.length, 3);
    var wikiLink = eventBtn.children[2];
    assert.equal(wikiLink.tagName, 'A');
    assert.equal(wikiLink.className, 'events-list-wiki-link');
    assert.ok(wikiLink.href.includes('event-wiki.html'));
    assert.equal(wikiLink.target, '_blank');
});

test('DSEventListUI renderEventsList omits wiki links when getWikiUrl is not provided', () => {
    const ui = loadEventListUi();
    var appendedChildren = [];
    var listEl = {
        innerHTML: '',
        appendChild: function(child) { appendedChildren.push(child); },
    };

    ui.renderEventsList({
        listElement: listEl,
        eventIds: ['desert_storm'],
        getEventById: function(id) {
            return { id: id, name: 'Desert Storm', buildings: [] };
        },
        currentEventId: 'desert_storm',
        generateAvatarDataUrl: function() { return ''; },
        onSelectEvent: function() {},
        onStartNewEvent: function() {},
    });

    var eventBtn = appendedChildren[0];
    // Without getWikiUrl, should have only 2 children: avatar + textWrap
    assert.equal(eventBtn.children.length, 2);
});

test('DSEventListUI renderEventsList omits wiki link when getWikiUrl returns empty', () => {
    const ui = loadEventListUi();
    var appendedChildren = [];
    var listEl = {
        innerHTML: '',
        appendChild: function(child) { appendedChildren.push(child); },
    };

    ui.renderEventsList({
        listElement: listEl,
        eventIds: ['desert_storm'],
        getEventById: function(id) {
            return { id: id, name: 'Desert Storm', buildings: [] };
        },
        currentEventId: 'desert_storm',
        generateAvatarDataUrl: function() { return ''; },
        getWikiUrl: function() { return ''; },
        onSelectEvent: function() {},
        onStartNewEvent: function() {},
    });

    var eventBtn = appendedChildren[0];
    assert.equal(eventBtn.children.length, 2);
});
