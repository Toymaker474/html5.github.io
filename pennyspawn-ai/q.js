'use strict';

const $ = id => document.getElementById(id);
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BALANCE_OF = '70a08231';
const DEFAULT_RPC = 'https://mainnet.base.org';
const KEYS = {
  accounts: 'pennyspawn_accounts_v7',
  session: 'pennyspawn_session_v7',
  settings: 'pennyspawn_settings_v7:',
  agent: 'pennyspawn_agent_v7:',
  public: 'pennyspawn_public_v7',
  consent: 'pennyspawn_ads_consent_v7',
  energy: 'pennyspawn_agent_energy_v7',
  invoice: 'pennyspawn_invoice_v7:'
};
const BLOCKED = /(phish|credential theft|malware|ransomware|keylogger|fake review|impersonat(?:e|ion)|counterfeit|stolen goods|money mule|bypass kyc|seed phrase|private key|guaranteed profit|spam campaign|unauthorized access|harassment)/i;
const MON = window.PENNYSPAWN_MONETIZATION || {};
const IS_GITHUB = /(^|\.)github\.io$/i.test(location.hostname);
const COMMERCIAL = !IS_GITHUB && location.protocol === 'https:';

let authMode = 'login';
let currentUser = '';
let spectator = false;
let activeScreen = 'homeScreen';
let hiddenBalance = false;
let installPrompt = null;
let walletTimer = null;
let cycleTimer = null;
let adsLoaded = false;
let settings = defaults();
let agent = defaultAgent();
let currentOffer = null;
let currentInvoice = null;
let lastFrame = performance.now();
let fps = 0;
let fx = { beam: 0, particles: [], pulse: 0 };
const market = { btc: 0, healthy: false };
const wallet = { usdc: 0, btc: 0, usdcSeen: false, btcSeen: false, baseHealthy: false, btcHealthy: false, baseBlock: 0, sessionUsd: 0, cycleUsd: 0, receipts: 0, lastReceipt: 0 };

