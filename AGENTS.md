# AGENTS.md: Shopify Tab Extension

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
  - Contains the `#channel-manager` panel (channel CRUD + preferences), hidden by default
- `newtab.js`
  - Main app logic (fetch, cache, filter, render, channel management)
- `channels.js`
  - Ships `CHANNELS` (defaults), `BLOCKED_CHANNELS`, `FALLBACK_CHANNELS`
  - Only the *seed* data — the live channel list users see/edit lives in `localStorage`, see §6

## 3) File ownership map (change X -> edit Y)

- Change extension metadata/permissions/routing -> `manifest.json`
- Change UI skeleton/controls -> `newtab.html`
- Change styling/theme/layout -> `style.css`
- Change default/seed channel list, blocked list, fallback list -> `channels.js`
- Change fetch/cache/render/channel-management/category behavior -> `newtab.js`
- Change install/service-worker behavior -> `background.js`

## 4) Runtime flow

1. New tab opens -> `newtab.html` loads.
2. `newtab.js` initializes controls on `DOMContentLoaded`.
3. `editableChannels` loaded from `localStorage` (falls back to cloning `CHANNELS` from `channels.js` if unset/invalid).
4. Categories/languages derived from `editableChannels` + `FALLBACK_CHANNELS` (not from `channels.js` alone).
5. Category filter (`#category-filter`) populated; value resolves to the user's last selection if still valid, else the stored default-category preference, else `'all'` (see §7).
6. Cache is checked in `localStorage`.
7. If valid cache exists, render cached videos.
8. Otherwise fetch RSS/Atom feeds from enabled channels (channels with `enabled !== false`), filtered by selected category.
9. Parse feed entries, normalize video objects, sort by date.
10. Filter blocked channels, cap result count (`MAX_VIDEOS`), cache result.
11. Render grouped-by-date sections of video cards.

Separately, the "Manage Channels" panel (`#manage-channels-btn` toggles `#channel-manager`) lets users add/edit/delete/enable/disable channels and set the default category entirely from the UI — no code edits needed for routine channel changes.

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

Channel objects (`channels.js` seed data and `editableChannels` at runtime):

- `id` (required, YouTube channel ID)
- `name` (required)
- `handle` (optional)
- `category` (required, normalized via `normalizeCategory()` — lowercase, hyphenated)
- `language` (optional, normalized via `normalizeLanguage()`)
- `enabled` (boolean, defaults to `true`; `enabled !== false` is the truthiness check used everywhere, so `undefined`/missing counts as enabled)

## 6) Storage model (localStorage keys)

