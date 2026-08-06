import { Color3, StandardMaterial, Vector3 } from '@babylonjs/core';

const configuredRenderers = new WeakSet();

function cloneColor(value, fallback) {
  if (value?.clone) return value.clone();
  return fallback.clone();
}

function createMobileMaterial(renderer, source, cache) {
  if (!source) return null;
  if (cache.has(source)) return cache.get(source);

  const diffuse = cloneColor(
    source.albedoColor || source.diffuseColor,
    new Color3(0.22, 0.24, 0.23),
  );
  const emissive = cloneColor(source.emissiveColor, Color3.Black());
  const metallic = Math.max(0, Math.min(1, Number(source.metallic ?? 0.15)));
  const roughness = Math.max(0, Math.min(1, Number(source.roughness ?? 0.65)));

  const material = new StandardMaterial(`mobile-standard-${source.name || source.uniqueId}`, renderer.scene);
  material.diffuseColor = diffuse;
  material.emissiveColor = emissive;
  material.specularColor = new Color3(
    0.045 + metallic * 0.22,
    0.045 + metallic * 0.22,
    0.045 + metallic * 0.22,
  );
  material.specularPower = Math.max(4, Math.round(8 + (1 - roughness) * 44));
  material.alpha = Number.isFinite(source.alpha) ? source.alpha : 1;
  material.backFaceCulling = source.backFaceCulling !== false;
  material.disableLighting = false;
  material.freeze();
  cache.set(source, material);
  return material;
}

function disableMobileDecoration(renderer) {
  let disabled = 0;
  const disable = (node) => {
    if (!node?.isEnabled?.()) return;
    node.setEnabled(false);
    disabled += 1;
  };

  disable(renderer.architecture?.ring);
  disable(renderer.architecture?.outerRing);
  disable(renderer.architecture?.innerRing);
  renderer.architecture?.ticks?.forEach(disable);

  for (const mesh of renderer.scene.meshes) {
    const name = String(mesh.name || '');
    if (
      name.includes('-bearing-seal') ||
      name.startsWith('cad-plinth-tick-') ||
      name === 'cad-specimen-reference-ring'
    ) {
      disable(mesh);
    }
  }
  return disabled;
}

function installStandardMaterials(renderer) {
  const cache = new Map();
  let reassignedMeshes = 0;

  for (const mesh of renderer.scene.meshes) {
    if (!mesh?.material || mesh.isVisible === false) continue;
    const replacement = createMobileMaterial(renderer, mesh.material, cache);
    if (!replacement) continue;
    mesh.material = replacement;
    reassignedMeshes += 1;
  }

  for (const [key, source] of Object.entries(renderer.materials || {})) {
    const replacement = createMobileMaterial(renderer, source, cache);
    if (replacement) renderer.materials[key] = replacement;
  }

  renderer.mobileStandardMaterials = Object.freeze([...cache.values()]);
  return { materialCount: cache.size, reassignedMeshes };
}

function installSafeFollow(renderer) {
  renderer.updateFollowCamera = function updateFollowCameraWithoutRadiusMutation() {
    const position = this.runtime.rootPosition;
    const authoritativeTarget = new Vector3(
      position.x,
      Math.max(0.18, position.z - 0.12),
      -position.y,
    );
    this.followTarget = Vector3.Lerp(this.followTarget, authoritativeTarget, 0.09);
    this.camera.target.copyFrom(this.followTarget);
  };
}

export function applyMobileRendererOverhaul(renderer) {
  if (!renderer || configuredRenderers.has(renderer)) return renderer?.performanceProfile || null;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  if (!mobile) return null;

  configuredRenderers.add(renderer);
  installSafeFollow(renderer);

  renderer.scene.shadowsEnabled = false;
  renderer.scene.skipPointerMovePicking = true;
  renderer.scene.imageProcessingConfiguration.isEnabled = false;
  renderer.scene.blockMaterialDirtyMechanism = false;
  renderer.camera.inertia = Math.min(renderer.camera.inertia, 0.32);
  renderer.camera.wheelPrecision = 82;
  renderer.camera.pinchPrecision = 112;

  const shadowMap = renderer.shadowGenerator?.getShadowMap?.();
  if (shadowMap) shadowMap.renderList = [];
  renderer.scene.getLightByName('cad-rim-light')?.setEnabled(false);

  const disabledDecorationCount = disableMobileDecoration(renderer);
  const materialReport = installStandardMaterials(renderer);
  renderer.scene.blockMaterialDirtyMechanism = true;

  const devicePixelRatio = Math.max(1, Number(window.devicePixelRatio || 1));
  const hardwareScalingLevel = devicePixelRatio >= 2.5
    ? 2
    : devicePixelRatio >= 1.75
      ? 1.5
      : 1.25;
  renderer.engine.setHardwareScalingLevel(hardwareScalingLevel);
  renderer.engine.resize();

  const activeMeshCount = renderer.scene.meshes.filter((mesh) =>
    mesh?.isEnabled?.() && mesh.isVisible !== false).length;

  renderer.performanceProfile = Object.freeze({
    schema: 'nexus.mobile-renderer-overhaul.v2',
    mobile: true,
    materialMode: 'standard-lit-cad',
    authoredCadPreserved: Boolean(renderer.artDirection?.authoredCad),
    shadowsEnabled: false,
    radiusSafeFollow: true,
    hardwareScalingLevel,
    renderWidth: renderer.engine.getRenderWidth(),
    renderHeight: renderer.engine.getRenderHeight(),
    disabledDecorationCount,
    activeMeshCount,
    materialCount: materialReport.materialCount,
    reassignedMeshes: materialReport.reassignedMeshes,
    configuredAt: performance.now(),
  });

  return renderer.performanceProfile;
}
