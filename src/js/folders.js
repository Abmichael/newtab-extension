// tilio - Folder System Business Logic (no UI dependencies)
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
			this.data.meta = {
				lastTopSitesSync: 0,
				topSitesSeeded: false,
				topSitesBlacklist: [],
			};
		// Ensure topSitesBlacklist exists for backward compatibility
		if (!Array.isArray(this.data.meta.topSitesBlacklist))
			this.data.meta.topSitesBlacklist = [];

		// Normalize icons after loading
		this.normalizeIcons();

		return this.folders;
	}

	/**
	 * Normalize all icons to object format {type: 'generated'|'static', pageUrl?: string, url?: string, size?: number}
	 * Handles backward compatibility for string icons
	 */
	normalizeIcons() {
		const normalizeSingle = (item) => {
			if (!item || !item.url) return;

			if (!item.icon) {
				item.icon = { type: "generated", pageUrl: item.url, size: 32 };
				return;
			}

			if (typeof item.icon === "object" && item.icon.type) {
				return; // already normalized
			}

			// Handle string icon
			const iconStr = String(item.icon);
			const match = iconStr.match(
				/^chrome-extension:\/\/[^\/]+\/_favicon\/\?pageUrl=([^&]+)&size=(\d+)$/,
			);
			if (match) {
				const [, encodedPageUrl, sizeStr] = match;
				item.icon = {
					type: "generated",
					pageUrl: decodeURIComponent(encodedPageUrl),
					size: parseInt(sizeStr) || 32,
				};
			} else {
				item.icon = { type: "static", url: iconStr };
			}
		};

		// Normalize root links
		this.links.forEach(normalizeSingle);

		// Normalize sites in folders
		this.folders.forEach((folder) => {
			if (Array.isArray(folder.sites)) {
				folder.sites.forEach(normalizeSingle);
			}
		});
	}

	/**
	 * Get the src URL for an icon object or generate if needed
	 * @param {Object} item - link or site object
	 * @returns {string} icon src URL
	 */
	getIconSrc(item) {
		if (!item || !item.icon) {
			return this.generateFaviconUrl(item.url, 32);
		}

		const icon = item.icon;
		if (icon.type === "generated") {
			return this.generateFaviconUrl(icon.pageUrl, icon.size || 32);
		}
		return icon.url || this.generateFaviconUrl(item.url, 32);
	}

	/** Persist current data to storage */
	async save() {
		// this.data.folders already points to this.folders
		this.data.links = this.links;
		this.data.rootOrder = this.rootOrder;
		return await this.storage.saveData(this.data);
	}

	// =============== Top Sites Helper Functions ===============
	/**
	 * Normalize URL hostname by removing 'www.' subdomain
	 * @param {string} url - The URL to normalize
	 * @returns {string} Normalized hostname
	 */
	normalizeHostname(url) {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname.startsWith("www.") ? hostname.substring(4) : hostname;
		} catch {
			return url.toLowerCase();
		}
	}

	/**
	 * Check if URL is a search engine
	 * @param {string} url - The URL to check
	 * @returns {boolean}
	 */
	isSearchEngine(url) {
		const searchEngines = [
			"google.com",
			"bing.com",
			"duckduckgo.com",
			"yahoo.com",
			"baidu.com",
			"yandex.com",
			"ask.com",
			"aol.com",
			"brave.com/search",
			"ecosia.org",
			"startpage.com",
			"qwant.com",
			"searx.me",
			"mojeek.com",
		];

		try {
			const normalized = this.normalizeHostname(url);
			return searchEngines.some(
				(engine) => normalized === engine || normalized.endsWith("." + engine),
			);
		} catch {
			return false;
		}
	}

	/**
	 * Check if URL is a PWA (identified by utm_source=homescreen)
	 * @param {string} url - The URL to check
	 * @returns {boolean}
	 */
	isPWA(url) {
		try {
			const urlObj = new URL(url);
			return urlObj.searchParams.get("utm_source") === "homescreen";
		} catch {
			return false;
		}
	}

	/**
	 * Check if URL should be excluded from top sites population
	 * @param {string} url - The URL to check
	 * @returns {boolean}
	 */
	shouldExcludeFromTopSites(url) {
		// Check blacklist
		const normalized = this.normalizeHostname(url);
		const blacklist = this.data.meta?.topSitesBlacklist || [];
		const isBlacklisted = blacklist.some((item) => {
			const blacklistedHost = this.normalizeHostname(item);
			return normalized === blacklistedHost;
		});

		if (isBlacklisted) return true;

		// Check if it's a search engine
		if (this.isSearchEngine(url)) return true;

		// Check if it's a PWA
		if (this.isPWA(url)) return true;

		return false;
	}

	/**
	 * Add URL to top sites blacklist
	 * @param {string} url - The URL to blacklist
	 */
	async addToTopSitesBlacklist(url) {
		if (!this.data.meta.topSitesBlacklist) {
			this.data.meta.topSitesBlacklist = [];
		}

		const normalized = this.normalizeHostname(url);
		// Don't add if already blacklisted (check normalized)
		const alreadyBlacklisted = this.data.meta.topSitesBlacklist.some(
			(item) => this.normalizeHostname(item) === normalized,
		);

		if (!alreadyBlacklisted) {
			this.data.meta.topSitesBlacklist.push(url);
			await this.save();
		}
	}

	/**
	 * Mark a link as originating from top sites
	 * @param {Object} link - The link object to mark
	 */
	markAsTopSite(link) {
		if (!link.metadata) {
			link.metadata = {};
		}
		link.metadata.fromTopSites = true;
		link.metadata.addedAt = Date.now();
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

			// Get all existing hosts to prevent duplicates (uses normalized hostnames)
			const existingHosts = this.getAllExistingHosts();

			const picked = sites.slice(0, maxLinks);
			for (const s of picked) {
				// Skip if should be excluded (search engines, PWAs, blacklisted)
				if (this.shouldExcludeFromTopSites(s.url)) continue;

				// Check for duplicates using normalized hostname
				const normalizedHost = this.normalizeHostname(s.url);
				if (existingHosts.has(normalizedHost)) continue;

				// Create link with tracking metadata
				const link = await this.addRootLink({
					name: s.title || s.url,
					url: s.url,
				});
				this.markAsTopSite(link);

				existingHosts.add(normalizedHost); // Track newly added hosts
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

			// Get all existing hosts from both root links AND folder sites (uses normalized hostnames)
			const existingHosts = this.getAllExistingHosts();

			let added = 0;
			for (const s of sites) {
				if (added >= (options.cap || 24)) break;

				// Skip if should be excluded (search engines, PWAs, blacklisted)
				if (this.shouldExcludeFromTopSites(s.url)) continue;

				// Check for duplicates using normalized hostname
				const normalizedHost = this.normalizeHostname(s.url);
				if (existingHosts.has(normalizedHost)) continue;

				// Create link with tracking metadata
				const link = await this.addRootLink({
					name: s.title || normalizedHost,
					url: s.url,
				});
				this.markAsTopSite(link);

				existingHosts.add(normalizedHost);
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

	/**
	 * Get all existing hostnames from both root links and folder sites
	 * @returns {Set<string>} Set of normalized hostnames that already exist in the system
	 */
	getAllExistingHosts() {
		const hosts = new Set();

		// Add root-level links (normalized)
		this.links.forEach((link) => {
			const normalized = this.normalizeHostname(link.url);
			hosts.add(normalized);
		});

		// Add sites from all folders (normalized)
		this.folders.forEach((folder) => {
			if (Array.isArray(folder.sites)) {
				folder.sites.forEach((site) => {
					const normalized = this.normalizeHostname(site.url);
					hosts.add(normalized);
				});
			}
		});

		return hosts;
	}

	/** Sanitize text */
	sanitizeInput(text) {
		if (typeof text !== "string") return text;
		return typeof this.storage.escapeHtml === "function"
			? this.storage.escapeHtml(text)
			: text.replace(
					/[&<>"]+/g,
					(s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[s],
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
			(e) => !(e.type === "folder" && e.id === id),
		);
		await this.save();
		return removed;
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
						: null,
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
		let iconObj;
		if (linkData?.icon) {
			iconObj =
				typeof linkData.icon === "string"
					? { type: "static", url: linkData.icon }
					: linkData.icon;
		} else {
			iconObj = { type: "generated", pageUrl: url, size: 32 };
		}
		const link = {
			id: this.generateId(),
			name,
			url,
			icon: iconObj,
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
			if (!("icon" in data)) {
				link.icon = { type: "generated", pageUrl: u, size: 32 };
			}
		}
		if ("icon" in data) {
			if (data.icon) {
				link.icon =
					typeof data.icon === "string"
						? { type: "static", url: data.icon }
						: data.icon;
			} else {
				link.icon = { type: "generated", pageUrl: link.url, size: 32 };
			}
		}
		await this.save();
		return link;
	}

	/** Delete a root-level link */
	async deleteRootLink(linkId) {
		const idx = this.links.findIndex((l) => l.id === linkId);
		if (idx === -1) throw new Error("Link not found");
		const [removed] = this.links.splice(idx, 1);
		this.rootOrder = this.rootOrder.filter(
			(e) => !(e.type === "link" && e.id === linkId),
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

	/** Move a root link into a folder as a site */
	async moveLinkToFolder(linkId, folderId) {
		const folder = this.getFolderById(folderId);
		if (!folder) throw new Error("Folder not found");
		const idx = this.links.findIndex((l) => l.id === linkId);
		if (idx === -1) throw new Error("Link not found");
		const [link] = this.links.splice(idx, 1);
		this.rootOrder = this.rootOrder.filter(
			(e) => !(e.type === "link" && e.id === linkId),
		);

		// Convert to site, copy icon object
		const site = {
			id: this.generateId(),
			name: this.sanitizeInput(link.name),
			url: this.sanitizeUrl(link.url),
			icon: link.icon || { type: "generated", pageUrl: link.url, size: 32 },
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
					: `${selected[0].name || "Folder"} +${selected.length - 1}`),
		);

		// Create folder and convert links to sites
		const folder = {
			id: this.generateId(),
			name,
			sites: selected.map((l) => ({
				id: this.generateId(),
				name: this.sanitizeInput(l.name),
				url: this.sanitizeUrl(l.url),
				icon: l.icon || { type: "generated", pageUrl: l.url, size: 32 },
			})),
		};

		// Remove links from root collections
		const linkIdSet = new Set(linkIds);
		this.links = this.links.filter((l) => !linkIdSet.has(l.id));
		this.rootOrder = this.rootOrder.filter(
			(e) => !(e.type === "link" && linkIdSet.has(e.id)),
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

		let iconObj;
		if (siteData?.icon) {
			iconObj =
				typeof siteData.icon === "string"
					? { type: "static", url: siteData.icon }
					: siteData.icon;
		} else {
			iconObj = { type: "generated", pageUrl: url, size: 32 };
		}

		const site = {
			id: this.generateId(),
			name,
			url,
			icon: iconObj,
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
			if (!("icon" in data)) {
				site.icon = { type: "generated", pageUrl: u, size: 32 };
			}
		}
		if ("icon" in data) {
			if (data.icon) {
				site.icon =
					typeof data.icon === "string"
						? { type: "static", url: data.icon }
						: data.icon;
			} else {
				site.icon = { type: "generated", pageUrl: site.url, size: 32 };
			}
		}
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

		// Create a root link from site, copy icon object
		const link = {
			id: this.generateId(),
			name: this.sanitizeInput(site.name),
			url: this.sanitizeUrl(site.url),
			icon: site.icon || { type: "generated", pageUrl: site.url, size: 32 },
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

	/** Generate a favicon URL from a site URL */
	generateFaviconUrl(url, size = 32) {
		try {
			// Use Chrome Extension Favicon API (requires "favicon" permission)
			const faviconBaseUrl = new URL(chrome.runtime.getURL("/_favicon/"));
			faviconBaseUrl.searchParams.set("pageUrl", url);
			faviconBaseUrl.searchParams.set("size", size.toString());
			return faviconBaseUrl.toString();
		} catch (e) {
			// Fallback for invalid URLs or when chrome.runtime is not available
			return this.generateFallbackFaviconUrl(url, size);
		}
	}

	/** Generate a fallback favicon URL for browsers that don't support chrome://favicon */
	generateFallbackFaviconUrl(url, size = 32) {
		try {
			const u = new URL(url);
			// Use Google's favicon service as fallback
			return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=${size}`;
		} catch (e) {
			return `https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=${size}`;
		}
	}

	// =============== Popularity Tracking ======================

	/**
	 * Initialize popularity metadata for an item (link or site)
	 * @param {Object} item - link or site object
	 */
	initializePopularity(item) {
		if (!item.popularity) {
			item.popularity = {
				clicks: 0,
				lastClicked: null,
				createdAt: Date.now(),
			};
		}
	}

	/**
	 * Record a click for a link or site
	 * @param {string} itemId - ID of the link or site
	 * @param {string|null} folderId - ID of folder if tracking a site, null for root link
	 */
	async recordClick(itemId, folderId = null) {
		let item;
		
		if (folderId) {
			// Track site within folder
			const result = this.getSiteById(folderId, itemId);
			if (!result.site) return;
			item = result.site;
		} else {
			// Track root link
			item = this.links.find((l) => l.id === itemId);
			if (!item) return;
		}

		this.initializePopularity(item);
		item.popularity.clicks++;
		item.popularity.lastClicked = Date.now();

		await this.save();
		
		// Note: Sorting happens on next page load, not immediately
		// This avoids disorienting reordering while user is browsing
	}

	/**
	 * Calculate a popularity score for an item based on clicks and recency
	 * Higher score = more popular
	 * @param {Object} item - link or site object
	 * @returns {number} popularity score
	 */
	calculatePopularityScore(item) {
		if (!item.popularity) return 0;

		const clicks = item.popularity.clicks || 0;
		const lastClicked = item.popularity.lastClicked || 0;
		const createdAt = item.popularity.createdAt || Date.now();

		// Time-based decay: clicks from recent periods are worth more
		const now = Date.now();
		const daysSinceLastClick = lastClicked 
			? (now - lastClicked) / (1000 * 60 * 60 * 24)
			: 365; // If never clicked, treat as a year ago

		// Decay factor: reduce value of old clicks
		// 1.0 = clicked today, ~0.5 = clicked 30 days ago, ~0.1 = clicked 90 days ago
		const decayFactor = Math.exp(-daysSinceLastClick / 45);

		// Base score from clicks with time decay
		const clickScore = clicks * decayFactor;

		// Bonus for items created recently (helps new items compete)
		const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);
		const newItemBonus = daysSinceCreation < 7 ? 0.5 : 0;

		return clickScore + newItemBonus;
	}

	/**
	 * Sort root items by popularity if enabled in settings
	 * Only sorts links; folders always appear first in their original order
	 * @returns {boolean} whether sorting was applied
	 */
	async sortByPopularity() {
		const settings = this.data.settings || {};
		if (!settings.autoSortByPopularity) return false;

		// Initialize popularity for all items
		this.links.forEach(link => this.initializePopularity(link));
		this.folders.forEach(folder => {
			folder.sites?.forEach(site => this.initializePopularity(site));
		});

		// Separate folders and links from rootOrder
		const folderEntries = this.rootOrder.filter(e => e.type === 'folder');
		const linkEntries = this.rootOrder.filter(e => e.type === 'link');

		// Create a map of link scores
		const scoreMap = new Map();
		linkEntries.forEach(entry => {
			const link = this.links.find(l => l.id === entry.id);
			if (link) {
				scoreMap.set(entry, this.calculatePopularityScore(link));
			}
		});

		// Sort only links by popularity score (descending)
		linkEntries.sort((a, b) => {
			const scoreA = scoreMap.get(a) || 0;
			const scoreB = scoreMap.get(b) || 0;
			return scoreB - scoreA;
		});

		// Reconstruct rootOrder: folders first (in original order), then sorted links
		this.rootOrder = [...folderEntries, ...linkEntries];

		await this.save();
		return true;
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
