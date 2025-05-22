// CONFIGURATION
const CACHE_KEY = 'shopify_videos_cache';
const CACHE_TIMESTAMP_KEY = 'shopify_videos_timestamp';
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds
const AUTO_REFRESH_INTERVAL = 3600 * 1000; // 1 hour
let refreshInterval = null;
let isRefreshing = false;
let currentVideos = [];
const MAX_VIDEOS = 100;

// YouTube API Key
const YOUTUBE_API_KEY = 'AIzaSyCSPWFb99cdOxw_4JHoSOcUs6OTIunDRDY';

// Popular Shopify YouTube Channels - IDs for direct channel search
const POPULAR_CHANNELS = [
  'UC5c9DwxnTqjkKd9mFfY_mYQ', // Shopify
  'UCcws4iale896nBbZ4aNUSGQ', // Shopify Partners
  'UCu5m5NKfsf_b1MeG25_fxRw', // Elliot Forbes
  'UCTqf_EcB9k0raKDkk4MUv9w', // WPCrafter
  'UCYSa_YLoJokZAwHhlwJntIA', // Chase Reiner
  'UCMACiVI6ImFxA5doYUMCr7w', // Kish Vasnani
  'UCQ5j-ZTdJ5VRGZPfGDYiHcA', // Code With Dary
];

// Direct search queries for latest videos
const DIRECT_QUERIES = [
  'latest shopify development',
  'new shopify store tutorial 2025',
  'shopify API tutorial',
  'shopify theme development',
  'shopify liquid tutorial',
  'shopify headless commerce',
  'shopify hydrogen framework'
];

