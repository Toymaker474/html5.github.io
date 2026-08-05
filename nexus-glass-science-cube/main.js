const BUILD = 'authored-robots-v6-20260805';

function applyFieldLabGrade() {
  const canvas = document.getElementById('world');
  if (!canvas) return;
  canvas.style.filter = 'saturate(.82) contrast(1.06) brightness(.94)';
  canvas.style.background = '#0d0f0c';
}

async function refreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('./sw.js?v=6', {
      updateViaCache: 'none',
    });
    await registration.update();
  } catch (error) {
    console.warn('NEXUS service worker update skipped', error);
  }
}

function showBootError(error) {
  console.error('NEXUS simulation boot failure', error);
  const notice = document.createElement('div');
  notice.style.cssText = [
    'position:fixed',
    'inset:16px',
    'z-index:9999',
    'display:grid',
    'place-items:center',
    'padding:24px',
    'border:1px solid #76534a',
    'border-left:5px solid #b86358',
    'border-radius:2px',
    'background:#171914',
    'color:#e8e5dc',
    'font:700 13px/1.5 SFMono-Regular,Consolas,monospace',
    'text-align:left',
    'white-space:pre-line',
    'box-shadow:12px 12px 0 rgba(0,0,0,.28)',
  ].join(';');
  const message = error instanceof Error ? error.message : String(error);
  notice.textContent = `FIELD LAB BOOT FAULT\n\n${message}\n\nReload once. Build ${BUILD}`;
  document.body.appendChild(notice);
}

applyFieldLabGrade();
void refreshServiceWorker();

try {
  await import(`./runtime-source.js?v=${encodeURIComponent(BUILD)}`);
  applyFieldLabGrade();
} catch (error) {
  showBootError(error);
}
