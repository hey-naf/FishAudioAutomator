// Background service worker for Fish Audio Automator

// Enable Side Panel to open on toolbar icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[Background] Error setting side panel behavior:', error));

// Local in-memory state variables for instant synchronous lookups
let currentPrefix = '';
let currentCounter = 1;
let currentActive = false;

// Sync from local storage
function syncFromStorage() {
  chrome.storage.local.get(['downloadPrefix', 'downloadCounter', 'automationActive'], (result) => {
    currentPrefix = result.downloadPrefix || '';
    currentCounter = result.downloadCounter || 1;
    currentActive = result.automationActive || false;
    console.log(`[Background] Initialized state: prefix="${currentPrefix}", counter=${currentCounter}, active=${currentActive}`);
  });
}

// Initial sync
syncFromStorage();

// Monitor local storage changes dynamically to keep variables updated in memory
chrome.storage.onChanged.addListener((changes) => {
  if (changes.downloadPrefix) currentPrefix = changes.downloadPrefix.newValue || '';
  if (changes.downloadCounter) currentCounter = changes.downloadCounter.newValue || 1;
  if (changes.automationActive) currentActive = changes.automationActive.newValue || false;
  console.log('[Background] State updated in memory from storage change');
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clearPrefix') {
    chrome.storage.local.remove(['downloadPrefix', 'downloadCounter', 'automationActive'], () => {
      currentPrefix = '';
      currentCounter = 1;
      currentActive = false;
      console.log('[Background] Cleared download prefix and active automation state');
    });
  } else if (message.action === 'creditsUpdate') {
    chrome.storage.local.set({ cachedCredits: message.credits });
    console.log('[Background] Saved cachedCredits to storage:', message.credits);
  }
});

// Intercept and rename downloads instantly
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // Sync state lookup immediately (synchronous)
  const isActive = currentActive;
  const prefix = currentPrefix;
  const counter = currentCounter;

  // Check if download is an audio file or matches fish.audio domain
  const isAudio = (item.mime && item.mime.startsWith('audio/')) || 
                  item.filename.endsWith('.mp3') || 
                  item.filename.endsWith('.wav') || 
                  item.filename.endsWith('.ogg');
                  
  const urlMatches = item.url && item.url.includes('fish.audio');
  const referrerMatches = item.referrer && item.referrer.includes('fish.audio');
  const isFromFishAudio = urlMatches || referrerMatches || isAudio;
  
  if (isActive && prefix && isFromFishAudio) {
    // Extract file extension
    const parts = item.filename.split('.');
    const ext = parts.length > 1 ? parts.pop() : 'mp3';
    
    // Format index (e.g. 001, 002)
    const indexStr = String(counter).padStart(3, '0');
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
    const newName = `${cleanPrefix}_Part_${indexStr}.${ext}`;

    // Increment local counter state instantly to avoid race condition on concurrent downloads
    currentCounter = counter + 1;
    chrome.storage.local.set({ downloadCounter: currentCounter });

    console.log(`[Background] Renaming download instantly: ${item.filename} -> ${newName}`);
    
    // Suggest the new filename instantly (no asynchronous callback delay)
    suggest({ filename: newName });
  } else {
    // Let the browser determine the filename normally
    suggest();
  }

  // Return true to indicate we will call suggest (or have called it)
  return true;
});
