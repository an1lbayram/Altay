import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchStaticElements, cellKey, _resetStaticCache } from '../../src/js/services/poiStatic.js';
import { fetchPOIs, OVERPASS_ENDPOINTS } from '../../src/js/services/overpass.js';

const FETHIYE = { lat: 36.6214, lng: 29.1164 };

const INDEX = {
  version: 1,
  cellSize: 0.5,
  layers: ['core', 'worship'],
  cells: { '73_58': [3, 1], '72_58': [1, 0] },
};

const FILES = {
  '/data/poi/index.json': INDEX,
  '/data/poi/core/73_58.json': [
    ['n', 1, 36.62, 29.12, { historic: 'tomb', name: 'Amyntas Kaya Mezarları' }],
    ['w', 2, 36.6205, 29.1105, { historic: 'castle', name: 'Fethiye Kalesi' }],
    ['n', 3, 36.95, 29.45, { historic: 'ruins', name: 'Uzaktaki Kalıntı' }],
  ],
  '/data/poi/core/72_58.json': [['r', 4, 36.4, 29.42, { historic: 'archaeological_site', name: 'Tlos' }]],
  '/data/poi/worship/73_58.json': [['n', 5, 36.621, 29.115, { amenity: 'place_of_worship', name: 'Yeni Cami' }]],
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

let fetchMock;

beforeEach(() => {
  _resetStaticCache();
  fetchMock = vi.fn(async (url) => (url in FILES ? jsonResponse(FILES[url]) : jsonResponse(null, 404)));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const requested = () => fetchMock.mock.calls.map(([url]) => url);

describe('cellKey', () => {
  it('0,5 derecelik hucre anahtari uretir', () => {
    expect(cellKey(FETHIYE.lat, FETHIYE.lng, 0.5)).toBe('73_58');
    expect(cellKey(-0.1, -0.1, 0.5)).toBe('-1_-1');
  });
});

describe('fetchStaticElements', () => {
  it('yaricap icindekileri Overpass bicimiyle doner, disindakileri eler', async () => {
    const els = await fetchStaticElements({ ...FETHIYE, radiusKm: 5, category: 'all' });
    expect(els.map((e) => e.id).sort()).toEqual([1, 2]);
    expect(els.find((e) => e.id === 1)).toMatchObject({ type: 'node', lat: 36.62, lon: 29.12 });
    expect(els.find((e) => e.id === 2)).toMatchObject({ type: 'way', center: { lat: 36.6205, lon: 29.1105 } });
  });

  it('50 km aramada komsu hucreleri de yukler (Tlos)', async () => {
    const els = await fetchStaticElements({ ...FETHIYE, radiusKm: 50, category: 'all' });
    expect(els.map((e) => e.id).sort()).toEqual([1, 2, 3, 4]);
    expect(requested()).toContain('/data/poi/core/72_58.json');
  });

  it('ibadethane katmanini yalnizca religion kategorisinde indirir', async () => {
    await fetchStaticElements({ ...FETHIYE, radiusKm: 5, category: 'all' });
    expect(requested()).not.toContain('/data/poi/worship/73_58.json');

    const els = await fetchStaticElements({ ...FETHIYE, radiusKm: 5, category: 'religion' });
    expect(requested()).toContain('/data/poi/worship/73_58.json');
    expect(els.map((e) => e.id)).toEqual([5]);
  });

  it('kapsam disinda (Turkiye disi) null doner ve hucre indirmez', async () => {
    expect(await fetchStaticElements({ lat: 48.85, lng: 2.35, radiusKm: 10 })).toBeNull();
    expect(requested()).toEqual(['/data/poi/index.json']);
  });

  it('index yuklenemezse null doner ve sonraki aramada tekrar dener', async () => {
    fetchMock.mockImplementationOnce(async () => jsonResponse(null, 500));
    expect(await fetchStaticElements({ ...FETHIYE, radiusKm: 5 })).toBeNull();
    expect(await fetchStaticElements({ ...FETHIYE, radiusKm: 5 })).toHaveLength(2);
  });

  it('iptal edilen aramada AbortError firlatir', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(fetchStaticElements({ ...FETHIYE, radiusKm: 5, signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});

describe('fetchPOIs', () => {
  it('Turkiye icinde hazir veriyi kullanir, Overpass cagirmaz', async () => {
    const pois = await fetchPOIs({ ...FETHIYE, radius: 5, category: 'all' });
    expect(pois.map((p) => p.name)).toEqual(['Amyntas Kaya Mezarları', 'Fethiye Kalesi']);
    expect(requested().some((u) => OVERPASS_ENDPOINTS.includes(u))).toBe(false);
  });

  it('Turkiye disinda Overpass a gider; remark hatasi bir sonraki aynaya gecirir', async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === '/data/poi/index.json') return jsonResponse(INDEX);
      if (url === OVERPASS_ENDPOINTS[0]) {
        return jsonResponse({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 31 seconds.' });
      }
      if (url === OVERPASS_ENDPOINTS[1]) {
        return jsonResponse({ elements: [{ type: 'node', id: 9, lat: 48.86, lon: 2.35, tags: { historic: 'monument', name: 'Paris Anıtı' } }] });
      }
      return jsonResponse(null, 404);
    });

    const pois = await fetchPOIs({ lat: 48.85, lng: 2.35, radius: 5, category: 'all' });
    expect(pois.map((p) => p.name)).toEqual(['Paris Anıtı']);
    expect(requested().slice(1)).toEqual([OVERPASS_ENDPOINTS[0], OVERPASS_ENDPOINTS[1]]);
  });

  it('hicbir ayna cevap vermezse hata firlatir (bos liste donmez)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockImplementation(async (url) => (url === '/data/poi/index.json' ? jsonResponse(INDEX) : jsonResponse(null, 504)));
    await expect(fetchPOIs({ lat: 48.85, lng: 2.35, radius: 5 })).rejects.toThrow('HTTP Error 504');
  });
});
