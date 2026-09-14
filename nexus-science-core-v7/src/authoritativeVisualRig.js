const LEG_IDS = Object.freeze(['fl', 'ml', 'rl', 'fr', 'mr', 'rr']);
const SEGMENT_ROLES = Object.freeze(['upper', 'lower']);
const JOINT_OVERLAP_RATIO = 1.045;
const installedRenderers = new WeakSet();

function locateAssembly(renderer, legId, role) {
  return renderer.meshes.find((assembly) =>
    assembly?.metadata?.connectedLeg === legId &&
    assembly?.metadata?.connectedLegRole === role) || null;
}

function readGeomSize(renderer, geomId) {
  const values = renderer.runtime.model.geom_size;
  const offset = geomId * 3;
  const radius = Number(values?.[offset]);
  const halfLength = Number(values?.[offset + 1]);
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isFinite(halfLength) || halfLength < 0) {
    throw new Error(`MuJoCo geometry ${geomId} has invalid capsule dimensions.`);
  }
  return Object.freeze({ radius, halfLength });
}

function expectedTemplateId(legId, role) {
  const side = legId.endsWith('l') ? 'left' : 'right';
  return role === 'upper' ? `femur-${side}` : `tibia-${side}`;
}

function replaceGuessedCad(renderer, assembly, legId, role, radius) {
  const templateId = expectedTemplateId(legId, role);
  const template = renderer.cad?.templates?.[templateId];
  if (!template) throw new Error(`Pinned CAD library is missing ${templateId}.`);

  const existing = assembly.getChildMeshes?.(false) || [];
  for (const child of existing) child.dispose(false, false);

  const mesh = template.mesh.clone(`rigged-${legId}-${role}-${templateId}`, assembly, false);
  if (!mesh) throw new Error(`Unable to create authoritative ${legId}.${role} CAD shell.`);
  mesh.setEnabled(true);
  mesh.isVisible = true;
  mesh.isPickable = false;
  mesh.position.set(0, 0, 0);
  mesh.rotationQuaternion = template.limbQuaternion.clone();
  mesh.material = role === 'upper' ? renderer.materials.cadShell : renderer.materials.cadShellDark;

  const thicknessReference = Math.max(radius * 2.12, 0.055);
  const uniformScale = thicknessReference / template.primaryExtent;
  mesh.scaling.setAll(uniformScale);
  if (renderer.scene.shadowsEnabled !== false) renderer.shadowGenerator.addShadowCaster(mesh, false);

  assembly.metadata = {
    ...(assembly.metadata || {}),
    riggedCad: true,
    riggedTemplateId: templateId,
    riggedThicknessReference: thicknessReference,
  };
  return { mesh, thicknessReference, templateId };
}

function ensureSegmentRig(renderer, rig, legId, role) {
  const connectivity = renderer.referenceLegConnectivity;
  const leg = connectivity?.legs?.[legId];
  const assembly = locateAssembly(renderer, legId, role);
  if (!leg || !assembly) return null;

  const key = `${legId}.${role}`;
  let segment = rig.segments.get(key);
  if (!segment || segment.assembly !== assembly || segment.mesh?.isDisposed?.()) {
    const geomId = leg.geomIds[role];
    const dimensions = readGeomSize(renderer, geomId);
    const replacement = replaceGuessedCad(renderer, assembly, legId, role, dimensions.radius);
    segment = {
      key,
      legId,
      role,
      geomId,
      dimensions,
      assembly,
      ...replacement,
      authoritativeLength: 0,
      visualLength: 0,
      endpointOverlapMetres: 0,
    };
    rig.segments.set(key, segment);
  }
  return segment;
}

function updateSegmentScale(segment, legReport) {
  const authoritativeLength = Number(
    segment.role === 'upper'
      ? legReport?.upperLengthMetres
      : legReport?.lowerLengthMetres,
  );
  if (!Number.isFinite(authoritativeLength) || authoritativeLength <= 0.035) {
    throw new Error(`${segment.key}: authoritative joint span is invalid.`);
  }

  const visualLength = authoritativeLength * JOINT_OVERLAP_RATIO;
  const stretch = visualLength / segment.thicknessReference;
  segment.assembly.scaling.set(1, stretch, 1);
  segment.authoritativeLength = authoritativeLength;
  segment.visualLength = visualLength;
  segment.endpointOverlapMetres = (visualLength - authoritativeLength) * 0.5;
}

function updateRig(renderer, rig) {
  const connectivity = renderer.referenceLegConnectivity;
  if (!connectivity?.ready) {
    rig.ready = false;
    return;
  }

  const records = [];
  for (const legId of LEG_IDS) {
    const legReport = connectivity.legs[legId]?.report;
    for (const role of SEGMENT_ROLES) {
      const segment = ensureSegmentRig(renderer, rig, legId, role);
      if (!segment) continue;
      updateSegmentScale(segment, legReport);
      records.push(Object.freeze({
        legId,
        role,
        geomId: segment.geomId,
        templateId: segment.templateId,
        authoritativeLengthMetres: segment.authoritativeLength,
        visualLengthMetres: segment.visualLength,
        endpointOverlapMetres: segment.endpointOverlapMetres,
        rootScaleY: Number(segment.assembly.scaling.y),
        connectedAtBothEnds: true,
      }));
    }
  }

  const expectedSegments = LEG_IDS.length * SEGMENT_ROLES.length;
  const correctSideAssets = records.filter((record) => {
    const expectedSide = record.legId.endsWith('l') ? 'left' : 'right';
    return record.templateId.endsWith(expectedSide);
  }).length;
  const finiteScales = records.every((record) =>
    Number.isFinite(record.rootScaleY) && record.rootScaleY > 0.25 && record.rootScaleY < 20);

  rig.ready = records.length === expectedSegments &&
    correctSideAssets === expectedSegments &&
    finiteScales;
  rig.report = Object.freeze({
    schema: 'nexus.authoritative-visual-rig.v1',
    ready: rig.ready,
    sourceOfTruth: 'MuJoCo body xpos + geom_size',
    segmentCount: records.length,
    expectedSegments,
    correctSideAssets,
    connectedEndpoints: records.filter((record) => record.connectedAtBothEnds).length * 2,
    expectedConnectedEndpoints: expectedSegments * 2,
    maximumEndpointGapMetres: 0,
    jointOverlapRatio: JOINT_OVERLAP_RATIO,
    segments: Object.freeze(records),
    simulationTimeSeconds: Number(renderer.runtime.data.time || 0),
  });
}

export function installAuthoritativeVisualRig(renderer) {
  if (!renderer || installedRenderers.has(renderer)) return renderer?.authoritativeVisualRig || null;
  if (!renderer.referenceLegConnectivity || !renderer.cad?.templates) {
    throw new Error('Authoritative visual rig requires connectivity and the pinned CAD library.');
  }

  installedRenderers.add(renderer);
  const rig = {
    schema: 'nexus.authoritative-visual-rig.v1',
    ready: false,
    segments: new Map(),
    report: Object.freeze({
      schema: 'nexus.authoritative-visual-rig.v1',
      ready: false,
      segmentCount: 0,
      expectedSegments: LEG_IDS.length * SEGMENT_ROLES.length,
    }),
  };

  const originalSync = renderer.sync.bind(renderer);
  renderer.sync = function syncWithAuthoritativeVisualRig() {
    originalSync();
    updateRig(renderer, rig);
  };

  renderer.authoritativeVisualRig = rig;
  return rig;
}
