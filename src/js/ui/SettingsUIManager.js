// SettingsUIManager - Settings modal UI presentation
// Delegates data operations to existing SettingsManager while handling UI

class SettingsUIManager extends ComponentManager {
  /**
   * @param {HTMLElement} container - The main container element
   * @param {SettingsManager} settingsManager - The settings manager instance
   */
  constructor(container, settingsManager) {
    super(container, null);
    this.settingsManager = settingsManager;
    this.currentModal = null;
  }

  /**
   * Show the settings modal
   */
  showSettingsModal() {
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
                  <input type="range" class="setting-slider" id="grid-columns" min="2" max="8" value="5">
                  <span class="range-value" id="grid-columns-value">5</span>
                </div>
              </div>
              <div class="setting-group">
                <label class="setting-label">Tile Size</label>
                <div class="setting-description">Size of folder and link tiles</div>
                <div class="setting-range">
                  <input type="range" class="setting-slider" id="tile-size" min="80" max="160" value="120">
                  <span class="range-value" id="tile-size-value">120px</span>
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
              <div class="setting-group">
                <label class="setting-label">Time Format</label>
                <select class="setting-select" id="time-format">
                  <option value="12">12-hour (3:30 PM)</option>
                  <option value="24">24-hour (15:30)</option>
                </select>
              </div>
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="show-seconds">
                  <span>Show seconds</span>
                </label>
              </div>
            </div>
            
            <div class="settings-section" data-section="accessibility">
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="reduce-animations">
                  <span>Reduce animations</span>
                </label>
              </div>
              <div class="setting-group">
                <label class="setting-checkbox">
                  <input type="checkbox" id="high-contrast">
                  <span>High contrast mode</span>
                </label>
              </div>
              <div class="setting-group">
                <label class="setting-label">Text Size</label>
                <div class="setting-range">
                  <input type="range" class="setting-slider" id="font-scale" min="0.8" max="1.4" step="0.1" value="1.0">
                  <span class="range-value" id="font-scale-value">100%</span>
                </div>
              </div>
            </div>
            
            <div class="settings-section" data-section="data">
              <div class="setting-group">
                <label class="setting-label">Export Data</label>
                <div class="setting-description">Download all your folders and settings as a backup file</div>
                <button class="setting-button" id="export-data">Export Data</button>
              </div>
              <div class="setting-group">
                <label class="setting-label">Import Data</label>
                <div class="setting-description">Restore from a backup file (this will replace all current data)</div>
                <input type="file" class="setting-file" id="import-file" accept=".json" style="display: none;">
                <button class="setting-button" id="import-data">Import Data</button>
              </div>
              <div class="setting-group">
                <label class="setting-label">Reset Settings</label>
                <div class="setting-description">Reset all settings to default values (folders will be preserved)</div>
                <button class="setting-button setting-button-danger" id="reset-settings">Reset to Defaults</button>
              </div>
            </div>
          </div>
          <div class="settings-footer">
            <button class="setting-button setting-button-secondary" id="cancel-settings">Cancel</button>
            <button class="setting-button setting-button-primary" id="save-settings">Save Changes</button>
          </div>
        </div>
      </div>
    `;

    // Add to page
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Initialize modal
    this.initSettingsModal();
  }

  /**
   * Initialize settings modal events and populate current values
   */
  initSettingsModal() {
    const modal = document.querySelector(".settings-modal");
    this.currentModal = modal;
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
    const themes = this.settingsManager.themes;

    Object.entries(themes).forEach(([themeName, themeData]) => {
      const themeOption = document.createElement("div");
      themeOption.className = "theme-option";
      themeOption.dataset.theme = themeName;

      if (settings.theme === themeName && !settings.customTheme) {
        themeOption.classList.add("active");
      }

      themeOption.innerHTML = `
        <div class="theme-preview-box" style="
          background: ${themeData.backgroundGradient || themeData.backgroundColor};
          color: ${themeData.textColor};
          border-color: ${themeData.primaryColor};
        ">
          <div class="theme-preview-content" style="background: ${themeData.primaryColor}"></div>
        </div>
        <span class="theme-name">${themeName.charAt(0).toUpperCase() + themeName.slice(1)}</span>
      `;

      themeOption.addEventListener("click", () => {
        modal.querySelectorAll(".theme-option").forEach(opt => opt.classList.remove("active"));
        themeOption.classList.add("active");
        modal.querySelector("#custom-theme").checked = false;
        modal.querySelector("#custom-colors").style.display = "none";
      });

      themePreview.appendChild(themeOption);
    });
  }

  /**
   * Populate form with current settings values
   */
  populateSettingsValues(modal, settings) {
    // Custom theme toggle
    const customThemeCheckbox = modal.querySelector("#custom-theme");
    const customColorsGroup = modal.querySelector("#custom-colors");
    
    customThemeCheckbox.checked = settings.customTheme || false;
    customColorsGroup.style.display = settings.customTheme ? "block" : "none";

    // Custom colors
    if (settings.customTheme && settings.customColors) {
      modal.querySelector("#background-color").value = settings.customColors.backgroundColor || "#f9fafb";
      modal.querySelector("#text-color").value = settings.customColors.textColor || "#1f2937";
      modal.querySelector("#primary-color").value = settings.customColors.primaryColor || "#2563eb";
    }

    // Layout settings
    modal.querySelector("#grid-columns").value = settings.gridColumns || 5;
    modal.querySelector("#grid-columns-value").textContent = settings.gridColumns || 5;
    modal.querySelector("#tile-size").value = settings.tileSize || 120;
    modal.querySelector("#tile-size-value").textContent = `${settings.tileSize || 120}px`;

    // Clock settings
    modal.querySelector("#show-clock").checked = settings.showClock !== false;
    modal.querySelector("#time-format").value = settings.timeFormat || "12";
    modal.querySelector("#show-seconds").checked = settings.showSeconds || false;

    // Accessibility settings
    modal.querySelector("#reduce-animations").checked = settings.reduceAnimations || false;
    modal.querySelector("#high-contrast").checked = settings.highContrast || false;
    modal.querySelector("#font-scale").value = settings.fontScale || 1.0;
    modal.querySelector("#font-scale-value").textContent = `${Math.round((settings.fontScale || 1.0) * 100)}%`;
  }

  /**
   * Bind all settings form events
   */
  bindSettingsEvents(modal) {
    // Custom theme toggle
    const customThemeCheckbox = modal.querySelector("#custom-theme");
    const customColorsGroup = modal.querySelector("#custom-colors");
    
    customThemeCheckbox.addEventListener("change", (e) => {
      customColorsGroup.style.display = e.target.checked ? "block" : "none";
      if (e.target.checked) {
        modal.querySelectorAll(".theme-option").forEach(opt => opt.classList.remove("active"));
      }
    });

    // Range inputs
    modal.querySelectorAll(".setting-slider").forEach(slider => {
      slider.addEventListener("input", (e) => {
        const valueSpan = modal.querySelector(`#${e.target.id}-value`);
        if (valueSpan) {
          if (e.target.id === "font-scale") {
            valueSpan.textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
          } else if (e.target.id === "tile-size") {
            valueSpan.textContent = `${e.target.value}px`;
          } else {
            valueSpan.textContent = e.target.value;
          }
        }
      });
    });

    // Save button
    modal.querySelector("#save-settings").addEventListener("click", () => {
      this.saveSettings(modal);
    });

    // Cancel button
    modal.querySelector("#cancel-settings").addEventListener("click", () => {
      this.closeSettingsModal();
    });

    // Export data
    modal.querySelector("#export-data").addEventListener("click", () => {
      this.exportData();
    });

    // Import data
    modal.querySelector("#import-data").addEventListener("click", () => {
      modal.querySelector("#import-file").click();
    });
    modal.querySelector("#import-file").addEventListener("change", (e) => {
      if (e.target.files[0]) {
        this.importData(e.target.files[0]);
      }
    });

    // Reset settings
    modal.querySelector("#reset-settings").addEventListener("click", () => {
      this.resetSettings(modal);
    });
  }

  /**
   * Save settings from modal form
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
        newSettings.customColors = {
          backgroundColor: modal.querySelector("#background-color").value,
          textColor: modal.querySelector("#text-color").value,
          primaryColor: modal.querySelector("#primary-color").value
        };
      }

      // Layout settings
      newSettings.gridColumns = parseInt(modal.querySelector("#grid-columns").value);
      newSettings.tileSize = parseInt(modal.querySelector("#tile-size").value);

      // Clock settings
      newSettings.showClock = modal.querySelector("#show-clock").checked;
      newSettings.timeFormat = modal.querySelector("#time-format").value;
      newSettings.showSeconds = modal.querySelector("#show-seconds").checked;

      // Accessibility settings
      newSettings.reduceAnimations = modal.querySelector("#reduce-animations").checked;
      newSettings.highContrast = modal.querySelector("#high-contrast").checked;
      newSettings.fontScale = parseFloat(modal.querySelector("#font-scale").value);

      // Delegate actual settings save to SettingsManager
      await this.settingsManager.updateSettings(newSettings);
      
      this.closeSettingsModal();
      this.emit('notification', { message: 'Settings saved successfully!', type: 'success' });
      this.emit('settingsChanged', newSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      this.emit('notification', { message: 'Failed to save settings', type: 'error' });
    }
  }

  /**
   * Export data using SettingsManager
   */
  async exportData() {
    try {
      const data = await this.settingsManager.exportData();
      this.downloadFile(data, "neotab-backup.json");
      this.emit('notification', { message: 'Data exported successfully!', type: 'success' });
    } catch (error) {
      console.error("Export failed:", error);
      this.emit('notification', { message: 'Failed to export data', type: 'error' });
    }
  }

  /**
   * Import data using SettingsManager
   */
  async importData(file) {
    try {
      const text = await file.text();
      await this.settingsManager.importData(text);
      
      this.closeSettingsModal();
      this.emit('notification', { message: 'Data imported successfully! Page will reload.', type: 'success' });
      this.emit('dataImported');
      
      // Reload page after brief delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Import failed:", error);
      this.emit('notification', { message: 'Failed to import data: ' + error.message, type: 'error' });
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(modal) {
    if (confirm("Are you sure you want to reset all settings to defaults? This action cannot be undone.")) {
      try {
        const defaultSettings = {
          theme: "auto",
          customTheme: false,
          gridColumns: 5,
          tileSize: 120,
          showClock: true,
          timeFormat: "12",
          showSeconds: false,
          reduceAnimations: false,
          highContrast: false,
          fontScale: 1.0
        };

        await this.settingsManager.updateSettings(defaultSettings);
        
        this.closeSettingsModal();
        this.emit('notification', { message: 'Settings reset to defaults!', type: 'success' });
        this.emit('settingsChanged', defaultSettings);
      } catch (error) {
        console.error("Reset failed:", error);
        this.emit('notification', { message: 'Failed to reset settings', type: 'error' });
      }
    }
  }

  /**
   * Download a file with given content
   */
  downloadFile(content, filename) {
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Close the settings modal
   */
  closeSettingsModal() {
    const modal = document.querySelector(".settings-modal");
    if (modal) {
      modal.remove();
      this.currentModal = null;
    }
  }

  /**
   * Clean up settings UI manager
   */
  cleanup() {
    this.closeSettingsModal();
    super.cleanup();
  }
}

// Export for both ES6 modules and browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = SettingsUIManager;
} else if (typeof window !== "undefined") {
  window.SettingsUIManager = SettingsUIManager;
}
