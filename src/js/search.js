// tilio Search Bar Component
(()=> {
  function getSettings(){
    try {
      if(window.__newtabApp?.settingsManager){
        return window.__newtabApp.settingsManager.getCurrentSettings();
      }
      // Fallback: attempt storage direct
      if(window.StorageManager){
        const sm = new StorageManager();
        // async load not possible synchronously; return defaults
        return sm.defaultData.settings;
      }
    } catch(e){
      return { searchEngine: { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}' } };
    }
  }

  function buildForm(settings){
    const engine = settings.searchEngine || { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}' };
    console.log('Search: Building form with engine:', engine.name);
    const container = document.getElementById('search-bar-container');
    if(!container) return;

    container.innerHTML = '';
    const form = document.createElement('form');
    form.setAttribute('autocomplete','off');
    const knownLogos = {
      'DuckDuckGo': 'icons/search-engines/duckduckgo.svg',
      'Google': 'icons/search-engines/google.svg',
      'Bing': 'icons/search-engines/bing.svg',
      'Brave': 'icons/search-engines/brave.svg'
    };
    // Derive domain for custom engine favicon
    let logoSrc = knownLogos[engine.name];
    if(!logoSrc){
      try {
        const u = new URL(engine.template.replace('{query}','test'));
        // Use Chrome Extension Favicon API for better accuracy
        const faviconBaseUrl = new URL(chrome.runtime.getURL("/_favicon/"));
        faviconBaseUrl.searchParams.set("pageUrl", u.origin);
        faviconBaseUrl.searchParams.set("size", "32");
        logoSrc = faviconBaseUrl.toString();
      } catch(_) {
        logoSrc = 'icons/search-engines/duckduckgo.svg';
      }
    }
    form.innerHTML = `
      <div class="search-leading">
        <span class="engine-badge" title="Search engine">
          <img src="${logoSrc}" alt="${engine.name} logo" 
               onerror="this.src='https://www.google.com/s2/favicons?domain=' + new URL('${engine.template.replace('{query}','test')}').hostname + '&sz=32';" />
        </span>
      </div>
      <input type="text" id="tilio-search-input" placeholder="${engine.name}" aria-label="Search" />
      <button class="nt-btn search-submit" type="submit" aria-label="Search submit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>Search</span>
      </button>`;

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = form.querySelector('#tilio-search-input').value.trim();
      if(!q) return;
      const url = engine.template.replace('{query}', encodeURIComponent(q));
      // Use chrome.tabs if available else fallback
      try {
        if(typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update){
          chrome.tabs.update({ url });
        } else {
          window.location.href = url;
        }
      } catch(err){
        window.location.href = url;
      }
    });

    container.appendChild(form);
  }

  function init(){
    const container = document.getElementById('search-bar-container');
    if(!container) return;

    // Initial build with current settings (may be defaults)
    const settings = getSettings();
    buildForm(settings);

    // Listen for settings changes to update engine badge
    const observer = new MutationObserver(()=>{
      // no-op placeholder if future dynamic changes required
    });
    observer.observe(container, { childList: true, subtree: true });

    // Expose refresh method
    window.__newtabSearchRefresh = ()=> {
      console.log('Search: Refreshing with current settings');
      buildForm(getSettings());
    };

    // Wait for app initialization and refresh with actual settings
    const checkAndRefresh = () => {
      if(window.__newtabApp?.settingsManager?.settings) {
        // App is fully initialized, refresh search bar with actual settings
        console.log('Search: App initialized, refreshing with loaded settings');
        window.__newtabSearchRefresh();
      } else {
        // App not ready yet, check again in a bit
        setTimeout(checkAndRefresh, 50);
      }
    };
    checkAndRefresh();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
