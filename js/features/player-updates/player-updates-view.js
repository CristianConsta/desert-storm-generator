(function initFeaturePlayerUpdatesView(global) {
    var FRESHNESS_THRESHOLD_DAYS = 30;
    var REVIEW_STATUS_ID = 'playerUpdatesReviewStatus';

    function _resolveResultErrorMessage(result) {
        var fallback = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_apply_failed')
            : 'Failed to apply update. Please try again.';
        if (!result || !result.error) {
            return fallback;
        }
        if (global.DSI18N && typeof global.DSI18N.t === 'function') {
            var translated = global.DSI18N.t(result.error);
            if (translated && translated !== result.error) {
                return translated;
            }
        }
        return fallback;
    }

    function _showReviewStatus(message, type) {
        var container = document.getElementById('playerUpdatesReviewContainer');
        if (!container) {
            return;
        }
        var status = document.getElementById(REVIEW_STATUS_ID);
        if (!status) {
            status = document.createElement('div');
            status.id = REVIEW_STATUS_ID;
            status.className = 'message';
            status.setAttribute('role', 'status');
            status.setAttribute('aria-live', 'polite');
            if (container.firstChild) {
                container.insertBefore(status, container.firstChild);
            } else {
                container.appendChild(status);
            }
        }
        status.className = 'message ' + (type || 'error');
        status.textContent = String(message || '');
    }

    function _t(key, fallback) {
        if (!(global.DSI18N && typeof global.DSI18N.t === 'function')) {
            return fallback;
        }
        var translated = global.DSI18N.t(key);
        return translated && translated !== key ? translated : fallback;
    }

    function _clearChildren(el) {
        if (!el) {
            return;
        }
        if (typeof el.replaceChildren === 'function') {
            el.replaceChildren();
            return;
        }
        if (typeof el.textContent === 'string') {
            el.textContent = '';
        }
        if (Array.isArray(el.children)) {
            el.children.length = 0;
        }
        if ('innerHTML' in el) {
            el.innerHTML = '';
        }
    }

    function _cloneProposedValues(values) {
        if (!values || typeof values !== 'object') {
            return { power: '', thp: '', troops: '' };
        }
        return {
            power: values.power,
            thp: values.thp,
            troops: values.troops,
        };
    }

    // Render pending updates review panel.
    // container: HTMLElement, updates: Array<pending_update docs with deltas>
    function renderReviewPanel(container, updates) {
        if (!container) return;
        container.innerHTML = '';
        var status = document.createElement('div');
        status.id = REVIEW_STATUS_ID;
        status.className = 'hidden';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        container.appendChild(status);

        var refreshBtn = document.createElement('button');
        refreshBtn.className = 'btn btn-secondary btn-sm';
        refreshBtn.setAttribute('data-i18n', 'player_updates_refresh');
        refreshBtn.textContent = _t('player_updates_refresh', 'Refresh');
        refreshBtn.addEventListener('click', function() {
            if (typeof global.refreshPlayerUpdatesPanel === 'function') {
                global.refreshPlayerUpdatesPanel();
            }
        });
        container.appendChild(refreshBtn);

        if (!updates || updates.length === 0) {
            var empty = document.createElement('p');
            empty.setAttribute('data-i18n', 'player_updates_no_pending');
            empty.textContent = 'No pending updates.';
            container.appendChild(empty);
            return;
        }

        updates.forEach(function(update) {
            var row = renderComparisonRow(update);
            if (row) {
                container.appendChild(row);
            }
        });
    }

    // Render side-by-side comparison row for one pending update.
    // update: pending_update doc with deltas pre-calculated by DSFeaturePlayerUpdatesCore.calculateDeltas
    // Returns: HTMLElement
    function renderComparisonRow(update) {
        if (!update) return null;

        var row = document.createElement('div');
        row.className = 'review-comparison-row';
        row.setAttribute('data-update-id', update.id || '');
        var draftProposed = _cloneProposedValues(update.reviewedProposedValues || update.proposedValues || {});
        var editingField = null;
        var savingField = null;

        var header = document.createElement('div');
        header.className = 'review-player-header';

        var nameEl = document.createElement('span');
        nameEl.className = 'review-player-name';
        nameEl.textContent = update.playerName || '';
        header.appendChild(nameEl);

        var sourceBadge = document.createElement('span');
        sourceBadge.className = 'review-source-badge review-source-badge--' + (update.contextType || 'unknown');
        sourceBadge.textContent = update.contextType === 'personal'
            ? _t('player_updates_source_personal', 'Personal')
            : _t('player_updates_source_alliance', 'Alliance');
        header.appendChild(sourceBadge);

        row.appendChild(header);

        var table = document.createElement('table');
        table.className = 'review-comparison-table';

        var thead = document.createElement('thead');
        var headRow = document.createElement('tr');
        [
            _t('player_updates_col_field', 'Field'),
            _t('player_updates_col_current', 'Current'),
            _t('player_updates_col_proposed', 'Proposed'),
            _t('player_updates_col_change', 'Change'),
        ].forEach(function(label) {
            var th = document.createElement('th');
            th.textContent = label;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        var tbody = document.createElement('tbody');
        table.appendChild(tbody);
        row.appendChild(table);

        var inlineError = document.createElement('div');
        inlineError.className = 'review-inline-error hidden';

        function clearInlineError() {
            inlineError.textContent = '';
            inlineError.classList.add('hidden');
        }

        function showInlineError(message) {
            inlineError.textContent = String(message || '');
            inlineError.classList.remove('hidden');
        }

        function fmtVal(v) {
            return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
                ? String(Number(v))
                : '\u2014';
        }

        function fmtDelta(v) {
            if (v === null || !Number.isFinite(v)) return '\u2014';
            return (v > 0 ? '+' : '') + String(v);
        }

        function buildEditIconButton(titleKey, fallbackTitle) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'review-inline-icon-btn';
            btn.setAttribute('title', _t(titleKey, fallbackTitle));
            btn.setAttribute('aria-label', _t(titleKey, fallbackTitle));
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5 13.5 4.5 6 12H4v-2z"></path><path d="M10.5 3.5 12.5 5.5"></path></svg>';
            return btn;
        }

        function buildMiniActionButton(kind, titleKey, fallbackTitle, svgPath) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'review-inline-icon-btn review-inline-icon-btn--' + kind;
            btn.setAttribute('title', _t(titleKey, fallbackTitle));
            btn.setAttribute('aria-label', _t(titleKey, fallbackTitle));
            btn.innerHTML = svgPath;
            return btn;
        }

        function renderProposedCell(field, proposedValue) {
            var td = document.createElement('td');
            var wrapper = document.createElement('div');
            wrapper.className = 'review-proposed-cell';
            td.appendChild(wrapper);

            if (editingField === field) {
                var editor = document.createElement(field === 'troops' ? 'select' : 'input');
                editor.className = 'review-inline-editor';
                if (field === 'troops') {
                    ['Tank', 'Aero', 'Missile'].forEach(function(optionValue) {
                        var option = document.createElement('option');
                        option.value = optionValue;
                        option.textContent = optionValue;
                        if (String(draftProposed[field] || '') === optionValue) {
                            option.selected = true;
                        }
                        editor.appendChild(option);
                    });
                    editor.value = draftProposed[field] || 'Tank';
                } else {
                    editor.type = 'number';
                    editor.min = '0';
                    editor.max = field === 'power' ? '9999' : '99999';
                    editor.step = '0.01';
                    editor.value = draftProposed[field] != null ? String(draftProposed[field]) : '';
                }
                wrapper.appendChild(editor);

                var actionWrap = document.createElement('div');
                actionWrap.className = 'review-inline-actions';
                var saveBtn = buildMiniActionButton(
                    'save',
                    'player_updates_edit_save',
                    'Save edited value',
                    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,8 6.5,11.5 13,4.5"></polyline></svg>'
                );
                var cancelBtn = buildMiniActionButton(
                    'cancel',
                    'player_updates_edit_cancel',
                    'Cancel edit',
                    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"></line><line x1="12" y1="4" x2="4" y2="12"></line></svg>'
                );
                actionWrap.appendChild(saveBtn);
                actionWrap.appendChild(cancelBtn);
                wrapper.appendChild(actionWrap);
                if (savingField === field) {
                    editor.disabled = true;
                    saveBtn.disabled = true;
                    cancelBtn.disabled = true;
                }

                function commitEdit() {
                    if (savingField !== null) {
                        return;
                    }
                    var nextDraft = _cloneProposedValues(draftProposed);
                    var rawValue = field === 'troops' ? editor.value : editor.value;
                    nextDraft[field] = rawValue;
                    if (global.DSFeaturePlayerUpdatesCore
                        && typeof global.DSFeaturePlayerUpdatesCore.normalizeProposedValues === 'function') {
                        nextDraft = global.DSFeaturePlayerUpdatesCore.normalizeProposedValues(nextDraft);
                    }
                    var validation = global.DSFeaturePlayerUpdatesCore
                        && typeof global.DSFeaturePlayerUpdatesCore.validateProposedValues === 'function'
                        ? global.DSFeaturePlayerUpdatesCore.validateProposedValues(nextDraft)
                        : { valid: true, errors: [] };
                    if (!validation.valid) {
                        showInlineError(_t('player_updates_review_invalid_values', 'Enter a valid power, THP, and troop type before reviewing.'));
                        return;
                    }
                    var controller = global.DSFeaturePlayerUpdatesController;
                    if (!controller || typeof controller.saveReviewedProposedValues !== 'function') {
                        draftProposed = nextDraft;
                        update.reviewedProposedValues = _cloneProposedValues(nextDraft);
                        editingField = null;
                        clearInlineError();
                        renderBody();
                        return;
                    }

                    savingField = field;
                    editor.disabled = true;
                    saveBtn.disabled = true;
                    cancelBtn.disabled = true;
                    clearInlineError();
                    renderBody();

                    controller.saveReviewedProposedValues(update.id, nextDraft).then(function(result) {
                        if (result && result.ok) {
                            draftProposed = _cloneProposedValues(
                                result.reviewedProposedValues || nextDraft
                            );
                            update.reviewedProposedValues = _cloneProposedValues(draftProposed);
                            editingField = null;
                            savingField = null;
                            clearInlineError();
                            renderBody();
                            return;
                        }

                        savingField = null;
                        editor.disabled = false;
                        saveBtn.disabled = false;
                        cancelBtn.disabled = false;
                        showInlineError(_resolveResultErrorMessage(result));
                        renderBody();
                    });
                }

                saveBtn.addEventListener('click', commitEdit);
                cancelBtn.addEventListener('click', function() {
                    if (savingField !== null) {
                        return;
                    }
                    editingField = null;
                    clearInlineError();
                    renderBody();
                });
                editor.addEventListener('keydown', function(event) {
                    if (savingField !== null) {
                        return;
                    }
                    if (event && event.key === 'Enter') {
                        commitEdit();
                    } else if (event && event.key === 'Escape') {
                        editingField = null;
                        clearInlineError();
                        renderBody();
                    }
                });
                if (typeof editor.focus === 'function') {
                    editor.focus();
                }
                return td;
            }

            var valueEl = document.createElement('span');
            valueEl.className = 'review-proposed-value';
            valueEl.textContent = field === 'troops'
                ? String(proposedValue || '\u2014')
                : fmtVal(proposedValue);
            wrapper.appendChild(valueEl);

            var editBtn = buildEditIconButton('player_updates_edit_value', 'Edit proposed value');
            editBtn.disabled = savingField !== null || editingField !== null;
            editBtn.addEventListener('click', function() {
                if (savingField !== null) {
                    return;
                }
                editingField = field;
                clearInlineError();
                renderBody();
            });
            wrapper.appendChild(editBtn);
            return td;
        }

        function buildNumericRow(field, label, delta) {
            var tr = document.createElement('tr');
            if (delta.flagged) { tr.className = 'flagged'; }
            var labelTd = document.createElement('td');
            labelTd.textContent = label;
            tr.appendChild(labelTd);
            var currentTd = document.createElement('td');
            currentTd.textContent = fmtVal(delta.old);
            tr.appendChild(currentTd);
            tr.appendChild(renderProposedCell(field, delta.new));
            var changeTd = document.createElement('td');
            changeTd.textContent = fmtDelta(delta.delta);
            tr.appendChild(changeTd);
            return tr;
        }

        function buildTroopsRow(delta) {
            var tr = document.createElement('tr');
            if (delta.changed) { tr.className = 'flagged'; }
            var labelTd = document.createElement('td');
            labelTd.textContent = _t('player_update_troops_label', 'Troop Type');
            tr.appendChild(labelTd);
            var currentTd = document.createElement('td');
            currentTd.textContent = String(delta.old || '\u2014');
            tr.appendChild(currentTd);
            tr.appendChild(renderProposedCell('troops', delta.new));
            var changeTd = document.createElement('td');
            changeTd.textContent = delta.changed
                ? _t('player_updates_changed', 'Changed')
                : _t('player_updates_unchanged', 'Unchanged');
            tr.appendChild(changeTd);
            return tr;
        }

        function renderBody() {
            _clearChildren(tbody);
            var deltas = null;
            if (
                global.DSFeaturePlayerUpdatesCore
                && typeof global.DSFeaturePlayerUpdatesCore.calculateDeltas === 'function'
            ) {
                deltas = global.DSFeaturePlayerUpdatesCore.calculateDeltas(
                    update.currentSnapshot || {},
                    draftProposed || {}
                );
            }
            if (!deltas) {
                return;
            }
            if (deltas.power) {
                tbody.appendChild(buildNumericRow('power', _t('player_update_power_label', '1st Team Power (M)'), deltas.power));
            }
            if (deltas.thp) {
                tbody.appendChild(buildNumericRow('thp', _t('player_update_thp_label', 'THP'), deltas.thp));
            }
            if (deltas.troops) {
                tbody.appendChild(buildTroopsRow(deltas.troops));
            }
            if (approveBtn) {
                approveBtn.disabled = editingField !== null || savingField !== null;
            }
            if (rejectBtn) {
                rejectBtn.disabled = editingField !== null || savingField !== null;
            }
        }

        renderBody();

        // Decision buttons (Approve / Reject)
        var decisionGroup = document.createElement('div');
        decisionGroup.className = 'review-decision-group';

        var approveBtn = document.createElement('button');
        approveBtn.type = 'button';
        approveBtn.className = 'primary review-approve-btn';
        approveBtn.setAttribute('data-update-id', update.id || '');
        approveBtn.setAttribute('data-i18n', 'player_updates_approve_btn');
        approveBtn.textContent = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_approve_btn') : 'Approve';

        var rejectBtn = document.createElement('button');
        rejectBtn.type = 'button';
        rejectBtn.className = 'secondary review-reject-btn';
        rejectBtn.setAttribute('data-update-id', update.id || '');
        rejectBtn.setAttribute('data-i18n', 'player_updates_reject_btn');
        rejectBtn.textContent = (global.DSI18N && global.DSI18N.t)
            ? global.DSI18N.t('player_updates_reject_btn') : 'Reject';

        approveBtn.addEventListener('click', function() {
            var updateId = approveBtn.getAttribute('data-update-id');
            if (global.DSFeaturePlayerUpdatesController
                && typeof global.DSFeaturePlayerUpdatesController.approveUpdate === 'function') {
                approveBtn.disabled = true;
                rejectBtn.disabled = true;
                global.DSFeaturePlayerUpdatesController.approveUpdate(updateId, draftProposed).then(function(result) {
                    if (result && result.cancelled) {
                        approveBtn.disabled = false;
                        rejectBtn.disabled = false;
                        return;
                    }
                    if (result && result.ok) {
                        if (typeof global.refreshPlayerUpdatesPanel === 'function') {
                            global.refreshPlayerUpdatesPanel();
                        } else {
                            row.classList.add('review-decision-applied');
                            row.setAttribute('aria-disabled', 'true');
                        }
                    } else {
                        _showReviewStatus(_resolveResultErrorMessage(result), 'error');
                        approveBtn.disabled = false;
                        rejectBtn.disabled = false;
                    }
                });
            }
        });

        rejectBtn.addEventListener('click', function() {
            var updateId = rejectBtn.getAttribute('data-update-id');
            if (global.DSFeaturePlayerUpdatesController
                && typeof global.DSFeaturePlayerUpdatesController.rejectUpdate === 'function') {
                rejectBtn.disabled = true;
                approveBtn.disabled = true;
                global.DSFeaturePlayerUpdatesController.rejectUpdate(updateId, draftProposed).then(function(result) {
                    if (result && result.ok) {
                        if (typeof global.refreshPlayerUpdatesPanel === 'function') {
                            global.refreshPlayerUpdatesPanel();
                        } else {
                            row.classList.add('review-decision-applied');
                            row.setAttribute('aria-disabled', 'true');
                        }
                    } else {
                        _showReviewStatus(_resolveResultErrorMessage(result), 'error');
                        rejectBtn.disabled = false;
                        approveBtn.disabled = false;
                    }
                });
            }
        });

        decisionGroup.appendChild(approveBtn);
        decisionGroup.appendChild(rejectBtn);
        row.appendChild(decisionGroup);
        row.appendChild(inlineError);
        renderBody();
        return row;
    }

    // Render pending updates badge on nav.
    // container: HTMLElement, count: number
    function renderPendingBadge(container, count) {
        if (!container) return;
        container.textContent = count || '0';
        if (count && count > 0) {
            container.classList.remove('hidden');
        } else {
            container.classList.add('hidden');
        }
    }

    // Render data freshness dot for a player.
    // lastUpdated: Date | null, now: Date
    // Returns: HTMLElement with aria-label
    function renderFreshnessDot(lastUpdated, now) {
        var dot = document.createElement('span');
        dot.className = 'freshness-dot';

        if (!lastUpdated) {
            dot.classList.add('freshness-never');
            dot.setAttribute('aria-label', 'Never updated via self-update');
            dot.setAttribute('title', 'Never updated via self-update');
            return dot;
        }

        var lastMs = lastUpdated instanceof Date
            ? lastUpdated.getTime()
            : (lastUpdated && typeof lastUpdated.toDate === 'function'
                ? lastUpdated.toDate().getTime()
                : Number(lastUpdated));
        var nowMs = now instanceof Date ? now.getTime() : Number(now);
        var diffDays = (nowMs - lastMs) / (24 * 60 * 60 * 1000);

        if (diffDays <= FRESHNESS_THRESHOLD_DAYS) {
            dot.classList.add('freshness-fresh');
            dot.setAttribute('aria-label', 'Updated within last ' + FRESHNESS_THRESHOLD_DAYS + ' days');
            dot.setAttribute('title', 'Updated within last ' + FRESHNESS_THRESHOLD_DAYS + ' days');
        } else {
            dot.classList.add('freshness-stale');
            dot.setAttribute('aria-label', 'Data stale — last updated ' + Math.floor(diffDays) + ' days ago');
            dot.setAttribute('title', 'Data stale — last updated ' + Math.floor(diffDays) + ' days ago');
        }

        return dot;
    }

    global.DSFeaturePlayerUpdatesView = {
        renderReviewPanel: renderReviewPanel,
        renderComparisonRow: renderComparisonRow,
        renderPendingBadge: renderPendingBadge,
        renderFreshnessDot: renderFreshnessDot,
    };
})(window);