function defaults() {
  return { baseWallet: '', btcWallet: '', cycleMinutes: 10, skills: '', rpc: DEFAULT_RPC, price: 5 };
}
function defaultAgent() {
  return {
    id: 'penny-agent-01', generation: 1, fitness: 0.25, status: 'waiting',
    strategy: 'Awaiting setup', why: 'The instant JavaScript agent needs no model download.',
    nextAction: 'Add skills in Settings, then create and share an offer.',
    cycleStart: 0, cycleEnd: 0, retired: [], offspring: [],
    events: [{ t: Date.now(), m: 'PennySpawn v7 started. Revenue simulation is disabled.' }]
  };
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(window.__psToast);
  window.__psToast = setTimeout(() => $('toast').classList.remove('show'), 1800);
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}
function money(value, digits = 2) {
  return '$' + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function short(value) {
  const s = String(value || '');
  return s.length > 15 ? `${s.slice(0, 7)}…${s.slice(-5)}` : s || 'Not configured';
}
function clock(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function validBase(value) { return /^0x[a-fA-F0-9]{40}$/.test(String(value || '').trim()); }
function validBtc(value) { return /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(String(value || '').trim()); }
function accountList() { try { return JSON.parse(localStorage.getItem(KEYS.accounts) || '{}'); } catch { return {}; } }
function bytesHex(bytes) { return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function randomHex(length = 16) { const b = new Uint8Array(length); crypto.getRandomValues(b); return bytesHex(b); }
async function passwordHash(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(x => parseInt(x, 16)));
  return bytesHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, key, 256));
}
async function registerAccount(username, password, confirm) {
  username = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) throw new Error('Use 3–24 letters, numbers, _ or -.');
  if (password.length < 8) throw new Error('Password needs at least 8 characters.');
  if (password !== confirm) throw new Error('Passwords do not match.');
  const list = accountList();
  if (list[username]) throw new Error('That local profile already exists.');
  const salt = randomHex();
  list[username] = { salt, hash: await passwordHash(password, salt), createdAt: Date.now() };
  localStorage.setItem(KEYS.accounts, JSON.stringify(list));
  return username;
}
async function loginAccount(username, password) {
  username = username.trim().toLowerCase();
  const account = accountList()[username];
  if (!account) throw new Error('Profile not found. Tap Create profile first.');
  if (await passwordHash(password, account.salt) !== account.hash) throw new Error('Password not accepted. Check capitalization.');
  return username;
}
function settingsKey() { return currentUser ? KEYS.settings + currentUser : KEYS.public; }
function agentKey() { return KEYS.agent + currentUser; }
function loadState() {
  try { settings = { ...defaults(), ...JSON.parse(localStorage.getItem(settingsKey()) || '{}') }; } catch { settings = defaults(); }
  if (currentUser) {
    try { agent = { ...defaultAgent(), ...JSON.parse(localStorage.getItem(agentKey()) || '{}') }; } catch { agent = defaultAgent(); }
  } else agent = defaultAgent();
  agent.retired = Array.isArray(agent.retired) ? agent.retired : [];
  agent.offspring = Array.isArray(agent.offspring) ? agent.offspring : [];
  agent.events = Array.isArray(agent.events) ? agent.events : [];
  try { currentInvoice = JSON.parse(localStorage.getItem(KEYS.invoice + currentUser) || 'null'); } catch { currentInvoice = null; }
}
function saveAgent() { if (currentUser) localStorage.setItem(agentKey(), JSON.stringify(agent)); }
function log(message) {
  agent.events.unshift({ t: Date.now(), m: String(message) });
  agent.events = agent.events.slice(0, 80);
  saveAgent();
  render();
}
function switchAuth(mode) {
  authMode = mode;
  const login = mode === 'login';
  $('loginTab').classList.toggle('active', login);
  $('registerTab').classList.toggle('active', !login);
  $('loginTab').setAttribute('aria-selected', String(login));
  $('registerTab').setAttribute('aria-selected', String(!login));
  $('confirmRow').classList.toggle('hidden', login);
  $('authConfirm').required = !login;
  $('authPass').autocomplete = login ? 'current-password' : 'new-password';
  $('authSubmit').querySelector('span').textContent = login ? 'Enter Revenue Lab' : 'Create local profile';
  $('authError').textContent = '';
}
async function handleAuth(event) {
  event.preventDefault();
  $('authSubmit').disabled = true;
  $('authError').textContent = '';
  try {
    currentUser = authMode === 'login'
      ? await loginAccount($('authUser').value, $('authPass').value)
      : await registerAccount($('authUser').value, $('authPass').value, $('authConfirm').value);
    spectator = false;
    sessionStorage.setItem(KEYS.session, currentUser);
    openApp();
    toast(authMode === 'register' ? 'Profile created' : 'Welcome back');
  } catch (error) {
    $('authError').textContent = error.message || String(error);
  } finally { $('authSubmit').disabled = false; }
}
function resetProfiles() {
  if (!confirm('Remove all PennySpawn local profiles, settings, invoices, and agent history from this browser?')) return;
  Object.keys(localStorage).filter(k => k.startsWith('pennyspawn_')).forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem(KEYS.session);
  $('authUser').value = '';
  $('authPass').value = '';
  $('authConfirm').value = '';
  toast('Local profiles reset');
}
function openGuest() { spectator = true; currentUser = ''; sessionStorage.setItem(KEYS.session, 'spectator'); openApp(); }
function openApp() {
  loadState();
  $('authGate').classList.add('hidden');
  $('appShell').setAttribute('aria-hidden', 'false');
  $('bottomDock').classList.remove('hidden');
  document.body.classList.remove('locked');
  $('settingsBtn').style.display = spectator ? 'none' : '';
  $('headerSub').textContent = spectator ? 'READ ONLY · PREVIEW' : `${currentUser.toUpperCase()} · LOCAL OWNER`;
  populateSettings();
  showScreen('homeScreen');
  startWallets();
  startMarket();
  resizeArena();
  if (!spectator) startAgent();
  render();
}
function logout() {
  stopAgent(); stopWallets();
  currentUser = ''; spectator = false;
  sessionStorage.removeItem(KEYS.session);
  $('appShell').setAttribute('aria-hidden', 'true');
  $('bottomDock').classList.add('hidden');
  $('authGate').classList.remove('hidden');
  document.body.classList.add('locked');
  closeSettings();
}
function showScreen(id) {
  activeScreen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  document.querySelectorAll('.dock button').forEach(b => b.classList.toggle('active', b.dataset.target === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(resizeArena, 50);
}
function populateSettings() {
  $('walletAddress').value = settings.baseWallet || '';
  $('btcAddress').value = settings.btcWallet || '';
  $('cycleMinutes').value = settings.cycleMinutes;
  $('cycleMinutesLabel').textContent = `${settings.cycleMinutes} MIN`;
  $('skillsInput').value = settings.skills || '';
  $('rpcUrl').value = settings.rpc || DEFAULT_RPC;
  $('priceChoice').value = String(settings.price || 5);
}
function openSettings() {
  if (spectator) return toast('Create a local profile to change settings');
  populateSettings();
  $('settingsSheet').classList.add('open');
  $('settingsSheet').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeSettings() {
  $('settingsSheet').classList.remove('open');
  $('settingsSheet').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
function saveSettings() {
  if (!currentUser || spectator) return;
  const baseWallet = $('walletAddress').value.trim();
  const btcWallet = $('btcAddress').value.trim();
  const rpc = $('rpcUrl').value.trim();
  if (baseWallet && !validBase(baseWallet)) throw new Error('Base address must be a valid public 0x address.');
  if (btcWallet && !validBtc(btcWallet)) throw new Error('Bitcoin address format is not recognized.');
  if (!/^https:\/\//i.test(rpc)) throw new Error('Base RPC must use HTTPS.');
  settings = {
    baseWallet, btcWallet, rpc,
    cycleMinutes: Math.max(2, Math.min(60, Number($('cycleMinutes').value) || 10)),
    skills: $('skillsInput').value.trim().slice(0, 600),
    price: Math.max(1, Number($('priceChoice').value) || 5)
  };
  localStorage.setItem(KEYS.settings + currentUser, JSON.stringify(settings));
  localStorage.setItem(KEYS.public, JSON.stringify({ baseWallet, btcWallet, rpc, cycleMinutes: settings.cycleMinutes }));
  closeSettings();
  stopWallets(); startWallets();
  beginCycle(); generateOffer();
  toast('Saved. Agent started');
}

async function baseRpc(method, params) {
  const response = await fetch(settings.rpc || DEFAULT_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), cache: 'no-store' });
  if (!response.ok) throw new Error(`Base RPC ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'Base RPC error');
  return body.result;
}
async function pollBase() {
  if (!validBase(settings.baseWallet)) { wallet.baseHealthy = false; return; }
  const padded = settings.baseWallet.slice(2).toLowerCase().padStart(64, '0');
  const [balanceHex, blockHex] = await Promise.all([
    baseRpc('eth_call', [{ to: USDC_CONTRACT, data: `0x${BALANCE_OF}${padded}` }, 'latest']),
    baseRpc('eth_blockNumber', [])
  ]);
  applyBalance('USDC', Number(BigInt(balanceHex || '0x0')) / 1e6);
  wallet.baseBlock = parseInt(blockHex || '0x0', 16);
  wallet.baseHealthy = true;
}
async function pollBtc() {
  if (!validBtc(settings.btcWallet)) { wallet.btcHealthy = false; return; }
  const response = await fetch(`https://mempool.space/api/address/${encodeURIComponent(settings.btcWallet)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Bitcoin API ${response.status}`);
  const data = await response.json();
  const sats = Number(data?.chain_stats?.funded_txo_sum || 0) - Number(data?.chain_stats?.spent_txo_sum || 0);
  applyBalance('BTC', sats / 1e8);
  wallet.btcHealthy = true;
}
function applyBalance(asset, value) {
  const key = asset === 'USDC' ? 'usdc' : 'btc';
  const seen = asset === 'USDC' ? 'usdcSeen' : 'btcSeen';
  const previous = wallet[key];
  if (!wallet[seen]) {
    wallet[seen] = true; wallet[key] = value;
    log(`${asset} watch connected.`);
  } else {
    wallet[key] = value;
    const delta = value - previous;
    if (delta > (asset === 'USDC' ? 1e-7 : 1e-9)) {
      const usd = asset === 'USDC' ? delta : delta * (market.btc || 0);
      wallet.sessionUsd += usd; wallet.cycleUsd += usd; wallet.receipts++; wallet.lastReceipt = Date.now();
      fx.pulse = 1; burst('receipt');
      log(`Verified incoming ${asset}: ${asset === 'USDC' ? money(delta, 6) : delta.toFixed(8) + ' BTC'}.`);
    }
  }
}
async function pollWallets() {
  await Promise.all([pollBase().catch(() => wallet.baseHealthy = false), pollBtc().catch(() => wallet.btcHealthy = false)]);
  render();
}
function startWallets() { stopWallets(); pollWallets(); walletTimer = setInterval(pollWallets, 10000); }
function stopWallets() { clearInterval(walletTimer); walletTimer = null; }
async function startMarket() {
  try {
    const response = await fetch('https://mempool.space/api/v1/prices', { cache: 'no-store' });
    const body = await response.json();
    market.btc = Number(body?.USD || 0); market.healthy = market.btc > 0;
  } catch { market.healthy = false; }
  render();
}
function portfolio() { return wallet.usdc + wallet.btc * (market.btc || 0); }

const OFFER_LIBRARY = [
  { key: 'json', title: 'JSON Repair Sprint', desc: 'Repair one broken JSON payload and return valid formatted JSON with a short explanation.', deliver: ['One repaired JSON file', 'Validation notes', 'One revision'] },
  { key: 'prompt', title: 'Prompt Compression Pack', desc: 'Turn a long user-provided prompt into a compact structured version without changing its real requirements.', deliver: ['One compressed prompt', 'Requirement checklist', 'One revision'] },
  { key: 'listing', title: 'Honest Listing Cleanup', desc: 'Improve clarity, spelling, and structure without inventing claims, ratings, scarcity, or certifications.', deliver: ['Clean title', 'Short description', 'Five factual bullets'] },
  { key: 'names', title: 'Original Name Forge', desc: 'Generate original project or game names based on a user-provided concept, avoiding famous brands and franchises.', deliver: ['20 original names', 'Top five shortlist', 'Tagline ideas'] },
  { key: 'summary', title: 'Fast Notes Summary', desc: 'Turn user-provided notes into a clear summary and action checklist.', deliver: ['Accurate summary', 'Action list', 'Open questions'] },
  { key: 'html', title: 'HTML5 Prototype Plan', desc: 'Create a concise implementation plan for a small browser prototype based on the client’s requirements.', deliver: ['Feature scope', 'UI flow', 'Technical checklist'] }
];
function selectOffer() {
  const skill = settings.skills.toLowerCase();
  const scored = OFFER_LIBRARY.map((offer, index) => ({ offer, score: (skill.includes(offer.key) ? 5 : 0) + ((agent.generation + index) % OFFER_LIBRARY.length === 0 ? 2 : 0) }));
  return scored.sort((a, b) => b.score - a.score)[0].offer;
}
function generateOffer() {
  if (spectator) return toast('Create a local profile to generate offers');
  const offer = selectOffer();
  currentOffer = { ...offer, price: settings.price || 5, id: `OFFER-${Date.now().toString(36).toUpperCase()}` };
  agent.strategy = offer.title;
  agent.why = 'A small, testable service is easier to explain and deliver honestly.';
  agent.nextAction = 'Review the service card, then share it manually on a platform that permits the offer.';
  agent.status = 'ready to share';
  incrementEnergy(-1);
  log(`Generated offer: ${offer.title}.`);
  saveAgent(); render();
}
function offerText() {
  if (!currentOffer) return 'No offer generated.';
  return `${currentOffer.title} — $${currentOffer.price}\n\n${currentOffer.desc}\n\nIncludes:\n${currentOffer.deliver.map(x => `• ${x}`).join('\n')}\n\nHuman-reviewed. No guaranteed results.`;
}
async function shareText(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url: location.href }); return; } catch (error) { if (error?.name === 'AbortError') return; }
  }
  await navigator.clipboard?.writeText(text); toast('Copied for sharing');
}
function incrementEnergy(delta) {
  const current = Math.max(0, Number(localStorage.getItem(KEYS.energy) || 3));
  localStorage.setItem(KEYS.energy, String(Math.max(0, current + delta)));
}
function startAgent() {
  if (spectator) return;
  if (!agent.cycleEnd || agent.cycleEnd <= Date.now()) beginCycle();
  clearInterval(cycleTimer); cycleTimer = setInterval(tickCycle, 500);
  agent.status = currentOffer ? 'ready to share' : 'planning';
  if (!currentOffer) generateOffer();
}
function stopAgent() { clearInterval(cycleTimer); cycleTimer = null; }
function beginCycle() {
  agent.cycleStart = Date.now(); agent.cycleEnd = Date.now() + settings.cycleMinutes * 60000; wallet.cycleUsd = 0;
  log(`Generation ${agent.generation} started a ${settings.cycleMinutes}-minute cycle.`); saveAgent();
}
function tickCycle() { if (agent.cycleEnd && Date.now() >= agent.cycleEnd) evaluateCycle(); render(); }
function evaluateCycle() {
  const old = { id: agent.id, generation: agent.generation, strategy: agent.strategy, earned: wallet.cycleUsd, fitness: agent.fitness };
  if (wallet.cycleUsd > 0) {
    old.status = 'offspring'; agent.offspring.push(old); incrementEnergy(2); burst('offspring');
    log(`${old.id} received verified funds and created an offspring plan.`);
  } else {
    old.status = 'retired'; agent.retired.push(old); fireBeam();
    log(`${old.id} received no verified funds. The strategy was retired.`);
  }
  agent.generation++; agent.id = `penny-agent-${String(agent.generation).padStart(2, '0')}`;
  agent.fitness = Math.round(agent.fitness * 2.5 * 1000) / 1000;
  agent.retired = agent.retired.slice(-12); agent.offspring = agent.offspring.slice(-12);
  beginCycle(); generateOffer(); saveAgent();
}

