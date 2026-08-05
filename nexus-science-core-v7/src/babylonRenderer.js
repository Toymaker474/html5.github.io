import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Scene,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';

async function createBestEngine(canvas) {
  if ('gpu' in navigator) {
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine.js');
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await engine.initAsync();
      engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.7));
      return { engine, backend: 'WebGPU' };
    } catch (error) {
      console.warn('WebGPU unavailable; using WebGL2.', error);
    }
  }

  const engine = new Engine(canvas, true, {
    stencil: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.55));
  return { engine, backend: 'WebGL2' };
}

function multiply3(a, b) {
  const out = new Array(9).fill(0);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      for (let k = 0; k < 3; k += 1) out[row * 3 + col] += a[row * 3 + k] * b[k * 3 + col];
    }
  }
  return out;
}

function transpose3(matrix) {
  return [matrix[0], matrix[3], matrix[6], matrix[1], matrix[4], matrix[7], matrix[2], matrix[5], matrix[8]];
}

const AXIS_CONVERSION = [
  1, 0, 0,
  0, 0, 1,
  0, -1, 0,
];

function mujocoRotationToBabylon(source) {
  const rotation = Array.from(source);
  const converted = multiply3(multiply3(AXIS_CONVERSION, rotation), transpose3(AXIS_CONVERSION));
  const matrix = Matrix.FromValues(
    converted[0], converted[1], converted[2], 0,
    converted[3], converted[4], converted[5], 0,
    converted[6], converted[7], converted[8], 0,
    0, 0, 0, 1,
  );
  return Quaternion.FromRotationMatrix(matrix);
}

function makePbr(scene, name, {
  albedo,
  metallic,
  roughness,
  emissive = new Color3(0, 0, 0),
  alpha = 1,
}) {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = albedo;
  material.metallic = metallic;
  material.roughness = roughness;
  material.emissiveColor = emissive;
  material.alpha = alpha;
  material.backFaceCulling = alpha >= 0.999;
  material.transparencyMode = alpha < 0.999 ? 2 : 0;
  return material;
}

function createMaterialLibrary(scene) {
  return {
    ground: makePbr(scene, 'lab-basalt', {
      albedo: new Color3(0.055, 0.064, 0.054), metallic: 0.05, roughness: 0.93,
    }),
    structure: makePbr(scene, 'robot-graphite-ceramic', {
      albedo: new Color3(0.16, 0.18, 0.16), metallic: 0.62, roughness: 0.38,
    }),
    limb: makePbr(scene, 'robot-dark-titanium', {
      albedo: new Color3(0.10, 0.12, 0.105), metallic: 0.78, roughness: 0.31,
    }),
    core: makePbr(scene, 'robot-machined-bronze', {
      albedo: new Color3(0.51, 0.36, 0.16), metallic: 0.84, roughness: 0.24,
      emissive: new Color3(0.055, 0.025, 0.006),
    }),
    foot: makePbr(scene, 'robot-contact-elastomer', {
      albedo: new Color3(0.20, 0.18, 0.125), metallic: 0.08, roughness: 0.86,
      emissive: new Color3(0.015, 0.01, 0.002),
    }),
    frame: makePbr(scene, 'chamber-frame', {
      albedo: new Color3(0.24, 0.25, 0.22), metallic: 0.82, roughness: 0.28,
    }),
    glass: makePbr(scene, 'chamber-glass', {
      albedo: new Color3(0.20, 0.26, 0.22), metallic: 0, roughness: 0.08, alpha: 0.055,
    }),
  };
}

function geometrySignature(geom) {
  return `${geom.type}:${Array.from(geom.size).map((value) => Number(value).toFixed(5)).join(',')}:${geom.dataid}`;
}

