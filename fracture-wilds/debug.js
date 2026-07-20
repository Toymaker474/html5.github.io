(() => {
  'use strict';
  const assets = [
    './index.html',
    './style.css?v=6',
    './debug.js?v=6',
    './game.js?v=6',
    './sim.js?v=6',
    './sw.js?v=6'
  ];
  const state = { build: '6.0.0', errors: [], tests: [] };

  function capture(type, value) {
    state.errors.push({
      time: new Date().toISOString(),
      type,
      message: String(value && value.message ? value.message : value)
    });
    state.errors = state.errors.slice(-10);
    render();
  }

  window.addEventListener('error', event => capture('error', event.error || event.message));
  window.addEventListener('unhandledrejection', event => capture('promise', event.reason));

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #fw-debug-button{position:fixed;right:12px;bottom:12px;z-index:9990;border:1px solid #70ffd566;border-radius:999px;padding:10px 13px;background:#06131dea;color:#cffff1;font:900 11px system-ui;letter-spacing:.08em;box-shadow:0 0 28px #48ffd744}
      #fw-debug-panel{display:none;position:fixed;inset:0;z-index:9999;background:#01060bf2;color:#eafffa;padding:18px;overflow:auto;font:13px system-ui}
      #fw-debug-panel.open{display:grid;place-items:center}
      #fw-debug-card{width:min(640px,100%);background:#07131d;border:1px solid #70ffd544;border-radius:22px;padding:18px;box-shadow:0 24px 90px #000}
      #fw-debug-rows{display:grid;gap:7px}.fw-debug-row{display:grid;grid-template-columns:1fr auto;gap:10px;background:#0d1d28;border-radius:11px;padding:9px}
      .fw-ok{color:#70ffd5}.fw-bad{color:#ff7893}.fw-wait{color:#ffd66e}.fw-debug-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .fw-debug-actions button,#fw-debug-close{min-height:44px;border:0;border-radius:12px;background:#173040;color:#fff;font-weight:800}.fw-debug-actions .accent{background:#70ffd5;color:#03110d}
      #fw-debug-log{white-space:pre-wrap;word-break:break-word;background:#02080d;padding:10px;border-radius:12px;max-height:180px;overflow:auto}
      html[data-safe-graphics="1"] *{filter:none!important;text-shadow:none!important;box-shadow:none!important}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    addStyles();
    const button = document.createElement('button');
    button.id = 'fw-debug-button';
    button.textContent = '⚙ DEBUG';

    const panel = document.createElement('section');
    panel.id = 'fw-debug-panel';
    panel.innerHTML = `
      <article id="fw-debug-card">
        <button id="fw-debug-close">CLOSE</button>
        <h2>Fracture Debug Core</h2>
        <p>Build 6 · direct files · network-first cache</p>
        <div id="fw-debug-rows"></div>
        <div class="fw-debug-actions">
          <button class="accent" id="fw-debug-test">TEST NETWORK</button>
          <button id="fw-debug-copy">COPY REPORT</button>
          <button id="fw-debug-fix">FIX CACHE + RELOAD</button>
          <button id="fw-debug-safe">SAFE GRAPHICS</button>
        </div>
        <pre id="fw-debug-log">No errors captured.</pre>
      </article>`;

    document.body.append(button, panel);
    button.addEventListener('click', () => panel.classList.add('open'));
    panel.querySelector('#fw-debug-close').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelector('#fw-debug-test').addEventListener('click', testNetwork);
    panel.querySelector('#fw-debug-copy').addEventListener('click', copyReport);
    panel.querySelector('#fw-debug-fix').addEventListener('click', fixCache);
    panel.querySelector('#fw-debug-safe').addEventListener('click', toggleSafeGraphics);

    if (localStorage.getItem('fw_safe_graphics') === '1') {
      document.documentElement.dataset.safeGraphics = '1';
    }
    render();
    setTimeout(testNetwork, 500);
  }

  async function testOne(url) {
    const start = performance.now();
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.body && response.body.cancel) response.body.cancel().catch(() => {});
      return { url, ok: response.ok, status: response.status, ms: Math.round(performance.now() - start) };
    } catch (error) {
      return { url, ok: false, status: 0, ms: Math.round(performance.now() - start), error: String(error.message || error) };
    }
  }

  async function testNetwork() {
    state.tests = assets.map(url => ({ url, pending: true }));
    render();
    state.tests = await Promise.all(assets.map(testOne));
    render();
  }

  function render() {
    const rows = document.querySelector('#fw-debug-rows');
    const log = document.querySelector('#fw-debug-log');
    if (!rows || !log) return;
    const networkRow = `<div class="fw-debug-row"><span>Network</span><b class="${navigator.onLine ? 'fw-ok' : 'fw-bad'}">${navigator.onLine ? 'ONLINE' : 'OFFLINE'}</b></div>`;
    const workerActive = Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);
    const workerRow = `<div class="fw-debug-row"><span>Service worker</span><b class="${workerActive ? 'fw-ok' : 'fw-wait'}">${workerActive ? 'ACTIVE' : 'WAITING'}</b></div>`;
    const testRows = state.tests.map(item => {
      const text = item.pending ? 'TESTING' : item.ok ? `${item.status} · ${item.ms}ms` : `FAIL ${item.status}`;
      const klass = item.pending ? 'fw-wait' : item.ok ? 'fw-ok' : 'fw-bad';
      return `<div class="fw-debug-row"><span>${item.url}</span><b class="${klass}">${text}</b></div>`;
    }).join('');
    rows.innerHTML = networkRow + workerRow + testRows;
    log.textContent = state.errors.length ? JSON.stringify(state.errors, null, 2) : 'No errors captured.';
  }

  async function report() {
    const connection = navigator.connection || {};
    return {
      ...state,
      url: location.href,
      online: navigator.onLine,
      userAgent: navigator.userAgent,
      serviceWorker: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      connection: {
        type: connection.effectiveType || null,
        rtt: connection.rtt || null,
        downlink: connection.downlink || null,
        saveData: connection.saveData || false
      },
      cores: navigator.hardwareConcurrency || null,
      safeGraphics: document.documentElement.dataset.safeGraphics === '1'
    };
  }

  async function copyReport() {
    const text = JSON.stringify(await report(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copy debug report', text);
    }
  }

  async function fixCache() {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    const registrations = navigator.serviceWorker && navigator.serviceWorker.getRegistrations
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    await Promise.all(registrations.map(registration => registration.unregister()));
    location.replace(`${location.pathname}?v=6&fresh=${Date.now()}`);
  }

  function toggleSafeGraphics() {
    const enabled = document.documentElement.dataset.safeGraphics !== '1';
    document.documentElement.dataset.safeGraphics = enabled ? '1' : '0';
    localStorage.setItem('fw_safe_graphics', enabled ? '1' : '0');
  }

  window.__FW_DEBUG__ = { state, testNetwork, report, fixCache };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
