const DRIVE_FOLDER_MIMETYPE = 'application/vnd.google-apps.folder';

document.addEventListener('DOMContentLoaded', () => {
    const notesContainer = document.getElementById('notes-container');
    const loadingMessage = document.getElementById('loading-message');
    const uploadButton = document.getElementById('upload-note-button');
    const config = (typeof window !== 'undefined' && window.MY_NOTES_CONFIG) ? window.MY_NOTES_CONFIG : {};

    const {
        apiKey = '',
        folderId = '',
        supportsAllDrives = false,
        maxResults = 100,
        orderBy = 'name',
        includeFolders = false,
        mimeTypes = [],
        fallbackNotes = []
    } = config;

    const searchInput = document.getElementById('note-search');
    const themeToggle = document.getElementById('theme-toggle');
    const themeToggleLabel = themeToggle ? themeToggle.querySelector('.button__label') : null;
    const themeToggleIconPath = themeToggle ? themeToggle.querySelector('svg path') : null;

    const THEME_STORAGE_KEY = 'notes-hub-theme';
    const THEME_ICON_PATHS = {
        light: 'M21 12.79A9 9 0 0 1 11.21 3a7 7 0 1 0 9.79 9.79Z',
        dark: 'M12 4a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V5a1 1 0 0 1 1-1Zm0 13a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Zm8-5a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm-13 0a1 1 0 0 1-1 1H5a1 1 0 0 1 0-2h1a1 1 0 0 1 1 1Zm10.071 6.071a1 1 0 0 1-1.414 0l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707a1 1 0 0 1 0 1.414Zm-9.9-9.9a1 1 0 0 1-1.414 0l-.707-.707A1 1 0 0 1 5.56 7.05l.708.707a1 1 0 0 1 0 1.414Zm9.9-1.414a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 1 1 1.414-1.414l.707.707Zm-9.9 9.9a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 0 1 1.414-1.414l.707.707ZM12 7a5 5 0 1 1 0 10A5 5 0 0 1 12 7Z'
    };

    let currentTheme = 'light';
    let allNotes = [];
    let activeQuery = '';
    const folderChildrenCache = new Map();
    const folderOpenState = new Map();

    const clearLoadingState = () => {
        if (loadingMessage && loadingMessage.parentElement) {
            loadingMessage.parentElement.removeChild(loadingMessage);
        }
    };

    const readStoredTheme = () => {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY);
        } catch (error) {
            console.warn('Unable to read stored theme preference', error);
            return null;
        }
    };

    const persistTheme = (theme) => {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            console.warn('Unable to persist theme preference', error);
        }
    };

    const updateThemeControls = (theme) => {
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
            themeToggle.setAttribute('title', theme === 'dark' ? 'Switch to day theme' : 'Switch to night theme');
        }

        if (themeToggleLabel) {
            themeToggleLabel.textContent = theme === 'dark' ? 'Switch to Day' : 'Switch to Night';
        }

        if (themeToggleIconPath) {
            const iconPath = theme === 'dark' ? THEME_ICON_PATHS.dark : THEME_ICON_PATHS.light;
            themeToggleIconPath.setAttribute('d', iconPath);
        }
    };

    const detectPreferredTheme = () => {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    };

    const applyTheme = (theme, { persist = true } = {}) => {
        const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
        currentTheme = resolvedTheme;
        document.body.classList.toggle('theme-dark', resolvedTheme === 'dark');
        updateThemeControls(resolvedTheme);

        if (persist) {
            persistTheme(resolvedTheme);
        }
    };

    const storedTheme = readStoredTheme();
    applyTheme(storedTheme || detectPreferredTheme(), { persist: Boolean(storedTheme) });

    if (!storedTheme && window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handlePreferenceChange = (event) => {
            if (!readStoredTheme()) {
                applyTheme(event.matches ? 'dark' : 'light', { persist: false });
            }
        };

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handlePreferenceChange);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(handlePreferenceChange);
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    if (uploadButton) {
        if (folderId) {
            uploadButton.addEventListener('click', () => {
                const uploadUrl = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
                window.open(uploadUrl, '_blank', 'noopener');
            });
        } else {
            uploadButton.setAttribute('disabled', 'true');
            uploadButton.setAttribute('aria-disabled', 'true');
        }
    }

    const setMessage = (message, { variant = 'info', append = false } = {}) => {
        clearLoadingState();

        if (!append) {
            notesContainer.innerHTML = '';
        }

        const paragraph = document.createElement('p');
        paragraph.className = `notes-message notes-message--${variant}`;
        paragraph.textContent = message;
        notesContainer.appendChild(paragraph);
        return paragraph;
    };

    const formatDate = (isoString) => {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date);
        } catch (error) {
            console.warn('Unable to format date', error);
            return '';
        }
    };

    const formatSize = (sizeValue) => {
        if (!sizeValue && sizeValue !== 0) {
            return '';
        }

        const size = typeof sizeValue === 'string' ? parseInt(sizeValue, 10) : sizeValue;

        if (Number.isNaN(size) || size <= 0) {
            return '';
        }

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const exponent = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
        const value = size / Math.pow(1024, exponent);

        return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`;
    };

    const showFolderStatus = (element, message, { variant = 'info', hidden = false } = {}) => {
        if (!element) return;

        if (hidden) {
            element.hidden = true;
            element.textContent = '';
            element.classList.remove('note-card__children-status--error');
            return;
        }

        element.hidden = false;
        element.textContent = message;
        element.classList.toggle('note-card__children-status--error', variant === 'error');
    };

    const createChildListItem = (child) => {
        const item = document.createElement('li');
        item.className = 'note-card__child';

        const link = document.createElement('a');
        link.className = 'note-card__child-link';
        link.href = child.webViewLink || `https://drive.google.com/file/d/${child.id}/view`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = child.name || 'Untitled file';

        item.appendChild(link);

        if (child.mimeType === DRIVE_FOLDER_MIMETYPE) {
            item.classList.add('note-card__child--folder');
            link.classList.add('note-card__child-link--folder');
        }

        const detailParts = [];
        const sizeText = formatSize(child.size);
        if (sizeText) {
            detailParts.push(sizeText);
        }

        const updatedText = formatDate(child.modifiedTime);
        if (updatedText) {
            detailParts.push(updatedText);
        }

        if (detailParts.length) {
            const meta = document.createElement('span');
            meta.className = 'note-card__child-meta';
            meta.textContent = detailParts.join(' • ');
            item.appendChild(meta);
        }

        return item;
    };

    const renderFolderChildren = (listElement, items = []) => {
        if (!listElement) return;

        listElement.innerHTML = '';

        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'note-card__child note-card__child--empty';
            empty.textContent = 'This folder is empty.';
            listElement.appendChild(empty);
            return;
        }

        items.forEach((child) => {
            listElement.appendChild(createChildListItem(child));
        });
    };

    const renderNotes = (files = [], { append = false, emptyMessage } = {}) => {
        clearLoadingState();

        if (!append) {
            notesContainer.innerHTML = '';
        }

        if (!files.length) {
            if (!append) {
                setMessage(emptyMessage || 'No notes found in this folder yet.');
            }
            return;
        }

        const fragment = document.createDocumentFragment();

        const createMetaItem = (value, pathDefinition) => {
            const span = document.createElement('span');

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathDefinition);

            svg.appendChild(path);
            span.appendChild(svg);
            span.appendChild(document.createTextNode(value));

            return span;
        };

        files.forEach((file) => {
            const isFolder = file.mimeType === DRIVE_FOLDER_MIMETYPE;
            const card = document.createElement(isFolder ? 'div' : 'a');
            card.className = `note-card${isFolder ? ' note-card--folder' : ''}`;

            if (!isFolder) {
                card.href = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
                card.target = '_blank';
                card.rel = 'noopener';
            } else {
                card.setAttribute('data-folder-id', file.id || '');
                card.setAttribute('role', 'group');
            }

            const header = document.createElement('div');
            header.className = 'note-card__header';
            if (isFolder) {
                header.classList.add('note-card__header--folder');
            }

            const icon = document.createElement('div');
            icon.className = 'note-card__icon';
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="${isFolder
                        ? 'M4 6a3 3 0 0 1 3-3h3.172a3 3 0 0 1 2.121.879l1.828 1.828H20a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z'
                        : 'M7 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9.828a3 3 0 0 0-.879-2.12l-3.829-3.83A3 3 0 0 0 12.172 3H7Zm5.172 2a1 1 0 0 1 .707.293l3.828 3.828a1 1 0 0 1 .293.707V18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.172Z'}" />
                </svg>
            `;

            const title = document.createElement('h3');
            title.className = 'note-card__title';
            title.textContent = file.name || (isFolder ? 'Untitled folder' : 'Untitled note');

            header.appendChild(icon);
            header.appendChild(title);

            if (isFolder) {
                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.className = 'button button--ghost note-card__toggle';
                toggleButton.textContent = 'Show files';
                toggleButton.setAttribute('aria-expanded', 'false');
                if (file.id) {
                    toggleButton.setAttribute('aria-controls', `folder-items-${file.id}`);
                }

                header.appendChild(toggleButton);
                card.appendChild(header);

                const folderBody = document.createElement('div');
                folderBody.className = 'note-card__folder-body';

                const status = document.createElement('p');
                status.className = 'note-card__children-status';
                status.hidden = true;
                folderBody.appendChild(status);

                const childrenList = document.createElement('ul');
                childrenList.className = 'note-card__children';
                if (file.id) {
                    childrenList.id = `folder-items-${file.id}`;
                }
                childrenList.hidden = true;
                folderBody.appendChild(childrenList);

                card.appendChild(folderBody);

                let pendingRequest = null;

                const setOpenState = (open) => {
                    folderOpenState.set(file.id, open);
                    card.classList.toggle('note-card--expanded', open);
                    toggleButton.textContent = open ? 'Hide files' : 'Show files';
                    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
                    if (!open) {
                        childrenList.hidden = true;
                    }
                };

                const loadChildren = async () => {
                    if (folderChildrenCache.has(file.id)) {
                        renderFolderChildren(childrenList, folderChildrenCache.get(file.id));
                        childrenList.hidden = false;
                        showFolderStatus(status, '', { hidden: true });
                        return;
                    }

                    if (!pendingRequest) {
                        pendingRequest = fetchFolderContents(file.id)
                            .then((items) => {
                                folderChildrenCache.set(file.id, items);
                                return items;
                            })
                            .finally(() => {
                                pendingRequest = null;
                            });
                    }

                    toggleButton.disabled = true;
                    showFolderStatus(status, 'Loading files...');

                    try {
                        const items = await pendingRequest;
                        renderFolderChildren(childrenList, items);
                        childrenList.hidden = false;
                        showFolderStatus(status, '', { hidden: true });
                    } catch (error) {
                        console.error('Error fetching folder contents:', error);
                        showFolderStatus(status, 'Unable to load files for this folder. Try again later.', { variant: 'error' });
                        setOpenState(false);
                    } finally {
                        toggleButton.disabled = false;
                    }
                };

                const openFolder = async () => {
                    setOpenState(true);
                    await loadChildren();
                };

                const closeFolder = () => {
                    setOpenState(false);
                    showFolderStatus(status, '', { hidden: true });
                };

                const initialOpen = folderOpenState.get(file.id) === true;
                if (initialOpen) {
                    setOpenState(true);
                    if (folderChildrenCache.has(file.id)) {
                        renderFolderChildren(childrenList, folderChildrenCache.get(file.id));
                        childrenList.hidden = false;
                        showFolderStatus(status, '', { hidden: true });
                    } else {
                        // fire and forget
                        loadChildren();
                    }
                } else {
                    setOpenState(false);
                }

                toggleButton.addEventListener('click', async () => {
                    if (folderOpenState.get(file.id)) {
                        closeFolder();
                    } else {
                        await openFolder();
                    }
                });
            } else {
                card.appendChild(header);

                const meta = document.createElement('div');
                meta.className = 'note-card__meta';

                const formattedDate = formatDate(file.modifiedTime);
                const formattedSize = formatSize(file.size);

                if (formattedDate) {
                    meta.appendChild(createMetaItem(
                        `Updated ${formattedDate}`,
                        'M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 2 0v1Zm13 6H4v9h16Zm0-2V6H4v1Z'
                    ));
                }

                if (formattedSize) {
                    meta.appendChild(createMetaItem(
                        formattedSize,
                        'M12 2a1 1 0 0 1 .707.293l5 5A1 1 0 0 1 18 9h-5a1 1 0 0 1-1-1V3H6v16h12v-6a1 1 0 0 1 2 0v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V3a1 1 0 0 1 1-1h7Zm1 4.414L15.586 8H13Z'
                    ));
                }

                if (meta.childNodes.length) {
                    card.appendChild(meta);
                }
            }

            fragment.appendChild(card);
        });

        notesContainer.appendChild(fragment);
    };

    const filterNotes = (notes = [], rawQuery = '') => {
        const query = (rawQuery || '').trim().toLowerCase();

        if (!query) {
            return notes;
        }

        return notes.filter((note) => {
            const name = (note.name || '').toLowerCase();
            const mimeType = (note.mimeType || '').toLowerCase();
            const description = (note.description || '').toLowerCase();

            if ([name, mimeType, description].some((field) => field && field.includes(query))) {
                return true;
            }

            if (note.mimeType === DRIVE_FOLDER_MIMETYPE && note.id && folderChildrenCache.has(note.id)) {
                const children = folderChildrenCache.get(note.id) || [];
                return children.some((child) => {
                    const childName = (child.name || '').toLowerCase();
                    const childMimeType = (child.mimeType || '').toLowerCase();
                    return [childName, childMimeType].some((field) => field && field.includes(query));
                });
            }

            return false;
        });
    };

    const applySearchFilter = ({ retainExisting = false } = {}) => {
        const currentValue = searchInput ? searchInput.value : activeQuery;
        activeQuery = currentValue || '';

        const filtered = filterNotes(allNotes, activeQuery);
        const query = (activeQuery || '').trim();
        const hasQuery = query.length > 0;
        const emptyMessage = hasQuery
            ? 'No notes match your search yet. Try a different keyword.'
            : undefined;

        renderNotes(filtered, { emptyMessage, append: retainExisting });

        if (searchInput) {
            const hasNoResults = hasQuery && filtered.length === 0;
            searchInput.setAttribute('aria-invalid', hasNoResults ? 'true' : 'false');
        }
    };

    if (searchInput) {
        const handleSearchInput = () => {
            applySearchFilter();
        };

        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('search', handleSearchInput);
    }

    const normaliseFallbackNotes = (notes = []) => notes
        .filter((note) => note && (note.url || note.webViewLink || note.href))
        .map((note, index) => ({
            id: note.id || `fallback-note-${index}`,
            name: note.name || note.title || note.filename || `Sample note ${index + 1}`,
            webViewLink: note.url || note.webViewLink || note.href,
            modifiedTime: note.modifiedTime || note.updated || note.lastModified,
            size: note.size || note.fileSize || note.bytes
        }));

    const useFallback = (message) => {
        const normalised = normaliseFallbackNotes(fallbackNotes);

        if (normalised.length) {
            allNotes = normalised;

            if (message) {
                setMessage(message, { variant: 'info', append: true });
                applySearchFilter({ retainExisting: true });
            } else {
                applySearchFilter();
            }
        }
    };

    if (!folderId || !apiKey) {
        setMessage('Update config.js with your Google Drive API key and folder ID to load your notes.', { variant: 'error' });
        useFallback('Showing example notes while your Drive connection is configured.');
        return;
    }

    const buildApiUrl = () => {
        const filters = [`'${folderId}' in parents`, 'trashed = false'];

        if (Array.isArray(mimeTypes) && mimeTypes.length) {
            const mimeFilter = mimeTypes
                .filter((type) => typeof type === 'string' && type.trim().length)
                .map((type) => `mimeType='${type.trim()}'`);

            if (mimeFilter.length) {
                filters.push(`(${mimeFilter.join(' or ')})`);
            }
        }

        const safePageSize = Math.max(1, Math.min(Number(maxResults) || 100, 1000));
        const safeOrderBy = Array.isArray(orderBy) ? orderBy.join(',') : orderBy;

        const params = new URLSearchParams({
            key: apiKey,
            q: filters.join(' and '),
            fields: 'files(id,name,webViewLink,mimeType,iconLink,modifiedTime,size)',
            orderBy: safeOrderBy,
            pageSize: String(safePageSize)
        });

        if (supportsAllDrives) {
            params.set('supportsAllDrives', 'true');
            params.set('includeItemsFromAllDrives', 'true');
        }

        return `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    };

    const buildFolderApiUrl = (parentId) => {
        const filters = [`'${parentId}' in parents`, 'trashed = false'];

        if (Array.isArray(mimeTypes) && mimeTypes.length) {
            const mimeFilter = mimeTypes
                .filter((type) => typeof type === 'string' && type.trim().length)
                .map((type) => `mimeType='${type.trim()}'`);

            if (mimeFilter.length) {
                filters.push(`(${mimeFilter.join(' or ')})`);
            }
        }

        const safePageSize = Math.max(1, Math.min(Number(maxResults) || 100, 1000));
        const safeOrderBy = Array.isArray(orderBy) ? orderBy.join(',') : orderBy;

        const params = new URLSearchParams({
            key: apiKey,
            q: filters.join(' and '),
            fields: 'files(id,name,webViewLink,mimeType,modifiedTime,size)',
            orderBy: safeOrderBy,
            pageSize: String(safePageSize)
        });

        if (supportsAllDrives) {
            params.set('supportsAllDrives', 'true');
            params.set('includeItemsFromAllDrives', 'true');
        }

        return `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    };

    const fetchFolderContents = async (parentId) => {
        if (!parentId) {
            return [];
        }

        const response = await fetch(buildFolderApiUrl(parentId), {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            let errorDetail = `Request failed with status ${response.status}`;

            try {
                const problem = await response.json();
                if (problem && problem.error) {
                    const { message, status } = problem.error;
                    errorDetail = `${status || 'Error'}: ${message || errorDetail}`;
                }
            } catch (parseError) {
                console.warn('Unable to parse error response from Drive API', parseError);
            }

            throw new Error(errorDetail);
        }

        const data = await response.json();
        const files = data.files || [];

        if (includeFolders) {
            return files;
        }

        return files.filter((item) => item.mimeType !== DRIVE_FOLDER_MIMETYPE);
    };

    const fetchNotes = async () => {
        try {
            const response = await fetch(buildApiUrl(), {
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                let errorDetail = `Request failed with status ${response.status}`;

                try {
                    const problem = await response.json();
                    if (problem && problem.error) {
                        const { message, status } = problem.error;
                        errorDetail = `${status || 'Error'}: ${message || errorDetail}`;
                    }
                } catch (parseError) {
                    console.warn('Unable to parse error response from Drive API', parseError);
                }

                throw new Error(errorDetail);
            }

            const data = await response.json();
            allNotes = (data.files || [])
                .filter((file) => includeFolders || file.mimeType !== DRIVE_FOLDER_MIMETYPE);

            applySearchFilter();
        } catch (error) {
            console.error('Error fetching notes:', error);
            const message = error && error.message
                ? `Failed to load notes: ${error.message}`
                : 'Failed to load notes. Double-check your API key, folder sharing settings, and Drive API access.';

            setMessage(message, { variant: 'error' });
            useFallback('Showing example notes instead so you can continue working.');
        }
    };

    fetchNotes();
});