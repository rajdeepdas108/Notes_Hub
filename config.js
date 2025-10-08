// Update the values below with your own Google Drive API credentials.
// Never commit your real API key to public repositories.
window.MY_NOTES_CONFIG = {
    /**
     * Google API key with the Drive API enabled. Make sure the key is either unrestricted
     * or that the domain you serve this page from is added to the allowed referrers list.
     */
    apiKey: 'AIzaSyDKDttASXzfYrU1B6IWUK0q77LGkY1OL1o',

    /**
     * The ID of the Google Drive folder that contains your notes. Share the folder publicly
     * ("Anyone with the link") so it can be accessed with an API key.
     */
    folderId: '1qX9skaw3vaW3th-UAVFOG9mU0ikr0UKf',

    /**
     * Optional settings.
     */
    supportsAllDrives: false,
    includeFolders: false,
    mimeTypes: [
        // Example: 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    maxResults: 50,
    orderBy: 'name',

    /**
     * Provide any lightweight sample entries so the page still renders useful links while
     * you configure the Drive connection. Remove these once you see your own notes.
     */
    fallbackNotes: [
        {
            name: 'Example – Semester Notes Overview',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            updated: '2024-04-01T10:30:00Z',
            size: 523000
        },
        {
            name: 'Example – Weekly Reading List',
            url: 'https://www.iana.org/domains/example',
            updated: '2024-04-08T08:15:00Z',
            size: 87000
        }
    ]
};
