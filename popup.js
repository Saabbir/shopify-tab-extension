const TODAY_VIDEOS_KEY = 'shopify_today_videos';

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Duplicated from newtab.js's formatDuration() rather than shared, same as the
// feed-parsing duplication noted in AGENTS.md §8 — popup.js is a plain script,
// not a module, so it has no import from newtab.js.
function formatDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '';
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function renderVideos(videos) {
  const list = document.getElementById('popup-list');
  const empty = document.getElementById('popup-empty');
  const count = document.getElementById('popup-count');

  count.textContent = String(videos.length);
  list.innerHTML = '';

  if (videos.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  videos.forEach(video => {
    const item = document.createElement('a');
    item.className = 'popup-video';
    item.href = `https://www.youtube.com/watch?v=${video.id.videoId}`;
    item.target = '_blank';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'popup-thumbnail-container';

    const thumb = document.createElement('img');
    thumb.className = 'popup-thumbnail';
    thumb.src = video.snippet.thumbnails.medium.url;
    thumb.alt = '';
    thumbWrap.appendChild(thumb);

    if (video.contentDetails?.duration) {
      const duration = document.createElement('span');
      duration.className = 'popup-video-duration';
      duration.textContent = formatDuration(video.contentDetails.duration);
      thumbWrap.appendChild(duration);
    }

    const info = document.createElement('div');
    info.className = 'popup-video-info';

    const title = document.createElement('p');
    title.className = 'popup-video-title';
    title.textContent = video.snippet.title;

    const meta = document.createElement('p');
    meta.className = 'popup-video-meta';
    meta.textContent = `${video.snippet.channelTitle} · ${formatTime(video.snippet.publishedAt)}`;

    info.appendChild(title);
    info.appendChild(meta);
    item.appendChild(thumbWrap);
    item.appendChild(info);
    list.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(TODAY_VIDEOS_KEY, (result) => {
    const videos = result[TODAY_VIDEOS_KEY];
    renderVideos(Array.isArray(videos) ? videos : []);
  });

  document.getElementById('popup-open-newtab-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'newtab.html' });
  });
});
