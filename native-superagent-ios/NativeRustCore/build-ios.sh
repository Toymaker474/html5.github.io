#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"

rustup target add aarch64-apple-ios aarch64-apple-ios-sim
cargo build --release --target aarch64-apple-ios
cargo build --release --target aarch64-apple-ios-sim

rm -rf SuperAgentRust.xcframework
xcodebuild -create-xcframework \
  -library target/aarch64-apple-ios/release/libsuperagent_rust.a -headers include \
  -library target/aarch64-apple-ios-sim/release/libsuperagent_rust.a -headers include \
  -output SuperAgentRust.xcframework

echo "Built: $ROOT/SuperAgentRust.xcframework"
