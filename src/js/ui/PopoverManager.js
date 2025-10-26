// PopoverManager - Handles complex folder popover functionality with positioning, backdrop, and inline editing
class PopoverManager extends ComponentManager {
  constructor(container, folderSystem, renderManager) {
    super(container, folderSystem);
    this.currentPopover = null;
    this.renderManager = renderManager;
  }

  // ============ Main Popover Methods ============

  showFolderPopover(folder, anchorEl, clickPoint) {
    // Remove any existing popover
    this.closeFolderPopover();

    // Create invisible backdrop to capture outside clicks
    const backdrop = this.createBackdrop();
    const pop = this.createPopover(folder);
    
    // Position the popover
    this.positionPopover(pop, anchorEl, clickPoint);
    
    // Set up event handlers
    this.attachPopoverEvents(pop, backdrop, folder);
    
    // Trigger transition to visible state
    this.showPopover(pop);

    // Track resources for cleanup
    pop._backdrop = backdrop;
    pop._anchor = anchorEl;
    pop._folderId = folder.id;

    this.currentPopover = pop;
  }

  closeFolderPopover() {
    if (this.currentPopover) {
      // Cleanup listeners
      this.currentPopover._cleanup?.();
      // Remove nodes
      this.currentPopover._backdrop?.remove();
      this.currentPopover.remove();
      this.currentPopover = null;
      this.emit('popoverClosed'); // Emit event for coordination
    }
  }

  // ============ Popover Creation ============

  createBackdrop() {
    const backdrop = document.createElement("div");
    backdrop.className = "folder-popover-backdrop";
    document.body.appendChild(backdrop);
    return backdrop;
  }

  createPopover(folder) {
    const pop = document.createElement("div");
    pop.className = "folder-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-labelledby", "folder-popover-title");

    const grid = this.createSiteGrid(folder);
    const titleEl = this.createEditableTitle(folder, pop);

    pop.appendChild(grid);
    pop.appendChild(titleEl);
    document.body.appendChild(pop);

