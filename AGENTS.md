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
  - `action.default_popup` -> `popup.html`
- `newtab.html`
  - Loads `newtab.js` as module
  - Contains the `#channel-manager` panel (channel CRUD + preferences), hidden by default
- `newtab.js`
  - Main app logic (fetch, cache, filter, render, channel management)
- `channels.js`
  - Ships `CHANNELS` (defaults), `BLOCKED_CHANNELS`, `FALLBACK_CHANNELS`
  - Only the *seed* data — the live channel list users see/edit lives in `localStorage`, see §6
- `background.js`
  - MV3 service worker (no DOM, no `localStorage`, no `DOMParser`)
  - On an alarm (every 15 min, see §7c) polls RSS feeds for all *enabled* channels, sends a desktop notification for new uploads from *favorite* channels, and updates the action badge with today's total upload count across enabled channels
- `popup.html` / `popup.js` / `popup.css`
  - The toolbar icon's `default_popup` — opens on icon click, lists today's videos (all enabled channels) from `chrome.storage.local`, no fetching of its own
  - "Open Shopify Tab" button opens `newtab.html` in a new tab

## 3) File ownership map (change X -> edit Y)

- Change extension metadata/permissions/routing -> `manifest.json`
- Change UI skeleton/controls -> `newtab.html`
- Change styling/theme/layout -> `style.css`
- Change default/seed channel list, blocked list, fallback list -> `channels.js`
- Change fetch/cache/render/channel-management/category behavior -> `newtab.js`
- Change background polling, badge count, or favorite-channel notifications -> `background.js`
- Change the toolbar-icon popup ("today's uploads" list) -> `popup.html` / `popup.js` / `popup.css`

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

Separately, the "Manage Channels" panel (`#manage-channels-btn` toggles `#channel-manager`) lets users add/edit/delete/enable/disable/favorite channels and set the default category entirely from the UI — no code edits needed for routine channel changes.

Independently of the new-tab page, `background.js` runs on a 15-minute alarm (see §7c) regardless of whether a new tab is open, polling enabled channels' RSS feeds, notifying on new uploads from favorite channels, and refreshing the toolbar badge + the popup's "today" list.

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
- `favorite` (boolean, defaults to `false`; `favorite === true` is the truthiness check — opts an *enabled* channel into desktop notifications for new uploads, see §7c). Toggled via the ★/☆ button in `renderChannelsList()` or the "Favorite" checkbox in `#channel-form`.

## 6) Storage model (localStorage keys)

