/**
 * Background service worker for NeoTab extension
 * Handles extension lifecycle and basic background tasks
 */

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set({
      'neotab-settings': {
        theme: 'default',
        gridColumns: 'auto',
        showClock: true,
        clockFormat: '24h'
      }
    });
  } else if (details.reason === 'update') {
    // Handle extension updates
    const previousVersion = details.previousVersion;
    console.log(`Updated from version ${previousVersion}`);
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  // Perform any necessary startup tasks
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getVersion':
      sendResponse({ version: chrome.runtime.getManifest().version });
      break;
    
    case 'exportData':
      // Handle data export requests
      chrome.storage.local.get(null, (data) => {
        sendResponse({ success: true, data: data });
      });
      return true; // Will respond asynchronously
    
    case 'importData':
      // Handle data import requests
      if (request.data) {
        chrome.storage.local.set(request.data, () => {
          sendResponse({ success: true });
        });
        return true; // Will respond asynchronously
      }
      break;
    
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Monitor storage usage to prevent quota issues
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    // Check if we're approaching storage limits
    chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
      const maxBytes = chrome.storage.local.QUOTA_BYTES;
      const usagePercent = (bytesInUse / maxBytes) * 100;
      
      if (usagePercent > 80) {
        console.warn('Storage usage high:', usagePercent.toFixed(1) + '%');
      }
    });
  }
});

// Cleanup old data periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    // Perform periodic cleanup tasks
    cleanupOldData();
  }
});

function cleanupOldData() {
  chrome.storage.local.get(null, (data) => {
    // Remove any temporary or outdated data
    const keysToRemove = [];
    
    for (const key in data) {
      if (key.startsWith('temp-') || key.startsWith('cache-')) {
        const item = data[key];
        if (item.timestamp && Date.now() - item.timestamp > 86400000) { // 24 hours
          keysToRemove.push(key);
        }
      }
    }
    
    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove);
    }
  });
}
