# NeoTab Chrome Extension Development Guidelines

## Project Overview

### Core Purpose
- **Custom New Tab Extension**: Android-style folder organization for bookmarks
- **Target Platform**: Chrome Extension Manifest V3
- **Technology Stack**: Vanilla JavaScript, HTML5, CSS3 (NO frameworks)
- **Performance Target**: Sub-50KB bundle size, instant load times

### Key Constraints
- **NO external dependencies** or CDN resources
- **NO framework libraries** (React, Vue, Angular, jQuery, etc.)
- **Offline-first functionality** required
- **Android UI paradigm** must be maintained

## Chrome Extension Architecture

### Manifest V3 Requirements

#### Required Manifest Structure
```json
{
  "manifest_version": 3,
  "name": "NeoTab",
  "version": "1.0",
  "chrome_url_overrides": {
    "newtab": "index.html"
  },
  "permissions": ["storage"],
  "content_security_policy": {
    "extension_pages": "default-src 'self'"
  }
}
```

#### Critical Rules
- **MUST use chrome_url_overrides.newtab** for new tab page replacement
- **MUST declare storage permission** for chrome.storage.local access
- **MUST NOT use background scripts** unless absolutely necessary
- **MUST follow CSP restrictions** - only local resources allowed

### File Structure Standards

#### Required Directory Structure
```
/
├── manifest.json          (Extension entry point)
├── index.html             (New tab page)
├── src/
│   ├── js/
│   │   ├── app.js         (Main application logic)
│   │   ├── storage.js     (Data persistence layer)
│   │   ├── ui.js          (UI management)
│   │   └── folders.js     (Folder system logic)
│   └── css/
│       ├── main.css       (Core styles)
│       ├── folders.css    (Folder-specific styles)
│       └── animations.css (CSS transitions only)
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-128.png
└── assets/                (Static resources)
```

#### File Naming Rules
- **Use kebab-case** for all filenames
- **Use camelCase** for JavaScript variables/functions
- **Use PascalCase** for constructors/classes
- **Prefix private methods** with underscore (_methodName)

## Data Management Standards

### Chrome Storage API Usage

#### Required Storage Pattern
```javascript
// CORRECT: Use chrome.storage.local for all data persistence
const saveData = async (data) => {
  try {
    await chrome.storage.local.set({ neoTabData: data });
  } catch (error) {
    console.error('Storage failed:', error);
    // Implement fallback strategy
  }
};

const loadData = async () => {
  try {
    const result = await chrome.storage.local.get(['neoTabData']);
    return result.neoTabData || getDefaultData();
  } catch (error) {
    console.error('Storage retrieval failed:', error);
    return getDefaultData();
  }
};
```

#### Storage Schema Requirements
```json
{
  "folders": [
    {
      "id": "string (required)",
      "title": "string (required)",
      "sites": [
        {
          "title": "string (required)",
          "url": "string (required, valid URL)",
          "icon": "string (favicon URL)"
        }
      ]
    }
  ],
  "settings": {
    "gridSize": "number (3-6)",
    "backgroundColor": "string (hex color)",
    "textColor": "string (hex color)",
    "showClock": "boolean"
  },
  "version": "string (data schema version)"
}
```

#### Storage Rules
- **MUST use chrome.storage.local** for all data persistence
- **MUST implement error handling** for storage operations
- **MUST provide default fallback data** when storage fails
- **MUST include schema version** for future migrations
- **NEVER use localStorage** or sessionStorage

### Data Validation Standards

#### Required Validation Patterns
- **URL validation**: Must use URL constructor to validate site URLs
- **Schema validation**: Must validate all data against expected structure
- **Sanitization**: Must sanitize user input for XSS prevention
- **Error recovery**: Must handle corrupted data gracefully

## UI/UX Implementation Standards

### Android-Style Folder System

#### Folder Grid Requirements
- **Grid layout**: Use CSS Grid for folder positioning
- **Preview icons**: Show first 4 site favicons in 2x2 grid
- **Responsive design**: Adapt to different screen sizes
- **Touch targets**: Minimum 44px touch target size

