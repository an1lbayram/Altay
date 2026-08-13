/**
 * LocalStorage Service Manager
 */

// NOTE: keys renamed from the old "historiamap_" prefix to "altay_" to match the project name.
// This intentionally invalidates any previously stored favorites/theme/search-history for existing
// users (localStorage keys are exact-match), but the project name has settled on "Altay" so the
// naming is corrected here.
const KEYS = {
  FAVORITES: 'altay_favorites',
  THEME_MODE: 'altay_theme_mode',
  MAP_TILE: 'altay_map_tile',
  LAST_LOCATION: 'altay_last_loc',
  SEARCH_HISTORY: 'altay_search_history'
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
    } catch {}
  }
};
