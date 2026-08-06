import {
  createAgentContract,
  evaluateGates,
  evolveToolBundles,
  scoreTool,
} from './genetic-market.js';

const state = {
  registry: null,
  tools: [],
  filteredTools: [],
  localRatings: loadLocalRatings(),
};

const elements = {
  grid: document.querySelector('#tool-grid'),
  resultCount: document.querySelector('#result-count'),
  search: document.querySelector('#search'),
  platform: document.querySelector('#platform-filter'),
  trust: document.querySelector('#trust-filter'),
  certifiedOnly: document.querySelector('#certified-only'),
  dialog: document.querySelector('#tool-dialog'),
  dialogContent: document.querySelector('#dialog-content'),
  dialogClose: document.querySelector('#dialog-close'),
  toast: document.querySelector('#toast'),
  bundleGrid: document.querySelector('#bundle-grid'),
  bundleSize: document.querySelector('#bundle-size'),
  bundleSizeOutput: document.querySelector('#bundle-size-output'),
  generations: document.querySelector('#generations'),
  generationsOutput: document.querySelector('#generations-output'),
  offlineState: document.querySelector('#offline-state'),
};

let toastTimer = null;

function loadLocalRatings() {
  try {
    return JSON.parse(localStorage.getItem('nexus-tool-ratings-v1') || '{}');
  } catch {
    return {};
  }
}

function saveLocalRatings() {
  localStorage.setItem('nexus-tool-ratings-v1', JSON.stringify(state.localRatings));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.dataset.open = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.dataset.open = 'false';
  }, 2200);
}

function combinedScore(tool) {
  const official = scoreTool(tool);
  const local = state.localRatings[tool.id];
  if (!local) return official;
  return Math.min(100, Math.max(0, official * 0.85 + Number(local) * 0.15));
}

function ratingCredits(tool) {
  const score = combinedScore(tool);
  const evidence = tool.evidence?.length || 0;
  const certified = evaluateGates(tool).passed ? 20 : 0;
  return Math.round(score * 10 + evidence * 8 + certified);
}

function badgeClass(tier) {
  if (tier === 'CERTIFIED') return 'badge--certified';
  if (tier === 'VERIFIED-PENDING') return 'badge--pending';
  return 'badge--quarantine';
}

function renderStats() {
  const certified = state.tools.filter(tool => evaluateGates(tool).passed).length;
  const evidence = state.tools.reduce((sum, tool) => sum + (tool.evidence?.length || 0), 0);
  document.querySelector('#stat-tools').textContent = state.tools.length;
  document.querySelector('#stat-certified').textContent = certified;
  document.querySelector('#stat-evidence').textContent = evidence;
}

function toolCard(tool) {
  const gate = evaluateGates(tool);
  const score = combinedScore(tool);
  const capabilities = (tool.capabilities || []).slice(0, 5);
  const platformText = (tool.platforms || []).slice(0, 3).join(' · ');
  const localRating = state.localRatings[tool.id];

  return `
    <article class="tool-card" data-tool-id="${escapeHtml(tool.id)}">
      <div class="tool-card__top">
        <div>
          <span class="tool-card__category">${escapeHtml(tool.category)}</span>
          <div class="badge-row">
            <span class="badge ${badgeClass(gate.tier)}">${escapeHtml(gate.tier)}</span>
            <span class="badge">FREE</span>
          </div>
        </div>
        <div class="score-ring" style="--score:${score.toFixed(1)}" aria-label="Quality score ${score.toFixed(1)} out of 100">
          <strong>${Math.round(score)}</strong>
        </div>
      </div>
      <h3>${escapeHtml(tool.name)}</h3>
      <p class="tool-card__summary">${escapeHtml(tool.summary)}</p>
      <div class="capability-row">
        ${capabilities.map(capability => `<span class="capability">${escapeHtml(capability)}</span>`).join('')}
      </div>
      <div class="tool-card__facts">
        <div class="tool-card__fact">
          <span>Reputation</span>
          <strong>${ratingCredits(tool)} credits</strong>
        </div>
        <div class="tool-card__fact">
          <span>Your rating</span>
          <strong>${localRating ? `${Math.round(localRating)} / 100` : 'not rated'}</strong>
        </div>
        <div class="tool-card__fact">
          <span>Platforms</span>
          <strong>${escapeHtml(platformText || 'unknown')}</strong>
        </div>
        <div class="tool-card__fact">
          <span>License</span>
          <strong>${escapeHtml(tool.source?.license || 'verify')}</strong>
        </div>
      </div>
      <div class="tool-card__actions">
        <button class="button button--small" type="button" data-action="details">Inspect</button>
        <button class="button button--small" type="button" data-action="contract">Copy contract</button>
      </div>
    </article>
  `;
}