// Regions to prioritize
const PRIORITY_REGIONS = ['US', 'CA', 'GB', 'DE', 'FR', 'AU'];

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI elements
  const refreshBtn = document.getElementById('refresh-btn');
  const videoContainer = document.getElementById('videos-container');
  const loading = document.getElementById('loading');

  /**
   * Check if cache is valid (exists and not expired)
   */
  function isCacheValid() {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return false;
    
    const cachedTime = parseInt(timestamp, 10);
    const now = Date.now();
    const isValid = now - cachedTime < CACHE_DURATION;
    
    console.log(`Cache status: ${isValid ? 'Valid' : 'Expired'} (${Math.round((now - cachedTime) / 60000)} minutes old)`);
    return isValid;
  }
  
  /**
   * Save videos to cache
   */
  function saveToCache(videos) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(videos));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      console.log(`Saved ${videos.length} videos to cache at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('Error saving to cache:', error);
      // If saving fails (e.g., quota exceeded), clear cache to make room
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }
  }
  
  /**
   * Get videos from cache
   */
  function getFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const videos = JSON.parse(cached);
      console.log(`Retrieved ${videos.length} videos from cache`);
      return videos;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Fetch fresh videos and update cache
   */
  async function fetchFreshVideos() {
    try {
      // Show loading state
      if (loading) loading.style.display = 'block';
      if (videoContainer) videoContainer.innerHTML = '';
      
      // Fetch fresh data
      const videos = await getAllVideos();
      currentVideos = videos;
      
      // Save to cache
      saveToCache(videos);
      
      // Display the videos
      displayVideos(currentVideos);
      
      console.log(`Successfully loaded ${currentVideos.length} fresh videos`);
      return true;
    } catch (error) {
      console.error('Error fetching videos:', error);
      displayError(`Failed to fetch videos: ${error.message}`);
      return false;
    } finally {
      if (loading) loading.style.display = 'none';
    }
  }
  
  /**
   * Display videos from cache or fetch fresh ones
   */
  async function loadVideos(forceRefresh = false) {
    if (isRefreshing) return false;
    isRefreshing = true;
    
    try {
      // Check if we can use cache
      if (!forceRefresh && isCacheValid()) {
        const cachedVideos = getFromCache();
        if (cachedVideos && cachedVideos.length > 0) {
          currentVideos = cachedVideos;
          displayVideos(currentVideos);
          console.log('Using cached videos');
          return true;
        }
      }
      
      // If no valid cache or forced refresh, fetch fresh data
      return await fetchFreshVideos();
    } finally {
      isRefreshing = false;
    }
  }
  
  // Handle refresh button click - force refresh
  refreshBtn.addEventListener('click', () => loadVideos(true));

  // Initial load - use cache if available
  await loadVideos(false);
  
  // Set up auto-refresh when cache expires
  refreshInterval = setInterval(async () => {
    // Only refresh if cache is expired
    if (!isCacheValid() && !isRefreshing) {
      await loadVideos(true);
    }
  }, 60000); // Check every minute if cache needs refresh
});

/**
 * Get videos from multiple sources using a completely new approach
 * This uses parallel fetching from multiple sources to ensure fresh content
 */
async function getAllVideos() {
  console.log('Fetching fresh videos from multiple sources:', new Date());
  
  try {
    // Generate a timestamp for cache busting
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    
    // Use Promise.all to fetch from multiple sources in parallel
    const allVideoPromises = [
      // 1. Get videos from popular Shopify channels
      getVideosFromChannels(POPULAR_CHANNELS, timestamp, randomId),
      
      // 2. Get videos from direct search queries
      getVideosFromQueries(DIRECT_QUERIES, timestamp, randomId),
      
      // 3. Get videos specifically containing the example video ID
      getSpecificVideo('MACgGUEOPSg', timestamp, randomId)
    ];
    
    // Wait for all promises to resolve
    const results = await Promise.all(allVideoPromises);
    
    // Combine all results and remove duplicates
    let allVideos = [];
    results.forEach(videos => {
      if (videos && videos.length) {
        allVideos = [...allVideos, ...videos];
      }
    });
    
    console.log(`Fetched a total of ${allVideos.length} videos from all sources`);
    
    // Remove duplicates by videoId
    const uniqueVideos = removeDuplicateVideos(allVideos);
    console.log(`After removing duplicates: ${uniqueVideos.length} unique videos`);
    
    // Sort by date (newest first)
    const sortedVideos = uniqueVideos.sort((a, b) => {
      return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
    });
    
    // Limit to MAX_VIDEOS
    const finalVideos = sortedVideos.slice(0, MAX_VIDEOS);
    
    // Log the dates of the first 5 videos
    console.log('First 5 video dates:');
    finalVideos.slice(0, 5).forEach((video, index) => {
      console.log(`${index + 1}. ${video.snippet.title} - ${new Date(video.snippet.publishedAt)}`);
    });
    
    return finalVideos;
  } catch (error) {
    console.error('Error in getAllVideos:', error);
    throw error; // Let the caller handle the error
  }
}

/**
 * Fetch videos from specific YouTube channels
 */
async function getVideosFromChannels(channelIds, timestamp, randomId) {
  try {
    // Create an array to hold all videos
    let allChannelVideos = [];
    
    // Process each channel in sequence
    for (const channelId of channelIds) {
      try {
        // Create search parameters
        const params = new URLSearchParams({
          part: 'snippet',
          channelId: channelId,
          maxResults: 15,
          order: 'date',
          type: 'video',
          key: YOUTUBE_API_KEY,
          _: timestamp + randomId + channelId // Cache busting
        });
        
        // Make the API request
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Channel search failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`Fetched ${data.items.length} videos from channel ${channelId}`);
          allChannelVideos = [...allChannelVideos, ...data.items];
        }
      } catch (channelError) {
        console.error(`Error fetching from channel ${channelId}:`, channelError);
        // Continue with other channels even if one fails
      }
    }
    
    // Enrich with video details
    return await enrichVideosWithDetails(allChannelVideos, timestamp, randomId);
  } catch (error) {
    console.error('Error in getVideosFromChannels:', error);
    return []; // Return empty array on error
  }
}

/**
 * Fetch videos from direct search queries
 */
async function getVideosFromQueries(queries, timestamp, randomId) {
  try {
    // Create an array to hold all videos
    let allQueryVideos = [];
    
    // Process each query in sequence
    for (const query of queries) {
      try {
        // Create search parameters for this query
        const params = new URLSearchParams({
          part: 'snippet',
          q: query,
          maxResults: 15,
          order: 'date', // Get newest first
          type: 'video',
          relevanceLanguage: 'en',
          regionCode: PRIORITY_REGIONS[0], // Use first priority region
          key: YOUTUBE_API_KEY,
          _: timestamp + randomId + encodeURIComponent(query) // Cache busting
        });
        
        // Make the API request
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Query search failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          console.log(`Fetched ${data.items.length} videos for query "${query}"`);
          allQueryVideos = [...allQueryVideos, ...data.items];
        }
      } catch (queryError) {
        console.error(`Error fetching for query "${query}":`, queryError);
        // Continue with other queries even if one fails
      }
    }
    
    // Enrich with video details
    return await enrichVideosWithDetails(allQueryVideos, timestamp, randomId);
  } catch (error) {
    console.error('Error in getVideosFromQueries:', error);
    return []; // Return empty array on error
  }
}

/**
 * Fetch a specific video by ID
 */
async function getSpecificVideo(videoId, timestamp, randomId) {
  try {
    // Create parameters for video details
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: videoId,
      key: YOUTUBE_API_KEY,
      _: timestamp + randomId + videoId // Cache busting
    });
    
    // Make the API request
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Specific video fetch failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      console.log(`Successfully fetched specific video: ${videoId}`);
      
      // Format the response to match the structure from search
      return data.items.map(item => ({
        ...item,
        id: { kind: 'youtube#video', videoId: item.id }
      }));
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching specific video ${videoId}:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Enrich videos with additional details like statistics and content details
 */
async function enrichVideosWithDetails(videos, timestamp, randomId) {
  if (!videos || videos.length === 0) {
    return [];
  }
  
  try {
    // Extract video IDs
    const videoIds = videos.map(video => video.id.videoId).join(',');
    
    // Create parameters for video details
    const params = new URLSearchParams({
      part: 'contentDetails,statistics',
      id: videoIds,
      key: YOUTUBE_API_KEY,
      _: timestamp + randomId + 'details' // Cache busting
    });
    
    // Make the API request
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Video details fetch failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return videos; // Return original videos if no details
    }
    
    // Combine the search results with the details
    return videos.map(video => {
      const details = data.items.find(item => item.id === video.id.videoId);
      return {
        ...video,
        statistics: details?.statistics || {},
        contentDetails: details?.contentDetails || {}
      };
    });
  } catch (error) {
    console.error('Error enriching videos with details:', error);
    return videos; // Return original videos on error
  }
}

/**
 * Remove duplicate videos by videoId
 */
function removeDuplicateVideos(videos) {
  const uniqueMap = new Map();
  
  // Use a Map to keep only the latest version of each video
  videos.forEach(video => {
    const videoId = video.id.videoId;
    uniqueMap.set(videoId, video);
  });
  
  // Convert back to array
  return Array.from(uniqueMap.values());
}

function displayError(message) {
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