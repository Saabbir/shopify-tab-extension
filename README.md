# Shopify Tab Extension

A lightweight Chrome extension that overrides the browser new-tab page and shows recent Shopify/web-development YouTube videos.

## What this project does

- Replaces Chrome's default new tab with a custom page (`newtab.html`).
- Fetches video feeds from curated YouTube channels via RSS/Atom (no API key required in the main path).
- Groups videos by publish date and renders them as cards.
- Supports category filtering and manual refresh.
- Caches fetched videos in `localStorage` to reduce network calls.

## Tech and runtime model

- Stack: plain JavaScript (ES modules), HTML, CSS.
- Platform: Chrome Extension, Manifest V3.
- Background: service worker (`background.js`) with minimal install log behavior.
- UI runtime: all app logic runs in `newtab.js`.
- No build step, package manager, or test runner in this repo.

## Project structure

- `manifest.json` - extension metadata, permissions, new-tab override, service worker.
- `newtab.html` - page shell and UI containers.
- `newtab.js` - core app logic (fetching, caching, filtering, rendering).
- `channels.js` - curated channel list, blocked list, fallback channels.
- `style.css` - UI styling for header, filter, cards, grouped sections.
- `background.js` - install lifecycle listener only.

## How data flows

1. `DOMContentLoaded` in `newtab.js` initializes controls and category options.
2. App checks cache validity (`isCacheValid`) using timestamp in `localStorage`.
3. If cache is valid, cached videos render immediately.
4. Otherwise `getAllVideos(category)` fetches channel feeds in parallel.
5. Feed XML is parsed into normalized video objects.
6. Results are merged, blocked channels removed, sorted by newest, truncated to max.
7. Videos are cached and displayed.
8. A periodic timer checks cache expiry and auto-refreshes when needed.

## Caching behavior

- Keys:
  - `shopify_videos_cache`
  - `shopify_videos_timestamp`
  - `selectedCategory`
- Duration: 1 hour (`CACHE_DURATION`).
- Auto-check interval: every minute, refreshes once cache is stale.
- Manual refresh button clears cache and force-fetches.

## Categories and channels

- Categories are derived dynamically from `CHANNELS` + `FALLBACK_CHANNELS`.
- Default selected category prefers `shopify` when available.
- Update `channels.js` to add/remove channels or categories.
- `BLOCKED_CHANNELS` can filter out unwanted channel titles during display prep.

## Running locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder.
4. Open a new tab to test the extension UI.
5. Use DevTools on the new tab page to inspect logs/errors.

## AI Tool Quickstart (Cursor/Claude/Codex)

If you are an AI coding assistant, use this checklist before editing:

1. Read `manifest.json` first to understand extension entry points.
2. Read `newtab.js` second; this is the primary behavior file.
3. Read `channels.js` for content scope and categorization.
4. Keep changes minimal and local; there is no build pipeline to catch mistakes.
5. Validate by reloading the unpacked extension and opening a new tab.

### Safe change zones

- UI copy/layout tweaks: `newtab.html`
- Styles/visual polish: `style.css`
- Channel curation and categories: `channels.js`
- Fetch/caching/render logic: `newtab.js`

### Validation checklist after code changes

- Extension loads without manifest errors.
- New tab page renders and does not stay stuck on "Loading...".
- Category dropdown populates and switching category updates videos.
- Refresh button triggers new fetch and re-render.
- Console has no uncaught runtime errors.

## Known caveats for maintainers

- `newtab.js` contains legacy helper functions that reference undeclared constants (for example variables related to YouTube API key usage). They are currently unused by the active RSS flow; avoid calling or wiring them without cleanup.
- Relevance filtering currently returns all titles (`isRelevantVideo` has filtering disabled intentionally).
- Cache helpers currently support both object and legacy array shapes when reading cached data.

## Suggested future improvements

- Remove or isolate unused legacy YouTube API helper code.
- Add lightweight smoke tests (or at least scripted manual verification docs).
- Add empty/error states for no videos found per category.
- Normalize blocked channel filtering to use channel ID instead of title for reliability.

