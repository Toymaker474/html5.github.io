import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const playwrightModule = process.env.PLAYWRIGHT_MODULE ||
  '/tmp/nexus-browser-agent/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(playwrightModule).href);

const outputDir = 'artifacts/mobile';
await mkdir(outputDir, { recursive: true });

const diagnostics = [];
const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
  ],
});

const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  reducedMotion: 'reduce',
});
const page = await context.newPage();

page.on('pageerror', error => diagnostics.push({
  level: 'error',
  type: 'pageerror',
  message: error.message,
}));
page.on('console', message => {
  if (message.type() === 'error') {
    diagnostics.push({ level: 'error', type: 'console', message: message.text() });
  }
});
page.on('requestfailed', request => {
  const resourceType = request.resourceType();
  if (['document', 'script', 'stylesheet', 'wasm'].includes(resourceType)) {
    diagnostics.push({
      level: 'error',
      type: 'requestfailed',
      message: `${resourceType}: ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`,
    });
  }
});

let report;
try {
  await page.goto('http://127.0.0.1:4173/?agent=free-web&mobile=iphone', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  await page.waitForFunction(() => {
    const status = document.querySelector('#status')?.textContent || '';
    const runtimeTime = Number(window.__NEXUS_V7__?.runtime?.data?.time || 0);
    return status.includes('BOOT FAILURE') ||
      status.includes('FAIL-CLOSED') ||
      runtimeTime >= 1.25 ||
      document.readyState === 'complete';
  }, null, { timeout: 120_000 });
  await page.waitForTimeout(1_500);

  const garageCheck = await page.evaluate(async () => {
    const toggle = document.querySelector('#preset-toggle');
    const panel = document.querySelector('#preset-panel');
    const backdrop = document.querySelector('#preset-backdrop');
    if (!(toggle instanceof HTMLButtonElement) ||
        !(panel instanceof HTMLElement) ||
        !(backdrop instanceof HTMLButtonElement)) {
      return { available: false, opened: false, closed: false };
    }

    toggle.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const opened = panel.dataset.open === 'true' && backdrop.dataset.open === 'true';
    backdrop.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const closed = panel.dataset.open !== 'true' && backdrop.dataset.open !== 'true';
    return { available: true, opened, closed };
  });

  report = await page.evaluate(({ diagnostics, garageCheck }) => {
    const status = document.querySelector('#status')?.textContent || '';
    const visibleButtons = [...document.querySelectorAll('button')]
      .filter(button => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map(button => {
        const rect = button.getBoundingClientRect();
        return {
          id: button.id || null,
          label: button.getAttribute('aria-label') || button.textContent?.trim().slice(0, 40) || null,
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
        };
      });

    const canvases = [...document.querySelectorAll('canvas')].map(canvas => {
      const rect = canvas.getBoundingClientRect();
      return {
        id: canvas.id || null,
        width: canvas.width,
        height: canvas.height,
        cssWidth: Number(rect.width.toFixed(2)),
        cssHeight: Number(rect.height.toFixed(2)),
      };
    });

    const runtime = window.__NEXUS_V7__;
    return {
      schema: 'nexus.free-web-agent.mobile-audit.v1',
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      documentSize: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      horizontalOverflowPixels: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      status,
      bootFailure: status.includes('BOOT FAILURE') || status.includes('FAIL-CLOSED'),
      runtimePresent: Boolean(runtime),
      runtimeTime: Number(runtime?.runtime?.data?.time || 0),
      generation: Number(runtime?.experiment?.generation || 0),
      archiveCells: Number(runtime?.archive?.cells?.size || 0),
      connectedLegs: Number(runtime?.renderer?.allLegConnectivity?.report?.connectedLegs || 0),
      visibleButtons,
      minimumVisibleButtonHeight: visibleButtons.length
        ? Math.min(...visibleButtons.map(button => button.height))
        : 0,
      canvases,
      garageCheck,
      diagnostics,
    };
  }, { diagnostics, garageCheck });

  await page.screenshot({
    path: `${outputDir}/iphone-430x932.png`,
    fullPage: true,
  });
} finally {
  await browser.close();
}

report.failures = [];
if (report.bootFailure) report.failures.push('The simulation reported a boot or fail-closed error.');
if (!report.runtimePresent) report.failures.push('The authoritative NEXUS runtime was not found.');
if (report.runtimeTime <= 0) report.failures.push('The simulation clock did not advance.');
if (!report.canvases.some(canvas => canvas.width > 0 && canvas.height > 0)) {
  report.failures.push('No working render canvas was found.');
}
if (report.horizontalOverflowPixels > 2) {
  report.failures.push(`The mobile page overflows horizontally by ${report.horizontalOverflowPixels}px.`);
}
if (report.minimumVisibleButtonHeight > 0 && report.minimumVisibleButtonHeight < 42) {
  report.failures.push(`A visible touch control is only ${report.minimumVisibleButtonHeight}px high.`);
}
if (report.garageCheck.available && (!report.garageCheck.opened || !report.garageCheck.closed)) {
  report.failures.push('The Garage panel backdrop did not open and close correctly.');
}
if (report.diagnostics.some(item => item.level === 'error')) {
  report.failures.push('The browser reported a JavaScript or required-network error.');
}

report.passed = report.failures.length === 0;
await writeFile(`${outputDir}/mobile-audit.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (!report.passed) process.exitCode = 1;
