import {
  Color3,
  Color4,
  DirectionalLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  TransformNode,
  Vector3,
  VertexData,
} from '@babylonjs/core';

function makeMaterial(scene, name, albedo, metallic, roughness, emissive = null) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = albedo;
  material.metallic = metallic;
  material.roughness = roughness;
  material.emissiveColor = emissive || Color3.Black();
  material.environmentIntensity = 0.72;
  return material;
}

function createTaperedPrism(name, scene, {
  bottomWidth,
  bottomDepth,
  topWidth,
  topDepth,
  height,
}) {
  const mesh = new Mesh(name, scene);
  const y0 = -height * 0.5;
  const y1 = height * 0.5;
  const bx = bottomWidth * 0.5;
  const bz = bottomDepth * 0.5;
  const tx = topWidth * 0.5;
  const tz = topDepth * 0.5;

  const positions = [
    -bx, y0, -bz,  bx, y0, -bz,  bx, y0, bz,  -bx, y0, bz,
    -tx, y1, -tz,  tx, y1, -tz,  tx, y1, tz,  -tx, y1, tz,
  ];
  const indices = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
}

function createOctagonalBeam(name, scene, diameter, height) {
  return MeshBuilder.CreateCylinder(name, {
    diameter,
    height,
    tessellation: 8,
  }, scene);
}

function finish(renderer, mesh, material, parent, castsShadow = true) {
  return renderer.finishPart(mesh, material, parent, castsShadow);
}

function disposePrototypeArchitecture(renderer) {
  renderer.architecture?.grid?.dispose?.();
  renderer.architecture?.chamber?.dispose?.();
  renderer.architecture?.edges?.forEach?.((edge) => edge.dispose());

  const plinth = MeshBuilder.CreateCylinder('specimen-plinth', {
    diameter: 3.15,
    height: 0.075,
    tessellation: 64,
  }, renderer.scene);
  plinth.position.y = -0.055;
  plinth.material = renderer.materials.plinth;
  plinth.receiveShadows = true;
  plinth.isPickable = false;

  const outerRing = MeshBuilder.CreateTorus('specimen-plinth-ring', {
    diameter: 2.78,
    thickness: 0.012,
    tessellation: 96,
  }, renderer.scene);
  outerRing.position.y = -0.011;
  outerRing.material = renderer.materials.marking;
  outerRing.isPickable = false;

  const innerRing = MeshBuilder.CreateTorus('specimen-reference-ring', {
    diameter: 1.58,
    thickness: 0.005,
    tessellation: 80,
  }, renderer.scene);
  innerRing.position.y = -0.008;
  innerRing.material = renderer.materials.marking;
  innerRing.isPickable = false;

  const ticks = [];
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2;
    const major = index % 6 === 0;
    const tick = MeshBuilder.CreateBox(`plinth-tick-${index}`, {
      width: major ? 0.17 : 0.09,
      height: 0.004,
      depth: major ? 0.014 : 0.008,
    }, renderer.scene);
    tick.position.set(Math.cos(angle) * 1.25, -0.008, Math.sin(angle) * 1.25);
    tick.rotation.y = -angle;
    tick.material = renderer.materials.marking;
    tick.isPickable = false;
    ticks.push(tick);
  }

  renderer.architecture = { plinth, outerRing, innerRing, ticks };
}

function installMaterials(renderer) {
  const { scene } = renderer;
  Object.assign(renderer.materials, {
    shell: makeMaterial(scene, 'specimen-ceramic-shell', new Color3(0.58, 0.60, 0.56), 0.18, 0.54),
    shellDark: makeMaterial(scene, 'specimen-dark-shell', new Color3(0.085, 0.095, 0.09), 0.62, 0.34),
    mechanism: makeMaterial(scene, 'specimen-mechanism', new Color3(0.18, 0.19, 0.18), 0.88, 0.21),
    edge: makeMaterial(scene, 'specimen-edge-metal', new Color3(0.38, 0.34, 0.27), 0.91, 0.18),
    rubber: makeMaterial(scene, 'specimen-contact-rubber', new Color3(0.018, 0.02, 0.019), 0.02, 0.96),
    optic: makeMaterial(
      scene,
      'specimen-optic',
      new Color3(0.08, 0.012, 0.008),
      0.15,
      0.12,
      new Color3(0.12, 0.008, 0.003),
    ),
    plinth: makeMaterial(scene, 'specimen-plinth-material', new Color3(0.055, 0.058, 0.056), 0.12, 0.89),
    marking: makeMaterial(scene, 'specimen-measurement-marking', new Color3(0.27, 0.28, 0.25), 0.35, 0.62),
  });
}