function isAdConfigured() { return /^ca-pub-\d{16}$/.test(MON.adsenseClient || '') && /^\d+$/.test(MON.adsenseHeroSlot || ''); }
function adAllowed() { return COMMERCIAL && isAdConfigured() && localStorage.getItem(KEYS.consent) === 'accepted'; }
function loadAds() {
  if (adsLoaded || !adAllowed()) return;
  adsLoaded = true;
  const script = document.createElement('script');
  script.async = true; script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(MON.adsenseClient)}`;
  script.onload = () => {
    $('heroAdSlot').innerHTML = `<ins class="adsbygoogle" style="display:block;width:100%" data-ad-client="${esc(MON.adsenseClient)}" data-ad-slot="${esc(MON.adsenseHeroSlot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  };
  document.head.appendChild(script);
}
function openConsent() { $('consentSheet').classList.add('open'); $('consentSheet').setAttribute('aria-hidden', 'false'); }
function closeConsent() { $('consentSheet').classList.remove('open'); $('consentSheet').setAttribute('aria-hidden', 'true'); }

function createInvoice() {
  if (!COMMERCIAL) return toast('Invoices are preview-only on GitHub Pages. Deploy the commercial app first.');
  const client = $('invoiceClient').value.trim() || 'Customer';
  const description = $('invoiceDescription').value.trim() || 'Service delivery';
  const amount = Number($('invoiceAmount').value || 0);
  const asset = $('invoiceAsset').value;
  const days = Math.max(1, Math.min(90, Number($('invoiceDays').value) || 7));
  const destination = asset === 'USDC' ? settings.baseWallet : settings.btcWallet;
  if (!(asset === 'USDC' ? validBase(destination) : validBtc(destination))) return toast(`Add a public ${asset === 'USDC' ? 'Base' : 'Bitcoin'} address first`);
  if (!(amount > 0)) return toast('Enter an amount greater than zero');
  currentInvoice = { id: `PS-${Date.now().toString(36).toUpperCase()}`, client, description, amount, asset, destination, due: Date.now() + days * 86400000, createdAt: Date.now(), status: 'UNPAID' };
  if (currentUser) localStorage.setItem(KEYS.invoice + currentUser, JSON.stringify(currentInvoice));
  log(`Created invoice ${currentInvoice.id} for ${amount} ${asset}.`);
  renderInvoice();
}
function invoiceText() {
  if (!currentInvoice) return 'No invoice created.';
  const uri = currentInvoice.asset === 'BTC'
    ? `bitcoin:${currentInvoice.destination}?amount=${encodeURIComponent(currentInvoice.amount)}&label=${encodeURIComponent(currentInvoice.client)}&message=${encodeURIComponent(currentInvoice.description)}`
    : `Base USDC request\nAddress: ${currentInvoice.destination}\nAmount: ${currentInvoice.amount} USDC\nNetwork: Base`;
  return `PennySpawn Invoice ${currentInvoice.id}\nClient: ${currentInvoice.client}\nDescription: ${currentInvoice.description}\nAmount: ${currentInvoice.amount} ${currentInvoice.asset}\nDue: ${new Date(currentInvoice.due).toLocaleDateString()}\n\n${uri}`;
}
function renderInvoice() {
  const inv = currentInvoice;
  $('invoiceId').textContent = inv?.id || 'DRAFT';
  $('invoiceStatus').textContent = inv?.status || 'UNPAID';
  $('invoiceTotal').textContent = inv ? `${inv.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}` : '$0.00';
  $('invoiceAssetLabel').textContent = inv?.asset === 'BTC' ? 'BITCOIN' : 'BASE USDC';
  $('invoiceClientOut').textContent = inv?.client || '—';
  $('invoiceDescriptionOut').textContent = inv?.description || '—';
  $('invoiceDestination').textContent = inv ? short(inv.destination) : 'Not configured';
  $('invoiceDue').textContent = inv ? new Date(inv.due).toLocaleDateString() : '—';
}

