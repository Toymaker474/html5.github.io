# Edge SuperLab 2

A local AI workstation/capability-lab skill for Google AI Edge Gallery on iPhone/iPad/Android.

## Install

AI Edge Gallery → Agent Skills → Skills → + → Load skill from URL:

`https://toymaker474.github.io/html5.github.io/edge-superlab/`

## Main commands

- `/selftest` — actual runtime probes for JS, WASM, storage, workers, WebCrypto and more.
- `/lab` — interactive iPhone/WebView capability lab.
- `/tools` — large local utility library: text/JSON/CSV, encoders, regex, number stats, SHA-256, file hashes, compression, QR and image processing.
- `/python` or `/studio` — full CPython/Pyodide workbench.
- `/packages` — library packs available to Python Studio.
- `/py <request>` — asks the AI to create a runnable Python program, store it in the local program library, open Python Studio and run it.
- `/programs` — list saved Python programs.
- `/gpu` — WebGPU/WGSL particle demo where available, typed-array CPU fallback otherwise.
- `/wasm` — execute a real WebAssembly module.
- `/bench` — JS/WASM benchmark.
- `/qr <text>` — generate a QR image.
- `/hash <text>` — SHA-256.
- `/remember ...` / `/recall ...` — skill-local persistent memory.
- `/limits` — explain the execution boundary.

## Python Studio

Python Studio loads Pyodide 314.0.6: real CPython compiled to WebAssembly. It is not a native iOS Python process. The studio now includes:

- Saved-program library and auto-run support for AI-created scripts.
- Import/export `.py` files.
- Mount local user files into `/home/pyodide/` for a session.
- Automatic `loadPackagesFromImports` dependency loading.
- `micropip` install field for compatible Python wheels.
- Automatic display of `/tmp/edge_plot.png` produced by Matplotlib/Pillow/etc.
- Built-in examples for numerical chaos, NumPy Monte Carlo, pandas, SymPy, NetworkX, scikit-learn, SciPy optimization and Matplotlib fractals.

### Library packs

- Core: NumPy, SciPy, pandas, Matplotlib
- Symbolic: SymPy
- ML: scikit-learn
- Vision: Pillow, OpenCV, scikit-image, imageio
- Graphs: NetworkX
- Science: Astropy, statsmodels
- Data: Polars, PyArrow, pandas
- Optimization: NLopt, HiGHS, SciPy
- NLP: NLTK, regex

Many other packages built for Pyodide are possible, and pure-Python wheels can often be installed using micropip.

## Tool Library

The interactive toolbox is intentionally broader than simulation. It includes local text statistics, JSON pretty/minify, Base64, URL encoding, UTF-8/hex conversion, CSV inspection, number statistics, regex matches, SHA-256, UUIDs, local-file SHA-256, gzip/compression probes, QR generation, and local image grayscale/invert/threshold processing.

## Execution boundary

A downloaded Edge Gallery skill can run JavaScript/Web APIs exposed by its WebView and WebAssembly. Python works because CPython is compiled to WASM. A normal downloaded skill does **not** get an arbitrary native shell, unrestricted filesystem/process control, or arbitrary Swift/C++/Metal execution. Native intents must already be implemented by the Edge Gallery host app. A custom LiteRT-LM iOS app can expose much more native functionality because you control the host.