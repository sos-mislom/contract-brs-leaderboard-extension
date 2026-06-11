# Contract BRS Leaderboard

Browser extension for `https://contract.tochka-urfu.tech`.

It adds a compact BRS overlay to leaderboard/feed pages and helps open team and user profiles directly from leaderboard rows.

## Features

- Shows team BRS scores, REP, CR, levels, milestones, and syndicate icons.
- Opens `/teams/{teamId}` when a team row is clicked.
- Opens `/users/{userId}` when a user row can be recognized.
- Uses the site auth token from `localStorage.token`; no token is bundled with the extension.
- Caches BRS data in `localStorage` and refreshes it only when the refresh button is clicked.
- Can be collapsed into a small BRS pill; the collapsed/expanded state is saved.
- Includes an optional local watcher (`injector.js`) for Chromium sessions where unpacked extension injection is unreliable.

## Chrome Install

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this repository folder.
5. Open `https://contract.tochka-urfu.tech/achievements?tab=leaderboard`.

If the browser does not inject unpacked extensions reliably, run:

```powershell
node injector.js
```

The watcher opens Chrome with a remote-debugging profile and injects the same `content.js` and `styles.css` into Contract pages.

Optional watcher environment variables:

- `CONTRACT_CHROME_PATH` points to a custom Chrome executable.
- `CONTRACT_CHROME_PROFILE` points to a custom Chrome profile directory.

## Firefox Install

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Select `manifest.json` from this repository folder.
4. Open the Contract leaderboard page.

## Auth

Log in to Contract in the same browser profile. The extension reads `localStorage.token` from the site page.

For local watcher usage only, an optional token can be provided through the environment:

```powershell
$env:CONTRACT_TOKEN = "your-token"
node injector.js
```

Do not commit real tokens.

## Cache

The extension stores leaderboard/BRS data under `contract-brs-cache-v2` in the site `localStorage`.

It renders cached data immediately and calls the API only when the refresh button is clicked.

## Release Artifacts

Build zip archives from the repository root:

```powershell
Compress-Archive -Path manifest.json,background.js,content.js,styles.css,injector.js,'Start Contract BRS.cmd','Start Contract BRS Hidden.vbs',README.md,RELEASE_NOTES.md,LICENSE -DestinationPath contract-brs-leaderboard-chrome.zip -Force
```
