(function initHintsController(global) {
    'use strict';

    var VIEWED_HINTS_KEY = 'ds_viewed_hints';
    var SESSION_SHOWN_KEY = 'ds_hints_shown_this_session';

    var HINTS = [
        {
            id: 'mass-invite',
            messageKey: 'hint_mass_invite_title',
            descriptionKey: 'hint_mass_invite_description',
        },
        {
            id: 'team-colors',
            messageKey: 'hint_team_colors_title',
            descriptionKey: 'hint_team_colors_description',
        },
        {
            id: 'building-assign',
            messageKey: 'hint_building_assign_title',
            descriptionKey: 'hint_building_assign_description',
        },
    ];

    /**
     * Returns the first hint whose id is not in viewedHintIds, or null if all viewed.
     * @param {Array<{id: string, messageKey: string, descriptionKey: string}>} hints
     * @param {string[]} viewedHintIds
     * @returns {{id: string, messageKey: string, descriptionKey: string}|null}
     */
    function selectNextHint(hints, viewedHintIds) {
        for (var i = 0; i < hints.length; i++) {
            if (viewedHintIds.indexOf(hints[i].id) === -1) {
                return hints[i];
            }
        }
        return null;
    }

    /**
     * Reads the list of viewed hint IDs from localStorage.
     * @returns {string[]}
     */
    function getViewedHints() {
        try {
            var raw = global.localStorage.getItem(VIEWED_HINTS_KEY);
            if (!raw) {
                return [];
            }
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_e) {
            return [];
        }
    }

    /**
     * Appends hintId to the viewed hints list in localStorage.
     * @param {string} hintId
     */
    function markHintAsViewed(hintId) {
        try {
            var viewed = getViewedHints();
            if (viewed.indexOf(hintId) === -1) {
                viewed.push(hintId);
            }
            global.localStorage.setItem(VIEWED_HINTS_KEY, JSON.stringify(viewed));
        } catch (_e) {
            // localStorage unavailable — silently skip
        }
    }

    /**
     * Returns true when hints should be shown: onboarding complete and not yet
     * shown in the current browser session.
     * @param {boolean} onboardingComplete
     * @returns {boolean}
     */
    function shouldShowHints(onboardingComplete) {
        if (!onboardingComplete) {
            return false;
        }
        try {
            return global.sessionStorage.getItem(SESSION_SHOWN_KEY) !== 'true';
        } catch (_e) {
            return false;
        }
    }

    /**
     * Records that the hints modal has already been shown this session so it
     * does not appear again on subsequent navigations during the same visit.
     */
    function markHintsShownThisSession() {
        try {
            global.sessionStorage.setItem(SESSION_SHOWN_KEY, 'true');
        } catch (_e) {
            // sessionStorage unavailable — silently skip
        }
    }

    /**
     * Wires the hints controller to the modal and i18n engine. Call once during
     * app startup after Firebase auth resolves.
     * @param {object} modalController - DSShellModalController
     * @param {object} i18nEngine      - DSI18N
     */
    function init(modalController, i18nEngine) {
        global.DSHintsController._modalController = modalController;
        global.DSHintsController._i18nEngine = i18nEngine;
    }

    global.DSHintsController = {
        HINTS: HINTS,
        selectNextHint: selectNextHint,
        getViewedHints: getViewedHints,
        markHintAsViewed: markHintAsViewed,
        shouldShowHints: shouldShowHints,
        markHintsShownThisSession: markHintsShownThisSession,
        init: init,
    };
})(window);
