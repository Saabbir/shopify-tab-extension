// CONFIGURATION
const CACHE_KEY = 'shopify_videos_cache';
const CACHE_TIMESTAMP_KEY = 'shopify_videos_timestamp';
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds
const AUTO_REFRESH_INTERVAL = 3600 * 1000; // 1 hour
let refreshInterval = null;
let isRefreshing = false;
let currentVideos = [];
const MAX_VIDEOS = 100;
import channelsData from './channels.js';
const { CHANNELS, BLOCKED_CHANNELS, FALLBACK_CHANNELS } = channelsData;

// Search terms to look for in video titles for relevance
const RELEVANCE_TERMS = [
  'shopify',
  'ecommerce',
  'store',
  'theme',
  'development',
  'app',
  'tutorial',
  'guide',
  'api',
  'liquid',
  'hydrogen',
  'checkout',
  'headless',
  'commerce'
];

/**
 * Check if cache is valid (exists and not expired)
 */
function isCacheValid() {
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return false;
  
  const age = Date.now() - parseInt(timestamp);
  const minutes = Math.floor(age / 60000);
  console.log(`Cache status: ${age < CACHE_DURATION ? 'Valid' : 'Expired'} (${minutes} minutes old)`);
  
  return age < CACHE_DURATION;
}

/**
 * Save videos to cache
 */
