#!/usr/bin/env node
// Performance/accessibility/best-practices/SEO audit against the production build, using
// Lighthouse directly (not Playwright — Lighthouse needs its own CDP-driven Chrome session
// and has no first-class Playwright integration worth the extra dependency).
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { preview } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'lighthouse-report');

// Third-party network calls (basemap tiles, Overpass, Nominatim, Wikipedia/Wikidata,
// weather/elevation, Google Fonts) are blocked below so Lighthouse measures what this
// codebase actually controls — its own JS/CSS/font delivery — instead of a public tile
// server's latency on whatever network happens to run the audit.
const BLOCKED_URL_PATTERNS = [
  '*tile.openstreetmap.org*',
  '*opentopomap.org*',
  '*arcgisonline.com*',
  '*cartocdn.com*',
  '*overpass*',
  '*nominatim.openstreetmap.org*',
  '*wikipedia.org*',
  '*wikidata.org*',
  '*wikimedia.org*',
  '*open-meteo.com*',
  '*open-elevation.com*',
  '*fonts.googleapis.com*',
  '*fonts.gstatic.com*',
];

// `performance` is reported but not gated: even with third-party calls blocked, Lighthouse
// performance scoring is CPU-throttle-based and genuinely noisy across machines/CI runners
// (industry-standard to track/alert on trend rather than hard-fail a single run on it).
// `geolocation-on-start` (this app requests location immediately, by design, to be useful
// as a location-based map) permanently costs a few points on best-practices — the 0.75
// floor accounts for that known, accepted deduction rather than chasing an unreachable 1.0.
const THRESHOLDS = {
  accessibility: 0.9,
  'best-practices': 0.75,
  seo: 0.9,
};
const REPORT_ONLY = ['performance'];

async function runLighthouse(url, chromePort, formFactor) {
  const result = await lighthouse(
    url,
    { port: chromePort, output: 'json', logLevel: 'error', blockedUrlPatterns: BLOCKED_URL_PATTERNS },
    {
      extends: 'lighthouse:default',
      settings: {
        formFactor,
        screenEmulation:
          formFactor === 'desktop'
            ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
            : { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
      },
    }
  );
  return result.lhr;
}

function reportCategories(label, lhr) {
  console.log(`\n--- ${label} ---`);
  const failures = [];
  const allKeys = [...Object.keys(THRESHOLDS), ...REPORT_ONLY];
  for (const key of allKeys) {
    const category = lhr.categories[key];
    const score = category.score;
    const pct = Math.round(score * 100);
    const threshold = THRESHOLDS[key];
    const reportOnly = REPORT_ONLY.includes(key);

    if (reportOnly) {
      console.log(`INFO  ${category.title.padEnd(16)} ${pct}%  (not gated)`);
      continue;
    }

    const min = Math.round(threshold * 100);
    const ok = score >= threshold;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${category.title.padEnd(16)} ${pct}%  (min ${min}%)`);
    if (!ok) failures.push(`${label}: ${category.title} scored ${pct}%, below the ${min}% floor`);
  }
  return failures;
}

async function main() {
  console.log('Building production bundle...');
  const { build } = await import('vite');
  await build({ root: rootDir, configFile: path.join(rootDir, 'vite.config.js'), logLevel: 'warn' });

  const server = await preview({
    root: rootDir,
    configFile: path.join(rootDir, 'vite.config.js'),
    preview: { port: 4957, strictPort: true },
  });
  const url = `http://localhost:4957/`;

  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });

  try {
    await mkdir(outDir, { recursive: true });

    const desktopLhr = await runLighthouse(url, chrome.port, 'desktop');
    await writeFile(path.join(outDir, 'desktop.json'), JSON.stringify(desktopLhr, null, 2));

    const mobileLhr = await runLighthouse(url, chrome.port, 'mobile');
    await writeFile(path.join(outDir, 'mobile.json'), JSON.stringify(mobileLhr, null, 2));

    const failures = [
      ...reportCategories('Desktop (PC)', desktopLhr),
      ...reportCategories('Mobile', mobileLhr),
    ];

    if (failures.length > 0) {
      console.error('\nLighthouse thresholds not met:');
      failures.forEach((f) => console.error(`  - ${f}`));
      process.exitCode = 1;
    } else {
      console.log('\nAll Lighthouse thresholds met.');
    }
  } finally {
    // chrome-launcher's temp-profile cleanup can EPERM on Windows (antivirus/lingering file
    // handle on the temp dir) — that's a cleanup nicety, not a reason to leave the preview
    // server's open HTTP handle dangling and the process hanging forever.
    try {
      await chrome.kill();
    } catch (err) {
      console.warn('Chrome cleanup warning (non-fatal):', err.message);
    }
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
