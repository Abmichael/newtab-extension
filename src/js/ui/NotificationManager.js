// NotificationManager - Centralized notification system
// Provides consistent styling, timing, and animation support

class NotificationManager extends ComponentManager {
  /**
   * @param {HTMLElement} container - Optional container (not used for notifications)
   */
  constructor(container = null) {
    super(container, null);
    this.notifications = [];
    this.defaultDuration = 3000;
    this.maxNotifications = 5; // Limit concurrent notifications
  }

  /**
   * Show a notification message
   * @param {string} message - The message to display
   * @param {string} type - The notification type ('success', 'error', 'warning', 'info')
   * @param {number} duration - How long to show the notification in ms
   */
  show(message, type = 'success', duration = null) {
    duration = duration ?? this.defaultDuration;
    
    // Limit concurrent notifications
    if (this.notifications.length >= this.maxNotifications) {
      this.hideOldest();
    }

    const notification = this.createNotification(message, type);
    document.body.appendChild(notification);
    this.notifications.push(notification);
    
    // Position notification based on existing ones
    this.updatePositions();
    
    // Auto-hide after duration
    setTimeout(() => {
      this.hide(notification);
    }, duration);

    return notification;
  }

  /**
   * Create a notification element
   * @param {string} message - The message text
   * @param {string} type - The notification type
   * @returns {HTMLElement} The notification element
   */
  createNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Apply base styles
    notification.style.cssText = this.getNotificationStyles(type);
    
    // Add close button for longer notifications
    if (message.length > 50) {
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        line-height: 1;
      `;
      closeBtn.addEventListener('click', () => this.hide(notification));
      notification.appendChild(closeBtn);
      notification.style.paddingRight = '35px';
    }

    return notification;
  }

  /**
   * Get CSS styles for notification based on type
   * @param {string} type - The notification type
   * @returns {string} CSS styles string
   */
  getNotificationStyles(type) {
    const colors = {
      success: { bg: '#48bb78', border: '#38a169' },
      error: { bg: '#f56565', border: '#e53e3e' },
      warning: { bg: '#ed8936', border: '#dd6b20' },
      info: { bg: '#4299e1', border: '#3182ce' }
    };

    const color = colors[type] || colors.success;

    return `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${color.bg};
      border: 2px solid ${color.border};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 20000;
      max-width: 350px;
      word-wrap: break-word;
      animation: slideIn 0.3s ease;
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
  }

  /**
   * Hide a specific notification
   * @param {HTMLElement} notification - The notification to hide
   */
  hide(notification) {
    if (!notification || !notification.parentNode) return;

    notification.style.animation = 'slideOut 0.3s ease';
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      
      // Remove from array
      const index = this.notifications.indexOf(notification);
      if (index > -1) {
        this.notifications.splice(index, 1);
      }
      
      // Update positions of remaining notifications
      this.updatePositions();
    }, 300);
  }

  /**
   * Hide the oldest notification
   */
  hideOldest() {
    if (this.notifications.length > 0) {
      this.hide(this.notifications[0]);
    }
  }

  /**
   * Hide all notifications
   */
  hideAll() {
    [...this.notifications].forEach(notification => {
      this.hide(notification);
    });
  }

  /**
   * Update positions of all notifications to stack them properly
   */
  updatePositions() {
    this.notifications.forEach((notification, index) => {
      if (notification.parentNode) {
        const offset = index * 70; // 70px spacing between notifications
        notification.style.top = `${20 + offset}px`;
      }
    });
  }

  /**
   * Show success notification
   * @param {string} message - The message to display
   * @param {number} duration - Optional duration override
   */
  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error notification
   * @param {string} message - The message to display
   * @param {number} duration - Optional duration override
   */
  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  /**
   * Show warning notification
   * @param {string} message - The message to display
   * @param {number} duration - Optional duration override
   */
  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Show info notification
   * @param {string} message - The message to display
   * @param {number} duration - Optional duration override
   */
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  /**
   * Clean up notification manager
   */
  cleanup() {
    this.hideAll();
    super.cleanup();
  }
}

// Add CSS animations if not already present
if (typeof document !== 'undefined' && !document.querySelector('#notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .notification {
      cursor: default;
      user-select: none;
    }
    
    .notification:hover {
      transform: scale(1.02);
    }
  `;
  document.head.appendChild(style);
}

// Export for both ES6 modules and browser globals
if (typeof module !== "undefined" && module.exports) {
  module.exports = NotificationManager;
} else if (typeof window !== "undefined") {
  window.NotificationManager = NotificationManager;
}
