const CACHE_KEY = 'youtube_dev_feed_cache';
const CACHE_TIME_KEY = 'youtube_dev_feed_cache_time';
const CACHE_TTL = 3600 * 1000;
const MIN_VIDEOS = 20;
const MAX_VIDEOS = 40;
const QUERY = 'Shopify theme development OR Shopify app development';
const MAX_RESULTS_PER_PAGE = 50;
const YOUTUBE_API_KEY = 'AIzaSyCSPWFb99cdOxw_4JHoSOcUs6OTIunDRDY';

document.addEventListener('DOMContentLoaded', () => {
  fetchVideos();
});

async function fetchVideos() {
  const now = Date.now();
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);

  if (cached && cachedTime && now - cachedTime < CACHE_TTL) {
    displayVideos(JSON.parse(cached));
    return;
  }

  try {
    let videos = [];
    let pageToken;

    // First fetch videos from last week
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: MAX_RESULTS_PER_PAGE,
      q: QUERY,
      publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      key: YOUTUBE_API_KEY
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'Failed to fetch videos');
    }

    if (data.items) videos.push(...data.items);
    pageToken = data.nextPageToken;

    // Fetch additional pages if needed
    while (videos.length < MAX_VIDEOS && pageToken) {
      const nextPageParams = new URLSearchParams(params);
      nextPageParams.set('pageToken', pageToken);
      
      const nextPageRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${nextPageParams.toString()}`);
      const nextPageData = await nextPageRes.json();

      if (!nextPageRes.ok || nextPageData.error) {
        throw new Error(nextPageData.error?.message || 'Failed to fetch additional videos');
      }

      if (nextPageData.items) videos.push(...nextPageData.items);
      pageToken = nextPageData.nextPageToken;
    }

    // If we still don't have enough videos, fetch older ones without date restriction
    if (videos.length < MIN_VIDEOS) {
      const olderParams = new URLSearchParams({
        part: 'snippet',
        type: 'video',
        order: 'date',
        maxResults: MAX_RESULTS_PER_PAGE,
        q: QUERY,
        key: YOUTUBE_API_KEY
      });

      const olderRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${olderParams.toString()}`);
      const olderData = await olderRes.json();

      if (!olderRes.ok || olderData.error) {
        throw new Error(olderData.error?.message || 'Failed to fetch older videos');
      }

      if (olderData.items) videos.push(...olderData.items);
    }

    videos = videos.slice(0, MAX_VIDEOS);
    videos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
    localStorage.setItem(CACHE_TIME_KEY, now.toString());
    displayVideos(videos);

  } catch (error) {
    console.error('Error fetching videos:', error);
    displayError(`Failed to fetch videos: ${error.message}`);
  }
}

function displayError(message) {
  document.getElementById('loading').style.display = 'none';
  const errorMessage = document.getElementById('error-message');
  errorMessage.style.display = 'block';
  errorMessage.textContent = message;
}

function displayVideos(videos) {
  document.getElementById('loading').style.display = 'none';
  const errorMessage = document.getElementById('error-message');
  errorMessage.style.display = 'none';
  
  const container = document.getElementById('videos-container');
  container.innerHTML = '';
  videos.forEach(video => {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank">
        <img class="thumbnail" src="${video.snippet.thumbnails.medium.url}" alt="thumbnail">
        <div class="video-info">
          <p class="video-title">${video.snippet.title}</p>
          <p class="channel-title">${video.snippet.channelTitle}</p>
        </div>
      </a>
    `;
    container.appendChild(card);
  });
}