// RenderManager - DOM creation and rendering logic
// Handles folder elements, link tiles, previews, adaptive backgrounds, and grid layout

class RenderManager extends ComponentManager {
  /**
   * @param {HTMLElement} container - The main container element
   * @param {FolderSystem} folderSystem - The folder system instance
   */
  constructor(container, folderSystem) {
    super(container, folderSystem);
    
    // Favicon cache for performance
    this.faviconOk = new Set();
    this.faviconFail = new Set();
  }

  /**
   * Clear the container of all content
   */
  clearContainer() {
    this.container.innerHTML = "";
  }

  /**
   * Render the complete grid with folders and links
   * @param {Array} folders - Array of folder objects
   * @param {Array} links - Array of link objects
   */
  renderGrid(folders, links) {
    this.clearContainer();
    const items = this.folderSystem.getRootItems?.();
    if (Array.isArray(items) && items.length) {
      items.forEach(({ type, item }) => {
        const el = type === "link" 
          ? this.createLinkTile(item) 
          : this.createFolderElement(item);
        this.container.appendChild(el);
      });
    } else {
      // Fallback if ordering not available
      (links || []).forEach((link) =>
        this.container.appendChild(this.createLinkTile(link))
      );
      (folders || []).forEach((folder) =>
        this.container.appendChild(this.createFolderElement(folder))
      );
    }
    // Add-tile at the end
    this.container.appendChild(this.createAddTile());
  }

  /**
   * Backward compatibility method for rendering folders
   * @param {Array} folders - Array of folder objects
   */
  renderFolders(folders) {
    this.renderGrid(folders, this.folderSystem.getAllLinks?.() || []);
  }

