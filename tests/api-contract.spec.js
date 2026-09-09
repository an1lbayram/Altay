import { test, expect } from '@playwright/test';

// Contract tests against the REAL, live third-party APIs the app depends on (Overpass,
// Nominatim, Wikipedia) — everywhere else in this suite these are mocked for determinism,
// but that means a silent upstream response-shape change would never be caught. This file
// is the deliberate exception: it verifies our assumptions about their response shape still
// hold. Deliberately NOT part of `npm test` / the main CI job — these are public, shared-use,
// rate-limited services, and hitting them on every push would be both unfriendly and flaky.
// Run manually via `npm run test:api`, e.g. on a periodic schedule or before a release.
const USER_AGENT = 'AltayApp/1.0 (https://an1lbayram-github-io.vercel.app/)';

// Bu dosyanin amaci ucuncu taraf servislerin YANIT SEKLINI dogrulamak, ayakta
// olup olmadiklarini izlemek degil. Overpass gibi paylasimli ornekler duzenli
// olarak 429/5xx donuyor (haftalik zamanlanmis is bu yuzden "Overpass HTTP
// 504" ile dusuyordu). Gecici durum kodlarinda birkac kez tekrar deniyoruz;
// servis hala musait degilse testi basarisiz saymak yerine atliyoruz - boylece
// sadece gercek sozlesme degisiklikleri kirmiziya dusuruyor.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 5000];

async function fetchOrSkip(send, label) {
  let res = await send();
  for (const delay of RETRY_DELAYS_MS) {
    if (!TRANSIENT_STATUSES.has(res.status())) return res;
    await new Promise((resolve) => setTimeout(resolve, delay));
    res = await send();
  }
  test.skip(
    TRANSIENT_STATUSES.has(res.status()),
    `${label} gecici olarak musait degil (HTTP ${res.status()}); sozlesme bu calistirmada dogrulanamadi.`
  );
  return res;
}

test.describe('Real API contracts', () => {
  // Playwright ilk argumanin mutlaka nesne cozumlemesi (destructuring) ile
  // yazilmasini istiyor; `(_fixtures, testInfo)` yazildiginda dosya daha
  // toplanma asamasinda "First argument must use the object destructuring
  // pattern" hatasi verip cikiyordu - bu yuzden zamanlanmis is her hafta
  // tek satirlik "exit code 1" ile dusuyordu.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome (PC)', 'One project is enough — these hit real, rate-limited public services.');
  });

  test('Nominatim /search returns the shape nominatim.js expects', async ({ request }) => {
    const res = await fetchOrSkip(
      () =>
        request.get('https://nominatim.openstreetmap.org/search', {
          params: { format: 'json', q: 'İstanbul', addressdetails: 1, limit: 5, 'accept-language': 'tr,en' },
          headers: { 'User-Agent': USER_AGENT },
        }),
      'Nominatim /search'
    );
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
    const res = await fetchOrSkip(
      () =>
        request.get('https://nominatim.openstreetmap.org/reverse', {
          params: { format: 'json', lat: 41.0082, lon: 28.9784, zoom: 10, 'accept-language': 'tr,en' },
          headers: { 'User-Agent': USER_AGENT },
        }),
      'Nominatim /reverse'
    );
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
    const res = await fetchOrSkip(
      () =>
        request.post('https://overpass-api.de/api/interpreter', {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': USER_AGENT,
          },
          data: `data=${encodeURIComponent(query)}`,
          timeout: 30000,
        }),
      'Overpass /interpreter'
    );
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
    const res = await fetchOrSkip(
      () => request.get('https://tr.wikipedia.org/api/rest_v1/page/summary/Ayasofya'),
      'Wikipedia /page/summary'
    );
    expect(res.ok(), `Wikipedia summary HTTP ${res.status()}`).toBeTruthy();

    const data = await res.json();
    expect(typeof data.title).toBe('string');
    expect(typeof data.extract).toBe('string');
    expect(data.extract.length).toBeGreaterThan(0);
  });
});
