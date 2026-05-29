(function initEventListUi(global) {
    function defaultTranslate(key) {
        return key;
    }

    function getTranslator(translate) {
        return typeof translate === 'function' ? translate : defaultTranslate;
    }

    function renderEventsList(options) {
        const config = options && typeof options === 'object' ? options : {};
        const listEl = config.listElement || document.getElementById('eventsList');
        if (!listEl) {
            return;
        }

        const eventIds = Array.isArray(config.eventIds) ? config.eventIds : [];
        const getEventById = typeof config.getEventById === 'function'
            ? config.getEventById
            : function fallbackGetEvent() { return null; };
        const currentEventId = typeof config.currentEventId === 'string' ? config.currentEventId : '';
        const eventEditorCurrentId = typeof config.eventEditorCurrentId === 'string' ? config.eventEditorCurrentId : '';
        const generateAvatarDataUrl = typeof config.generateAvatarDataUrl === 'function'
            ? config.generateAvatarDataUrl
            : function fallbackAvatar() { return ''; };
        const onSelectEvent = typeof config.onSelectEvent === 'function'
            ? config.onSelectEvent
            : function noopSelect() {};
        const onStartNewEvent = typeof config.onStartNewEvent === 'function'
            ? config.onStartNewEvent
            : function noopStart() {};
        const getWikiUrl = typeof config.getWikiUrl === 'function'
            ? config.getWikiUrl
            : null;
        const t = getTranslator(config.translate);

        listEl.innerHTML = '';

        eventIds.forEach((eventId) => {
            const event = getEventById(eventId);
            if (!event) {
                return;
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = `events-list-item${eventId === currentEventId ? ' active' : ''}`;
            button.addEventListener('click', () => onSelectEvent(eventId));

            const avatar = document.createElement('img');
            avatar.className = 'events-list-avatar';
            avatar.alt = `${event.name || eventId} avatar`;
            avatar.src = event.logoDataUrl || generateAvatarDataUrl(event.name || eventId, eventId);

            const textWrap = document.createElement('span');
            textWrap.className = 'events-list-text';
            const title = document.createElement('span');
            title.className = 'events-list-title';
            title.textContent = event.name || eventId;
            const meta = document.createElement('span');
            meta.className = 'events-list-meta';
            meta.textContent = t('events_manager_building_count', {
                count: Array.isArray(event.buildings) ? event.buildings.length : 0,
            });
            textWrap.appendChild(title);
            textWrap.appendChild(meta);

            button.appendChild(avatar);
            button.appendChild(textWrap);

            if (getWikiUrl) {
                const wikiUrl = getWikiUrl(eventId);
                if (wikiUrl) {
                    const wikiLink = document.createElement('a');
                    wikiLink.className = 'events-list-wiki-link';
                    wikiLink.href = wikiUrl;
                    wikiLink.target = '_blank';
                    wikiLink.rel = 'noopener noreferrer';
                    wikiLink.title = t('events_manager_wiki_link');
                    wikiLink.textContent = t('events_manager_wiki_link');
                    wikiLink.addEventListener('click', function(e) {
                        e.stopPropagation();
                    });
                    button.appendChild(wikiLink);
                }
            }

            listEl.appendChild(button);
        });

        const newEventBtn = document.createElement('button');
        newEventBtn.type = 'button';
        newEventBtn.className = `events-list-item events-list-new${!eventEditorCurrentId ? ' active' : ''}`;
        newEventBtn.addEventListener('click', () => onStartNewEvent());

        const newAvatar = document.createElement('span');
        newAvatar.className = 'events-list-avatar events-list-avatar-add';
        newAvatar.textContent = '+';

        const newTextWrap = document.createElement('span');
        newTextWrap.className = 'events-list-text';
        const newTitle = document.createElement('span');
        newTitle.className = 'events-list-title';
        newTitle.textContent = t('events_manager_new_event');
        const newMeta = document.createElement('span');
        newMeta.className = 'events-list-meta';
        newMeta.textContent = t('events_manager_new_event_hint');
        newTextWrap.appendChild(newTitle);
        newTextWrap.appendChild(newMeta);

        newEventBtn.appendChild(newAvatar);
        newEventBtn.appendChild(newTextWrap);
        listEl.appendChild(newEventBtn);
    }

    global.DSEventListUI = {
        renderEventsList: renderEventsList,
    };
})(window);

