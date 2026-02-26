#!/usr/bin/env bash
# Build the iOS companion app and install + launch it on a connected iPhone.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="$ROOT/ios/VibeTreeCompanion/VibeTreeCompanion.xcodeproj"
SCHEME="VibeTreeCompanion"
BUILD_DIR="$ROOT/ios/build"
APP_PATH="$BUILD_DIR/Build/Products/Debug-iphoneos/VibeTreeCompanion.app"

# Find first physical iOS device (xcodebuild and devicectl use different IDs; use xcodebuild's for build)
DEST_LINE=$(xcodebuild -project "$PROJECT" -scheme "$SCHEME" -showdestinations 2>/dev/null | grep "platform:iOS" | grep -v Simulator | grep -v "dvtdevice-DVTiPhonePlaceholder" | head -1) || true
DEVICE_ID=$(echo "$DEST_LINE" | grep -oE 'id:[A-F0-9-]+' | head -1 | sed 's/id://')
if [ -z "$DEVICE_ID" ]; then
  echo "No connected iPhone found. Connect an iPhone and try again."
  exit 1
fi
# Device name for devicectl (install/launch)
DEVICE_NAME=$(echo "$DEST_LINE" | grep -oE 'name:[^,}]+' | head -1 | sed 's/name://' | xargs)

echo "Building for device $DEVICE_ID..."
xcodebuild -project "$PROJECT" -scheme "$SCHEME" \
  -destination "id=$DEVICE_ID" \
  -configuration Debug \
  -derivedDataPath "$BUILD_DIR" \
  -allowProvisioningUpdates \
  build

if [ ! -d "$APP_PATH" ]; then
  echo "Build failed or app not found at $APP_PATH"
  exit 1
fi

echo "Installing to iPhone..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH" || xcrun devicectl device install app --device "$DEVICE_NAME" "$APP_PATH"

echo "Launching app on device..."
xcrun devicectl device process launch --device "$DEVICE_ID" com.vibetree.companion 2>/dev/null || xcrun devicectl device process launch --device "$DEVICE_NAME" com.vibetree.companion

echo "Done. VibeTree Companion should be open on your iPhone."
