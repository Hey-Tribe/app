#!/usr/bin/env bash
# Installs the simulator build, opens it and saves a screenshot. Fails if the app isn't running afterwards.
set -euo pipefail
APP="$1"; OUT="${2:-out}"; mkdir -p "$OUT"
DEV="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
d = json.load(sys.stdin)["devices"]
phones = [(k, x) for k, v in d.items() if "iOS" in k for x in v if x["name"].startswith("iPhone")]
phones.sort(key=lambda p: (p[0], "Pro" in p[1]["name"] and "Max" not in p[1]["name"], p[1]["name"]))
print(phones[-1][1]["udid"])')"
echo "Simulator: $DEV"
xcrun simctl boot "$DEV" || true
xcrun simctl bootstatus "$DEV" -b
xcrun simctl install "$DEV" "$APP"
xcrun simctl launch "$DEV" app.heytribe.ios
sleep 30
xcrun simctl io "$DEV" screenshot "$OUT/ios-1-open.png"
xcrun simctl spawn "$DEV" launchctl list | grep -qi "heytribe" || { echo "The app is not running (crash?)"; exit 1; }
xcrun simctl ui "$DEV" appearance dark || true
sleep 3
xcrun simctl io "$DEV" screenshot "$OUT/ios-2-dark.png"
echo "iPhone smoke test passed"
