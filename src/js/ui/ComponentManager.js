// newtab - Base Component Manager
// Provides common patterns for all UI component managers including lifecycle management, 
// event cleanup, and shared utilities

class ComponentManager {
  /**
   * Base class for all UI component managers
   * @param {HTMLElement} container - DOM container element
   * @param {FolderSystem} folderSystem - Data/business logic layer
   */
  constructor(container, folderSystem) {
    this.container = container;
    this.folderSystem = folderSystem;
    this.eventListeners = [];
    this.customEventListeners = new Map(); // For custom events (on/emit pattern)
    this.isDestroyed = false;
  }

  /**
   * Register event listener for automatic cleanup
   * @param {HTMLElement} element - Element to attach listener to
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {Object} options - Event listener options
   */
  addEventListener(element, event, handler, options) {
    if (!element || !event || !handler) {
      console.warn('ComponentManager.addEventListener: Missing required parameters');
      return;
    }
    
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler, options });
  }

  /**
   * Cleanup all registered event listeners and resources
   */
  destroy() {
    if (this.isDestroyed) return;
    
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.warn('ComponentManager.destroy: Error removing event listener', error);
      }
    });
    
    this.eventListeners = [];
    this.customEventListeners.clear(); // Clean up custom event listeners
    this.isDestroyed = true;
  }

  /**
   * Create DOM element with attributes
   * @param {string} tag - HTML tag name
   * @param {string} className - CSS class name
   * @param {Object} attributes - Element attributes
   * @returns {HTMLElement} Created element
   */
  createElement(tag, className, attributes = {}) {
    if (!tag) {
      throw new Error('ComponentManager.createElement: tag is required');
    }
    
    const element = document.createElement(tag);
    if (className) element.className = className;
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(key, value);
      }
    });
    
    return element;
  }

  /**
   * Register a custom event listener
   * @param {string} eventName - Event name to listen for
   * @param {Function} handler - Event handler function
   */
  on(eventName, handler) {
    if (!eventName || typeof handler !== 'function') {
      console.warn('ComponentManager.on: Invalid eventName or handler');
      return;
    }

    if (!this.customEventListeners.has(eventName)) {
      this.customEventListeners.set(eventName, []);
    }
    
    this.customEventListeners.get(eventName).push(handler);
  }

  /**
   * Remove custom event listener
   * @param {string} eventName - Event name
   * @param {Function} handler - Handler to remove (optional - removes all if not provided)
   */
  off(eventName, handler) {
    if (!this.customEventListeners.has(eventName)) return;

    const handlers = this.customEventListeners.get(eventName);
    if (handler) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      // Remove all handlers for this event
      this.customEventListeners.set(eventName, []);
    }
  }

  /**
   * Emit custom event for component communication
   * @param {string} eventName - Event name
   * @param {*} detail - Event detail data
   */
  emit(eventName, detail = null) {
    // Emit to custom listeners first
    if (this.customEventListeners.has(eventName)) {
      const handlers = this.customEventListeners.get(eventName);
      handlers.forEach(handler => {
        try {
          handler(detail);
        } catch (error) {
          console.error(`ComponentManager.emit: Error in handler for ${eventName}:`, error);
        }
      });
    }

    // Also emit as DOM event for backward compatibility
    if (!this.container) return;
    
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    });
    
    this.container.dispatchEvent(event);
  }

  /**
   * Check if component is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this.isDestroyed;
  }
}

// Export to window for use by other modules
if (typeof window !== "undefined") {
  window.ComponentManager = ComponentManager;
}
