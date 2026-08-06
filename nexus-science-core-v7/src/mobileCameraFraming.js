import { Matrix, Vector3 } from '@babylonjs/core';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MOBILE_EDGE_MARGIN_PX = 14;
const SETTLE_MILLISECONDS = 2800;

function isRobotMesh(mesh) {
  const name = String(mesh?.name || '');
  return mesh?.isEnabled?.() && mesh.isVisible !== false && (
    name.startsWith('connected-') ||
    /^cad-.*-instance-/.test(name)
  );
}

function calculateFitRadius(renderer, preset) {
  const morphology = preset.morphology;
  const width = Math.max(1, renderer.engine.getRenderWidth());
  const height = Math.max(1, renderer.engine.getRenderHeight());
  const aspect = clamp(width / height, 0.34, 2.4);
  const verticalFov = Number(renderer.camera.fov || 0.8);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);

  const lateralHalfSpan =
    morphology.torso.halfWidth * morphology.leg.hipInset +
    morphology.leg.upperOut +
    morphology.leg.lowerOut +
    morphology.leg.footRadius;
  const longitudinalHalfSpan = morphology.torso.halfLength + morphology.leg.footRadius;
  const projectedHalfSpan = Math.hypot(longitudinalHalfSpan * 0.65, lateralHalfSpan * 0.90);
  return clamp(
    projectedHalfSpan / Math.max(0.08, Math.tan(horizontalFov / 2)) * 1.35,
    5.55,
    8.4,
  );
}

function measureRobotBounds(renderer) {
  const width = Math.max(1, renderer.engine.getRenderWidth());
  const height = Math.max(1, renderer.engine.getRenderHeight());
  const viewport = renderer.camera.viewport.toGlobal(width, height);
  const transform = renderer.scene.getTransformMatrix();
  const identity = Matrix.Identity();
  const meshes = renderer.scene.meshes.filter(isRobotMesh);

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let projectedPoints = 0;

  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const corners = mesh.getBoundingInfo?.().boundingBox?.vectorsWorld || [];
    for (const corner of corners) {
      const projected = Vector3.Project(corner, identity, transform, viewport);
      if (![projected.x, projected.y, projected.z].every(Number.isFinite)) continue;
      if (projected.z < 0 || projected.z > 1.05) continue;
      left = Math.min(left, projected.x);
      right = Math.max(right, projected.x);
      top = Math.min(top, projected.y);
      bottom = Math.max(bottom, projected.y);
      projectedPoints += 1;
    }
  }

  if (!projectedPoints) return null;
  return Object.freeze({
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    viewportWidth: width,
    viewportHeight: height,
    meshCount: meshes.length,
    projectedPoints,
    horizontallyContained: left >= MOBILE_EDGE_MARGIN_PX && right <= width - MOBILE_EDGE_MARGIN_PX,
  });
}

function installGarageBackdropObserver() {
  const panel = document.querySelector('#preset-panel');
  const backdrop = document.querySelector('#preset-backdrop');
  const closeButton = document.querySelector('#preset-close');
  if (!(panel instanceof HTMLElement) || !(backdrop instanceof HTMLButtonElement)) return;
  if (backdrop.dataset.observerInstalled === 'true') return;
  backdrop.dataset.observerInstalled = 'true';

  const sync = () => {
    const open = panel.dataset.open === 'true';
    backdrop.dataset.open = String(open);
    backdrop.setAttribute('aria-hidden', String(!open));
  };

  const observer = new MutationObserver(sync);
  observer.observe(panel, { attributes: true, attributeFilter: ['data-open'] });
  backdrop.addEventListener('click', () => {
    if (closeButton instanceof HTMLButtonElement) closeButton.click();
    else {
      panel.dataset.open = 'false';
      panel.setAttribute('aria-hidden', 'true');
    }
    sync();
  });
  sync();
}

export function installMobileCameraFraming() {
  installGarageBackdropObserver();

  let activeRenderer = null;
  let activePresetId = null;
  let settleUntil = 0;
  let frame = 0;

  function applyInitialFit(renderer, preset) {
    const targetRadius = calculateFitRadius(renderer, preset);
    renderer.camera.alpha = -Math.PI / 2.28;
    renderer.camera.beta = 1.03;
    renderer.camera.radius = targetRadius;
    renderer.camera.lowerRadiusLimit = Math.max(2.8, targetRadius * 0.54);
    renderer.camera.upperRadiusLimit = 10;
    renderer.mobileCameraFit = Object.freeze({
      schema: 'nexus.mobile-camera-fit.v1',
      presetId: preset.id,
      targetRadius,
      appliedRadius: renderer.camera.radius,
      viewportBounds: null,
      horizontallyContained: false,
      settled: false,
    });
    settleUntil = performance.now() + SETTLE_MILLISECONDS;
  }

  function updateFitEvidence(renderer, preset) {
    const bounds = measureRobotBounds(renderer);
    if (!bounds) return;

    if (performance.now() < settleUntil && !bounds.horizontallyContained) {
      const leftOverflow = Math.max(0, MOBILE_EDGE_MARGIN_PX - bounds.left);
      const rightOverflow = Math.max(0, bounds.right - (bounds.viewportWidth - MOBILE_EDGE_MARGIN_PX));
      const overflow = Math.max(leftOverflow, rightOverflow);
      const scale = clamp(1 + overflow / Math.max(180, bounds.viewportWidth) * 1.35, 1.03, 1.22);
      renderer.camera.radius = Math.min(renderer.camera.upperRadiusLimit, renderer.camera.radius * scale);
    }

    const finalBounds = measureRobotBounds(renderer) || bounds;
    renderer.mobileCameraFit = Object.freeze({
      schema: 'nexus.mobile-camera-fit.v1',
      presetId: preset.id,
      targetRadius: calculateFitRadius(renderer, preset),
      appliedRadius: renderer.camera.radius,
      viewportBounds: finalBounds,
      horizontallyContained: finalBounds.horizontallyContained,
      settled: performance.now() >= settleUntil || finalBounds.horizontallyContained,
    });
  }

  function tick() {
    const nexus = window.__NEXUS_V7__;
    const renderer = nexus?.renderer;
    const preset = nexus?.activePreset;

    if (renderer && preset && (renderer !== activeRenderer || preset.id !== activePresetId)) {
      activeRenderer = renderer;
      activePresetId = preset.id;
      applyInitialFit(renderer, preset);
    }

    if (renderer && preset && renderer === activeRenderer) {
      frame += 1;
      if (frame % 8 === 0) updateFitEvidence(renderer, preset);
    }

    requestAnimationFrame(tick);
  }

  window.addEventListener('orientationchange', () => {
    if (!activeRenderer || !window.__NEXUS_V7__?.activePreset) return;
    setTimeout(() => applyInitialFit(activeRenderer, window.__NEXUS_V7__.activePreset), 180);
  });
  window.addEventListener('resize', () => {
    if (!activeRenderer || !window.__NEXUS_V7__?.activePreset) return;
    applyInitialFit(activeRenderer, window.__NEXUS_V7__.activePreset);
  });

  requestAnimationFrame(tick);
}