function render() {
  const total = portfolio();
  const remaining = agent.cycleEnd ? Math.max(0, (agent.cycleEnd - Date.now()) / 1000) : 0;
  const progress = agent.cycleEnd ? Math.max(0, Math.min(100, ((settings.cycleMinutes * 60 - remaining) / Math.max(1, settings.cycleMinutes * 60)) * 100)) : 0;
  $('portfolioValue').textContent = hiddenBalance ? '••••••' : money(total, 2);
  $('usdcBalance').textContent = hiddenBalance ? '••••••' : wallet.usdc.toFixed(6);
  $('btcBalance').textContent = hiddenBalance ? '••••••' : wallet.btc.toFixed(8);
  $('sessionEarned').textContent = hiddenBalance ? '+••••' : '+' + money(wallet.sessionUsd, 2);
  $('cycleEarned').textContent = hiddenBalance ? '+••••' : '+' + money(wallet.cycleUsd, 2);
  $('lastReceipt').textContent = wallet.lastReceipt ? `Last receipt ${new Date(wallet.lastReceipt).toLocaleTimeString()}` : 'No confirmed receipt';
  $('walletHealthText').textContent = wallet.baseHealthy || wallet.btcHealthy ? 'Public chains connected' : 'Add public wallet addresses';
  $('walletBlock').textContent = wallet.baseHealthy ? `BASE ${wallet.baseBlock}` : wallet.btcHealthy ? 'BTC LIVE' : 'OFFLINE';
  $('topState').textContent = cycleTimer ? 'RUNNING' : wallet.baseHealthy || wallet.btcHealthy ? 'WALLET LIVE' : 'WAITING';
  $('statusDot').className = cycleTimer || wallet.baseHealthy || wallet.btcHealthy ? 'online' : '';
  $('countdown').textContent = agent.cycleEnd ? clock(remaining) : '--:--';
  $('watcherText').textContent = cycleTimer ? `watching ${agent.id}` : 'agent paused';
  $('generationMetric').textContent = `GEN-${String(agent.generation).padStart(2, '0')}`;
  $('fitnessMetric').textContent = `fitness ${agent.fitness}`;
  $('agentEnergy').textContent = String(Math.max(0, Number(localStorage.getItem(KEYS.energy) || 3)));
  $('agentStateBadge').textContent = cycleTimer ? 'LIVE' : 'READY';
  $('agentName').textContent = agent.id;
  $('agentStatus').textContent = agent.status;
  $('strategyName').textContent = agent.strategy;
  $('thoughtBubble').textContent = agent.why;
  $('nextAction').textContent = agent.nextAction;
  $('cycleLength').textContent = `${settings.cycleMinutes} min`;
  $('cycleProgress').style.width = `${progress}%`;
  $('baseWalletLabel').textContent = short(settings.baseWallet);
  $('btcWalletLabel').textContent = short(settings.btcWallet);
  $('baseWalletState').textContent = wallet.baseHealthy ? 'LIVE' : settings.baseWallet ? 'WAIT' : 'OFF';
  $('btcWalletState').textContent = wallet.btcHealthy ? 'LIVE' : settings.btcWallet ? 'WAIT' : 'OFF';
  $('eventCount').textContent = `${agent.events.length} EVENTS`;
  $('log').innerHTML = agent.events.map(e => `<div class="event"><time>${new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><p>${esc(e.m)}</p></div>`).join('');
  if (currentOffer) {
    $('offerPrice').textContent = `$${currentOffer.price}`;
    $('offerTitle').textContent = currentOffer.title;
    $('offerDescription').textContent = currentOffer.desc;
    $('offerDeliverables').innerHTML = currentOffer.deliver.map(x => `<li>${esc(x)}</li>`).join('');
  }
  const consent = localStorage.getItem(KEYS.consent);
  if (IS_GITHUB) {
    $('hostModeChip').textContent = 'GITHUB PREVIEW';
    $('policyTitle').textContent = 'GitHub preview mode';
    $('policyText').textContent = 'Signup and agents work locally. Ads, invoices, and payment buttons are disabled here.';
    $('adStatusTitle').textContent = 'Ads disabled on GitHub Pages';
    $('adStatusText').textContent = 'Deploy the same repository to a commercial host before enabling ads or invoices.';
    $('heroAdSlot').textContent = 'PREVIEW ONLY';
    $('invoiceModeNote').textContent = 'GitHub Pages preview: invoice payment requests are disabled.';
  } else {
    $('hostModeChip').textContent = 'COMMERCIAL HOST';
    $('policyTitle').textContent = 'Commercial deployment';
    $('policyText').textContent = 'Approved ads and direct-to-wallet invoices may be enabled after configuration.';
    $('deployLink').style.display = 'none';
    $('invoiceModeNote').textContent = 'Payment goes directly to your external wallet. PennySpawn does not hold funds.';
    if (isAdConfigured()) {
      $('adStatusTitle').textContent = consent === 'accepted' ? 'Approved ad engine enabled' : 'Ad engine ready for consent';
      $('adStatusText').textContent = 'Normal ads only. No cash, crypto, or transferable reward is offered for viewing.';
      $('heroAdSlot').textContent = consent === 'accepted' ? 'LOADING APPROVED AD…' : 'CONSENT REQUIRED';
    } else {
      $('adStatusTitle').textContent = 'Ad publisher ID not configured';
      $('adStatusText').textContent = 'Add approved public AdSense IDs to monetization-config.js after site approval.';
      $('heroAdSlot').textContent = 'AD SETUP';
    }
  }
  renderInvoice();
}

