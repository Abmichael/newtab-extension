/**
 * Performance monitoring utilities for newtab extension
 * Tracks load times, memory usage, and performance metrics
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTime: 0,
      domReadyTime: 0,
      renderTime: 0,
      memoryUsage: 0,
    };
    this.startTime = performance.now();
    this.init();
  }

  init() {
    // Measure DOM ready time
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.metrics.domReadyTime = performance.now() - this.startTime;
      });
    }

    // Measure full load time
    window.addEventListener("load", () => {
      this.metrics.loadTime = performance.now() - this.startTime;
      this.checkPerformanceThresholds();
    });

    // Monitor memory usage periodically
    this.startMemoryMonitoring();
  }

  measureRenderTime(label, fn) {
    const start = performance.now();
    const result = fn();
    const time = performance.now() - start;

    if (time > 16) {
      // More than one frame at 60fps
      console.warn(`Slow render detected for ${label}:`, time + "ms");
    }

    return result;
  }

  checkPerformanceThresholds() {
    if (this.metrics.loadTime > 100) {
      console.warn("Load time exceeded target:", this.metrics.loadTime + "ms");
    }

    if (this.metrics.domReadyTime > 50) {
      console.warn("DOM ready time slow:", this.metrics.domReadyTime + "ms");
    }
  }

  startMemoryMonitoring() {
    setInterval(() => {
      if (performance.memory) {
        this.metrics.memoryUsage = performance.memory.usedJSHeapSize;

        // Warn if memory usage exceeds 10MB
        if (this.metrics.memoryUsage > 10 * 1024 * 1024) {
          console.warn(
            "High memory usage detected:",
            Math.round(this.metrics.memoryUsage / 1024 / 1024) + "MB"
          );
        }
      }
    }, 30000); // Check every 30 seconds
  }

  getMetrics() {
    return { ...this.metrics };
  }

  // Cleanup method for memory optimization
  destroy() {
    // Clear any intervals or listeners if needed
    this.metrics = null;
  }
}

// Export for use in other modules
window.PerformanceMonitor = PerformanceMonitor;
