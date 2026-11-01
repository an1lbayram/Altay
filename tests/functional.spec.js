import { test, expect } from '@playwright/test';
import { mockExternalServices } from './helpers/mockNetwork.js';

// Runs against every configured project (Desktop Chrome, Mobile Chrome, Mobile Safari), so
// the same core user flows are proven to work full-functionally on both PC and mobile.
test.describe('Core app functionality', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 });
    await mockExternalServices(page);
    await page.goto('/');
  });

  test('app shell and Leaflet map render correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Altay/);
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#map')).toHaveClass(/leaflet-container/);
  });

  test('geolocation flow fetches and renders nearby historic POIs', async ({ page }) => {
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.leaflet-marker-icon')).not.toHaveCount(0);
  });

  test('search autocomplete finds and navigates to a location', async ({ page }) => {
    await page.fill('#searchInput', 'İstanbul');
    const suggestion = page.locator('#searchSuggestions .suggestion-item').first();
    await expect(suggestion).toBeVisible({ timeout: 5000 });
    await suggestion.click();
    await expect(page.getByText(/konumuna gidildi/)).toBeVisible();
  });

  test('category filter switches the active pill and reloads POIs', async ({ page }) => {
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    const museumPill = page.locator('[data-category="museum"]');
    await museumPill.click();
    await expect(museumPill).toHaveAttribute('aria-pressed', 'true');
  });

  test('radius slider updates the label and reloads POIs on change', async ({ page }) => {
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
    await page.locator('#radiusSlider').fill('20');
    await expect(page.locator('#radiusValue')).toHaveText('20');
  });

  test('theme toggle switches between light and dark mode and persists it', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
    await page.click('#themeToggleBtn');
    await expect(html).not.toHaveClass(/dark/);
    const stored = await page.evaluate(() => localStorage.getItem('altay_theme_mode'));
    expect(stored).toBe('light');
  });

  test('map layer switcher changes the active tile layer', async ({ page }) => {
    await page.click('#layerToggleBtn');
    await expect(page.locator('#layerMenu')).toBeVisible();
    await page.click('[data-tile="satellite"]');
    await expect(page.getByText(/Harita görünümü: SATELLITE/)).toBeVisible();
  });

  test('mobile drawer sidebar opens and closes', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1280) >= 768, 'Drawer toggle only exists below the md breakpoint.');

    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toHaveClass(/translate-x-full/);
    await page.click('#sidebarToggleBtn');
    await expect(sidebar).not.toHaveClass(/translate-x-full/);
    await page.click('#sidebarToggleBtn');
    await expect(sidebar).toHaveClass(/translate-x-full/);
  });
});

// Inside Turkey the app reads prebuilt OpenStreetMap data from /data/poi instead of the public
// Overpass servers (which rate-limit per IP and are often silent); outside it falls back to Overpass.
const FETHIYE = { latitude: 36.6214, longitude: 29.1164 };
const STATIC_FIXTURE = {
  '/data/poi/index.json': { version: 1, cellSize: 0.5, layers: ['core', 'worship'], cells: { '73_58': [1, 0] } },
  '/data/poi/core/73_58.json': [['n', 1, 36.62, 29.12, { historic: 'tomb', name: 'Amyntas Kaya Mezarları' }]],
};

async function openSidebarOnMobile(page) {
  const toggle = page.locator('#sidebarToggleBtn');
  if (await toggle.isVisible()) await toggle.click();
}

test.describe('POI data sources', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['geolocation']);
  });

  test('a location in Turkey is served from the prebuilt data without calling Overpass', async ({ page, context }) => {
    await context.setGeolocation(FETHIYE);
    await mockExternalServices(page, { staticData: STATIC_FIXTURE });
    const overpassCalls = [];
    page.on('request', (req) => {
      if (/\/api\/interpreter$/.test(req.url())) overpassCalls.push(req.url());
    });

    await page.goto('/');
    await expect(page.getByText('1 adet tarihi yer bulundu.')).toBeVisible({ timeout: 10000 });
    await openSidebarOnMobile(page);
    await expect(page.getByText('Amyntas Kaya Mezarları')).toBeVisible();
    expect(overpassCalls).toEqual([]);
  });

  test('when no source answers the list says so and offers a retry', async ({ page, context }) => {
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 }); // outside the prebuilt data
    await mockExternalServices(page, { staticData: STATIC_FIXTURE });
    await page.route(/\/api\/interpreter$/, (route) => route.fulfill({ status: 504, body: '' }));

    await page.goto('/');
    await openSidebarOnMobile(page);
    await expect(page.getByRole('heading', { name: 'Veriler Yüklenemedi' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Tarihi Yer Bulunamadı')).toHaveCount(0);

    await page.unroute(/\/api\/interpreter$/);
    await page.route(/\/api\/interpreter$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ elements: [{ type: 'node', id: 7, lat: 48.857, lon: 2.352, tags: { historic: 'monument', name: 'Paris Test Anıtı' } }] }),
      })
    );
    await page.getByRole('button', { name: 'Tekrar Dene' }).click();
    await expect(page.getByText('Paris Test Anıtı')).toBeVisible({ timeout: 10000 });
  });
});
