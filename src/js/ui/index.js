// UI Module Exports - Central export point for all UI components
// This module provides a unified namespace for all UI managers and components
// Useful for potential future bundling or module system integration

if (typeof window !== 'undefined') {
  window.UI = {
    ComponentManager,
    EventHandler,
    DragDropManager,
    DialogManager,
    PopoverManager,
    ContextMenuManager,
    RenderManager,
    SettingsUIManager,
    NotificationManager,
    UIManager
  };

  // Also expose individual components for backward compatibility
  window.UI.Components = {
    ComponentManager,
    EventHandler,
    DragDropManager,
    DialogManager,
    PopoverManager,
    ContextMenuManager,
    RenderManager,
    SettingsUIManager,
    NotificationManager
  };

  console.log('UI module exported with', Object.keys(window.UI).length - 1, 'components');
}

// For future ES6 module support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ComponentManager,
    EventHandler,
    DragDropManager,
    DialogManager,
    PopoverManager,
    ContextMenuManager,
    RenderManager,
    SettingsUIManager,
    NotificationManager,
    UIManager
  };
}
