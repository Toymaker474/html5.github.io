# SuperAgent Native — iOS

A native iPhone agent workstation. **No HTML, no JavaScript, no WebView runtime.**

This project pivots away from downloadable Edge Gallery web skills and uses:

- Swift + SwiftUI for the app and tool layer
- Google LiteRT-LM for local Gemma inference and automatic native tool calling
- Metal for native GPU compute
- Vision for local OCR
- Core Motion for sensors
- Core Image for QR generation
- CryptoKit for hashing
- a sandboxed native workspace + persistent agent memory

## Why this exists

A stock downloadable AI Edge Gallery skill is intentionally sandboxed around `run_js`/WebView code and host-provided native intents. If the goal is **zero web code and real native execution**, the correct architecture is a standalone iOS app that owns the host process and exposes Swift tools directly to LiteRT-LM.

Google's current LiteRT-LM Swift package supports iOS and ships a native `CLiteRTLM.xcframework`. The Swift API supports GPU/CPU backends and native `Tool` objects that can be executed automatically during a conversation.

## Native tools included

The first native tool set gives Gemma real actions instead of fake/prompt-only tools:

- `device_info` — device/model/OS/storage/runtime facts
- `statistics` — deterministic native statistics
- `sha256` — CryptoKit hashing
- `remember` / `recall` — persistent local memory
- `list_files` — inspect the app's safe workspace
- `read_text_file` / `write_text_file` — create and edit sandboxed files
- `ocr_image` — Vision text recognition on an imported image
- `create_qr` — native Core Image QR PNG generation
- `motion_sample` — accelerometer/orientation sample through Core Motion
- `metal_vector_benchmark` — actual Metal compute kernel benchmark

The model gets these as LiteRT-LM native function tools with `automaticToolCalling: true`.

## Model

Import a `.litertlm` model from Files inside the app. The UI copies it into the app's Application Support directory and initializes LiteRT-LM on the GPU.

The intended model is the LiteRT-LM Gemma 4 E2B bundle, but the app is not hard-coded to one filename.

## Build

This is a native iOS project, so iOS will not run the Swift source directly from a URL. Build/signing requires Xcode and then installation through Xcode or TestFlight/App Store signing.

### XcodeGen route

1. Install Xcode + XcodeGen on a Mac.
2. From this folder run `xcodegen generate`.
3. Open `SuperAgentNative.xcodeproj`.
4. Select your Apple development team.
5. Build to the iPhone or archive for TestFlight.

`project.yml` adds the official LiteRT-LM Swift package.

## Next native modules

The architecture is deliberately ready for more real native tools: AVFoundation audio analysis, Photos/camera input, PDFKit, NaturalLanguage embeddings, Core ML specialist models, Metal particle/physics kernels, App Intents/Shortcuts, local SQLite, ZIP/archive tools, native networking with explicit permissions, and agent self-test/evaluation loops.
