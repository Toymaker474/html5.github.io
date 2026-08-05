import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Matrix,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';

async function createBestEngine(canvas) {
  if ('gpu' in navigator) {
    try {
      const { WebGPUEngine } = await import('@babylonjs/core/Engines/webgpuEngine.js');
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true });
      await engine.initAsync();
      return { engine, backend: 'WebGPU' };
    } catch (error) {
      console.warn('WebGPU unavailable; using WebGL2.', error);
    }
  }

  return {
    engine: new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }),
    backend: 'WebGL2',
  };
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

function createMaterial(scene, index, rgba) {
  const material = new StandardMaterial(`mj-material-${index}`, scene);
  material.diffuseColor = new Color3(rgba[0], rgba[1], rgba[2]);
  material.specularColor = new Color3(0.18, 0.18, 0.18);
  material.roughness = 0.72;
  material.alpha = rgba[3];
  material.transparencyMode = rgba[3] < 0.999 ? 2 : 0;
  return material;
}

function geometrySignature(geom) {
  return `${geom.type}:${Array.from(geom.size).map((value) => Number(value).toFixed(5)).join(',')}:${geom.dataid}`;
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
    this.scene.clearColor = new Color4(0.035, 0.045, 0.034, 1);
    this.scene.useRightHandedSystem = true;

    this.camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.12, 3.6, new Vector3(0, 0.36, 0), this.scene);
    this.camera.lowerRadiusLimit = 1.3;
    this.camera.upperRadiusLimit = 9;
    this.camera.wheelPrecision = 45;
    this.camera.pinchPrecision = 65;
    this.camera.attachControl(canvas, true);

    const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), this.scene);
    sky.intensity = 1.1;
    sky.diffuse = new Color3(0.82, 0.86, 0.80);
    sky.groundColor = new Color3(0.08, 0.10, 0.07);

    const key = new DirectionalLight('key', new Vector3(-0.4, -1, 0.3), this.scene);
    key.position = new Vector3(3, 6, -4);
    key.intensity = 2.3;
    key.diffuse = new Color3(1.0, 0.86, 0.67);

    const module = runtime.mujoco;
    this.option = new module.MjvOption();
    this.perturb = new module.MjvPerturb();
    this.mjCamera = new module.MjvCamera();
    this.mjScene = new module.MjvScene(runtime.model, 4096);
    this.meshes = [];
    this.signatures = [];

    window.addEventListener('resize', () => this.engine.resize());
  }

  createMesh(index, geom) {
    const size = geom.size;
    const type = geom.type;
    const enumType = this.runtime.mujoco.mjtGeom;
    let mesh;

    if (type === enumType.mjGEOM_PLANE.value) {
      mesh = MeshBuilder.CreateGround(`mj-geom-${index}`, { width: 24, height: 24, subdivisions: 1 }, this.scene);
    } else if (type === enumType.mjGEOM_SPHERE.value) {
      mesh = MeshBuilder.CreateSphere(`mj-geom-${index}`, { diameter: size[0] * 2, segments: 20 }, this.scene);
    } else if (type === enumType.mjGEOM_CAPSULE.value) {
      mesh = MeshBuilder.CreateCapsule(`mj-geom-${index}`, {
        radius: size[0],
        height: size[2] * 2 + size[0] * 2,
        tessellation: 16,
        subdivisions: 2,
      }, this.scene);
    } else if (type === enumType.mjGEOM_BOX.value) {
      mesh = MeshBuilder.CreateBox(`mj-geom-${index}`, {
        width: size[0] * 2,
        depth: size[1] * 2,
        height: size[2] * 2,
      }, this.scene);
    } else if (type === enumType.mjGEOM_CYLINDER.value) {
      mesh = MeshBuilder.CreateCylinder(`mj-geom-${index}`, {
        diameter: size[0] * 2,
        height: size[2] * 2,
        tessellation: 20,
      }, this.scene);
    } else if (type === enumType.mjGEOM_ELLIPSOID.value) {
      mesh = MeshBuilder.CreateSphere(`mj-geom-${index}`, { diameter: 2, segments: 20 }, this.scene);
      mesh.scaling.set(size[0], size[2], size[1]);
    } else {
      mesh = MeshBuilder.CreateBox(`mj-unsupported-${index}`, { size: 0.03 }, this.scene);
      mesh.isVisible = false;
    }

    mesh.material = createMaterial(this.scene, index, geom.rgba);
    mesh.receiveShadows = true;
    return mesh;
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
        this.meshes[index]?.dispose(false, true);
        this.meshes[index] = this.createMesh(index, geom);
        this.signatures[index] = signature;
      }

      const mesh = this.meshes[index];
      mesh.position.set(geom.pos[0], geom.pos[2], -geom.pos[1]);
      mesh.rotationQuaternion = mujocoRotationToBabylon(geom.mat);

      if (mesh.material) {
        mesh.material.diffuseColor.set(geom.rgba[0], geom.rgba[1], geom.rgba[2]);
        mesh.material.alpha = geom.rgba[3];
      }
      geom.delete();
    }

    while (this.meshes.length > count) {
      this.meshes.pop()?.dispose(false, true);
      this.signatures.pop();
    }
    geoms.delete();
  }

  render() {
    this.scene.render();
  }

  dispose() {
    this.meshes.forEach((mesh) => mesh.dispose(false, true));
    this.mjScene?.delete?.();
    this.mjCamera?.delete?.();
    this.perturb?.delete?.();
    this.option?.delete?.();
    this.scene.dispose();
    this.engine.dispose();
  }
}
