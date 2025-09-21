// newtab - Event Handler Component
// Centralized event handling and delegation for all UI interactions

class EventHandler extends ComponentManager {
  /**
   * @param {HTMLElement} container - Main container element
   * @param {HTMLElement} overlay - Overlay element
   * @param {FolderSystem} folderSystem - Data layer
   * @param {Object} delegates - Manager delegates for handling different UI actions
   */
  constructor(container, overlay, folderSystem, delegates) {
    super(container, folderSystem);
    this.overlay = overlay;
    this.delegates = delegates || {};
    
    this.bindEvents();
  }

  bindEvents() {
    // Container events
    this.addEventListener(this.container, "click", this.handleContainerClick.bind(this));
    this.addEventListener(this.container, "contextmenu", this.handleContextMenu.bind(this));
    this.addEventListener(this.container, "keydown", this.handleKeyboard.bind(this));

    // Document-level context menu for popover sites (popover appended to body, not container)
    this.addEventListener(document, "contextmenu", (e) => {
      // Ignore if already handled via container (inside container)
      if (this.container.contains(e.target)) return; 
      const siteWrapper = e.target.closest('.popover-site');
      if (!siteWrapper) return;
      e.preventDefault();
      const siteContext = {
        folderId: siteWrapper.dataset.folderId,
        siteId: siteWrapper.dataset.siteId
      };
      if (this.delegates.contextMenu?.showContextMenu) {
        this.delegates.contextMenu.showContextMenu(e, null, null, siteContext);
      }
    });

    // Overlay events
    this.addEventListener(this.overlay, "click", this.handleOverlayClick.bind(this));
    
    // Global events
    this.addEventListener(document, "keydown", this.handleGlobalKeydown.bind(this));

    // Touch gestures for mobile
    this.initializeTouchGestures();
    
    // Basic swipe-down to close overlay (mobile)
    this.initializeOverlayTouchGestures();
  }

  handleContainerClick(e) {
    const button = e.target.closest(".folder-button");
    const item = button?.closest?.(".folder-item");
    
    if (!button || !item) {
      // Click outside any folder tile closes current popover and context menu
      if (this.delegates.popover?.closeFolderPopover) {
        this.delegates.popover.closeFolderPopover();
      }
      if (this.delegates.contextMenu?.closeContextMenu) {
        this.delegates.contextMenu.closeContextMenu();
      }
      return;
    }
    
    const id = item.dataset.folderId;
    const folder = this.folderSystem.getFolderById(id);
    if (!folder) return;
    
    // Close any open context menu when clicking on folders
    if (this.delegates.contextMenu?.closeContextMenu) {
      this.delegates.contextMenu.closeContextMenu();
    }
    
    // Toggle if same button clicked again
    if (this.delegates.popover?.currentPopover && 
        this.delegates.popover.currentPopover._anchor === button) {
      this.delegates.popover.closeFolderPopover();
      return;
    }
    
    const clickPoint = { x: e.clientX, y: e.clientY };
    if (this.delegates.popover?.showFolderPopover) {
      this.delegates.popover.showFolderPopover(folder, button, clickPoint);
    }
  }

  handleContextMenu(e) {
    e.preventDefault();
    const folderItem = e.target.closest(".folder-item");
    const linkItem = e.target.closest(".link-item");
    // Detect site inside popover (has siteId + folderId data attributes)
    const siteWrapper = e.target.closest('.popover-site');
    let siteContext = null;
    if (siteWrapper && siteWrapper.dataset.siteId && siteWrapper.dataset.folderId) {
      siteContext = {
        folderId: siteWrapper.dataset.folderId,
        siteId: siteWrapper.dataset.siteId
      };
    }

    if (this.delegates.contextMenu?.showContextMenu) {
      this.delegates.contextMenu.showContextMenu(e, folderItem, linkItem, siteContext);
    }
  }

