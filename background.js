/**
 * Background service worker for Tilio extension
 * Handles extension lifecycle and background tasks including high-res icon fetching
 */

console.log('Tilio background service worker starting...');

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Tilio extension installed/updated:', details.reason);
  if (details.reason === 'install') {
    // Set default settings on first install
    chrome.storage.local.set({
      'tilio-settings': {
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
  console.log('Tilio extension startup');
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
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
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Monitor storage usage to prevent quota issues

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
    
    // 1) Try common high-res favicon endpoints first (no CORS issues)
    const candidates = [
      `${origin}/apple-touch-icon.png`,
      `${origin}/apple-touch-icon-precomposed.png`,
      `${origin}/favicon-192x192.png`,
      `${origin}/favicon-180x180.png`,
      `${origin}/favicon.png`,
      `${origin}/android-chrome-192x192.png`,
      `${origin}/android-chrome-512x512.png`
    ];
    for (const href of candidates) {
      const valid = await isValidImage(href);
      if (valid) return href;
    }
    
    // 2) Try to fetch page HTML for OG tags (may have CORS issues)
    try {
      const html = await fetchText(pageUrl);
      if (html) {
        // Look for OpenGraph image
        const ogImage = extractMetaContent(html, [
          /(property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i,
          /(property|name)=["']og:image:url["'][^>]*content=["']([^"']+)["']/i
        ]);
        if (ogImage) {
          const abs = absolutizeUrl(ogImage, u);
          const valid = await isValidImage(abs);
          if (valid) return abs;
        }

        // Look for Twitter Card image
        const twitterImage = extractMetaContent(html, [
          /(property|name)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
          /(property|name)=["']twitter:image:src["'][^>]*content=["']([^"']+)["']/i
        ]);
        if (twitterImage) {
          const abs = absolutizeUrl(twitterImage, u);
          const valid = await isValidImage(abs);
          if (valid) return abs;
        }

        // Look for high-res favicon links in HTML
        const linkIcon = extractLinkHref(html, [
          /rel=["'][^"']*(apple-touch-icon-precomposed)[^"']*["'][^>]*href=["']([^"']+)["']/i,
          /rel=["'][^"']*(apple-touch-icon)[^"']*["'][^>]*href=["']([^"']+)["']/i,
          /rel=["'][^"']*(icon)[^"']*["'][^>]*sizes=["'][^"']*192[^"']*["'][^>]*href=["']([^"']+)["']/i,
          /rel=["'][^"']*(icon)[^"']*["'][^>]*sizes=["'][^"']*180[^"']*["'][^>]*href=["']([^"']+)["']/i,
          /rel=["'][^"']*(icon)[^"']*["'][^>]*href=["']([^"']+\.png)["']/i
        ]);
        if (linkIcon) {
          const abs = absolutizeUrl(linkIcon, u);
          const valid = await isValidImage(abs);
          if (valid) return abs;
        }
      }
    } catch (corsError) {
      console.log('CORS blocked page fetch for', pageUrl, '- using fallback strategy');
    }

    // 3) Use adaptive background approach with regular favicon
    return { useAdaptiveBackground: true, faviconUrl: `chrome://favicon/${origin}` };
    
  } catch (_) { /* ignore */ }
  return null;
}

async function isValidImage(url) {
  try {
    // Create timeout manually for better browser compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(url, { 
      method: 'HEAD', 
      mode: 'no-cors', // Use no-cors to avoid CORS issues for simple checks
      cache: 'force-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    // With no-cors, we can't check response status or headers, so we assume success
    // if the fetch doesn't throw an error
    return true;
  } catch (_) {
    return false;
  }
}

async function fetchText(url) {
  try {
    // Create timeout manually for better browser compatibility  
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { 
      method: 'GET',
      mode: 'cors', // Try CORS first
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return await res.text();
  } catch (corsError) { 
    // If CORS fails, we can't fetch the HTML, return null
    console.log('CORS blocked HTML fetch for', url);
    return null; 
  }
}

function extractMetaContent(html, regexes) {
  for (const regex of regexes) {
    const m = html.match(regex);
    if (m && m[2]) return m[2];
  }
  return null;
}

function extractLinkHref(html, regexes) {
  for (const regex of regexes) {
    const m = html.match(regex);
    if (m && m[2]) return m[2];
  }
  return null;
}

function absolutizeUrl(href, baseUrl) {
  try { return new URL(href, baseUrl).toString(); } catch { return href; }
}
