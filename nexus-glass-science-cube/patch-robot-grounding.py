from pathlib import Path

TARGET = Path("nexus-glass-science-cube/runtime-source.js")


def replace_required(source: str, old: str, new: str) -> str:
    if old not in source:
        if new in source:
            return source
        raise RuntimeError(f"Missing grounding marker: {old}")
    return source.replace(old, new, 1)


def main() -> None:
    source = TARGET.read_text(encoding="utf-8")
    source = replace_required(
        source,
        "suspension.position.set(side * .82, .42, z);",
        "suspension.position.set(side * .82, .29, z);",
    )
    source = replace_required(
        source,
        "hip.position.set(side * .72, .66, z);",
        "hip.position.set(side * .72, 1.08, z);",
    )
    source = replace_required(
        source,
        "return { root: hip, upper, knee, ankle, foot, phase, side, z };",
        "return { root: hip, upper, knee, ankle, foot, phase, side, z, baseY: 1.08 };",
    )
    source = replace_required(
        source,
        "leg.root.position.y = .66 + lift * .045 - rig.disabledTilt * .16;",
        "leg.root.position.y = leg.baseY + lift * .045 - rig.disabledTilt * .16;",
    )
    TARGET.write_text(source, encoding="utf-8")
    print("Grounded NEXUS wheel suspension and articulated feet")


if __name__ == "__main__":
    main()
