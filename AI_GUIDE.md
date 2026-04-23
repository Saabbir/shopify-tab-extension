# AI Guide: Shopify Tab Extension

This file is optimized for AI coding tools (Cursor, Claude, Codex) to quickly understand and safely modify this project.

## 1) Project type

- Chrome Extension (Manifest V3)
- No build step
- No package manager
- Plain JS/HTML/CSS

## 2) Primary entry points

- `manifest.json`
  - `chrome_url_overrides.newtab` -> `newtab.html`
  - `background.service_worker` -> `background.js`
- `newtab.html`
  - Loads `newtab.js` as module
- `newtab.js`
  - Main app logic (fetch, cache, filter, render)

## 3) File ownership map (change X -> edit Y)

- Change extension metadata/permissions/routing -> `manifest.json`
- Change UI skeleton/controls -> `newtab.html`
- Change styling/theme/layout -> `style.css`
- Change channel list/categories/fallbacks -> `channels.js`
- Change fetch/cache/render behavior -> `newtab.js`
- Change install/service-worker behavior -> `background.js`

## 4) Runtime flow

1. New tab opens -> `newtab.html` loads.
2. `newtab.js` initializes controls on `DOMContentLoaded`.
3. Categories derived from `CHANNELS` + `FALLBACK_CHANNELS`.
4. Cache is checked in `localStorage`.
5. If valid cache exists, render cached videos.
6. Otherwise fetch RSS/Atom feeds from channel list.
7. Parse feed entries, normalize video objects, sort by date.
8. Filter blocked channels, cap result count, cache result.
9. Render grouped-by-date sections of video cards.

## 5) Data contracts used by UI

Rendered video objects are expected to include:

- `id.videoId`
- `snippet.title`
- `snippet.channelTitle`
- `snippet.publishedAt`
- `snippet.thumbnails.medium.url`
- `snippet.description` (optional)
- `contentDetails.duration` (optional)

If you change parsing code, preserve this shape or update `displayVideos()`.

## 6) Cache model

- Keys:
  - `shopify_videos_cache`
  - `shopify_videos_timestamp`
  - `selectedCategory`
- Cache duration: 1 hour
- Manual refresh: clears cache then force-fetches
- Auto-refresh: periodic check; refreshes when stale

## 7) Known pitfalls

- `newtab.js` contains legacy/unused helper functions that reference undeclared constants (YouTube API-key path). They are not in the active RSS path.
- Relevance filter currently allows all videos (`isRelevantVideo` returns `true`).
- `BLOCKED_CHANNELS` matching is title-based in current flow; fragile if channel naming changes.

## 8) Safe editing rules for AI

- Keep changes minimal and local to one concern.
- Do not introduce build tooling unless explicitly requested.
- Preserve manifest keys and MV3 compatibility.
- Preserve DOM IDs used by JS:
  - `loading`, `error-message`, `videos-container`, `refresh-btn`, `category-filter`
- Preserve module import in `newtab.js`:
  - `import channelsData from './channels.js';`

## 9) Quick validation protocol

After edits:

1. Go to `chrome://extensions`.
2. Reload the unpacked extension.
3. Open a new tab.
4. Confirm:
   - page renders
   - category dropdown populates
   - category switch re-renders list
   - refresh button works
   - no uncaught errors in DevTools console

## 10) Common task recipes

- Add a channel:
  - Edit `CHANNELS` in `channels.js`
  - Include `id`, `name`, `handle`, `category`
- Add a new category:
  - Assign that category on one or more channels
  - Dropdown auto-populates from channel data
- Tweak card UI:
  - Markup usually in `displayVideos()` in `newtab.js`
  - Styling in `style.css`
- Change cache duration:
  - Update `CACHE_DURATION` in `newtab.js`

## 11) What not to touch casually

- `manifest.json` permissions/host permissions
- DOM element IDs used by runtime logic
- Video object fields required by renderer

## 12) If debugging fetch issues

- Check network responses for feed URLs:
  - `https://www.youtube.com/feeds/videos.xml?channel_id=<id>`
- Validate channel IDs/handles in `channels.js`
- Temporarily log feed parse count per channel
- Verify fallback channels produce items