- `shopify_videos_cache` — cached video list (+ category + timestamp)
- `shopify_videos_timestamp` — cache write time, cache duration is 1 hour (`CACHE_DURATION`)
- `shopify_custom_channels` (`CHANNELS_STORAGE_KEY`) — the user's live, editable channel list (overrides `CHANNELS` from `channels.js` once it exists). "Reset to Defaults" clears this back to `channels.js`'s `CHANNELS`.
- `selectedCategory` — the currently active category filter; persists across new tabs (this is the user's last manual choice, not necessarily the default preference)
- `defaultCategory` — the fallback/"land here" category set via the `#default-category-select` preference in Manage Channels; only used when there's no valid `selectedCategory` yet (first run, or the previously selected category was deleted)

Manual refresh: clears cache then force-fetches. Auto-refresh: periodic check every minute; refreshes when stale.

## 7) Category selection logic (easy to get wrong — read before touching)

`upsertCategoryOptions()` (main filter) and `upsertDefaultCategoryOptions()` (preference select) share `populateCategorySelectOptions()` for the `<option>` list, but differ in what value they land on:

- Main filter: prefers the stored `selectedCategory` if still valid (`'all'` or an existing category); only falls back to `defaultCategory` if there's no valid stored selection. **Do not** make it unconditionally overwrite `selectedCategory` with the default on every load — that was a real regression once (the dropdown appeared to "not persist").
- Preference select: always reflects `defaultCategory` (or `'all'` if that category no longer exists), independent of whatever the user is currently viewing.

Both are called on initial load and after any channel-list change (`refreshAfterChannelChanges()`), since categories can shift when channels are added/edited/deleted.

## 8) Known pitfalls

- `newtab.js` contains legacy/unused helper functions that reference undeclared constants (YouTube API-key path: `getVideosFromChannels`, `getVideosFromQueries`, `getSpecificVideo`, `filterBySubscriberCount`). They are not in the active RSS path — the live flow is `getAllVideos()` -> RSS/Atom fetch -> `parseRssFeed()`.
- Relevance filter currently allows all videos (`isRelevantVideo` returns `true`).
- `BLOCKED_CHANNELS` matching is title-based in current flow; fragile if channel naming changes.
- Category/language values are normalized (lowercase, hyphenated) via `normalizeCategory`/`normalizeLanguage` — display labels are title-cased from that normalized value, so don't store display-formatted strings in channel data.

## 9) Safe editing rules for AI

- Keep changes minimal and local to one concern.
- Do not introduce build tooling unless explicitly requested.
- Preserve manifest keys and MV3 compatibility.
- Preserve DOM IDs used by JS:
  - Video area: `loading`, `error-message`, `videos-container`, `refresh-btn`, `category-filter`
  - Channel manager: `manage-channels-btn`, `channel-manager`, `close-channel-manager-btn`, `reset-channels-btn`, `default-category-select`, `channel-form`, `channel-edit-index`, `channel-id`, `channel-name`, `channel-handle`, `channel-category`, `channel-categories`, `channel-language`, `channel-languages`, `save-channel-btn`, `channel-form-error`, `channels-list`
- Preserve module import in `newtab.js`:
  - `import channelsData from './channels.js';`
- In `renderChannelsList()`, rows are sorted enabled-first/disabled-last for display, but `data-index` on each action button still refers to the row's real position in `editableChannels` — if you change the sort, keep that index mapping intact or the toggle/edit/delete buttons will act on the wrong channel.

## 10) Quick validation protocol

After edits:

1. Go to `chrome://extensions`.
2. Reload the unpacked extension.
3. Open a new tab.
4. Confirm:
   - page renders
   - category dropdown populates and persists your selection across a new tab
   - category switch re-renders list
   - refresh button works
   - Manage Channels: add/edit/delete/toggle a channel, confirm list re-sorts (disabled at bottom) and category dropdowns stay in sync
   - no uncaught errors in DevTools console

If a real browser isn't available, a quick alternative is serving the folder with a static file server (e.g. `python3 -m http.server`) and driving `newtab.html` with a headless browser (Playwright) — network-dependent RSS fetches will fail under plain `http://localhost` (no `host_permissions`/CORS like a real extension origin), but all UI/localStorage logic (category persistence, channel CRUD, sorting) is fully testable that way.

## 11) Common task recipes

- Add/edit/disable/delete a channel:
  - Preferred: use the "Manage Channels" UI at runtime — no code change needed, persists to `shopify_custom_channels`.
  - To change the *seed* defaults new users start with: edit `CHANNELS` in `channels.js` (`id`, `name`, `handle`, `category`, optionally `language`/`enabled`).
- Add a new category:
  - Assign that category on any channel (via UI or `channels.js`) — dropdowns auto-populate from live channel data, no separate registration needed.
- Change the default landing category:
  - Set it via `#default-category-select` in Manage Channels (UI), or seed `localStorage.defaultCategory` directly.
- Tweak card UI:
  - Markup usually in `displayVideos()` in `newtab.js`
  - Styling in `style.css`
- Change cache duration:
  - Update `CACHE_DURATION` in `newtab.js`

## 12) What not to touch casually

- `manifest.json` permissions/host permissions
- DOM element IDs used by runtime logic (see §9 list)
- Video object fields required by renderer (see §5)
- The enabled-first/disabled-last sort + index mapping in `renderChannelsList()` (see §9)

## 13) If debugging fetch issues

- Check network responses for feed URLs:
  - `https://www.youtube.com/feeds/videos.xml?channel_id=<id>`
- Validate channel IDs/handles (check both `channels.js` seed data and, more likely for a live user, `localStorage.shopify_custom_channels`)
- Temporarily log feed parse count per channel
- Verify fallback channels produce items