function createLaboratoryArchitecture(scene, materials) {
  const gridLines = [];
  const extent = 6;
  const step = 0.25;
  for (let coordinate = -extent; coordinate <= extent + 1e-6; coordinate += step) {
    gridLines.push([new Vector3(-extent, 0.002, coordinate), new Vector3(extent, 0.002, coordinate)]);
    gridLines.push([new Vector3(coordinate, 0.002, -extent), new Vector3(coordinate, 0.002, extent)]);
  }
  const grid = MeshBuilder.CreateLineSystem('calibration-grid', { lines: gridLines }, scene);
  grid.color = new Color3(0.17, 0.19, 0.16);
  grid.alpha = 0.42;
  grid.isPickable = false;

  const chamber = MeshBuilder.CreateBox('containment-chamber', { width: 2.8, height: 2.15, depth: 2.8 }, scene);
  chamber.position.y = 1.075;
  chamber.material = materials.glass;
  chamber.isPickable = false;

  const edgeThickness = 0.025;
  const half = 1.4;
  const top = 2.15;
  const edges = [];
  const addEdge = (name, width, height, depth, position) => {
    const edge = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    edge.position.copyFrom(position);
    edge.material = materials.frame;
    edge.isPickable = false;
    edges.push(edge);
  };

  for (const x of [-half, half]) {
    for (const z of [-half, half]) addEdge(`vertical-${x}-${z}`, edgeThickness, top, edgeThickness, new Vector3(x, top / 2, z));
  }
  for (const y of [0, top]) {
    for (const z of [-half, half]) addEdge(`x-edge-${y}-${z}`, half * 2, edgeThickness, edgeThickness, new Vector3(0, y, z));
    for (const x of [-half, half]) addEdge(`z-edge-${y}-${x}`, edgeThickness, edgeThickness, half * 2, new Vector3(x, y, 0));
  }

  return { grid, chamber, edges };
}

export class BabylonMujocoRenderer {
  static async create(canvas, runtime) {
    const engineInfo = await createBestEngine(canvas);
    return new BabylonMujocoRenderer(canvas, runtime, engineInfo);
  }

