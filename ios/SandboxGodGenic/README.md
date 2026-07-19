# Sandbox God Genic — Native iOS

A native SwiftUI companion to the browser simulation. The visual direction follows the bioluminescent **Explicit Design / Implicit Design** concept: physics and chemistry are explicit rules; life-like structure, replication, genetic lineages, natural selection, fitness, speciation, diversity, and ecosystems emerge from the simulation.

## Systems

- SwiftUI + asynchronous `Canvas` rendering
- Local 2D toroidal world
- Tiny neural genome per creature: 8 sensors → 6 hidden neurons → 4 actions
- Motion, energy metabolism, food competition, aging, death, reproduction, mutation, natural selection, and species clustering
- Native teacher agent with hourly active-app reviews
- iPhone/iPad adaptive interface
- No server, API key, account, cryptocurrency, or model download

## Honest iOS behavior

The simulation and local teacher run while the application is active. iOS can suspend normal app execution in the background or after the app is closed. On return, the app checks whether a teacher review is due, but it does not fabricate missed simulation time.

## Generate and build

This repository uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) so the project file stays reproducible.

```bash
brew install xcodegen
cd ios/SandboxGodGenic
xcodegen generate
open SandboxGodGenic.xcodeproj
```

Build from the command line:

```bash
xcodebuild \
  -project SandboxGodGenic.xcodeproj \
  -scheme SandboxGodGenic \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Minimum target: iOS 17.