    return pop;
  }

  createSiteGrid(folder) {
    const grid = document.createElement("div");
    grid.className = "site-grid";
    
    (folder.sites || []).forEach((site) => {
      const wrapper = this.createSiteWrapper(site, folder.id);
      grid.appendChild(wrapper);
    });

    return grid;
  }

  createSiteWrapper(site, folderId) {
    // Use same visual structure as root grid link tiles
    const wrapper = document.createElement("div");
    wrapper.className = "link-item popover-site";
    wrapper.setAttribute("draggable", "true");
    wrapper.dataset.folderId = folderId;
    wrapper.dataset.siteId = site.id;

    const button = document.createElement("a");
    button.className = "link-button";
    button.href = site.url;
    // same-tab navigation from popover tiles
    button.addEventListener('click', (e) => {
      e.preventDefault();
      // Track click for popularity
      this.folderSystem.recordClick(site.id, folderId).catch(err => {
        console.warn('Failed to record click:', err);
      });
      this.navigateToSite(site.url);
    });
    button.setAttribute("title", site.name || site.url);

    const img = document.createElement("img");
    const favicon = this.folderSystem.getIconSrc(site);
    img.src = favicon;
    img.loading = "lazy";
    img.alt = site.name || "Site";
    
    // Add error handler for favicon fallback
    img.onerror = () => {
      img.src = this.folderSystem.generateFallbackFaviconUrl(site.url);
    };
    
    button.appendChild(img);

    const label = document.createElement("div");
    label.className = "link-title";
    label.textContent = site.name || site.url;

    // Apply adaptive background to tile
    this.applyAdaptiveTileBackground(img, site.url);

    // DnD payload from popover
    this.attachDragEvents(wrapper, site, folderId);

    wrapper.appendChild(button);
    wrapper.appendChild(label);
    
    return wrapper;
  }

  createEditableTitle(folder, pop) {
    const titleEl = document.createElement("div");
    titleEl.className = "popover-title";
    titleEl.textContent = folder.name || "Folder";
    titleEl.title = "Click to rename";
    
    titleEl.addEventListener("click", () => {
      this.startInlineEdit(titleEl, folder, pop);
    });
    
    return titleEl;
  }

  // ============ Inline Editing ============

  async startInlineEdit(titleEl, folder, pop) {
    // Swap to input for inline rename
    const input = document.createElement("input");
    input.type = "text";
    input.className = "popover-title-input";
    input.value = folder.name || "Folder";
    
    // Replace node
    pop.replaceChild(input, titleEl);
    
    // Focus and select all text
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const newName = input.value.trim();
      
      // Restore title element if input still mounted
      titleEl.textContent = newName || folder.name || "Folder";
      if (input.isConnected) {
        try {
          pop.replaceChild(titleEl, input);
        } catch (_) {
          /* ignore */
        }
      }
      
      if (newName && newName !== folder.name) {
        try {
          await this.folderSystem.updateFolder(folder.id, { name: newName });
          // Emit event for UIManager to refresh
          this.emit('folderRenamed', { folderId: folder.id, newName });
          // Also update local folder ref for current session
          folder.name = newName;
        } catch (err) {
          console.error("Failed to rename folder:", err);
          // Revert UI text on error
          titleEl.textContent = folder.name || "Folder";
        }
      }
    };

    const onKey = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Avoid blur triggering another commit
        input.removeEventListener("blur", onBlur);
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Cancel edit
        if (input.isConnected) {
          try {
            pop.replaceChild(titleEl, input);
          } catch (_) {
            /* ignore */
          }
        }
        done = true; // prevent blur commit
      }
    };
    
    const onBlur = () => commit();
    input.addEventListener("keydown", onKey);
    input.addEventListener("blur", onBlur, { once: true });
  }

  // ============ Positioning Logic ============

  positionPopover(pop, anchorEl, clickPoint) {
    // Position centered around click/anchor; fallback to anchor center if clickPoint missing
    const anchorRect = anchorEl?.getBoundingClientRect?.();
    const cx = anchorRect
      ? anchorRect.left + anchorRect.width / 2
      : clickPoint?.x ?? window.innerWidth / 2;
    const cy = anchorRect
      ? anchorRect.top + anchorRect.height / 2
      : clickPoint?.y ?? window.innerHeight / 2;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    
    // Get actual popover dimensions after rendering
    const popW = pop.offsetWidth || 420;
    const popH = pop.offsetHeight || 420;

    // Initial top-left so that the popover center sits at the click point
    let x = Math.round(cx - popW / 2);
    let y = Math.round(cy - popH / 2);

    // Clamp inside viewport with small margins
    const margin = 12;
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    if (x + popW > viewportW - margin)
      x = Math.max(margin, viewportW - popW - margin);
    if (y + popH > viewportH - margin)
      y = Math.max(margin, viewportH - popH - margin);

    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;

    // Set transform origin relative to click point within the popover box to enhance the "expanding from click" effect
    const originX = Math.round(((cx - x) / popW) * 100);
    const originY = Math.round(((cy - y) / popH) * 100);
    pop.style.transformOrigin = `${originX}% ${originY}%`;
  }

  showPopover(pop) {
    // Trigger transition to visible state
    requestAnimationFrame(() => {
      pop.style.opacity = "1";
      pop.style.transform = "scale(1)";
    });
  }

  // ============ Event Handling ============

  attachPopoverEvents(pop, backdrop, folder) {
    // Close interactions
    const onBackdropClick = (e) => {
      // Any click on the backdrop closes the popover
      this.closeFolderPopover();
    };
    
    const onEsc = (e) => {
      if (e.key === "Escape") this.closeFolderPopover();
    };

    // Drag and drop support for backdrop - allow events to pass through
    const onBackdropDragOver = (e) => {
      e.preventDefault();
      // Forward the event to the main grid by temporarily hiding backdrop
      backdrop.style.pointerEvents = "none";
      const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
      backdrop.style.pointerEvents = "";

      // If we're over the main content area, handle the drag over
      const mainContent = document.querySelector(".main-content");
      if (
        mainContent &&
        (mainContent.contains(elementBelow) ||
          this.container.contains(elementBelow))
      ) {
        this.emit('dragOver', e);
      }
    };

    const onBackdropDrop = (e) => {
      e.preventDefault();
      // Forward the event to the main grid by temporarily hiding backdrop
      backdrop.style.pointerEvents = "none";
      const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
      backdrop.style.pointerEvents = "";

      // If we're over the main content area, handle the drop
      const mainContent = document.querySelector(".main-content");
      if (
        mainContent &&
        (mainContent.contains(elementBelow) ||
          this.container.contains(elementBelow))
      ) {
        this.emit('drop', e);
      }
    };

    // Attach listeners after next tick to avoid immediate close from the opening click
    setTimeout(() => {
      backdrop.addEventListener("click", onBackdropClick);
      backdrop.addEventListener("dragover", onBackdropDragOver);
      backdrop.addEventListener("drop", onBackdropDrop);
      document.addEventListener("keydown", onEsc);
    }, 0);

    // Track cleanup function
    pop._cleanup = () => {
      backdrop.removeEventListener("click", onBackdropClick);
      backdrop.removeEventListener("dragover", onBackdropDragOver);
      backdrop.removeEventListener("drop", onBackdropDrop);
      document.removeEventListener("keydown", onEsc);
    };
  }

  attachDragEvents(wrapper, site, folderId) {
    wrapper.addEventListener("dragstart", (e) => {
      const payload = { type: "site", folderId: folderId, id: site.id };
      e.dataTransfer.setData("application/json", JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
      wrapper.classList.add("dragging");
      
      // Emit drag start event
      this.emit('dragStart', { element: wrapper, payload });
    });
    
    wrapper.addEventListener("dragend", () => {
      wrapper.classList.remove("dragging");
      this.emit('dragEnd', { element: wrapper });
    });
  }

  // ============ Utility Methods ============

  navigateToSite(url) {
    try { 
      window.location.href = url; 
    } catch { 
      window.location.assign(url); 
    }
  }

  applyAdaptiveTileBackground(imgEl, siteUrl) {
    this.renderManager.applyAdaptiveTileBackground(imgEl, siteUrl);
  }

  generateDomainColor(url) {
    return this.renderManager.generateDomainColor(url);
  }

  hslToRgb(hslString) {
    return this.renderManager.hslToRgb(hslString);
  }

  // ============ Cleanup ============

  cleanup() {
    this.closeFolderPopover();
    super.cleanup();
  }
}
