(function initDownloadController(global) {
    'use strict';

    function getTeamSubstitutes(team, deps) {
        if (team === 'A') {
            return deps && typeof deps.getSubstitutesA === 'function' ? deps.getSubstitutesA() : [];
        }
        return deps && typeof deps.getSubstitutesB === 'function' ? deps.getSubstitutesB() : [];
    }

    // ============================================================
    // DOWNLOAD MODAL
    // ============================================================

    function openDownloadModal(team, deps) {
        var isA = team === 'A';
        deps.setActiveDownloadTeam(team);

        var modalCard = document.querySelector('#downloadModalOverlay .download-modal-card');
        if (modalCard) {
            modalCard.classList.toggle('download-modal-card--team-a', isA);
            modalCard.classList.toggle('download-modal-card--team-b', !isA);
        }
        document.getElementById('downloadModalTitle').textContent = deps.t('download_modal_title', { team: team });
        document.getElementById('downloadModalSubtitle').textContent = deps.t('download_modal_subtitle', { team: team });
        document.getElementById('downloadMapBtn').onclick = function () { downloadTeamMap(team, deps); };
        document.getElementById('downloadExcelBtn').onclick = function () { downloadTeamExcel(team, deps); };
        var eventHistorySaveBtn = document.getElementById('eventHistorySaveBtn');
        if (eventHistorySaveBtn && global._eventHistoryController && typeof global._eventHistoryController.saveAssignmentAsHistory === 'function') {
            eventHistorySaveBtn.classList.remove('hidden');
            eventHistorySaveBtn.onclick = function () {
                var assignments = isA ? deps.getAssignmentsA() : deps.getAssignmentsB();
                var gameplayContext = deps.getGameplayContext();
                var currentAssignment = {
                    eventTypeId: deps.getCurrentEvent() || '',
                    eventName: deps.getCurrentEvent() || '',
                    gameId: (gameplayContext && gameplayContext.gameId) || '',
                    scheduledAt: new Date(),
                    teamA: isA ? assignments : [],
                    teamB: !isA ? assignments : [],
                };
                global._eventHistoryController.saveAssignmentAsHistory(currentAssignment)
                    .then(function (result) {
                        if (result && result.ok) {
                            deps.showMessage('downloadStatus', deps.t('event_history_save_btn'), 'success');
                        }
                    })
                    .catch(function () {});
            };
        } else if (eventHistorySaveBtn) {
            eventHistorySaveBtn.classList.add('hidden');
        }
        document.getElementById('downloadStatus').innerHTML = '';
        var overlay = document.getElementById('downloadModalOverlay');
        if (overlay) {
            deps.openModalOverlay(overlay, { initialFocusSelector: '#downloadModalCloseBtn' });
        }
    }

    function closeDownloadModal(deps) {
        deps.setActiveDownloadTeam(null);
        var overlay = document.getElementById('downloadModalOverlay');
        if (overlay) {
            deps.closeModalOverlay(overlay);
        }
    }

    // ============================================================
    // DOWNLOAD FUNCTIONS
    // ============================================================

    async function downloadTeamExcel(team, deps) {
        try {
            await deps.ensureXLSXLoaded();
        } catch (error) {
            console.error(error);
            deps.showMessage('downloadStatus', deps.t('error_xlsx_missing'), 'error');
            return;
        }

        var wb = XLSX.utils.book_new();
        var assignments = team === 'A' ? deps.getAssignmentsA() : deps.getAssignmentsB();
        var substitutes = getTeamSubstitutes(team, deps);

        if (assignments.length === 0) {
            alert(deps.t('alert_no_assignments', { team: team }));
            return;
        }

        var buildingHeader = deps.t('excel_header_building');
        var priorityHeader = deps.t('excel_header_priority');
        var playerHeader = deps.t('excel_header_player');
        var replacesHeader = deps.t('excel_header_replaces');
        var data = assignments.map(function (a) {
            var row = {};
            row[buildingHeader] = a.building;
            row[priorityHeader] = a.priority;
            row[playerHeader] = a.player;
            row[replacesHeader] = '';
            return row;
        });

        substitutes.forEach(function (substitute) {
            var row = {};
            row[buildingHeader] = deps.t('excel_substitute_building');
            row[priorityHeader] = '';
            row[playerHeader] = substitute && substitute.name ? substitute.name : '';
            row[replacesHeader] = formatSubstituteReplacementSummary(substitute);
            data.push(row);
        });

        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), deps.t('excel_sheet_name', { team: team }));
        var workbookBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var workbookBlob = new Blob([workbookBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await triggerFileDownload(workbookBlob, deps.getActiveEvent().excelPrefix + '_team_' + team + '_assignments.xlsx');

        deps.showMessage('downloadStatus', deps.t('message_excel_downloaded'), 'success');
    }

    async function downloadTeamMap(team, deps) {
        var assignments = team === 'A' ? deps.getAssignmentsA() : deps.getAssignmentsB();

        if (assignments.length === 0) {
            alert(deps.t('alert_no_assignments', { team: team }));
            return;
        }

        var statusId = 'downloadStatus';
        var currentEvent = deps.getCurrentEvent();
        var uploadedMapSource = deps.getEventMapFile(currentEvent, deps.MAP_EXPORT);
        if (!uploadedMapSource) {
            await generateMapWithoutBackground(team, assignments, statusId, deps);
            return;
        }

        var exportMapState = deps.getMapRuntimeState(currentEvent, deps.MAP_EXPORT);
        if (!exportMapState || !exportMapState.loaded) {
            deps.showMessage(statusId, deps.t('message_map_wait'), 'processing');
            try {
                await Promise.race([
                    deps.loadMapImage(currentEvent, deps.MAP_EXPORT),
                    new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 10000); }),
                ]);
            } catch (error) {
                await generateMapWithoutBackground(team, assignments, statusId, deps);
                return;
            }
        }

        await generateMap(team, assignments, statusId, deps);
    }

    function canShareFile(file) {
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
            return false;
        }
        try {
            return navigator.canShare({ files: [file] });
        } catch (error) {
            return false;
        }
    }

    function downloadBlobViaAnchor(blob, filename) {
        console.log('[download] using Blob+anchor for', filename);
        var objectUrl = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
        console.log('[download] anchor.click() fired for', filename);
    }

    // iOS Safari can silently drop `<a download>` saves for content produced after any
    // async work (network fetch, image load, etc.) runs between the tap and the click —
    // the click still "succeeds" in JS but no file is written. navigator.share() hands the
    // save off to the native share sheet instead, which iOS handles reliably in that case.
    function triggerFileDownload(blob, filename) {
        var file = (typeof File === 'function') ? new File([blob], filename, { type: blob.type }) : null;
        var shareSupported = !!(file && canShareFile(file));
        console.log('[download] triggerFileDownload for', filename, '— Web Share API available:', shareSupported);

        if (shareSupported) {
            return navigator.share({ files: [file] }).then(function () {
                console.log('[download] navigator.share() resolved (share sheet completed) for', filename);
            }).catch(function (error) {
                if (error && error.name === 'AbortError') {
                    console.log('[download] navigator.share() cancelled by user for', filename);
                    return;
                }
                console.warn('[download] navigator.share() failed, falling back to anchor download:', error);
                downloadBlobViaAnchor(blob, filename);
            });
        }

        downloadBlobViaAnchor(blob, filename);
        return Promise.resolve();
    }

    function triggerCanvasPngDownload(canvas, filename) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) {
                    reject(new Error('Canvas toBlob produced no data'));
                    return;
                }
                resolve(triggerFileDownload(blob, filename));
            }, 'image/png');
        });
    }

    function getMapHeaderTitle(team, deps) {
        var normalizedTeam = team === 'B' ? 'B' : 'A';
        var eventName = deps.getEventDisplayName(deps.getCurrentEvent());
        return 'TEAM ' + normalizedTeam + ' ASSIGNMENTS - ' + eventName;
    }

    function getActiveEventAvatarDataUrl(deps) {
        var activeEvent = deps.getActiveEvent();
        if (!activeEvent || typeof activeEvent.logoDataUrl !== 'string') {
            return '';
        }
        var logoDataUrl = activeEvent.logoDataUrl.trim();
        if (!logoDataUrl) {
            return '';
        }
        return deps.isImageDataUrl(logoDataUrl, deps.EVENT_LOGO_DATA_URL_LIMIT) ? logoDataUrl : '';
    }

    async function loadActiveEventAvatarForHeader(deps) {
        var avatarDataUrl = getActiveEventAvatarDataUrl(deps);
        if (!avatarDataUrl) {
            return null;
        }

        return new Promise(function (resolve) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { resolve(null); };
            img.src = avatarDataUrl;
        });
    }

    function fitCanvasHeaderText(ctx, text, maxWidth, font) {
        var value = String(text || '');
        var width = Number(maxWidth);
        if (!Number.isFinite(width) || width <= 0) {
            return value;
        }

        ctx.save();
        ctx.font = font;
        if (ctx.measureText(value).width <= width) {
            ctx.restore();
            return value;
        }

        var output = value;
        while (output.length > 1 && ctx.measureText(output + '...').width > width) {
            output = output.slice(0, -1);
        }
        ctx.restore();
        return output + '...';
    }

    function getSubstituteReplacementNames(substitute) {
        if (!substitute || typeof substitute !== 'object') {
            return [];
        }

        if (Array.isArray(substitute.replacementStarterNames)) {
            return substitute.replacementStarterNames.filter(Boolean);
        }

        if (Array.isArray(substitute.replacementStarters)) {
            return substitute.replacementStarters
                .map(function (starter) {
                    return starter && starter.name ? starter.name : '';
                })
                .filter(Boolean);
        }

        return [];
    }

    function formatSubstituteReplacementSummary(substitute) {
        return getSubstituteReplacementNames(substitute).join(', ');
    }

    function drawGeneratedMapHeader(ctx, options) {
        var cfg = options && typeof options === 'object' ? options : {};
        var totalWidth = Number(cfg.totalWidth) || DEFAULT_MAP_CANVAS_WIDTH;
        var titleHeight = Number(cfg.titleHeight) || 100;
        var teamPrimary = cfg.teamPrimary || '#4169E1';
        var teamSecondary = cfg.teamSecondary || '#1E90FF';
        var titleText = String(cfg.titleText || '');
        var avatarImage = cfg.avatarImage || null;

        var grad = ctx.createLinearGradient(0, 0, totalWidth, titleHeight);
        grad.addColorStop(0, teamPrimary);
        grad.addColorStop(1, teamSecondary);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, totalWidth, titleHeight);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, titleHeight - 1);
        ctx.lineTo(totalWidth, titleHeight - 1);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        var paddingX = 24;
        var textStartX = paddingX;

        if (avatarImage && avatarImage.width > 0 && avatarImage.height > 0) {
            var avatarSize = Math.max(36, Math.min(64, titleHeight - 24));
            var avatarX = paddingX;
            var avatarY = Math.floor((titleHeight - avatarSize) / 2);
            var avatarCenterX = avatarX + (avatarSize / 2);
            var avatarCenterY = avatarY + (avatarSize / 2);
            var avatarRadius = avatarSize / 2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCenterX, avatarCenterY, avatarRadius + 1, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.92)';
            ctx.lineWidth = 2.2;
            ctx.stroke();
            ctx.restore();

            textStartX = avatarX + avatarSize + 16;
        }

        var textMaxWidth = Math.max(120, totalWidth - textStartX - paddingX);
        var fittedTitle = fitCanvasHeaderText(ctx, titleText, textMaxWidth, 'bold 40px Arial');

        ctx.save();
        ctx.font = 'bold 40px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fittedTitle, textStartX, titleHeight / 2);
        ctx.restore();
    }

    var DEFAULT_MAP_CANVAS_WIDTH = 1080;

    async function generateMapWithoutBackground(team, assignments, statusId, deps) {
        var MAP_CANVAS_WIDTH = deps.MAP_CANVAS_WIDTH;
        var substitutes = getTeamSubstitutes(team, deps);
        deps.showMessage(statusId, deps.t('message_generating_map_no_bg', { team: team }), 'processing');

        try {
            var headerAvatar = await loadActiveEventAvatarForHeader(deps);
            var headerTitle = getMapHeaderTitle(team, deps);
            var mappedAssignments = {};
            var unmappedAssignments = {};
            var effectivePositions = deps.getEffectiveBuildingPositions();

            assignments.forEach(function (a) {
                if (!a.player) return;
                var buildingKey = a.buildingKey || a.building;
                var showOnMap = deps.isBuildingShownOnMap(buildingKey);
                var hasCoordinates = Array.isArray(effectivePositions[buildingKey]);
                if (showOnMap && hasCoordinates) {
                    if (!mappedAssignments[buildingKey]) mappedAssignments[buildingKey] = [];
                    mappedAssignments[buildingKey].push(a);
                    return;
                }
                if (!unmappedAssignments[buildingKey]) unmappedAssignments[buildingKey] = [];
                unmappedAssignments[buildingKey].push(a);
            });

            var orderedBuildingKeys = deps.getBuildingConfig().map(function (building) { return building.name; });
            var orderedUnmappedKeys = orderedBuildingKeys
                .filter(function (key) { return Array.isArray(unmappedAssignments[key]) && unmappedAssignments[key].length > 0; })
                .concat(Object.keys(unmappedAssignments).filter(function (key) { return !orderedBuildingKeys.includes(key); }));
            var unmappedGroups = orderedUnmappedKeys
                .map(function (key) {
                    var players = Array.isArray(unmappedAssignments[key])
                        ? unmappedAssignments[key].filter(function (entry) { return entry && entry.player; })
                        : [];
                    if (players.length === 0) {
                        return null;
                    }
                    return {
                        key: key,
                        label: deps.getBuildingDisplayName(key),
                        players: players,
                    };
                })
                .filter(Boolean);

            var canvas = document.createElement('canvas');
            canvas.width = MAP_CANVAS_WIDTH;
            canvas.height = Math.max(800, 190 + (assignments.length * 30) + (substitutes.length > 0 ? 50 + (substitutes.length * 26) : 0));
            var ctx = canvas.getContext('2d');

            ctx.fillStyle = team === 'A' ? '#E8F4FF' : '#FFE8E8';
            ctx.fillRect(0, 0, MAP_CANVAS_WIDTH, 800);

            var _tc = global.DSThemeColors ? global.DSThemeColors.teamConfig(team) : {};
            drawGeneratedMapHeader(ctx, {
                totalWidth: MAP_CANVAS_WIDTH,
                titleHeight: 100,
                teamPrimary: _tc.primary || (team === 'A' ? '#4169E1' : '#DC143C'),
                teamSecondary: _tc.light || (team === 'A' ? '#1E90FF' : '#FF6347'),
                titleText: headerTitle,
                avatarImage: headerAvatar,
            });

            ctx.fillStyle = '#333';
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            var y = 150;

            assignments.forEach(function (a, i) {
                if (a.player) {
                    ctx.fillText((i + 1) + '. ' + a.player + ' \u2192 ' + a.building, 50, y);
                    y += 30;
                }
            });

            if (substitutes.length > 0) {
                y += 20;
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = '#1F2937';
                ctx.fillText(deps.t('map_substitutes_title'), 50, y);
                y += 28;
                ctx.font = '14px Arial';
                ctx.fillStyle = '#374151';
                substitutes.forEach(function (substitute, index) {
                    var replacementSummary = formatSubstituteReplacementSummary(substitute);
                    var suffix = replacementSummary ? ' \u2192 ' + replacementSummary : '';
                    ctx.fillText('R' + String(index + 1) + '. ' + substitute.name + suffix, 50, y);
                    y += 26;
                });
            }

            await triggerCanvasPngDownload(canvas, 'team_' + team + '_' + deps.getActiveEvent().excelPrefix + '_nomap.png');

            deps.showMessage(statusId, deps.t('message_team_downloaded_list', { team: team }), 'success');
        } catch (error) {
            console.error(error);
            deps.showMessage(statusId, deps.t('error_generic', { error: error.message }), 'error');
        }
    }

    async function generateMap(team, assignments, statusId, deps) {
        var MAP_CANVAS_WIDTH = deps.MAP_CANVAS_WIDTH;
        deps.showMessage(statusId, deps.t('message_generating_map', { team: team }), 'processing');

        try {
            var headerAvatar = await loadActiveEventAvatarForHeader(deps);
            var headerTitle = getMapHeaderTitle(team, deps);
            var _teamColors = global.DSThemeColors ? global.DSThemeColors.teamConfig(team) : {};
            var teamPrimary = _teamColors.primary || (team === 'A' ? '#4169E1' : '#DC143C');
            var teamSecondary = _teamColors.light || (team === 'A' ? '#1E90FF' : '#FF6347');
            var _teamRgb = _teamColors.rgb || (team === 'A' ? '65,105,225' : '220,20,60');
            var teamSoft = 'rgba(' + _teamRgb + ', 0.25)';
            var gameplayContext = deps.getGameplayContext();
            var FS = deps.FirebaseService || (typeof window !== 'undefined' && window.FirebaseService);
            var activePlayerDB = (FS && FS.getActivePlayerDatabase && gameplayContext)
                ? FS.getActivePlayerDatabase(gameplayContext)
                : {};

            var mappedAssignments = {};
            var unmappedAssignments = {};
            var effectivePositions = deps.getEffectiveBuildingPositions();
            var currentEvent = deps.getCurrentEvent();

            assignments.forEach(function (a) {
                if (!a.player) return;
                var buildingKey = a.buildingKey || a.building;
                var showOnMap = deps.isBuildingShownOnMap(buildingKey);
                var hasCoordinates = Array.isArray(effectivePositions[buildingKey]);
                if (showOnMap && hasCoordinates) {
                    if (!mappedAssignments[buildingKey]) mappedAssignments[buildingKey] = [];
                    mappedAssignments[buildingKey].push(a);
                    return;
                }
                if (!unmappedAssignments[buildingKey]) unmappedAssignments[buildingKey] = [];
                unmappedAssignments[buildingKey].push(a);
            });

            var orderedBuildingKeys = deps.getBuildingConfig().map(function (building) { return building.name; });
            var orderedUnmappedKeys = orderedBuildingKeys
                .filter(function (key) { return Array.isArray(unmappedAssignments[key]) && unmappedAssignments[key].length > 0; })
                .concat(Object.keys(unmappedAssignments).filter(function (key) { return !orderedBuildingKeys.includes(key); }));
            var unmappedGroups = orderedUnmappedKeys
                .map(function (key) {
                    var players = Array.isArray(unmappedAssignments[key])
                        ? unmappedAssignments[key].filter(function (entry) { return entry && entry.player; })
                        : [];
                    if (players.length === 0) {
                        return null;
                    }
                    return {
                        key: key,
                        label: deps.getBuildingDisplayName(key),
                        players: players,
                    };
                })
                .filter(Boolean);
            var unmappedPlayers = unmappedGroups.flatMap(function (group) { return group.players; });

            var substitutes = getTeamSubstitutes(team, deps);

            var titleHeight = 100;
            var unmappedHeight = 280;
            var exportMapState = deps.getMapRuntimeState(currentEvent, deps.MAP_EXPORT);
            var activeMapImage = exportMapState ? exportMapState.image : null;
            if (!activeMapImage || activeMapImage.width <= 0) {
                throw new Error('Map image not loaded for export');
            }
            var mapHeight = Math.max(1, Math.floor(activeMapImage.height * (MAP_CANVAS_WIDTH / activeMapImage.width)));
            var totalHeight = titleHeight + mapHeight + unmappedHeight;

            var subsPanelWidth = substitutes.length > 0 ? 360 : 0;
            var totalWidth = MAP_CANVAS_WIDTH + subsPanelWidth;

            var canvas = document.createElement('canvas');
            canvas.width = totalWidth;
            canvas.height = totalHeight;
            var ctx = canvas.getContext('2d');

            function drawCrosshairIcon(cx, cy, size, color) {
                var radius = Math.max(8, Math.floor(size / 2));
                ctx.save();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - radius - 6, cy);
                ctx.lineTo(cx + radius + 6, cy);
                ctx.moveTo(cx, cy - radius - 6);
                ctx.lineTo(cx, cy + radius + 6);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.restore();
            }

            function drawShieldIcon(x, y, width, height, color) {
                ctx.save();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(x + width / 2, y);
                ctx.lineTo(x + width, y + height * 0.25);
                ctx.lineTo(x + width * 0.88, y + height * 0.78);
                ctx.lineTo(x + width / 2, y + height);
                ctx.lineTo(x + width * 0.12, y + height * 0.78);
                ctx.lineTo(x, y + height * 0.25);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                ctx.restore();
            }

            function fitText(text, maxWidth, font) {
                ctx.save();
                ctx.font = font;
                if (ctx.measureText(text).width <= maxWidth) {
                    ctx.restore();
                    return text;
                }
                var output = text;
                while (output.length > 1 && ctx.measureText(output + '...').width > maxWidth) {
                    output = output.slice(0, -1);
                }
                ctx.restore();
                return output + '...';
            }

            function getStarterCardStartX(anchorX, cardWidth) {
                return anchorX;
            }

            function getTroopKind(troops) {
                var val = String(troops || '').trim().toLowerCase();
                if (val.startsWith('tank')) return 'tank';
                if (val.startsWith('aero') || val.startsWith('air')) return 'aero';
                if (val.startsWith('missile')) return 'missile';
                return 'unknown';
            }

            function drawTankIcon(cx, cy, color) {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.roundRect(cx - 6.5, cy - 2.8, 12, 5.6, 1.8);
                ctx.fill();
                ctx.beginPath();
                ctx.roundRect(cx - 1.8, cy - 5.4, 4.6, 2.8, 1);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(cx + 2.6, cy - 4);
                ctx.lineTo(cx + 7.5, cy - 4);
                ctx.stroke();
                ctx.restore();
            }

            function drawJetIcon(cx, cy, color) {
                ctx.save();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(cx - 7, cy + 1.2);
                ctx.lineTo(cx + 5.8, cy - 2.8);
                ctx.lineTo(cx + 2, cy + 0.3);
                ctx.lineTo(cx + 5.8, cy + 3.2);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(cx - 1.6, cy - 1.1);
                ctx.lineTo(cx - 3.8, cy - 4.6);
                ctx.lineTo(cx - 0.8, cy - 3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            function drawMissileLauncherIcon(cx, cy, color) {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.roundRect(cx - 6, cy + 0.8, 8.8, 4.2, 1.3);
                ctx.fill();
                ctx.beginPath();
                ctx.roundRect(cx - 5.2, cy - 3.8, 8.8, 2.5, 1);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(cx + 3.8, cy - 3.4);
                ctx.lineTo(cx + 7, cy - 5.1);
                ctx.lineTo(cx + 7.8, cy - 3.7);
                ctx.lineTo(cx + 4.6, cy - 2.3);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }

            function drawFunFallbackIcon(cx, cy, color, variant) {
                ctx.save();
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 1.3;
                if (variant % 2 === 0) {
                    var r1 = 5.5;
                    var r2 = 2.5;
                    ctx.beginPath();
                    for (var p = 0; p < 10; p += 1) {
                        var angle = (-Math.PI / 2) + (p * Math.PI / 5);
                        var r = p % 2 === 0 ? r1 : r2;
                        var px = cx + Math.cos(angle) * r;
                        var py = cy + Math.sin(angle) * r;
                        if (p === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(cx - 1.8, cy - 1.2, 0.7, 0, Math.PI * 2);
                    ctx.arc(cx + 1.8, cy - 1.2, 0.7, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(cx, cy + 0.8, 2.4, 0.2 * Math.PI, 0.8 * Math.PI);
                    ctx.stroke();
                }
                ctx.restore();
            }

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, totalWidth, totalHeight);

            drawGeneratedMapHeader(ctx, {
                totalWidth: totalWidth,
                titleHeight: titleHeight,
                teamPrimary: teamPrimary,
                teamSecondary: teamSecondary,
                titleText: headerTitle,
                avatarImage: headerAvatar,
            });

            ctx.drawImage(activeMapImage, 0, titleHeight, MAP_CANVAS_WIDTH, mapHeight);

            var drawnCount = 0;
            var priorityPalette = {
                1: '#FF4D5A',
                2: '#FF8A3D',
                3: '#F7C948',
                4: '#40C9A2',
                5: '#6BA8FF',
            };
            Object.keys(mappedAssignments).forEach(function (building) {
                var pos = effectivePositions[building];
                var x = pos[0];
                var y_base = pos[1];
                var yVal = y_base + titleHeight;
                var players = mappedAssignments[building];
                var starterCardWidth = 182;
                var starterCardHeight = 28;
                var starterGapY = 34;
                var firstLabelStartX = x;
                var firstLabelStartY = yVal;
                var starterCardX = getStarterCardStartX(firstLabelStartX, starterCardWidth);

                players.forEach(function (player, i) {
                    var name = player.player;
                    var priorityColor = priorityPalette[player.priority] || teamPrimary;
                    var cardY = firstLabelStartY + (i * starterGapY);
                    var yPos = cardY + (starterCardHeight / 2);
                    var troopValue = player.troops || (activePlayerDB[name] && activePlayerDB[name].troops);
                    var troopKind = getTroopKind(troopValue);
                    var fittedName = fitText(name, starterCardWidth - 62, 'bold 13px Arial');
                    var cardX = starterCardX;

                    var cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + starterCardWidth, cardY);
                    cardGrad.addColorStop(0, 'rgba(26, 31, 44, 0.95)');
                    cardGrad.addColorStop(1, 'rgba(18, 22, 32, 0.95)');
                    ctx.fillStyle = cardGrad;
                    ctx.beginPath();
                    ctx.roundRect(cardX, cardY, starterCardWidth, starterCardHeight, 8);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(255,255,255,0.44)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.fillStyle = priorityColor;
                    ctx.beginPath();
                    ctx.roundRect(cardX + 1.4, cardY + 1.4, 6, starterCardHeight - 2.8, 4);
                    ctx.fill();

                    var chipX = cardX + 16;
                    ctx.beginPath();
                    ctx.arc(chipX, yPos, 8, 0, Math.PI * 2);
                    ctx.fillStyle = teamPrimary;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.font = 'bold 9px Arial';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(String(i + 1), chipX, yPos + 0.5);

                    ctx.font = 'bold 13px Arial';
                    ctx.fillStyle = '#F3F6FF';
                    ctx.textAlign = 'left';
                    ctx.fillText(fittedName, cardX + 30, yPos + 0.5);

                    var badgeW = 20;
                    var badgeH = 18;
                    var badgeX = cardX + starterCardWidth - badgeW - 6;
                    var badgeY = yPos - (badgeH / 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.12)';
                    ctx.beginPath();
                    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    var iconColor = troopKind === 'unknown' ? '#FFE28A' : priorityColor;
                    var iconCx = badgeX + (badgeW / 2);
                    var iconCy = badgeY + (badgeH / 2) + 0.4;
                    if (troopKind === 'tank') {
                        drawTankIcon(iconCx, iconCy, iconColor);
                    } else if (troopKind === 'aero') {
                        drawJetIcon(iconCx, iconCy, iconColor);
                    } else if (troopKind === 'missile') {
                        drawMissileLauncherIcon(iconCx, iconCy, iconColor);
                    } else {
                        drawFunFallbackIcon(iconCx, iconCy, iconColor, i);
                    }

                    drawnCount++;
                });
            });

            var unmappedArea = {
                x: 24,
                y: titleHeight + mapHeight + 22,
                width: 1032,
                height: 236,
            };
            var panelGapX = 14;
            var panelGapY = 12;
            var groupCount = unmappedGroups.length;
            var panelColumns = groupCount <= 1 ? 1 : Math.min(3, groupCount);
            var panelRows = groupCount > 0 ? Math.ceil(groupCount / panelColumns) : 0;
            var panelWidth = panelRows > 0
                ? Math.floor((unmappedArea.width - ((panelColumns - 1) * panelGapX)) / panelColumns)
                : 0;
            var panelHeight = panelRows > 0
                ? Math.floor((unmappedArea.height - ((panelRows - 1) * panelGapY)) / panelRows)
                : 0;

            unmappedGroups.forEach(function (group, groupIndex) {
                var row = Math.floor(groupIndex / panelColumns);
                var col = groupIndex % panelColumns;
                var pX = unmappedArea.x + (col * (panelWidth + panelGapX));
                var pY = unmappedArea.y + (row * (panelHeight + panelGapY));
                var panelRadius = 16;

                var panelGrad = ctx.createLinearGradient(0, pY, 0, pY + panelHeight);
                panelGrad.addColorStop(0, '#2A3344');
                panelGrad.addColorStop(1, '#1A202C');
                ctx.fillStyle = panelGrad;
                ctx.beginPath();
                ctx.roundRect(pX, pY, panelWidth, panelHeight, panelRadius);
                ctx.fill();
                ctx.strokeStyle = teamPrimary;
                ctx.lineWidth = 1.8;
                ctx.stroke();

                ctx.save();
                ctx.beginPath();
                ctx.roundRect(pX + 1, pY + 1, panelWidth - 2, panelHeight - 2, panelRadius);
                ctx.clip();
                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                for (var gx = pX + 14; gx < pX + panelWidth; gx += 20) {
                    ctx.beginPath();
                    ctx.moveTo(gx, pY);
                    ctx.lineTo(gx, pY + panelHeight);
                    ctx.stroke();
                }
                for (var gy = pY + 14; gy < pY + panelHeight; gy += 20) {
                    ctx.beginPath();
                    ctx.moveTo(pX, gy);
                    ctx.lineTo(pX + panelWidth, gy);
                    ctx.stroke();
                }
                ctx.restore();

                drawCrosshairIcon(pX + 20, pY + 24, 16, (global.DSThemeColors ? global.DSThemeColors.get('accent-primary') : '') || '#FFB84C');
                ctx.font = 'bold 15px Arial';
                ctx.fillStyle = '#F6F7FB';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(fitText(group.label, panelWidth - 132, 'bold 15px Arial'), pX + 36, pY + 24);

                ctx.font = '11px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.textAlign = 'right';
                ctx.fillText(group.players.length + ' ' + deps.t('map_unmapped_count_suffix'), pX + panelWidth - 12, pY + 24);

                var cardsTop = pY + 44;
                var cardGapX = 10;
                var cardGapY = 8;
                var cardColumns = panelWidth >= 340 ? 2 : 1;
                var cardWidth = Math.floor((panelWidth - 20 - ((cardColumns - 1) * cardGapX)) / cardColumns);
                var cardHeight = 28;
                var rowsCapacity = Math.max(1, Math.floor((panelHeight - (cardsTop - pY) - 10) / (cardHeight + cardGapY)));
                var cardCapacity = rowsCapacity * cardColumns;
                var visiblePlayers = group.players.slice(0, cardCapacity);

                visiblePlayers.forEach(function (player, playerIndex) {
                    var rowIndex = Math.floor(playerIndex / cardColumns);
                    var colIndex = playerIndex % cardColumns;
                    var cX = pX + 10 + (colIndex * (cardWidth + cardGapX));
                    var cY = cardsTop + (rowIndex * (cardHeight + cardGapY));
                    var troopValue = player.troops || (activePlayerDB[player.player] && activePlayerDB[player.player].troops);
                    var troopKind = getTroopKind(troopValue);
                    var displayName = fitText(player.player, cardWidth - 56, 'bold 12px Arial');

                    var cGrad = ctx.createLinearGradient(cX, cY, cX + cardWidth, cY);
                    cGrad.addColorStop(0, 'rgba(255,255,255,0.94)');
                    cGrad.addColorStop(1, 'rgba(236,240,248,0.98)');
                    ctx.fillStyle = cGrad;
                    ctx.beginPath();
                    ctx.roundRect(cX, cY, cardWidth, cardHeight, 7);
                    ctx.fill();

                    ctx.strokeStyle = teamPrimary;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();

                    ctx.fillStyle = teamPrimary;
                    ctx.beginPath();
                    ctx.arc(cX + 10, cY + (cardHeight / 2), 3.6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = '#1A1E29';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(displayName, cX + 19, cY + (cardHeight / 2) + 0.5);

                    var bW = 18;
                    var bH = 16;
                    var bX = cX + cardWidth - bW - 6;
                    var bY = cY + ((cardHeight - bH) / 2);
                    var iColor = troopKind === 'unknown' ? '#7F5A00' : teamPrimary;
                    var iCx = bX + (bW / 2);
                    var iCy = bY + (bH / 2) + 0.3;

                    ctx.fillStyle = 'rgba(255,255,255,0.88)';
                    ctx.beginPath();
                    ctx.roundRect(bX, bY, bW, bH, 4);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(32, 38, 52, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    if (troopKind === 'tank') {
                        drawTankIcon(iCx, iCy, iColor);
                    } else if (troopKind === 'aero') {
                        drawJetIcon(iCx, iCy, iColor);
                    } else if (troopKind === 'missile') {
                        drawMissileLauncherIcon(iCx, iCy, iColor);
                    } else {
                        drawFunFallbackIcon(iCx, iCy, iColor, groupIndex + playerIndex);
                    }
                });

                if (group.players.length > cardCapacity) {
                    ctx.font = '11px Arial';
                    ctx.fillStyle = 'rgba(255,255,255,0.82)';
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'alphabetic';
                    ctx.fillText('+' + (group.players.length - cardCapacity) + ' more', pX + panelWidth - 10, pY + panelHeight - 8);
                }
            });

            if (substitutes.length > 0) {
                var spX = MAP_CANVAS_WIDTH;
                var spY = titleHeight;
                var spHeight = mapHeight + unmappedHeight;

                var subsGrad = ctx.createLinearGradient(spX, spY, spX + subsPanelWidth, spY + spHeight);
                subsGrad.addColorStop(0, '#1D2330');
                subsGrad.addColorStop(1, '#141925');
                ctx.fillStyle = subsGrad;
                ctx.fillRect(spX, spY, subsPanelWidth, spHeight);

                ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                ctx.lineWidth = 1;
                for (var sy = spY + 14; sy < spY + spHeight; sy += 20) {
                    ctx.beginPath();
                    ctx.moveTo(spX + 8, sy);
                    ctx.lineTo(spX + subsPanelWidth - 8, sy);
                    ctx.stroke();
                }

                ctx.strokeStyle = teamPrimary;
                ctx.lineWidth = 1.8;
                ctx.strokeRect(spX + 0.9, spY + 0.9, subsPanelWidth - 1.8, spHeight - 1.8);

                var subsHeaderH = 72;
                var headGrad = ctx.createLinearGradient(spX, spY, spX, spY + subsHeaderH);
                headGrad.addColorStop(0, teamSoft);
                headGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
                ctx.fillStyle = headGrad;
                ctx.fillRect(spX, spY, subsPanelWidth, subsHeaderH);
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.beginPath();
                ctx.moveTo(spX + 10, spY + subsHeaderH);
                ctx.lineTo(spX + subsPanelWidth - 10, spY + subsHeaderH);
                ctx.stroke();

                drawShieldIcon(spX + 14, spY + 16, 20, 24, teamSecondary);
                ctx.font = 'bold 16px Arial';
                ctx.fillStyle = '#F6F7FB';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(deps.t('map_substitutes_title'), spX + 42, spY + 30);

                ctx.font = '13px Arial';
                ctx.fillStyle = 'rgba(255,255,255,0.72)';
                ctx.fillText('\u265E ' + deps.t('map_substitutes_subtitle'), spX + 42, spY + 50);

                var rowStartY = spY + subsHeaderH + 14;
                var rowHeight = 60;
                var rowGap = 10;
                var availableRowsHeight = spHeight - (rowStartY - spY) - 18;
                var rowsPerColumn = Math.max(1, Math.floor(availableRowsHeight / (rowHeight + rowGap)));
                var useTwoCols = substitutes.length > rowsPerColumn;
                var colCount = useTwoCols ? 2 : 1;
                var colGap = 10;
                var rowWidth = Math.floor((subsPanelWidth - 20 - ((colCount - 1) * colGap)) / colCount);

                substitutes.forEach(function (sub, index) {
                    var subCol = Math.floor(index / rowsPerColumn);
                    if (subCol >= colCount) {
                        return;
                    }
                    var subRow = index % rowsPerColumn;
                    var rowX = spX + 10 + subCol * (rowWidth + colGap);
                    var rowY = rowStartY + subRow * (rowHeight + rowGap);
                    var reserveTag = 'R' + String(index + 1);
                    var troopValue = sub.troops || (activePlayerDB[sub.name] && activePlayerDB[sub.name].troops);
                    var troopKind = getTroopKind(troopValue);
                    var subName = fitText(sub.name, rowWidth - 78, 'bold 12px Arial');
                    var replacementNames = getSubstituteReplacementNames(sub);
                    var replacementLineOne = replacementNames[0]
                        ? fitText('1. ' + replacementNames[0], rowWidth - 54, 'bold 10px Arial')
                        : '-';
                    var replacementLineTwo = replacementNames[1]
                        ? fitText('2. ' + replacementNames[1], rowWidth - 54, 'bold 10px Arial')
                        : '';

                    ctx.fillStyle = 'rgba(255,255,255,0.92)';
                    ctx.beginPath();
                    ctx.roundRect(rowX, rowY, rowWidth, rowHeight, 7);
                    ctx.fill();
                    ctx.strokeStyle = teamPrimary;
                    ctx.lineWidth = 1.2;
                    ctx.stroke();

                    ctx.fillStyle = teamPrimary;
                    ctx.beginPath();
                    ctx.roundRect(rowX + 3, rowY + 3, 28, rowHeight - 6, 5);
                    ctx.fill();

                    ctx.font = 'bold 11px Arial';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(reserveTag, rowX + 17, rowY + rowHeight / 2 + 0.5);

                    ctx.font = 'bold 12px Arial';
                    ctx.fillStyle = '#1B2230';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(subName, rowX + 36, rowY + 14);

                    ctx.font = '10px Arial';
                    ctx.fillStyle = 'rgba(27,34,48,0.72)';
                    ctx.fillText(deps.t('map_substitutes_replaces_label'), rowX + 36, rowY + 29);

                    ctx.font = 'bold 10px Arial';
                    ctx.fillStyle = '#1B2230';
                    ctx.fillText(replacementLineOne, rowX + 36, rowY + 42);
                    if (replacementLineTwo) {
                        ctx.fillText(replacementLineTwo, rowX + 36, rowY + 53);
                    }

                    var bW = 18;
                    var bH = 16;
                    var bX = rowX + rowWidth - bW - 6;
                    var bY = rowY + 8;
                    var iColor = troopKind === 'unknown' ? '#8A6400' : teamPrimary;
                    var iCx = bX + (bW / 2);
                    var iCy = bY + (bH / 2) + 0.3;

                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    ctx.beginPath();
                    ctx.roundRect(bX, bY, bW, bH, 4);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(32, 38, 52, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    if (troopKind === 'tank') {
                        drawTankIcon(iCx, iCy, iColor);
                    } else if (troopKind === 'aero') {
                        drawJetIcon(iCx, iCy, iColor);
                    } else if (troopKind === 'missile') {
                        drawMissileLauncherIcon(iCx, iCy, iColor);
                    } else {
                        drawFunFallbackIcon(iCx, iCy, iColor, index);
                    }
                });
            }

            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(90,90,90,0.95)';
            ctx.textAlign = 'center';
            ctx.fillText(deps.t('map_footer_text'), totalWidth / 2, totalHeight - 14);

            await triggerCanvasPngDownload(canvas, 'team_' + team + '_' + deps.getActiveEvent().excelPrefix + '.png');

            deps.showMessage(statusId, deps.t('message_team_map_downloaded', { team: team, drawnCount: drawnCount, bombSquad: unmappedPlayers.length, substitutes: substitutes.length }), 'success');
        } catch (error) {
            console.error(error);
            deps.showMessage(statusId, deps.t('error_generic', { error: error.message }), 'error');
        }
    }

    global.DSDownloadController = {
        openDownloadModal: openDownloadModal,
        closeDownloadModal: closeDownloadModal,
        downloadTeamExcel: downloadTeamExcel,
        downloadTeamMap: downloadTeamMap,
        triggerCanvasPngDownload: triggerCanvasPngDownload,
        triggerFileDownload: triggerFileDownload,
        getMapHeaderTitle: getMapHeaderTitle,
        getActiveEventAvatarDataUrl: getActiveEventAvatarDataUrl,
        loadActiveEventAvatarForHeader: loadActiveEventAvatarForHeader,
        fitCanvasHeaderText: fitCanvasHeaderText,
        getSubstituteReplacementNames: getSubstituteReplacementNames,
        formatSubstituteReplacementSummary: formatSubstituteReplacementSummary,
        drawGeneratedMapHeader: drawGeneratedMapHeader,
        generateMapWithoutBackground: generateMapWithoutBackground,
        generateMap: generateMap,
    };
})(window);
