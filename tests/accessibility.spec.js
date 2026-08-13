import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockExternalServices } from './helpers/mockNetwork.js';

// Only "serious"/"critical" impact violations fail the build — these are the ones that
// actually block assistive-tech users (missing labels, bad contrast, keyboard traps).
// "moderate"/"minor" findings are still reported (via the attached JSON) but don't fail CI,
// to avoid the suite being blocked by cosmetic WCAG nitpicks unrelated to real usability.
function seriousViolations(results) {
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

async function attachViolations(testInfo, results) {
  await testInfo.attach('axe-results', {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });
}

test.describe('Accessibility (WCAG 2.1 AA via axe-core)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 });
    await mockExternalServices(page);
    await page.goto('/');
    await expect(page.getByText(/tarihi yer bulundu/)).toBeVisible({ timeout: 10000 });
  });

  test('main app shell has no serious accessibility violations', async ({ page }, testInfo) => {
    const results = await new AxeBuilder({ page }).analyze();
    await attachViolations(testInfo, results);
    expect(seriousViolations(results)).toEqual([]);
  });

  test('search suggestions dropdown has no serious accessibility violations', async ({ page }, testInfo) => {
    await page.fill('#searchInput', 'İstanbul');
    await expect(page.locator('#searchSuggestions .suggestion-item').first()).toBeVisible({ timeout: 5000 });

    const results = await new AxeBuilder({ page }).analyze();
    await attachViolations(testInfo, results);
    expect(seriousViolations(results)).toEqual([]);
  });

  test('map layer switcher menu has no serious accessibility violations', async ({ page }, testInfo) => {
    await page.click('#layerToggleBtn');
    await expect(page.locator('#layerMenu')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    await attachViolations(testInfo, results);
    expect(seriousViolations(results)).toEqual([]);
  });

  test('POI detail modal has no serious accessibility violations', async ({ page }, testInfo) => {
    await page.locator('.poi-card [data-action="detail"]').first().click();
    await expect(page.locator('#poi-detail-modal')).toBeVisible();
    await expect(page.locator('#modal-title')).not.toHaveText('Title');

    const results = await new AxeBuilder({ page }).include('#poi-detail-modal').analyze();
    await attachViolations(testInfo, results);
    expect(seriousViolations(results)).toEqual([]);
  });

  test('mobile drawer sidebar has no serious accessibility violations', async ({ page }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 1280) >= 768, 'Drawer toggle only exists below the md breakpoint.');

    await page.click('#sidebarToggleBtn');
    await expect(page.locator('#sidebar')).not.toHaveClass(/translate-x-full/);

    const results = await new AxeBuilder({ page }).analyze();
    await attachViolations(testInfo, results);
    expect(seriousViolations(results)).toEqual([]);
  });
});
