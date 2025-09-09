// DialogManager - Handles all CRUD dialogs with proper focus management and accessibility
class DialogManager extends ComponentManager {
  constructor(container, folderSystem) {
    super(container, folderSystem);
    this.currentDialog = null;
    this.previousFocus = null;
  }

  // ============ Public Dialog Methods ============

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
            this.emit('foldersChanged');
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
        <label for="link-name">Name</label>
        <input type="text" id="link-name" placeholder="Enter name" />
      </div>
      <div class="dialog-field">
        <label for="link-url">URL</label>
        <input type="url" id="link-url" placeholder="https://example.com" />
      </div>
      <div class="dialog-field">
        <label for="link-location">Location</label>
        <select id="link-location">
          <option value="root" selected>Home grid</option>
          ${this.folderSystem
            .getAllFolders()
            .map(
              (f) => `<option value="folder:${f.id}">Folder: ${f.name}</option>`
            )
            .join("")}
        </select>
      </div>
    `,
      [
        { text: "Cancel", action: "cancel" },
        { text: "Add", action: "add", primary: true },
      ]
    );

    dialog.addEventListener("action", async (e) => {
      if (e.detail.action === "add") {
        const name = dialog.querySelector("#link-name").value.trim();
        const url = dialog.querySelector("#link-url").value.trim();
        const loc = dialog.querySelector("#link-location").value;
        if (!name || !url) {
          alert("Please enter both name and URL.");
          return;
        }
        try {
          if (loc === "root") {
            await this.folderSystem.addRootLink({ name, url });
          } else if (loc.startsWith("folder:")) {
            const folderId = loc.slice("folder:".length);
            await this.folderSystem.addSiteToFolder(folderId, { name, url });
          }
          this.emit('foldersChanged');
        } catch (err) {
          console.error("Failed to add link:", err);
          alert("Failed to add link. Please check the URL and try again.");
          return;
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