function renderTools() {
  elements.grid.innerHTML = state.filteredTools.map(toolCard).join('');
  elements.resultCount.textContent = `${state.filteredTools.length} of ${state.tools.length} tools shown`;
  if (!state.filteredTools.length) {
    elements.grid.innerHTML = `
      <div class="empty-state">
        <strong>No tool matches those filters.</strong>
        <span>Clear a filter or search a broader capability.</span>
      </div>
    `;
  }
}

function applyFilters() {
  const query = elements.search.value.trim().toLowerCase();
  const platform = elements.platform.value;
  const trust = elements.trust.value;
  const certifiedOnly = elements.certifiedOnly.checked;

  state.filteredTools = state.tools.filter(tool => {
    const gate = evaluateGates(tool);
    const searchable = [
      tool.name,
      tool.summary,
      tool.category,
      ...(tool.capabilities || []),
      ...(tool.platforms || []),
    ].join(' ').toLowerCase();

    if (query && !searchable.includes(query)) return false;
    if (platform !== 'all' && !(tool.platforms || []).includes(platform)) return false;
    if (trust !== 'all' && gate.tier !== trust) return false;
    if (certifiedOnly && !gate.passed) return false;
    return true;
  }).sort((a, b) => combinedScore(b) - combinedScore(a));

  renderTools();
}

function metricBars(tool) {
  return Object.entries(tool.metrics || {})
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `
      <div class="dialog-box">
        <span>${escapeHtml(name.replace(/([A-Z])/g, ' $1'))}</span>
        <strong>${Math.round(value)} / 100</strong>
      </div>
    `).join('');
}

