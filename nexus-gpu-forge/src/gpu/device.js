export async function createGPUDevice(canvas) {
  if (!navigator.gpu) {
    throw new Error('WebGPU is unavailable. Safari 26+ or a current Chromium browser is required.');
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) throw new Error('No compatible GPU adapter was found.');

  const optionalFeatures = [];
  if (adapter.features.has('timestamp-query')) optionalFeatures.push('timestamp-query');

  const device = await adapter.requestDevice({ requiredFeatures: optionalFeatures });
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('The WebGPU canvas context could not be created.');

  const format = navigator.gpu.getPreferredCanvasFormat();
  device.lost.then(info => {
    console.error('NEXUS GPU device lost:', info.message);
    window.dispatchEvent(new CustomEvent('nexus-device-lost', { detail: info }));
  });

  return { adapter, device, context, format, timestampQueries: device.features.has('timestamp-query') };
}
