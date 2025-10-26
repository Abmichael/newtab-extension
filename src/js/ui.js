/**
 * UI Manager - Coordinates all UI components and maintains the public API
 * Delegates functionality to specialized component managers
 */
class UIManager {
  constructor(container, overlay, folderSystem) {
    this.container = container;
    this.overlay = overlay;
    this.folderSystem = folderSystem;
    
    // Initialize component managers
    this.dragDropManager = new DragDropManager(container, folderSystem);
    this.dialogManager = new DialogManager(overlay, folderSystem);
    this.renderManager = new RenderManager(container, folderSystem);
    this.popoverManager = new PopoverManager(container, folderSystem, this.renderManager);
    this.contextMenuManager = new ContextMenuManager(container, folderSystem, this.dialogManager);
    this.notificationManager = new NotificationManager(container);
    
    // Initialize EventHandler with delegates after other managers are created
    this.eventHandler = new EventHandler(container, overlay, folderSystem, {
      popover: this.popoverManager,
      contextMenu: this.contextMenuManager,
      render: this.renderManager
    });
    
    // Update DragDropManager delegates after render manager is created
    this.dragDropManager.updateDelegates({
      render: this.renderManager,
      popover: this.popoverManager
    });
    
    // SettingsUIManager is initialized lazily in showSettingsModal()
    this.settingsUIManager = null;
    
    // Legacy state properties for compatibility
    this.draggedElement = null;
    this.currentDialog = null;
    this.currentPopover = null;
    this.currentContextMenu = null;

    // Set up component event listeners and coordination
    this.initializeComponentEvents();

    // Auto-refresh grid when underlying data changes (links/folders)
    // Events emitted by DialogManager / other managers using emit('foldersChanged')
    this.dialogManager.on('foldersChanged', () => {
      try {
        const folders = this.folderSystem.getAllFolders();
        const links = this.folderSystem.getAllLinks?.() || [];
        this.renderGrid(folders, links);
      } catch (e) {
        console.error('UIManager refresh after foldersChanged failed:', e);
      }
    });

    console.log('UIManager initialized with component composition');
  }

  /**
   * Initialize event coordination between components
   */
  initializeComponentEvents() {
    // Context menu coordination
    this.contextMenuManager.on('menuClosed', () => {
      this.currentContextMenu = null;
    });

    // Context menu notifications
    this.contextMenuManager.on('notification', (data) => {
      const { message, type, duration } = data;
      this.notificationManager.show(message, type || 'success', duration);
    });

    // Context menu item moved
    this.contextMenuManager.on('itemMoved', () => {
      this.refreshFolders();
    });

    // Context menu folder created
    this.contextMenuManager.on('folderCreated', () => {
      this.refreshFolders();
    });

    // Popover coordination
    this.popoverManager.on('popoverClosed', () => {
      this.currentPopover = null;
    });

    // Popover folder renamed - update grid immediately
    this.popoverManager.on('folderRenamed', (data) => {
      // Update the folder title in the main grid without full refresh
      const folderEl = this.container.querySelector(`.folder-item[data-folder-id="${data.folderId}"]`);
      if (folderEl) {
        const titleEl = folderEl.querySelector('.folder-title');
        if (titleEl) {
          titleEl.textContent = data.newName;
        }
      }
    });

    // Dialog coordination
    this.dialogManager.on('dialogClosed', () => {
      this.currentDialog = null;
    });

    // Render manager events
    this.renderManager.on('folderCreated', (folder) => {
      // Handle folder creation events if needed
    });

    this.renderManager.on('addLinkRequested', () => {
      this.dialogManager.showAddLinkDialog();
    });

    // Event handler coordination
    this.eventHandler.on('refresh', () => {
      this.refreshFolders();
    });

    // Drag and drop coordination
    this.dragDropManager.on('dragStarted', (element) => {
      this.draggedElement = element;
    });

    this.dragDropManager.on('dragEnded', () => {
      this.draggedElement = null;
    });
  }

  // ============ Context Menu ============
  // Context menu functionality delegated to ContextMenuManager

  showContextMenu(event, folderItem, linkItem) {
    return this.contextMenuManager.showContextMenu(event, folderItem, linkItem);
  }

  closeContextMenu() {
    this.contextMenuManager.closeContextMenu();
  }

  handleContextAction(action, ctx) {
    return this.contextMenuManager.handleContextAction(action, ctx);
  }

  async createFolderFromSingleLink(linkId) {
    return this.contextMenuManager.createFolderFromSingleLink(linkId);
  }

  refreshFolders() {
    const folders = this.folderSystem.getAllFolders();
    const links = this.folderSystem.getAllLinks?.() || [];
    this.renderGrid(folders, links);
  }

