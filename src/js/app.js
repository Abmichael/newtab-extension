// newtab - Main Application Entry Point
class newtabApp {
  constructor() {
    this.storageManager = new StorageManager();
    this.folderSystem = new FolderSystem(this.storageManager);
    this.settingsManager = new SettingsManager(this.storageManager);
    this.weatherManager = new WeatherManager();
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

    // Notify search component that settings are ready
    if (window.__newtabSearchRefresh) {
      window.__newtabSearchRefresh();
    }

    // Initialize weather display
    this.weatherManager.init();
    this.setupEventListeners();

    // Seed from topSites on first launch if empty, then periodic refresh
    try {
      await this.folderSystem.maybeSeedFromTopSites?.(12);
      // Run a periodic refresh after startup without blocking UI
      setTimeout(async () => {
        const changed = await this.folderSystem.periodicTopSitesRefresh?.({
          intervalHours: 24,
          cap: 24,
        });
        if (changed && this.ui) {
          const items = this.folderSystem.getRootItems?.();
          const grid = document.getElementById("folder-grid");
          const overlay = document.getElementById("folder-overlay");
          if (!this.ui && grid && overlay) {
            this.ui = new UIManager(grid, overlay, this.folderSystem);
          }
          this.ui?.renderGrid?.(
            this.folderSystem.getAllFolders?.() || [],
            this.folderSystem.getAllLinks?.() || []
          );
        }
      }, 100);
    } catch (_) {
      /* ignore */
    }

    // Initialize UI after data is ready
    const grid = document.getElementById("folder-grid");
    const overlay = document.getElementById("folder-overlay");
    if (grid && overlay) {
      this.ui = new UIManager(grid, overlay, this.folderSystem);
      this.ui.renderGrid(this.data.folders, this.data.links || []);
    }

    // Reveal UI now that settings and initial render are done
    try {
      document.body.classList.remove("preload");
    } catch (_) { /* ignore */ }

    // Safety: ensure UI is visible even if something above failed
    setTimeout(() => {
      try { document.body.classList.remove("preload"); } catch (_) {}
    }, 1500);
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

  setupEventListeners() {
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

    // Listen for refresh requests from drag and drop operations
    if (folderGrid) {
      folderGrid.addEventListener("newtab:refresh-needed", (event) => {
        console.log("Refreshing grid due to:", event.detail?.reason);
        this.refreshGrid();
      });
    }
  }

  async handleAddFolder() {
    // Folder creation now only supported through drag and drop operations
    console.warn("Direct folder creation disabled - use drag and drop to create folders");
  }

  /**
   * Refresh the grid display with current data
   */
  refreshGrid() {
    if (this.ui && this.folderSystem) {
      const folders = this.folderSystem.getAllFolders?.() || [];
      const links = this.folderSystem.getAllLinks?.() || [];
      this.ui.renderGrid(folders, links);
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
    if (!window.__newtabApp) {
      window.__newtabApp = new newtabApp();
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
