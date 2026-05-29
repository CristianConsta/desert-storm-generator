(function initFeaturePlayerUpdatesController(global) {
    var _gateway = null;
    var _unsubscribe = null;
    var _badgeUnsub = null;
    var _pendingUpdateDocs = {}; // { [updateId]: update_doc }
    var _autoApproveThresholds = {
        powerMaxDeltaPct: null,
        thpMaxDeltaPct: null,
        troopChangesAllowed: false,
    };

    // Initialize the feature.
    // gateway: FirebaseService (the unified flat gateway)
    // Returns: { destroy() }
    function init(gateway) {
        _gateway = gateway;
        return {
            destroy: destroy,
            subscribeBadge: subscribeBadge,
            setPendingUpdateDocs: setPendingUpdateDocs,
            saveReviewedProposedValues: saveReviewedProposedValues,
            approveUpdate: approveUpdate,
            rejectUpdate: rejectUpdate,
            revokeToken: revokeToken,
        };
    }

    function destroy() {
        if (_unsubscribe) {
            _unsubscribe();
            _unsubscribe = null;
        }
        if (_badgeUnsub) {
            _badgeUnsub();
            _badgeUnsub = null;
        }
        _gateway = null;
    }

    // Register pending update docs so approve/reject can look up metadata.
    // Called by refreshPlayerUpdatesPanel in app.js after loading docs.
    function setPendingUpdateDocs(updates) {
        _pendingUpdateDocs = {};
        if (Array.isArray(updates)) {
            updates.forEach(function(u) {
                if (u && u.id) {
                    _pendingUpdateDocs[u.id] = u;
                }
            });
        }
    }

    // Subscribe to pending updates count for the nav badge.
    // C2 fix: works for both alliance and non-alliance users
    function subscribeBadge(allianceId, uid) {
        if (_badgeUnsub) {
            _badgeUnsub();
            _badgeUnsub = null;
        }
        if (!_gateway || typeof _gateway.subscribePendingUpdatesCount !== 'function') return;
        if (!allianceId && !uid) return;
        _badgeUnsub = _gateway.subscribePendingUpdatesCount(allianceId, uid, function(count) {
            var renderBadge = global.DSFeaturePlayerUpdatesView && typeof global.DSFeaturePlayerUpdatesView.renderPendingBadge === 'function'
                ? global.DSFeaturePlayerUpdatesView.renderPendingBadge : null;
            if (renderBadge) {
                renderBadge(document.getElementById('playerUpdatesPendingBadge'), count);
                renderBadge(document.getElementById('sidebarUpdatesBadge'), count);
                renderBadge(document.getElementById('moreSheetUpdatesBadge'), count);
            }
        });
    }

    // Deprecated on purpose:
    // Invite generation is allowed only from Players Management invite button flow.
    function openTokenGenerationModal() {
        var message = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_invite_from_players_page_only')
            : 'Player update invites can only be generated from Players Management.';
        if (global.console && typeof global.console.warn === 'function') {
            global.console.warn('[PlayerUpdatesController] Blocked legacy invite generation path. Use Players Management invite button.');
        }
        if (typeof global.alert === 'function') {
            global.alert(message);
        }
        return { ok: false, error: 'invite_generation_restricted' };
    }

    // Show alliance target selection modal. Returns Promise<'personal'|'alliance'|'both'|null>.
    // R2 fix: includes Escape key handler
    function _showApplyTargetPrompt() {
        return new Promise(function(resolve) {
            var modal = document.getElementById('applyTargetModal');
            if (!modal) {
                resolve('both');
                return;
            }

            modal.classList.remove('hidden');
            modal.focus();

            function close(target) {
                modal.classList.add('hidden');
                cleanup();
                resolve(target);
            }

            function onPersonal() { close('personal'); }
            function onAlliance() { close('alliance'); }
            function onBoth() { close('both'); }
            function onCancel() { close(null); }
            function onKeydown(e) {
                if (e.key === 'Escape') { close(null); }
            }

            var personalBtn = document.getElementById('applyTargetPersonalBtn');
            var allianceBtn = document.getElementById('applyTargetAllianceBtn');
            var bothBtn = document.getElementById('applyTargetBothBtn');
            var cancelBtn = document.getElementById('applyTargetCancelBtn');

            if (personalBtn) personalBtn.addEventListener('click', onPersonal);
            if (allianceBtn) allianceBtn.addEventListener('click', onAlliance);
            if (bothBtn) bothBtn.addEventListener('click', onBoth);
            if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
            document.addEventListener('keydown', onKeydown);

            function cleanup() {
                if (personalBtn) personalBtn.removeEventListener('click', onPersonal);
                if (allianceBtn) allianceBtn.removeEventListener('click', onAlliance);
                if (bothBtn) bothBtn.removeEventListener('click', onBoth);
                if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKeydown);
            }
        });
    }

    function _normalizeNameForLookup(name) {
        return typeof name === 'string' ? name.trim().toLowerCase() : '';
    }

    function _findCanonicalName(playerMap, requestedName) {
        if (!playerMap || typeof playerMap !== 'object') {
            return '';
        }
        if (typeof requestedName !== 'string') {
            return '';
        }
        var raw = requestedName.trim();
        if (!raw) {
            return '';
        }
        if (Object.prototype.hasOwnProperty.call(playerMap, raw)) {
            return raw;
        }
        var wanted = _normalizeNameForLookup(raw);
        var keys = Object.keys(playerMap);
        for (var i = 0; i < keys.length; i += 1) {
            if (_normalizeNameForLookup(keys[i]) === wanted) {
                return keys[i];
            }
        }
        return '';
    }

    function _isPlayerNotFoundResult(result) {
        if (!result || result.ok) {
            return false;
        }
        return result.error === 'players_list_error_not_found';
    }

    function _isAllianceDataMissingResult(result) {
        if (!result || result.ok) {
            return false;
        }
        return result.error === 'players_list_error_no_alliance';
    }

    function _safeCallPromise(fn) {
        return Promise.resolve().then(fn).catch(function(err) {
            if (global.console && typeof global.console.error === 'function') {
                global.console.error('[PlayerUpdatesController] async call failed:', err);
            }
            return { ok: false, error: err && err.message };
        });
    }

    function _fallbackNormalizeProposedValues(values) {
        if (!values || typeof values !== 'object') {
            return null;
        }
        var normalized = {
            power: values.power,
            thp: values.thp,
            troops: values.troops,
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

    function _fallbackValidateProposedValues(values) {
        var errors = [];
        if (!values || typeof values !== 'object') {
            return { valid: false, errors: ['proposed values are required'] };
        }
        var power = Number(values.power);
        if (values.power === null || values.power === undefined || values.power === '' || !Number.isFinite(power)) {
            errors.push('power must be a number');
        } else if (power < 0 || power > 9999) {
            errors.push('power must be between 0 and 9999');
        }

        var thp = Number(values.thp);
        if (values.thp === null || values.thp === undefined || values.thp === '' || !Number.isFinite(thp)) {
            errors.push('thp must be a number');
        } else if (thp < 0 || thp > 99999) {
            errors.push('thp must be between 0 and 99999');
        }

        if (['Tank', 'Aero', 'Missile'].indexOf(values.troops) === -1) {
            errors.push('troops must be one of: Tank, Aero, Missile');
        }
        return { valid: errors.length === 0, errors: errors };
    }

    function _fallbackProposedValuesEqual(left, right) {
        var a = _fallbackNormalizeProposedValues(left);
        var b = _fallbackNormalizeProposedValues(right);
        if (!a || !b) {
            return false;
        }
        return a.power === b.power
            && a.thp === b.thp
            && a.troops === b.troops;
    }

    function _resolveReviewedProposedValues(update, reviewedValues) {
        var base = update && update.proposedValues ? update.proposedValues : {};
        if (!reviewedValues || typeof reviewedValues !== 'object') {
            return { ok: true, effective: base, reviewed: null };
        }

        var core = global.DSFeaturePlayerUpdatesCore || {};
        var normalize = typeof core.normalizeProposedValues === 'function'
            ? core.normalizeProposedValues
            : _fallbackNormalizeProposedValues;
        var validate = typeof core.validateProposedValues === 'function'
            ? core.validateProposedValues
            : _fallbackValidateProposedValues;
        var areEqual = typeof core.proposedValuesEqual === 'function'
            ? core.proposedValuesEqual
            : _fallbackProposedValuesEqual;

        var normalized = normalize(reviewedValues);
        var validation = validate(normalized);
        if (!validation.valid) {
            return {
                ok: false,
                error: 'player_updates_review_invalid_values',
                details: validation.errors || [],
            };
        }

        return {
            ok: true,
            effective: normalized,
            reviewed: areEqual(base, normalized) ? null : normalized,
        };
    }

    function _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, initialResult) {
        if (!_isPlayerNotFoundResult(initialResult)) {
            return Promise.resolve(initialResult);
        }

        var dbGetter = source === 'alliance'
            ? _gateway.getAlliancePlayerDatabase
            : _gateway.getPlayerDatabase;
        if (typeof dbGetter !== 'function') {
            return Promise.resolve(initialResult);
        }

        var context = gameId ? { gameId: gameId } : undefined;
        var playerMap = {};
        try {
            playerMap = dbGetter(context) || {};
        } catch (err) {
            playerMap = {};
        }
        var canonicalName = _findCanonicalName(playerMap, playerName);
        if (!canonicalName || canonicalName === playerName) {
            return Promise.resolve(initialResult);
        }

        var applyFn = source === 'alliance'
            ? _gateway.applyPlayerUpdateToAlliance
            : _gateway.applyPlayerUpdateToPersonal;
        return _safeCallPromise(function() {
            return applyFn(canonicalName, proposed, gameId, identifiers);
        });
    }

    function _applyWithNameFallback(source, playerName, proposed, gameId, identifiers) {
        if (!_gateway) {
            return Promise.resolve({ ok: false, error: 'not initialized' });
        }
        var applyFn = source === 'alliance'
            ? _gateway.applyPlayerUpdateToAlliance
            : _gateway.applyPlayerUpdateToPersonal;
        if (typeof applyFn !== 'function') {
            return Promise.resolve({ ok: false, error: 'apply_not_available' });
        }
        var context = gameId ? { gameId: gameId } : undefined;
        return _safeCallPromise(function() {
            return applyFn(playerName, proposed, gameId, identifiers);
        }).then(function(result) {
            if (source === 'alliance'
                && _isAllianceDataMissingResult(result)
                && typeof _gateway.loadAllianceData === 'function') {
                return _safeCallPromise(function() {
                    return _gateway.loadAllianceData(context);
                }).then(function(loadResult) {
                    var loadSucceeded = !loadResult || loadResult.success !== false;
                    if (!loadSucceeded) {
                        return result;
                    }
                    return _safeCallPromise(function() {
                        return applyFn(playerName, proposed, gameId, identifiers);
                    }).then(function(retryResult) {
                        return _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, retryResult);
                    });
                });
            }

            return _retryWithCanonicalName(source, playerName, proposed, gameId, identifiers, result);
        });
    }

    // Internal: apply proposed values to target database(s) and mark status.
    // "personal" target = approver's own player database (users/{approverUid}/...)
    // "alliance" target = shared alliance database (alliances/{allianceId}/...)
    function _doApprove(updateId, update, allianceId, target, reviewedValues) {
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;
        var proposedResolution = _resolveReviewedProposedValues(update, reviewedValues);
        if (!proposedResolution.ok) {
            return Promise.resolve({ ok: false, error: proposedResolution.error, details: proposedResolution.details });
        }
        var proposed = proposedResolution.effective || {};
        var playerName = update.playerName;
        var identifiers = {
            playerKey: update.playerKey || '',
            allianceId: update.allianceId || allianceId || '',
        };
        var contextType = update.contextType;

        var requestedPersonal = target === 'personal' || target === 'both';
        var requestedAlliance = target === 'alliance' || target === 'both';
        var applyResults = {
            personal: null,
            alliance: null,
        };

        if (requestedPersonal) {
            applyResults.personal = _applyWithNameFallback('personal', playerName, proposed, update.gameId || null, identifiers);
        }
        if (requestedAlliance) {
            if (allianceId) {
                applyResults.alliance = _applyWithNameFallback('alliance', playerName, proposed, update.gameId || null, identifiers);
            } else {
                applyResults.alliance = Promise.resolve({ ok: false, error: 'missing_alliance_id' });
            }
        }

        return Promise.all([
            applyResults.personal || Promise.resolve(null),
            applyResults.alliance || Promise.resolve(null),
        ]).then(function(results) {
            var personalResult = results[0];
            var allianceResult = results[1];

            var personalOk = !requestedPersonal || (personalResult && personalResult.ok);
            var allianceOk = !requestedAlliance || (allianceResult && allianceResult.ok);
            if (!personalOk || !allianceOk) {
                if (global.console && typeof global.console.error === 'function') {
                    global.console.error('[PlayerUpdatesController] approve apply failed', {
                        updateId: updateId,
                        contextType: contextType,
                        allianceId: allianceId,
                        gameId: update && update.gameId ? update.gameId : null,
                        playerName: playerName,
                        playerKey: identifiers.playerKey || '',
                        requestedPersonal: requestedPersonal,
                        requestedAlliance: requestedAlliance,
                        personalResult: personalResult,
                        allianceResult: allianceResult,
                    });
                }
                return {
                    ok: false,
                    error: (allianceResult && allianceResult.error)
                        || (personalResult && personalResult.error)
                        || 'apply_failed',
                };
            }

            var effectiveAppliedTo = target;
            var appliedPersonal = requestedPersonal && personalOk;
            var appliedAlliance = requestedAlliance && allianceOk;
            if (appliedPersonal && appliedAlliance) {
                effectiveAppliedTo = 'both';
            } else if (appliedAlliance) {
                effectiveAppliedTo = 'alliance';
            }

            var decision = {
                status: 'approved',
                reviewedBy: reviewedBy,
                reviewedAt: new Date(),
                appliedTo: effectiveAppliedTo,
            };
            if (proposedResolution.reviewed) {
                decision.reviewedProposedValues = proposedResolution.reviewed;
            }

            if (contextType === 'personal') {
                var ownerUid = update.ownerUid;
                return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision, update.gameId || null)
                    .then(function(statusResult) {
                        if (!statusResult || statusResult.ok === false) {
                            if (global.console && typeof global.console.error === 'function') {
                                global.console.error('[PlayerUpdatesController] approve status update failed (personal)', {
                                    updateId: updateId,
                                    ownerUid: ownerUid,
                                    gameId: update && update.gameId ? update.gameId : null,
                                    result: statusResult,
                                });
                            }
                        }
                        return statusResult;
                    })
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            } else {
                return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision, update.gameId || null)
                    .then(function(statusResult) {
                        if (!statusResult || statusResult.ok === false) {
                            if (global.console && typeof global.console.error === 'function') {
                                global.console.error('[PlayerUpdatesController] approve status update failed (alliance)', {
                                    updateId: updateId,
                                    allianceId: allianceId,
                                    gameId: update && update.gameId ? update.gameId : null,
                                    result: statusResult,
                                });
                            }
                        }
                        return statusResult;
                    })
                    .catch(function(err) { return { ok: false, error: err && err.message }; });
            }
        });
    }

    // Approve a pending update — applies proposed values to the source database.
    // Source is defined by invite context:
    // - personal invite => personal player DB
    // - alliance invite => alliance player DB
    function approveUpdate(updateId, reviewedValues) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        if (!update) return Promise.resolve({ ok: false, error: 'update not found' });

        var allianceId = _gateway.getAllianceId
            ? _gateway.getAllianceId(update && update.gameId ? { gameId: update.gameId } : undefined)
            : null;
        if (!allianceId && update && update.contextType === 'alliance') {
            allianceId = update.allianceId || null;
        }
        var target = (update.contextType === 'alliance') ? 'alliance' : 'personal';
        return _doApprove(updateId, update, allianceId, target, reviewedValues);
    }

    function saveReviewedProposedValues(updateId, reviewedValues) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        if (!update) return Promise.resolve({ ok: false, error: 'update not found' });

        var proposedResolution = _resolveReviewedProposedValues(update, reviewedValues);
        if (!proposedResolution.ok) {
            return Promise.resolve({ ok: false, error: proposedResolution.error, details: proposedResolution.details });
        }

        var allianceId = _gateway.getAllianceId
            ? _gateway.getAllianceId(update && update.gameId ? { gameId: update.gameId } : undefined)
            : null;
        if (!allianceId && update && update.contextType === 'alliance') {
            allianceId = update.allianceId || null;
        }

        var decision = {
            reviewedProposedValues: proposedResolution.effective,
        };
        var persistPromise = update.contextType === 'personal'
            ? _gateway.updatePersonalPendingUpdateStatus(update.ownerUid, updateId, decision, update.gameId || null)
            : _gateway.updatePendingUpdateStatus(allianceId, updateId, decision, update.gameId || null);

        return Promise.resolve(persistPromise)
            .then(function(result) {
                if (result && (result.ok === false || result.success === false)) {
                    return result;
                }
                update.reviewedProposedValues = proposedResolution.effective;
                return Object.assign({}, result || {}, {
                    ok: true,
                    reviewedProposedValues: proposedResolution.effective,
                });
            })
            .catch(function(err) {
                return { ok: false, error: err && err.message };
            });
    }

    // Reject a pending update — only updates status, no data changes.
    function rejectUpdate(updateId, reviewedValues) {
        if (!_gateway || !updateId) return Promise.resolve({ ok: false, error: 'not initialized' });

        var update = _pendingUpdateDocs[updateId];
        var proposedResolution = _resolveReviewedProposedValues(update, reviewedValues);
        if (update && !proposedResolution.ok) {
            return Promise.resolve({ ok: false, error: proposedResolution.error, details: proposedResolution.details });
        }
        var allianceId = _gateway.getAllianceId
            ? _gateway.getAllianceId(update && update.gameId ? { gameId: update.gameId } : undefined)
            : null;
        if (!allianceId && update && update.contextType === 'alliance') {
            allianceId = update.allianceId || null;
        }
        var currentUser = _gateway.getCurrentUser ? _gateway.getCurrentUser() : null;
        var reviewedBy = currentUser ? currentUser.uid : null;

        var decision = {
            status: 'rejected',
            reviewedBy: reviewedBy,
            reviewedAt: new Date(),
        };
        if (proposedResolution.reviewed) {
            decision.reviewedProposedValues = proposedResolution.reviewed;
        }

        if (update && update.contextType === 'personal') {
            var ownerUid = update.ownerUid;
            return _gateway.updatePersonalPendingUpdateStatus(ownerUid, updateId, decision, update.gameId || null)
                .catch(function(err) { return { ok: false, error: err && err.message }; });
        } else {
            return _gateway.updatePendingUpdateStatus(allianceId, updateId, decision, update && update.gameId ? update.gameId : null)
                .catch(function(err) { return { ok: false, error: err && err.message }; });
        }
    }

    // Revoke a token (marks it used/invalid so it cannot be submitted).
    // tokenId: string
    // Returns: Promise<{ ok, error? }>
    function revokeToken(tokenId) {
        if (!_gateway || !tokenId) return Promise.resolve({ ok: false, error: 'not initialized' });
        var allianceId = _gateway.getAllianceId ? _gateway.getAllianceId() : null;
        return _gateway.revokeToken(allianceId, tokenId).catch(function (err) {
            return { ok: false, error: err && err.message };
        });
    }

    // Configure auto-approve thresholds (stored in alliance settings).
    // thresholds: { powerMaxDeltaPct, thpMaxDeltaPct, troopChangesAllowed }
    function setAutoApproveThresholds(thresholds) {
        _autoApproveThresholds = Object.assign({}, _autoApproveThresholds, thresholds || {});
    }

    global.DSFeaturePlayerUpdatesController = {
        init: init,
        subscribeBadge: subscribeBadge,
        openTokenGenerationModal: openTokenGenerationModal,
        saveReviewedProposedValues: saveReviewedProposedValues,
        approveUpdate: approveUpdate,
        rejectUpdate: rejectUpdate,
        revokeToken: revokeToken,
        setAutoApproveThresholds: setAutoApproveThresholds,
        setPendingUpdateDocs: setPendingUpdateDocs,
    };
})(window);
