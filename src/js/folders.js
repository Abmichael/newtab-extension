// NeoTab - Folder System Business Logic (no UI dependencies)
// Depends on StorageManager for persistence, validation, and sanitization

class FolderSystem {
  /**
   * @param {StorageManager} storageManager
   */
  constructor(storageManager) {
    if (!storageManager)
      throw new Error("FolderSystem requires a StorageManager");
    this.storage = storageManager;
    this.data = null; // full persisted object { folders, settings, version }
    this.folders = []; // convenience reference to this.data.folders
    this.links = []; // root-level links shown alongside folders
    this.rootOrder = []; // [{ type: 'folder'|'link', id: string }]
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
    this.links = Array.isArray(this.data.links)
      ? this.data.links
      : (this.data.links = []);
    this.rootOrder = Array.isArray(this.data.rootOrder)
      ? this.data.rootOrder
      : (this.data.rootOrder = [
          ...this.links.map((l) => ({ type: "link", id: l.id })),
          ...this.folders.map((f) => ({ type: "folder", id: f.id })),
        ]);
    // Ensure meta block exists
    if (!this.data.meta)
      this.data.meta = { lastTopSitesSync: 0, topSitesSeeded: false };
    return this.folders;
  }

  /** Persist current data to storage */
  async save() {
    // this.data.folders already points to this.folders
    this.data.links = this.links;
    this.data.rootOrder = this.rootOrder;
    return await this.storage.saveData(this.data);
  }

