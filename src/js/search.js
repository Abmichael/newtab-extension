// NeoTab Search Bar Component
(function(){
  function getSettings(){
    try {
      if(window.__neotabApp && window.__neotabApp.settingsManager){
        return window.__neotabApp.settingsManager.getCurrentSettings();
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
        // Use same favicon generation strategy as links: simple Google S2 or fallback /favicon.ico
        logoSrc = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
      } catch(_) {
        logoSrc = 'icons/search-engines/duckduckgo.png';
      }
    }
    form.innerHTML = `
      <span class="engine-badge" title="Search engine">
        <img src="${logoSrc}" alt="${engine.name} logo" style="width:18px;height:18px;object-fit:contain;border-radius:4px;" />
      </span>
      <input type="text" id="neotab-search-input" placeholder="Search the web" aria-label="Search" />
      <button class="nt-btn nt-btn-primary search-submit" type="submit" aria-label="Search submit">Search</button>
    `;

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const q = form.querySelector('#neotab-search-input').value.trim();
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

    const settings = getSettings();
    buildForm(settings);

    // Listen for settings changes to update engine badge
    const observer = new MutationObserver(()=>{
      // no-op placeholder if future dynamic changes required
    });
    observer.observe(container, { childList: true, subtree: true });

    // Expose refresh method
    window.__neotabSearchRefresh = function(){
      buildForm(getSettings());
    };
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