function saveToCache(videos) {
  try {
    const cacheData = {
      videos,
      timestamp: Date.now()
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, cacheData.timestamp.toString());
    console.log(`Saved ${videos.length} videos to cache at ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('Error saving to cache:', error);
    // If saving fails (e.g., quota exceeded), clear cache to make room
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }
}

/**
 * Clear the video cache
 */
function clearCache() {
  console.log('Clearing cache...');
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

/**
 * Get videos from cache
 */
function getFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    const videos = Array.isArray(cacheData) ? cacheData : cacheData.videos;
    
    if (!videos || !Array.isArray(videos)) {
      console.log('Invalid cache format, ignoring');
      return null;
    }
    
    console.log(`Retrieved ${videos.length} videos from cache`);
    return videos;
  } catch (error) {
    console.error('Error getting from cache:', error);
    return null;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI elements
  const refreshBtn = document.getElementById('refresh-btn');
  const videoContainer = document.getElementById('videos-container');
  const loading = document.getElementById('loading');
  const categoryFilter = document.getElementById('category-filter');
  
  // Get all unique categories from channels
  const allCategories = [...new Set([...CHANNELS, ...FALLBACK_CHANNELS]
    .map(c => c.category)
    .filter(Boolean))]; // Remove any undefined categories
  
  // Update category filter options
  const categorySelect = document.getElementById('category-filter');
  categorySelect.innerHTML = ''; // Clear existing options
  
  // Add 'All Categories' option
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Categories';
  categorySelect.appendChild(allOption);
  
  // Add category options
  allCategories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    categorySelect.appendChild(option);
  });
  
  // Set default selected category to 'shopify' if available, otherwise use saved or first category
  const defaultCategory = allCategories.includes('shopify') ? 'shopify' : (allCategories[0] || 'all');
  const savedCategory = localStorage.getItem('selectedCategory');
  categorySelect.value = savedCategory || defaultCategory;
  
  // Add event listener for category filter changes
  categoryFilter.addEventListener('change', async () => {
    const selectedCategory = categoryFilter.value;
    localStorage.setItem('selectedCategory', selectedCategory);
    
    // Clear the current videos and show loading
    currentVideos = [];
    if (videoContainer) videoContainer.innerHTML = '';
    if (loading) loading.style.display = 'block';
    
    try {
      // Fetch fresh videos for the selected category
      await fetchFreshVideos();
    } catch (error) {
      console.error('Error changing category:', error);
      displayError('Failed to load videos for the selected category');
    }
  });

  /**
   * Fetch fresh videos and update cache
   */
  async function fetchFreshVideos() {
    try {
      // Show loading state
      if (loading) loading.style.display = 'block';
      if (videoContainer) videoContainer.innerHTML = '';
      
      // Get the selected category
      const selectedCategory = categorySelect.value;
      console.log(`Fetching videos for category: ${selectedCategory}`);
      
      // Fetch fresh data with the selected category
      const videos = await getAllVideos(selectedCategory === 'all' ? null : selectedCategory);
      currentVideos = videos;
      
      // Save to cache with category info
      saveToCache({
        videos,
        category: selectedCategory,
        timestamp: Date.now()
      });
      
      // Display the videos
      displayVideos(currentVideos);
      
      console.log(`Successfully loaded ${currentVideos.length} fresh videos for category: ${selectedCategory}`);
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
  refreshBtn.addEventListener('click', () => {
    // Clear cache first, then force a refresh
    clearCache();
    loadVideos(true);
  });

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
 * Get videos from YouTube using RSS feeds (no API key required)
 * @param {string} [category] - Optional category to filter channels by
 */
async function getAllVideos(category) {
  // Filter channels by category if specified
  const channelsToFetch = category 
    ? CHANNELS.filter(channel => channel.category === category)
    : CHANNELS;
    
  console.log(`Fetching videos for ${category || 'all'} categories (${channelsToFetch.length} channels)`);
  console.log('Fetching videos:', new Date());
  
  // First check if we can use cache
  if (isCacheValid()) {
    const cachedData = getFromCache();
    if (cachedData && cachedData.length > 0) {
      console.log(`Using ${cachedData.length} cached videos`);
      return cachedData;
    }
  }
  
  try {
    // Collect videos from all channel RSS feeds
    
    // Function to fetch RSS feed from a channel
    async function fetchChannelFeed(channel) {
      try {
        console.log(`Fetching RSS feed for ${channel.name} (${channel.id})...`);
        
        // Define all possible RSS feed URL formats to try
        const urlFormats = [
          // Standard channel_id format
          `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`,
          
          // Handle format if available
          channel.handle ? `https://www.youtube.com/feeds/videos.xml?user=${channel.handle}` : null,
          
          // Channel URL format
          `https://www.youtube.com/channel/${channel.id}/feed/atom`,
          
          // Legacy username format
          channel.handle ? `https://www.youtube.com/feeds/videos.xml?user=${channel.handle.toLowerCase()}` : null
        ].filter(Boolean); // Remove null entries
        
        let response = null;
        let successUrl = null;
        
        // Try each URL format until one works
        for (const url of urlFormats) {
          try {
            console.log(`Trying URL: ${url}`);
            response = await fetch(url);
            
            if (response.ok) {
              successUrl = url;
              console.log(`Success with URL: ${url}`);
              break;
            }
          } catch (urlError) {
            console.warn(`Error with URL ${url}:`, urlError.message);
            // Continue to next URL format
          }
        }
        
        // If none worked, throw error
        if (!response || !response.ok) {
          console.error(`All RSS feed formats failed for ${channel.name}`);
          throw new Error(`Could not fetch RSS feed for ${channel.name}`);
        }
        
        const text = await response.text();
        console.log(`Successfully fetched feed for ${channel.name} (${successUrl})`);
        return parseRssFeed(text, channel.name, channel.id);
      } catch (error) {
        console.error(`Error fetching channel ${channel.name}:`, error);
        return [];
      }
    }
    
    // Function to parse XML RSS feed
    function parseRssFeed(xmlText, channelName, channelId) {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const entries = xmlDoc.querySelectorAll('entry');
        
        console.log(`Parsing ${entries.length} videos from ${channelName}`);
        
        const videos = [];
        entries.forEach(entry => {
          try {
            // Helper function to handle different namespace variations
            function getElementContent(parent, tagName) {
              // Try different namespace variations
              const selectors = [
                tagName,
                `yt\\:${tagName}`,
                `media\\:${tagName}`,
                `*|${tagName}`
              ];
              
              for (const selector of selectors) {
                const element = parent.querySelector(selector);
                if (element?.textContent) {
                  return element.textContent;
                }
              }
              return '';
            }
            
            // Get video information from RSS entry
            const videoId = getElementContent(entry, 'videoId');
            if (!videoId) return;
            
            const title = getElementContent(entry, 'title');
            const published = getElementContent(entry, 'published');
            const updated = getElementContent(entry, 'updated');
            const link = entry.querySelector('link')?.getAttribute('href') || '';
            const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
            
            // Only include relevant videos
            if (isRelevantVideo(title)) {
              videos.push({
                id: { kind: 'youtube#video', videoId },
                snippet: {
                  publishedAt: published,
                  title,
                  description: entry.querySelector('media\\:description')?.textContent || 
                              entry.querySelector('content')?.textContent || '',
                  thumbnails: {
                    default: { url: thumbnailUrl.replace('mqdefault', 'default') },
                    medium: { url: thumbnailUrl },
                    high: { url: thumbnailUrl.replace('mqdefault', 'hqdefault') }
                  },
                  channelTitle: channelName,
                  channelId: channelId, // Use the provided channel ID
                  channelHandle: channelName
                }
              });
            }
          } catch (entryError) {
            console.warn('Error processing an entry:', entryError);
            // Continue with other entries
          }
        });
        
        return videos;
      } catch (parseError) {
        console.error('Error parsing RSS feed:', parseError);
        return [];
      }
    }
    
    // Function to check if video is relevant based on title
    function isRelevantVideo(title) {
      title = title.toLowerCase();
      // For now, disable relevance filtering to see all videos
      return true;
      // Uncomment this later once we fix the feed issues
      // return RELEVANCE_TERMS.some(term => title.includes(term.toLowerCase()));
    }
    
    // Fetch from filtered channels in parallel
    const allVideosPromises = channelsToFetch.map(channel => fetchChannelFeed(channel));
    const allVideosArrays = await Promise.all(allVideosPromises);
    
    // Debug which channels returned videos
    allVideosArrays.forEach((videos, index) => {
      console.log(`Channel ${channelsToFetch[index].name}: ${videos.length} videos`);
    });
    
    // Combine all videos
    let allVideos = allVideosArrays.flat();
    console.log(`Total videos from filtered channels: ${allVideos.length}`);
    
    // If no category filter or too few videos found, try fallback channels
    if (!category || (allVideos.length < 5 && category !== 'all')) {
      console.log('Not enough videos found from main channels, trying fallback channels...');
      const fallbackPromises = FALLBACK_CHANNELS.map(channel => fetchChannelFeed(channel));
      const fallbackArrays = await Promise.all(fallbackPromises);
      
      // Log results from fallback channels
      fallbackArrays.forEach((videos, index) => {
        console.log(`Fallback Channel ${FALLBACK_CHANNELS[index].name}: ${videos.length} videos`);
      });
      
      const fallbackVideos = fallbackArrays.flat();
      allVideos = allVideos.concat(fallbackVideos);
      console.log(`Total videos after fallbacks: ${allVideos.length}`);
    }
    
    // If still not enough videos, try search query
    if (allVideos.length < 5) {
      console.log('Still not enough videos, trying search...');
      const searchVideos = await searchShopifyVideos();
      console.log(`Search found ${searchVideos.length} videos`);
      allVideos = allVideos.concat(searchVideos);
    }
    
    // Filter out blocked channels
    const filteredVideos = allVideos.filter(video => {
      if (BLOCKED_CHANNELS.includes(video.snippet?.channelTitle)) {
        console.log(`Filtered out video from blocked channel: ${video.snippet.channelTitle}`);
        return false;
      }
      return true;
    });
    
    // Sort by date (newest first)
    const sortedVideos = filteredVideos.sort((a, b) => {
      return new Date(b.snippet.publishedAt) - new Date(a.snippet.publishedAt);
    });
    
    // Limit to MAX_VIDEOS
    const finalVideos = sortedVideos.slice(0, MAX_VIDEOS);
    
    // Save to cache for future use
    saveToCache(finalVideos);
    
    console.log(`Final video count: ${finalVideos.length}`);
    return finalVideos;
  } catch (error) {
    console.error('Error fetching videos:', error);
    
    // Try to use cache even if it's expired in case of errors
    const cachedData = getFromCache();
    if (cachedData && cachedData.length > 0) {
      console.log(`Using ${cachedData.length} cached videos as fallback after error`);
      return cachedData;
    }
    
    return [];
  }
}

