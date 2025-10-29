// tilio - Drag and Drop Manager Component
// Handles simplified drag and drop functionality for merging operations only

class DragDropManager extends ComponentManager {
  /**
   * @param {HTMLElement} container - Main container element
   * @param {FolderSystem} folderSystem - Data layer
   * @param {Object} delegates - Manager delegates for UI updates
   */
  constructor(container, folderSystem, delegates = {}) {
    super(container, folderSystem);
    this.delegates = delegates;
    
    // Drag and drop state
    this.draggedElement = null;
    this.lastHoverEl = null;

    this.initialize();
  }

  initialize() {
    // Listen on container for grid items
    this.addEventListener(this.container, "dragstart", this.onDragStart.bind(this));

    // Global listeners to handle drops from popovers to main grid
    const handleGlobalDragOver = (e) => {
      // Allow dropping on the main content area (broader than just the container)
      const mainContent = document.querySelector(".main-content");
      const isDropZone =
        mainContent &&
        (mainContent.contains(e.target) ||
          this.container.contains(e.target) ||
          e.target === this.container ||
          e.target === mainContent);

      if (!isDropZone) return;
      this.onDragOver(e);
    };

    const handleGlobalDrop = (e) => {
      // Allow dropping on the main content area (broader than just the container)
      const mainContent = document.querySelector(".main-content");
      const isDropZone =
        mainContent &&
        (mainContent.contains(e.target) ||
          this.container.contains(e.target) ||
          e.target === this.container ||
          e.target === mainContent);

      if (!isDropZone) return;
      this.onDrop(e);
    };

    this.addEventListener(document, "dragover", handleGlobalDragOver);
    this.addEventListener(document, "drop", handleGlobalDrop);
    this.addEventListener(document, "dragend", this.onDragEnd.bind(this));
  }

  onDragStart(event) {
    const folderTile = event.target.closest(".folder-item");
    const linkTile = event.target.closest(".link-item");
    if (!folderTile && !linkTile) return;
    
    const payload = folderTile
      ? { type: "folder", id: folderTile.dataset.folderId }
      : { type: "link", id: linkTile.dataset.linkId };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
    this.draggedElement = folderTile || linkTile;
    (folderTile || linkTile).classList.add("dragging");
    this.container.classList.add("drag-active");
  }

  onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    // Find target element for hover highlighting
    let targetFolder = null;
    let targetLink = null;
    const point = { x: event.clientX, y: event.clientY };
    const els = document.elementsFromPoint
      ? document.elementsFromPoint(point.x, point.y)
      : [document.elementFromPoint(point.x, point.y)];
    
    if (els && els.length) {
      for (const el of els) {
        if (
          el?.classList?.contains("folder-popover") ||
          el?.classList?.contains("folder-popover-backdrop")
        )
          continue; // ignore overlay layers
        // ignore the dragged element itself to avoid self-hover flicker
        if (
          this.draggedElement &&
          (el === this.draggedElement || this.draggedElement.contains?.(el))
        )
          continue;
        const f = el.closest?.(".folder-item");
        const l = el.closest?.(".link-item");
        if (f && this.container.contains(f)) {
          targetFolder = f;
          break;
        }
        if (l && this.container.contains(l)) {
          targetLink = l;
          break;
        }
      }
    }
    