  /**
   * Create the "Add" tile for adding new links
   * @returns {HTMLElement} The add tile element
   */
  createAddTile() {
    const add = document.createElement("div");
    add.className = "add-tile";
    add.setAttribute("tabindex", "0");
    add.setAttribute("role", "button");
    add.setAttribute("aria-label", "Add link");
    add.draggable = false;
    add.innerHTML =
      '<span aria-hidden="true">+</span><div class="add-label">Add</div>';
    
    // Emit events for UIManager to handle
    add.addEventListener("click", () => {
      this.emit('addLinkRequested');
    });
    add.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.emit('addLinkRequested');
      }
    });
    
    return add;
  }

  /**
   * Create a folder element with preview and styling
   * @param {Object} folder - The folder object
   * @returns {HTMLElement} The folder element
   */
  createFolderElement(folder) {
    const item = document.createElement("div");
    item.className = "folder-item";
    item.dataset.folderId = folder.id;
    item.setAttribute("tabindex", "0");
    item.setAttribute("draggable", "true");
    item.setAttribute("role", "button");
    item.setAttribute(
      "aria-label",
      `${folder.name} folder with ${folder.sites?.length || 0} sites`
    );
    item.setAttribute("aria-describedby", `folder-title-${folder.id}`);

    const button = document.createElement("div");
    button.className = "folder-button";

    const preview = this.createFolderPreview(folder.sites || []);
    // Append the preview container directly
    button.appendChild(preview);

    const title = this.createFolderTitle(folder.name || "Folder", folder.id);

    item.appendChild(button);
    item.appendChild(title);

    return item;
  }

  /**
   * Create folder preview with up to 4 site icons
   * @param {Array} sites - Array of site objects
   * @returns {HTMLElement} The preview wrapper
   */
  createFolderPreview(sites) {
    const container = document.createElement("div");
    container.className = "folder-preview-container";
    
    // Generate up to 4 preview icons (only create as many as we have)
    const previews = (sites || []).slice(0, 4);

    // Create only the icons we need (flexbox will handle layout)
    previews.forEach((site) => {
      const slot = document.createElement("div");
      slot.className = "folder-preview-icon";
      
      const img = document.createElement("img");
      const url = site.url;
      const src = this.folderSystem.getIconSrc(site);
      img.src = src;
      img.loading = "lazy";
      img.alt = site.name || "Site";
      
      // Add error handler for favicon fallback
      img.onerror = () => {
        // If the extension favicon API fails, use Google's service
        img.src = this.folderSystem.generateFallbackFaviconUrl(url);
      };
      
      slot.appendChild(img);
      
      // Apply adaptive background to preview icon (like main tiles)
      this.applyAdaptivePreviewBackground(slot, url);
      
      container.appendChild(slot);
    });
    
    return container;
  }

  /**
   * Apply adaptive background to preview icon based on site URL
   * @param {HTMLElement} slot - The preview icon slot element
   * @param {string} siteUrl - The site URL
   */
  applyAdaptivePreviewBackground(slot, siteUrl) {
    if (!slot || slot.dataset.adaptiveApplied) return;

    // Generate consistent color from domain (same as main tiles)
    const baseColor = this.generateDomainColor(siteUrl);
    const rgbColor = this.hslToRgb(baseColor);

    // Apply adaptive background with reduced opacity for preview tiles
    slot.style.setProperty(
      "background",
      `linear-gradient(135deg, rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.3), rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.15))`,
      "important"
    );
    slot.style.setProperty(
      "border-color",
      `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.4)`,
      "important"
    );

    slot.dataset.adaptiveApplied = "true";
  }

  /**
   * Create folder title element
   * @param {string} text - The folder name
   * @param {string} id - The folder ID
   * @returns {HTMLElement} The title element
   */
  createFolderTitle(text, id) {
    const title = document.createElement("div");
    title.className = "folder-title";
    title.textContent = text;
    title.id = `folder-title-${id || text.replace(/\s+/g, "-").toLowerCase()}`;
    return title;
  }

  /**
   * Create a link tile element
   * @param {Object} link - The link object
   * @returns {HTMLElement} The link tile element
   */
  createLinkTile(link) {
    // Wrapper with inner square button and label outside (like folder tiles)
    const wrapper = document.createElement("div");
    wrapper.className = "link-item";
    wrapper.dataset.linkId = link.id;
    wrapper.setAttribute("draggable", "true");

    const button = document.createElement("a");
    button.className = "link-button";
    button.href = link.url;
    // same-tab navigation
    button.addEventListener('click', (e) => {
      e.preventDefault();
      // Track click for popularity
      this.folderSystem.recordClick(link.id, null).catch(err => {
        console.warn('Failed to record click:', err);
      });
      try { 
        window.location.href = link.url; 
      } catch { 
        window.location.assign(link.url); 
      }
    });
    button.setAttribute("title", link.name || link.url);

    const img = document.createElement("img");
    const favicon = this.folderSystem.getIconSrc(link);
    img.src = favicon;
    img.loading = "lazy";
    img.alt = link.name || "Link";
    
    // Add error handler for favicon fallback
    img.onerror = () => {
      // If the extension favicon API fails, use Google's service
      img.src = this.folderSystem.generateFallbackFaviconUrl(link.url);
    };
    
    button.appendChild(img);

    const label = document.createElement("div");
    label.className = "link-title";
    label.textContent = link.name || link.url;

    wrapper.appendChild(button);
    wrapper.appendChild(label);

    // Apply adaptive background to tile
    this.applyAdaptiveTileBackground(img, link.url);

    return wrapper;
  }

  /**
   * Compute folder background from color
   * @param {string} color - The folder color
   * @returns {string} The computed background style
   */
  // ============ Adaptive Backgrounds ============

  /**
   * Apply adaptive background to tile based on site URL
   * @param {HTMLImageElement} imgEl - The image element
   * @param {string} siteUrl - The site URL
   */
  applyAdaptiveTileBackground(imgEl, siteUrl) {
    const button = imgEl.closest(".link-button");
    if (!button || button.dataset.adaptiveApplied) return;

    // Generate consistent color from domain
    const baseColor = this.generateDomainColor(siteUrl);

    // Convert HSL to RGB for alpha values
    const rgbColor = this.hslToRgb(baseColor);

    // Apply to entire tile with proper rgba transparency and !important to override CSS
    button.style.setProperty(
      "background",
      `linear-gradient(135deg, rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.25), rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.15))`,
      "important"
    );
    button.style.setProperty(
      "border",
      `1px solid rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.4)`,
      "important"
    );
    button.style.setProperty("--adaptive-color", baseColor);

    // Add class for CSS animations/effects
    button.classList.add("adaptive-bg");
    button.dataset.adaptiveApplied = "true";

    // Ensure icon stays clean
    imgEl.style.width = "32px";
    imgEl.style.height = "32px";
    imgEl.style.objectFit = "contain";
  }

  /**
   * Generate a consistent color for a domain based on its hostname
   * @param {string} url - The URL to generate color for
   * @returns {string} HSL color string
   */
  generateDomainColor(url) {
    try {
      const hostname = new URL(url).hostname;
      let hash = 0;
      for (let i = 0; i < hostname.length; i++) {
        const char = hostname.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      // Convert to HSL for pleasant colors
      const hue = Math.abs(hash) % 360;
      const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
      const lightness = 55 + (Math.abs(hash) % 15); // 55-70%

      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } catch (_) {
      return "hsl(220, 70%, 60%)"; // Default blue
    }
  }

  /**
   * Convert HSL color to RGB values for alpha transparency
   * @param {string} hslString - HSL color string like "hsl(220, 70%, 60%)"
   * @returns {Object} RGB object with r, g, b properties
   */
  hslToRgb(hslString) {
    // Parse HSL string like "hsl(220, 70%, 60%)"
    const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return { r: 66, g: 133, b: 244 }; // Default blue

    const h = parseInt(match[1]) / 360;
    const s = parseInt(match[2]) / 100;
    const l = parseInt(match[3]) / 100;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  /**
   * Clean up render manager and remove any cached data
   */
  cleanup() {
    this.faviconOk.clear();
    this.faviconFail.clear();
    super.cleanup();
  }
}

// Export for both ES6 modules and browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = RenderManager;
} else if (typeof window !== "undefined") {
  window.RenderManager = RenderManager;
}