- `shopify_videos_cache` — cached video list (+ category + timestamp)
- `shopify_videos_timestamp` — cache write time, cache duration is 1 hour (`CACHE_DURATION`)
- `shopify_custom_channels` (`CHANNELS_STORAGE_KEY`) — the user's live, editable channel list (overrides `CHANNELS` from `channels.js` once it exists). "Reset to Defaults" clears this back to `channels.js`'s `CHANNELS`.
- `selectedCategory` — the currently active category filter; persists across new tabs (this is the user's last manual choice, not necessarily the default preference)
- `defaultCategory` — the fallback/"land here" category set via the `#default-category-select` preference in Manage Channels; only used when there's no valid `selectedCategory` yet (first run, or the previously selected category was deleted)
- `youtubeApiKey` — optional YouTube Data API v3 key set via `#youtube-api-key-input` in Manage Channels; enables video-duration badges (see §7b). Empty/absent means no key configured, not an error state.

Manual refresh: clears cache then force-fetches. Auto-refresh: periodic check every minute; refreshes when stale.

`background.js` and `popup.js` cannot read any of the above — they're outside the `newtab.html` page context and have no `localStorage`. They instead use `chrome.storage.local` (see §7c) for the small subset of data they need.

## 7b) Video duration badges (why they need an API key)

YouTube's RSS/Atom feeds (the feed the live flow parses) do not include video length — there's no way to get it from `parseRssFeed()` alone. `attachVideoDurations(videos, apiKey)` in `newtab.js` fetches `contentDetails.duration` from the YouTube Data API (`videos.list`, batched 50 ids/request) and is called from `getAllVideos()` right after `finalVideos` is assembled, only when `getYoutubeApiKey()` returns a non-empty key. `manifest.json` already grants `host_permissions` for `googleapis.com`, so no manifest change is needed to use this.

- No key configured: `attachVideoDurations` is skipped entirely; `video.contentDetails` stays undefined and `displayVideos()` already omits the badge in that case (`video.contentDetails?.duration` check) — this is normal, not a bug.
- Bad key / quota exceeded / network failure: caught and logged per-batch inside `attachVideoDurations`; videos still render without a badge rather than the whole fetch failing.
- The badge markup/CSS (`.video-duration`) already existed before the key wiring was added — it's absolutely positioned bottom-right over `.thumbnail-container`, styled to look like YouTube's own overlay.

## 7c) Background polling, favorite notifications, and the badge/popup (chrome.storage.local keys)

`background.js` is an MV3 service worker: no `window`, no `localStorage`, no `DOMParser`. It's a separate execution context from `newtab.js` and cannot read anything in §6. It uses `chrome.storage.local` instead, with these keys:

- `shopify_channels_mirror` — a trimmed copy (`id`, `name`, `category`, `enabled`, `favorite` only) of `editableChannels`, written by `mirrorChannelsForBackground()` in `newtab.js` on every `saveEditableChannels()` call *and* on initial page load. This is the only way `background.js` learns which channels exist/are enabled/are favorited — if you add a way to mutate channels that bypasses `saveEditableChannels()`, the background worker will go stale.
- `shopify_youtube_api_key_mirror` — mirror of `youtubeApiKey` (§6), written by `mirrorYoutubeApiKeyForBackground()` on every `setYoutubeApiKey()` call and on initial page load. Used only to fetch durations for today's videos (see below); same empty/absent = no-key-configured semantics as §7b, not an error state.
- `shopify_today_videos` — videos published today across all *enabled* channels, recomputed on every check (with `contentDetails.duration` attached if an API key is mirrored); read by `popup.js` to render the popup list (popup does no fetching of its own).
- `shopify_seen_video_ids` — `{ [channelId]: [videoId, ...] }`, capped to the last 30 ids per channel; tracks which *favorite* channels' videos have already been notified-on so the same upload doesn't re-notify on the next check. A channel's first-ever entry here is seeded without notifying, to avoid a notification flood the moment a channel is favorited (or on first install).

Flow on `chrome.alarms` (`shopify-channel-check`, every 15 min, also fires on `onInstalled`/`onStartup`, and on `chrome.storage.onChanged` for `shopify_channels_mirror` or `shopify_youtube_api_key_mirror` — e.g. so setting the API key gets used on the next check instead of waiting up to 15 min):

1. Read `shopify_channels_mirror`, filter to `enabled !== false`.
2. Fetch each channel's RSS feed directly (`https://www.youtube.com/feeds/videos.xml?channel_id=<id>`, no fallback URL formats, unlike `newtab.js`'s `fetchChannelFeed`).
3. Parse entries with **regex** (`parseFeedEntries()`), not `DOMParser` — it doesn't exist in a service worker. If YouTube changes its feed's tag structure, fix the regexes here *and* the DOM selectors in `newtab.js`'s `parseRssFeed()` separately; they don't share code.
4. Videos published today (any enabled channel), deduped -> if `shopify_youtube_api_key_mirror` has a key, `attachVideoDurations()` fetches `contentDetails.duration` for just that (today-only) set — background.js's own copy of `newtab.js`'s function, portable as-is since it's pure fetch/JSON with no DOM dependency. Result -> `shopify_today_videos` + badge count via `chrome.action.setBadgeText`.
5. New videos (not in `shopify_seen_video_ids`) from *favorite* channels -> `chrome.notifications.create()`, id `favorite-video-<videoId>`; `chrome.notifications.onClicked` opens the video's YouTube URL by parsing the id back out (no separate id->URL map needed, since a fresh service worker instance may have lost any in-memory state). Notification payloads don't include duration — only the popup does.

The popup (`popup.html`/`popup.js`) is the `action.default_popup`, so it opens automatically on icon click — there's no `chrome.action.onClicked` listener (setting `default_popup` suppresses that event entirely). `popup.js` has its own `formatDuration()`, duplicated from `newtab.js` since it's a plain script (not a module) with no import path between the two.

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
- `background.js` has no `localStorage`/`DOMParser`/`document` — it's a service worker, not a page. Don't add code there that assumes DOM APIs; use `chrome.storage.local` and regex/string parsing instead (see §7c).
- The RSS feed is parsed twice, by two independent implementations: `parseRssFeed()` (DOM-based, in `newtab.js`) and `parseFeedEntries()` (regex-based, in `background.js`). A feed-format change needs both fixed.
- `shopify_channels_mirror` in `chrome.storage.local` can go stale if a channel mutation path is added that skips `saveEditableChannels()`/`mirrorChannelsForBackground()` — background polling, notifications, and the badge would silently keep using old data.

## 9) Safe editing rules for AI

- Keep changes minimal and local to one concern.
- Do not introduce build tooling unless explicitly requested.
- Preserve manifest keys and MV3 compatibility.
- Preserve DOM IDs used by JS:
  - Video area: `loading`, `error-message`, `videos-container`, `refresh-btn`, `category-filter`
  - Channel manager: `manage-channels-btn`, `channel-manager`, `close-channel-manager-btn`, `reset-channels-btn`, `default-category-select`, `youtube-api-key-input`, `channel-form`, `channel-edit-index`, `channel-id`, `channel-name`, `channel-handle`, `channel-category`, `channel-categories`, `channel-language`, `channel-languages`, `channel-favorite`, `save-channel-btn`, `channel-form-error`, `channels-list`
  - Popup (`popup.html`, used by `popup.js`): `popup-count`, `popup-empty`, `popup-list`, `popup-open-newtab-btn`
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
   - Manage Channels: mark a channel as favorite (★), confirm it persists across reopening the panel
   - Toolbar icon: badge shows a count once `background.js` has run its first check (may take a moment after install/reload); clicking the icon opens the popup and lists today's videos
   - Background/service worker: in `chrome://extensions`, open the service worker's DevTools ("service worker" link on the extension card) and check for uncaught errors, especially after a channel-list change
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
