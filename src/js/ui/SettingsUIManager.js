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
              <button class="settings-tab" data-tab="search">Search</button>
              <button class="settings-tab" data-tab="data">Data</button>
            </div>
          </div>
          <div class="settings-body">
            <div class="settings-section active" data-section="appearance">
              <div class="setting-group">
                <label class="setting-label">Theme</label>
                <div class="setting-description">Choose a pre-built theme or create your own</div>
                <div class="theme-live-preview" id="theme-live-preview">
                  <div class="tlp-bg">
                    <div class="tlp-tile" aria-hidden="true"></div>
                    <div class="tlp-tile" aria-hidden="true"></div>
                    <div class="tlp-tile" aria-hidden="true"></div>
                  </div>
                </div>
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
                <label class="setting-label">Main Grid Columns</label>
                <div class="setting-description">Number of columns in the main page grid (Auto adjusts based on screen size)</div>
                <div class="setting-range">
                  <select class="setting-select" id="main-grid-columns">
                    <option value="auto">Auto</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                  </select>
                </div>
              </div>
              <div class="setting-group">
                <label class="setting-label">Folder Grid Columns</label>
                <div class="setting-description">Number of columns inside folder popovers</div>
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
                <label class="setting-label">Clock Position</label>
                <div class="setting-description">Choose where the floating clock widget appears</div>
                <select class="setting-select" id="clock-position">
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
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
            <div class="settings-section" data-section="search">
              <div class="setting-group">
                <label class="setting-label">Search Engine</label>
                <div class="setting-description">Choose or define the search engine used by the search bar</div>
                <select class="setting-select" id="search-engine-select">
                  <option value="duckduckgo">DuckDuckGo</option>
                  <option value="google">Google</option>
                  <option value="bing">Bing</option>
                  <option value="brave">Brave</option>
                  <option value="custom">Custom...</option>
                </select>
              </div>
              <div class="setting-group" id="custom-search-group" style="display:none;">
                <label class="setting-label">Custom Name</label>
                <input type="text" class="setting-input" id="custom-search-name" placeholder="MyEngine">
                <label class="setting-label">Custom URL Template</label>
                <div class="setting-description">Use {query} placeholder for the search term.</div>
                <input type="text" class="setting-input" id="custom-search-template" placeholder="https://example.com/search?q={query}">
              </div>
              <div class="setting-group">
                <label class="setting-label">Preview</label>
                <div class="setting-description" id="search-preview">https://duckduckgo.com/?q={query}</div>
              </div>
            </div>
            
            <div class="settings-section" data-section="data">
              <div class="setting-group">
                <label class="setting-label">Export Data</label>
                <div class="setting-description">Download all your folders and settings as a backup file</div>
                <button class="nt-btn" id="export-data">Export Data</button>
              </div>
              <div class="setting-group">
                <label class="setting-label">Import Data</label>
                <div class="setting-description">Restore from a backup file (this will replace all current data)</div>
                <input type="file" class="setting-file" id="import-file" accept=".json" style="display: none;">
                <button class="nt-btn" id="import-data">Import Data</button>
              </div>
              <div class="setting-group">
                <label class="setting-label">Reset Settings</label>
                <div class="setting-description">Reset all settings to default values (folders will be preserved)</div>
                <button class="nt-btn nt-btn-danger" id="reset-settings">Reset to Defaults</button>
              </div>
            </div>
          </div>
          <div class="settings-footer">
            <button class="nt-btn" id="cancel-settings">Cancel</button>
            <button class="nt-btn nt-btn-primary" id="save-settings">Save Changes</button>
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
    const livePreview = modal.querySelector('#theme-live-preview');
    const themes = this.settingsManager.themes;

    const applyLive = (themeData) => {
      if(!livePreview) return;
      livePreview.style.background = themeData.backgroundGradient || themeData.backgroundColor;
      livePreview.querySelectorAll('.tlp-tile').forEach((el,i)=>{
        el.style.background = i===0 ? themeData.primaryColor : 'rgba(255,255,255,0.15)';
        el.style.borderColor = themeData.primaryColor;
      });
    };

    // Initialize with current theme
    const currentKey = settings.theme === 'auto' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light') : settings.theme;
    if(themes[currentKey]) applyLive(themes[currentKey]);

    Object.entries(themes).forEach(([themeName, themeData]) => {
      const themeOption = document.createElement('button');
      themeOption.type = 'button';
      themeOption.className = 'theme-option';
      themeOption.dataset.theme = themeName;
      themeOption.setAttribute('aria-label', `Activate ${themeName} theme`);

      if (settings.theme === themeName && !settings.customTheme) {
        themeOption.classList.add('active');
      }

      // Use CSS classes that rely on body.theme-* tokens for styling; fallback preview chips inside
      themeOption.innerHTML = `
        <div class="theme-preview-box">
          <div class="theme-preview-chip primary"></div>
          <div class="theme-preview-chip surface"></div>
          <div class="theme-preview-chip accent"></div>
        </div>
        <span class="theme-name">${themeName.charAt(0).toUpperCase() + themeName.slice(1)}</span>
      `;

      themeOption.addEventListener('mouseenter', () => applyLive(themeData));
      themeOption.addEventListener('focus', () => applyLive(themeData));
      themeOption.addEventListener('click', () => {
        modal.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('active'));
        themeOption.classList.add('active');
        const customToggle = modal.querySelector('#custom-theme');
        if (customToggle) customToggle.checked = false;
        const customSection = modal.querySelector('#custom-colors');
        if (customSection) customSection.style.display = 'none';
        applyLive(themeData);
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

    // Bind live custom theme preview (no persistence until Save)
    const customInputs = modal.querySelectorAll('#custom-colors input[type="color"]');
    customInputs.forEach(input => {
      input.addEventListener('input', () => {
        if (!modal.querySelector('#custom-theme').checked) return;
        const custom = {
          backgroundColor: modal.querySelector('#background-color').value,
          textColor: modal.querySelector('#text-color').value,
          primaryColor: modal.querySelector('#primary-color').value
        };
        this.applyCustomThemePreview(custom);
      });
    });

    // Layout settings
  const mainGridValue = settings.mainGridColumns === 'auto' ? 'auto' : String(settings.mainGridColumns || 'auto');
  modal.querySelector("#main-grid-columns").value = mainGridValue;
  modal.querySelector("#grid-columns").value = settings.gridSize || settings.gridColumns || 5;
  modal.querySelector("#grid-columns-value").textContent = settings.gridSize || settings.gridColumns || 5;
    modal.querySelector("#tile-size").value = settings.tileSize || 120;
    modal.querySelector("#tile-size-value").textContent = `${settings.tileSize || 120}px`;

    // Clock settings
  modal.querySelector("#show-clock").checked = settings.showClock !== false;
  modal.querySelector("#time-format").value = (settings.clockFormat === '24h' ? '24' : '12');
  modal.querySelector("#show-seconds").checked = settings.showSeconds || false;
  const posSelect = modal.querySelector('#clock-position');
  if (posSelect) posSelect.value = settings.clockPosition || 'bottom-right';

    // Accessibility settings
    modal.querySelector("#reduce-animations").checked = settings.reduceAnimations || false;
    modal.querySelector("#high-contrast").checked = settings.highContrast || false;
    modal.querySelector("#font-scale").value = settings.fontScale || 1.0;
    modal.querySelector("#font-scale-value").textContent = `${Math.round((settings.fontScale || 1.0) * 100)}%`;

    // Search engine
    const engine = settings.searchEngine || { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}' };
    const select = modal.querySelector('#search-engine-select');
    const customGroup = modal.querySelector('#custom-search-group');
    const customName = modal.querySelector('#custom-search-name');
    const customTemplate = modal.querySelector('#custom-search-template');
    const preview = modal.querySelector('#search-preview');
    const known = {
      'https://duckduckgo.com/?q={query}': 'duckduckgo',
      'https://www.google.com/search?q={query}': 'google',
      'https://www.bing.com/search?q={query}': 'bing',
      'https://search.brave.com/search?q={query}': 'brave'
    };
    const key = known[engine.template];
    if(key){
      select.value = key;
      customGroup.style.display = 'none';
    } else {
      select.value = 'custom';
      customGroup.style.display = 'block';
      customName.value = engine.name || '';
      customTemplate.value = engine.template || '';
    }
    preview.textContent = engine.template;
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
        // When switching to custom theme, seed the color pickers with the CURRENT effective theme
        // rather than leaving previous / default values (which felt random to users).
        modal.querySelectorAll(".theme-option").forEach(opt => opt.classList.remove("active"));

  const settings = this.settingsManager.getCurrentSettings();
  // IMPORTANT: Theme classes (theme-light, theme-ocean, etc.) attach custom property overrides on <body>,
  // so reading computed styles from document.documentElement returns ONLY base (dark) defaults.
  // Use body computed styles to capture the active theme's resolved palette.
  const styleTarget = document.body || document.documentElement;
  const rootStyles = getComputedStyle(styleTarget);

        // Helper: normalize rgb()/hex value to #RRGGBB for <input type="color">
        const toHex = (val) => {
          if (!val) return '#000000';
            val = val.trim();
            if (val.startsWith('#')) {
              // Ensure 7-char form
              if (val.length === 4) {
                return '#' + [...val.slice(1)].map(c=>c+c).join('');
              }
              return val.slice(0,7);
            }
            const rgbMatch = val.match(/rgba?\(([^)]+)\)/);
            if (rgbMatch) {
              const parts = rgbMatch[1].split(',').map(p=>parseInt(p.trim(),10)).slice(0,3);
              const hex = parts.map(n=> (isNaN(n)?0:n).toString(16).padStart(2,'0')).join('');
              return '#' + hex;
            }
            // Fallback: if it's something like 'white'
            const ctx = document.createElement('canvas').getContext('2d');
            try {
              ctx.fillStyle = val; // browser will parse or throw
              const computed = ctx.fillStyle; // may end up rgb(...)
              if (computed.startsWith('#')) return computed;
              const m2 = computed.match(/rgba?\(([^)]+)\)/);
              if (m2) {
                const parts = m2[1].split(',').map(p=>parseInt(p.trim(),10)).slice(0,3);
                return '#' + parts.map(n=> (isNaN(n)?0:n).toString(16).padStart(2,'0')).join('');
              }
            } catch(_) { /* ignore */ }
            return '#000000';
        };

        // Prefer live CSS variables so 'auto' / dynamic themes reflect real palette.
  let bg = rootStyles.getPropertyValue('--bg-color') || settings.backgroundColor;
  let text = rootStyles.getPropertyValue('--color-text-primary') || settings.textColor;
  let primary = rootStyles.getPropertyValue('--primary-color') || settings.primaryColor;

  // Trim to avoid leading whitespace from getPropertyValue
  bg = bg && bg.trim();
  text = text && text.trim();
  primary = primary && primary.trim();

        bg = toHex(bg);
        text = toHex(text);
        primary = toHex(primary);

        // Populate inputs so user sees their current palette as starting point.
        const bgInput = modal.querySelector('#background-color');
        const textInput = modal.querySelector('#text-color');
        const primaryInput = modal.querySelector('#primary-color');
        if (bgInput) bgInput.value = bg;
        if (textInput) textInput.value = text;
        if (primaryInput) primaryInput.value = primary;

        this.applyCustomThemePreview({
          backgroundColor: bg,
          textColor: text,
          primaryColor: primary
        });
      } else {
        this.removeCustomThemePreview();
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

    // Search engine events
    const select = modal.querySelector('#search-engine-select');
    const customGroup = modal.querySelector('#custom-search-group');
    const customName = modal.querySelector('#custom-search-name');
    const customTemplate = modal.querySelector('#custom-search-template');
    const preview = modal.querySelector('#search-preview');
    const templates = {
      duckduckgo: 'https://duckduckgo.com/?q={query}',
      google: 'https://www.google.com/search?q={query}',
      bing: 'https://www.bing.com/search?q={query}',
      brave: 'https://search.brave.com/search?q={query}'
    };
    select.addEventListener('change', ()=>{
      if(select.value === 'custom'){
        customGroup.style.display = 'block';
        preview.textContent = customTemplate.value || 'https://example.com/search?q={query}';
      } else {
        customGroup.style.display = 'none';
        preview.textContent = templates[select.value];
      }
    });
    customTemplate.addEventListener('input', ()=>{
      if(select.value === 'custom') preview.textContent = customTemplate.value;
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
        const bg = modal.querySelector("#background-color").value;
        const text = modal.querySelector("#text-color").value;
        const primary = modal.querySelector("#primary-color").value;
        newSettings.customColors = {
          backgroundColor: bg,
          textColor: text,
          primaryColor: primary
        };
        // Also persist legacy individual keys so existing code paths (and older exports) remain compatible.
        newSettings.backgroundColor = bg;
        newSettings.textColor = text;
        newSettings.primaryColor = primary;
        newSettings.backgroundGradient = bg; // simple fallback; user could customize later if UI adds gradient control
      }

      // Layout settings
  const mainGridSelect = modal.querySelector("#main-grid-columns").value;
  newSettings.mainGridColumns = mainGridSelect === 'auto' ? 'auto' : parseInt(mainGridSelect);
  newSettings.gridSize = parseInt(modal.querySelector("#grid-columns").value);
      newSettings.tileSize = parseInt(modal.querySelector("#tile-size").value);

      // Clock settings
      newSettings.showClock = modal.querySelector("#show-clock").checked;
  const tf = modal.querySelector("#time-format").value;
  newSettings.clockFormat = tf === '24' ? '24h' : '12h';
  newSettings.showSeconds = modal.querySelector("#show-seconds").checked;
  const clockPosEl = modal.querySelector('#clock-position');
  if (clockPosEl) newSettings.clockPosition = clockPosEl.value;

      // Accessibility settings
      newSettings.reduceAnimations = modal.querySelector("#reduce-animations").checked;
      newSettings.highContrast = modal.querySelector("#high-contrast").checked;
      newSettings.fontScale = parseFloat(modal.querySelector("#font-scale").value);

      // Search engine settings
      const engineSelect = modal.querySelector('#search-engine-select').value;
      if(engineSelect === 'custom'){
        const name = (modal.querySelector('#custom-search-name').value || 'Custom').trim();
        const template = modal.querySelector('#custom-search-template').value.trim();
        if(template.includes('{query}')){
          newSettings.searchEngine = { name, template };
        }
      } else {
        const map = {
          duckduckgo: { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}' },
          google: { name: 'Google', template: 'https://www.google.com/search?q={query}' },
          bing: { name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
          brave: { name: 'Brave', template: 'https://search.brave.com/search?q={query}' }
        };
        newSettings.searchEngine = map[engineSelect];
      }

      // Delegate actual settings save to SettingsManager
      await this.settingsManager.updateSettings(newSettings);
      
      this.closeSettingsModal();
      this.emit('notification', { message: 'Settings saved successfully!', type: 'success' });
      this.emit('settingsChanged', newSettings);
      // Refresh search bar if component hook available
      if(typeof window.__newtabSearchRefresh === 'function' && newSettings.searchEngine){
        window.__newtabSearchRefresh();
      }
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
      this.downloadFile(data, "newtab-backup.json");
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
          gridSize: 5,
          tileSize: 120,
          showClock: true,
          clockFormat: "12h",
            clockPosition: 'bottom-right',
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

  /**
   * Inject or update an ephemeral <style> block for live custom theme preview only.
   */
  applyCustomThemePreview(custom) {
    const id = 'newtab-custom-theme-preview';
    let styleEl = document.getElementById(id);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;
      document.head.appendChild(styleEl);
    }
    // Map chosen colors onto core tokens; allow gradient fallback to flat color
    styleEl.textContent = `body.theme-custom { --primary-color: ${custom.primaryColor}; --bg-color: ${custom.backgroundColor}; --background-gradient: ${custom.backgroundColor}; --color-text-primary: ${custom.textColor}; --color-text-secondary: ${custom.textColor}; --surface-panel-bg: ${custom.backgroundColor}; --surface-panel-border: color-mix(in srgb, ${custom.textColor} 15%, ${custom.backgroundColor}); --surface-popover-bg: color-mix(in srgb, ${custom.backgroundColor} 94%, #ffffff); }`;
    document.body.classList.add('theme-custom');
  }

  removeCustomThemePreview() {
    const styleEl = document.getElementById('newtab-custom-theme-preview');
    if (styleEl) styleEl.remove();
    document.body.classList.remove('theme-custom');
  }
}

// Export for both ES6 modules and browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = SettingsUIManager;
} else if (typeof window !== "undefined") {
  window.SettingsUIManager = SettingsUIManager;
}