  handleKeyboard(e) {
    const items = Array.from(this.container.querySelectorAll(".folder-item"));
    if (items.length === 0) return;
    
    const currentIndex = items.indexOf(document.activeElement);

    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        const next = items[(currentIndex + 1 + items.length) % items.length];
        next?.focus();
        e.preventDefault();
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev?.focus();
        e.preventDefault();
        break;
      }
      case "Enter":
      case " ": {
        const item = document.activeElement?.closest?.(".folder-item");
        const id = item?.dataset?.folderId;
        if (id) {
          const folder = this.folderSystem.getFolderById(id);
          // Keyboard opens accessible popover (centered)
          if (folder && this.delegates.popover?.showFolderPopover) {
            this.delegates.popover.showFolderPopover(folder, item, null);
          }
        }
        e.preventDefault();
        break;
      }
      case "Delete":
      case "Backspace": {
        if (e.ctrlKey || e.metaKey) {
          const item = document.activeElement?.closest?.(".folder-item");
          const id = item?.dataset?.folderId;
          if (id && this.delegates.dialog?.showDeleteConfirmation) {
            this.delegates.dialog.showDeleteConfirmation(id);
          }
          e.preventDefault();
        }
        break;
      }
      case "F2": {
        const item = document.activeElement?.closest?.(".folder-item");
        const id = item?.dataset?.folderId;
        if (id && this.delegates.dialog?.showEditFolderDialog) {
          this.delegates.dialog.showEditFolderDialog(id);
        }
        e.preventDefault();
        break;
      }
      case "Insert": {
        // Folder creation through DnD only - keyboard shortcut removed
        e.preventDefault();
        break;
      }
      default:
        break;
    }
  }

  handleOverlayClick(e) {
    if (e.target === this.overlay) {
      if (this.delegates.popover?.closeFolderPopover) {
        this.delegates.popover.closeFolderPopover();
      }
      if (this.delegates.contextMenu?.closeContextMenu) {
        this.delegates.contextMenu.closeContextMenu();
      }
    }
  }

  handleGlobalKeydown(e) {
    if (e.key === "Escape") {
      if (this.delegates.popover?.closeFolderPopover) {
        this.delegates.popover.closeFolderPopover();
      }
      if (this.delegates.contextMenu?.closeContextMenu) {
        this.delegates.contextMenu.closeContextMenu();
      }
    }
  }

  initializeTouchGestures() {
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let longPressTimer = null;
    let isDragging = false;

    this.addEventListener(
      this.container,
      "touchstart",
      (e) => {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        isDragging = false;

        // Long press for context menu (supports folders and links)
        longPressTimer = setTimeout(() => {
          const folderItem = e.target.closest(".folder-item");
          const linkItem = e.target.closest(".link-item");
          if ((folderItem || linkItem) && !isDragging) {
            // Vibrate if supported
            if (navigator.vibrate) {
              navigator.vibrate(50);
            }

            // Create synthetic contextmenu event
            const contextEvent = new Event("contextmenu", {
              bubbles: true,
              cancelable: true,
            });
            contextEvent.clientX = touchStartPos.x;
            contextEvent.clientY = touchStartPos.y;
            
            if (this.delegates.contextMenu?.showContextMenu) {
              this.delegates.contextMenu.showContextMenu(contextEvent, folderItem, linkItem);
            }
          }
        }, 500); // 500ms long press
      },
      { passive: true }
    );

    this.addEventListener(
      this.container,
      "touchmove",
      (e) => {
        const touch = e.touches[0];
        const moveDistance = Math.sqrt(
          Math.pow(touch.clientX - touchStartPos.x, 2) +
            Math.pow(touch.clientY - touchStartPos.y, 2)
        );

        if (moveDistance > 10) {
          isDragging = true;
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }
      },
      { passive: true }
    );

    this.addEventListener(
      this.container,
      "touchend",
      (e) => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }

        const touchDuration = Date.now() - touchStartTime;

        // If it was a quick tap and not dragging, treat as click
        if (touchDuration < 200 && !isDragging) {
          const item = e.target.closest(".folder-item");
          if (item) {
            const id = item.dataset.folderId;
            const folder = this.folderSystem.getFolderById(id);
            if (folder && this.delegates.popover?.showFolderPopover) {
              this.delegates.popover.showFolderPopover(folder, item, null);
            }
          }
        }

        isDragging = false;
      },
      { passive: true }
    );
  }

  initializeOverlayTouchGestures() {
    let touchStartY = null;
    
    this.addEventListener(this.overlay, "touchstart", (e) => {
      touchStartY = e.touches?.[0]?.clientY ?? null;
    });
    
    this.addEventListener(this.overlay, "touchend", (e) => {
      const endY = e.changedTouches?.[0]?.clientY ?? null;
      if (touchStartY != null && endY != null && endY - touchStartY > 60) {
        if (this.delegates.popover?.closeFolderPopover) {
          this.delegates.popover.closeFolderPopover();
        }
      }
      touchStartY = null;
    });
  }

  /**
   * Update delegate references for dynamic manager updates
   * @param {Object} newDelegates - Updated delegate managers
   */
  updateDelegates(newDelegates) {
    this.delegates = { ...this.delegates, ...newDelegates };
  }
}

// Export to window for use by other modules
if (typeof window !== "undefined") {
  window.EventHandler = EventHandler;
}
