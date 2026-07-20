const status = document.createElement('div');
status.id = 'loaderStatus';
status.textContent = 'DECODING ALIEN WORLD';
status.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#020509;color:#bfffee;font:800 12px system-ui;letter-spacing:.18em;z-index:9999';
document.body.append(status);

async function decode(parts) {
  const texts = await Promise.all(parts.map(path => fetch(path, { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error(`${path} returned ${r.status}`);
    return r.text();
  })));
  const base64 = texts.join('').replace(/\s+/g, '');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (!('DecompressionStream' in window)) throw new Error('This Safari version is too old for the Fracture Wilds loader. Update iOS.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

try {
  const [simText, gameText, cssText] = await Promise.all([
    decode(['./.payload/sim.js.part00','./.payload/sim.js.part01','./.payload/sim.js.part02']),
    decode(['./.payload/game.js.part00','./.payload/game.js.part01','./.payload/game.js.part02']),
    decode(['./.payload/style.css.part00'])
  ]);
  const style = document.createElement('style');
  style.textContent = cssText;
  document.head.append(style);
  const simURL = URL.createObjectURL(new Blob([simText], { type: 'text/javascript' }));
  const patchedGame = gameText.replace("'./sim.js?v=5'", JSON.stringify(simURL));
  if (patchedGame === gameText) throw new Error('Simulation import patch failed.');
  const gameURL = URL.createObjectURL(new Blob([patchedGame], { type: 'text/javascript' }));
  await import(gameURL);
  status.remove();
} catch (error) {
  console.error(error);
  status.innerHTML = `<div style="max-width:340px;text-align:center;padding:24px"><b>FRACTURE WILDS FAILED TO BOOT</b><p style="color:#9bb0c3;line-height:1.5;letter-spacing:0">${String(error.message || error)}</p><button style="padding:12px 18px;border:0;border-radius:14px;background:#70ffd5;color:#04100c;font-weight:900" onclick="location.reload()">RELOAD</button></div>`;
}
