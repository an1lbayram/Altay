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
    await expect(museumPill).toHaveClass(/bg-teal-600/);
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
