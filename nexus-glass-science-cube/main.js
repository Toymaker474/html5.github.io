const PART_COUNT = 6;

async function decodeSimulation() {
  const parts = await Promise.all(
    Array.from({ length: PART_COUNT }, (_, index) =>
      fetch(`../.nexus-payload/main.part.${String(index).padStart(2, '0')}?v=1`, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) throw new Error(`Missing simulation payload ${index}`);
          return response.text();
        })
    )
  );

  const encoded = parts.join('').replace(/\s+/g, '');
  const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));

  if ('DecompressionStream' in globalThis) {
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  const { ungzip } = await import('https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm');
  return new TextDecoder().decode(ungzip(compressed));
}

try {
  const source = await decodeSimulation();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  await import(moduleUrl);
} catch (error) {
  console.error('NEXUS simulation boot failure', error);
  const notice = document.createElement('div');
  notice.style.cssText = 'position:fixed;inset:16px;z-index:9999;display:grid;place-items:center;padding:24px;border:1px solid #ff5470;border-radius:20px;background:#080d18;color:#fff;font:700 16px system-ui;text-align:center';
  notice.textContent = `NEXUS could not load: ${error instanceof Error ? error.message : String(error)}`;
  document.body.appendChild(notice);
}