function installLightingAndCamera(renderer) {
  renderer.scene.clearColor = new Color4(0.012, 0.014, 0.014, 1);
  renderer.scene.imageProcessingConfiguration.contrast = 1.22;
  renderer.scene.imageProcessingConfiguration.exposure = 0.92;

  const ambient = renderer.scene.getLightByName('ambient-lab');
  if (ambient) {
    ambient.intensity = 0.34;
    ambient.diffuse = new Color3(0.64, 0.68, 0.69);
    ambient.groundColor = new Color3(0.018, 0.02, 0.02);
  }

  if (renderer.keyLight) {
    renderer.keyLight.direction = new Vector3(-0.55, -1, 0.18);
    renderer.keyLight.position = new Vector3(3.2, 5.8, -2.6);
    renderer.keyLight.intensity = 2.1;
    renderer.keyLight.diffuse = new Color3(0.96, 0.91, 0.82);
  }

  const rim = new DirectionalLight('specimen-rim-light', new Vector3(0.48, -0.42, -0.76), renderer.scene);
  rim.position = new Vector3(-3.8, 3.2, 4.4);
  rim.intensity = 1.85;
  rim.diffuse = new Color3(0.42, 0.52, 0.58);

  renderer.camera.alpha = -2.02;
  renderer.camera.beta = 1.18;
  renderer.camera.radius = 2.16;
  renderer.camera.lowerRadiusLimit = 1.55;
  renderer.camera.upperRadiusLimit = 4.6;
  renderer.camera.inertia = 0.56;
  renderer.camera.wheelPrecision = 70;
  renderer.camera.pinchPrecision = 92;
}

