// NeoTab - UI Management and DOM Manipulation Layer
// Responsible for rendering folders/sites and handling user interactions

class UIManager {
  /**
   * @param {HTMLElement} container Folder grid container
   * @param {HTMLElement} overlay Full-screen overlay element
   * @param {FolderSystem} folderSystem Data/business logic layer
   */
  constructor(container, overlay, folderSystem) {
    if (!container) throw new Error('UIManager requires a container');
    if (!overlay) throw new Error('UIManager requires an overlay');
    if (!folderSystem) throw new Error('UIManager requires a FolderSystem');

    this.container = container;
    this.overlay = overlay;
    this.folderSystem = folderSystem;

    // Simple icon cache states
    this.faviconOk = new Set();
    this.faviconFail = new Set();

    this.bindEvents();
  }

  bindEvents() {
    // Event delegation for folder interactions
    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.folder-item');
      if (!item) return;
      const id = item.dataset.folderId;
      const folder = this.folderSystem.getFolderById(id);
      if (folder) this.showModal(folder);
    });

    // Right-click context menu (stub for now)
    this.container.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.folder-item');
      if (!item) return;
      e.preventDefault();
      // Placeholder for future context menu
      console.debug('Context menu requested for folder', item.dataset.folderId);
    });

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      const items = Array.from(this.container.querySelectorAll('.folder-item'));
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement);

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          const next = items[(currentIndex + 1 + items.length) % items.length];
          next?.focus();
          e.preventDefault();
          break;
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          const prev = items[(currentIndex - 1 + items.length) % items.length];
          prev?.focus();
          e.preventDefault();
          break;
        }
        case 'Enter':
        case ' ': {
          const item = document.activeElement?.closest?.('.folder-item');
          const id = item?.dataset?.folderId;
          if (id) {
            const folder = this.folderSystem.getFolderById(id);
            if (folder) this.showModal(folder);
          }
          e.preventDefault();
          break;
        }
        default:
          break;
      }
    });

    // Overlay close on background click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hideModal();
    });

    // ESC to close overlay
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideModal();
    });

    // Basic swipe-down to close (mobile)
    let touchStartY = null;
    this.overlay.addEventListener('touchstart', (e) => {
      touchStartY = e.touches?.[0]?.clientY ?? null;
    });
    this.overlay.addEventListener('touchend', (e) => {
      const endY = e.changedTouches?.[0]?.clientY ?? null;
      if (touchStartY != null && endY != null && endY - touchStartY > 60) {
        this.hideModal();
      }
      touchStartY = null;
    });
  }

  // ============ Rendering ============

  clearContainer() {
    this.container.innerHTML = '';
  }

  renderFolders(folders) {
    this.clearContainer();
    folders.forEach((folder) => {
      const el = this.createFolderElement(folder);
      this.container.appendChild(el);
    });
    // Focus the first item for keyboard nav
    const first = this.container.querySelector('.folder-item');
    first?.focus();
  }

  createFolderElement(folder) {
    const item = document.createElement('div');
    item.className = 'folder-item';
    item.dataset.folderId = folder.id;
    item.setAttribute('tabindex', '0');

    const button = document.createElement('div');
    button.className = 'folder-button';
    if (folder.color) button.style.background = this.computeFolderBg(folder.color);

    const preview = this.createFolderPreview(folder.sites || []);
    button.appendChild(preview);

    // button contains the 2x2 grid already; preview returns a fragment-like div
    while (preview.firstChild) {
      button.appendChild(preview.firstChild);
    }

    const title = this.createFolderTitle(folder.name || 'Folder');

    item.appendChild(button);
    item.appendChild(title);

    return item;
  }

  createFolderPreview(sites) {
    const wrapper = document.createElement('div');
    // generate up to 4 preview icons
    const previews = (sites || []).slice(0, 4);

    // Create exactly 4 slots for consistent layout
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement('div');
      slot.className = 'folder-preview-icon';
      if (previews[i]) {
        const img = document.createElement('img');
        const url = previews[i].url;
        const src = previews[i].icon || this.folderSystem.generateFaviconUrl(url);
        img.src = src;
        img.loading = 'lazy';
        img.alt = previews[i].name || 'Site';
        this.attachFaviconErrorHandler(img, url);
        slot.appendChild(img);
      } else {
        // empty slot visual
        slot.style.opacity = '0.6';
      }
      wrapper.appendChild(slot);
    }
    return wrapper;
  }

  createFolderTitle(text) {
    const title = document.createElement('div');
    title.className = 'folder-title';
    title.textContent = text;
    return title;
  }

  // ============ Modal / Overlay ============

  showModal(folder) {
    // Clear previous content
    this.overlay.innerHTML = '';

    const modal = this.createModal(folder);
    this.overlay.appendChild(modal);
    this.overlay.classList.add('open');
    this.overlay.style.display = 'flex';
  }

  hideModal() {
    if (!this.overlay.classList.contains('open')) return;
    this.overlay.classList.remove('open');
    this.overlay.style.display = 'none';
    this.overlay.innerHTML = '';
  }

  createModal(folder) {
    const modal = document.createElement('div');
    modal.className = 'folder-modal';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '16px';

    const title = document.createElement('h2');
    title.textContent = folder.name || 'Folder';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.margin = '0';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'var(--text-color)';
    closeBtn.style.border = '1px solid rgba(255,255,255,0.2)';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.padding = '6px 10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', () => this.hideModal());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const grid = document.createElement('div');
    grid.className = 'site-grid';

    (folder.sites || []).forEach((site) => {
      const tile = document.createElement('a');
      tile.className = 'site-tile';
      tile.href = site.url;
      tile.target = '_blank';
      tile.rel = 'noopener noreferrer';
      tile.setAttribute('title', site.name || site.url);

      const iconWrap = document.createElement('div');
      iconWrap.style.width = '28px';
      iconWrap.style.height = '28px';
      iconWrap.style.marginRight = '10px';
      iconWrap.style.display = 'flex';
      iconWrap.style.alignItems = 'center';
      iconWrap.style.justifyContent = 'center';
      iconWrap.style.borderRadius = '6px';
      iconWrap.style.background = 'rgba(255,255,255,0.12)';

      const img = document.createElement('img');
      const favicon = site.icon || this.folderSystem.generateFaviconUrl(site.url);
      img.src = favicon;
      img.loading = 'lazy';
      img.alt = site.name || 'Site';
      img.width = 20;
      img.height = 20;
      this.attachFaviconErrorHandler(img, site.url);
      iconWrap.appendChild(img);

      const label = document.createElement('span');
      label.textContent = site.name || site.url;
      label.style.marginLeft = '4px';

      tile.style.display = 'flex';
      tile.style.alignItems = 'center';
      tile.style.padding = '10px';

      tile.appendChild(iconWrap);
      tile.appendChild(label);

      grid.appendChild(tile);
    });

    modal.appendChild(header);
    modal.appendChild(grid);
    return modal;
  }

  // ============ Favicon helpers ============

  attachFaviconErrorHandler(img, url) {
    const originKey = this.safeOrigin(url);
    img.addEventListener('error', () => {
      if (this.faviconFail.has(originKey)) {
        img.src = this.defaultFaviconDataUri();
        return;
      }
      // Try chrome://favicon on origin, then fallback
      try {
        const origin = new URL(url).origin;
        const alt = `chrome://favicon/${origin}`;
        if (img.src !== alt) {
          img.src = alt;
          this.faviconFail.add(originKey);
          return;
        }
      } catch (_) {
        // ignore
      }
      img.src = this.defaultFaviconDataUri();
    });

    img.addEventListener('load', () => {
      this.faviconOk.add(originKey);
    });
  }

  safeOrigin(url) {
    try { return new URL(url).origin; } catch { return url; }
  }

  defaultFaviconDataUri() {
    // Lightweight inline SVG fallback (1x) tinted with primary color
    const svg = encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'>` +
      `<rect rx='4' width='20' height='20' fill='%234285f4'/>` +
      `<path d='M6 10h8' stroke='white' stroke-width='2' stroke-linecap='round'/>` +
      `</svg>`
    );
    return `data:image/svg+xml;charset=UTF-8,${svg}`;
  }

  computeFolderBg(color) {
    // Subtle gradient based on color
    return `linear-gradient(160deg, ${color} 0%, rgba(255,255,255,0.08) 100%)`;
  }
}

if (typeof window !== 'undefined') {
  window.UIManager = UIManager;
}
