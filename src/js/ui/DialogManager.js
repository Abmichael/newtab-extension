// DialogManager - Handles all CRUD dialogs with proper focus management and accessibility
class DialogManager extends ComponentManager {
  constructor(container, folderSystem) {
    super(container, folderSystem);
    this.currentDialog = null;
    this.previousFocus = null;
  }

  // ============ Public Dialog Methods ============

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
            this.emit('foldersChanged');
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
          this.emit('foldersChanged');
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
            this.emit('foldersChanged');
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

  showAddLinkDialog() {
    const dialog = this.createDialog(
      "Add Link",
      `
      <div class="dialog-field">
        <label for="link-url">URL</label>
        <input type="url" id="link-url" placeholder="https://example.com" />
        <small class="hint">Title will be fetched automatically.</small>
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Add", action: "add", primary: true },
      ]
    );

    const addBtn = dialog.querySelector('[data-action="add"]');
    const urlInput = dialog.querySelector('#link-url');

    // Helper: fetch page title (fallback to hostname)
    const resolveTitle = async (url) => {
      // Basic validation first
      let u;
      try { u = new URL(url); } catch { throw new Error('Invalid URL'); }
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(u.href, { signal: controller.signal, mode: 'cors' });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('Bad status');
        const text = await res.text();
        const match = text.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (match) {
          const title = match[1].trim();
          if (title) return title.slice(0, 120);
        }
      } catch (e) {
        // Ignore fetch/parsing errors; we'll fallback
      }
      return u.hostname.replace(/^www\./, '');
    };

    const setLoading = (loading) => {
      if (loading) {
        addBtn.disabled = true;
        addBtn.dataset.originalText = addBtn.textContent;
        addBtn.textContent = 'Adding...';
      } else {
        addBtn.disabled = false;
        if (addBtn.dataset.originalText) addBtn.textContent = addBtn.dataset.originalText;
      }
    };

    dialog.addEventListener("action", async (e) => {
      if (e.detail.action === "add") {
        const url = urlInput.value.trim();
        if (!url) {
          alert("Please enter a URL.");
          return; // keep dialog open
        }
        setLoading(true);
        try {
          const title = await resolveTitle(url);
          await this.folderSystem.addRootLink({ name: title, url });
          this.emit('foldersChanged');
        } catch (err) {
          console.error('Failed to add link:', err);
          alert(err.message === 'Invalid URL' ? 'Invalid URL. Please check and try again.' : 'Failed to fetch page title. Link not added.');
          setLoading(false);
          return; // keep dialog open on failure
        }
      }
      this.closeDialog();
    });
  }

  showMoveLinkDialog(linkId) {
    const folders = this.folderSystem.getAllFolders();
    if (!folders.length) {
      this.emit('notification', {
        message: "No folders available. Create a folder first.",
        type: "error"
      });
      return;
    }

    const dialog = this.createDialog(
      "Move Link",
      `
      <div class="dialog-field">
        <label for="move-target-folder">Select folder</label>
        <select id="move-target-folder">
          ${folders
            .map((f) => `<option value="${f.id}">${f.name}</option>`)
            .join("")}
        </select>
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Move", action: "move", primary: true },
      ]
    );

    dialog.addEventListener("action", async (e) => {
      if (e.detail.action === "move") {
        const targetId = dialog.querySelector("#move-target-folder").value;
        try {
          await this.folderSystem.moveLinkToFolder(linkId, targetId);
          this.emit('linkMoved', { linkId, targetId });
          this.emit('notification', {
            message: "Link moved to folder.",
            type: "success"
          });
        } catch (err) {
          console.error("Failed to move link:", err);
          alert("Failed to move link.");
          return; // keep dialog open
        }
      }
      this.closeDialog();
    });
  }

  // ============ Dialog Infrastructure ============

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

  // ============ Cleanup ============

  cleanup() {
    this.closeDialog();
    super.cleanup();
  }
}
