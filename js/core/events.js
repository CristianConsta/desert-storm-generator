(function initEventsCore(global) {
    const DEFAULT_ASSIGNMENT_ALGORITHM_ID = 'balanced_round_robin';

    function cloneDeep(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeAlgorithmId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase();
    }

    function resolveDefaultAssignmentAlgorithmId() {
        if (global.DSCoreGames && typeof global.DSCoreGames.getDefaultGameId === 'function' && typeof global.DSCoreGames.getGame === 'function') {
            const defaultGameId = global.DSCoreGames.getDefaultGameId();
            const defaultGame = global.DSCoreGames.getGame(defaultGameId);
            if (defaultGame && Array.isArray(defaultGame.assignmentAlgorithmIds) && defaultGame.assignmentAlgorithmIds.length > 0) {
                const firstId = normalizeAlgorithmId(defaultGame.assignmentAlgorithmIds[0]);
                if (firstId) {
                    return firstId;
                }
            }
        }
        return DEFAULT_ASSIGNMENT_ALGORITHM_ID;
    }

    const LEGACY_EVENT_REGISTRY = {
        desert_storm: {
            id: 'desert_storm',
            name: 'Desert Storm',
            titleKey: 'event_desert_storm',
            mapFile: 'desert-storm-map.png',
            previewMapFile: 'desert-storm-map-preview.webp',
            exportMapFile: 'desert-storm-map.png',
            mapTitle: 'DESERT STORM',
            excelPrefix: 'desert_storm',
            logoDataUrl: '',
            mapDataUrl: '',
            assignmentAlgorithmId: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
            buildings: [
                { name: 'Bomb Squad', priority: 1, slots: 4, label: 'Bomb Squad' },
                { name: 'Oil Refinery 1', priority: 3, slots: 2, label: 'Oil Refinery 1' },
                { name: 'Oil Refinery 2', priority: 3, slots: 2, label: 'Oil Refinery 2' },
                { name: 'Field Hospital 1', priority: 4, slots: 2, label: 'Field Hospital 1' },
                { name: 'Field Hospital 2', priority: 4, slots: 2, label: 'Field Hospital 2' },
                { name: 'Field Hospital 3', priority: 4, slots: 2, label: 'Field Hospital 3' },
                { name: 'Field Hospital 4', priority: 4, slots: 2, label: 'Field Hospital 4' },
                { name: 'Info Center', priority: 5, slots: 2, label: 'Info Center' },
                { name: 'Science Hub', priority: 5, slots: 2, label: 'Science Hub' },
            ],
            defaultPositions: {
                'Info Center': [366, 38],
                'Field Hospital 4': [785, 139],
                'Oil Refinery 1': [194, 260],
                'Field Hospital 2': [951, 247],
                'Oil Refinery 2': [914, 472],
                'Field Hospital 1': [161, 458],
                'Field Hospital 3': [314, 654],
                'Science Hub': [774, 656],
            },
            buildingAnchors: {
                'Info Center': 'left',
                'Field Hospital 4': 'right',
                'Oil Refinery 1': 'left',
                'Field Hospital 2': 'right',
                'Oil Refinery 2': 'right',
                'Field Hospital 1': 'left',
                'Field Hospital 3': 'left',
                'Science Hub': 'right',
            },
        },
        canyon_battlefield: {
            id: 'canyon_battlefield',
            name: 'Canyon Storm',
            titleKey: 'event_canyon_battlefield',
            mapFile: 'canon-storm-map.png',
            previewMapFile: 'canon-storm-map.png',
            exportMapFile: 'canon-storm-map.png',
            mapTitle: 'CANYON STORM',
            excelPrefix: 'canyon_battlefield',
            logoDataUrl: '',
            mapDataUrl: '',
            assignmentAlgorithmId: DEFAULT_ASSIGNMENT_ALGORITHM_ID,
            buildings: [
                { name: 'Bomb Squad', priority: 1, slots: 4, label: 'Bomb Squad' },
                { name: 'Missile Silo 1', priority: 2, slots: 2, label: 'Missile Silo 1' },
                { name: 'Missile Silo 2', priority: 2, slots: 2, label: 'Missile Silo 2' },
                { name: 'Radar Station 1', priority: 3, slots: 2, label: 'Radar Station 1' },
                { name: 'Radar Station 2', priority: 3, slots: 2, label: 'Radar Station 2' },
                { name: 'Watchtower 1', priority: 4, slots: 1, label: 'Watchtower 1' },
                { name: 'Watchtower 2', priority: 4, slots: 1, label: 'Watchtower 2' },
                { name: 'Watchtower 3', priority: 4, slots: 1, label: 'Watchtower 3' },
                { name: 'Watchtower 4', priority: 4, slots: 1, label: 'Watchtower 4' },
                { name: 'Command Center', priority: 3, slots: 2, label: 'Command Center' },
                { name: 'Supply Depot', priority: 5, slots: 1, label: 'Supply Depot' },
                { name: 'Armory', priority: 5, slots: 1, label: 'Armory' },
                { name: 'Comm Tower', priority: 5, slots: 0, label: 'Comm Tower' },
            ],
            defaultPositions: {},
            buildingAnchors: {},
        },
    };

    const EVENT_REGISTRY = cloneDeep(LEGACY_EVENT_REGISTRY);

    function getEvent(eventId) {
        return EVENT_REGISTRY[eventId] || null;
    }

    function getEventIds() {
        return Object.keys(EVENT_REGISTRY);
    }

    function normalizeEventId(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    }

    function slugifyEventId(name, existingIds) {
        const existing = new Set(Array.isArray(existingIds) ? existingIds : Object.keys(EVENT_REGISTRY));
        let base = normalizeEventId(name).slice(0, 30);
        if (!base) {
            base = 'event';
        }
        let candidate = base;
        let counter = 2;
        while (existing.has(candidate)) {
            const suffix = `_${counter}`;
            candidate = `${base.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
            counter += 1;
        }
        return candidate;
    }

    function sanitizeBuildings(buildings) {
        if (!Array.isArray(buildings)) {
            return [];
        }
        return buildings
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
                const name = typeof item.name === 'string' ? item.name.trim() : '';
                if (!name) {
                    return null;
                }
                const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : name;
                const slots = Number(item.slots);
                const priority = Number(item.priority);
                return {
                    name: name,
                    label: label,
                    slots: Number.isFinite(slots) ? Math.round(slots) : 0,
                    priority: Number.isFinite(priority) ? Math.round(priority) : 1,
                    showOnMap: item.showOnMap !== false,
                };
            })
            .filter(Boolean);
    }

    function sanitizeEventDefinition(eventId, incoming, existing) {
        const prev = existing && typeof existing === 'object' ? existing : {};
        const source = incoming && typeof incoming === 'object' ? incoming : {};
        const id = normalizeEventId(eventId || source.id || prev.id);
        const nameRaw = typeof source.name === 'string' && source.name.trim()
            ? source.name.trim()
            : (typeof prev.name === 'string' && prev.name.trim() ? prev.name.trim() : id || 'Event');
        const name = nameRaw.slice(0, 30);
        const mapDataUrl = typeof source.mapDataUrl === 'string' ? source.mapDataUrl.trim() : (prev.mapDataUrl || '');
        const logoDataUrl = typeof source.logoDataUrl === 'string' ? source.logoDataUrl.trim() : (prev.logoDataUrl || '');
        const mapFile = mapDataUrl || source.mapFile || prev.mapFile || '';
        const previewMapFile = mapDataUrl || source.previewMapFile || prev.previewMapFile || mapFile || '';
        const exportMapFile = mapDataUrl || source.exportMapFile || prev.exportMapFile || mapFile || '';
        const mapTitle = (source.mapTitle || prev.mapTitle || name).toString().trim().toUpperCase().slice(0, 50);
        const excelPrefix = normalizeEventId(source.excelPrefix || prev.excelPrefix || id || name) || 'event';
        const titleKey = source.titleKey || prev.titleKey || '';
        const requestedAlgorithmId = normalizeAlgorithmId(source.assignmentAlgorithmId || prev.assignmentAlgorithmId);
        const assignmentAlgorithmId = requestedAlgorithmId || resolveDefaultAssignmentAlgorithmId();
        const buildings = sanitizeBuildings(source.buildings || prev.buildings || []);
        const defaultPositions = cloneDeep(source.defaultPositions || prev.defaultPositions || {});
        const buildingAnchors = cloneDeep(source.buildingAnchors || prev.buildingAnchors || {});
        return {
            id: id,
            name: name,
            titleKey: titleKey,
            mapFile: mapFile,
            previewMapFile: previewMapFile,
            exportMapFile: exportMapFile,
            mapDataUrl: mapDataUrl || '',
            logoDataUrl: logoDataUrl || '',
            assignmentAlgorithmId: assignmentAlgorithmId,
            mapTitle: mapTitle || name.toUpperCase(),
            excelPrefix: excelPrefix,
            buildings: buildings,
            defaultPositions: defaultPositions,
            buildingAnchors: buildingAnchors,
        };
    }

    function upsertEvent(eventId, eventDefinition) {
        const normalizedId = normalizeEventId(eventId);
        if (!normalizedId) {
            return null;
        }
        const existing = EVENT_REGISTRY[normalizedId] || null;
        const sanitized = sanitizeEventDefinition(normalizedId, eventDefinition, existing);
        EVENT_REGISTRY[normalizedId] = sanitized;
        return cloneDeep(sanitized);
    }

    function removeEvent(eventId) {
        const id = normalizeEventId(eventId);
        if (!id) {
            return false;
        }
        if (!Object.prototype.hasOwnProperty.call(EVENT_REGISTRY, id)) {
            return false;
        }
        delete EVENT_REGISTRY[id];
        return true;
    }

    function cloneEventRegistry() {
        return cloneDeep(EVENT_REGISTRY);
    }

    function setEventRegistry(registry) {
        const next = registry && typeof registry === 'object' ? registry : {};
        Object.keys(EVENT_REGISTRY).forEach((key) => {
            delete EVENT_REGISTRY[key];
        });
        Object.keys(next).forEach((key) => {
            const upserted = sanitizeEventDefinition(key, next[key], null);
            if (upserted.id) {
                EVENT_REGISTRY[upserted.id] = upserted;
            }
        });
    }

    function cloneEventBuildings(eventId) {
        const evt = getEvent(eventId);
        if (!evt) {
            return [];
        }
        return evt.buildings.map((building) => ({
            ...building,
            showOnMap: building && building.showOnMap !== false,
        }));
    }

    function cloneDefaultPositions(eventId) {
        const evt = getEvent(eventId);
        if (!evt) {
            return {};
        }
        return cloneDeep(evt.defaultPositions || {});
    }

    function cloneLegacyEventRegistry() {
        return cloneDeep(LEGACY_EVENT_REGISTRY);
    }

    global.DSCoreEvents = {
        EVENT_REGISTRY: EVENT_REGISTRY,
        LEGACY_EVENT_REGISTRY: LEGACY_EVENT_REGISTRY,
        getEvent: getEvent,
        getEventIds: getEventIds,
        cloneEventRegistry: cloneEventRegistry,
        setEventRegistry: setEventRegistry,
        upsertEvent: upsertEvent,
        removeEvent: removeEvent,
        slugifyEventId: slugifyEventId,
        cloneEventBuildings: cloneEventBuildings,
        cloneDefaultPositions: cloneDefaultPositions,
        cloneLegacyEventRegistry: cloneLegacyEventRegistry,
        normalizeEventId: normalizeEventId,
    };
})(window);