  // ============ Rendering ============
  // Rendering functionality delegated to RenderManager

  clearContainer() {
    this.renderManager.clearContainer();
  }

  renderFolders(folders) {
    this.renderManager.renderFolders(folders);
  }

  renderGrid(folders, links) {
    this.renderManager.renderGrid(folders, links);
  }

  createAddTile() {
    return this.renderManager.createAddTile();
  }

  createFolderElement(folder) {
    return this.renderManager.createFolderElement(folder);
  }

  createFolderPreview(sites) {
    return this.renderManager.createFolderPreview(sites);
  }

  createFolderTitle(text, id) {
    return this.renderManager.createFolderTitle(text, id);
  }

  createLinkTile(link) {
    return this.renderManager.createLinkTile(link);
  }

  // ============ Folder Display ============
  // Folder functionality delegated to PopoverManager (handles both popover and modal display)

  showModal(folder) {
    // For accessibility/keyboard navigation, show a larger popover
    this.popoverManager.showFolderPopover(folder, null, null);
  }

  hideModal() {
    this.popoverManager.closeFolderPopover();
  }

  // ============ Folder Popover ============
  // Popover functionality delegated to PopoverManager

  showFolderPopover(folder, anchorEl, clickPoint) {
    this.popoverManager.showFolderPopover(folder, anchorEl, clickPoint);
  }

  closeFolderPopover() {
    this.popoverManager.closeFolderPopover();
  }

  // ============ Adaptive Backgrounds ============
  // Adaptive background functionality delegated to RenderManager

  applyAdaptiveTileBackground(imgEl, siteUrl) {
    this.renderManager.applyAdaptiveTileBackground(imgEl, siteUrl);
  }

  generateDomainColor(url) {
    return this.renderManager.generateDomainColor(url);
  }

  hslToRgb(hslString) {
    return this.renderManager.hslToRgb(hslString);
  }

  // ============ Settings Modal ============
  // Settings UI functionality delegated to SettingsUIManager

  showSettingsModal(settingsManager) {
    if (!this.settingsUIManager) {
      this.settingsUIManager = new SettingsUIManager(this.container, settingsManager);
      // Set up event listeners for settings UI
      this.settingsUIManager.on('notification', ({ message, type }) => {
        this.notificationManager.show(message, type);
      });
      this.settingsUIManager.on('settingsChanged', (settings) => {
        // Emit or handle settings changes if needed
      });
      this.settingsUIManager.on('dataImported', () => {
        // Handle data import completion
      });
    }
    this.settingsUIManager.showSettingsModal();
  }

  closeSettingsModal() {
    if (this.settingsUIManager) {
      this.settingsUIManager.closeSettingsModal();
    }
  }

  // ============ Notification System ============
  // Notification functionality delegated to NotificationManager

  showNotification(message, type = "success", duration) {
    this.notificationManager.show(message, type, duration);
  }

  // ============ Cleanup ============

  /**
   * Destroy all component managers and clean up resources
   * Should be called when UIManager is no longer needed
   */
  destroy() {
    // Destroy component managers
    if (this.eventHandler && typeof this.eventHandler.destroy === 'function') {
      this.eventHandler.destroy();
    }
    if (this.dragDropManager && typeof this.dragDropManager.destroy === 'function') {
      this.dragDropManager.destroy();
    }
    if (this.dialogManager && typeof this.dialogManager.cleanup === 'function') {
      this.dialogManager.cleanup();
    }
    if (this.popoverManager && typeof this.popoverManager.cleanup === 'function') {
      this.popoverManager.cleanup();
    }
    if (this.contextMenuManager && typeof this.contextMenuManager.cleanup === 'function') {
      this.contextMenuManager.cleanup();
    }
    if (this.renderManager && typeof this.renderManager.cleanup === 'function') {
      this.renderManager.cleanup();
    }
    if (this.settingsUIManager && typeof this.settingsUIManager.cleanup === 'function') {
      this.settingsUIManager.cleanup();
    }
    if (this.notificationManager && typeof this.notificationManager.cleanup === 'function') {
      this.notificationManager.cleanup();
    }

    // Close any open dialogs/popovers
    this.closeContextMenu();
    this.closeFolderPopover();
    this.closeSettingsModal();

    // Clear references
    this.eventHandler = null;
    this.dragDropManager = null;
    this.dialogManager = null;
    this.popoverManager = null;
    this.contextMenuManager = null;
    this.renderManager = null;
    this.settingsUIManager = null;
    this.notificationManager = null;
    this.draggedElement = null;
    this.currentDialog = null;
    this.currentPopover = null;
    this.currentContextMenu = null;

    console.log('UIManager destroyed and cleaned up');
  }
}

if (typeof window !== "undefined") {
  window.UIManager = UIManager;
}
