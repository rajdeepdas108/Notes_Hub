# My Personal Notes Hub

A lightweight front-end that lists files from a Google Drive folder so you can keep important study documents in one place. The page now ships with improved error handling, configurable filters, and a friendly fallback list so you are never left staring at a blank screen.

## Features

- 🔐 **Config-driven setup** – keep your API key and folder ID in `config.js`; no hard-coded secrets in the main script.
- 🌐 **Google Drive integration** – fetches file names, sizes, and last-modified timestamps from the Drive API.
- 🧭 **Smart messaging** – clear status messages for missing config, empty folders, or fetch errors.
- 📝 **Fallback content** – optional sample notes render while you’re wiring up the real Drive connection.
- 🎨 **Polished UI** – metadata formatting, hover affordances, and accessible live regions out of the box.

## Setup

1. **Enable the Drive API** inside the [Google Cloud Console](https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com).
2. **Create an API key** (Credentials → Create Credentials → API key). For local testing leave it unrestricted. When deploying, lock it down to the domain that will host this site.
3. **Share your Drive folder** with "Anyone with the link". Copy the folder ID from the URL – it’s the long string after `/folders/`.
4. **Update `config.js`** with your `apiKey` and `folderId`. Adjust optional filters (mime types, `maxResults`, Team Drives) as needed.
5. (Optional) Remove or customise the `fallbackNotes` array once your live data loads successfully.

## Run locally

Any static file server works. From PowerShell you can spin one up with `npx`:

```pwsh
npx --yes serve .
```

Then browse to the printed localhost URL. Update `config.js` and refresh to see changes.

## Troubleshooting

- **403 or 400 errors** – confirm the Drive API is enabled, the folder is shared publicly, and the API key is unrestricted (for development) or includes your domain in the referrer list.
- **Empty list** – make sure the folder actually contains files and isn’t just subfolders. Set `includeFolders: true` in `config.js` if you’d like to show folders too.
- **Still seeing fallback entries** – remove them from `fallbackNotes` once the Drive fetch succeeds. They remain to ensure the UI stays populated during setup.

## File overview

- `index.html` – markup and script includes.
- `style.css` – base styling plus note and message components.
- `config.js` – user-editable configuration for API credentials and filters.
- `script.js` – Drive API client and DOM rendering logic.

Enjoy your always-available study notes!✍️
