window['ai_edge_gallery_get_result'] = async (dataStr) => {
  try {
    const d = JSON.parse(dataStr || '{}');
    const modes = new Set(['fluid','gravity','reaction','waves']);
    const mode = modes.has(d.mode) ? d.mode : 'fluid';
    const intensity = Math.max(0.5, Math.min(2.0, Number(d.intensity) || 1.0));
    const seed = Number.isFinite(Number(d.seed)) ? Math.floor(Number(d.seed)) : 42;
    const url = `ui.html?mode=${encodeURIComponent(mode)}&intensity=${intensity}&seed=${seed}&v=${Date.now()}`;
    return JSON.stringify({
      webview: { url, aspectRatio: 1.55 },
      result: `Micro Cosmos launched in ${mode} mode. Tell the user to tap the preview card and interact with it.`
    });
  } catch (e) {
    console.error(e);
    return JSON.stringify({ error: `Failed to launch Micro Cosmos: ${e.message}` });
  }
};
