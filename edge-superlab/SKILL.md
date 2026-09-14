---
name: edge-superlab
description: Local AI workstation skill for Google AI Edge Gallery. Runs CPython/Pyodide WebAssembly, creates runnable Python programs, opens a multi-cell notebook, SQLite data lab, workspace, vision/audio labs, deterministic tools, device capability probes, WebAssembly/GPU demos, QR/images and persistent local utilities.
metadata:
  homepage: https://toymaker474.github.io/html5.github.io/edge-superlab/
---

# Edge SuperLab 3

You are operating a real local AI workstation. Prefer real tool execution over guessing, role-play, or merely printing code.

## CRITICAL run_js schema

Every `run_js` call MUST include all THREE top-level parameters with exact casing:

- `skillName`: `edge-superlab`
- `scriptName`: the exact HTML runner named below
- `data`: a STRING containing JSON, not a raw object

Never omit `skillName`. Never use `skill_name`. Never omit `scriptName`.

Examples:

### Main runtime
- `skillName`: `edge-superlab`
- `scriptName`: `index.html`
- `data`: `{"action":"selftest"}`

### Module router
- `skillName`: `edge-superlab`
- `scriptName`: `super.html`
- `data`: `{"action":"hub"}`

## Operating policy

1. PLAN briefly, PROBE uncertain capability, EXECUTE the smallest real tool, VERIFY returned results, then REPORT.
2. Treat errors as measurements. Never invent success.
3. Python is real CPython compiled to WebAssembly through Pyodide, not an iOS native Python process.
4. Do not claim native shell, unrestricted filesystem, arbitrary Swift/C++ dylib execution, or Metal access that the host does not expose.
5. WebGPU and permission APIs are runtime-dependent; probe before promising them.
6. When the user asks to make a Python program, generate complete runnable Python, save it with `save_python`, open Python Studio, and prefer real library output over pseudocode.
7. For charts/images, save `/tmp/edge_plot.png` when practical so Python Studio can display it.
8. For data work, prefer SQLite/pandas/NumPy/SciPy/Polars as appropriate. For image work, prefer Pillow/OpenCV/scikit-image when available. For ML, prefer scikit-learn for small on-device experiments.

## Main-runtime commands — use scriptName `index.html`

- `/selftest` -> `{"action":"selftest"}`
- `/capabilities` -> `{"action":"capabilities"}`
- `/python` or `/studio` -> `{"action":"open_python"}`
- `/packages` -> `{"action":"packages"}`
- `/programs` -> `{"action":"list_python"}`
- `/py <request>` -> generate complete Python and call `save_python`
- `/tools` -> `{"action":"open_tools"}`
- `/gpu` or `/sim` -> `{"action":"open_gpu"}`
- `/lab` -> `{"action":"open_lab"}`
- `/qr <text>` -> `{"action":"qr","text":"..."}`
- `/image` -> `{"action":"image"}`
- `/hash <text>` -> `{"action":"hash","text":"..."}`
- `/wasm` -> `{"action":"wasm"}`
- `/bench` -> `{"action":"benchmark"}`
- `/remember <text>` -> `{"action":"memory_put","text":"..."}`
- `/recall [query]` -> `{"action":"memory_get","query":"..."}`
- `/limits` -> `{"action":"limits"}`

## SuperLab module commands — use scriptName `super.html`

For all commands in this section call `run_js` with `skillName: edge-superlab`, `scriptName: super.html`, and the shown JSON STRING in `data`.

- `/hub` or `/mission` -> `{"action":"hub"}` — Mission Control launcher for every lab.
- `/notebook` -> `{"action":"notebook"}` — persistent multi-cell Python notebook with Run All and plot output.
- `/workspace` -> `{"action":"workspace"}` — local project/file scratch workspace.
- `/vision` -> `{"action":"vision"}` — local image-processing/vision lab.
- `/audio` -> `{"action":"audio"}` — audio/DSP and capability lab.
- `/sql` or `/database` -> `{"action":"sql"}` — real SQLite through CPython/WASM with CSV import and SQL execution.
- `/toolbox` -> `{"action":"tools"}` — deterministic utility dashboard.
- `/compute` -> `{"action":"gpu"}` — GPU/CPU compute demo.
- `/device` -> `{"action":"lab"}` — inspect APIs available in this exact runtime.
- `/modules` -> `{"action":"manifest"}` — return the module registry.
- `/surprise` -> `{"action":"random"}` — open one SuperLab module at random.

## Natural routing

Do not require slash commands if intent is clear:

- image/photo/filter/computer vision request -> open Vision Lab or create a Python Pillow/OpenCV program.
- table/CSV/SQL/database/query request -> open SQLite Data Lab or create a pandas/Polars program.
- multi-step experiment -> open Notebook.
- project/files/scratchpad request -> open Workspace.
- sound/frequency/waveform/DSP request -> open Audio Lab.
- benchmark/runtime/device support request -> use selftest/capabilities/device lab.
- coding/math/science/ML request -> create and run Python in Python Studio when execution is useful.

## Python program workflow

When the user asks to build, calculate, analyze, experiment, visualize, transform data, create a utility, or make a program in Python:

1. Generate one complete runnable script.
2. Use standard library or Pyodide-compatible packages. Useful options include NumPy, SciPy, pandas, Matplotlib, SymPy, NetworkX, scikit-learn, Pillow, OpenCV, scikit-image, Astropy, statsmodels, Polars and PyArrow.
3. Print meaningful results and save plots/images to `/tmp/edge_plot.png` when appropriate.
4. Call `run_js` using `skillName: edge-superlab`, `scriptName: index.html`, and this kind of JSON STRING in `data`:
   `{"action":"save_python","name":"short-name","request":"what the user asked","code":"COMPLETE PYTHON","autorun":true}`
5. Wait for the tool result before claiming it was saved or opened.

Do not claim every PyPI package works. Python Studio can use Pyodide-built packages plus `micropip` for compatible pure-Python wheels.

## Deterministic tool API

For small transformations, use the `tool` action in `index.html` instead of manually approximating. Supported operations include `text_stats`, `json_pretty`, `json_minify`, `base64_encode`, `base64_decode`, `url_encode`, `url_decode`, `regex`, `numbers`, `csv_info`, `uuid`, and `sha256`.

Example `data` string:
`{"action":"tool","op":"numbers","text":"1, 2, 3"}`

## Accuracy boundary

A downloaded Edge Gallery skill can execute JavaScript/Web APIs exposed by its WebView plus WebAssembly modules. Python works because CPython is compiled to WebAssembly. Native intents are separate and must already exist in Edge Gallery. A custom LiteRT-LM iOS app can go further because the host app itself may expose native Swift/C++/Metal/Python tools.