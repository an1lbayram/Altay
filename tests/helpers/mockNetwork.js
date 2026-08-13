// 1x1 transparent PNG used to stub map tile responses.
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

/**
 * Stubs every third-party call the app makes (Overpass, Nominatim, map tiles) so tests
 * run deterministically without depending on live, rate-limited public APIs.
 */
export async function mockExternalServices(page, { pois } = {}) {
  await page.route(/nominatim\.openstreetmap\.org\/reverse/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ address: { city: 'İstanbul' } }),
    })
  );

  await page.route(/nominatim\.openstreetmap\.org\/search/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          display_name: 'İstanbul, Türkiye',
          name: 'İstanbul',
          lat: '41.0082',
          lon: '28.9784',
          type: 'city',
          class: 'place',
          address: { city: 'İstanbul' },
        },
      ]),
    })
  );

  // Matches every Overpass mirror app.js tries (overpass-api.de, kumi.systems, mail.ru, nchc.org.tw).
  await page.route(/\/api\/interpreter$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        elements: pois ?? [
          {
            type: 'node',
            id: 123456789,
            lat: 41.0086,
            lon: 28.9802,
            tags: { historic: 'monument', name: 'Test Anıtı' },
          },
        ],
      }),
    })
  );

  await page.route(
    /tile\.openstreetmap\.org|tile\.opentopomap\.org|arcgisonline\.com|basemaps\.cartocdn\.com/,
    (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
  );

  // POI detail modal enrichment sources (Wikidata, Wikipedia, Wikimedia Commons, weather,
  // elevation). Each caller already falls back gracefully on failure (see dataFusion.js),
  // so aborting is enough to keep the modal fast and deterministic in tests.
  await page.route(
    /wikidata\.org|wikipedia\.org|commons\.wikimedia\.org|api\.open-meteo\.com|api\.open-elevation\.com/,
    (route) => route.abort()
  );
}
