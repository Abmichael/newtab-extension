// NeoTab - Chrome Storage API Integration Layer
class StorageManager {
  constructor() {
    this.storageKey = 'neotab_data';
    this.defaultData = {
  folders: [],
  links: [],
  rootOrder: [],
      settings: {
        gridSize: 4,
        theme: 'dark',
        backgroundColor: '#1a202c',
        textColor: '#e2e8f0',
        primaryColor: '#63b3ed',
        backgroundGradient: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)',
        showClock: false,
        clockFormat: '12h',
        clockPosition: 'bottom-right',
        customTheme: false,
        accessibility: {
          highContrast: false,
          reducedMotion: false
        }
      },
      version: '1.0'
    };
  }

  /**
   * Save data to chrome.storage.local with error handling
   * @param {Object} data - Data to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveData(data) {
    try {
      // Validate data before saving
      if (!this.validateSchema(data)) {
        throw new Error('Invalid data schema');
      }

      // Sanitize input to prevent potential issues
      const sanitizedData = this.sanitizeInput(data);
      
      // Check storage quota before saving (best-effort)
      await this.checkStorageQuota();

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.set) {
        await chrome.storage.local.set({ [this.storageKey]: sanitizedData });
      } else {
        // Fallback to localStorage when running outside Chrome extension (dev in browser)
        localStorage.setItem(this.storageKey, JSON.stringify(sanitizedData));
      }
      console.log('Data saved successfully');
      return true;
    } catch (error) {
      console.error('Error saving data:', error);
      
      // Handle specific storage errors
      if (error.message.includes('QUOTA_EXCEEDED')) {
        this.handleQuotaExceeded();
      }
      
      return false;
    }
  }

  /**
   * Load data from chrome.storage.local with fallback
   * @returns {Promise<Object>} - Loaded data or default data
   */
  async loadData() {
    try {
      let storedData = null;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.get) {
        const result = await chrome.storage.local.get([this.storageKey]);
        storedData = result[this.storageKey];
      } else {
        const raw = localStorage.getItem(this.storageKey);
        storedData = raw ? JSON.parse(raw) : null;
      }

      if (!storedData) {
        console.log('No stored data found, using defaults');
        return this.defaultData;
      }

      // Validate stored data
      if (!this.validateSchema(storedData)) {
        console.warn('Stored data schema invalid, using defaults');
        return this.defaultData;
      }

      // Check for version migrations
      const migratedData = this.migrateData(storedData);
      console.log('Data loaded successfully');
      return migratedData;
    } catch (error) {
      console.error('Error loading data:', error);
      return this.defaultData;
    }
  }

  /**
   * Validate data against expected schema
   * @param {Object} data - Data to validate
   * @returns {boolean} - Validation result
   */
  validateSchema(data) {
    try {
      // Check for required top-level properties
      if (!data || typeof data !== 'object') {
        return false;
      }

      if (!Array.isArray(data.folders)) {
        return false;
      }

      // links is optional but if present must be an array
      if (data.links !== undefined && !Array.isArray(data.links)) {
        return false;
      }

  if (!data.settings || typeof data.settings !== 'object') {
        return false;
      }

      if (!data.version || typeof data.version !== 'string') {
        return false;
      }

      // Validate settings structure
      const { settings } = data;
      if (typeof settings.gridSize !== 'number' ||
          typeof settings.backgroundColor !== 'string' ||
          typeof settings.textColor !== 'string' ||
          typeof settings.showClock !== 'boolean' ||
          typeof settings.clockFormat !== 'string' ||
          typeof settings.theme !== 'string') {
        return false;
      }

      // Validate accessibility settings if present
      if (settings.accessibility) {
        if (typeof settings.accessibility !== 'object' ||
            (settings.accessibility.highContrast !== undefined && typeof settings.accessibility.highContrast !== 'boolean') ||
            (settings.accessibility.reducedMotion !== undefined && typeof settings.accessibility.reducedMotion !== 'boolean')) {
          return false;
        }
      }

  // Validate folders structure
      for (const folder of data.folders) {
        if (!folder.id || !folder.name || !Array.isArray(folder.sites)) {
          return false;
        }
        
        for (const site of folder.sites) {
          if (!site.id || !site.name || !site.url) {
            return false;
          }
        }
      }

      // Validate root links if present
      if (Array.isArray(data.links)) {
        for (const link of data.links) {
          if (!link.id || !link.name || !link.url) {
            return false;
          }
        }
      }

      // Validate rootOrder if present
      if (data.rootOrder !== undefined) {
        if (!Array.isArray(data.rootOrder)) return false;
        for (const entry of data.rootOrder) {
          if (!entry || typeof entry !== 'object') return false;
          if (!('type' in entry) || !('id' in entry)) return false;
          if (entry.type !== 'folder' && entry.type !== 'link') return false;
          if (typeof entry.id !== 'string') return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Schema validation error:', error);
      return false;
    }
  }

  /**
   * Sanitize input to prevent XSS and other issues
   * @param {Object} data - Data to sanitize
   * @returns {Object} - Sanitized data
   */
  sanitizeInput(data) {
    try {
      // Deep clone to avoid modifying original
      const sanitized = JSON.parse(JSON.stringify(data));

  // Sanitize folder names and site data
      if (sanitized.folders) {
        sanitized.folders.forEach(folder => {
          if (folder.name) {
            folder.name = this.escapeHtml(folder.name);
          }
          
          if (folder.sites) {
            folder.sites.forEach(site => {
              if (site.name) {
                site.name = this.escapeHtml(site.name);
              }
              if (site.url) {
                site.url = this.sanitizeUrl(site.url);
              }
            });
          }
        });
      }

      // Sanitize root links
      if (sanitized.links) {
        sanitized.links.forEach(link => {
          if (link.name) {
            link.name = this.escapeHtml(link.name);
          }
          if (link.url) {
            link.url = this.sanitizeUrl(link.url);
          }
        });
      }

      // Clean rootOrder: remove entries whose targets no longer exist
      if (Array.isArray(sanitized.rootOrder)) {
        const folderIds = new Set((sanitized.folders || []).map(f => f.id));
        const linkIds = new Set((sanitized.links || []).map(l => l.id));
        sanitized.rootOrder = sanitized.rootOrder.filter(e =>
          e && ((e.type === 'folder' && folderIds.has(e.id)) || (e.type === 'link' && linkIds.has(e.id)))
        );
      }

      return sanitized;
    } catch (error) {
      console.error('Error sanitizing input:', error);
      return data;
    }
  }

  /**
   * Generate unique ID for folders and sites
   * @returns {string} - Unique ID
   */
  generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Handle data migration for version changes
   * @param {Object} data - Data to migrate
   * @returns {Object} - Migrated data
   */
  migrateData(data) {
    try {
      const currentVersion = '1.0';
      
      if (data.version === currentVersion) {
        // Ensure new optional fields exist
        const withLinks = Array.isArray(data.links) ? data.links : [];
        let rootOrder = Array.isArray(data.rootOrder) ? data.rootOrder : null;
        if (!rootOrder) {
          rootOrder = [
            ...withLinks.map(l => ({ type: 'link', id: l.id })),
            ...(Array.isArray(data.folders) ? data.folders.map(f => ({ type: 'folder', id: f.id })) : []),
          ];
        }
        return { ...data, links: withLinks, rootOrder };
      }

      console.log(`Migrating data from version ${data.version} to ${currentVersion}`);
      
      // Add migration logic here for future versions
      const migratedData = { ...data };
      migratedData.version = currentVersion;

      // Ensure all required settings exist
      migratedData.settings = {
        ...this.defaultData.settings,
        ...migratedData.settings
      };

      // Ensure links exists
      if (!Array.isArray(migratedData.links)) {
        migratedData.links = [];
      }

      // Ensure rootOrder exists
      if (!Array.isArray(migratedData.rootOrder)) {
        migratedData.rootOrder = [
          ...migratedData.links.map(l => ({ type: 'link', id: l.id })),
          ...migratedData.folders.map(f => ({ type: 'folder', id: f.id })),
        ];
      }

      return migratedData;
    } catch (error) {
      console.error('Error migrating data:', error);
      return this.defaultData;
    }
  }

  /**
   * Check storage quota and warn if approaching limit
   */
  async checkStorageQuota() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quotaBytes = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        
        const usagePercent = (bytesInUse / quotaBytes) * 100;
        
        if (usagePercent > 80) {
          console.warn(`Storage usage high: ${usagePercent.toFixed(1)}%`);
        }
      } else {
        // localStorage rough estimate
        const raw = localStorage.getItem(this.storageKey) || '';
        const bytesInUse = new Blob([raw]).size;
        const quotaBytes = 5 * 1024 * 1024; // assume 5MB
        const usagePercent = (bytesInUse / quotaBytes) * 100;
        if (usagePercent > 80) {
          console.warn(`Storage usage (localStorage) high: ${usagePercent.toFixed(1)}%`);
        }
      }
    } catch (error) {
      console.error('Error checking storage quota:', error);
    }
  }

  /**
   * Handle quota exceeded errors
   */
  handleQuotaExceeded() {
    console.error('Storage quota exceeded. Consider cleaning up old data.');
    // Could implement automatic cleanup logic here
  }

  /**
   * Clear all stored data (for debugging/reset purposes)
   */
  async clearData() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.remove) {
        await chrome.storage.local.remove([this.storageKey]);
      } else {
        localStorage.removeItem(this.storageKey);
      }
      console.log('Data cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing data:', error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    try {
      let bytesInUse = 0;
      let quotaBytes = 5 * 1024 * 1024;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
        bytesInUse = await chrome.storage.local.getBytesInUse();
        quotaBytes = chrome.storage.local.QUOTA_BYTES || 5242880;
      } else {
        const raw = localStorage.getItem(this.storageKey) || '';
        bytesInUse = new Blob([raw]).size;
      }
      
      return {
        bytesInUse,
        quotaBytes,
        usagePercent: (bytesInUse / quotaBytes) * 100
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return null;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize URL to ensure it's valid
   * @param {string} url - URL to sanitize
   * @returns {string} - Sanitized URL
   */
  sanitizeUrl(url) {
    try {
      // Allow only http, https, and chrome protocols
      const allowedProtocols = ['http:', 'https:', 'chrome:', 'chrome-extension:'];
      const urlObj = new URL(url);
      
      if (allowedProtocols.includes(urlObj.protocol)) {
        return url;
      } else {
        // Default to https if no valid protocol
        return 'https://' + url.replace(/^[^:]+:\/\//, '');
      }
    } catch (error) {
      // If URL is invalid, try to fix it
      if (!url.includes('://')) {
        return 'https://' + url;
      }
      return url;
    }
  }

  /**
   * Save settings specifically
   * @param {Object} settings - Settings object to save
   * @returns {Promise<boolean>} - Success status
   */
  async saveSettings(settings) {
    try {
      const data = await this.loadData();
      data.settings = { ...data.settings, ...settings };
      return await this.saveData(data);
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  /**
   * Load only settings
   * @returns {Promise<Object>} - Settings object
   */
  async loadSettings() {
    try {
      const data = await this.loadData();
      return data.settings || this.defaultData.settings;
    } catch (error) {
      console.error('Error loading settings:', error);
      return this.defaultData.settings;
    }
  }

  /**
   * Reset settings to defaults
   * @returns {Promise<boolean>} - Success status
   */
  async resetSettings() {
    try {
      const data = await this.loadData();
      data.settings = { ...this.defaultData.settings };
      return await this.saveData(data);
    } catch (error) {
      console.error('Error resetting settings:', error);
      return false;
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
