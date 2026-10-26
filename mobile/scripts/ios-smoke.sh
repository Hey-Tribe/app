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
for i in 1 2 3 4 5 6; do sleep 10; xcrun simctl io "$DEV" screenshot "$OUT/ios-1-open-$i.png"; done
cp "$OUT/ios-1-open-6.png" "$OUT/ios-1-open.png"
xcrun simctl spawn "$DEV" log show --last 3m --style compact --predicate 'process == "App" OR subsystem CONTAINS "WebKit"' > "$OUT/ios-log.txt" 2>/dev/null || true
grep -iE "error|fail|capacitor|⚡️" "$OUT/ios-log.txt" | tail -60 || true
# simulator apps run as ordinary processes on the Mac
pgrep -f "App.app/App" >/dev/null || xcrun simctl spawn "$DEV" launchctl list | grep -qi "heytribe" || { echo "The app is not running (crash?)"; exit 1; }
xcrun simctl ui "$DEV" appearance dark || true
sleep 3
xcrun simctl io "$DEV" screenshot "$OUT/ios-2-dark.png"
echo "iPhone smoke test passed"
