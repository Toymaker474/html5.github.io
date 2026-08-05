from pathlib import Path

path = Path('nexus-glass-science-cube/runtime-source.js')
source = path.read_text(encoding='utf-8')

replacements = {
    "camera.position.set(11.5, 8.4, 15.5);": "camera.position.set(9.4, 6.6, 12.8);",
    "controls.target.set(0, .95, .35);": "controls.target.set(0, .82, .45);",
    "scout: { body: [1.28, .58, 1.72], head: [.55, .38, .62], abdomen: [.82, .52, .88], posture: .62, gait: 1.08 },": "scout: { body: [.78, .34, 1.05], head: [.34, .23, .40], abdomen: [.48, .32, .55], posture: .92, gait: 1.08 },",
    "constructor: { body: [1.58, .72, 1.92], head: [.62, .42, .68], abdomen: [1.02, .72, 1.12], posture: .74, gait: .82 },": "constructor: { body: [.92, .40, 1.12], head: [.38, .25, .44], abdomen: [.58, .40, .62], posture: 1.02, gait: .82 },",
    "medic: { body: [1.40, .62, 1.78], head: [.62, .40, .68], abdomen: [.88, .60, .96], posture: .68, gait: .96 },": "medic: { body: [.82, .35, 1.05], head: [.36, .24, .42], abdomen: [.50, .35, .58], posture: .98, gait: .96 },",
    "sentinel: { body: [1.48, .68, 1.88], head: [.66, .42, .72], abdomen: [.84, .58, .94], posture: .74, gait: 1.12 },": "sentinel: { body: [.88, .38, 1.10], head: [.40, .25, .46], abdomen: [.50, .35, .56], posture: 1.06, gait: 1.12 },",
    "hauler: { body: [1.72, .76, 2.10], head: [.58, .38, .64], abdomen: [1.18, .82, 1.30], posture: .72, gait: .76 }": "hauler: { body: [1.02, .43, 1.25], head: [.35, .23, .42], abdomen: [.70, .48, .78], posture: 1.00, gait: .76 }",
    "coxa.add(organismBone(.38, .085, .11, materials.frame));": "coxa.add(organismBone(.52, .075, .105, materials.frame));",
    "femur.position.y = -.38;": "femur.position.y = -.52;",
    "const femurLength = .47 + (index % 2) * .06;": "const femurLength = .68 + (index % 2) * .07;",
    "const tibiaLength = .45 + ((index + 1) % 2) * .05;": "const tibiaLength = .62 + ((index + 1) % 2) * .06;",
    "const foot = organismEllipsoid([.16, .065, .29], materials.pad, 14);": "const foot = organismEllipsoid([.18, .055, .34], materials.pad, 14);",
    "const thorax = organismEllipsoid(profile.body, materials.shell, 28);": "const thorax = organismEllipsoid(profile.body, materials.tissue, 28);",
    "const underside = organismEllipsoid([profile.body[0] * .70, profile.body[1] * .55, profile.body[2] * .76], materials.tissue, 22);": "const underside = organismEllipsoid([profile.body[0] * .66, profile.body[1] * .48, profile.body[2] * .74], materials.frame, 22);",
    "const plate = organismEllipsoid([profile.body[0] * (.64 - index * .06), .095, .30], index % 2 ? materials.ceramic : materials.shell, 16);": "const plate = organismEllipsoid([profile.body[0] * (.92 - index * .07), profile.body[1] * .34, profile.body[2] * .20], index % 2 ? materials.ceramic : materials.shell, 18);",
    "plate.position.set(0, profile.posture + profile.body[1] * .92, -.48 + index * .34);": "plate.position.set(0, profile.posture + profile.body[1] * .56, -profile.body[2] * .48 + index * profile.body[2] * .32);",
    "medic.parts.wheel = 4;\n  medic.parts.leg = 0;": "medic.parts.wheel = 0;\n  medic.parts.leg = 4;",
    "spawnRobot(constructor, { x: 1.4, y: 1.2, z: 3.4 });": "spawnRobot(constructor, { x: 3.0, y: 1.2, z: 3.8 });",
    "spawnRobot(medic, { x: -1.5, y: 1.2, z: 3.1 });": "spawnRobot(medic, { x: -3.1, y: 1.2, z: 3.2 });",
    "spawnRobot(sentinel, { x: 0, y: 1.2, z: -3.4 });": "spawnRobot(sentinel, { x: .2, y: 1.2, z: -4.8 });",
}

for old, new in replacements.items():
    if old not in source:
        raise RuntimeError(f'Missing V5 refinement marker: {old[:90]}')
    source = source.replace(old, new, 1)

path.write_text(source, encoding='utf-8')
print('Refined V5 machine-organism anatomy and presentation')
