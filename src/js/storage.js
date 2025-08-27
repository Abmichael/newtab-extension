// NeoTab - Chrome Storage API Integration Layer
class StorageManager {
  constructor() {
    this.storageKey = 'neotab_data';
    this.defaultData = {
      folders: [],
      settings: {
        gridSize: 4,
        backgroundColor: '#667eea',
        textColor: '#ffffff',
        showClock: true,
        clockFormat: '24h'
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
      
      // Check storage quota before saving
      await this.checkStorageQuota();

      await chrome.storage.local.set({ [this.storageKey]: sanitizedData });
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
      const result = await chrome.storage.local.get([this.storageKey]);
      const storedData = result[this.storageKey];

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
          typeof settings.showClock !== 'boolean') {
        return false;
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
        return data;
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
      if (chrome.storage.local.getBytesInUse) {
        const bytesInUse = await chrome.storage.local.getBytesInUse();
        const quotaBytes = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
        
        const usagePercent = (bytesInUse / quotaBytes) * 100;
        
        if (usagePercent > 80) {
          console.warn(`Storage usage high: ${usagePercent.toFixed(1)}%`);
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
      await chrome.storage.local.remove([this.storageKey]);
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
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quotaBytes = chrome.storage.local.QUOTA_BYTES || 5242880;
      
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
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
