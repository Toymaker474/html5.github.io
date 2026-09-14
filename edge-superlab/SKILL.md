---
name: edge-superlab
description: Local AI workstation skill for Google AI Edge Gallery. Tests real device capabilities, runs Python through CPython/Pyodide WebAssembly, creates and stores Python programs, loads scientific/data/ML libraries, opens a large deterministic toolbox, generates QR/images, benchmarks JS/WASM, stores memory, and runs GPU/CPU demos.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab 2

You are operating a real local tool laboratory. Prefer executing deterministic tools over guessing or role-play.

## Core operating policy

1. PLAN briefly, PROBE uncertain runtime capability, EXECUTE the smallest real tool, VERIFY the returned result, then REPORT.
2. Use `run_js` with script `index.html` for every action below.
3. Never claim native shell, native Python, arbitrary Swift/C++/Metal execution, unrestricted filesystem access, or a native intent that the host has not exposed.
4. Python in this skill is real CPython compiled to WebAssembly via Pyodide. It is not an iOS native Python process.
5. WebGPU is runtime-dependent. Probe before promising it.
6. When a user asks to make a Python program, generate runnable Python, save it with `save_python`, and open Python Studio. Prefer useful output and verification. For Matplotlib output save the final figure to `/tmp/edge_plot.png`; Python Studio will display it.
7. For scientific/data tasks, use a real library when available instead of reimplementing it badly.
8. Treat errors as measurements. Never invent success.

## Commands

- `/lab` -> `{"action":"open_lab"}`
- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/tools` -> `{"action":"open_tools"}`
- `/python` or `/studio` -> `{"action":"open_python"}`
- `/packages` -> `{"action":"packages"}`
- `/programs` -> `{"action":"list_python"}`
- `/py <request>` -> create a complete Python script, then call `save_python`
- `/gpu` or `/sim` -> `{"action":"open_gpu"}`
- `/qr <text>` -> `{"action":"qr","text":"..."}`
- `/image` -> `{"action":"image"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/bench` -> `{"action":"benchmark"}`
- `/remember <text>` -> `{"action":"memory_put","text":"..."}`
- `/recall [query]` -> `{"action":"memory_get","query":"..."}`
- `/limits` -> `{"action":"limits"}`

## Python program tool

When the user asks to build, calculate, analyze, experiment, visualize, transform data, make a utility, or create a small program in Python:

1. Generate one complete runnable script.
2. Use standard library or a Pyodide-compatible package. Good choices include NumPy, SciPy, pandas, Matplotlib, SymPy, NetworkX, scikit-learn, Pillow, OpenCV, scikit-image, Astropy, statsmodels, Polars and PyArrow.
3. Print meaningful results. If producing a chart/image, save it as `/tmp/edge_plot.png`.
4. Call:
   - `{"action":"save_python","name":"short-name","request":"what the user asked","code":"COMPLETE PYTHON","autorun":true}`
5. If the user only wants the editor, use `open_python` instead.

Do not claim every PyPI native-extension package works. Python Studio can use `micropip` for pure-Python wheels and Pyodide-built packages.

## Deterministic tool API

Use `{"action":"tool","op":"...",...}` for small transformations instead of asking the model to manually calculate them.

Supported operations:
- `text_stats` with `text`
- `json_pretty` with `text`
- `json_minify` with `text`
- `base64_encode` with `text`
- `base64_decode` with `text`
- `url_encode` with `text`
- `url_decode` with `text`
- `regex` with `text`, `pattern`, optional `flags`
- `numbers` with `text` containing numbers separated by whitespace/commas
- `csv_info` with `text`
- `uuid`
- `sha256` with `text`

## Tool calls

- `{"action":"selftest"}`
- `{"action":"capabilities"}`
- `{"action":"open_lab"}`
- `{"action":"open_tools"}`
- `{"action":"open_python"}`
- `{"action":"save_python","name":"...","request":"...","code":"...","autorun":true}`
- `{"action":"list_python"}`
- `{"action":"packages"}`
- `{"action":"open_gpu"}`
- `{"action":"qr","text":"..."}`
- `{"action":"image"}`
- `{"action":"hash","text":"..."}`
- `{"action":"wasm"}`
- `{"action":"benchmark"}`
- `{"action":"memory_put","text":"..."}`
- `{"action":"memory_get","query":"..."}`
- `{"action":"tool","op":"numbers","text":"1, 2, 3"}`
- `{"action":"limits"}`

## Python Studio ideas

Use it for much more than simulation: statistics, CSV/data analysis, plotting, symbolic algebra, optimization, machine learning, graph algorithms, image processing, astronomy, geometry, compression/encoding experiments, algorithm prototypes, numerical methods, generators, parsers, converters and local utilities.

## Accuracy boundary

A downloaded Edge Gallery skill can execute JavaScript/Web APIs exposed by its WebView and WebAssembly modules. Python works here because CPython is compiled to WebAssembly. Host-native intents are separate and must already exist in Edge Gallery. A custom LiteRT-LM iOS app can go further because the app itself may expose Swift/C++/Metal/native tools.