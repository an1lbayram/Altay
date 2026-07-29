/**
 * Central State Store for Altay
 */
export const state = {
  userLocation: { lat: 41.0082, lng: 28.9784 }, // Istanbul default
  isRealUserLocation: false,
  currentRegionName: '', // Current city / district / region name (e.g. "Çorum", "Fethiye")
  radius: 5, // in km
  category: 'all', // 'all', 'historic', 'museum', 'castle', 'ancient', 'religion', 'monument'
  searchQuery: '',
  pois: [],
  favorites: [],
  mapTheme: 'streets', // 'streets', 'satellite', 'dark'
  themeMode: 'dark', // 'light' or 'dark'
  isLoading: false,
  listeners: new Set(),

  /**
   * Subscribe to state updates
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  /**
   * Notify subscribers of state changes
   */
  notify(key, value) {
    this.listeners.forEach(fn => fn(key, value, this));
  },

  /**
   * Update state property and notify
   */
  set(key, value) {
    if (this[key] === value) return;
    this[key] = value;
    this.notify(key, value);
  }
};