  // =============== Top Sites Integration (Chrome) ===============
  /**
   * Fetch Chrome top sites (permission required)
   * @returns {Promise<Array<{title:string,url:string}>>}
   */
  async fetchTopSites() {
    return new Promise((resolve) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.topSites ||
        !chrome.topSites.get
      ) {
        resolve([]);
        return;
      }
      try {
        chrome.topSites.get((sites) => {
          resolve(Array.isArray(sites) ? sites : []);
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  /**
   * Seed root grid with top sites if first run and grid is empty
   */
  async maybeSeedFromTopSites(maxLinks = 12) {
    try {
      if (this.data.meta?.topSitesSeeded) return false;
      const isEmpty = this.links.length === 0 && this.folders.length === 0;
      if (!isEmpty) {
        this.data.meta.topSitesSeeded = true;
        await this.save();
        return false;
      }
      const sites = await this.fetchTopSites();
      if (!sites.length) {
        this.data.meta.topSitesSeeded = true;
        await this.save();
        return false;
      }
      const picked = sites.slice(0, maxLinks);
      for (const s of picked) {
        await this.addRootLink({ name: s.title || s.url, url: s.url });
      }
      this.data.meta.topSitesSeeded = true;
      this.data.meta.lastTopSitesSync = Date.now();
      await this.save();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Periodically sync in a lightweight way: add missing top sites up to a cap.
   */
  async periodicTopSitesRefresh(options = { intervalHours: 24, cap: 24 }) {
    try {
      const now = Date.now();
      const last = this.data.meta?.lastTopSitesSync || 0;
      const intervalMs = (options.intervalHours || 24) * 3600 * 1000;
      if (now - last < intervalMs) return false;
      const sites = await this.fetchTopSites();
      if (!sites.length) return false;
      // Deduplicate by hostname; keep existing if present
      const existingHosts = new Set(
        this.links.map((l) => {
          try {
            return new URL(l.url).hostname;
          } catch {
            return l.url;
          }
        })
      );
      let added = 0;
      for (const s of sites) {
        if (added >= (options.cap || 24)) break;
        let host;
        try {
          host = new URL(s.url).hostname;
        } catch {
          host = s.url;
        }
        if (existingHosts.has(host)) continue;
        await this.addRootLink({ name: s.title || host, url: s.url });
        existingHosts.add(host);
        added++;
      }
      this.data.meta.lastTopSitesSync = now;
      await this.save();
      return added > 0;
    } catch (_) {
      return false;
    }
  }

  /** Generate unique ID */
  generateId() {
    return typeof this.storage.generateId === "function"
      ? this.storage.generateId()
      : "id_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
  }

  /** Sanitize text */
  sanitizeInput(text) {
    if (typeof text !== "string") return text;
    return typeof this.storage.escapeHtml === "function"
      ? this.storage.escapeHtml(text)
      : text.replace(
          /[&<>"]+/g,
          (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s])
        );
  }

  /** Validate and normalize URL */
  sanitizeUrl(url) {
    if (typeof this.storage.sanitizeUrl === "function") {
      return this.storage.sanitizeUrl(url);
    }
    try {
      const allowed = ["http:", "https:", "chrome:", "chrome-extension:"];
      const u = new URL(url);
      if (!allowed.includes(u.protocol)) throw new Error("invalid protocol");
      return url;
    } catch (e) {
      if (typeof url === "string" && !url.includes("://"))
        return "https://" + url;
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
      name: this.sanitizeInput(name || "New Folder"),
      sites: [],
      ...extra,
    };
    this.folders.push(folder);
    // Append to root order
    this.rootOrder.push({ type: "folder", id: folder.id });
    await this.save();
    return folder;
  }

  /**
   * Update folder properties (currently supports name and extra props)
   */
  async updateFolder(id, data) {
    const folder = this.getFolderById(id);
    if (!folder) throw new Error("Folder not found");
    if ("name" in data) folder.name = this.sanitizeInput(data.name);
    // Allow updating arbitrary metadata fields except sites/id
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || k === "sites" || k === "name") continue;
      folder[k] = v;
    }
    await this.save();
    return folder;
  }

  /** Delete a folder and its sites */
  async deleteFolder(id) {
    const idx = this.folders.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Folder not found");
    const [removed] = this.folders.splice(idx, 1);
    this.rootOrder = this.rootOrder.filter(
      (e) => !(e.type === "folder" && e.id === id)
    );
    await this.save();
    return removed;
  }

  /** Reorder folders by moving item at fromIndex to toIndex */
  async reorderFolders(fromIndex, toIndex) {
    const len = this.folders.length;
    if (fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len)
      throw new Error("Index out of range");
    const [moved] = this.folders.splice(fromIndex, 1);
    this.folders.splice(toIndex, 0, moved);
    await this.save();
    return this.folders;
  }

  /** Reorder a folder by ID to a new position */
  async reorderFolder(folderId, newIndex) {
    const currentIndex = this.folders.findIndex((f) => f.id === folderId);
    if (currentIndex === -1) throw new Error("Folder not found");

    const clampedIndex = Math.max(
      0,
      Math.min(newIndex, this.folders.length - 1)
    );
    return await this.reorderFolders(currentIndex, clampedIndex);
  }

  /** Get all folders in order */
  getAllFolders() {
    return this.folders;
  }

  /** Get root items in display order */
  getRootItems() {
    const byFolder = new Map(this.folders.map((f) => [f.id, f]));
    const byLink = new Map(this.links.map((l) => [l.id, l]));
    return this.rootOrder
      .map((e) =>
        e.type === "folder"
          ? byFolder.get(e.id)
            ? { type: "folder", item: byFolder.get(e.id) }
            : null
          : byLink.get(e.id)
          ? { type: "link", item: byLink.get(e.id) }
          : null
      )
      .filter(Boolean);
  }

  // =============== Root Links ==================

  /** Get all root-level links */
  getAllLinks() {
    return this.links;
  }

  /** Add a root-level link */
  async addRootLink(linkData) {
    const name = this.sanitizeInput(linkData?.name || "New Link");
    const url = this.sanitizeUrl(linkData?.url || "");
    try {
      new URL(url);
    } catch {
      throw new Error("Invalid URL");
    }
    const link = {
      id: this.generateId(),
      name,
      url,
      icon: linkData?.icon || this.generateFaviconUrl(url),
    };
    this.links.push(link);
    this.rootOrder.push({ type: "link", id: link.id });
    await this.save();
    return link;
  }

  /** Update a root-level link */
  async updateRootLink(linkId, data) {
    const link = this.links.find((l) => l.id === linkId);
    if (!link) throw new Error("Link not found");
    if ("name" in data) link.name = this.sanitizeInput(data.name);
    if ("url" in data) {
      const u = this.sanitizeUrl(data.url);
      try {
        new URL(u);
      } catch {
        throw new Error("Invalid URL");
      }
      link.url = u;
      // refresh icon if not explicitly set
      if (!data.icon) {
        link.icon = this.generateFaviconUrl(u);
      }
    }
    if ("icon" in data)
      link.icon = data.icon || this.generateFaviconUrl(link.url);
    await this.save();
    return link;
  }

  /** Delete a root-level link */
  async deleteRootLink(linkId) {
    const idx = this.links.findIndex((l) => l.id === linkId);
    if (idx === -1) throw new Error("Link not found");
    const [removed] = this.links.splice(idx, 1);
    this.rootOrder = this.rootOrder.filter(
      (e) => !(e.type === "link" && e.id === linkId)
    );
    await this.save();
    return removed;
  }

  /** Reorder a root-level link to new index */
  async reorderRootLink(linkId, newIndex) {
    const currentIndex = this.links.findIndex((l) => l.id === linkId);
    if (currentIndex === -1) throw new Error("Link not found");
    const clamped = Math.max(0, Math.min(newIndex, this.links.length - 1));
    const [moved] = this.links.splice(currentIndex, 1);
    this.links.splice(clamped, 0, moved);
    await this.save();
    return this.links;
  }

  /** Reorder any root item (folder or link) by type and id */
  async reorderRootItem(type, id, newIndex) {
    const idx = this.rootOrder.findIndex((e) => e.type === type && e.id === id);
    if (idx === -1) throw new Error("Root item not found");
    const clamped = Math.max(0, Math.min(newIndex, this.rootOrder.length - 1));
    const [moved] = this.rootOrder.splice(idx, 1);
    this.rootOrder.splice(clamped, 0, moved);
    await this.save();
    return this.rootOrder;
  }

  /** Move a root link into a folder as a site */
  async moveLinkToFolder(linkId, folderId) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error("Folder not found");
    const idx = this.links.findIndex((l) => l.id === linkId);
    if (idx === -1) throw new Error("Link not found");
    const [link] = this.links.splice(idx, 1);
    this.rootOrder = this.rootOrder.filter(
      (e) => !(e.type === "link" && e.id === linkId)
    );

    // Convert to site
    const site = {
      id: this.generateId(),
      name: this.sanitizeInput(link.name),
      url: this.sanitizeUrl(link.url),
      icon: link.icon || this.generateFaviconUrl(link.url),
    };
    folder.sites.push(site);
    await this.save();
    return { folder, site };
  }

  /** Merge source folder into target folder, then remove source folder */
  async mergeFolders(sourceFolderId, targetFolderId) {
    if (sourceFolderId === targetFolderId) return;
    const source = this.getFolderById(sourceFolderId);
    const target = this.getFolderById(targetFolderId);
    if (!source || !target) throw new Error("Folder not found");

    // Move all sites from source to target (append)
    target.sites.push(...(source.sites || []));
    source.sites = [];

    // Remove source folder from collections
    await this.deleteFolder(sourceFolderId);
    // deleteFolder calls save; but target.sites already updated. Save again to persist final state
    await this.save();
    return target;
  }

  /**
   * Create a folder from one or more root links and insert into rootOrder at index
   * @param {string[]} linkIds - root link IDs to move into the new folder
   * @param {string} [folderName] - optional folder name
   * @param {number} [insertIndex] - index in rootOrder to insert the new folder
   */
  async createFolderFromRootLinks(linkIds, folderName, insertIndex) {
    if (!Array.isArray(linkIds) || linkIds.length < 1)
      throw new Error("No links provided");
    const linkMap = new Map(this.links.map((l) => [l.id, l]));
    const selected = linkIds.map((id) => linkMap.get(id)).filter(Boolean);
    if (selected.length === 0) throw new Error("Links not found");

    const name = this.sanitizeInput(
      folderName ||
        (selected.length === 1
          ? selected[0].name || "New Folder"
          : `${selected[0].name || "Folder"} +${selected.length - 1}`)
    );

    // Create folder and convert links to sites
    const folder = {
      id: this.generateId(),
      name,
      sites: selected.map((l) => ({
        id: this.generateId(),
        name: this.sanitizeInput(l.name),
        url: this.sanitizeUrl(l.url),
        icon: l.icon || this.generateFaviconUrl(l.url),
      })),
    };

    // Remove links from root collections
    const linkIdSet = new Set(linkIds);
    this.links = this.links.filter((l) => !linkIdSet.has(l.id));
    this.rootOrder = this.rootOrder.filter(
      (e) => !(e.type === "link" && linkIdSet.has(e.id))
    );

    // Insert folder into collections
    this.folders.push(folder);
    const entry = { type: "folder", id: folder.id };
    const idx = Number.isInteger(insertIndex)
      ? Math.max(0, Math.min(insertIndex, this.rootOrder.length))
      : this.rootOrder.length;
    this.rootOrder.splice(idx, 0, entry);

    await this.save();
    return folder;
  }

  // =============== Site Management ==============

  /** Add a site to a folder */
  async addSite(folderId, siteData) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error("Folder not found");

    const name = this.sanitizeInput(siteData?.name || "New Site");
    const url = this.sanitizeUrl(siteData?.url || "");

    // Validate URL using URL constructor
    try {
      new URL(url);
    } catch (e) {
      throw new Error("Invalid URL");
    }

    const site = {
      id: this.generateId(),
      name,
      url,
      icon: siteData?.icon || this.generateFaviconUrl(url),
      ...["id", "name", "url", "icon"].reduce((acc, k) => acc, {}),
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
    if (!folder || !site) throw new Error("Site not found");
    if ("name" in data) site.name = this.sanitizeInput(data.name);
    if ("url" in data) {
      const u = this.sanitizeUrl(data.url);
      try {
        new URL(u);
      } catch (e) {
        throw new Error("Invalid URL");
      }
      site.url = u;
    }
    if ("icon" in data)
      site.icon = data.icon || this.generateFaviconUrl(site.url);
    // Copy any additional metadata fields except id
    for (const [k, v] of Object.entries(data)) {
      if (k === "id" || k === "name" || k === "url" || k === "icon") continue;
      site[k] = v;
    }
    await this.save();
    return site;
  }

  /** Delete a site from a folder */
  async deleteSite(folderId, siteId) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error("Folder not found");
    const idx = folder.sites.findIndex((s) => s.id === siteId);
    if (idx === -1) throw new Error("Site not found");
    const [removed] = folder.sites.splice(idx, 1);
    await this.save();
    return removed;
  }

  /** Move a site from a folder to the root grid as a link; insert into rootOrder at index (optional) */
  async moveSiteToRoot(folderId, siteId, insertIndex) {
    const folder = this.getFolderById(folderId);
    if (!folder) throw new Error("Folder not found");
    const idx = folder.sites.findIndex((s) => s.id === siteId);
    if (idx === -1) throw new Error("Site not found");
    const [site] = folder.sites.splice(idx, 1);

    // Create a root link from site
    const link = {
      id: this.generateId(),
      name: this.sanitizeInput(site.name),
      url: this.sanitizeUrl(site.url),
      icon: site.icon || this.generateFaviconUrl(site.url),
    };
    this.links.push(link);
    const entry = { type: "link", id: link.id };
    const idxIns = Number.isInteger(insertIndex)
      ? Math.max(0, Math.min(insertIndex, this.rootOrder.length))
      : this.rootOrder.length;
    this.rootOrder.splice(idxIns, 0, entry);

    await this.save();
    return link;
  }

  /** Move a site between folders */
  async moveSiteBetweenFolders(sourceFolderId, siteId, targetFolderId) {
    if (sourceFolderId === targetFolderId)
      return this.getFolderById(targetFolderId);
    const source = this.getFolderById(sourceFolderId);
    const target = this.getFolderById(targetFolderId);
    if (!source || !target) throw new Error("Folder not found");
    const idx = source.sites.findIndex((s) => s.id === siteId);
    if (idx === -1) throw new Error("Site not found");
    const [site] = source.sites.splice(idx, 1);
    target.sites.push(site);
    await this.save();
    return target;
  }

  /** Generate a favicon URL from a site URL */
  generateFaviconUrl(url) {
    try {
      const u = new URL(url);
      // Use DuckDuckGo favicon service for reliable icons
      return `https://icons.duckduckgo.com/ip3/${u.hostname}.ico`;
    } catch (e) {
      return "https://icons.duckduckgo.com/ip3/duckduckgo.com.ico";
    }
  }

  // =============== Helpers ======================

  getFolderById(id) {
    return this.folders.find((f) => f.id === id);
  }

  getSiteById(folderId, siteId) {
    const folder = this.getFolderById(folderId);
    if (!folder) return { folder: null, site: null };
    const site = folder.sites.find((s) => s.id === siteId);
    return { folder, site };
  }
}

// Export to window for use by other modules
if (typeof window !== "undefined") {
  window.FolderSystem = FolderSystem;
}
