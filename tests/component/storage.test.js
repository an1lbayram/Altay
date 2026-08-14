import { describe, it, expect, beforeEach } from 'vitest';
import { Storage } from '../../src/js/services/storage.js';

beforeEach(() => {
  localStorage.clear();
});

describe('Storage.theme mode', () => {
  it('defaults to dark when nothing is stored', () => {
    expect(Storage.getThemeMode()).toBe('dark');
  });

  it('round-trips a stored value', () => {
    Storage.setThemeMode('light');
    expect(Storage.getThemeMode()).toBe('light');
  });
});

describe('Storage.map tile', () => {
  it('defaults to streets', () => {
    expect(Storage.getMapTile()).toBe('streets');
  });

  it('round-trips a stored value', () => {
    Storage.setMapTile('satellite');
    expect(Storage.getMapTile()).toBe('satellite');
  });
});

describe('Storage.favorites', () => {
  const poi = { id: 'node-1', name: 'Ayasofya', lat: 41.0086, lng: 28.9802, category: 'religion', tags: {} };

  it('starts empty', () => {
    expect(Storage.getFavorites()).toEqual([]);
    expect(Storage.isFavorite(poi.id)).toBe(false);
  });

  it('adds a POI on first toggle and reports isAdded: true', () => {
    const { isAdded, favorites } = Storage.toggleFavorite(poi);
    expect(isAdded).toBe(true);
    expect(favorites).toHaveLength(1);
    expect(Storage.isFavorite(poi.id)).toBe(true);
  });

  it('removes the same POI on a second toggle', () => {
    Storage.toggleFavorite(poi);
    const { isAdded, favorites } = Storage.toggleFavorite(poi);
    expect(isAdded).toBe(false);
    expect(favorites).toHaveLength(0);
    expect(Storage.isFavorite(poi.id)).toBe(false);
  });

  it('persists favorites across reads (backed by localStorage)', () => {
    Storage.toggleFavorite(poi);
    expect(Storage.getFavorites().map((f) => f.id)).toEqual([poi.id]);
  });
});

describe('Storage.search history', () => {
  it('adds a term to the front of the history', () => {
    Storage.addSearchHistory('İstanbul');
    Storage.addSearchHistory('Ankara');
    expect(Storage.getSearchHistory()).toEqual(['Ankara', 'İstanbul']);
  });

  it('de-duplicates case-insensitively, moving the repeated term to the front', () => {
    Storage.addSearchHistory('İstanbul');
    Storage.addSearchHistory('Ankara');
    Storage.addSearchHistory('istanbul');
    expect(Storage.getSearchHistory()).toEqual(['istanbul', 'Ankara']);
  });

  it('ignores blank/whitespace-only terms', () => {
    Storage.addSearchHistory('   ');
    expect(Storage.getSearchHistory()).toEqual([]);
  });

  it('caps history at 10 entries', () => {
    for (let i = 0; i < 15; i++) Storage.addSearchHistory(`term-${i}`);
    expect(Storage.getSearchHistory()).toHaveLength(10);
    expect(Storage.getSearchHistory()[0]).toBe('term-14');
  });
});
