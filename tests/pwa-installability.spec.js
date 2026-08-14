import { test, expect } from '@playwright/test';
import { mockExternalServices } from './helpers/mockNetwork.js';

// Verifies the criteria that make Altay installable as an app on both desktop (Chrome's
// "Install App" / beforeinstallprompt) and mobile (Android Chrome install banner, iOS
// Safari "Add to Home Screen"), and that it keeps working once installed and offline.
test.describe('PWA installability', () => {
  test.beforeEach(async ({ page }) => {
    await mockExternalServices(page);
  });

  test('web app manifest is linked and satisfies install criteria', async ({ page, baseURL }) => {
    await page.goto('/');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestResponse = await page.request.get(new URL(manifestHref, baseURL).toString());
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = await manifestResponse.json();

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    expect(manifest.background_color).toMatch(/^#/);
    expect(manifest.theme_color).toMatch(/^#/);
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    // At least one icon must be install-eligible: a scalable SVG/"any" icon, or >=192px raster.
    const hasQualifyingIcon = manifest.icons.some((icon) => {
      if (icon.type === 'image/svg+xml' || icon.sizes === 'any') return true;
      return (icon.sizes || '').split(' ').some((size) => Number(size.split('x')[0]) >= 192);
    });
    expect(hasQualifyingIcon).toBeTruthy();

    // The icon file the manifest points to must actually resolve, not 404.
    const iconResponse = await page.request.get(new URL(manifest.icons[0].src, baseURL).toString());
    expect(iconResponse.ok()).toBeTruthy();
  });

  test('theme-color, apple-touch-icon and viewport meta support home-screen install', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /#\w{3,6}/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
  });

  test('service worker registers and activates on the production build', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Service worker lifecycle is not reliably observable under Playwright WebKit.');

    await page.goto('/');

    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) return null;
      if (worker.state === 'activated') return worker.state;
      // `ready` can resolve a tick before the active worker's own state flips
      // from "activating" to "activated" — wait for the real transition.
      return await new Promise((resolve) => {
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') resolve(worker.state);
        });
      });
    });

    expect(swState).toBe('activated');
  });

  test('app shell keeps working while fully offline once installed/cached', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Service worker lifecycle is not reliably observable under Playwright WebKit.');
    // Firefox's context.setOffline() blocks requests at the network stack before they ever
    // reach the service worker's fetch handler (NS_ERROR_OFFLINE), unlike Chromium where
    // offline emulation still lets an active SW serve from Cache Storage. Documented
    // Playwright/Firefox difference, not an app bug — Chromium (the majority real-world
    // installed-PWA engine, and what iOS Safari's own SW implementation is closer to
    // behaviorally) already covers this.
    test.skip(browserName === 'firefox', 'Firefox blocks requests before the service worker can serve them offline; not testable via context.setOffline().');

    // First visit lets the service worker install and activate.
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    // The SW only starts intercepting requests once it controls the page (via
    // clients.claim() in its activate handler), so the very first load's JS/CSS bundle
    // requests happen before it exists and are never cached. Reload once more while
    // still online — this is the request the SW's network-first handler dynamically
    // caches — mirroring a real second visit to the installed app.
    await page.reload();

    // Now simulate the installed app being reopened with no network connection at all.
    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('#app')).toBeVisible();
    await expect(page).toHaveTitle(/Altay/);
    await expect(page.locator('#map')).toBeVisible();

    await context.setOffline(false);
  });

  test('Chromium beforeinstallprompt flow shows and triggers the custom install button', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'beforeinstallprompt is a Chromium-only PWA install API.');

    await page.goto('/');

    const installBtn = page.locator('#pwaInstallBtn');
    await expect(installBtn).toHaveClass(/hidden/);

    // Simulate the browser signalling the app is install-eligible.
    await page.evaluate(() => {
      const fakeEvent = new Event('beforeinstallprompt', { cancelable: true });
      fakeEvent.prompt = () => {
        window.__promptCalled = true;
      };
      fakeEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(fakeEvent);
    });

    await expect(installBtn).not.toHaveClass(/hidden/);

    await installBtn.click();

    await expect(installBtn).toHaveClass(/hidden/);
    const promptCalled = await page.evaluate(() => window.__promptCalled === true);
    expect(promptCalled).toBeTruthy();
  });
});
