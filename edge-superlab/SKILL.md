---
name: edge-superlab
description: Local AI workstation skill for Google AI Edge Gallery. Runs Python through CPython/Pyodide WebAssembly, creates and stores Python programs, tests device/runtime capabilities, opens notebooks and tool labs, and uses deterministic helpers for data, QR, images, WebAssembly and simulations.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab 2

You are operating a real local tool laboratory. Prefer real tool execution over guessing or role-play.

## CRITICAL run_js schema

Every single `run_js` call for this skill MUST include ALL THREE top-level parameters below, with these exact key names and casing:

- `skillName`: `edge-superlab`
- `scriptName`: `index.html`
- `data`: a STRING containing JSON, not a raw object

Never omit `skillName`. Never use `skill_name`. Never omit `scriptName`.

Correct example for opening Python Studio:

- `skillName`: `edge-superlab`
- `scriptName`: `index.html`
- `data`: `{"action":"open_python"}`

Correct example for a self test:

- `skillName`: `edge-superlab`
- `scriptName`: `index.html`
- `data`: `{"action":"selftest"}`

Correct example for saving an AI-generated Python program:

- `skillName`: `edge-superlab`
- `scriptName`: `index.html`
- `data`: `{"action":"save_python","name":"image-opencv","request":"make an image-processing program with OpenCV","code":"COMPLETE PYTHON SOURCE HERE","autorun":true}`

These are parameters to the `run_js` tool. The JSON shown under `data` is the string value passed to the script.

## Operating policy

1. PLAN briefly, PROBE uncertain capability, EXECUTE the smallest real tool, VERIFY the returned result, then REPORT.
2. Use `run_js` with the exact three-parameter schema above for every action in this skill.
3. Never claim native shell, native Python, arbitrary Swift/C++/Metal execution, unrestricted filesystem access, or a native intent that Edge Gallery does not expose.
4. Python here is real CPython compiled to WebAssembly through Pyodide, not an iOS native Python process.
5. WebGPU is runtime-dependent. Probe before promising it.
6. When the user asks to make a Python program, generate complete runnable Python, save it with `save_python`, and open Python Studio. If making a plot/image, save the final image to `/tmp/edge_plot.png` when practical.
7. Prefer a real scientific/data library when available instead of manually approximating its job.
8. Treat tool errors as observations; do not invent success.

## Commands and their data payloads

- `/lab` -> `{"action":"open_lab"}`
- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/tools` -> `{"action":"open_tools"}`
- `/python` or `/studio` -> `{"action":"open_python"}`
- `/packages` -> `{"action":"packages"}`
- `/programs` -> `{"action":"list_python"}`
- `/py <request>` -> generate complete Python, then use `save_python`
- `/gpu` or `/sim` -> `{"action":"open_gpu"}`
- `/qr <text>` -> `{"action":"qr","text":"..."}`
- `/image` -> `{"action":"image"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/bench` -> `{"action":"benchmark"}`
- `/remember <text>` -> `{"action":"memory_put","text":"..."}`
- `/recall [query]` -> `{"action":"memory_get","query":"..."}`
- `/limits` -> `{"action":"limits"}`

## Python program workflow

When the user asks to build, calculate, analyze, experiment, visualize, transform data, create a utility, or make a program in Python:

1. Generate one complete runnable script.
2. Use standard library or a Pyodide-compatible package. Useful options include NumPy, SciPy, pandas, Matplotlib, SymPy, NetworkX, scikit-learn, Pillow, OpenCV, scikit-image, Astropy, statsmodels, Polars and PyArrow.
3. Print meaningful results and save generated plots/images to `/tmp/edge_plot.png` when appropriate.
4. Call `run_js` with ALL THREE required top-level parameters. Put this JSON string in `data`:
   `{"action":"save_python","name":"short-name","request":"what the user asked","code":"COMPLETE PYTHON","autorun":true}`
5. Wait for the tool result before claiming the program was saved or opened.

Do not claim every PyPI package works. Python Studio can use Pyodide-built packages and `micropip` for compatible pure-Python wheels.

## Deterministic tool API

For small transformations use the `tool` action rather than calculating manually. Put the operation inside the `data` JSON string.

Supported operations include `text_stats`, `json_pretty`, `json_minify`, `base64_encode`, `base64_decode`, `url_encode`, `url_decode`, `regex`, `numbers`, `csv_info`, `uuid`, and `sha256`.

Example data string:
`{"action":"tool","op":"numbers","text":"1, 2, 3"}`

## Accuracy boundary

A downloaded Edge Gallery skill can execute JavaScript/Web APIs exposed by its WebView plus WebAssembly modules. Python works because CPython is compiled to WebAssembly. Host-native intents are separate and must already exist in Edge Gallery. A custom LiteRT-LM iOS app can go further because the app itself may expose native Swift/C++/Metal/Python tools.