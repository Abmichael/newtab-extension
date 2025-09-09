// ContextMenuManager - Context menu functionality for folders and links
// Handles menu positioning, action delegation, and proper cleanup

class ContextMenuManager extends ComponentManager {
  /**
   * @param {HTMLElement} container - The main container element
   * @param {FolderSystem} folderSystem - The folder system instance
   * @param {DialogManager} dialogManager - Dialog manager for action delegation
   */
  constructor(container, folderSystem, dialogManager) {
    super(container, folderSystem);
    this.dialogManager = dialogManager;
    this.currentContextMenu = null;
  }

  /**
   * Show context menu at the event position
   * @param {Event} event - The triggering event (right-click/contextmenu)
   * @param {HTMLElement} folderItem - The folder element if applicable
   * @param {HTMLElement} linkItem - The link element if applicable
   */
  showContextMenu(event, folderItem, linkItem) {
    this.closeContextMenu(); // Close any existing menu

    const menu = document.createElement("div");
    menu.className = "context-menu";
    
    // Store context for handlers
    if (folderItem) menu.dataset.folderId = folderItem.dataset.folderId;
    if (linkItem) menu.dataset.linkId = linkItem.dataset.linkId;

    // Build menu based on target
    if (folderItem) {
      menu.innerHTML = `
        <div class="context-item" data-action="edit">
          <span>Edit Folder</span>
        </div>
        <div class="context-item" data-action="delete">
          <span>Delete Folder</span>
        </div>
        <div class="context-divider"></div>
        <div class="context-item" data-action="add-site">
          <span>Add Site</span>
        </div>
      `;
    } else if (linkItem) {
      menu.innerHTML = `
        <div class="context-item" data-action="move-link">
          <span>Move to folder…</span>
        </div>
        <div class="context-item" data-action="folderize-link">
          <span>Create folder from this link</span>
        </div>
      `;
    } else {
      menu.innerHTML = `
        <div class="context-item" data-action="add-folder">
          <span>Add Folder</span>
        </div>
        <div class="context-item" data-action="add-link">
          <span>Add Link</span>
        </div>
      `;
    }

    // Position the menu
    this.positionMenu(menu, event);

    // Add event listeners
    this.attachMenuEvents(menu, event, folderItem, linkItem);

    document.body.appendChild(menu);
    this.currentContextMenu = menu;

    // Position adjustment if menu goes off screen
    requestAnimationFrame(() => {
      this.adjustMenuPosition(menu, event);
    });
  }

  /**
   * Position the context menu at the event coordinates
   * @param {HTMLElement} menu - The menu element
   * @param {Event} event - The triggering event
   */
  positionMenu(menu, event) {
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
  }

  /**
   * Adjust menu position if it goes off screen
   * @param {HTMLElement} menu - The menu element
   * @param {Event} event - The original event
   */
  adjustMenuPosition(menu, event) {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = `${event.clientX - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = `${event.clientY - rect.height}px`;
    }
  }

  /**
   * Attach event listeners to the context menu
   * @param {HTMLElement} menu - The menu element
   * @param {Event} event - The original event
   * @param {HTMLElement} folderItem - The folder element if applicable
   * @param {HTMLElement} linkItem - The link element if applicable
   */
  attachMenuEvents(menu, event, folderItem, linkItem) {
    menu.addEventListener("click", (e) => {
      const action = e.target.closest(".context-item")?.dataset.action;
      if (action) {
        const ctx = {
          folderId: folderItem?.dataset.folderId || menu.dataset.folderId || null,
          linkId: linkItem?.dataset.linkId || menu.dataset.linkId || null,
          event,
        };
        this.handleContextAction(action, ctx);
      }
      this.closeContextMenu();
    });
  }

  /**
   * Close the current context menu
   */
  closeContextMenu() {
    if (this.currentContextMenu) {
      this.currentContextMenu.remove();
      this.currentContextMenu = null;
      this.emit('menuClosed'); // Emit event for coordination
    }
  }

  /**
   * Handle context menu actions by delegating to appropriate managers
   * @param {string} action - The action to perform
   * @param {Object} ctx - Context object with folderId, linkId, and event
   */
  handleContextAction(action, ctx) {
    const folderId = ctx?.folderId || null;
    const linkId = ctx?.linkId || null;

    try {
      switch (action) {
        case "add-folder":
          this.dialogManager.showAddFolderDialog();
          break;
        case "add-link":
          this.dialogManager.showAddLinkDialog();
          break;
        case "edit":
          if (folderId) this.dialogManager.showEditFolderDialog(folderId);
          break;
        case "delete":
          if (folderId) this.dialogManager.showDeleteConfirmation(folderId);
          break;
        case "add-site":
          if (folderId) this.dialogManager.showAddSiteDialog(folderId);
          break;
        case "move-link":
          if (linkId) this.dialogManager.showMoveLinkDialog(linkId);
          break;
        case "folderize-link":
          if (linkId) this.createFolderFromSingleLink(linkId);
          break;
        default:
          console.warn("Unknown context action:", action);
      }
    } catch (error) {
      console.error("Error handling context action:", error);
    }
  }

  /**
   * Convert a single root link into a new folder at the same grid position
   * @param {string} linkId - The ID of the link to convert
   */
  async createFolderFromSingleLink(linkId) {
    try {
      const tiles = Array.from(
        this.container.querySelectorAll(".folder-item, .link-item, .add-tile")
      );
      const linkEl = this.container.querySelector(
        `.link-item[data-link-id="${linkId}"]`
      );
      const insertIdx = Math.max(0, tiles.indexOf(linkEl));
      const newFolder = await this.folderSystem.createFolderFromRootLinks(
        [linkId],
        undefined,
        insertIdx
      );
      
      // Replace link tile with new folder tile
      if (linkEl) linkEl.remove();
      
      // Emit event for UIManager to handle folder creation
      this.emit('folderCreated', { folder: newFolder, insertIndex: insertIdx });
      this.emit('notification', { message: "Folder created from link.", type: 'success' });
    } catch (err) {
      console.error("Failed to create folder from link:", err);
      this.emit('notification', { message: "Failed to create folder.", type: 'error' });
    }
  }

  /**
   * Clean up context menu and remove event listeners
   */
  cleanup() {
    this.closeContextMenu();
    super.cleanup();
  }
}

// Export for both ES6 modules and browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = ContextMenuManager;
} else if (typeof window !== "undefined") {
  window.ContextMenuManager = ContextMenuManager;
}
