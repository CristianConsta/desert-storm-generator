(function initEventsManagerController(global) {
    function createController(deps) {
        const dependencies = deps && typeof deps === 'object' ? deps : {};

        return {
            toggleEventsPanel: function toggleEventsPanel() {
                if (typeof dependencies.toggleEventsPanel === 'function') {
                    dependencies.toggleEventsPanel();
                }
            },
            enterEditMode: function enterEditMode() {
                if (typeof dependencies.enterEditMode === 'function') {
                    dependencies.enterEditMode();
                }
            },
            triggerLogoUpload: function triggerLogoUpload() {
                if (typeof dependencies.triggerLogoUpload === 'function') {
                    dependencies.triggerLogoUpload();
                }
            },
            removeLogo: function removeLogo() {
                if (typeof dependencies.removeLogo === 'function') {
                    dependencies.removeLogo();
                }
            },
            handleLogoChange: function handleLogoChange(event) {
                if (typeof dependencies.handleLogoChange === 'function') {
                    dependencies.handleLogoChange(event);
                }
            },
            triggerMapUpload: function triggerMapUpload() {
                if (typeof dependencies.triggerMapUpload === 'function') {
                    dependencies.triggerMapUpload();
                }
            },
            removeMap: function removeMap() {
                if (typeof dependencies.removeMap === 'function') {
                    dependencies.removeMap();
                }
            },
            handleMapChange: function handleMapChange(event) {
                if (typeof dependencies.handleMapChange === 'function') {
                    dependencies.handleMapChange(event);
                }
            },
            addBuildingRow: function addBuildingRow() {
                if (typeof dependencies.addBuildingRow === 'function') {
                    dependencies.addBuildingRow();
                }
            },
            saveEvent: function saveEvent() {
                if (typeof dependencies.saveEvent === 'function') {
                    dependencies.saveEvent();
                }
            },
            cancelEdit: function cancelEdit() {
                if (typeof dependencies.cancelEdit === 'function') {
                    dependencies.cancelEdit();
                }
            },
            deleteEvent: function deleteEvent() {
                if (typeof dependencies.deleteEvent === 'function') {
                    dependencies.deleteEvent();
                }
            },
            openCoordinatesPicker: function openCoordinatesPicker() {
                if (typeof dependencies.openCoordinatesPicker === 'function') {
                    dependencies.openCoordinatesPicker();
                }
            },
            openEventWiki: function openEventWiki() {
                if (typeof dependencies.openEventWiki === 'function') {
                    dependencies.openEventWiki();
                }
            },
        };
    }

    global.DSFeatureEventsManagerController = {
        createController: createController,
    };
})(window);
