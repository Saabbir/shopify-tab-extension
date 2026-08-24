// CONFIGURATION
const CACHE_KEY = 'shopify_videos_cache';
const CACHE_TIMESTAMP_KEY = 'shopify_videos_timestamp';
const CACHE_DURATION = 3600 * 1000; // 1 hour in milliseconds
const AUTO_REFRESH_INTERVAL = 3600 * 1000; // 1 hour
const CHANNELS_STORAGE_KEY = 'shopify_custom_channels';
const YOUTUBE_API_KEY_STORAGE_KEY = 'youtubeApiKey';
let refreshInterval = null;
let isRefreshing = false;
let currentVideos = [];
const MAX_VIDEOS = 100;
import channelsData from './channels.js';
const { CHANNELS, BLOCKED_CHANNELS, FALLBACK_CHANNELS } = channelsData;
let editableChannels = [];

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

function cloneDefaultChannels() {
  return JSON.parse(JSON.stringify(CHANNELS));
}

function loadEditableChannels() {
  try {
    const stored = localStorage.getItem(CHANNELS_STORAGE_KEY);
    if (!stored) return cloneDefaultChannels();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneDefaultChannels();
    return parsed.map(channel => ({
      ...channel,
      enabled: channel.enabled !== false,
      favorite: channel.favorite === true
    }));
  } catch (error) {
    console.error('Failed to load custom channels:', error);
    return cloneDefaultChannels();
  }
}

function saveEditableChannels(channels) {
  const normalizedChannels = channels.map(channel => ({
    ...channel,
    enabled: channel.enabled !== false,
    favorite: channel.favorite === true
  }));
  editableChannels = normalizedChannels;
  localStorage.setItem(CHANNELS_STORAGE_KEY, JSON.stringify(normalizedChannels));
  mirrorChannelsForBackground(normalizedChannels);
}

// background.js is a service worker with no localStorage/DOM access, so the
// enabled/favorite channel state it needs is mirrored to chrome.storage.local here.
function mirrorChannelsForBackground(channels) {
  chrome.storage.local.set({
    shopify_channels_mirror: channels.map(({ id, name, category, enabled, favorite }) => ({
      id, name, category, enabled, favorite
    }))
  });
}

function getAllCategories() {
  const categories = [...editableChannels, ...FALLBACK_CHANNELS]
    .map(c => normalizeCategory(c.category))
    .filter(Boolean);
  return [...new Set(categories)];
}

function getAllLanguages() {
  const languages = [...editableChannels, ...FALLBACK_CHANNELS]
    .map(c => normalizeLanguage(c.language))
    .filter(Boolean);
  return [...new Set(languages)];
}

function normalizeCategory(value) {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeLanguage(value) {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getYoutubeApiKey() {
  return (localStorage.getItem(YOUTUBE_API_KEY_STORAGE_KEY) || '').trim();
}

function setYoutubeApiKey(apiKey) {
  const trimmed = apiKey.trim();
  localStorage.setItem(YOUTUBE_API_KEY_STORAGE_KEY, trimmed);
  mirrorYoutubeApiKeyForBackground(trimmed);
}

// background.js has no localStorage access, so the key is mirrored here (same
// pattern as mirrorChannelsForBackground) so it can fetch video durations too.
function mirrorYoutubeApiKeyForBackground(apiKey) {
  chrome.storage.local.set({ shopify_youtube_api_key_mirror: apiKey });
}

const DEFAULT_CATEGORY_KEY = 'defaultCategory';

function getDefaultCategory() {
  return localStorage.getItem(DEFAULT_CATEGORY_KEY) || 'all';
}

function setDefaultCategory(category) {
  localStorage.setItem(DEFAULT_CATEGORY_KEY, category);
}

function populateCategorySelectOptions(selectEl, categories) {
  selectEl.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Categories';
  selectEl.appendChild(allOption);

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    selectEl.appendChild(option);
  });
}

// Populates the main category filter, preferring the user's last selection and
// falling back to the default category preference only when there's no valid selection yet
function upsertCategoryOptions(selectEl, categories) {
  populateCategorySelectOptions(selectEl, categories);

  const isValid = category => category === 'all' || categories.includes(category);

  const storedSelection = localStorage.getItem('selectedCategory');
  const defaultCategory = getDefaultCategory();
  const value = isValid(storedSelection)
    ? storedSelection
    : (isValid(defaultCategory) ? defaultCategory : 'all');

  selectEl.value = value;
  localStorage.setItem('selectedCategory', value);
}

