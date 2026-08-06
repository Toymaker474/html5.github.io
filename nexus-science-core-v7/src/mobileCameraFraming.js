import { Matrix, Vector3 } from '@babylonjs/core';
import { installOperationalCore } from './operationalCore.js';
import { applyMobileRendererOverhaul } from './mobileRendererOverhaul.js';
import { installMobileWorldApp } from './mobileWorldApp.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MOBILE_EDGE_MARGIN_PX = 10;
const TARGET_FILL_RATIO = 0.70;
const MIN_READABLE_FILL_RATIO = 0.62;
const MAX_READABLE_FILL_RATIO = 0.84;
const SETTLE_MILLISECONDS = 4200;

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
    projectedHalfSpan / Math.max(0.08, Math.tan(horizontalFov / 2)) * 1.08,
    4.15,
    7.2,
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
  const projectedWidth = right - left;
  const widthRatio = projectedWidth / width;
  const horizontallyContained = left >= MOBILE_EDGE_MARGIN_PX && right <= width - MOBILE_EDGE_MARGIN_PX;
  return Object.freeze({
    left,
    right,
    top,
    bottom,
    width: projectedWidth,
    height: bottom - top,
    widthRatio,
    viewportWidth: width,
    viewportHeight: height,
    meshCount: meshes.length,
    projectedPoints,
    horizontallyContained,
    readableFill: horizontallyContained &&
      widthRatio >= MIN_READABLE_FILL_RATIO &&
      widthRatio <= MAX_READABLE_FILL_RATIO,
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

function enforceSafeRadius(renderer, fittedRadius) {
  const camera = renderer.camera;
  const boundedRadius = clamp(fittedRadius, 2.8, 11.5);
  const inspectionFloor = Math.max(2.65, boundedRadius * 0.92);

  camera.inertialRadiusOffset = 0;
  camera.lowerRadiusLimit = inspectionFloor;
  camera.upperRadiusLimit = Math.max(12, boundedRadius + 1);
  if (!Number.isFinite(camera.radius) || camera.radius < inspectionFloor) {
    camera.radius = inspectionFloor;
  }
  renderer.mobileMinimumRadius = inspectionFloor;
  return boundedRadius;
}

export function installMobileCameraFraming() {
  installOperationalCore();
  installMobileWorldApp();
  installGarageBackdropObserver();

  let activeRenderer = null;
  let activePresetId = null;
  let settleUntil = 0;
  let frame = 0;
  let fittedRadius = 4.8;

  function applyInitialFit(renderer, preset) {
    applyMobileRendererOverhaul(renderer);
    fittedRadius = calculateFitRadius(renderer, preset);
    renderer.camera.alpha = -Math.PI / 2.28;
    renderer.camera.beta = 1.03;
    renderer.camera.radius = fittedRadius;
    enforceSafeRadius(renderer, fittedRadius);
    renderer.mobileCameraFit = Object.freeze({
      schema: 'nexus.mobile-camera-fit.v2',
      presetId: preset.id,
      targetRadius: fittedRadius,
      safeMinimumRadius: renderer.mobileMinimumRadius,
      appliedRadius: renderer.camera.radius,
      targetFillRatio: TARGET_FILL_RATIO,
      viewportBounds: null,
      horizontallyContained: false,
      readableFill: false,
      settled: false,
    });
    settleUntil = performance.now() + SETTLE_MILLISECONDS;
  }

  function updateFitEvidence(renderer, preset) {
    enforceSafeRadius(renderer, fittedRadius);
    const bounds = measureRobotBounds(renderer);
    if (!bounds) return;

    const settling = performance.now() < settleUntil;
    if (!bounds.horizontallyContained) {
      const leftOverflow = Math.max(0, MOBILE_EDGE_MARGIN_PX - bounds.left);
      const rightOverflow = Math.max(0, bounds.right - (bounds.viewportWidth - MOBILE_EDGE_MARGIN_PX));
      const overflow = Math.max(leftOverflow, rightOverflow);
      const scaleOut = clamp(1 + overflow / Math.max(120, bounds.viewportWidth) * 1.45, 1.025, 1.20);
      fittedRadius = clamp(Math.max(fittedRadius, renderer.camera.radius) * scaleOut, 2.8, 11.5);
      renderer.camera.radius = fittedRadius;
    } else if (settling && bounds.widthRatio < MIN_READABLE_FILL_RATIO) {
      const scaleIn = clamp(bounds.widthRatio / TARGET_FILL_RATIO, 0.78, 0.97);
      fittedRadius = clamp(renderer.camera.radius * scaleIn, 2.8, 11.5);
      renderer.camera.radius = fittedRadius;
    } else if (settling && bounds.widthRatio > MAX_READABLE_FILL_RATIO) {
      const scaleOut = clamp(bounds.widthRatio / TARGET_FILL_RATIO, 1.03, 1.16);
      fittedRadius = clamp(renderer.camera.radius * scaleOut, 2.8, 11.5);
      renderer.camera.radius = fittedRadius;
    }

    enforceSafeRadius(renderer, fittedRadius);
    const finalBounds = measureRobotBounds(renderer) || bounds;
    renderer.mobileCameraFit = Object.freeze({
      schema: 'nexus.mobile-camera-fit.v2',
      presetId: preset.id,
      targetRadius: calculateFitRadius(renderer, preset),
      fittedRadius,
      safeMinimumRadius: renderer.mobileMinimumRadius,
      appliedRadius: renderer.camera.radius,
      targetFillRatio: TARGET_FILL_RATIO,
      viewportBounds: finalBounds,
      horizontallyContained: finalBounds.horizontallyContained,
      readableFill: finalBounds.readableFill,
      settled: finalBounds.readableFill || performance.now() >= settleUntil,
    });
  }

  function tick() {
    const current = window.__NEXUS_V7__;
    const renderer = current?.renderer;
    const preset = current?.activePreset;

    if (renderer && preset && (renderer !== activeRenderer || preset.id !== activePresetId)) {
      activeRenderer = renderer;
      activePresetId = preset.id;
      applyInitialFit(renderer, preset);
    }

    if (renderer && preset && renderer === activeRenderer) {
      applyMobileRendererOverhaul(renderer);
      frame += 1;
      if (frame % 6 === 0) updateFitEvidence(renderer, preset);
      else enforceSafeRadius(renderer, fittedRadius);
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
