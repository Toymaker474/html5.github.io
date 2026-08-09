import { chromium } from 'playwright';

const url = process.env.GENESIS_URL || 'http://127.0.0.1:4173/genesis-core/web/diagnostics.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1170, height: 760 } });
const errors = [];
page.on('console', msg => {
  const text = `[console:${msg.type()}] ${msg.text()}`;
  console.log(text);
  if (msg.type() === 'error') errors.push(text);
});
page.on('pageerror', err => errors.push(`[pageerror] ${err.stack || err.message}`));
const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
if (!response?.ok()) throw new Error(`HTTP load failed: ${response?.status()}`);
await page.waitForFunction(() => window.GENESIS_DIAGNOSTIC_PASS === true || window.GENESIS_DIAGNOSTIC_PASS === false, null, { timeout: 60000 });
const passed = await page.evaluate(() => window.GENESIS_DIAGNOSTIC_PASS === true);
const log = await page.locator('#log').innerText();
console.log('\n--- GENESIS DIAGNOSTIC LOG ---\n' + log + '\n------------------------------');
await page.screenshot({ path: 'genesis-core-diagnostic.png', fullPage: true });
await browser.close();
if (!passed || errors.length) {
  throw new Error(`Genesis browser smoke test failed.\n${errors.join('\n')}\n${log}`);
}
console.log('[PASS] Genesis browser smoke test passed.');
