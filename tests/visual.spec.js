import { test, expect } from '@playwright/test';
import { mockExternalServices } from './helpers/mockNetwork.js';

// Visual regression only runs on one canonical browser/viewport (Desktop Chrome) — running
// it across every engine multiplies baseline maintenance for little extra signal, and
// screenshots are inherently platform-specific (font rendering differs by OS), so
// Playwright already keys baseline filenames by platform automatically.
//
// NOTE: baselines committed from this repo were generated on Windows. CI (Linux) runners
// render fonts differently, so a Linux baseline needs to be seeded once by running this
// spec with `--update-snapshots` in the CI environment and committing the result — see
// the "update-visual-baselines" workflow.
test.describe('Visual regression', () => {
  // Run serially, one worker — standard practice for visual suites to reduce env-timing noise.
  test.describe.configure({ mode: 'serial' });

  // The service worker's fetch handler bypasses (lets page.route() handle directly) only
  // overpass-api.de/nominatim/wikipedia.org — for other cross-origin calls (Open-Meteo,
  // Open-Elevation) it re-issues its own fetch() from inside the SW thread, which
  // page.route() intercepts unreliably. That let real weather/elevation data through
  // intermittently, changing the modal's layout (an extra spec row) between runs. Visual
  // tests don't need the SW at all (that's covered by pwa-installability.spec.js), so just
  // block it — every enrichment call then goes through the page directly, where our mock
  // reliably catches it.
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome (PC)', 'Visual baselines are only maintained for one canonical browser.');

    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 });
    await mockExternalServices(page);

    // The Google Fonts webfont ("Plus Jakarta Sans") loads asynchronously off a live CDN;
    // whether it swaps in before or after the screenshot is a real race even with a
    // document.fonts.ready wait (the browser doesn't always start the fetch immediately).
    // Blocking it forces the same fallback font on every run, every time.
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  });

  test('app shell (dark mode, default)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('app-shell-dark.png', {
      animations: 'disabled',
      mask: [page.locator('#map')], // live map tiles/markers aren't pixel-stable enough to diff
    });
  });

  test('app shell (light mode)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    await page.click('#themeToggleBtn');
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot('app-shell-light.png', {
      animations: 'disabled',
      mask: [page.locator('#map')],
    });
  });

  test('POI detail modal', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    await page.locator('.poi-card [data-action="detail"]').first().click();
    await expect(page.locator('#poi-detail-modal')).toBeVisible();
    await expect(page.locator('#modal-title')).not.toHaveText('Title');
    // The title renders synchronously, but the description/specs are filled in only after
    // the (mocked) enrichment fetch settles — wait for that loading state to clear too, or
    // the screenshot races between the spinner and the final layout.
    await expect(page.locator('#modal-description')).not.toContainText('çekiliyor', { timeout: 10000 });
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator('#modal-container')).toHaveScreenshot('poi-detail-modal.png', {
      animations: 'disabled',
      // Remote hero photo, plus the UNESCO/verified/weather badges — kept masked as
      // defense-in-depth even with the SW blocked, since all three still depend on live
      // third-party data (Wikidata/Wikipedia/UNESCO match/Open-Meteo).
      mask: [
        page.locator('#modal-image'),
        page.locator('#modal-weather-badge'),
        page.locator('#modal-unesco-badge'),
        page.locator('#modal-verified-badge'),
      ],
    });
  });
});
