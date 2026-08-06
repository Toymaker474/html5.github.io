// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const playwrightPath = process.env.PLAYWRIGHT_MODULE || '/tmp/nexus-tool-browser/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightPath).href);
await mkdir('artifacts', { recursive: true });

const errors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  reducedMotion: 'reduce',
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

try {
  await page.goto('http://127.0.0.1:4175/', { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForSelector('.tool-card', { timeout: 30_000 });

  const initial = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    toolCards: document.querySelectorAll('.tool-card').length,
    certified: document.querySelector('#stat-certified')?.textContent,
    offlineText: document.querySelector('#offline-state')?.textContent,
    minimumButtonHeight: Math.min(...[...document.querySelectorAll('button, a.button')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map(element => element.getBoundingClientRect().height)),
  }));

  assert.equal(initial.width, 430);
  assert.ok(initial.toolCards >= 8, 'Expected at least eight marketplace tools.');
  assert.ok(Number(initial.certified) >= 6, 'Expected several certified tools.');
  assert.ok(initial.documentWidth <= initial.width + 2, 'Page must not overflow horizontally.');
  assert.ok(initial.minimumButtonHeight >= 40, 'Touch controls must be at least 40px high.');

  await page.click('#breed');
  await page.waitForSelector('.bundle-card');
  const bundleCount = await page.locator('.bundle-card').count();
  assert.ok(bundleCount >= 4, 'Genetic lab should produce ranked tool stacks.');

  await page.locator('.tool-card [data-action="details"]').first().click();
  await page.waitForSelector('#tool-dialog[open]');
  assert.ok(await page.locator('#copy-dialog-contract').isVisible());
  await page.click('#dialog-close');

  await page.screenshot({ path: 'artifacts/iphone-tool-exchange.png', fullPage: true });
  const report = {
    schema: 'nexus.tool-exchange.mobile-smoke.v1',
    passed: errors.length === 0,
    errors,
    initial,
    bundleCount,
  };
  await writeFile('artifacts/mobile-smoke.json', `${JSON.stringify(report, null, 2)}\n`);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
