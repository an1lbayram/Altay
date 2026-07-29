/**
 * LocalStorage Service Manager
 */

const KEYS = {
  FAVORITES: 'historiamap_favorites',
  THEME_MODE: 'historiamap_theme_mode',
  MAP_TILE: 'historiamap_map_tile',
  LAST_LOCATION: 'historiamap_last_loc',
  SEARCH_HISTORY: 'historiamap_search_history'
};

export const Storage = {
  getFavorites() {
    try {
      const data = localStorage.getItem(KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveFavorites(favorites) {
    try {
      localStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  },

  isFavorite(poiId) {
    const favorites = this.getFavorites();
    return favorites.some(item => item.id === poiId);
  },

  toggleFavorite(poi) {
    let favorites = this.getFavorites();
    const index = favorites.findIndex(item => item.id === poi.id);
    let isAdded = false;

    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push({
        id: poi.id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        category: poi.category,
        wikipedia: poi.wikipedia,
        tags: poi.tags,
        savedAt: new Date().toISOString()
      });
      isAdded = true;
    }

    this.saveFavorites(favorites);
    return { isAdded, favorites };
  },

  getThemeMode() {
    return localStorage.getItem(KEYS.THEME_MODE) || 'dark';
  },

  setThemeMode(mode) {
    localStorage.setItem(KEYS.THEME_MODE, mode);
  },

  getMapTile() {
    return localStorage.getItem(KEYS.MAP_TILE) || 'streets';
  },

  setMapTile(tileKey) {
    localStorage.setItem(KEYS.MAP_TILE, tileKey);
  },

  getSearchHistory() {
    try {
      const data = localStorage.getItem(KEYS.SEARCH_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addSearchHistory(term) {
    if (!term || !term.trim()) return;
    let history = this.getSearchHistory();
    history = history.filter(item => item.toLowerCase() !== term.toLowerCase());
    history.unshift(term.trim());
    if (history.length > 10) history = history.slice(0, 10);
    try {
      localStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify(history));
    } catch (e) {}
  }
};