#### Folder Expansion Behavior
```css
/* REQUIRED: Use CSS transitions for animations */
.folder-overlay {
  transition: opacity 0.3s ease, transform 0.3s ease;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
}

.folder-content {
  transform: translateY(20px);
  transition: transform 0.3s ease;
}

.folder-overlay.open .folder-content {
  transform: translateY(0);
}
```

#### Interaction Rules
- **Click folder**: Expand to full-screen overlay
- **Click outside**: Close folder overlay
- **Right-click**: Enter edit mode
- **Drag-and-drop**: Reorder folders/sites
- **Long press**: Mobile edit mode (touch devices)

### Icon Management Standards

#### Favicon Handling
```javascript
// CORRECT: Favicon URL generation
const getFaviconUrl = (siteUrl) => {
  try {
    const url = new URL(siteUrl);
    return `${url.protocol}//${url.hostname}/favicon.ico`;
  } catch (error) {
    return './assets/default-favicon.png'; // Local fallback
  }
};

// REQUIRED: Error handling for failed favicon loads
const handleFaviconError = (imgElement) => {
  imgElement.src = './assets/default-favicon.png';
  imgElement.onerror = null; // Prevent infinite error loops
};
```

#### Icon Rules
- **Use site_url + "/favicon.ico"** for favicon URLs
- **Provide local fallback** for failed favicon loads
- **Lazy load** non-visible favicons
- **Cache favicon URLs** in site data structure

## Performance Standards

### Bundle Size Requirements
- **Total bundle size**: Must be under 50KB
- **Individual file limits**:
  - CSS files: Max 10KB each
  - JavaScript files: Max 15KB each
  - Images: Optimize for web, use WebP when possible

### Optimization Rules
- **Use CSS transitions** instead of JavaScript animations
- **Minimize DOM manipulation** - batch updates when possible
- **Lazy load** non-critical resources
- **Debounce user input** events (search, drag operations)
- **Use requestAnimationFrame** for any JavaScript animations

### Memory Management
```javascript
// CORRECT: Clean up event listeners
class FolderManager {
  constructor() {
    this.boundHandlers = new Map();
  }
  
  addEventListeners() {
    const handler = this.handleFolderClick.bind(this);
    this.boundHandlers.set('folderClick', handler);
    document.addEventListener('click', handler);
  }
  
