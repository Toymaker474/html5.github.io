import * as real from 'https://cdn.jsdelivr.net/npm/playcanvas@2.21.1/build/playcanvas.mjs?pcx4real=1';
export * from 'https://cdn.jsdelivr.net/npm/playcanvas@2.21.1/build/playcanvas.mjs?pcx4real=1';

export async function createGraphicsDevice(canvas, options = {}) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const common = {
    ...options,
    antialias: options.antialias ?? true,
    depth: options.depth ?? true,
    powerPreference: options.powerPreference ?? 'high-performance'
  };

  if (isIOS) {
    // Safari's WebGPU path can fail after context acquisition on some iOS builds.
    // Use the mature WebGL2 path first so the simulation never loses its canvas.
    return real.createGraphicsDevice(canvas, {
      ...common,
      deviceTypes: [real.DEVICETYPE_WEBGL2]
    });
  }

  try {
    return await real.createGraphicsDevice(canvas, {
      ...common,
      deviceTypes: [real.DEVICETYPE_WEBGPU]
    });
  } catch (webgpuError) {
    console.warn('[PCX4] WebGPU startup failed; falling back to WebGL2.', webgpuError);
    return real.createGraphicsDevice(canvas, {
      ...common,
      deviceTypes: [real.DEVICETYPE_WEBGL2]
    });
  }
}
