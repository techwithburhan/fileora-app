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
# app 1.2: the first-launch permissions screen, then Android's own notification question (API 33+)
adb exec-out screencap -p > "$OUT/v12-setup.png"
B=$(adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -E '(text|content-desc)="Allow"' | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+' | tr '\n' ' ')
if [ -n "$B" ]; then set -- $B; adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2)); sleep 3; adb exec-out screencap -p > "$OUT/v12-setup-system-question.png"; adb shell input keyevent 4; sleep 2; adb exec-out screencap -p > "$OUT/v12-setup-after.png"; fi
adb shell am start -W -a android.intent.action.VIEW -d fileora://setup/done in.fileora.app
sleep 4
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
adb shell input swipe $X $((H * 80 / 100)) $X $((H * 30 / 100)) 600
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display-3.png"
adb shell input swipe $X $((H * 80 / 100)) $X $((H * 40 / 100)) 600
sleep 2
adb exec-out screencap -p > "$OUT/home-large-display-4.png"
adb shell wm density reset
# app 1.1: Downloads ("Delete all" per tab), the language list, Home in Hindi, Urdu, Spanish and
# Arabic, and Arabic after a restart (the system's right-to-left mode), then back to English.
tap_desc() { # taps the first element whose accessibility label matches the grep -E pattern $1
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || return 0
  B=$(adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -E "content-desc=\"$1" | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+' | tr '\n' ' ')
  if [ -n "$B" ]; then set -- $B; adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2)); sleep 2; else echo "not found: $1"; fi
}
adb shell am force-stop in.fileora.app
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 10
close_popup
adb shell am start -W -a android.intent.action.VIEW -d fileora://screen/downloads in.fileora.app
sleep 4
adb exec-out screencap -p > "$OUT/v11-downloads.png"
adb shell input keyevent 4
sleep 2
tap_desc 'Language: '
adb exec-out screencap -p > "$OUT/v11-language-list.png"
# picking a left-to-right language closes the list
tap_desc '[^"]*\(Hindi\)'
sleep 1
adb exec-out screencap -p > "$OUT/v11-home-hi.png"
for l in ur es ar; do
  adb shell am start -W -a android.intent.action.VIEW -d "fileora://lang/$l" in.fileora.app
  sleep 3
  adb exec-out screencap -p > "$OUT/v11-home-$l.png"
done
adb shell am force-stop in.fileora.app
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 10
close_popup
adb exec-out screencap -p > "$OUT/v11-home-ar-restart.png"
adb shell am start -W -a android.intent.action.VIEW -d fileora://tool/merge in.fileora.app
sleep 6
adb exec-out screencap -p > "$OUT/v11-tool-merge-ar.png"
adb shell input keyevent 4
sleep 2
adb shell am start -W -a android.intent.action.VIEW -d fileora://screen/downloads in.fileora.app
sleep 4
adb exec-out screencap -p > "$OUT/v11-downloads-ar.png"
adb shell input keyevent 4
adb shell am start -W -a android.intent.action.VIEW -d fileora://lang/en in.fileora.app
sleep 2
# app 1.1.2: tab switching (the logo must not show a frame edge or a second logo while the tabs
# change), caught in several frames right after each tap; and the result screen (party popper inside
# the top area, "Keep going" in two full columns, the ZIP card and the failed-files box).
adb shell am force-stop in.fileora.app
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 10
close_popup
tab_frames() { # $1 = accessibility label pattern of the tab, $2 = file name part
  adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1 || return 0
  B=$(adb exec-out cat /sdcard/ui.xml | tr '>' '\n' | grep -E "(content-desc|text)=\"($1)" | grep -o 'bounds="[^"]*"' | tail -1 | grep -o '[0-9]\+' | tr '\n' ' ')
  [ -n "$B" ] || { echo "tab not found: $1"; return 0; }
  set -- $B
  adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2))
  for f in 1 2 3; do adb exec-out screencap -p > "$OUT/v112-tab-$TAB-$f.png"; done
}
TAB=tools; tab_frames 'Tools'
sleep 1
TAB=files; tab_frames 'Files|Downloads'
sleep 1
TAB=home; tab_frames 'Home'
sleep 1
for n in 1 2 6; do
  adb shell am start -W -a android.intent.action.VIEW -d "fileora://demo/result/$n" in.fileora.app
  sleep 0.6
  adb exec-out screencap -p > "$OUT/v112-result-$n-popper.png"
  sleep 3
  adb exec-out screencap -p > "$OUT/v112-result-$n.png"
  adb shell input swipe $X $((H * 80 / 100)) $X $((H * 25 / 100)) 500
  sleep 1
  adb exec-out screencap -p > "$OUT/v112-result-$n-down.png"
  adb shell input keyevent 4
  sleep 2
done
# app 1.2: Alerts with unread dots, an alert's whole message, the in-app banner, pull-to-refresh result
adb shell am start -W -a android.intent.action.VIEW -d fileora://demo/alerts in.fileora.app
sleep 4
adb exec-out screencap -p > "$OUT/v12-alerts.png"
adb shell am start -W -a android.intent.action.VIEW -d fileora://demo/alert in.fileora.app
sleep 0.4
adb exec-out screencap -p > "$OUT/v12-alert-detail-transition.png"
sleep 3
adb exec-out screencap -p > "$OUT/v12-alert-detail.png"
adb shell input keyevent 4
sleep 2
adb exec-out screencap -p > "$OUT/v12-alerts-after-read.png"
adb shell am start -W -a android.intent.action.VIEW -d fileora://demo/banner in.fileora.app
sleep 0.5
adb exec-out screencap -p > "$OUT/v12-banner.png"
sleep 6
adb exec-out screencap -p > "$OUT/v12-banner-gone.png"
adb shell input swipe $X $((H * 28 / 100)) $X $((H * 85 / 100)) 900
sleep 3
adb exec-out screencap -p > "$OUT/v12-refresh-result.png"
# app 1.2: the first-launch screen again (to check it after the run), then closed
adb shell am start -W -a android.intent.action.VIEW -d fileora://setup in.fileora.app
sleep 2
adb exec-out screencap -p > "$OUT/v12-setup-again.png"
adb shell am start -W -a android.intent.action.VIEW -d fileora://setup/done in.fileora.app
sleep 2
adb logcat -d | grep -iE "FATAL|AndroidRuntime" | tail -40 > "$OUT/crash.txt" || true
if adb shell pidof in.fileora.app > /dev/null; then echo RUNNING > "$OUT/status.txt"; else echo "NOT RUNNING" > "$OUT/status.txt"; fi
cat "$OUT/status.txt"