function installAssemblies(renderer) {
  renderer.createTorsoAssembly = function createTorsoAssembly(index, size) {
    const root = new TransformNode(`authored-torso-${index}`, this.scene);
    const width = size[0] * 2;
    const depth = size[1] * 2;
    const height = size[2] * 2;

    const lower = finish(this, createTaperedPrism(`torso-lower-${index}`, this.scene, {
      bottomWidth: width * 1.02,
      bottomDepth: depth * 0.92,
      topWidth: width * 0.86,
      topDepth: depth * 0.78,
      height: height * 0.58,
    }), this.materials.shellDark, root);
    lower.position.y = -height * 0.16;

    const carapace = finish(this, createTaperedPrism(`torso-carapace-${index}`, this.scene, {
      bottomWidth: width * 0.90,
      bottomDepth: depth * 0.76,
      topWidth: width * 0.66,
      topDepth: depth * 0.52,
      height: height * 0.42,
    }), this.materials.shell, root);
    carapace.position.y = height * 0.27;

    const spine = finish(this, createTaperedPrism(`torso-spine-${index}`, this.scene, {
      bottomWidth: width * 0.14,
      bottomDepth: depth * 0.64,
      topWidth: width * 0.09,
      topDepth: depth * 0.52,
      height: height * 0.18,
    }), this.materials.edge, root);
    spine.position.y = height * 0.51;

    for (const side of [-1, 1]) {
      const shoulder = finish(this, createTaperedPrism(`torso-shoulder-${index}-${side}`, this.scene, {
        bottomWidth: width * 0.44,
        bottomDepth: depth * 0.28,
        topWidth: width * 0.31,
        topDepth: depth * 0.18,
        height: height * 0.33,
      }), this.materials.shell, root);
      shoulder.position.set(-width * 0.10, height * 0.06, side * depth * 0.48);
      shoulder.rotation.x = side * 0.10;
    }

    const nose = finish(this, createTaperedPrism(`torso-nose-${index}`, this.scene, {
      bottomWidth: width * 0.24,
      bottomDepth: depth * 0.50,
      topWidth: width * 0.12,
      topDepth: depth * 0.38,
      height: height * 0.27,
    }), this.materials.shellDark, root);
    nose.position.set(width * 0.48, height * 0.01, 0);
    nose.rotation.z = -Math.PI * 0.5;

    const optic = finish(this, MeshBuilder.CreateBox(`torso-optic-slit-${index}`, {
      width: height * 0.055,
      height: height * 0.12,
      depth: depth * 0.36,
    }, this.scene), this.materials.optic, root, false);
    optic.position.set(width * 0.535, height * 0.05, 0);

    return root;
  };

  renderer.createCoreAssembly = function createCoreAssembly(index, size) {
    const root = new TransformNode(`authored-core-${index}`, this.scene);
    const diameter = Math.max(size[0], size[1]) * 1.68;

    const recess = finish(this, createOctagonalBeam(`core-recess-${index}`, this.scene, diameter * 1.28, Math.max(0.025, size[2] * 0.42)), this.materials.mechanism, root);
    recess.position.y = -size[2] * 0.12;

    const lens = finish(this, createOctagonalBeam(`core-lens-${index}`, this.scene, diameter, Math.max(0.018, size[2] * 0.22)), this.materials.optic, root, false);
    lens.position.y = size[2] * 0.24;

    const bridge = finish(this, MeshBuilder.CreateBox(`core-bridge-${index}`, {
      width: diameter * 1.55,
      height: Math.max(0.012, size[2] * 0.10),
      depth: diameter * 0.16,
    }, this.scene), this.materials.edge, root);
    bridge.position.y = size[2] * 0.36;

    return root;
  };

  renderer.createLimbAssembly = function createLimbAssembly(index, size) {
    const root = new TransformNode(`authored-limb-${index}`, this.scene);
    const radius = size[0];
    const height = size[2] * 2 + radius * 2;

    const strut = finish(this, createOctagonalBeam(`limb-strut-${index}`, this.scene, radius * 1.15, height * 0.92), this.materials.mechanism, root);

    const upperPlate = finish(this, createTaperedPrism(`limb-upper-shell-${index}`, this.scene, {
      bottomWidth: radius * 2.05,
      bottomDepth: radius * 1.48,
      topWidth: radius * 1.45,
      topDepth: radius * 1.12,
      height: height * 0.42,
    }), this.materials.shell, root);
    upperPlate.position.set(radius * 0.48, height * 0.19, 0);

    const lowerPlate = finish(this, createTaperedPrism(`limb-lower-shell-${index}`, this.scene, {
      bottomWidth: radius * 1.44,
      bottomDepth: radius * 1.04,
      topWidth: radius * 1.90,
      topDepth: radius * 1.36,
      height: height * 0.34,
    }), this.materials.shellDark, root);
    lowerPlate.position.set(-radius * 0.36, -height * 0.19, 0);

    const piston = finish(this, createOctagonalBeam(`limb-piston-${index}`, this.scene, radius * 0.42, height * 0.58), this.materials.edge, root);
    piston.position.set(-radius * 0.92, 0, radius * 0.38);

    for (const sign of [-1, 1]) {
      const collar = finish(this, createOctagonalBeam(`limb-collar-${index}-${sign}`, this.scene, radius * 1.72, radius * 0.34), this.materials.mechanism, root);
      collar.position.y = sign * height * 0.38;
    }

    return root;
  };

  renderer.createFootAssembly = function createFootAssembly(index, radius) {
    const root = new TransformNode(`authored-foot-${index}`, this.scene);

    const ankle = finish(this, createOctagonalBeam(`foot-ankle-${index}`, this.scene, radius * 0.72, radius * 1.18), this.materials.mechanism, root);
    ankle.position.y = radius * 0.62;

    const heel = finish(this, createTaperedPrism(`foot-heel-${index}`, this.scene, {
      bottomWidth: radius * 1.65,
      bottomDepth: radius * 1.40,
      topWidth: radius * 1.26,
      topDepth: radius * 1.02,
      height: radius * 0.68,
    }), this.materials.shellDark, root);
    heel.position.set(-radius * 0.20, -radius * 0.03, 0);

    for (const side of [-1, 1]) {
      const toe = finish(this, createTaperedPrism(`foot-toe-${index}-${side}`, this.scene, {
        bottomWidth: radius * 1.12,
        bottomDepth: radius * 0.56,
        topWidth: radius * 0.72,
        topDepth: radius * 0.42,
        height: radius * 0.42,
      }), this.materials.shell, root);
      toe.position.set(radius * 0.58, -radius * 0.12, side * radius * 0.42);
      toe.rotation.z = -0.16;
    }

    const pad = finish(this, MeshBuilder.CreateBox(`foot-contact-pad-${index}`, {
      width: radius * 2.20,
      height: radius * 0.20,
      depth: radius * 1.68,
    }, this.scene), this.materials.rubber, root, false);
    pad.position.set(radius * 0.18, -radius * 0.53, 0);

    return root;
  };

  renderer.createSensorAssembly = function createSensorAssembly(index, radius) {
    const root = new TransformNode(`authored-sensor-${index}`, this.scene);
    const housing = finish(this, createTaperedPrism(`sensor-housing-${index}`, this.scene, {
      bottomWidth: radius * 2.2,
      bottomDepth: radius * 1.5,
      topWidth: radius * 1.65,
      topDepth: radius * 1.12,
      height: radius * 1.25,
    }), this.materials.mechanism, root, false);
    const optic = finish(this, MeshBuilder.CreateBox(`sensor-aperture-${index}`, {
      width: radius * 1.05,
      height: radius * 0.34,
      depth: radius * 0.84,
    }, this.scene), this.materials.optic, root, false);
    optic.position.y = radius * 0.65;
    return root;
  };

  renderer.updateStateMaterials = function updateStateMaterials() {
    const observation = this.runtime.buildObservation();
    const contactRatio = observation.footContacts.filter((force) => force > 0.001).length / 6;
    const power = Math.min(1, this.runtime.lastPowerWatts / 280);
    const battery = Math.max(0, Math.min(1, this.runtime.batteryJoules / this.runtime.maxBatteryJoules));
    this.materials.optic.emissiveColor.set(
      0.055 + power * 0.30,
      0.004 + contactRatio * 0.025,
      0.002,
    );
    this.materials.optic.albedoColor.set(
      0.035 + power * 0.10,
      0.006,
      0.004 + (1 - battery) * 0.018,
    );
  };
}

export function applyProductionArtDirection(renderer) {
  installMaterials(renderer);
  disposePrototypeArchitecture(renderer);
  installLightingAndCamera(renderer);
  installAssemblies(renderer);
  renderer.artDirection = Object.freeze({
    id: 'nexus.specimen-industrial.v1',
    authoredShells: true,
    colliderVisibility: false,
    overlayMode: 'diagnostics-drawer',
  });
}
