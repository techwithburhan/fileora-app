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
# Back first: closes App Center's announcement popup if one is shown.
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 5
adb shell input keyevent 4
sleep 2
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 3
adb shell input swipe 540 700 540 1500 700
adb exec-out screencap -p > "$OUT/refresh.png"
sleep 0.4
adb exec-out screencap -p > "$OUT/refresh-2.png"
sleep 3
adb exec-out screencap -p > "$OUT/refresh-done.png"
# app 1.0: Home categories with a large "Display size" (two cards per row must stay)
adb shell am force-stop in.fileora.app
adb shell wm density 520
sleep 4
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS > /dev/null 2>&1 || true
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 12
adb shell input keyevent 4
sleep 1
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 2
adb shell input swipe 540 1700 540 600 500
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display.png"
adb shell wm density reset
adb logcat -d | grep -iE "FATAL|AndroidRuntime" | tail -40 > "$OUT/crash.txt" || true
if adb shell pidof in.fileora.app > /dev/null; then echo RUNNING > "$OUT/status.txt"; else echo "NOT RUNNING" > "$OUT/status.txt"; fi
cat "$OUT/status.txt"