    const newHover = targetFolder || targetLink;
    if (newHover !== this.lastHoverEl) {
      this.clearHoverStates();
      if (targetFolder) targetFolder.classList.add("dnd-over-folder");
      if (targetLink) targetLink.classList.add("dnd-over-link");
      this.lastHoverEl = newHover;
    }
  }

  async onDrop(event) {
    event.preventDefault();
    // Support both native DragEvent and forwarded CustomEvent from PopoverManager.
    // PopoverManager emits a CustomEvent('drop', { detail: originalDragEvent }) which
    // lacks a dataTransfer on the outer event, causing previous TypeError.
    const dragEvt = event.dataTransfer ? event : event.detail;
    if (!dragEvt || !dragEvt.dataTransfer) {
      // Not a usable drag/drop event; abort gracefully.
      this.cleanupDnD();
      return;
    }

    const data = dragEvt.dataTransfer.getData("application/json");
    if (!data) {
      this.cleanupDnD();
      return;
    }
    let payload;
    try {
      payload = JSON.parse(data);
    } catch {
      this.cleanupDnD();
      return;
    }

    // Determine drop target. For forwarded events, the event target will be the container
    // (since the CustomEvent was dispatched there). Use elementFromPoint to locate the
    // underlying element at the drop coordinates.
    let baseTarget = event.target;
    if (dragEvt !== event && typeof dragEvt.clientX === 'number' && typeof dragEvt.clientY === 'number') {
      const elBelow = document.elementFromPoint(dragEvt.clientX, dragEvt.clientY);
      if (elBelow) baseTarget = elBelow;
    }

    const dropFolder = baseTarget?.closest?.(".folder-item");
    const dropLink = baseTarget?.closest?.(".link-item");

    try {
      if (payload.type === "site") {
        // Handle dragging from popover to main grid
        if (dropFolder) {
          await this.folderSystem.moveSiteBetweenFolders(
            payload.folderId,
            payload.id,
            dropFolder.dataset.folderId
          );
          // Update both source and target folder previews
          this.updateFolderTilePreview(payload.folderId);
          this.updateFolderTilePreview(dropFolder.dataset.folderId);
        } else if (dropLink) {
          // Create new folder from site and target link
          const targetId = dropLink.dataset.linkId;
          const tempLink = await this.folderSystem.moveSiteToRoot(
            payload.folderId,
            payload.id,
            0 // Insert at beginning for simplicity
          );
          const newFolder = await this.folderSystem.createFolderFromRootLinks(
            [tempLink.id, targetId],
            undefined,
            0
          );
          // Clear draggedElement reference if it's the dropLink being removed
          if (this.draggedElement === dropLink) {
            this.draggedElement = null;
          }
          // Replace target link with new folder tile
          dropLink.remove();
          const folderEl = this.delegates.render?.createFolderElement(newFolder);
          if (folderEl) {
            this.container.insertBefore(folderEl, this.container.firstChild);
          } else {
            console.warn("Failed to create folder element, triggering re-render");
            this.triggerFullRerender();
          }
          // Update source folder preview (site removed)
          this.updateFolderTilePreview(payload.folderId);
        } else {
          // Drop site as new root link
          const link = await this.folderSystem.moveSiteToRoot(
            payload.folderId,
            payload.id,
            0
          );
          const linkEl = this.delegates.render?.createLinkTile(link);
          if (linkEl) {
            this.container.insertBefore(linkEl, this.container.firstChild);
          } else {
            console.warn("Failed to create link element, triggering re-render");
            this.triggerFullRerender();
          }
          // Update source folder preview (site removed)
          this.updateFolderTilePreview(payload.folderId);
        }
        // Close popover if delegate available
        if (this.delegates.popover?.closeFolderPopover) {
          this.delegates.popover.closeFolderPopover();
        }
      } else if (dropFolder) {
        // Dropping onto a folder tile
        if (payload.type === "link") {
          await this.folderSystem.moveLinkToFolder(
            payload.id,
            dropFolder.dataset.folderId
          );
          // Clear draggedElement reference before removing from DOM
          if (this.draggedElement && this.draggedElement.dataset.linkId === payload.id) {
            this.draggedElement = null;
          }
          this.removeTileByDataset("link", payload.id);
          this.updateFolderTilePreview(dropFolder.dataset.folderId);
        } else if (payload.type === "folder") {
          if (dropFolder.dataset.folderId === payload.id) {
            // ignore self-drop
            this.cleanupDnD();
            return;
          }
          await this.folderSystem.mergeFolders(
            payload.id,
            dropFolder.dataset.folderId
          );
          // Clear draggedElement reference before removing from DOM
          if (this.draggedElement && this.draggedElement.dataset.folderId === payload.id) {
            this.draggedElement = null;
          }
          this.removeTileByDataset("folder", payload.id);
          this.updateFolderTilePreview(dropFolder.dataset.folderId);
        }
      } else if (
        dropLink &&
        payload.type === "link" &&
        dropLink.dataset.linkId !== payload.id
      ) {
        // Merge two links into a new folder
        const newFolder = await this.folderSystem.createFolderFromRootLinks(
          [payload.id, dropLink.dataset.linkId],
          undefined,
          0
        );
        // Clear draggedElement reference before removing from DOM
        if (this.draggedElement && 
            (this.draggedElement.dataset.linkId === payload.id || 
             this.draggedElement === dropLink)) {
          this.draggedElement = null;
        }
        // Remove both original link tiles
        this.removeTileByDataset("link", payload.id);
        dropLink.remove();
        // Add new folder tile
        const folderEl = this.delegates.render?.createFolderElement(newFolder);
        if (folderEl) {
          this.container.insertBefore(folderEl, this.container.firstChild);
        } else {
          console.warn("Failed to create folder element, triggering re-render");
          this.triggerFullRerender();
        }
      }
      // If no valid drop target, do nothing (no reordering)
    } catch (err) {
      console.error("DnD drop failed:", err);
      // Trigger a full re-render if something went wrong
      this.triggerFullRerender();
    }

    this.cleanupDnD();
    // No full re-render; DOM updated in place
  }

  /**
   * Trigger a full re-render of the grid as fallback
   */
  triggerFullRerender() {
    // Emit a custom event that the app can listen to for re-rendering
    const event = new CustomEvent('tilio:refresh-needed', { 
      bubbles: true,
      detail: { reason: 'drag-drop-error' }
    });
    this.container.dispatchEvent(event);
  }

  onDragEnd(event) {
    this.cleanupDnD();
  }

  cleanupDnD() {
    if (this.draggedElement) {
      this.draggedElement.classList.remove("dragging");
      this.draggedElement = null;
    }
    this.clearHoverStates();
    this.container.classList.remove("drag-active");
    this.lastHoverEl = null;
  }

  clearHoverStates() {
    this.container
      .querySelectorAll(".dnd-over-folder")
      .forEach((el) => el.classList.remove("dnd-over-folder"));
    this.container
      .querySelectorAll(".dnd-over-link")
      .forEach((el) => el.classList.remove("dnd-over-link"));
  }

  // ---- DOM helpers for in-place updates (avoid full re-render) ----
  removeTileByDataset(type, id) {
    const sel =
      type === "folder"
        ? `.folder-item[data-folder-id="${id}"]`
        : `.link-item[data-link-id="${id}"]`;
    const el = this.container.querySelector(sel);
    if (el) el.remove();
  }

  updateFolderTilePreview(folderId) {
    const folderEl = this.container.querySelector(
      `.folder-item[data-folder-id="${folderId}"]`
    );
    if (!folderEl) return;
    const button = folderEl.querySelector(".folder-button");
    if (!button) return;
    // Clear existing preview slots
    while (button.firstChild) button.removeChild(button.firstChild);
    const folder = this.folderSystem.getFolderById(folderId);
    
    // Delegate to render manager if available
    if (this.delegates.render?.createFolderPreview) {
      const preview = this.delegates.render.createFolderPreview(folder?.sites || []);
      while (preview.firstChild) button.appendChild(preview.firstChild);
    }
  }

  /**
   * Update delegate references for dynamic manager updates
   * @param {Object} newDelegates - Updated delegate managers
   */
  updateDelegates(newDelegates) {
    this.delegates = { ...this.delegates, ...newDelegates };
  }

  /**
   * Handle drag enter events
   */
  handleDragEnter(event) {
    event.preventDefault();
  }

  /**
   * Handle drag leave events
   */
  handleDragLeave(event) {
    // Clear hover states when leaving the container
    if (!this.container.contains(event.relatedTarget)) {
      this.clearHoverStates();
    }
  }
}

// Export to window for use by other modules
if (typeof window !== "undefined") {
  window.DragDropManager = DragDropManager;
}
