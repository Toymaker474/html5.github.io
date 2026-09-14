# SuperAgent Native — iOS

A native iPhone agent workstation with **zero HTML, zero JavaScript, zero WebView, and zero `run_js`**.

The app is built as a real iOS executable and combines several native languages/runtimes instead of forcing everything through Swift or web code.

## Native stack

- **Swift + SwiftUI** — iOS UI, agent orchestration, Files integration and Apple frameworks
- **LiteRT-LM** — local Gemma inference with automatic native tool calling
- **Objective-C++** — bridge between Swift and compiled C/C++ engines
- **C++20** — deterministic simulation, A* pathfinding and bounded numeric VM
- **C11** — CRC-32, byte histograms and Shannon entropy
- **Rust** — compiled static library/XCFramework with FFI math/hash/PRNG kernels
- **Metal Shading Language** — native GPU compute
- **Accelerate/vDSP** — Apple vector/signal math
- **SQLite3 C API** — persistent local database
- **Vision** — OCR
- **Core Motion** — sensors
- **Core Image** — QR generation
- **CryptoKit** — hashing
- **NaturalLanguage** — language recognition/tokenization
- **PDFKit** — PDF text extraction
- **AVFoundation** — native audio-file inspection

There is no browser runtime in this project.

## Agent tools

Gemma gets real function tools through LiteRT-LM `automaticToolCalling`.

Core tools include:

- `device_info`
- `statistics`
- `sha256`
- `remember` / `recall`
- `list_files`
- `read_text_file` / `write_text_file`
- `ocr_image`
- `create_qr`
- `motion_sample`
- `metal_vector_benchmark`
- `native_stack_manifest`
- `native_self_test`
- `cpp_nbody`
- `cpp_pathfind`
- `native_numeric_vm`
- `c_byte_analysis`
- `rust_analyze`
- `accelerate_signal_stats`
- `natural_language_analyze`
- `pdf_extract`
- `audio_info`
- `sqlite_execute`
- `sqlite_query`

The bounded C++ VM gives the model a programmable execution surface without downloading arbitrary native executable code. Its instruction set is intentionally small and deterministic.

## Model

Use a `.litertlm` model in the iOS Files app. Inside SuperAgent Native choose **Import → Import LiteRT-LM Model**. The app copies the model into Application Support and initializes LiteRT-LM using the GPU backend.

The intended model is Gemma 4 E2B LiteRT-LM, but the app is not hard-coded to one model filename.

## Build

A native iOS app must be compiled and signed. It cannot be installed from a GitHub Pages URL like an Edge Gallery skill.

Requirements:

- macOS + Xcode
- XcodeGen
- Rust toolchain (`rustup` + `cargo`)

From this folder:

```sh
sh build-native.sh
```

That command:

1. builds the Rust device + simulator static libraries,
2. packages them as `NativeRustCore/SuperAgentRust.xcframework`,
3. runs XcodeGen,
4. creates `SuperAgentNative.xcodeproj`.

Then open the project in Xcode, choose your Apple Development Team, and build to the iPhone or archive for TestFlight.

## CI verification

`.github/workflows/superagent-native-ios.yml` performs an unsigned iOS Simulator smoke build on macOS whenever this native project changes. It also uploads the Xcode build log for debugging.

## Safety boundary

This project deliberately does **not** expose arbitrary shell access, unrestricted filesystem access, credential extraction, or downloaded native-code execution. Tool access stays inside the app sandbox. The agent can create files, query its SQLite database, execute the bounded numeric VM, and invoke compiled tools shipped with the app.

That gives it real execution without turning the iPhone into an unrestricted process launcher.
