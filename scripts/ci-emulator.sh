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
# app 1.0: pull to refresh on Home (Fileora logo with the ring), caught while it spins
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 4
adb shell input swipe 540 650 540 1500 700
adb exec-out screencap -p > "$OUT/refresh.png"
sleep 3
adb exec-out screencap -p > "$OUT/refresh-done.png"
# app 1.0: Home with a large "Display size" (the categories grid must keep two cards per row)
adb shell wm density 560
adb shell am force-stop in.fileora.app
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 12
adb shell input swipe 540 1500 540 700 400
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display.png"
adb shell wm density reset
adb logcat -d | grep -iE "FATAL|AndroidRuntime" | tail -40 > "$OUT/crash.txt" || true
if adb shell pidof in.fileora.app > /dev/null; then echo RUNNING > "$OUT/status.txt"; else echo "NOT RUNNING" > "$OUT/status.txt"; fi
cat "$OUT/status.txt"
