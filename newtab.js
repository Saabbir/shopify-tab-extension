const CACHE_KEY = 'youtube_dev_feed_cache';
const CACHE_TIME_KEY = 'youtube_dev_feed_cache_time';
const CACHE_TTL = 3600 * 1000;
const AUTO_REFRESH_INTERVAL = 3600 * 1000; // 1 hour
let refreshInterval = null;
const MIN_VIDEOS = 20;
const MAX_VIDEOS = 40;
const QUERY = 'shopify development tutorial, shopify app development, shopify theme development, shopify store setup, shopify coding OR Shopify app development';
const MAX_RESULTS_PER_PAGE = 50;
const YOUTUBE_API_KEY = 'AIzaSyCSPWFb99cdOxw_4JHoSOcUs6OTIunDRDY';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  
  refreshBtn.addEventListener('click', () => {
    // Clear existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    // Clear cache and fetch fresh data
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    fetchVideos();
    
    // Start new interval
    refreshInterval = setInterval(fetchVideos, AUTO_REFRESH_INTERVAL);
  });

  // Start initial fetch and interval
  fetchVideos();
  refreshInterval = setInterval(fetchVideos, AUTO_REFRESH_INTERVAL);
});

async function fetchVideos() {
  const now = Date.now();
  console.log('Fetching videos at:', new Date(now));
  
  // Clear cache when fetching fresh data
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIME_KEY);

  // Fetch fresh data
  try {
    let videos = [];
    let pageToken;

    // Fetch videos from the last 10 days
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    console.log('Fetching videos from:', tenDaysAgo.toISOString());
    
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: MAX_RESULTS_PER_PAGE,
      q: QUERY,
      publishedAfter: tenDaysAgo.toISOString(),
      key: YOUTUBE_API_KEY
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'Failed to fetch videos');
    }

    if (data.items) {
      videos.push(...data.items);
      console.log('Fetched videos:', videos.length);
    }
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

      if (nextPageData.items) {
        videos.push(...nextPageData.items);
        console.log('Fetched additional videos:', videos.length);
      }
      pageToken = nextPageData.nextPageToken;
    }

    // Filter out any videos older than 10 days
    const tenDaysAgoDate = new Date(tenDaysAgo);
    videos = videos.filter(video => 
      new Date(video.snippet.publishedAt) >= tenDaysAgoDate
    );
    console.log('Filtered videos:', videos.length);

    // Get additional details for each video
    const videoIds = videos.map(video => video.id.videoId).join(',');
    const detailsParams = new URLSearchParams({
      part: 'contentDetails,statistics',
      id: videoIds,
      key: YOUTUBE_API_KEY
    });

    const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`);
    const detailsData = await detailsRes.json();

    if (!detailsRes.ok || detailsData.error) {
      throw new Error(detailsData.error?.message || 'Failed to fetch video details');
    }

    // Combine the data
    videos = videos.map(video => {
      const details = detailsData.items.find(item => item.id === video.id.videoId);
      return {
        ...video,
        statistics: details?.statistics || {},
        contentDetails: details?.contentDetails || {}
      };
    });

    videos = videos.slice(0, MAX_VIDEOS);
    videos.sort((a, b) => new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt));
    
    // Store in cache
    localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
    localStorage.setItem(CACHE_TIME_KEY, now.toString());
    displayVideos(videos);

  } catch (error) {
    console.error('Error fetching videos:', error);
    displayError(`Failed to fetch videos: ${error.message}`);
  }

  try {
    let videos = [];
    let pageToken;

    // Fetch videos from the last 10 days
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    console.log('Fetching videos from:', tenDaysAgo.toISOString());
    
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: MAX_RESULTS_PER_PAGE,
      q: QUERY,
      publishedAfter: tenDaysAgo.toISOString(),
      key: YOUTUBE_API_KEY
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error?.message || 'Failed to fetch videos');
    }

    if (data.items) {
      videos.push(...data.items);
      console.log('Fetched videos:', videos.length);
    }
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

      if (nextPageData.items) {
        videos.push(...nextPageData.items);
        console.log('Fetched additional videos:', videos.length);
      }
      pageToken = nextPageData.nextPageToken;
    }

    // Filter out any videos older than 10 days
    const tenDaysAgoDate = new Date(tenDaysAgo);
    videos = videos.filter(video => 
      new Date(video.snippet.publishedAt) >= tenDaysAgoDate
    );
    console.log('Filtered videos:', videos.length);

    // Get additional details for each video
    const videoIds = videos.map(video => video.id.videoId).join(',');
    const detailsParams = new URLSearchParams({
      part: 'contentDetails,statistics',
      id: videoIds,
      key: YOUTUBE_API_KEY
    });

    const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`);
    const detailsData = await detailsRes.json();

    if (!detailsRes.ok || detailsData.error) {
      throw new Error(detailsData.error?.message || 'Failed to fetch video details');
    }

    // Combine the data
    videos = videos.map(video => {
      const details = detailsData.items.find(item => item.id === video.id.videoId);
      return {
        ...video,
        statistics: details?.statistics || {},
        contentDetails: details?.contentDetails || {}
      };
    });

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

function formatViews(views) {
  if (!views) return '0 views';
  const number = parseInt(views);
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + 'M views';
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'K views';
  }
  return number + ' views';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

function displayVideos(videos) {
  document.getElementById('loading').style.display = 'none';
  const errorMessage = document.getElementById('error-message');
  errorMessage.style.display = 'none';
  
  const container = document.getElementById('videos-container');
  container.innerHTML = '';

  // Group videos by date
  const videosByDate = {};
  videos.forEach(video => {
    const date = formatDate(video.snippet.publishedAt, true);
    if (!videosByDate[date]) {
      videosByDate[date] = [];
    }
    videosByDate[date].push(video);
  });

  // Sort dates in descending order
  const sortedDates = Object.keys(videosByDate).sort((a, b) => {
    return new Date(b) - new Date(a);
  });

  // Create sections for each date
  sortedDates.forEach(date => {
    const section = document.createElement('div');
    section.className = 'date-section';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'date-section-header';
    header.innerHTML = `
      <h2 class="date-section-title">${date}</h2>
      <span class="date-section-count">${videosByDate[date].length} videos</span>
    `;
    section.appendChild(header);

    // Create grid for videos
    const grid = document.createElement('div');
    grid.className = 'date-section-grid';
    
    // Add videos
    videosByDate[date].forEach(video => {
      const card = document.createElement('div');
      card.className = 'video-card';
      card.innerHTML = `
        <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank">
          <img class="thumbnail" src="${video.snippet.thumbnails.medium.url}" alt="thumbnail">
          ${video.contentDetails?.duration ? `<div class="video-duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
          <div class="video-info">
            <p class="video-title">${video.snippet.title}</p>
            <p class="channel-title">${video.snippet.channelTitle}</p>
            ${video.snippet.description ? `<p class="video-description">${video.snippet.description}</p>` : ''}
          </div>
        </a>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// Update formatDate to format for grouping
function formatDate(dateString, forGrouping = false) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const fullDate = date.toLocaleDateString('en-US', options);
  
  if (forGrouping) {
    // Format for grouping (e.g., "May 21, 2025")
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  
  return fullDate;
}