function openToolDialog(tool) {
  const gate = evaluateGates(tool);
  const score = combinedScore(tool);
  const failures = gate.failed.length
    ? gate.failed.map(item => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>All required gates passed.</li>';

  elements.dialogContent.innerHTML = `
    <p class="kicker">${escapeHtml(tool.category)} · ${escapeHtml(tool.version)}</p>
    <h2>${escapeHtml(tool.name)}</h2>
    <p>${escapeHtml(tool.summary)}</p>
    <div class="badge-row">
      <span class="badge ${badgeClass(gate.tier)}">${escapeHtml(gate.tier)}</span>
      <span class="badge">${score.toFixed(1)} QUALITY</span>
      <span class="badge">${ratingCredits(tool)} CREDITS</span>
    </div>

    <section class="dialog-section">
      <h3>Measured traits</h3>
      <div class="dialog-grid">${metricBars(tool)}</div>
    </section>

    <section class="dialog-section">
      <h3>Agent contract</h3>
      <div class="dialog-grid">
        <div class="dialog-box"><span>Command</span><strong>${escapeHtml(tool.command)}</strong></div>
        <div class="dialog-box"><span>License</span><strong>${escapeHtml(tool.source?.license)}</strong></div>
        <div class="dialog-box"><span>Inputs</span><strong>${escapeHtml((tool.inputs || []).join(', '))}</strong></div>
        <div class="dialog-box"><span>Outputs</span><strong>${escapeHtml((tool.outputs || []).join(', '))}</strong></div>
      </div>
    </section>

    <section class="dialog-section">
      <h3>Evidence and limits</h3>
      <div class="dialog-grid">
        <div class="dialog-box">
          <span>Evidence</span>
          <strong>${escapeHtml((tool.evidence || []).join(' · '))}</strong>
        </div>
        <div class="dialog-box">
          <span>Known limits</span>
          <strong>${escapeHtml((tool.limits || []).join(' · '))}</strong>
        </div>
      </div>
    </section>

    <section class="dialog-section">
      <h3>Promotion gate</h3>
      <ul>${failures}</ul>
    </section>

    <section class="dialog-section">
      <h3>Rate usefulness on this device</h3>
      <div class="lab-controls">
        <label>
          <span>Rating</span>
          <input id="dialog-rating" type="range" min="0" max="100" step="5" value="${state.localRatings[tool.id] ?? 75}">
          <output id="dialog-rating-output">${state.localRatings[tool.id] ?? 75}</output>
        </label>
        <button class="button" id="save-rating" type="button">Save rating</button>
        <button class="button button--primary" id="copy-dialog-contract" type="button">Copy agent contract</button>
      </div>
    </section>
  `;

  const rating = elements.dialogContent.querySelector('#dialog-rating');
  const output = elements.dialogContent.querySelector('#dialog-rating-output');
  rating.addEventListener('input', () => { output.value = rating.value; });
  elements.dialogContent.querySelector('#save-rating').addEventListener('click', () => {
    state.localRatings[tool.id] = Number(rating.value);
    saveLocalRatings();
    applyFilters();
    showToast(`Saved ${tool.name} rating.`);
  });
  elements.dialogContent.querySelector('#copy-dialog-contract').addEventListener('click', () => {
    copyContract(tool);
  });

  elements.dialog.showModal();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function copyContract(tool) {
  const contract = createAgentContract(tool);
  await copyText(JSON.stringify(contract, null, 2));
  showToast(`Copied ${tool.name} agent contract.`);
}

function downloadJson(filename, value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderBundles(bundles) {
  const byId = new Map(state.tools.map(tool => [tool.id, tool]));
  elements.bundleGrid.innerHTML = bundles.map((bundle, index) => `
    <article class="bundle-card">
      <div class="bundle-card__header">
        <div>
          <p class="kicker">Generation winner ${index + 1}</p>
          <h3>${escapeHtml(bundle.id)}</h3>
        </div>
        <span class="bundle-card__score">${bundle.fitness}</span>
      </div>
      <ul>
        ${bundle.toolIds.map(id => `<li>${escapeHtml(byId.get(id)?.name || id)}</li>`).join('')}
      </ul>
      <p>${bundle.capabilities.length} combined capabilities · ${escapeHtml(bundle.platforms.join(' · '))}</p>
      <div class="tool-card__actions" style="margin-top:14px">
        <button class="button button--small" type="button" data-bundle-contract="${escapeHtml(bundle.id)}">Copy stack contract</button>
        <button class="button button--small" type="button" data-bundle-export="${escapeHtml(bundle.id)}">Export JSON</button>
      </div>
    </article>
  `).join('');

  elements.bundleGrid.querySelectorAll('[data-bundle-contract]').forEach(button => {
    button.addEventListener('click', async () => {
      const bundle = bundles.find(item => item.id === button.dataset.bundleContract);
      const contract = {
        schema: 'nexus.agent-tool-bundle.v1',
        ...bundle,
        tools: bundle.toolIds.map(id => createAgentContract(byId.get(id))),
      };
      await copyText(JSON.stringify(contract, null, 2));
      showToast('Copied evolved stack contract.');
    });
  });

  elements.bundleGrid.querySelectorAll('[data-bundle-export]').forEach(button => {
    button.addEventListener('click', () => {
      const bundle = bundles.find(item => item.id === button.dataset.bundleExport);
      downloadJson(`${bundle.id}.json`, {
        schema: 'nexus.agent-tool-bundle.v1',
        ...bundle,
        tools: bundle.toolIds.map(id => createAgentContract(byId.get(id))),
      });
    });
  });
}

function runEvolution() {
  const bundles = evolveToolBundles(state.tools, {
    seed: 474,
    generations: Number(elements.generations.value),
    bundleSize: Number(elements.bundleSize.value),
    populationSize: 42,
    mutationRate: 0.2,
    results: 6,
  });
  renderBundles(bundles);
  document.querySelector('#genetic-lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showToast(`Evolved ${bundles.length} tool stacks.`);
}

function installEvents() {
  for (const input of [elements.search, elements.platform, elements.trust, elements.certifiedOnly]) {
    input.addEventListener('input', applyFilters);
    input.addEventListener('change', applyFilters);
  }

  elements.grid.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('[data-tool-id]');
    if (!button || !card) return;
    const tool = state.tools.find(item => item.id === card.dataset.toolId);
    if (!tool) return;
    if (button.dataset.action === 'details') openToolDialog(tool);
    if (button.dataset.action === 'contract') copyContract(tool);
  });

  elements.dialogClose.addEventListener('click', () => elements.dialog.close());
  elements.dialog.addEventListener('click', event => {
    if (event.target === elements.dialog) elements.dialog.close();
  });

  elements.bundleSize.addEventListener('input', () => {
    elements.bundleSizeOutput.value = elements.bundleSize.value;
  });
  elements.generations.addEventListener('input', () => {
    elements.generationsOutput.value = elements.generations.value;
  });

  document.querySelector('#breed').addEventListener('click', runEvolution);
  document.querySelector('#breed-top').addEventListener('click', runEvolution);
  document.querySelector('#export-registry').addEventListener('click', () => {
    downloadJson('nexus-agent-tool-registry.json', {
      ...state.registry,
      tools: state.tools.map(createAgentContract),
      exportedAt: new Date().toISOString(),
    });
  });
}

async function registerOfflineSupport() {
  if (!('serviceWorker' in navigator)) {
    elements.offlineState.textContent = 'Offline cache unavailable in this browser.';
    return;
  }
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    elements.offlineState.textContent = 'Offline shell ready.';
  } catch (error) {
    elements.offlineState.textContent = `Offline setup failed: ${error.message}`;
  }
}

async function main() {
  try {
    const response = await fetch('./registry/tools.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}`);
    state.registry = await response.json();
    state.tools = state.registry.tools || [];
    state.filteredTools = [...state.tools];
    renderStats();
    installEvents();
    applyFilters();
    await registerOfflineSupport();
  } catch (error) {
    elements.grid.innerHTML = `
      <div class="empty-state">
        <strong>The tool registry could not load.</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
    elements.resultCount.textContent = 'Registry unavailable';
  }
}

main();