  constructor(canvas, runtime, { engine, backend }) {
    this.canvas = canvas;
    this.runtime = runtime;
    this.engine = engine;
    this.backend = backend;
    this.scene = new Scene(engine);
    this.scene.clearColor = new Color4(0.018, 0.022, 0.018, 1);
    this.scene.useRightHandedSystem = true;
    this.scene.skipPointerMovePicking = true;
    this.scene.imageProcessingConfiguration.contrast = 1.16;
    this.scene.imageProcessingConfiguration.exposure = 1.04;

    this.materials = createMaterialLibrary(this.scene);
    this.architecture = createLaboratoryArchitecture(this.scene, this.materials);

    this.followTarget = new Vector3(0, 0.46, 0);
    this.camera = new ArcRotateCamera('camera', -Math.PI / 2.25, 1.08, 3.15, this.followTarget.clone(), this.scene);
    this.camera.lowerRadiusLimit = 1.25;
    this.camera.upperRadiusLimit = 8;
    this.camera.lowerBetaLimit = 0.45;
    this.camera.upperBetaLimit = 1.48;
    this.camera.wheelPrecision = 48;
    this.camera.pinchPrecision = 68;
    this.camera.inertia = 0.72;
    this.camera.attachControl(canvas, true);

    const sky = new HemisphericLight('ambient-lab', new Vector3(0.15, 1, 0.1), this.scene);
    sky.intensity = 0.78;
    sky.diffuse = new Color3(0.82, 0.85, 0.79);
    sky.groundColor = new Color3(0.045, 0.052, 0.042);

    this.keyLight = new DirectionalLight('key-lab', new Vector3(-0.42, -1, 0.34), this.scene);
    this.keyLight.position = new Vector3(3.5, 6.5, -4.5);
    this.keyLight.intensity = 2.75;
    this.keyLight.diffuse = new Color3(1.0, 0.88, 0.70);

    this.shadowGenerator = new ShadowGenerator(1024, this.keyLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.bias = 0.0007;
    this.shadowGenerator.normalBias = 0.025;

    const module = runtime.mujoco;
    this.option = new module.MjvOption();
    this.perturb = new module.MjvPerturb();
    this.mjCamera = new module.MjvCamera();
    this.mjScene = new module.MjvScene(runtime.model, 4096);
    this.meshes = [];
    this.signatures = [];

    window.addEventListener('resize', () => this.engine.resize());
  }

  materialForGeom(type, size) {
    const enumType = this.runtime.mujoco.mjtGeom;
    if (type === enumType.mjGEOM_PLANE.value) return this.materials.ground;
    if (type === enumType.mjGEOM_ELLIPSOID.value) return this.materials.core;
    if (type === enumType.mjGEOM_BOX.value) return this.materials.structure;
    if (type === enumType.mjGEOM_SPHERE.value && size[0] > 0.05) return this.materials.foot;
    return this.materials.limb;
  }

  createMesh(index, geom) {
    const size = geom.size;
    const type = geom.type;
    const enumType = this.runtime.mujoco.mjtGeom;
    let mesh;

    if (type === enumType.mjGEOM_PLANE.value) {
      mesh = MeshBuilder.CreateGround(`mj-geom-${index}`, { width: 24, height: 24, subdivisions: 1 }, this.scene);
      mesh.receiveShadows = true;
    } else if (type === enumType.mjGEOM_SPHERE.value) {
      mesh = MeshBuilder.CreateSphere(`mj-geom-${index}`, { diameter: size[0] * 2, segments: 28 }, this.scene);
    } else if (type === enumType.mjGEOM_CAPSULE.value) {
      mesh = MeshBuilder.CreateCapsule(`mj-geom-${index}`, {
        radius: size[0],
        height: size[2] * 2 + size[0] * 2,
        tessellation: 24,
        subdivisions: 3,
      }, this.scene);
    } else if (type === enumType.mjGEOM_BOX.value) {
      mesh = MeshBuilder.CreateBox(`mj-geom-${index}`, {
        width: size[0] * 2,
        depth: size[1] * 2,
        height: size[2] * 2,
        faceColors: undefined,
      }, this.scene);
    } else if (type === enumType.mjGEOM_CYLINDER.value) {
      mesh = MeshBuilder.CreateCylinder(`mj-geom-${index}`, {
        diameter: size[0] * 2,
        height: size[2] * 2,
        tessellation: 28,
      }, this.scene);
    } else if (type === enumType.mjGEOM_ELLIPSOID.value) {
      mesh = MeshBuilder.CreateSphere(`mj-geom-${index}`, { diameter: 2, segments: 32 }, this.scene);
      mesh.scaling.set(size[0], size[2], size[1]);
    } else {
      mesh = MeshBuilder.CreateBox(`mj-unsupported-${index}`, { size: 0.03 }, this.scene);
      mesh.isVisible = false;
    }

    mesh.material = this.materialForGeom(type, size);
    mesh.isPickable = false;
    if (type !== enumType.mjGEOM_PLANE.value) this.shadowGenerator.addShadowCaster(mesh, true);
    return mesh;
  }

  updateFollowCamera() {
    const position = this.runtime.rootPosition;
    const authoritativeTarget = new Vector3(position.x, Math.max(0.30, position.z + 0.06), -position.y);
    this.followTarget = Vector3.Lerp(this.followTarget, authoritativeTarget, 0.105);
    this.camera.setTarget(this.followTarget);
  }

  updateStateMaterials() {
    const observation = this.runtime.buildObservation();
    const contacts = observation.footContacts.filter((force) => force > 0.001).length / 6;
    const power = Math.min(1, this.runtime.lastPowerWatts / 260);
    const battery = this.runtime.batteryJoules / this.runtime.maxBatteryJoules;

    this.materials.core.emissiveColor.set(
      0.035 + power * 0.11,
      0.015 + power * 0.055,
      0.003,
    );
    this.materials.foot.emissiveColor.set(
      0.008 + contacts * 0.055,
      0.006 + contacts * 0.035,
      0.002,
    );
    this.materials.core.albedoColor.set(0.36 + battery * 0.17, 0.24 + battery * 0.12, 0.10 + battery * 0.06);
  }

  sync() {
    const module = this.runtime.mujoco;
    module.mjv_updateScene(
      this.runtime.model,
      this.runtime.data,
      this.option,
      this.perturb,
      this.mjCamera,
      module.mjtCatBit.mjCAT_ALL.value,
      this.mjScene,
    );

    const geoms = this.mjScene.geoms;
    const count = geoms.size();

    for (let index = 0; index < count; index += 1) {
      const geom = geoms.get(index);
      if (!geom) continue;
      const signature = geometrySignature(geom);

      if (!this.meshes[index] || this.signatures[index] !== signature) {
        this.meshes[index]?.dispose(false, false);
        this.meshes[index] = this.createMesh(index, geom);
        this.signatures[index] = signature;
      }

      const mesh = this.meshes[index];
      mesh.position.set(geom.pos[0], geom.pos[2], -geom.pos[1]);
      mesh.rotationQuaternion = mujocoRotationToBabylon(geom.mat);
      geom.delete();
    }

    while (this.meshes.length > count) {
      this.meshes.pop()?.dispose(false, false);
      this.signatures.pop();
    }
    geoms.delete();
    this.updateFollowCamera();
    this.updateStateMaterials();
  }

  render() {
    this.scene.render();
  }

  dispose() {
    this.meshes.forEach((mesh) => mesh.dispose(false, false));
    Object.values(this.materials).forEach((material) => material.dispose());
    this.mjScene?.delete?.();
    this.mjCamera?.delete?.();
    this.perturb?.delete?.();
    this.option?.delete?.();
    this.scene.dispose();
    this.engine.dispose();
  }
}
