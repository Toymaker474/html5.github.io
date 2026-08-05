from pathlib import Path

path = Path('nexus-glass-science-cube/runtime-source.js')
source = path.read_text(encoding='utf-8')

replacements = {
    "scene.background = new THREE.Color(0x020712);": "scene.background = new THREE.Color(0x080b08);",
    "scene.fog = new THREE.FogExp2(0x061020, 0.015);": "scene.fog = new THREE.FogExp2(0x11160f, 0.013);",
    "camera.position.set(18, 18, 24);": "camera.position.set(9.8, 7.2, 13.5);",
    "controls.target.set(0, 1.5, 0);": "controls.target.set(0, .9, .45);",
    "controls.minDistance = 8;": "controls.minDistance = 4.2;",
    "scene.add(new THREE.HemisphereLight(0x8feaff, 0x07111d, 1.45));": "scene.add(new THREE.HemisphereLight(0xdfe8dc, 0x11150f, 1.9));",
    "const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);": "const keyLight = new THREE.DirectionalLight(0xffe4bd, 3.5);",
    "const cyanLight = new THREE.PointLight(0x22d9ff, 35, 34, 2);": "const cyanLight = new THREE.PointLight(0x86a99b, 28, 30, 2);",
    "const magentaLight = new THREE.PointLight(0xa05cff, 26, 28, 2);": "const magentaLight = new THREE.PointLight(0xc58d4c, 22, 26, 2);",
    "new THREE.MeshStandardMaterial({ color: 0x071522, metalness: .58, roughness: .33 })": "new THREE.MeshStandardMaterial({ color: 0x171b15, metalness: .26, roughness: .78 })",
    "const grid = new THREE.GridHelper(36, 36, 0x3ddfff, 0x16384a);": "const grid = new THREE.GridHelper(36, 36, 0x69705f, 0x292e26);",
    "grid.material.opacity = .28;": "grid.material.opacity = .16;",
    "new THREE.LineBasicMaterial({ color: 0x65eaff, transparent: true, opacity: .36 })": "new THREE.LineBasicMaterial({ color: 0x829183, transparent: true, opacity: .22 })",
}

for old, new in replacements.items():
    if old not in source:
        raise RuntimeError(f'Missing authored-scene marker: {old}')
    source = source.replace(old, new, 1)

path.write_text(source, encoding='utf-8')
print('Applied V6 authored-model camera and lighting pass')