  removeEventListeners() {
    this.boundHandlers.forEach((handler, event) => {
      document.removeEventListener('click', handler);
    });
    this.boundHandlers.clear();
  }
}
```

## Code Standards

### JavaScript Requirements

#### Module Structure
```javascript
// CORRECT: Use ES6 modules with proper exports
export class FolderSystem {
  constructor(storageManager) {
    this.storage = storageManager;
    this.folders = [];
    this.isInitialized = false;
  }
  
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      const data = await this.storage.loadData();
      this.folders = data.folders || [];
      this.isInitialized = true;
    } catch (error) {
      console.error('Folder system initialization failed:', error);
      this.folders = this._getDefaultFolders();
    }
  }
  
  _getDefaultFolders() {
    return []; // Private method for default data
  }
}
```

#### Async/Await Rules
- **MUST use async/await** for all asynchronous operations
- **MUST handle errors** with try/catch blocks
- **AVOID callback patterns** - use Promises instead
- **AVOID Promise.then()** chains - use async/await

#### Error Handling Requirements
```javascript
// REQUIRED: Comprehensive error handling pattern
const performAction = async (action, data) => {
  try {
    const result = await action(data);
    return { success: true, data: result };
  } catch (error) {
    console.error(`Action failed: ${action.name}`, error);
    
    // Log to analytics if available
    if (window.analytics) {
      window.analytics.track('error', {
        action: action.name,
        error: error.message
      });
    }
    
    return { 
      success: false, 
      error: error.message,
      fallback: getDefaultResult()
    };
  }
};
```

### CSS Standards

#### Layout Rules
- **Use CSS Grid** for main layout structure
- **Use Flexbox** for component-level layouts
- **Avoid floats** and positioned layouts
- **Use CSS custom properties** for theming

#### Animation Guidelines
```css
/* REQUIRED: Use CSS transitions only */
.folder-item {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.folder-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* PROHIBITED: Complex JavaScript animations */
/* Use requestAnimationFrame only for gesture-based interactions */
```

## Development Workflow

### Testing Requirements

#### Local Testing Setup
1. **Load unpacked extension** in Chrome Developer Mode
2. **Open chrome://extensions/** for debugging
3. **Use Chrome DevTools** for console debugging
4. **Test storage operations** via DevTools Application tab

#### Required Test Cases
- **Storage persistence**: Data survives browser restart
- **Error recovery**: Graceful handling of corrupted data
- **Performance**: Page load under 100ms
- **Responsive design**: Works on various screen sizes
- **Accessibility**: Keyboard navigation support

### Debug Guidelines
```javascript
// CORRECT: Use structured logging
const Logger = {
  debug: (message, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NeoTab Debug] ${message}`, data);
    }
  },
  
  error: (message, error) => {
    console.error(`[NeoTab Error] ${message}`, error);
    // Report to error tracking if available
  }
};
```

## Security & Compliance

### Content Security Policy Rules
- **NO inline scripts** allowed in HTML
- **NO eval()** or Function() constructors
- **NO external resource loading** (CDNs, external APIs)
- **ALL resources must be local** or use chrome.runtime.getURL()

### XSS Prevention
```javascript
// CORRECT: Sanitize user input
const sanitizeInput = (input) => {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

// PROHIBITED: Direct innerHTML assignment
// element.innerHTML = userInput; // NEVER do this

// CORRECT: Safe DOM manipulation
const createSiteElement = (site) => {
  const element = document.createElement('div');
  element.className = 'site-item';
  
  const title = document.createElement('span');
  title.textContent = sanitizeInput(site.title);
  
  element.appendChild(title);
  return element;
};
```

## What You MUST Do

### When Adding New Features
- **Check storage quota** before adding large data structures
- **Implement progressive enhancement** for optional features
- **Add error boundaries** around new functionality
- **Update data schema version** if data structure changes

### When Modifying UI
- **Maintain Android design patterns** for consistency
- **Test touch interactions** on mobile devices
- **Ensure keyboard accessibility** for all features
- **Preserve performance** under 50KB bundle limit

### When Handling Data
- **Validate all input** before storage
- **Implement migration logic** for schema changes
- **Provide rollback capability** for failed operations
- **Monitor storage usage** to prevent quota issues

## What You MUST NOT Do

### Prohibited Technologies
- **NEVER use external frameworks** (React, Vue, Angular, jQuery)
- **NEVER load external resources** (CDNs, external APIs)
- **NEVER use localStorage** or sessionStorage
- **NEVER use synchronous APIs** when async alternatives exist

### Prohibited Patterns
- **NEVER use inline event handlers** in HTML
- **NEVER use eval()** or Function() constructors
- **NEVER ignore error handling** in async operations
- **NEVER exceed storage quotas** without user notification

### Development Restrictions
- **NEVER commit untested code** to the repository
- **NEVER hardcode URLs** or configuration values
- **NEVER implement features** without performance consideration
- **NEVER break backward compatibility** without migration path

## AI Decision-Making Standards

### When Implementing New Features
1. **Check existing code patterns** before adding functionality
2. **Verify Chrome Extension API compatibility** with Manifest V3
3. **Ensure Android UI consistency** with existing design
4. **Confirm storage schema compatibility** with current data

### Priority Decision Tree
1. **Security & Compliance** (highest priority)
2. **Performance & Bundle Size**
3. **User Experience & Accessibility**
4. **Code Maintainability**
5. **Feature Completeness** (lowest priority)

### Conflict Resolution
When requirements conflict:
1. **Security requirements** always take precedence
2. **Performance constraints** override convenience features
3. **User experience** takes priority over code simplicity
4. **Manifest V3 compliance** is non-negotiable

This document serves as the definitive guide for all development decisions. Any deviation from these rules requires explicit justification and documentation.
