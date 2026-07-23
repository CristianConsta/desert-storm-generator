(function initFeaturePlayerUpdatesCore(global) {
    var VALID_TROOPS = ['Tank', 'Aero', 'Missile'];

    function validateProposedValues(proposed) {
        var errors = [];

        if (!proposed || typeof proposed !== 'object') {
            return { valid: false, errors: ['proposed values are required'] };
        }

        var power = Number(proposed.power);
        if (proposed.power === null || proposed.power === undefined || proposed.power === '' || !Number.isFinite(power)) {
            errors.push('power must be a number');
        } else if (power < 0 || power > 9999) {
            errors.push('power must be between 0 and 9999');
        }

        var thp = Number(proposed.thp);
        if (proposed.thp === null || proposed.thp === undefined || proposed.thp === '' || !Number.isFinite(thp)) {
            errors.push('thp must be a number');
        } else if (thp < 0 || thp > 99999) {
            errors.push('thp must be between 0 and 99999');
        }

        if (VALID_TROOPS.indexOf(proposed.troops) === -1) {
            errors.push('troops must be one of: ' + VALID_TROOPS.join(', '));
        }

        return { valid: errors.length === 0, errors: errors };
    }

    function normalizeProposedValues(proposed) {
        if (!proposed || typeof proposed !== 'object') {
            return null;
        }
        var normalized = {
            power: proposed.power,
            thp: proposed.thp,
            troops: proposed.troops,
        };

        if (normalized.power !== null && normalized.power !== undefined && normalized.power !== '') {
            normalized.power = Number(normalized.power);
        }
        if (normalized.thp !== null && normalized.thp !== undefined && normalized.thp !== '') {
            normalized.thp = Number(normalized.thp);
        }
        if (typeof normalized.troops === 'string') {
            normalized.troops = normalized.troops.trim();
        }

        return normalized;
    }

    function proposedValuesEqual(left, right) {
        var a = normalizeProposedValues(left);
        var b = normalizeProposedValues(right);
        if (!a || !b) {
            return false;
        }
        return a.power === b.power
            && a.thp === b.thp
            && a.troops === b.troops;
    }

    function calculateDeltas(old, proposed) {
        var rawOldPower = (old && old.power != null) ? Number(old.power) : null;
        var oldPower = (rawOldPower !== null && Number.isFinite(rawOldPower)) ? rawOldPower : null;
        var rawNewPower = (proposed && proposed.power != null) ? Number(proposed.power) : null;
        var newPower = (rawNewPower !== null && Number.isFinite(rawNewPower)) ? rawNewPower : null;
        var powerDelta = (oldPower !== null && newPower !== null) ? newPower - oldPower : null;
        var powerFlagged;
        if (oldPower === null || oldPower === 0) {
            powerFlagged = true;
        } else {
            powerFlagged = Math.abs(powerDelta / oldPower) > 0.20;
        }

        var rawOldThp = (old && old.thp != null) ? Number(old.thp) : null;
        var oldThp = (rawOldThp !== null && Number.isFinite(rawOldThp)) ? rawOldThp : null;
        var rawNewThp = (proposed && proposed.thp != null) ? Number(proposed.thp) : null;
        var newThp = (rawNewThp !== null && Number.isFinite(rawNewThp)) ? rawNewThp : null;
        var thpDelta = (oldThp !== null && newThp !== null) ? newThp - oldThp : null;
        var thpFlagged;
        if (oldThp === null || oldThp === 0) {
            thpFlagged = true;
        } else {
            thpFlagged = Math.abs(thpDelta / oldThp) > 0.20;
        }

        var oldTroops = old && old.troops;
        var newTroops = proposed && proposed.troops;
        var troopsChanged = oldTroops !== newTroops;

        return {
            power: {
                old: oldPower,
                new: newPower,
                delta: powerDelta,
                flagged: powerFlagged,
            },
            thp: {
                old: oldThp,
                new: newThp,
                delta: thpDelta,
                flagged: thpFlagged,
            },
            troops: {
                changed: troopsChanged,
                old: oldTroops,
                new: newTroops,
            },
        };
    }

    global.DSFeaturePlayerUpdatesCore = {
        validateProposedValues: validateProposedValues,
        normalizeProposedValues: normalizeProposedValues,
        proposedValuesEqual: proposedValuesEqual,
        calculateDeltas: calculateDeltas,
    };
})(window);
