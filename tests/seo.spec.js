import { test, expect } from '@playwright/test';

// Domain-agnostic on-page SEO checks. Deliberately does NOT assert a canonical link or
// og:url — those need the real production domain, which isn't knowable from the repo, and
// a wrong/guessed one is worse than none.
test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has a descriptive <title>', async ({ page }) => {
    const title = await page.title();
    expect(title.length).toBeGreaterThan(10);
    expect(title.length).toBeLessThan(70);
    expect(title).toContain('Altay');
  });

  test('has a meta description within the recommended length range', async ({ page }) => {
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description).toBeTruthy();
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThan(160);
  });

  test('declares a document language', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
  });

  test('has exactly one <h1>', async ({ page }) => {
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('has a mobile-friendly viewport meta tag', async ({ page }) => {
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);
  });

  test('has complete Open Graph tags for link previews', async ({ page }) => {
    for (const prop of ['og:type', 'og:title', 'og:description', 'og:image']) {
      const content = await page.locator(`meta[property="${prop}"]`).getAttribute('content');
      expect(content, `meta[property="${prop}"] should have content`).toBeTruthy();
    }
  });

  test('has Twitter card tags', async ({ page }) => {
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', /.+/);
    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
    expect(twitterTitle).toBeTruthy();
  });

  test('every <img> has an alt attribute', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 41.0082, longitude: 28.9784 });

    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /^.*$/); // present, empty allowed only for decorative
    }
  });

  test('robots.txt exists and does not block the whole site', async ({ page, baseURL }) => {
    const response = await page.request.get(new URL('/robots.txt', baseURL).toString());
    expect(response.ok()).toBeTruthy();
    const body = await response.text();
    expect(body).not.toMatch(/Disallow:\s*\/\s*$/m);
  });
});