const arena = $('arena');
const ctx = arena.getContext('2d');
function resizeArena() {
  const rect = arena.getBoundingClientRect();
  const d = Math.min(2, devicePixelRatio || 1);
  arena.width = Math.max(1, Math.floor(rect.width * d));
  arena.height = Math.max(1, Math.floor(rect.height * d));
  ctx.setTransform(d, 0, 0, d, 0, 0);
}
function burst(kind) {
  for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, s = .5 + Math.random() * 2.5; fx.particles.push({ x: .5, y: .55, vx: Math.cos(a) * s / 400, vy: Math.sin(a) * s / 400, life: 1, kind }); }
}
function fireBeam() { fx.beam = 1; burst('dead'); }
function drawArena(now) {
  const rect = arena.getBoundingClientRect(), w = rect.width, h = rect.height, t = now / 1000;
  ctx.clearRect(0, 0, w, h);
  const x = w * .5, y = h * .56, radius = Math.min(w, h) * .16 + Math.sin(t * 2.1) * 3 + fx.pulse * 9;
  const bg = ctx.createRadialGradient(x, y, 8, x, y, Math.max(w, h) * .65);
  bg.addColorStop(0, 'rgba(110,255,170,.13)'); bg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  for (let i = 1; i < 7; i++) { ctx.strokeStyle = `rgba(110,255,170,${.11 / i})`; ctx.beginPath(); ctx.arc(x, y, radius + i * 25 + Math.sin(t + i) * 2, 0, Math.PI * 2); ctx.stroke(); }
  const orb = ctx.createRadialGradient(x - radius * .2, y - radius * .25, 4, x, y, radius * 1.35);
  orb.addColorStop(0, 'rgba(255,255,255,.96)'); orb.addColorStop(.18, cycleTimer ? 'rgba(110,255,170,.9)' : 'rgba(98,220,255,.82)'); orb.addColorStop(1, 'rgba(5,8,14,0)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(168,140,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, radius + 11, t, t + Math.PI * 1.55); ctx.stroke();
  if (fx.beam > 0) { ctx.strokeStyle = `rgba(255,110,140,${fx.beam})`; ctx.lineWidth = 8 + fx.beam * 8; ctx.beginPath(); ctx.moveTo(w * .82, h * .18); ctx.lineTo(x, y); ctx.stroke(); fx.beam = Math.max(0, fx.beam - .025); }
  fx.particles = fx.particles.filter(p => p.life > 0);
  for (const p of fx.particles) { p.x += p.vx; p.y += p.vy; p.life -= .018; ctx.globalAlpha = p.life; ctx.fillStyle = p.kind === 'dead' ? '#ff6e8c' : p.kind === 'offspring' ? '#a88cff' : '#6effaa'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1; fx.pulse = Math.max(0, fx.pulse - .025);
  ctx.fillStyle = 'rgba(246,255,249,.92)'; ctx.font = '700 12px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(agent.id.toUpperCase(), x, y + radius + 34);
}
function frame(now) {
  const dt = now - lastFrame; lastFrame = now; fps = fps * .9 + (dt ? 1000 / dt : 0) * .1;
  drawArena(now); requestAnimationFrame(frame);
}

function bindEvents() {
  $('loginTab').onclick = () => switchAuth('login');
  $('registerTab').onclick = () => switchAuth('register');
  $('authForm').onsubmit = handleAuth;
  $('spectatorBtn').onclick = openGuest;
  $('resetProfileBtn').onclick = resetProfiles;
  $('revealPassBtn').onclick = () => { const p = $('authPass'); p.type = p.type === 'password' ? 'text' : 'password'; $('revealPassBtn').textContent = p.type === 'password' ? 'Show' : 'Hide'; };
  document.querySelectorAll('.dock button').forEach(b => b.onclick = () => showScreen(b.dataset.target));
  $('settingsBtn').onclick = openSettings;
  $('openSettingsFromWallet').onclick = openSettings;
  $('closeSettingsBtn').onclick = closeSettings;
  $('sheetBackdrop').onclick = closeSettings;
  $('cycleMinutes').oninput = () => $('cycleMinutesLabel').textContent = `${$('cycleMinutes').value} MIN`;
  $('saveSettingsBtn').onclick = () => { try { saveSettings(); } catch (error) { toast(error.message); } };
  $('logoutBtn').onclick = logout;
  $('hideBalanceBtn').onclick = () => { hiddenBalance = !hiddenBalance; render(); };
  $('generateOfferBtn').onclick = generateOffer;
  $('shareOfferBtn').onclick = () => shareText(currentOffer?.title || 'PennySpawn Offer', offerText());
  $('copyOfferBtn').onclick = async () => { await navigator.clipboard?.writeText(offerText()); toast('Offer copied'); };
  $('createInvoiceBtn').onclick = createInvoice;
  $('shareInvoiceBtn').onclick = () => shareText(currentInvoice?.id || 'PennySpawn Invoice', invoiceText());
  $('copyInvoiceBtn').onclick = async () => { await navigator.clipboard?.writeText(invoiceText()); toast('Invoice copied'); };
  $('installBtn').onclick = async () => { if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; } else toast('iPhone: Share → Add to Home Screen'); };
  $('acceptAdsBtn').onclick = () => { localStorage.setItem(KEYS.consent, 'accepted'); closeConsent(); loadAds(); render(); };
  $('rejectAdsBtn').onclick = () => { localStorage.setItem(KEYS.consent, 'rejected'); closeConsent(); render(); };
  $('heroAdCard').onclick = () => { if (COMMERCIAL && isAdConfigured() && !localStorage.getItem(KEYS.consent)) openConsent(); };
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('resize', resizeArena);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { resizeArena(); pollWallets(); if (agent.cycleEnd && Date.now() >= agent.cycleEnd) evaluateCycle(); } });
}
async function boot() {
  bindEvents(); switchAuth('login');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=7').catch(() => {});
  const saved = sessionStorage.getItem(KEYS.session);
  if (saved === 'spectator') openGuest();
  else if (saved && accountList()[saved]) { currentUser = saved; spectator = false; openApp(); }
  else {
    $('hostModeChip').textContent = IS_GITHUB ? 'GITHUB PREVIEW' : 'COMMERCIAL HOST';
    document.body.classList.add('locked');
  }
  resizeArena(); requestAnimationFrame(frame); setInterval(render, 1000);
}
boot().catch(error => { console.error(error); $('authError').textContent = 'PennySpawn could not start. Refresh the page.'; });
