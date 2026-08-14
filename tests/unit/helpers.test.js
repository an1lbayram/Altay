import { describe, it, expect, vi } from 'vitest';
import {
  calculateDistance,
  formatDistance,
  escapeHtml,
  debounce,
  getPoiCategory,
  CATEGORIES,
} from '../../src/js/utils/helpers.js';

describe('calculateDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(calculateDistance(41.0082, 28.9784, 41.0082, 28.9784)).toBe(0);
  });

  it('computes the great-circle distance between two known cities (Istanbul → Ankara)', () => {
    // Real-world reference distance is ~350km; haversine should land close to that.
    const km = calculateDistance(41.0082, 28.9784, 39.9334, 32.8597);
    expect(km).toBeGreaterThan(330);
    expect(km).toBeLessThan(360);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(0.45)).toBe('450 m');
  });

  it('formats distances >= 1km with one decimal', () => {
    expect(formatDistance(5.678)).toBe('5.7 km');
  });

  it('rounds meter values instead of truncating', () => {
    expect(formatDistance(0.9996)).toBe('1000 m');
  });
});

describe('escapeHtml', () => {
  it('escapes all five reserved HTML characters', () => {
    expect(escapeHtml(`<script>alert("x")&'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&amp;&#039;y&#039;&lt;/script&gt;'
    );
  });

  it('returns an empty string for falsy input instead of throwing', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('coerces non-string input to a string before escaping', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('debounce', () => {
  it('only invokes the wrapped function once after the wait period, with the last call\'s args', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');

    vi.useRealTimers();
  });
});

describe('getPoiCategory', () => {
  it('classifies museums', () => {
    expect(getPoiCategory({ tourism: 'museum' })).toBe('museum');
  });

  it('classifies castles, forts and city walls', () => {
    expect(getPoiCategory({ historic: 'castle' })).toBe('castle');
    expect(getPoiCategory({ historic: 'fort' })).toBe('castle');
    expect(getPoiCategory({ historic: 'citywalls' })).toBe('castle');
  });

  it('classifies archaeological sites and ruins as ancient', () => {
    expect(getPoiCategory({ historic: 'archaeological_site' })).toBe('ancient');
    expect(getPoiCategory({ historic: 'ruins' })).toBe('ancient');
  });

  it('classifies places of worship as religion', () => {
    expect(getPoiCategory({ amenity: 'place_of_worship' })).toBe('religion');
    expect(getPoiCategory({ historic: 'church' })).toBe('religion');
  });

  it('classifies monuments and memorials', () => {
    expect(getPoiCategory({ historic: 'monument' })).toBe('monument');
    expect(getPoiCategory({ historic: 'memorial' })).toBe('monument');
  });

  it('falls back to "historic" for unrecognized/empty tags', () => {
    expect(getPoiCategory({})).toBe('historic');
    expect(getPoiCategory()).toBe('historic');
  });

  it('every category returned by getPoiCategory has a matching CATEGORIES entry', () => {
    const tagSets = [
      { tourism: 'museum' },
      { historic: 'castle' },
      { historic: 'ruins' },
      { amenity: 'place_of_worship' },
      { historic: 'monument' },
      {},
    ];
    for (const tags of tagSets) {
      expect(CATEGORIES[getPoiCategory(tags)]).toBeDefined();
    }
  });
});
