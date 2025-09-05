// NeoTab - Main Application Entry Point
class NeoTabApp {
  constructor() {
    this.storageManager = new StorageManager();
    this.folderSystem = new FolderSystem(this.storageManager);
    this.settingsManager = new SettingsManager(this.storageManager);
    this.data = null;
    this.ui = null;
    this.init();
  }

  async init() {
    // Initialize performance monitoring
    if (typeof PerformanceMonitor !== "undefined") {
      this.performanceMonitor = new PerformanceMonitor();
    }

    // Initialize storage and load data
    await this.initializeData();

    // Initialize settings manager
    await this.settingsManager.init();

    this.updateClock();
    this.setupEventListeners();

    // Seed from topSites on first launch if empty, then periodic refresh
    try {
      await this.folderSystem.maybeSeedFromTopSites?.(12);
      // Run a periodic refresh after startup without blocking UI
      setTimeout(async () => {
        const changed = await this.folderSystem.periodicTopSitesRefresh?.({ intervalHours: 24, cap: 24 });
        if (changed && this.ui) {
          const items = this.folderSystem.getRootItems?.();
          const grid = document.getElementById("folder-grid");
          const overlay = document.getElementById("folder-overlay");
          if (!this.ui && grid && overlay) {
            this.ui = new UIManager(grid, overlay, this.folderSystem);
          }
          this.ui?.renderGrid?.(this.folderSystem.getAllFolders?.() || [], this.folderSystem.getAllLinks?.() || []);
        }
      }, 100);
    } catch (_) { /* ignore */ }

    // Initialize UI after data is ready
    const grid = document.getElementById("folder-grid");
    const overlay = document.getElementById("folder-overlay");
    if (grid && overlay) {
      this.ui = new UIManager(grid, overlay, this.folderSystem);
      this.ui.renderGrid(this.data.folders, this.data.links || []);
    }

    // Update clock every second (the settings manager also has its own clock)
    setInterval(() => this.updateClock(), 1000);
  }

  async initializeData() {
    try {
      // Initialize folder system (loads data via storage manager)
      await this.folderSystem.initialize();
      this.data = this.folderSystem.data;
    } catch (error) {
      if (window.errorHandler) {
        window.errorHandler.handleError({
          type: "initialization",
          message: error.message,
          stack: error.stack,
        });
      }
      // Use default data if loading fails
      this.data = this.storageManager.defaultData;
    }
  }

  updateClock() {
    const clockElement = document.getElementById("clock");
    if (clockElement) {
      const now = new Date();
      const hour12 = (this?.data?.settings?.clockFormat || "12h") === "12h";
      const opts = { hour: "2-digit", minute: "2-digit", hour12 };
      let timeString = now.toLocaleTimeString([], opts);
      // Ensure lowercase am/pm if present
      timeString = timeString.replace(/AM|PM/, (m) => m.toLowerCase());
      clockElement.textContent = timeString;
    }
  }

  setupEventListeners() {
    // Add button click handler
    const addButton = document.getElementById("add-button");
    if (addButton) {
      addButton.addEventListener("click", () => {
        this.ui?.showAddFolderDialog?.();
      });
    }

    // Settings button click handler
    const settingsButton = document.getElementById("settings-button");
    if (settingsButton) {
      settingsButton.addEventListener("click", () => {
        this.ui.showSettingsModal(this.settingsManager);
      });
    }

    // Folder grid click handler
    const folderGrid = document.getElementById("folder-grid");
    if (folderGrid) {
      folderGrid.addEventListener("click", (event) => {
        // Folder interaction will be implemented in later tasks
      });
    }

    // Overlay close handler
    const overlay = document.getElementById("folder-overlay");
    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          overlay.style.display = "none";
        }
      });
    }
  }

  async handleAddFolder() {
    // Use the UI dialog system for adding folders
    if (this.ui) {
      this.ui.showAddFolderDialog();
    } else {
      // Fallback for when UI isn't ready
      try {
        const folder = await this.folderSystem.createFolder("New Folder", {
          color: "#4285f4",
        });
        // Keep local reference in sync
        this.data = this.folderSystem.data;
        // Re-render UI if available
        this.ui?.renderGrid(this.data.folders, this.data.links || []);
      } catch (e) {
        if (window.errorHandler) {
          window.errorHandler.handleError({
            type: "folder_creation",
            message: e.message,
            stack: e.stack,
          });
        }
      }
    }
  }

  async saveSettings(newSettings) {
    try {
      this.data.settings = { ...this.data.settings, ...newSettings };
      const success = await this.storageManager.saveData(this.data);

      if (success) {
        this.applySettings(this.data.settings);
        return true;
      } else {
        if (window.errorHandler) {
          window.errorHandler.handleError({
            type: "settings_save",
            message: "Failed to save settings to storage",
          });
        }
        return false;
      }
    } catch (error) {
      if (window.errorHandler) {
        window.errorHandler.handleError({
          type: "settings_save",
          message: error.message,
          stack: error.stack,
        });
      }
      return false;
    }
  }
}

// Initialize the app once
(function initOnce() {
  const start = () => {
    if (!window.__neotabApp) {
      window.__neotabApp = new NeoTabApp();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