// Populates the "default category" preference select in Manage Channels, without touching the active filter
function upsertDefaultCategoryOptions(selectEl, categories) {
  populateCategorySelectOptions(selectEl, categories);

  const defaultCategory = getDefaultCategory();
  selectEl.value = defaultCategory === 'all' || categories.includes(defaultCategory) ? defaultCategory : 'all';
}

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
  editableChannels = loadEditableChannels();
  mirrorChannelsForBackground(editableChannels);

  // Initialize UI elements
  const refreshBtn = document.getElementById('refresh-btn');
  const manageChannelsBtn = document.getElementById('manage-channels-btn');
  const channelManager = document.getElementById('channel-manager');
  const closeChannelManagerBtn = document.getElementById('close-channel-manager-btn');
  const resetChannelsBtn = document.getElementById('reset-channels-btn');
  const channelsList = document.getElementById('channels-list');
  const channelForm = document.getElementById('channel-form');
  const channelFormError = document.getElementById('channel-form-error');
  const channelCategoriesDatalist = document.getElementById('channel-categories');
  const channelLanguagesDatalist = document.getElementById('channel-languages');
  const videoContainer = document.getElementById('videos-container');
  const loading = document.getElementById('loading');
  const categoryFilter = document.getElementById('category-filter');
  const categorySelect = document.getElementById('category-filter');
  const defaultCategorySelect = document.getElementById('default-category-select');
  const youtubeApiKeyInput = document.getElementById('youtube-api-key-input');
  upsertCategoryOptions(categorySelect, getAllCategories());
  upsertDefaultCategoryOptions(defaultCategorySelect, getAllCategories());
  youtubeApiKeyInput.value = getYoutubeApiKey();
  mirrorYoutubeApiKeyForBackground(getYoutubeApiKey());

  // Saving an API key re-fetches so duration badges appear immediately instead of waiting for the next cache expiry
  youtubeApiKeyInput.addEventListener('change', async () => {
    setYoutubeApiKey(youtubeApiKeyInput.value);
    clearCache();
    await loadVideos(true);
  });

  function setChannelFormError(message) {
    if (!message) {
      channelFormError.style.display = 'none';
      channelFormError.textContent = '';
      return;
    }
    channelFormError.style.display = 'block';
    channelFormError.textContent = message;
  }

  function resetChannelForm() {
    document.getElementById('channel-edit-index').value = '';
    document.getElementById('channel-id').value = '';
    document.getElementById('channel-name').value = '';
    document.getElementById('channel-handle').value = '';
    document.getElementById('channel-category').value = '';
    document.getElementById('channel-language').value = '';
    document.getElementById('channel-favorite').checked = false;
    setChannelFormError('');
  }

  function upsertChannelCategorySuggestions() {
    const categories = getAllCategories();
    channelCategoriesDatalist.innerHTML = '';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      channelCategoriesDatalist.appendChild(option);
    });
  }

  function upsertChannelLanguageSuggestions() {
    const languages = getAllLanguages();
    channelLanguagesDatalist.innerHTML = '';
    languages.forEach(language => {
      const option = document.createElement('option');
      option.value = language;
      channelLanguagesDatalist.appendChild(option);
    });
  }

  function renderChannelsList() {
    channelsList.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'channel-row channel-row-header';
    header.innerHTML = `
      <div>Name</div>
      <div>Channel ID</div>
      <div>Handle</div>
      <div>Category</div>
      <div>Language</div>
      <div>Status</div>
      <div>Actions</div>
    `;
    channelsList.appendChild(header);

    // Show enabled channels first, disabled ones grouped at the bottom;
    // data-index still refers to the position in editableChannels so actions target the right channel
    const sortedWithIndex = editableChannels
      .map((channel, index) => ({ channel, index }))
      .sort((a, b) => (a.channel.enabled !== false ? 0 : 1) - (b.channel.enabled !== false ? 0 : 1));

    sortedWithIndex.forEach(({ channel, index }) => {
      const row = document.createElement('div');
      row.className = 'channel-row';
      row.innerHTML = `
        <div>${channel.favorite ? '★ ' : ''}${channel.name || ''}</div>
        <div>${channel.id || ''}</div>
        <div>${channel.handle || ''}</div>
        <div>${channel.category || ''}</div>
        <div>${channel.language || ''}</div>
        <div>${channel.enabled !== false ? 'Enabled' : 'Disabled'}</div>
        <div class="channel-actions">
          <button data-action="toggle-favorite" data-index="${index}">${channel.favorite ? '★ Unfavorite' : '☆ Favorite'}</button>
          <button data-action="toggle" data-index="${index}">${channel.enabled !== false ? 'Disable' : 'Enable'}</button>
          <button data-action="edit" data-index="${index}">Edit</button>
          <button data-action="delete" data-index="${index}">Delete</button>
        </div>
      `;
      channelsList.appendChild(row);
    });
  }

  async function refreshAfterChannelChanges(forceRefresh = true) {
    upsertCategoryOptions(categorySelect, getAllCategories());
    upsertDefaultCategoryOptions(defaultCategorySelect, getAllCategories());
    upsertChannelCategorySuggestions();
    upsertChannelLanguageSuggestions();
    renderChannelsList();
    clearCache();
    await loadVideos(forceRefresh);
  }

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

  // Persist the user's preferred default category for future page loads
  defaultCategorySelect.addEventListener('change', () => {
    setDefaultCategory(defaultCategorySelect.value);
  });

  manageChannelsBtn.addEventListener('click', () => {
    channelManager.style.display = channelManager.style.display === 'none' ? 'block' : 'none';
    if (channelManager.style.display === 'block') {
      upsertChannelCategorySuggestions();
      upsertChannelLanguageSuggestions();
      renderChannelsList();
      resetChannelForm();
    }
  });

  closeChannelManagerBtn.addEventListener('click', () => {
    channelManager.style.display = 'none';
    resetChannelForm();
  });

  resetChannelsBtn.addEventListener('click', async () => {
    const shouldReset = window.confirm('Reset channel list to defaults?');
    if (!shouldReset) return;
    saveEditableChannels(cloneDefaultChannels());
    await refreshAfterChannelChanges(true);
    resetChannelForm();
  });

  channelsList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    const index = parseInt(target.dataset.index || '-1', 10);
    if (index < 0 || index >= editableChannels.length) return;

    if (action === 'edit') {
      const channel = editableChannels[index];
      document.getElementById('channel-edit-index').value = String(index);
      document.getElementById('channel-id').value = channel.id || '';
      document.getElementById('channel-name').value = channel.name || '';
      document.getElementById('channel-handle').value = channel.handle || '';
      document.getElementById('channel-category').value = channel.category || '';
      document.getElementById('channel-language').value = channel.language || '';
      document.getElementById('channel-favorite').checked = channel.favorite === true;
      setChannelFormError('');
      return;
    }

    if (action === 'toggle') {
      const next = [...editableChannels];
      const current = next[index];
      next[index] = {
        ...current,
        enabled: current.enabled === false
      };
      saveEditableChannels(next);
      await refreshAfterChannelChanges(true);
      resetChannelForm();
      return;
    }

    if (action === 'toggle-favorite') {
      const next = [...editableChannels];
      const current = next[index];
      next[index] = {
        ...current,
        favorite: current.favorite !== true
      };
      saveEditableChannels(next);
      renderChannelsList();
      return;
    }

    if (action === 'delete') {
      const channel = editableChannels[index];
      const shouldDelete = window.confirm(`Delete channel "${channel.name}"?`);
      if (!shouldDelete) return;
      const updated = editableChannels.filter((_, i) => i !== index);
      saveEditableChannels(updated.length > 0 ? updated : cloneDefaultChannels());
      await refreshAfterChannelChanges(true);
      resetChannelForm();
    }
  });

  channelForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editIndex = document.getElementById('channel-edit-index').value;
    const id = document.getElementById('channel-id').value.trim();
    const name = document.getElementById('channel-name').value.trim();
    const handle = document.getElementById('channel-handle').value.trim();
    const category = normalizeCategory(document.getElementById('channel-category').value);
    const language = normalizeLanguage(document.getElementById('channel-language').value);
    const favorite = document.getElementById('channel-favorite').checked;

    if (!id || !name || !category) {
      setChannelFormError('Channel ID, Name, and Category are required.');
      return;
    }

    const duplicate = editableChannels.find((c, idx) => c.id === id && String(idx) !== editIndex);
    if (duplicate) {
      setChannelFormError('A channel with this ID already exists.');
      return;
    }

    const existingEnabled = editIndex !== '' ? editableChannels[Number(editIndex)]?.enabled !== false : true;
    const payload = { id, name, handle, category, language, enabled: existingEnabled, favorite };
    const next = [...editableChannels];

    if (editIndex !== '') {
      next[Number(editIndex)] = payload;
    } else {
      next.push(payload);
    }

    saveEditableChannels(next);
    await refreshAfterChannelChanges(true);
    resetChannelForm();
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
 * Attach contentDetails.duration to videos via the YouTube Data API (batches of 50 ids per request).
 * RSS/Atom feeds don't carry duration, so this is the only source for it; failures here
 * (bad key, quota, network) are swallowed so videos still render without duration badges.
 */
async function attachVideoDurations(videos, apiKey) {
  const BATCH_SIZE = 50;
  for (let i = 0; i < videos.length; i += BATCH_SIZE) {
    const batch = videos.slice(i, i + BATCH_SIZE);
    const ids = batch.map(video => video.id.videoId).join(',');

    try {
      const params = new URLSearchParams({ part: 'contentDetails', id: ids, key: apiKey });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
      if (!response.ok) {
        console.warn(`Video duration fetch failed with status ${response.status}`);
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
      console.warn('Error fetching video durations:', error);
    }
  }
}

/**
 * Get videos from YouTube using RSS feeds (no API key required)
 * @param {string} [category] - Optional category to filter channels by
 */
async function getAllVideos(category) {
  const normalizedCategory = normalizeCategory(category);
  const enabledChannels = editableChannels.filter(channel => channel.enabled !== false);
  // Filter channels by category if specified
  const channelsToFetch = category 
    ? enabledChannels.filter(channel => normalizeCategory(channel.category) === normalizedCategory)
    : enabledChannels;
    
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

    // RSS feeds don't include video length, so fetch it separately if the user configured an API key
    const apiKey = getYoutubeApiKey();
    if (apiKey) {
      await attachVideoDurations(finalVideos, apiKey);
    }

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