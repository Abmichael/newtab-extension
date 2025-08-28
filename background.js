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
    
    case 'fetchHighResIcon': {
      const url = request.url;
      if (!url || typeof url !== 'string') {
        sendResponse({ success: false, error: 'invalid url' });
        break;
      }
      // Check cache first
      const cacheKey = `cache-icon-${url}`;
      chrome.storage.local.get([cacheKey], async (data) => {
        const cached = data[cacheKey];
        if (cached && cached.imageUrl && (Date.now() - (cached.ts || 0) < 1000 * 60 * 60 * 24 * 7)) {
          sendResponse({ success: true, imageUrl: cached.imageUrl, cached: true });
          return;
        }
        try {
          const highRes = await fetchBestIcon(url);
          if (highRes) {
            const toStore = { imageUrl: highRes, ts: Date.now() };
            chrome.storage.local.set({ [cacheKey]: toStore }, () => {
              sendResponse({ success: true, imageUrl: highRes });
            });
            return;
          }
        } catch (e) {
          // fallthrough to failure
        }
        sendResponse({ success: false });
      });
      return true; // async
    }
    
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

// Try multiple strategies to obtain a high-res icon/thumbnail for a site
async function fetchBestIcon(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const origin = u.origin;
    // 1) Try common favicon endpoints with larger sizes
    const candidates = [
      `${origin}/favicon.png`,
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`,
      `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`,
      `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`
    ];
    for (const href of candidates) {
      const ok = await checkImageOk(href);
      if (ok) return href;
    }
    // 2) Fetch page and look for <meta property="og:image"> or icons
    const html = await fetchText(pageUrl);
    if (html) {
      const og = matchMetaContent(html, /(property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i);
      if (og) {
        const abs = absolutizeUrl(og, u);
        const ok = await checkImageOk(abs);
        if (ok) return abs;
      }
      const linkIcon = matchLinkHref(html, /rel=["'][^"']*(icon|shortcut icon|apple-touch-icon)[^"']*["'][^>]*href=["']([^"']+)["']/i);
      if (linkIcon) {
        const abs = absolutizeUrl(linkIcon, u);
        const ok = await checkImageOk(abs);
        if (ok) return abs;
      }
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function checkImageOk(url) {
  try {
    const res = await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'force-cache' });
    // In MV3 SW with no-cors, status may be 0; we can attempt an Image decode approach instead
    return true; // allow optimistic usage; the UI will fallback if it errors
  } catch (_) {
    return false;
  }
}

async function fetchText(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    return await res.text();
  } catch (_) { return null; }
}

function matchMetaContent(html, regex) {
  const m = html.match(regex);
  return m ? m[2] : null;
}

function matchLinkHref(html, regex) {
  const m = html.match(regex);
  return m ? m[2] : null;
}

function absolutizeUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); } catch { return href; }
}
