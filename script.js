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
            const card = document.createElement('a');
            card.className = 'note-card';
            card.href = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
            card.target = '_blank';
            card.rel = 'noopener';

            const header = document.createElement('div');
            header.className = 'note-card__header';

            const icon = document.createElement('div');
            icon.className = 'note-card__icon';
            icon.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M7 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9.828a3 3 0 0 0-.879-2.12l-3.829-3.83A3 3 0 0 0 12.172 3H7Zm5.172 2a1 1 0 0 1 .707.293l3.828 3.828a1 1 0 0 1 .293.707V18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.172Z" />
                </svg>
            `;

            const title = document.createElement('h3');
            title.className = 'note-card__title';
            title.textContent = file.name || 'Untitled note';

            header.appendChild(icon);
            header.appendChild(title);

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

            card.appendChild(header);

            if (meta.childNodes.length) {
                card.appendChild(meta);
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

            return [name, mimeType, description].some((field) => field && field.includes(query));
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