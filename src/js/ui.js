// NeoTab - UI Management and DOM Manipulation Layer
// Responsible for rendering folders/sites and handling user interactions

class UIManager {
  /**
   * @param {HTMLElement} container Folder grid container
   * @param {HTMLElement} overlay Full-screen overlay element
   * @param {FolderSystem} folderSystem Data/business logic layer
   */
  constructor(container, overlay, folderSystem) {
    if (!container) throw new Error("UIManager requires a container");
    if (!overlay) throw new Error("UIManager requires an overlay");
    if (!folderSystem) throw new Error("UIManager requires a FolderSystem");

    this.container = container;
    this.overlay = overlay;
    this.folderSystem = folderSystem;

    // Simple icon cache states
    this.faviconOk = new Set();
    this.faviconFail = new Set();

    // Drag and drop state
    this.draggedElement = null;
    this.dropIndicator = null;

    this.bindEvents();
    this.initializeDragDrop();
  }

  bindEvents() {
    // Event delegation for folder interactions
    this.container.addEventListener("click", (e) => {
      const button = e.target.closest(".folder-button");
      const item = button?.closest?.(".folder-item");
      if (!button || !item) {
        // Click outside any folder tile closes current popover
        this.closeFolderPopover();
        return;
      }
      const id = item.dataset.folderId;
      const folder = this.folderSystem.getFolderById(id);
      if (!folder) return;
      // Toggle if same button clicked again
      if (this.currentPopover && this.currentPopover._anchor === button) {
        this.closeFolderPopover();
        return;
      }
      const clickPoint = { x: e.clientX, y: e.clientY };
      this.showFolderPopover(folder, button, clickPoint);
    });

    // Right-click context menu
    this.container.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const item = e.target.closest(".folder-item");
      this.showContextMenu(e, item);
    });

    // Keyboard navigation
    this.container.addEventListener("keydown", (e) => {
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
            // Keyboard opens accessible full modal (overlay)
            if (folder) this.showModal(folder);
          }
          e.preventDefault();
          break;
        }
        case "Delete":
        case "Backspace": {
          if (e.ctrlKey || e.metaKey) {
            const item = document.activeElement?.closest?.(".folder-item");
            const id = item?.dataset?.folderId;
            if (id) {
              this.showDeleteConfirmation(id);
            }
            e.preventDefault();
          }
          break;
        }
        case "F2": {
          const item = document.activeElement?.closest?.(".folder-item");
          const id = item?.dataset?.folderId;
          if (id) {
            this.showEditFolderDialog(id);
          }
          e.preventDefault();
          break;
        }
        case "Insert": {
          if (e.ctrlKey || e.metaKey) {
            this.showAddFolderDialog();
            e.preventDefault();
          }
          break;
        }
        default:
          break;
      }
    });

    // Overlay close on background click
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.hideModal();
    });

    // ESC to close overlay
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.hideModal();
    });

    // Basic swipe-down to close (mobile)
    let touchStartY = null;
    this.overlay.addEventListener("touchstart", (e) => {
      touchStartY = e.touches?.[0]?.clientY ?? null;
    });
    this.overlay.addEventListener("touchend", (e) => {
      const endY = e.changedTouches?.[0]?.clientY ?? null;
      if (touchStartY != null && endY != null && endY - touchStartY > 60) {
        this.hideModal();
      }
      touchStartY = null;
    });
  }

  // ============ Drag and Drop ============

  initializeDragDrop() {
    this.container.addEventListener(
      "dragstart",
      this.handleDragStart.bind(this)
    );
    this.container.addEventListener("dragover", this.handleDragOver.bind(this));
    this.container.addEventListener("drop", this.handleDrop.bind(this));
    this.container.addEventListener("dragend", this.handleDragEnd.bind(this));
    this.container.addEventListener(
      "dragenter",
      this.handleDragEnter.bind(this)
    );
    this.container.addEventListener(
      "dragleave",
      this.handleDragLeave.bind(this)
    );

    // Global click handler to close context menus
    document.addEventListener("click", this.closeContextMenu.bind(this));

    // Touch gesture support
    this.initializeTouchGestures();
  }

  initializeTouchGestures() {
    let touchStartTime = 0;
    let touchStartPos = { x: 0, y: 0 };
    let longPressTimer = null;
    let isDragging = false;

    this.container.addEventListener(
      "touchstart",
      (e) => {
        const touch = e.touches[0];
        touchStartTime = Date.now();
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        isDragging = false;

        // Long press for context menu
        longPressTimer = setTimeout(() => {
          const item = e.target.closest(".folder-item");
          if (item && !isDragging) {
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
            this.showContextMenu(contextEvent, item);
          }
        }, 500); // 500ms long press
      },
      { passive: true }
    );

    this.container.addEventListener(
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

    this.container.addEventListener(
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
            if (folder) this.showModal(folder);
          }
        }

        isDragging = false;
      },
      { passive: true }
    );
  }

  handleDragStart(event) {
    const item = event.target.closest(".folder-item");
    if (!item) return;

    this.draggedElement = item;
    event.dataTransfer.setData("text/plain", item.dataset.folderId);
    event.dataTransfer.effectAllowed = "move";

    item.classList.add("dragging");
    item.style.opacity = "0.5";
  }

  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const afterElement = this.getDragAfterElement(event.clientY);
    const dropIndicator = this.getOrCreateDropIndicator();

    if (afterElement == null) {
      this.container.appendChild(dropIndicator);
    } else {
      this.container.insertBefore(dropIndicator, afterElement);
    }
  }

  handleDragEnter(event) {
    event.preventDefault();
  }

  handleDragLeave(event) {
    if (!this.container.contains(event.relatedTarget)) {
      this.removeDropIndicator();
    }
  }

  handleDrop(event) {
    event.preventDefault();
    const folderId = event.dataTransfer.getData("text/plain");

    if (this.draggedElement && folderId) {
      try {
        const afterElement = this.getDragAfterElement(event.clientY);
        const allFolders = Array.from(
          this.container.querySelectorAll(".folder-item:not(.dragging)")
        );

        let newIndex = allFolders.length;
        if (afterElement) {
          newIndex = allFolders.indexOf(afterElement);
        }

        // Update folder order in the system
        this.folderSystem.reorderFolder(folderId, newIndex);

        // Re-render folders to reflect new order
        const folders = this.folderSystem.getAllFolders();
        this.renderFolders(folders);
      } catch (error) {
        console.error("Error during folder reorder:", error);
        // Reset drag state on error
        if (this.draggedElement) {
          this.draggedElement.classList.remove("dragging");
          this.draggedElement.style.opacity = "";
        }
      }
    }

    this.removeDropIndicator();
  }

  handleDragEnd(event) {
    if (this.draggedElement) {
      this.draggedElement.classList.remove("dragging");
      this.draggedElement.style.opacity = "";
      this.draggedElement = null;
    }
    this.removeDropIndicator();
  }

  getDragAfterElement(y) {
    const draggableElements = [
      ...this.container.querySelectorAll(".folder-item:not(.dragging)"),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  getOrCreateDropIndicator() {
    if (!this.dropIndicator) {
      this.dropIndicator = document.createElement("div");
      this.dropIndicator.className = "drop-indicator";
    }
    return this.dropIndicator;
  }

  removeDropIndicator() {
    if (this.dropIndicator && this.dropIndicator.parentNode) {
      this.dropIndicator.parentNode.removeChild(this.dropIndicator);
    }
  }

  // ============ Context Menu ============

  showContextMenu(event, folderItem) {
    this.closeContextMenu(); // Close any existing menu

    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.innerHTML = `
      ${
        folderItem
          ? `
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
      `
          : `
        <div class="context-item" data-action="add-folder">
          <span>Add Folder</span>
        </div>
      `
      }
    `;

    // Position the menu
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    // Add event listeners
    menu.addEventListener("click", (e) => {
      const action = e.target.closest(".context-item")?.dataset.action;
      if (action) {
        this.handleContextAction(action, folderItem);
      }
      this.closeContextMenu();
    });

    document.body.appendChild(menu);
    this.currentContextMenu = menu;

    // Position adjustment if menu goes off screen
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${event.clientX - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${event.clientY - rect.height}px`;
      }
    });
  }

  closeContextMenu() {
    if (this.currentContextMenu) {
      this.currentContextMenu.remove();
      this.currentContextMenu = null;
    }
  }

  handleContextAction(action, folderItem) {
    const folderId = folderItem?.dataset.folderId;

    try {
      switch (action) {
        case "add-folder":
          this.showAddFolderDialog();
          break;
        case "edit":
          if (folderId) this.showEditFolderDialog(folderId);
          break;
        case "delete":
          if (folderId) this.showDeleteConfirmation(folderId);
          break;
        case "add-site":
          if (folderId) this.showAddSiteDialog(folderId);
          break;
        default:
          console.warn("Unknown context action:", action);
      }
    } catch (error) {
      console.error("Error handling context action:", error);
    }
  }

  // ============ CRUD Dialogs ============

  showAddFolderDialog() {
    const dialog = this.createDialog(
      "Add Folder",
      `
      <div class="dialog-field">
        <label for="folder-name">Folder Name:</label>
        <input type="text" id="folder-name" placeholder="Enter folder name" />
      </div>
      <div class="dialog-field">
        <label for="folder-color">Color:</label>
        <input type="color" id="folder-color" value="#4285f4" />
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Create", action: "create", primary: true },
      ]
    );

    dialog.addEventListener("action", (e) => {
      if (e.detail.action === "create") {
        const name = dialog.querySelector("#folder-name").value.trim();
        const color = dialog.querySelector("#folder-color").value;

        if (name) {
          try {
            this.folderSystem.createFolder(name, color);
            this.refreshFolders();
            console.log(`Folder "${name}" created successfully`);
          } catch (error) {
            console.error("Error creating folder:", error);
            alert("Failed to create folder. Please try again.");
          }
        } else {
          alert("Please enter a folder name.");
          return; // Don't close dialog
        }
      }
      this.closeDialog();
    });
  }

  showEditFolderDialog(folderId) {
    const folder = this.folderSystem.getFolderById(folderId);
    if (!folder) return;

    const dialog = this.createDialog(
      "Edit Folder",
      `
      <div class="dialog-field">
        <label for="folder-name">Folder Name:</label>
        <input type="text" id="folder-name" value="${folder.name}" />
      </div>
      <div class="dialog-field">
        <label for="folder-color">Color:</label>
        <input type="color" id="folder-color" value="${
          folder.color || "#4285f4"
        }" />
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Save", action: "save", primary: true },
      ]
    );

    dialog.addEventListener("action", (e) => {
      if (e.detail.action === "save") {
        const name = dialog.querySelector("#folder-name").value.trim();
        const color = dialog.querySelector("#folder-color").value;

        if (name) {
          try {
            this.folderSystem.updateFolder(folderId, { name, color });
            this.refreshFolders();
            console.log(`Folder updated successfully`);
          } catch (error) {
            console.error("Error updating folder:", error);
            alert("Failed to update folder. Please try again.");
          }
        } else {
          alert("Please enter a folder name.");
          return; // Don't close dialog
        }
      }
      this.closeDialog();
    });
  }

  showDeleteConfirmation(folderId) {
    const folder = this.folderSystem.getFolderById(folderId);
    if (!folder) return;

    const dialog = this.createDialog(
      "Delete Folder",
      `
      <p>Are you sure you want to delete "${folder.name}"?</p>
      <p class="warning">This action cannot be undone.</p>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Delete", action: "delete", primary: true, destructive: true },
      ]
    );

    dialog.addEventListener("action", (e) => {
      if (e.detail.action === "delete") {
        try {
          this.folderSystem.deleteFolder(folderId);
          this.refreshFolders();
          console.log(`Folder "${folder.name}" deleted successfully`);
        } catch (error) {
          console.error("Error deleting folder:", error);
          alert("Failed to delete folder. Please try again.");
        }
      }
      this.closeDialog();
    });
  }

  showAddSiteDialog(folderId) {
    const dialog = this.createDialog(
      "Add Site",
      `
      <div class="dialog-field">
        <label for="site-name">Site Name:</label>
        <input type="text" id="site-name" placeholder="Enter site name" />
      </div>
      <div class="dialog-field">
        <label for="site-url">URL:</label>
        <input type="url" id="site-url" placeholder="https://example.com" />
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Add", action: "add", primary: true },
      ]
    );

    dialog.addEventListener("action", (e) => {
      if (e.detail.action === "add") {
        const name = dialog.querySelector("#site-name").value.trim();
        const url = dialog.querySelector("#site-url").value.trim();

        if (name && url) {
          try {
            this.folderSystem.addSiteToFolder(folderId, { name, url });
            this.refreshFolders();
            console.log(`Site "${name}" added successfully`);
          } catch (error) {
            console.error("Error adding site:", error);
            alert("Failed to add site. Please check the URL and try again.");
          }
        } else {
          alert("Please enter both site name and URL.");
          return; // Don't close dialog
        }
      }
      this.closeDialog();
    });
  }

  createDialog(title, content, buttons) {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";

    const dialog = document.createElement("div");
    dialog.className = "dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-labelledby", "dialog-title");
    dialog.setAttribute("aria-modal", "true");

    dialog.innerHTML = `
      <div class="dialog-header">
        <h3 id="dialog-title">${title}</h3>
      </div>
      <div class="dialog-content">
        ${content}
      </div>
      <div class="dialog-buttons">
        ${buttons
          .map(
            (btn) =>
              `<button class="dialog-btn ${btn.primary ? "primary" : ""} ${
                btn.destructive ? "destructive" : ""
              }" 
                   data-action="${btn.action}" 
                   ${
                     btn.action === "cancel"
                       ? 'aria-label="Cancel and close dialog"'
                       : ""
                   }>${btn.text}</button>`
          )
          .join("")}
      </div>
    `;

    // Button event handling
    dialog.addEventListener("click", (e) => {
      const button = e.target.closest(".dialog-btn");
      if (button) {
        const action = button.dataset.action;
        dialog.dispatchEvent(new CustomEvent("action", { detail: { action } }));
      }
    });

    // Keyboard handling for dialog
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dialog.dispatchEvent(
          new CustomEvent("action", { detail: { action: "cancel" } })
        );
      }
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    this.currentDialog = overlay;

    // Focus management
    const firstInput = dialog.querySelector("input");
    const firstButton = dialog.querySelector(".dialog-btn");
    const focusTarget = firstInput || firstButton;

    if (focusTarget) {
      setTimeout(() => {
        focusTarget.focus();
        // Store previous focus to restore later
        this.previousFocus = document.activeElement;
      }, 100);
    }

    return dialog;
  }

  closeDialog() {
    if (this.currentDialog) {
      this.currentDialog.remove();
      this.currentDialog = null;

      // Restore previous focus
      if (this.previousFocus && document.body.contains(this.previousFocus)) {
        this.previousFocus.focus();
      }
      this.previousFocus = null;
    }
  }

  refreshFolders() {
    const folders = this.folderSystem.getAllFolders();
    this.renderFolders(folders);
  }

  // ============ Rendering ============

  clearContainer() {
    this.container.innerHTML = "";
  }

  renderFolders(folders) {
    this.clearContainer();
    folders.forEach((folder) => {
      const el = this.createFolderElement(folder);
      this.container.appendChild(el);
    });
    // Do not auto-focus to avoid showing outlines on initial load
  }

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
    if (folder.color)
      button.style.background = this.computeFolderBg(folder.color);

    const preview = this.createFolderPreview(folder.sites || []);
    button.appendChild(preview);

    // button contains the 2x2 grid already; preview returns a fragment-like div
    while (preview.firstChild) {
      button.appendChild(preview.firstChild);
    }

    const title = this.createFolderTitle(folder.name || "Folder");

    item.appendChild(button);
    item.appendChild(title);

    return item;
  }

  createFolderPreview(sites) {
    const wrapper = document.createElement("div");
    // generate up to 4 preview icons
    const previews = (sites || []).slice(0, 4);

    // Create exactly 4 slots for consistent layout
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement("div");
      slot.className = "folder-preview-icon";
      if (previews[i]) {
        const img = document.createElement("img");
        const url = previews[i].url;
        const src =
          previews[i].icon || this.folderSystem.generateFaviconUrl(url);
        img.src = src;
        img.loading = "lazy";
        img.alt = previews[i].name || "Site";
        this.attachFaviconErrorHandler(img, url);
        slot.appendChild(img);
      } else {
        // empty slot visual
        slot.style.opacity = "0.6";
      }
      wrapper.appendChild(slot);
    }
    return wrapper;
  }

  createFolderTitle(text) {
    const title = document.createElement("div");
    title.className = "folder-title";
    title.textContent = text;
    title.id = `folder-title-${text.replace(/\s+/g, "-").toLowerCase()}`;
    return title;
  }

  // ============ Modal / Overlay ============

  showModal(folder) {
    // Close any open popover when opening full modal
    this.closeFolderPopover?.();
    // Clear previous content
    this.overlay.innerHTML = "";

    const modal = this.createModal(folder);
    this.overlay.appendChild(modal);
    this.overlay.classList.add("open");
    this.overlay.style.display = "flex";
  }

  hideModal() {
    if (!this.overlay.classList.contains("open")) return;
    // Also close any open popover
    this.closeFolderPopover?.();
    this.overlay.classList.remove("open");
    this.overlay.style.display = "none";
    this.overlay.innerHTML = "";
  }

  createModal(folder) {
    const modal = document.createElement("div");
    modal.className = "folder-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-labelledby", "modal-title");
    modal.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.marginBottom = "16px";

    const title = document.createElement("h2");
    title.id = "modal-title";
    title.textContent = folder.name || "Folder";
    title.style.fontSize = "18px";
    title.style.fontWeight = "600";
    title.style.margin = "0";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.setAttribute("aria-label", "Close folder");
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "var(--text-color)";
    closeBtn.style.border = "1px solid rgba(255,255,255,0.2)";
    closeBtn.style.borderRadius = "8px";
    closeBtn.style.padding = "6px 10px";
    closeBtn.style.cursor = "pointer";
    closeBtn.addEventListener("click", () => this.hideModal());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const grid = document.createElement("div");
    grid.className = "site-grid";

    (folder.sites || []).forEach((site) => {
      const tile = document.createElement("a");
      tile.className = "site-tile";
      tile.href = site.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";
      tile.setAttribute("title", site.name || site.url);

      const iconWrap = document.createElement("div");
      iconWrap.style.width = "28px";
      iconWrap.style.height = "28px";
      iconWrap.style.marginRight = "10px";
      iconWrap.style.display = "flex";
      iconWrap.style.alignItems = "center";
      iconWrap.style.justifyContent = "center";
      iconWrap.style.borderRadius = "6px";
      iconWrap.style.background = "rgba(255,255,255,0.12)";

      const img = document.createElement("img");
      const favicon =
        site.icon || this.folderSystem.generateFaviconUrl(site.url);
      img.src = favicon;
      img.loading = "lazy";
      img.alt = site.name || "Site";
      img.width = 20;
      img.height = 20;
      this.attachFaviconErrorHandler(img, site.url);
      iconWrap.appendChild(img);

      const label = document.createElement("span");
      label.textContent = site.name || site.url;
      label.style.marginLeft = "4px";

      tile.style.display = "flex";
      tile.style.alignItems = "center";
      tile.style.padding = "10px";

      tile.appendChild(iconWrap);
      tile.appendChild(label);

      grid.appendChild(tile);
    });

    modal.appendChild(header);
    modal.appendChild(grid);
    return modal;
  }

  // ============ Localized Popover ============
  showFolderPopover(folder, anchorEl, clickPoint) {
    // Remove any existing popover
    this.closeFolderPopover();

  // Create invisible backdrop to capture outside clicks
  const backdrop = document.createElement("div");
  backdrop.className = "folder-popover-backdrop";
  document.body.appendChild(backdrop);

  const pop = document.createElement("div");
    pop.className = "folder-popover";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-labelledby", "folder-popover-title");

    const grid = document.createElement("div");
    grid.className = "site-grid";
    (folder.sites || []).forEach((site) => {
      const tile = document.createElement("a");
      tile.className = "site-tile";
      tile.href = site.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";
      tile.textContent = site.name || site.url;
      grid.appendChild(tile);
    });

    pop.appendChild(grid);
    const titleEl = document.createElement("div");
    titleEl.className = "popover-title";
    titleEl.textContent = folder.name || "Folder";
    titleEl.title = "Click to rename";
    titleEl.addEventListener("click", async () => {
      // Swap to input for inline rename
      const input = document.createElement("input");
      input.type = "text";
      input.className = "popover-title-input";
      input.value = folder.name || "Folder";
  // Replace node
      pop.replaceChild(input, titleEl);
  // Focus and place caret at end (no selection highlight for invisible input)
  input.focus();
  const v = input.value;
  input.setSelectionRange(v.length, v.length);

      let done = false;
      const commit = async () => {
        if (done) return;
        done = true;
        const newName = input.value.trim();
        // Restore title element if input still mounted
        titleEl.textContent = newName || folder.name || "Folder";
        if (input.isConnected) {
          try { pop.replaceChild(titleEl, input); } catch (_) { /* ignore */ }
        }
        if (newName && newName !== folder.name) {
          try {
            await this.folderSystem.updateFolder(folder.id, { name: newName });
            // Refresh tiles so the grid label updates
            this.refreshFolders?.();
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
            try { pop.replaceChild(titleEl, input); } catch (_) { /* ignore */ }
          }
          done = true; // prevent blur commit
        }
      };
      const onBlur = () => commit();
      input.addEventListener("keydown", onKey);
      input.addEventListener("blur", onBlur, { once: true });
    });
    pop.appendChild(titleEl);
  document.body.appendChild(pop);

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
    const popW = 420;
    const popH = 420;

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

    // Set transform origin relative to click point within the popover box to enhance the “expanding from click” effect
    const originX = Math.round(((cx - x) / popW) * 100);
    const originY = Math.round(((cy - y) / popH) * 100);
    pop.style.transformOrigin = `${originX}% ${originY}%`;

    // Trigger transition to visible state
    requestAnimationFrame(() => {
      pop.style.opacity = "1";
      pop.style.transform = "scale(1)";
    });

    // Close interactions
    const onBackdropClick = (e) => {
      // Any click on the backdrop closes the popover
      this.closeFolderPopover();
    };
    const onEsc = (e) => {
      if (e.key === "Escape") this.closeFolderPopover();
    };
    // Attach listeners after next tick to avoid immediate close from the opening click
    setTimeout(() => {
      backdrop.addEventListener("click", onBackdropClick);
      document.addEventListener("keydown", onEsc);
    }, 0);

    // Track resources for cleanup and toggle support
    pop._cleanup = () => {
      backdrop.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onEsc);
    };
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
    }
  }

  // ============ Favicon helpers ============

  attachFaviconErrorHandler(img, url) {
    const originKey = this.safeOrigin(url);
    img.addEventListener("error", () => {
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

    img.addEventListener("load", () => {
      this.faviconOk.add(originKey);
    });
  }

  safeOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return url;
    }
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

  /**
   * Show settings modal
   */
  showSettingsModal(settingsManager) {
    this.settingsManager = settingsManager;

    // Create modal HTML
    const modalHtml = `
      <div class="settings-modal">
        <div class="settings-content">
          <div class="settings-header">
            <h2 class="settings-title">Settings</h2>
            <div class="settings-tabs">
              <button class="settings-tab active" data-tab="appearance">Appearance</button>
              <button class="settings-tab" data-tab="layout">Layout</button>
              <button class="settings-tab" data-tab="clock">Clock</button>
              <button class="settings-tab" data-tab="accessibility">Accessibility</button>
              <button class="settings-tab" data-tab="data">Data</button>
            </div>
          </div>
          <div class="settings-body">
            <div class="settings-section active" data-section="appearance">
              <div class="setting-group">
                <label class="setting-label">Theme</label>
                <div class="setting-description">Choose a pre-built theme or create your own</div>
                <div class="theme-preview" id="theme-preview"></div>
              </div>
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="custom-theme">
                  <span>Use custom theme</span>
                </label>
              </div>
              <div class="setting-group" id="custom-colors" style="display: none;">
                <label class="setting-label">Background Color</label>
                <input type="color" class="setting-input" id="background-color">
                
                <label class="setting-label">Text Color</label>
                <input type="color" class="setting-input" id="text-color">
                
                <label class="setting-label">Primary Color</label>
                <input type="color" class="setting-input" id="primary-color">
              </div>
            </div>
            
            <div class="settings-section" data-section="layout">
              <div class="setting-group">
                <label class="setting-label">Grid Size</label>
                <div class="setting-description">Number of columns in the folder grid</div>
                <div class="setting-range">
                  <input type="range" id="grid-size" min="3" max="8" step="1">
                  <span class="range-value" id="grid-size-value">4</span>
                </div>
              </div>
            </div>
            
            <div class="settings-section" data-section="clock">
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="show-clock">
                  <span>Show clock widget</span>
                </label>
              </div>
              <div class="setting-group" id="clock-options">
                <label class="setting-label">Clock Format</label>
                <select class="setting-select" id="clock-format">
                  <option value="12h">12 Hour</option>
                  <option value="24h">24 Hour</option>
                </select>
                
                <label class="setting-label">Clock Position</label>
                <select class="setting-select" id="clock-position">
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
            </div>
            
            <div class="settings-section" data-section="accessibility">
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="high-contrast">
                  <span>High contrast mode</span>
                </label>
                <div class="setting-description">Increases contrast for better visibility</div>
              </div>
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="reduced-motion">
                  <span>Reduce motion</span>
                </label>
                <div class="setting-description">Minimizes animations and transitions</div>
              </div>
            </div>
            
            <div class="settings-section" data-section="data">
              <div class="setting-group">
                <label class="setting-label">Export Data</label>
                <div class="setting-description">Download your folders and settings as a JSON file</div>
                <button class="btn btn-secondary" id="export-data">Export Settings</button>
              </div>
              <div class="setting-group">
                <label class="setting-label">Import Data</label>
                <div class="setting-description">Import previously exported settings and folders</div>
                <div class="import-export">
                  <input type="file" class="file-input" id="import-file" accept=".json">
                  <label for="import-file" class="file-label">Choose File</label>
                </div>
              </div>
              <div class="setting-group">
                <label class="setting-label">Reset Settings</label>
                <div class="setting-description">Reset all settings to their default values</div>
                <button class="btn btn-secondary" id="reset-settings">Reset to Defaults</button>
              </div>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-secondary" id="cancel-settings">Cancel</button>
            <button class="btn btn-primary" id="save-settings">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    const modalEl = document.createElement("div");
    modalEl.innerHTML = modalHtml;
    document.body.appendChild(modalEl.firstElementChild);

    // Initialize modal
    this.initSettingsModal();
  }

  /**
   * Initialize settings modal events and populate current values
   */
  initSettingsModal() {
    const modal = document.querySelector(".settings-modal");
    const settings = this.settingsManager.getCurrentSettings();

    // Tab switching
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("settings-tab")) {
        const tabName = e.target.dataset.tab;

        // Update tab appearance
        modal
          .querySelectorAll(".settings-tab")
          .forEach((t) => t.classList.remove("active"));
        e.target.classList.add("active");

        // Update section visibility
        modal
          .querySelectorAll(".settings-section")
          .forEach((s) => s.classList.remove("active"));
        modal
          .querySelector(`[data-section="${tabName}"]`)
          .classList.add("active");
      }
    });

    // Populate theme preview
    this.populateThemePreview(modal, settings);

    // Populate current values
    this.populateSettingsValues(modal, settings);

    // Event handlers
    this.bindSettingsEvents(modal);

    // Close on backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeSettingsModal();
      }
    });

    // ESC key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal) {
        this.closeSettingsModal();
      }
    });
  }

  /**
   * Populate theme preview options
   */
  populateThemePreview(modal, settings) {
    const themePreview = modal.querySelector("#theme-preview");
    const themes = this.settingsManager.getAvailableThemes();

    themes.forEach((themeName) => {
      const theme = this.settingsManager.themes[themeName];
      const themeEl = document.createElement("div");
      themeEl.className = `theme-option ${
        settings.theme === themeName ? "active" : ""
      }`;
      themeEl.dataset.theme = themeName;
      themeEl.style.background = theme.backgroundGradient;
      themeEl.style.color = theme.textColor;
      themeEl.textContent =
        themeName.charAt(0).toUpperCase() + themeName.slice(1);

      themeEl.addEventListener("click", () => {
        modal
          .querySelectorAll(".theme-option")
          .forEach((t) => t.classList.remove("active"));
        themeEl.classList.add("active");
        modal.querySelector("#custom-theme").checked = false;
        this.toggleCustomTheme(modal, false);
      });

      themePreview.appendChild(themeEl);
    });
  }

  /**
   * Populate current settings values
   */
  populateSettingsValues(modal, settings) {
    // Grid size
    const gridSize = modal.querySelector("#grid-size");
    const gridSizeValue = modal.querySelector("#grid-size-value");
    gridSize.value = settings.gridSize;
    gridSizeValue.textContent = settings.gridSize;

    // Custom theme
    modal.querySelector("#custom-theme").checked = settings.customTheme;
    modal.querySelector("#background-color").value = settings.backgroundColor;
    modal.querySelector("#text-color").value = settings.textColor;
    modal.querySelector("#primary-color").value = settings.primaryColor;
    this.toggleCustomTheme(modal, settings.customTheme);

    // Clock settings
    modal.querySelector("#show-clock").checked = settings.showClock;
    modal.querySelector("#clock-format").value = settings.clockFormat;
    modal.querySelector("#clock-position").value = settings.clockPosition;
    this.toggleClockOptions(modal, settings.showClock);

    // Accessibility
    modal.querySelector("#high-contrast").checked =
      settings.accessibility?.highContrast || false;
    modal.querySelector("#reduced-motion").checked =
      settings.accessibility?.reducedMotion || false;
  }

  /**
   * Bind settings event handlers
   */
  bindSettingsEvents(modal) {
    // Grid size slider
    const gridSize = modal.querySelector("#grid-size");
    const gridSizeValue = modal.querySelector("#grid-size-value");
    gridSize.addEventListener("input", () => {
      gridSizeValue.textContent = gridSize.value;
    });

    // Custom theme toggle
    modal.querySelector("#custom-theme").addEventListener("change", (e) => {
      this.toggleCustomTheme(modal, e.target.checked);
      if (e.target.checked) {
        modal
          .querySelectorAll(".theme-option")
          .forEach((t) => t.classList.remove("active"));
      }
    });

    // Clock toggle
    modal.querySelector("#show-clock").addEventListener("change", (e) => {
      this.toggleClockOptions(modal, e.target.checked);
    });

    // Save settings
    modal.querySelector("#save-settings").addEventListener("click", () => {
      this.saveSettings(modal);
    });

    // Cancel
    modal.querySelector("#cancel-settings").addEventListener("click", () => {
      this.closeSettingsModal();
    });

    // Export data
    modal.querySelector("#export-data").addEventListener("click", () => {
      this.exportData();
    });

    // Import data
    modal.querySelector("#import-file").addEventListener("change", (e) => {
      this.importData(e.target.files[0]);
    });

    // Reset settings
    modal.querySelector("#reset-settings").addEventListener("click", () => {
      this.resetSettings(modal);
    });
  }

  /**
   * Toggle custom theme options visibility
   */
  toggleCustomTheme(modal, show) {
    const customColors = modal.querySelector("#custom-colors");
    customColors.style.display = show ? "block" : "none";
  }

  /**
   * Toggle clock options visibility
   */
  toggleClockOptions(modal, show) {
    const clockOptions = modal.querySelector("#clock-options");
    clockOptions.style.display = show ? "block" : "none";
  }

  /**
   * Save settings from modal
   */
  async saveSettings(modal) {
    try {
      const newSettings = {};

      // Get selected theme
      const selectedTheme = modal.querySelector(".theme-option.active");
      if (selectedTheme && !modal.querySelector("#custom-theme").checked) {
        newSettings.theme = selectedTheme.dataset.theme;
        newSettings.customTheme = false;
      } else if (modal.querySelector("#custom-theme").checked) {
        newSettings.customTheme = true;
        newSettings.backgroundColor =
          modal.querySelector("#background-color").value;
        newSettings.textColor = modal.querySelector("#text-color").value;
        newSettings.primaryColor = modal.querySelector("#primary-color").value;
      }

      // Grid size
      newSettings.gridSize = parseInt(modal.querySelector("#grid-size").value);

      // Clock settings
      newSettings.showClock = modal.querySelector("#show-clock").checked;
      newSettings.clockFormat = modal.querySelector("#clock-format").value;
      newSettings.clockPosition = modal.querySelector("#clock-position").value;

      // Accessibility
      newSettings.accessibility = {
        highContrast: modal.querySelector("#high-contrast").checked,
        reducedMotion: modal.querySelector("#reduced-motion").checked,
      };

      // Update settings
      await this.settingsManager.updateSettings(newSettings);

      this.closeSettingsModal();
      this.showNotification("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      this.showNotification(
        "Error saving settings. Please try again.",
        "error"
      );
    }
  }

  /**
   * Export data to file
   */
  async exportData() {
    try {
      const data = await this.settingsManager.exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `neotab-backup-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification("Settings exported successfully!");
    } catch (error) {
      console.error("Error exporting data:", error);
      this.showNotification("Error exporting data. Please try again.", "error");
    }
  }

  /**
   * Import data from file
   */
  async importData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      await this.settingsManager.importData(text);

      // Refresh the page to apply imported settings
      this.closeSettingsModal();
      this.showNotification(
        "Settings imported successfully! Refreshing...",
        "success"
      );

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error importing data:", error);
      this.showNotification(
        "Error importing data. Please check the file format.",
        "error"
      );
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(modal) {
    if (
      confirm(
        "Are you sure you want to reset all settings to defaults? This cannot be undone."
      )
    ) {
      try {
        await this.settingsManager.resetSettings();
        this.closeSettingsModal();
        this.showNotification("Settings reset successfully!");

        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } catch (error) {
        console.error("Error resetting settings:", error);
        this.showNotification(
          "Error resetting settings. Please try again.",
          "error"
        );
      }
    }
  }

  /**
   * Close settings modal
   */
  closeSettingsModal() {
    const modal = document.querySelector(".settings-modal");
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Show notification message
   */
  showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === "error" ? "#f56565" : "#48bb78"};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 20000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

if (typeof window !== "undefined") {
  window.UIManager = UIManager;
}
