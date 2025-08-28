// NeoTab - Settings Management and Customization Features
class SettingsManager {
  constructor(storageManager) {
    this.storage = storageManager;
    this.settings = {};
    this.systemThemeMedia = null;
    this.themes = {
      // 'auto' is a pseudo theme; it will map to light/dark based on system.
      auto: this.getAutoThemePreview(),
      light: {
        backgroundColor: "#f9fafb",
        textColor: "#1f2937",
        primaryColor: "#2563eb",
        backgroundGradient: "linear-gradient(135deg, #fafafa 0%, #f3f4f6 100%)",
      },
      dark: {
        backgroundColor: "#1a202c",
        textColor: "#e2e8f0",
        primaryColor: "#63b3ed",
        backgroundGradient: "linear-gradient(135deg, #2d3748 0%, #4a5568 100%)",
      },
      ocean: {
        backgroundColor: "#0e7490",
        textColor: "#ffffff",
        primaryColor: "#38bdf8",
        backgroundGradient: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)",
      },
      sunset: {
        backgroundColor: "#742a2a",
        textColor: "#fed7d7",
        primaryColor: "#f56565",
        backgroundGradient: "linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)",
      },
      forest: {
        backgroundColor: "#276749",
        textColor: "#c6f6d5",
        primaryColor: "#68d391",
        backgroundGradient: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
      },
    };
    this.clockWidget = null;
    this.clockInterval = null;
  }

  /**
   * Compute a presentational preview for the 'auto' theme based on current system preference.
   */
  getAutoThemePreview() {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark
      ? {
          backgroundColor: "#1a202c",
          textColor: "#e2e8f0",
          primaryColor: "#63b3ed",
          backgroundGradient:
            "linear-gradient(135deg, #2d3748 0%, #4a5568 100%)",
        }
      : {
          backgroundColor: "#f8fafc",
          textColor: "#1f2937",
          primaryColor: "#2563eb",
          backgroundGradient:
            "linear-gradient(135deg, #f8fafc 0%, #e5e7eb 100%)",
        };
  }

  /**
   * Initialize settings manager
   */
  async init() {
    try {
      const data = await this.storage.loadData();
      this.settings = data.settings || this.getDefaultSettings();
      await this.applySettings();
      this.initClock();
      return true;
    } catch (error) {
      if (window.errorHandler) {
        window.errorHandler.handleError({
          type: "settings_init",
          message: error.message,
          stack: error.stack,
        });
      }
      this.settings = this.getDefaultSettings();
      await this.applySettings();
      return false;
    }
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return {
      gridSize: 4,
      theme: "dark",
      backgroundColor: "#1a202c",
      textColor: "#e2e8f0",
      primaryColor: "#63b3ed",
      backgroundGradient: "linear-gradient(135deg, #2d3748 0%, #4a5568 100%)",
      showClock: false, // Disable by default to avoid conflicts
      clockFormat: "12h",
      clockPosition: "bottom-right", // Default to bottom-right to avoid header overlap
      customTheme: false,
      accessibility: {
        highContrast: false,
        reducedMotion: false,
      },
    };
  }

  /**
   * Update a single setting
   */
  async updateSetting(key, value) {
    try {
      // Validate setting
      if (!this.validateSetting(key, value)) {
        throw new Error(`Invalid setting value for ${key}`);
      }

      // Handle nested settings (e.g., accessibility.highContrast)
      if (key.includes(".")) {
        const [parent, child] = key.split(".");
        if (!this.settings[parent]) {
          this.settings[parent] = {};
        }
        this.settings[parent][child] = value;
      } else {
        this.settings[key] = value;
      }

      // Save to storage
      const data = await this.storage.loadData();
      data.settings = this.settings;
      await this.storage.saveData(data);

      // Apply changes immediately
      await this.applySettings();

      return true;
    } catch (error) {
      if (window.errorHandler) {
        window.errorHandler.handleError({
          type: "settings_update",
          message: error.message,
          stack: error.stack,
        });
      }
      return false;
    }
  }

  /**
   * Update multiple settings at once
   */
  async updateSettings(newSettings) {
    try {
      // Validate all settings first
      for (const [key, value] of Object.entries(newSettings)) {
        if (!this.validateSetting(key, value)) {
          throw new Error(`Invalid setting value for ${key}`);
        }
      }

      // Update settings
      Object.assign(this.settings, newSettings);

      // Save to storage
      const data = await this.storage.loadData();
      data.settings = this.settings;
      await this.storage.saveData(data);

      // Apply changes
      await this.applySettings();

      return true;
    } catch (error) {
      if (window.errorHandler) {
        window.errorHandler.handleError({
          type: "settings_bulk_update",
          message: error.message,
          stack: error.stack,
        });
      }
      return false;
    }
  }

  /**
   * Apply current settings to the DOM
   */
  async applySettings() {
    try {
      const root = document.documentElement;
      const body = document.body;

      // Apply theme
      if (this.settings.theme && !this.settings.customTheme) {
        // Handle 'auto' theme by mapping to system light/dark
        let effectiveThemeKey = this.settings.theme;
        if (this.settings.theme === "auto") {
          // Set up or refresh media listener
          if (typeof window !== "undefined" && window.matchMedia) {
            if (!this.systemThemeMedia) {
              this.systemThemeMedia = window.matchMedia(
                "(prefers-color-scheme: dark)"
              );
              // Listen for system theme changes and re-apply when in auto mode
              this.systemThemeMedia.addEventListener("change", () => {
                if (this.settings.theme === "auto") {
                  // Update preview cache for UI and re-apply
                  this.themes.auto = this.getAutoThemePreview();
                  this.applySettings();
                }
              });
            }
            effectiveThemeKey = this.systemThemeMedia.matches
              ? "dark"
              : "light";
          } else {
            effectiveThemeKey = "light";
          }
          // Keep 'auto' preview in sync
          this.themes.auto = this.getAutoThemePreview();
        }

        const themeData = this.themes[effectiveThemeKey] || this.themes.dark;
        root.style.setProperty("--bg-color", themeData.backgroundColor);
        root.style.setProperty("--text-color", themeData.textColor);
        root.style.setProperty("--primary-color", themeData.primaryColor);
        root.style.setProperty(
          "--background-gradient",
          themeData.backgroundGradient
        );

        // Apply body theme class for CSS overrides
        const themeKeys = Object.keys(this.themes);
        themeKeys.forEach((t) => body.classList.remove(`theme-${t}`));
        body.classList.remove("theme-custom");
        body.classList.add(`theme-${this.settings.theme}`);
        if (this.settings.theme === "auto") {
          body.classList.add(`theme-${effectiveThemeKey}`);
        }
      } else {
        // Apply custom theme
        root.style.setProperty("--bg-color", this.settings.backgroundColor);
        root.style.setProperty("--text-color", this.settings.textColor);
        root.style.setProperty("--primary-color", this.settings.primaryColor);
        root.style.setProperty(
          "--background-gradient",
          this.settings.backgroundGradient
        );

        // Mark as custom
        const themeKeys = Object.keys(this.themes);
        themeKeys.forEach((t) => body.classList.remove(`theme-${t}`));
        body.classList.add("theme-custom");
      }

      // Apply grid size
      root.style.setProperty("--grid-size", this.settings.gridSize);

      // Apply accessibility settings
      if (this.settings.accessibility?.highContrast) {
        document.body.classList.add("high-contrast");
      } else {
        document.body.classList.remove("high-contrast");
      }

      if (this.settings.accessibility?.reducedMotion) {
        document.body.classList.add("reduced-motion");
      } else {
        document.body.classList.remove("reduced-motion");
      }

      // Update clock
      this.updateClock();

      console.log("Settings applied successfully");
      return true;
    } catch (error) {
      console.error("Error applying settings:", error);
      return false;
    }
  }

  /**
   * Validate setting value
   */
  validateSetting(key, value) {
    const validations = {
      gridSize: (v) => Number.isInteger(v) && v >= 3 && v <= 8,
      theme: (v) =>
        typeof v === "string" &&
        (v === "auto" || this.themes[v] || v === "custom"),
      backgroundColor: (v) =>
        typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v),
      textColor: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v),
      primaryColor: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v),
      backgroundGradient: (v) => typeof v === "string",
      showClock: (v) => typeof v === "boolean",
      clockFormat: (v) => v === "12h" || v === "24h",
      clockPosition: (v) =>
        ["top-left", "top-right", "bottom-left", "bottom-right"].includes(v),
      customTheme: (v) => typeof v === "boolean",
      "accessibility.highContrast": (v) => typeof v === "boolean",
      "accessibility.reducedMotion": (v) => typeof v === "boolean",
    };

    const validator = validations[key];
    return validator ? validator(value) : true;
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    try {
      this.settings = this.getDefaultSettings();

      const data = await this.storage.loadData();
      data.settings = this.settings;
      await this.storage.saveData(data);

      await this.applySettings();
      console.log("Settings reset to defaults");
      return true;
    } catch (error) {
      console.error("Error resetting settings:", error);
      return false;
    }
  }

  /**
   * Export all data (settings + folders)
   */
  async exportData() {
    try {
      const data = await this.storage.loadData();
      const exportData = {
        folders: data.folders,
        settings: data.settings,
        version: data.version,
        exportDate: new Date().toISOString(),
        appVersion: "1.0",
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Error exporting data:", error);
      throw error;
    }
  }

  /**
   * Import data with validation
   */
  async importData(jsonString) {
    try {
      const importData = JSON.parse(jsonString);

      // Validate import data
      if (!this.validateImportData(importData)) {
        throw new Error("Invalid import data format");
      }

      // Create backup before import
      const currentData = await this.storage.loadData();
      const backupData = {
        ...currentData,
        backupDate: new Date().toISOString(),
      };

      // Save backup to a separate key
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        await chrome.storage.local.set({ neotab_backup: backupData });
      }

      // Import new data
      const newData = {
        folders: importData.folders || [],
        settings: {
          ...this.getDefaultSettings(),
          ...(importData.settings || {}),
        },
        version: importData.version || "1.0",
      };

      await this.storage.saveData(newData);
      this.settings = newData.settings;
      await this.applySettings();

      console.log("Data imported successfully");
      return true;
    } catch (error) {
      console.error("Error importing data:", error);
      throw error;
    }
  }

  /**
   * Validate import data structure
   */
  validateImportData(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    // Check if it's a valid NeoTab export
    if (!data.exportDate && !data.folders && !data.settings) {
      return false;
    }

    // Validate folders if present
    if (data.folders && !Array.isArray(data.folders)) {
      return false;
    }

    // Validate settings if present
    if (data.settings && typeof data.settings !== "object") {
      return false;
    }

    return true;
  }

  /**
   * Initialize clock widget
   */
  initClock() {
    // Remove existing clock
    const existingClock = document.querySelector(".clock-widget");
    if (existingClock) {
      existingClock.remove();
    }

    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }

    // Handle header clock visibility based on clock widget settings
    const headerClock = document.getElementById("clock");

    if (!this.settings.showClock) {
      // Show header clock if widget is disabled
      if (headerClock) {
        headerClock.style.display = "block";
      }
      return;
    }

    // If clock widget is enabled, check for conflicts with header clock
    if (this.settings.clockPosition === "top-right" && headerClock) {
      // Hide header clock to avoid overlap
      headerClock.style.display = "none";
    } else if (headerClock) {
      // Show header clock if no conflict
      headerClock.style.display = "block";
    }

    // Create clock element
    this.clockWidget = document.createElement("div");
    this.clockWidget.className = `clock-widget clock-${this.settings.clockPosition}`;
    this.clockWidget.innerHTML =
      '<div class="clock-time"></div><div class="clock-date"></div>';

    // Add to body
    document.body.appendChild(this.clockWidget);

    // Start clock updates
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  /**
   * Update clock display
   */
  updateClock() {
    if (!this.clockWidget || !this.settings.showClock) {
      return;
    }

    const now = new Date();
    const timeElement = this.clockWidget.querySelector(".clock-time");
    const dateElement = this.clockWidget.querySelector(".clock-date");

    if (timeElement && dateElement) {
      // Format time
      const timeOptions = {
        hour12: this.settings.clockFormat === "12h",
        hour: "2-digit",
        minute: "2-digit",
      };

      const timeString = now.toLocaleTimeString([], timeOptions);
      timeElement.textContent = timeString;

      // Format date
      const dateOptions = {
        weekday: "short",
        month: "short",
        day: "numeric",
      };

      const dateString = now.toLocaleDateString([], dateOptions);
      dateElement.textContent = dateString;
    }
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return Object.keys(this.themes);
  }

  /**
   * Get current settings
   */
  getCurrentSettings() {
    return { ...this.settings };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }

    if (this.clockWidget) {
      this.clockWidget.remove();
      this.clockWidget = null;
    }
  }
}

// Export for use in other modules
if (typeof window !== "undefined") {
  window.SettingsManager = SettingsManager;
}
