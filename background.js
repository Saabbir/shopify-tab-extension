// Storage keys shared with newtab.js and popup.js. All live in chrome.storage.local
// because this service worker has no localStorage/DOM access (see AGENTS.md §6, §8).
const CHANNELS_MIRROR_KEY = 'shopify_channels_mirror';
const YOUTUBE_API_KEY_MIRROR_KEY = 'shopify_youtube_api_key_mirror';
const TODAY_VIDEOS_KEY = 'shopify_today_videos';
const SEEN_VIDEO_IDS_KEY = 'shopify_seen_video_ids';
const DURATION_BATCH_SIZE = 50;

const ALARM_NAME = 'shopify-channel-check';
const CHECK_INTERVAL_MINUTES = 15;
const SEEN_IDS_PER_CHANNEL_CAP = 30;
const BADGE_COLOR = '#e53935';

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
  checkChannels();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_INTERVAL_MINUTES });
  checkChannels();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkChannels();
});

// newtab.js mirrors its channel list and API key here on every save/load, since this
// service worker can't read newtab.js's localStorage directly. React to either so a
// freshly-set API key gets used on the next check instead of waiting up to 15 min.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && (changes[CHANNELS_MIRROR_KEY] || changes[YOUTUBE_API_KEY_MIRROR_KEY])) {
    checkChannels();
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  const videoId = notificationId.startsWith('favorite-video-')
    ? notificationId.slice('favorite-video-'.length)
    : null;
  if (videoId) {
    chrome.tabs.create({ url: `https://www.youtube.com/watch?v=${videoId}` });
  }
  chrome.notifications.clear(notificationId);
});

function decodeXmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Service workers have no DOMParser, so entries are pulled out with regex instead
// of the DOM-based parseRssFeed() newtab.js uses for the same feeds.
function parseFeedEntries(xmlText, channel) {
  const entries = [];
  const entryBlocks = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  entryBlocks.forEach(entryXml => {
    const videoId = entryXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
    const title = entryXml.match(/<title>(.*?)<\/title>/)?.[1];
    const published = entryXml.match(/<published>(.*?)<\/published>/)?.[1];
    if (!videoId || !title || !published) return;

    entries.push({
      id: { kind: 'youtube#video', videoId },
      snippet: {
        publishedAt: published,
        title: decodeXmlEntities(title),
        channelTitle: channel.name,
        channelId: channel.id,
        thumbnails: {
          medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` }
        }
      }
    });
  });

  return entries;
}

// RSS/Atom feeds don't carry duration, same limitation as newtab.js's attachVideoDurations
// (see AGENTS.md §7b) — fetched separately via the YouTube Data API, only for today's videos
// (not every entry from every channel) to keep quota usage down.
async function attachVideoDurations(videos, apiKey) {
  for (let i = 0; i < videos.length; i += DURATION_BATCH_SIZE) {
    const batch = videos.slice(i, i + DURATION_BATCH_SIZE);
    const ids = batch.map(video => video.id.videoId).join(',');

    try {
      const params = new URLSearchParams({ part: 'contentDetails', id: ids, key: apiKey });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      if (!response.ok) {
        console.warn(`Background duration fetch failed with status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const durationById = new Map((data.items || []).map(item => [item.id, item.contentDetails?.duration]));
      batch.forEach(video => {
        const duration = durationById.get(video.id.videoId);
        if (duration) {
          video.contentDetails = { duration };
        }
      });
    } catch (error) {
      console.warn('Background duration fetch failed:', error);
    }
  }
}

async function fetchChannelEntries(channel) {
  try {
    const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`);
    if (!response.ok) return [];
    const text = await response.text();
    return parseFeedEntries(text, channel);
  } catch (error) {
    console.warn(`Background feed check failed for ${channel.name}:`, error);
    return [];
  }
}

function isToday(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
}

// Notifies only for favorite channels, and only for videos not seen on a prior check.
// A channel's first-ever check seeds its seen list without notifying, so favoriting a
// channel (or installing the extension) doesn't trigger a flood of notifications for
// its existing back catalog.
async function notifyNewFavoriteVideos(enabledChannels, entriesByChannel) {
  const { [SEEN_VIDEO_IDS_KEY]: storedSeenIds } = await chrome.storage.local.get(SEEN_VIDEO_IDS_KEY);
  const seenByChannel = storedSeenIds && typeof storedSeenIds === 'object' ? { ...storedSeenIds } : {};

  enabledChannels.forEach((channel, index) => {
    if (channel.favorite !== true) return;
    const entries = entriesByChannel[index];
    if (!entries || entries.length === 0) return;

    const previouslySeen = seenByChannel[channel.id];
    const isFirstCheck = !Array.isArray(previouslySeen);
    const seenSet = new Set(previouslySeen || []);

    entries.forEach(video => {
      const videoId = video.id.videoId;
      if (seenSet.has(videoId) || isFirstCheck) return;

      chrome.notifications.create(`favorite-video-${videoId}`, {
        type: 'basic',
        iconUrl: video.snippet.thumbnails.medium.url,
        title: `New video from ${channel.name}`,
        message: video.snippet.title,
        priority: 1
      });
    });

    seenByChannel[channel.id] = Array.from(new Set([...entries.map(v => v.id.videoId), ...seenSet]))
      .slice(0, SEEN_IDS_PER_CHANNEL_CAP);
  });

  await chrome.storage.local.set({ [SEEN_VIDEO_IDS_KEY]: seenByChannel });
}

async function checkChannels() {
  const { [CHANNELS_MIRROR_KEY]: channels } = await chrome.storage.local.get(CHANNELS_MIRROR_KEY);
  if (!Array.isArray(channels) || channels.length === 0) return;

  const enabledChannels = channels.filter(c => c.enabled !== false);
  if (enabledChannels.length === 0) {
    await chrome.storage.local.set({ [TODAY_VIDEOS_KEY]: [] });
    updateBadge(0);
    return;
  }

  const entriesByChannel = await Promise.all(enabledChannels.map(fetchChannelEntries));
  const allEntries = entriesByChannel.flat();

  const todayVideos = allEntries
    .filter(video => isToday(video.snippet.publishedAt))
    .sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));
  const uniqueTodayVideos = Array.from(new Map(todayVideos.map(v => [v.id.videoId, v])).values());

  const { [YOUTUBE_API_KEY_MIRROR_KEY]: apiKey } = await chrome.storage.local.get(YOUTUBE_API_KEY_MIRROR_KEY);
  if (apiKey) {
    await attachVideoDurations(uniqueTodayVideos, apiKey);
  }

  await chrome.storage.local.set({ [TODAY_VIDEOS_KEY]: uniqueTodayVideos });
  updateBadge(uniqueTodayVideos.length);

  await notifyNewFavoriteVideos(enabledChannels, entriesByChannel);
}
