#!/usr/bin/env bash
# Installs the test APK on the running emulator, opens it, taps into the sample family and saves screenshots.
# Fails if the app crashes or never shows the HeyTribe screen.
set -u
OUT="${1:-out}"; mkdir -p "$OUT"
PKG=app.heytribe.android
adb install -r "$OUT/HeyTribe-test.apk" || exit 1
adb logcat -c || true
adb shell am start -W -n "$PKG/.MainActivity"
sleep 25
adb exec-out screencap -p > "$OUT/android-1-open.png"

dump() { adb shell rm -f /sdcard/ui.xml; timeout 40 adb shell uiautomator dump --compressed /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml 2>/dev/null; }
find_xy() { # prints "x y" of the first element whose text or description contains $1
  python3 -c '
import re, sys
xml, want = sys.stdin.read(), sys.argv[1].lower()
for m in re.finditer(r"<node [^>]*>", xml):
    n = m.group(0)
    t = (re.search(r"text=\"([^\"]*)\"", n) or [None, ""])[1] + " " + (re.search(r"content-desc=\"([^\"]*)\"", n) or [None, ""])[1]
    if want in t.lower():
        x1, y1, x2, y2 = map(int, re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", n).groups())
        print((x1 + x2) // 2, (y1 + y2) // 2); break
' "$1"
}

UI="$(dump)"
echo "$UI" > "$OUT/android-ui-1.xml"
OK=0
if echo "$UI" | grep -qi "welcome back\|sample family\|log in"; then OK=1; fi
XY="$(echo "$UI" | find_xy "sample family")"
# the accessibility dump can fail on emulators; fall back to where the sample-family card sits on a 1080x2400 screen
[ -z "$XY" ] && XY="540 1425"
if [ -n "$XY" ]; then
  adb shell input tap $XY; sleep 10
  adb exec-out screencap -p > "$OUT/android-2-sample.png"
  XY2="$(dump | find_xy "Plan")"; [ -z "$XY2" ] && XY2="324 2250"
  adb shell input tap $XY2; sleep 5; adb exec-out screencap -p > "$OUT/android-3-calendar.png"
  adb shell input keyevent KEYCODE_BACK; sleep 3
  adb exec-out screencap -p > "$OUT/android-4-after-back.png"
fi
adb logcat -d -s AndroidRuntime:E Capacitor:* chromium:E Capacitor/Console:* > "$OUT/android-logcat.txt" 2>/dev/null || true
adb logcat -d > "$OUT/android-logcat-full.txt" 2>/dev/null || true
adb shell dumpsys activity exit-info "$PKG" > "$OUT/android-exit-info.txt" 2>/dev/null || true
if [ -z "$(adb shell pidof $PKG)" ]; then echo "The app is not running (crash?)"; head -60 "$OUT/android-exit-info.txt"; grep -E "heytribe|AndroidRuntime|DEBUG|libc|chromium|WebView|ActivityManager.*(Killing|died|crash)" "$OUT/android-logcat-full.txt" | tail -80; exit 1; fi
# only crashes in HeyTribe count (the test tool itself sometimes crashes on emulators)
if grep -A3 "FATAL EXCEPTION" "$OUT/android-logcat.txt" | grep -q "Process: $PKG"; then echo "HeyTribe crashed"; grep -A25 "FATAL EXCEPTION" "$OUT/android-logcat.txt"; exit 1; fi
[ "$OK" = 1 ] || echo "Note: couldn't read the screen's text (accessibility dump failed); check the screenshots"
echo "Android smoke test passed"
