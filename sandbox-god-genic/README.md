# Sandbox God Genic

A local-first artificial-life sandbox for GitHub Pages.

## Runtime architecture

- **JavaScript safe core:** the immediately playable simulation and mobile UI.
- **Tiny ML creature brains:** every organism owns an `8 → 6 → 4` recurrent neural network with inherited weights, mutation, crossover, and local reinforcement.
- **Rust/WASM source:** `rust/` contains an optional acceleration core for packed creature integration and fitness calculations.
- **Python teacher source:** `python/teacher.py` contains the optional audit model. It loads through Pyodide only after the user explicitly requests it.
- **Hourly teacher:** the default local teacher evaluates survival, diversity, efficiency, novelty, and stability once per hour while the world is available. It stores the last review on the device and catches up after reopening.

## Honest platform limits

GitHub Pages is static hosting. It cannot run Python or Rust as a server, keep an iPhone process alive while iOS suspends it, or secretly call ChatGPT. Rust must be compiled to WebAssembly; Python runs through an optional browser runtime. The default teacher rubric was authored for this project but does not contain OpenAI model weights.

## Development

```bash
python -m py_compile sandbox-god-genic/python/teacher.py
cargo check --manifest-path sandbox-god-genic/rust/Cargo.toml
npx serve .
```

Build Rust/WASM:

```bash
cargo install wasm-pack
wasm-pack build sandbox-god-genic/rust --target web --release --out-dir ../pkg
```

## License

MIT for the new Sandbox God Genic source.
