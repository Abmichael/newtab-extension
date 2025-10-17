/**
 * Weather Manager - Fetches and displays weather information
 */
class WeatherManager {
  constructor() {
    this.weatherData = null;
    this.updateInterval = 30 * 60 * 1000; // Update every 30 minutes
    this.cachedLocation = null;
    this.cacheKey = 'neotab_weather_cache';
  }

  /**
   * Get cached weather data from storage
   */
  async getCachedWeather() {
    try {
      const result = await chrome.storage.local.get([this.cacheKey]);
      if (result[this.cacheKey]) {
        const cached = result[this.cacheKey];
        const now = Date.now();
        const age = now - cached.timestamp;
        
        // Return cached data if less than 30 minutes old
        if (age < this.updateInterval) {
          console.log(`Using cached weather data (${Math.round(age / 1000 / 60)} minutes old)`);
          return cached.data;
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading weather cache:', error);
      return null;
    }
  }

  /**
   * Save weather data to cache
   */
  async cacheWeather(weatherData) {
    try {
      await chrome.storage.local.set({
        [this.cacheKey]: {
          data: weatherData,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error caching weather data:', error);
    }
  }

  /**
   * Get weather emoji based on conditions
   */
  getWeatherEmoji(weatherCode, isDay) {
    // Weather codes from Open-Meteo API
    // 0 = Clear sky, 1-3 = Partly cloudy, 45-48 = Fog
    // 51-67 = Rain, 71-77 = Snow, 80-99 = Thunderstorm
    
    if (weatherCode === 0) {
      return isDay ? '☀️' : '🌙';
    } else if (weatherCode >= 1 && weatherCode <= 3) {
      return isDay ? '⛅' : '☁️';
    } else if (weatherCode >= 45 && weatherCode <= 48) {
      return '🌫️';
    } else if (weatherCode >= 51 && weatherCode <= 67) {
      return '🌧️';
    } else if (weatherCode >= 71 && weatherCode <= 77) {
      return '❄️';
    } else if (weatherCode >= 80 && weatherCode <= 99) {
      return '⛈️';
    }
    return '🌤️'; // Default
  }

  /**
   * Get user's location using browser Geolocation API
   */
  async getLocation() {
    if (this.cachedLocation) {
      return this.cachedLocation;
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.cachedLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          resolve(this.cachedLocation);
        },
        (error) => {
          reject(error);
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  }

  /**
   * Get city name from coordinates using reverse geocoding
   */
  async getCityName(latitude, longitude) {
    try {
      // Using Nominatim reverse geocoding (OpenStreetMap, free, no key required)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NeoTab Chrome Extension'
        }
      });
      const data = await response.json();
      
      if (data && data.address) {
        // Try to get city, town, or village name
        return data.address.city || 
               data.address.town || 
               data.address.village || 
               data.address.county || 
               data.address.state || 
               'Unknown';
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error fetching city name:', error);
      return 'Unknown';
    }
  }

  /**
   * Fetch weather data from Open-Meteo API (free, no key required)
   */
  async fetchWeather(useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = await this.getCachedWeather();
        if (cached) {
          this.weatherData = cached;
          return cached;
        }
      }

      console.log('Fetching fresh weather data...');
      const location = await this.getLocation();
      const { latitude, longitude } = location;

      // Fetch weather data (Celsius by default)
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,is_day,weather_code&temperature_unit=celsius`;
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();

      // Fetch city name
      const cityName = await this.getCityName(latitude, longitude);

      this.weatherData = {
        temperature: Math.round(weatherData.current.temperature_2m),
        weatherCode: weatherData.current.weather_code,
        isDay: weatherData.current.is_day === 1,
        city: cityName
      };

      // Cache the fresh data
      await this.cacheWeather(this.weatherData);

      return this.weatherData;
    } catch (error) {
      console.error('Error fetching weather:', error);
      // Return fallback data
      return {
        temperature: '--',
        weatherCode: 0,
        isDay: true,
        city: 'Location unavailable',
        error: true
      };
    }
  }

  /**
   * Format weather string for display
   */
  formatWeatherDisplay(weatherData) {
    if (!weatherData) return '🌤️ -- Unknown';
    
    const emoji = this.getWeatherEmoji(weatherData.weatherCode, weatherData.isDay);
    const temp = weatherData.error ? '--' : `${weatherData.temperature}°`;
    const city = weatherData.city;
    
    return `${emoji} ${temp} ${city}`;
  }

  /**
   * Initialize weather updates
   */
  async init() {
    // Initial fetch (with cache)
    await this.updateWeather(true);

    // Set up periodic updates (force fresh data)
    setInterval(() => this.updateWeather(false), this.updateInterval);
  }

  /**
   * Update weather display
   */
  async updateWeather(useCache = true) {
    const weatherElement = document.getElementById('weather');
    if (!weatherElement) return;

    try {
      const data = await this.fetchWeather(useCache);
      weatherElement.textContent = this.formatWeatherDisplay(data);
    } catch (error) {
      console.error('Error updating weather:', error);
      weatherElement.textContent = '🌤️ -- Location unavailable';
    }
  }
}
