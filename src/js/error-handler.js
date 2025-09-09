/**
 * Global error handling and reporting system for NeoTab extension
 * Provides graceful error recovery and user-friendly error messages
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50; // Limit stored errors to prevent memory bloat
    this.isDevelopment =
      chrome.runtime && chrome.runtime.getManifest().version.includes("dev");
    this.init();
  }

  init() {
    // Global error handler for unhandled exceptions
    window.addEventListener("error", (event) => {
      this.handleError({
        type: "javascript",
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      });
    });

    // Promise rejection handler
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError({
        type: "promise",
        message: event.reason?.message || "Unhandled Promise Rejection",
        stack: event.reason?.stack,
      });
    });

    // Chrome extension specific error handling
    if (chrome.runtime) {
      chrome.runtime.onInstalled.addListener(() => {
        this.logInfo("Extension installed/updated successfully");
      });
    }
  }

  handleError(errorInfo) {
    const error = {
      ...errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Store error (with limit to prevent memory issues)
    this.errors.push(error);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log error based on environment
    if (this.isDevelopment) {
      console.error("Error caught by ErrorHandler:", error);
    } else {
      // In production, log minimal info
      console.error(
        "An error occurred. Error ID:",
        this.generateErrorId(error)
      );
    }

    // Show user-friendly error message
    this.showUserError(error);

    // Attempt recovery if possible
    this.attemptRecovery(error);
  }

  handleStorageError(operation, error) {
    const storageError = {
      type: "storage",
      operation: operation,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };

    this.handleError(storageError);

    // Storage-specific recovery
    if (operation === "quota_exceeded") {
      this.showUserMessage(
        "Storage is full. Please remove some folders or sites.",
        "warning"
      );
      return false;
    }

    return true;
  }

  attemptRecovery(error) {
    switch (error.type) {
      case "storage":
        // Try to clear cache or reset to defaults
        this.recoverStorage();
        break;
      case "render":
        // Refresh the UI
        if (window.uiManager) {
          setTimeout(() => window.uiManager.render(), 1000);
        }
        break;
    }
  }

  async recoverStorage() {
    try {
      // Check if storage is accessible
      await chrome.storage.local.get(["test"]);
      this.logInfo("Storage recovery successful");
    } catch (error) {
      this.showUserMessage(
        "Storage error. Please restart the browser.",
        "error"
      );
    }
  }

  showUserError(error) {
    if (error.type === "storage" && error.operation === "quota_exceeded") {
      return; // Already handled in handleStorageError
    }

    const message = this.getUserFriendlyMessage(error);
    this.showUserMessage(message, "error");
  }

  getUserFriendlyMessage(error) {
    const friendlyMessages = {
      storage: "Unable to save your changes. Please try again.",
      network: "Network connection issue. Please check your internet.",
      javascript: "Something went wrong. Please refresh the page.",
      promise: "An operation failed. Please try again.",
    };

    return friendlyMessages[error.type] || "An unexpected error occurred.";
  }

  showUserMessage(message, type = "info") {
    // Create or update notification element
    let notification = document.getElementById("error-notification");
    if (!notification) {
      notification = document.createElement("div");
      notification.id = "error-notification";
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 10000;
        max-width: 300px;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
      `;
      document.body.appendChild(notification);
    }

    // Style based on type
    const styles = {
      error: "background: #ff4444; color: white;",
      warning: "background: #ffaa00; color: white;",
      info: "background: #4444ff; color: white;",
      success: "background: #44ff44; color: black;",
    };

    notification.style.cssText += styles[type] || styles.info;
    notification.textContent = message;
    notification.style.opacity = "1";

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.style.opacity = "0";
        setTimeout(() => {
          if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    }, 5000);
  }

  generateErrorId(error) {
    return btoa(error.message + error.timestamp).substr(0, 8);
  }

  logInfo(message) {
    if (this.isDevelopment) {
      console.log("[NeoTab]", message);
    }
  }

  getErrorReport() {
    return {
      errors: this.errors.slice(-10), // Last 10 errors
      timestamp: new Date().toISOString(),
      version: chrome.runtime?.getManifest()?.version,
    };
  }

  clearErrors() {
    this.errors = [];
  }
}

// Initialize global error handler
window.errorHandler = new ErrorHandler();

// Export for use in other modules
window.ErrorHandler = ErrorHandler;
