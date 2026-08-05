from pathlib import Path

TARGET = Path("nexus-glass-science-cube/index.html")


def main() -> None:
    source = TARGET.read_text(encoding="utf-8")
    replacements = {
        './manifest.webmanifest?v=3': './manifest.webmanifest?v=4',
        './style.css?v=3': './style.css?v=4',
        './main.js?v=3': './main.js?v=4',
    }
    for old, new in replacements.items():
        if old in source:
            source = source.replace(old, new)
        elif new not in source:
            raise RuntimeError(f"Missing page version marker: {old}")
    TARGET.write_text(source, encoding="utf-8")
    print("Updated NEXUS page asset versions to V4")


if __name__ == "__main__":
    main()
