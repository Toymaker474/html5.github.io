from pathlib import Path

path = Path('nexus-glass-science-cube/runtime-source.js')
source = path.read_text(encoding='utf-8')

replacements = {
    "camera.position.set(9.8, 7.2, 13.5);": "camera.position.set(7.4, 4.8, 11.8);",
    "controls.target.set(0, .9, .45);": "controls.target.set(0, .72, 3.25);",
    "renderer.toneMappingExposure = 1.18;": "renderer.toneMappingExposure = 1.28;",
    "scene.add(new THREE.HemisphereLight(0xdfe8dc, 0x11150f, 1.9));": "scene.add(new THREE.HemisphereLight(0xe8eee5, 0x171a14, 2.8));",
    "const keyLight = new THREE.DirectionalLight(0xffe4bd, 3.5);": "const keyLight = new THREE.DirectionalLight(0xffe8c8, 4.4);",
    "const cyanLight = new THREE.PointLight(0x86a99b, 28, 30, 2);": "const cyanLight = new THREE.PointLight(0xa9c1b4, 38, 30, 2);",
    "const magentaLight = new THREE.PointLight(0xc58d4c, 22, 26, 2);": "const magentaLight = new THREE.PointLight(0xd0a15f, 30, 26, 2);",
    "new THREE.MeshStandardMaterial({ color: 0x171b15, metalness: .26, roughness: .78 })": "new THREE.MeshStandardMaterial({ color: 0x252a21, metalness: .18, roughness: .74 })",
    "const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.6, .55, 32), new THREE.MeshStandardMaterial({ color: 0x15293e, metalness: .8, roughness: .24 }));": "const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.65, .42, 32), new THREE.MeshStandardMaterial({ color: 0x22281f, metalness: .52, roughness: .55 }));",
    "pad.position.y = .28; pad.castShadow = true; group.add(pad);": "pad.position.y = .21; pad.castShadow = true; group.add(pad);",
    "const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), makeGlow(0x4befff, 3.5));": "const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.48, 2), new THREE.MeshStandardMaterial({ color: 0xc8b47e, emissive: 0x5c4522, emissiveIntensity: .75, metalness: .38, roughness: .28 }));",
    "core.position.y = 1.7; group.add(core); s.orb = core;": "core.position.y = .88; group.add(core); s.orb = core;",
    "const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, .09, 12, 48), makeGlow(0x7269ff, 2.7));": "const ring = new THREE.Mesh(new THREE.TorusGeometry(1.58, .055, 12, 48), new THREE.MeshStandardMaterial({ color: 0x71806f, emissive: 0x2e382d, emissiveIntensity: .42, metalness: .7, roughness: .34 }));",
    "ring.rotation.x = Math.PI / 2; ring.position.y = .65; group.add(ring);": "ring.rotation.x = Math.PI / 2; ring.position.y = .48; group.add(ring);",
    "s.body = body; s.collider = physics.createCollider(RAPIER.ColliderDesc.cylinder(.3, 3.3), body);": "s.body = body; s.collider = physics.createCollider(RAPIER.ColliderDesc.cylinder(.3, 2.55), body);",
    "spawnRobot(founderA, { x: 1, y: 1.2, z: 3 });": "spawnRobot(founderA, { x: -2.7, y: 1.2, z: 4.2 });",
    "spawnRobot(founderB, { x: -1, y: 1.2, z: 3 });": "spawnRobot(founderB, { x: 0, y: 1.2, z: 4.7 });",
    "spawnRobot(founderC, { x: 0, y: 1.2, z: -3 });": "spawnRobot(founderC, { x: 2.7, y: 1.2, z: 4.0 });\n  spawnRobot(founderD, { x: 0, y: 1.2, z: 6.4 });",
}

for old, new in replacements.items():
    if old not in source:
        raise RuntimeError(f'Missing V6 presentation marker: {old}')
    source = source.replace(old, new, 1)

clone_old = """    if (Array.isArray(object.material)) object.material = object.material.map(material => material.clone());
    else if (object.material) object.material = object.material.clone();"""
clone_new = """    if (Array.isArray(object.material)) object.material = object.material.map(material => material.clone());
    else if (object.material) object.material = object.material.clone();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach(material => {
      if (material.color) material.color.offsetHSL(0, -.04, .075);
      if ('roughness' in material) material.roughness = Math.max(.28, material.roughness * .86);
      if ('metalness' in material) material.metalness = Math.min(.82, Math.max(.34, material.metalness));
      if ('emissive' in material) {
        material.emissive.set(0x111610);
        material.emissiveIntensity = .28;
      }
    });"""
if clone_old not in source:
    raise RuntimeError('Missing authored material-clone marker')
source = source.replace(clone_old, clone_new, 1)

founder_marker = """  const founderC = structuredClone(DEFAULT_BLUEPRINT); founderC.parts.builder = 0; founderC.parts.weapon = 1; founderC.parts.cargo = 0; founderC.traits.aggression = .72;
"""
founder_insert = founder_marker + """  const founderD = structuredClone(DEFAULT_BLUEPRINT);
  founderD.name = 'EYE-SCOUT';
  founderD.parts.builder = 0;
  founderD.parts.repair = 0;
  founderD.parts.weapon = 0;
  founderD.parts.cargo = 0;
  founderD.parts.armor = 0;
  founderD.parts.wheel = 2;
  founderD.parts.leg = 0;
  founderD.parts.sensor = 3;
  founderD.traits.curiosity = .92;
  founderD.traits.caution = .58;
"""
if founder_marker not in source:
    raise RuntimeError('Missing founder insertion marker')
source = source.replace(founder_marker, founder_insert, 1)

light_marker = """magentaLight.position.set(10, 6, 9);
scene.add(magentaLight);
"""
light_insert = light_marker + """const frontFill = new THREE.DirectionalLight(0xdde7dc, 2.7);
frontFill.position.set(0, 5, 13);
scene.add(frontFill);
const lowFill = new THREE.PointLight(0xb99b6a, 18, 18, 2);
lowFill.position.set(0, 1.7, 6);
scene.add(lowFill);
"""
if light_marker not in source:
    raise RuntimeError('Missing front-fill light marker')
source = source.replace(light_marker, light_insert, 1)

path.write_text(source, encoding='utf-8')
print('Applied V6 authored robot presentation and founder staging pass')
