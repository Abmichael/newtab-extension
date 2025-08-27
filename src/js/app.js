// NeoTab - Main Application Entry Point
class NeoTabApp {
  constructor() {
    this.storageManager = new StorageManager();
  this.folderSystem = new FolderSystem(this.storageManager);
  this.data = null;
    this.init();
  }

  async init() {
    console.log("NeoTab initialized");
    
  // Initialize storage and load data
  await this.initializeData();
    
    this.updateClock();
    this.setupEventListeners();

    // Update clock every second
    setInterval(() => this.updateClock(), 1000);
  }

  async initializeData() {
    try {
      // Initialize folder system (loads data via storage manager)
      await this.folderSystem.initialize();
      this.data = this.folderSystem.data;
      console.log("Data loaded:", this.data);
      
      // Apply settings if available
      if (this.data.settings) {
        this.applySettings(this.data.settings);
      }
    } catch (error) {
      console.error("Error initializing data:", error);
      // Use default data if loading fails
      this.data = this.storageManager.defaultData;
    }
  }

  applySettings(settings) {
    // Apply background color
    if (settings.backgroundColor) {
      document.body.style.background = settings.backgroundColor;
    }
    
    // Apply text color
    if (settings.textColor) {
      document.documentElement.style.setProperty('--text-color', settings.textColor);
    }
    
    // Show/hide clock
    const clockElement = document.getElementById("clock");
    if (clockElement && typeof settings.showClock === 'boolean') {
      clockElement.style.display = settings.showClock ? 'block' : 'none';
    }
  }

  updateClock() {
    const clockElement = document.getElementById("clock");
    if (clockElement) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      clockElement.textContent = timeString;
    }
  }

  setupEventListeners() {
    // Add button click handler
    const addButton = document.getElementById("add-button");
    if (addButton) {
      addButton.addEventListener("click", () => {
        console.log("Add button clicked");
        this.handleAddFolder();
      });
    }

    // Folder grid click handler
    const folderGrid = document.getElementById("folder-grid");
    if (folderGrid) {
      folderGrid.addEventListener("click", (event) => {
        console.log("Folder grid clicked", event.target);
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
    // Create a new folder via FolderSystem
    try {
      console.log("Adding new folder...");
      const folder = await this.folderSystem.createFolder("New Folder", { color: "#4285f4" });
      console.log("Folder added:", folder);
      // Keep local reference in sync
      this.data = this.folderSystem.data;
    } catch (e) {
      console.error("Failed to add folder", e);
    }
  }

  async saveSettings(newSettings) {
    try {
      this.data.settings = { ...this.data.settings, ...newSettings };
      const success = await this.storageManager.saveData(this.data);
      
      if (success) {
        this.applySettings(this.data.settings);
        console.log("Settings saved successfully");
        return true;
      } else {
        console.error("Failed to save settings");
        return false;
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new NeoTabApp();
});

// Make sure the app works even if DOMContentLoaded has already fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new NeoTabApp());
} else {
  new NeoTabApp();
}
