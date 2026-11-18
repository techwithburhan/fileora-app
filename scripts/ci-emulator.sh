#!/bin/bash
# GitHub Actions (android.yml, emulator job): installs the APK in the running emulator, takes
# screenshots of the start, the offline engine's self-test and some tool screens.
set -u
APK="${1:-app-release.apk}"
OUT=out/emulator
mkdir -p "$OUT"
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 25
adb exec-out screencap -p > "$OUT/home.png"
adb shell am start -W -a android.intent.action.VIEW -d fileora://selftest in.fileora.app
sleep 75
adb exec-out screencap -p > "$OUT/selftest.png"
adb shell input keyevent 4
sleep 2
for t in watermark sign examphoto organize imgblur ocr; do
  adb shell am start -W -a android.intent.action.VIEW -d "fileora://tool/$t" in.fileora.app
  sleep 8
  adb exec-out screencap -p > "$OUT/tool-$t.png"
  adb shell input keyevent 4
  sleep 2
done
# app 1.0: new tool screens
for t in txt2pdf jpg2avif; do
  adb shell am start -W -a android.intent.action.VIEW -d "fileora://tool/$t" in.fileora.app
  sleep 8
  adb exec-out screencap -p > "$OUT/tool-$t.png"
  adb shell input keyevent 4
  sleep 2
done
# app 1.0: pull to refresh on Home (Fileora logo with the ring), caught while it spins.
# Coordinates from the screen size (the CI emulator is small, e.g. 320 x 640).
read W H < <(adb shell wm size | tail -1 | sed 's/.*: //; s/x/ /' | tr -d '\r')
X=$((W / 2))
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 4
adb shell input swipe $X $((H * 28 / 100)) $X $((H * 85 / 100)) 900
adb exec-out screencap -p > "$OUT/refresh.png"
sleep 0.3
adb exec-out screencap -p > "$OUT/refresh-2.png"
sleep 3
adb exec-out screencap -p > "$OUT/refresh-done.png"
# Closes App Center's Daily Update popup (its X button is labelled "Close"), so Home is visible
close_popup() {
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || return 0
  B=$(adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep 'content-desc="Close"' | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+' | tr '\n' ' ')
  if [ -n "$B" ]; then set -- $B; adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2)); sleep 1; fi
}
# app 1.0: Home categories with a 30% larger "Display size" (two cards per row must stay)
D=$(adb shell wm density | head -1 | sed 's/.*: //' | tr -d '\r')
adb shell am force-stop in.fileora.app
adb shell wm density $((D * 130 / 100))
sleep 3
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 10
close_popup
adb exec-out screencap -p > "$OUT/home-large-display-top.png"
adb shell input swipe $X $((H * 80 / 100)) $X $((H * 30 / 100)) 600
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display.png"
adb shell input swipe $X $((H * 80 / 100)) $X $((H * 45 / 100)) 600
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display-2.png"
adb shell wm density reset
adb logcat -d | grep -iE "FATAL|AndroidRuntime" | tail -40 > "$OUT/crash.txt" || true
if adb shell pidof in.fileora.app > /dev/null; then echo RUNNING > "$OUT/status.txt"; else echo "NOT RUNNING" > "$OUT/status.txt"; fi
cat "$OUT/status.txt"