/**
 * Filter videos by channel subscriber count
 * Only keeps videos from channels with at least MIN_SUBSCRIBER_COUNT subscribers
 */
async function filterBySubscriberCount(videos, timestamp, randomId) {
  if (!videos || videos.length === 0) return [];
  
  try {
    // Get unique channel IDs
    const channelIds = [...new Set(videos.map(video => video.snippet.channelId))];
    
    // Create a map to store subscriber counts
    const subscriberCounts = {};
    
    // Process channels in batches to avoid exceeding API quota
    const BATCH_SIZE = 50;
    for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
      const batchIds = channelIds.slice(i, i + BATCH_SIZE);
      const batchIdString = batchIds.join(',');
      
      // Create params for channel details
      const params = new URLSearchParams({
        part: 'statistics',
        id: batchIdString,
        key: YOUTUBE_API_KEY,
        _: timestamp + randomId + 'channels' // Cache busting
      });
      
      // Make the API request
      const response = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Channel details fetch failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store subscriber counts
      if (data.items && data.items.length > 0) {
        data.items.forEach(channel => {
          subscriberCounts[channel.id] = parseInt(channel.statistics.subscriberCount || '0', 10);
        });
      }
    }
    
    // Filter videos by subscriber count
    return videos.filter(video => {
      const channelId = video.snippet.channelId;
      const subscribers = subscriberCounts[channelId] || 0;
      
      // Include if it meets the minimum subscriber threshold
      const meetsThreshold = subscribers >= MIN_SUBSCRIBER_COUNT;
      
      if (!meetsThreshold) {
        console.log(`Filtered out video from channel ${video.snippet.channelTitle} with only ${subscribers} subscribers`);
      }
      
      return meetsThreshold;
    });
  } catch (error) {
    console.error('Error filtering by subscriber count:', error);
    return videos; // Return original videos if there's an error
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
      
      // Only show duration if it exists
      const durationElement = video.contentDetails?.duration 
        ? `<div class="video-duration">${formatDuration(video.contentDetails.duration)}</div>` 
        : '';
      
      card.innerHTML = `
        <a href="https://www.youtube.com/watch?v=${video.id.videoId}" target="_blank">
          <div class="thumbnail-container">
            <img class="thumbnail" src="${video.snippet.thumbnails.medium.url}" alt="thumbnail">
            ${durationElement}
          </div>
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