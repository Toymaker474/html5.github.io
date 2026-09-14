# SuperAgent Native — iOS

A native iPhone agent workstation with **zero HTML, zero JavaScript, zero WebView, and zero `run_js`**.

The app is built as a real iOS executable and combines several native languages/runtimes instead of forcing everything through Swift or browser code.

## Native stack

- **Swift + SwiftUI** — iOS UI, agent orchestration, Files integration and Apple frameworks
- **LiteRT-LM** — local Gemma inference with automatic native tool calling
- **Objective-C++** — bridge between Swift and compiled C/C++ engines
- **C++20** — deterministic N-body simulation, A* pathfinding and bounded numeric VM
- **C11** — CRC-32, byte histograms and Shannon entropy
- **Rust** — compiled static library/XCFramework with FFI math/hash/PRNG kernels
- **Metal Shading Language** — native GPU vector and particle compute
- **Accelerate/vDSP** — Apple vector/signal math and audio DSP
- **SQLite3 C API** — persistent local database
- **Vision** — OCR, image classification and QR/barcode recognition
- **Core ML** — imported native model inspection and future specialist-model execution
- **Core Motion** — sensors
- **Core Image** — QR generation
- **CryptoKit** — hashing
- **NaturalLanguage** — language recognition, tokenization and on-device embeddings
- **PDFKit** — PDF text extraction
- **AVFoundation** — native audio inspection/DSP input
- **URLSession** — bounded native HTTPS retrieval
- **App Intents** — Siri/Shortcuts access to native self-test and stack inspection

There is no browser runtime in this project.

## Agent tools

Gemma gets real function tools through LiteRT-LM `automaticToolCalling`.

Current tool families include device/runtime inspection, persistent memory, sandboxed files, OCR, QR generation, sensors, native Metal compute, C++ simulations, a bounded C++ numeric VM, C byte analysis, Rust FFI kernels, Accelerate math, NaturalLanguage embeddings, PDF extraction, audio DSP, Vision classification/barcodes, Core ML model inspection, bounded HTTPS retrieval, and persistent SQLite execute/query operations.

Important tool names include `native_self_test`, `native_stack_manifest`, `cpp_nbody`, `cpp_pathfind`, `native_numeric_vm`, `c_byte_analysis`, `rust_analyze`, `metal_particle_benchmark`, `accelerate_signal_stats`, `sentence_embedding_distance`, `word_embedding_neighbors`, `vision_classify_image`, `vision_detect_barcodes`, `coreml_model_info`, `audio_dsp_analyze`, `pdf_extract`, `https_get`, `sqlite_execute`, and `sqlite_query`.

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

That command builds the Rust device + simulator libraries, packages them as `NativeRustCore/SuperAgentRust.xcframework`, runs XcodeGen, and creates `SuperAgentNative.xcodeproj`.

Then open the project in Xcode, choose your Apple Development Team, and build to the iPhone or archive for TestFlight.

## CI verification

`.github/workflows/superagent-native-ios.yml` performs an unsigned iOS Simulator smoke build on macOS whenever this native project changes. It builds the Rust XCFramework first, generates the Xcode project, resolves LiteRT-LM, compiles the full native app, and uploads the Xcode build log.

## Safety boundary

This project deliberately does **not** expose arbitrary shell access, unrestricted filesystem access, credential extraction, or downloaded native-code execution. Tool access stays inside the app sandbox. The agent can create files, query its SQLite database, execute the bounded numeric VM, invoke compiled engines shipped with the app, and make bounded HTTPS GET requests.

That gives it real execution without turning the iPhone into an unrestricted process launcher.
