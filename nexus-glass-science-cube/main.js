const PART_COUNT = 6;
const BUILD = '2026-08-04.2';
const RAW_ROOT = 'https://raw.githubusercontent.com/Toymaker474/html5.github.io/main/.nexus-payload';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'text/plain,*/*' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const text = await response.text();
  if (!text.trim()) throw new Error('empty response');
  return text;
}

async function fetchPart(index) {
  const name = `main.part.${String(index).padStart(2, '0')}`;
  const sources = [
    `../.nexus-payload/${name}`,
    `${RAW_ROOT}/${name}`,
  ];
  const failures = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const source of sources) {
      const separator = source.includes('?') ? '&' : '?';
      const url = `${source}${separator}build=${encodeURIComponent(BUILD)}&attempt=${attempt}&t=${Date.now()}`;
      try {
        return await fetchText(url);
      } catch (error) {
        failures.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await sleep(350 * (attempt + 1));
  }

  throw new Error(`Missing simulation payload ${index}. ${failures.slice(-2).join(' | ')}`);
}

async function decodeSimulation() {
  const parts = [];
  for (let index = 0; index < PART_COUNT; index += 1) {
    parts.push(await fetchPart(index));
  }

  const encoded = parts.join('').replace(/\s+/g, '');
  let compressed;
  try {
    compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  } catch {
    throw new Error('Simulation payload was downloaded but is incomplete or corrupted');
  }

  if ('DecompressionStream' in globalThis) {
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  const { ungzip } = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
  return new TextDecoder().decode(ungzip(compressed));
}

function showBootError(error) {
  console.error('NEXUS simulation boot failure', error);
  const notice = document.createElement('div');
  notice.style.cssText = 'position:fixed;inset:16px;z-index:9999;display:grid;place-items:center;padding:24px;border:1px solid #ff5470;border-radius:20px;background:#080d18;color:#fff;font:700 16px system-ui;text-align:center;white-space:pre-line';
  const message = error instanceof Error ? error.message : String(error);
  notice.textContent = `NEXUS could not load.\n${message}\n\nTap reload once. Build ${BUILD}`;
  document.body.appendChild(notice);
}

try {
  const source = await decodeSimulation();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
} catch (error) {
  showBootError(error);
}
