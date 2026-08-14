import { test, expect } from '@playwright/test';

// Contract tests against the REAL, live third-party APIs the app depends on (Overpass,
// Nominatim, Wikipedia) — everywhere else in this suite these are mocked for determinism,
// but that means a silent upstream response-shape change would never be caught. This file
// is the deliberate exception: it verifies our assumptions about their response shape still
// hold. Deliberately NOT part of `npm test` / the main CI job — these are public, shared-use,
// rate-limited services, and hitting them on every push would be both unfriendly and flaky.
// Run manually via `npm run test:api`, e.g. on a periodic schedule or before a release.
const USER_AGENT = 'AltayApp/1.0 (https://an1lbayram-github-io.vercel.app/)';

test.describe('Real API contracts', () => {
  test.beforeEach((_fixtures, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome (PC)', 'One project is enough — these hit real, rate-limited public services.');
  });

  test('Nominatim /search returns the shape nominatim.js expects', async ({ request }) => {
    const res = await request.get('https://nominatim.openstreetmap.org/search', {
      params: { format: 'json', q: 'İstanbul', addressdetails: 1, limit: 5, 'accept-language': 'tr,en' },
      headers: { 'User-Agent': USER_AGENT },
    });
    expect(res.ok(), `Nominatim search HTTP ${res.status()}`).toBeTruthy();

    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);

    const first = data[0];
    expect(typeof first.display_name).toBe('string');
    expect(Number.isFinite(parseFloat(first.lat))).toBeTruthy();
    expect(Number.isFinite(parseFloat(first.lon))).toBeTruthy();
    // nominatim.js reads item.address?.city/town/province/state/county as a fallback chain —
    // at least one of those should exist for a well-known city query.
    const address = first.address || {};
    const hasCityLikeField = ['city', 'town', 'province', 'state', 'county'].some((k) => address[k]);
    expect(hasCityLikeField).toBeTruthy();
  });

  test('Nominatim /reverse returns the shape nominatim.js expects', async ({ request }) => {
    const res = await request.get('https://nominatim.openstreetmap.org/reverse', {
      params: { format: 'json', lat: 41.0082, lon: 28.9784, zoom: 10, 'accept-language': 'tr,en' },
      headers: { 'User-Agent': USER_AGENT },
    });
    expect(res.ok(), `Nominatim reverse HTTP ${res.status()}`).toBeTruthy();

    const data = await res.json();
    expect(data.address).toBeTruthy();
    const hasCityLikeField = ['city', 'town', 'province', 'state', 'county'].some((k) => data.address[k]);
    expect(hasCityLikeField).toBeTruthy();
  });

  test('Overpass /interpreter returns the shape overpass.js expects', async ({ request }) => {
    // Small radius, single well-known historic landmark (Hagia Sophia) — keeps the query
    // (and load on the shared public instance) minimal.
    const query = '[out:json][timeout:25];(nwr["historic"](around:300,41.0086,28.9802););out center;';
    const res = await request.post('https://overpass-api.de/api/interpreter', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': USER_AGENT,
      },
      data: `data=${encodeURIComponent(query)}`,
      timeout: 30000,
    });
    expect(res.ok(), `Overpass HTTP ${res.status()}`).toBeTruthy();

    const data = await res.json();
    expect(Array.isArray(data.elements)).toBeTruthy();
    expect(data.elements.length).toBeGreaterThan(0);

    const el = data.elements[0];
    expect(['node', 'way', 'relation']).toContain(el.type);
    expect(typeof el.id).toBe('number');
    // overpass.js reads el.lat/el.lon directly for nodes, or el.center.lat/lon for way/relation.
    const hasCoords = (typeof el.lat === 'number' && typeof el.lon === 'number') ||
      (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number');
    expect(hasCoords).toBeTruthy();
    expect(el.tags).toBeTruthy();
  });

  test('Wikipedia REST summary endpoint returns the shape wikipedia.js expects', async ({ request }) => {
    const res = await request.get('https://tr.wikipedia.org/api/rest_v1/page/summary/Ayasofya');
    expect(res.ok(), `Wikipedia summary HTTP ${res.status()}`).toBeTruthy();

    const data = await res.json();
    expect(typeof data.title).toBe('string');
    expect(typeof data.extract).toBe('string');
    expect(data.extract.length).toBeGreaterThan(0);
  });
});
