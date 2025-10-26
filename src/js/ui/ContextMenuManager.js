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
    this.documentClickHandler = null;
    this.documentKeyHandler = null;
  }

  /**
   * Show context menu at the event position
   * @param {Event} event - The triggering event (right-click/contextmenu)
   * @param {HTMLElement} folderItem - The folder element if applicable
   * @param {HTMLElement} linkItem - The link element if applicable
   */
  showContextMenu(event, folderItem, linkItem, siteContext) {
    this.closeContextMenu(); // Close any existing menu

    const menu = document.createElement("div");
    menu.className = "context-menu";
    
    // Store context for handlers
    if (folderItem) menu.dataset.folderId = folderItem.dataset.folderId;
    if (linkItem && linkItem.dataset.linkId) menu.dataset.linkId = linkItem.dataset.linkId;
    if (siteContext) {
      menu.dataset.siteFolderId = siteContext.folderId;
      menu.dataset.siteId = siteContext.siteId;
    }

    // Build menu based on target
    if (folderItem) {
      // Get position info for folder
      const posInfo = this.getItemPositionInfo(folderItem, true);
      
      menu.innerHTML = `
        <div class="context-item" data-action="move-to-top" ${posInfo.isFirst ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevrons-up')}
          <span>Move to Top</span>
        </div>
        <div class="context-item" data-action="move-up" ${posInfo.isFirst ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevron-up')}
          <span>Move Up</span>
        </div>
        <div class="context-item" data-action="move-down" ${posInfo.isLast ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevron-down')}
          <span>Move Down</span>
        </div>
        <div class="context-item" data-action="move-to-bottom" ${posInfo.isLast ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevrons-down')}
          <span>Move to Bottom</span>
        </div>
        <div class="context-divider"></div>
        <div class="context-item" data-action="edit">
          ${this.getIcon('edit')}
          <span>Edit Folder</span>
        </div>
        <div class="context-item" data-action="delete">
          ${this.getIcon('trash')}
          <span>Delete Folder</span>
        </div>
        <div class="context-divider"></div>
        <div class="context-item" data-action="add-site">
          ${this.getIcon('plus')}
          <span>Add Site</span>
        </div>
      `;
    } else if (siteContext) {
      menu.innerHTML = `
        <div class="context-item" data-action="open-site">
          ${this.getIcon('external-link')}
          <span>Open</span>
        </div>
        <div class="context-item" data-action="edit-site">
          ${this.getIcon('edit')}
          <span>Edit Site</span>
        </div>
        <div class="context-item" data-action="delete-site">
          ${this.getIcon('trash')}
          <span>Delete Site</span>
        </div>
      `;
    } else if (linkItem) {
      // Get position info for link
      const posInfo = this.getItemPositionInfo(linkItem, false);
      
      menu.innerHTML = `
        <div class="context-item" data-action="move-to-top" ${posInfo.isFirst ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevrons-up')}
          <span>Move to Top</span>
        </div>
        <div class="context-item" data-action="move-up" ${posInfo.isFirst ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevron-up')}
          <span>Move Up</span>
        </div>
        <div class="context-item" data-action="move-down" ${posInfo.isLast ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevron-down')}
          <span>Move Down</span>
        </div>
        <div class="context-item" data-action="move-to-bottom" ${posInfo.isLast ? 'style="opacity: 0.5; pointer-events: none;"' : ''}>
          ${this.getIcon('chevrons-down')}
          <span>Move to Bottom</span>
        </div>
        <div class="context-divider"></div>
        <div class="context-item" data-action="edit-link">
          ${this.getIcon('edit')}
          <span>Edit Link</span>
        </div>
        <div class="context-item" data-action="move-link">
          ${this.getIcon('folder-input')}
          <span>Move to Folder…</span>
        </div>
        <div class="context-item" data-action="folderize-link">
          ${this.getIcon('folder-plus')}
          <span>Create Folder from Link</span>
        </div>
        <div class="context-item" data-action="delete-link">
          ${this.getIcon('trash')}
          <span>Delete Link</span>
        </div>
      `;
    } else {
      menu.innerHTML = `
        <div class="context-item" data-action="add-link">
          ${this.getIcon('plus')}
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
          siteFolderId: menu.dataset.siteFolderId || null,
          siteId: menu.dataset.siteId || null,
          event,
        };
        this.handleContextAction(action, ctx);
      }
      this.closeContextMenu();
    });

    // Add document click listener to close menu when clicking outside
    // Use setTimeout to prevent immediate closure from the same click event that opened the menu
    setTimeout(() => {
      this.documentClickHandler = (e) => {
        if (!menu.contains(e.target)) {
          this.closeContextMenu();
        }
      };
      document.addEventListener("click", this.documentClickHandler);
    }, 0);

    // Add escape key listener to close menu
    this.documentKeyHandler = (e) => {
      if (e.key === "Escape") {
        this.closeContextMenu();
      }
    };
    document.addEventListener("keydown", this.documentKeyHandler);
  }

  /**
   * Close the current context menu
   */
  closeContextMenu() {
    if (this.currentContextMenu) {
      this.currentContextMenu.remove();
      this.currentContextMenu = null;
      
      // Remove document-level event listeners
      if (this.documentClickHandler) {
        document.removeEventListener("click", this.documentClickHandler);
        this.documentClickHandler = null;
      }
      if (this.documentKeyHandler) {
        document.removeEventListener("keydown", this.documentKeyHandler);
        this.documentKeyHandler = null;
      }
      
      this.emit('menuClosed'); // Emit event for coordination
    }
  }

  /**
   * Handle context menu actions by delegating to appropriate managers
   * @param {string} action - The action to perform
   * @param {Object} ctx - Context object with folderId, linkId, and event
   */
  async handleContextAction(action, ctx) {
  const folderId = ctx?.folderId || null;
  const linkId = ctx?.linkId || null;
  const siteFolderId = ctx?.siteFolderId || null;
  const siteId = ctx?.siteId || null;

    try {
      switch (action) {
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
        case "edit-link":
          if (linkId) this.dialogManager.showEditLinkDialog(linkId);
          break;
        case "move-link":
          if (linkId) this.dialogManager.showMoveLinkDialog(linkId);
          break;
        case "folderize-link":
          if (linkId) this.createFolderFromSingleLink(linkId);
          break;
        case "delete-link":
          if (linkId && this.dialogManager?.showDeleteLinkDialog) {
            this.dialogManager.showDeleteLinkDialog(linkId);
          }
          break;
        case "open-site":
          if (siteFolderId && siteId) {
            try {
              const { site } = this.folderSystem.getSiteById(siteFolderId, siteId);
              if (site?.url) {
                // Track click for popularity
                this.folderSystem.recordClick(siteId, siteFolderId).catch(err => {
                  console.warn('Failed to record click:', err);
                });
                window.location.href = site.url;
              }
            } catch (err) {
              console.error('Failed to open site from context menu', err);
            }
          }
          break;
        case "edit-site":
          if (siteFolderId && siteId && this.dialogManager?.showEditSiteDialog) {
            this.dialogManager.showEditSiteDialog(siteFolderId, siteId);
          }
          break;
        case "delete-site":
          if (siteFolderId && siteId && this.dialogManager?.showDeleteSiteDialog) {
            this.dialogManager.showDeleteSiteDialog(siteFolderId, siteId);
          }
          break;
        // Reordering actions
        case "move-to-top":
          if (folderId) await this.moveItem(folderId, 'folder', 'top');
          else if (linkId) await this.moveItem(linkId, 'link', 'top');
          break;
        case "move-up":
          if (folderId) await this.moveItem(folderId, 'folder', 'up');
          else if (linkId) await this.moveItem(linkId, 'link', 'up');
          break;
        case "move-down":
          if (folderId) await this.moveItem(folderId, 'folder', 'down');
          else if (linkId) await this.moveItem(linkId, 'link', 'down');
          break;
        case "move-to-bottom":
          if (folderId) await this.moveItem(folderId, 'folder', 'bottom');
          else if (linkId) await this.moveItem(linkId, 'link', 'bottom');
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
   * Get position information for an item in the grid
   * @param {HTMLElement} element - The folder or link element
   * @param {boolean} isFolder - Whether the item is a folder
   * @returns {Object} Position info with isFirst, isLast, index
   */
  getItemPositionInfo(element, isFolder) {
    const rootOrder = this.folderSystem.rootOrder || [];
    const itemId = isFolder ? element.dataset.folderId : element.dataset.linkId;
    const itemType = isFolder ? 'folder' : 'link';
    
    // Get all items of the same type
    const sameTypeItems = rootOrder.filter(entry => entry.type === itemType);
    const currentIndex = sameTypeItems.findIndex(entry => entry.id === itemId);
    
    return {
      index: currentIndex,
      isFirst: currentIndex === 0,
      isLast: currentIndex === sameTypeItems.length - 1,
      total: sameTypeItems.length
    };
  }

  /**
   * Get inline SVG icon for context menu items
   * @param {string} name - Icon name
   * @returns {string} SVG markup
   */
  getIcon(name) {
    const icons = {
      'chevron-up': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>',
      'chevron-down': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>',
      'chevrons-up': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"></polyline><polyline points="17 18 12 13 7 18"></polyline></svg>',
      'chevrons-down': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>',
      'edit': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      'trash': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      'plus': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
      'folder-plus': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>',
      'folder-input': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><polyline points="9 14 12 11 15 14"></polyline></svg>',
      'external-link': '<svg class="context-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'
    };
    
    return icons[name] || icons['plus'];
  }

  /**
   * Move an item in the root grid
   * @param {string} itemId - The ID of the folder or link
   * @param {string} itemType - 'folder' or 'link'
   * @param {string} direction - 'up', 'down', 'top', or 'bottom'
   */
  async moveItem(itemId, itemType, direction) {
    try {
      // Disable auto-sort on manual reorder
      await this.disableAutoSort();
      
      const rootOrder = this.folderSystem.rootOrder;
      const currentIndex = rootOrder.findIndex(
        entry => entry.type === itemType && entry.id === itemId
      );
      
      if (currentIndex === -1) {
        throw new Error('Item not found in root order');
      }

      // Get items of same type for boundary checking
      const sameTypeItems = rootOrder.filter(entry => entry.type === itemType);
      const typeIndex = sameTypeItems.findIndex(entry => entry.id === itemId);
      
      let newIndex = currentIndex;
      
      switch (direction) {
        case 'up':
          // Move up within same type
          if (typeIndex > 0) {
            const prevItem = sameTypeItems[typeIndex - 1];
            const prevIndex = rootOrder.findIndex(
              entry => entry.type === prevItem.type && entry.id === prevItem.id
            );
            // Swap positions
            [rootOrder[currentIndex], rootOrder[prevIndex]] = 
            [rootOrder[prevIndex], rootOrder[currentIndex]];
          }
          break;
          
        case 'down':
          // Move down within same type
          if (typeIndex < sameTypeItems.length - 1) {
            const nextItem = sameTypeItems[typeIndex + 1];
            const nextIndex = rootOrder.findIndex(
              entry => entry.type === nextItem.type && entry.id === nextItem.id
            );
            // Swap positions
            [rootOrder[currentIndex], rootOrder[nextIndex]] = 
            [rootOrder[nextIndex], rootOrder[currentIndex]];
          }
          break;
          
        case 'top':
          // Move to top of same type
          if (typeIndex > 0) {
            // Remove from current position
            const [item] = rootOrder.splice(currentIndex, 1);
            // Find position of first item of same type
            const firstOfTypeIndex = rootOrder.findIndex(entry => entry.type === itemType);
            // Insert at that position
            rootOrder.splice(firstOfTypeIndex !== -1 ? firstOfTypeIndex : 0, 0, item);
          }
          break;
          
        case 'bottom':
          // Move to bottom of same type
          if (typeIndex < sameTypeItems.length - 1) {
            // Remove from current position
            const [item] = rootOrder.splice(currentIndex, 1);
            // Find position after last item of same type
            let lastOfTypeIndex = -1;
            for (let i = rootOrder.length - 1; i >= 0; i--) {
              if (rootOrder[i].type === itemType) {
                lastOfTypeIndex = i;
                break;
              }
            }
            // Insert after last of same type
            rootOrder.splice(lastOfTypeIndex + 1, 0, item);
          }
          break;
      }
      
      // Save and refresh
      await this.folderSystem.save();
      this.emit('itemMoved', { itemId, itemType, direction });
      this.emit('notification', { 
        message: `${itemType === 'folder' ? 'Folder' : 'Link'} moved ${direction}.`, 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Error moving item:', error);
      this.emit('notification', { 
        message: 'Failed to move item.', 
        type: 'error' 
      });
    }
  }

  /**
   * Disable auto-sort and notify user
   */
  async disableAutoSort() {
    const settings = this.folderSystem.data?.settings;
    if (settings && settings.autoSortByPopularity) {
      settings.autoSortByPopularity = false;
      await this.folderSystem.save();
      
      this.emit('notification', { 
        message: 'Auto-sort disabled. Your manual order will be preserved.', 
        type: 'info',
        duration: 4000
      });
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
