# Release Notes

## v1.0.0

Initial public release.

### Added

- Floating BRS panel for Contract leaderboard/feed pages.
- Team BRS ranking with BRS, REP, CR, level, and milestone progress.
- Syndicate icon near each team row.
- Click navigation from teams to `/teams/{teamId}`.
- Best-effort click navigation from user rows to `/users/{userId}`.
- Collapsed BRS pill mode with persisted state.
- Local cache for BRS data; API refresh happens only by explicit user action.
- Optional Chromium watcher/injector for environments where unpacked extension loading is unreliable.

### Security

- No auth token is bundled or committed.
- The extension reads the active site token from `localStorage.token`.
- The watcher supports optional `CONTRACT_TOKEN` through environment variables for local use only.

### Planned

- Hall of Fame auction leader crown once the market lots are published.
- NFT owner markers for the planned NEO_NFT lots.
