// NeoTab - Folder System Business Logic (no UI dependencies)
// Depends on StorageManager for persistence, validation, and sanitization

class FolderSystem {
  /**
   * @param {StorageManager} storageManager
   */
  constructor(storageManager) {
    if (!storageManager) throw new Error('FolderSystem requires a StorageManager');
    this.storage = storageManager;
    this.data = null; // full persisted object { folders, settings, version }
    this.folders = []; // convenience reference to this.data.folders
  }

  /**
   * Load existing data from storage and prepare in-memory structures
   */
  async initialize() {
    this.data = await this.storage.loadData();
    // Ensure structure exists
    if (!this.data || !Array.isArray(this.data.folders)) {
      this.data = this.storage.defaultData;
    }
    this.folders = this.data.folders;
    return this.folders;
  }

  /** Persist current data to storage */
  async save() {
    // this.data.folders already points to this.folders
    return await this.storage.saveData(this.data);
  }

  /** Generate unique ID */
  generateId() {
    return typeof this.storage.generateId === 'function'
      ? this.storage.generateId()
      : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /** Sanitize text */
  sanitizeInput(text) {
    if (typeof text !== 'string') return text;
    return typeof this.storage.escapeHtml === 'function'
      ? this.storage.escapeHtml(text)
      : text.replace(/[&<>"]+/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
  }

  /** Validate and normalize URL */
  sanitizeUrl(url) {
    if (typeof this.storage.sanitizeUrl === 'function') {
      return this.storage.sanitizeUrl(url);
    }
    try {
      const allowed = ['http:', 'https:', 'chrome:', 'chrome-extension:'];
      const u = new URL(url);
      if (!allowed.includes(u.protocol)) throw new Error('invalid protocol');
      return url;
    } catch (e) {
      if (typeof url === 'string' && !url.includes('://')) return 'https://' + url;
      return url;
    }
  }

  // =============== Folder CRUD ==================

  /**
   * Create a new folder
   * @param {string} name
   * @param {object} extra optional extra fields (e.g., color)
   */
  async createFolder(name, extra = {}) {
    const folder = {
      id: this.generateId(),
      name: this.sanitizeInput(name || 'New Folder'),
      sites: [],
      ...extra,
    };
    this.folders.push(folder);
    await this.save();
    return folder;
  }

  /**
   * Update folder properties (currently supports name and extra props)
   */
  async updateFolder(id, data) {
    const folder = this.getFolderById(id);
    if (!folder) throw new Error('Folder not found');
    if ('name' in data) folder.name = this.sanitizeInput(data.name);
    // Allow updating arbitrary metadata fields except sites/id
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id' || k === 'sites' || k === 'name') continue;
      folder[k] = v;
    }
    await this.save();
    return folder;
  }

  /** Delete a folder and its sites */
  async deleteFolder(id) {
    const idx = this.folders.findIndex(f => f.id === id);
    if (idx === -1) throw new Error('Folder not found');
    const [removed] = this.folders.splice(idx, 1);
    await this.save();
    return removed;
  }

  /** Reorder folders by moving item at fromIndex to toIndex */
  async reorderFolders(fromIndex, toIndex) {
    const len = this.folders.length;
    if (
      fromIndex < 0 || fromIndex >= len ||
      toIndex < 0 || toIndex >= len
    ) throw new Error('Index out of range');
    const [moved] = this.folders.splice(fromIndex, 1);
    this.folders.splice(toIndex, 0, moved);
    await this.save();
    return this.folders;
  }

  /** Reorder a folder by ID to a new position */
  async reorderFolder(folderId, newIndex) {
    const currentIndex = this.folders.findIndex(f => f.id === folderId);
    if (currentIndex === -1) throw new Error('Folder not found');
    
    const clampedIndex = Math.max(0, Math.min(newIndex, this.folders.length - 1));
    return await this.reorderFolders(currentIndex, clampedIndex);
  }

  /** Get all folders in order */
  getAllFolders() {
    return this.folders;
  }

  // =============== Site Management ==============

  /** Add a site to a folder */
  async addSite(folderId, siteData) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error('Folder not found');

    const name = this.sanitizeInput(siteData?.name || 'New Site');
    const url = this.sanitizeUrl(siteData?.url || '');

    // Validate URL using URL constructor
    try { new URL(url); } catch (e) { throw new Error('Invalid URL'); }

    const site = {
      id: this.generateId(),
      name,
      url,
      icon: siteData?.icon || this.generateFaviconUrl(url),
      ...(['id','name','url','icon'].reduce((acc, k) => acc, {})),
    };
    folder.sites.push(site);
    await this.save();
    return site;
  }

  /** Alias for addSite to match UI calls */
  async addSiteToFolder(folderId, siteData) {
    return await this.addSite(folderId, siteData);
  }

  /** Update a site properties */
  async updateSite(folderId, siteId, data) {
    const { folder, site } = this.getSiteById(folderId, siteId);
    if (!folder || !site) throw new Error('Site not found');
    if ('name' in data) site.name = this.sanitizeInput(data.name);
    if ('url' in data) {
      const u = this.sanitizeUrl(data.url);
      try { new URL(u); } catch (e) { throw new Error('Invalid URL'); }
      site.url = u;
    }
    if ('icon' in data) site.icon = data.icon || this.generateFaviconUrl(site.url);
    // Copy any additional metadata fields except id
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id' || k === 'name' || k === 'url' || k === 'icon') continue;
      site[k] = v;
    }
    await this.save();
    return site;
  }

  /** Delete a site from a folder */
  async deleteSite(folderId, siteId) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error('Folder not found');
    const idx = folder.sites.findIndex(s => s.id === siteId);
    if (idx === -1) throw new Error('Site not found');
    const [removed] = folder.sites.splice(idx, 1);
    await this.save();
    return removed;
  }

  /** Generate a favicon URL from a site URL */
  generateFaviconUrl(url) {
    try {
      const u = new URL(url);
      // Prefer chrome://favicon which Chrome resolves locally
      return `chrome://favicon/${u.origin}`;
    } catch (e) {
      return 'chrome://favicon/';
    }
  }

  // =============== Helpers ======================

  getFolderById(id) {
    return this.folders.find(f => f.id === id);
  }

  getSiteById(folderId, siteId) {
    const folder = this.getFolderById(folderId);
    if (!folder) return { folder: null, site: null };
    const site = folder.sites.find(s => s.id === siteId);
    return { folder, site };
  }
}

// Export to window for use by other modules
if (typeof window !== 'undefined') {
  window.FolderSystem = FolderSystem;
}
