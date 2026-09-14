#!/bin/sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"

sh NativeRustCore/build-ios.sh
xcodegen generate

echo "Generated: $ROOT/SuperAgentNative.xcodeproj"
echo "Open it in Xcode, choose your Apple Development Team, then build to iPhone."
