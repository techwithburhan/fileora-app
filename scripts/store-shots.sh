#!/bin/bash
# Play Store screens (store-screenshots.yml): the real app on a Pixel 6 emulator, with our own
# sample files (store/samples). Only on-device tools are run, so no file goes to the live server.
set -u
APK="${1:-app.apk}"
OUT=out/store
mkdir -p "$OUT"
LOG="$OUT/log.txt"; : > "$LOG"
note() { echo "$*" | tee -a "$LOG"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb exec-out cat /sdcard/ui.xml; }
bounds() { # $1 = text/description pattern, $2 = head (first match) or tail (last match)
  dump | tr '>' '\n' | grep -E "(text|content-desc)=\"$1\"" | grep -o 'bounds="[^"]*"' | ${2:-head} -1 | grep -o '[0-9]\+' | tr '\n' ' '
}
tapB() { [ -n "${1:-}" ] || return 1; set -- $1; adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2)); }
tapText() { tapB "$(bounds "$1" head)" || { note "not found: $1"; return 1; }; }
tapLast() { tapB "$(bounds "$1" tail)" || { note "not found (last): $1"; return 1; }; }
longPress() {
  local b; b=$(bounds "$1" head); [ -n "$b" ] || { note "not found: $1"; return 1; }
  set -- $b; local x=$((($1 + $3) / 2)) y=$((($2 + $4) / 2))
  adb shell input swipe $x $y $x $y 900
}
saveUi() { dump > "$OUT/$1-ui.xml"; }
anr() { # Android's "... isn't responding" box (slow emulator): Wait
  local x; x=$(dump | tr '>' '\n')
  if echo "$x" | grep -q "t responding"; then
    local b; b=$(echo "$x" | grep -E '(text|content-desc)="Wait"' | grep -o 'bounds="[^"]*"' | head -1 | grep -o '[0-9]\+' | tr '\n' ' ')
    [ -n "$b" ] && { tapB "$b"; note "closed a 'not responding' box"; sleep 3; }
  fi
}
shot() { anr; adb exec-out screencap -p > "$OUT/$1.png"; note "shot $1"; }
up() { adb shell input swipe $((W / 2)) $((H * 78 / 100)) $((W / 2)) $((H * ${1:-30} / 100)) 400; sleep 1.5; }
down() { adb shell input swipe $((W / 2)) $((H * 30 / 100)) $((W / 2)) $((H * 85 / 100)) 400; sleep 1.5; }
back() { adb shell input keyevent 4; sleep "${1:-2}"; }
link() { adb shell am start -W -a android.intent.action.VIEW -d "$1" in.fileora.app > /dev/null; sleep "${2:-4}"; }
clean() { # festival banner, App Center popup, "Not now" cards
  local i
  anr
  for i in 1 2 3 4; do
    tapB "$(bounds 'Hide the festival banner' head)" || tapB "$(bounds 'Close' head)" || tapB "$(bounds 'Not now' head)" || break
    sleep 1.5
  done
}

read W H < <(adb shell wm size | tail -1 | sed 's/.*: //; s/x/ /' | tr -d '\r')
note "screen $W x $H, density $(adb shell wm density | tail -1 | tr -d '\r')"

# a clean status bar (no notifications, full battery, fixed clock)
adb shell settings put global sysui_demo_allowed 1
for a in "-e command enter" "-e command clock -e hhmm 1000" "-e command battery -e level 100 -e plugged false" \
         "-e command network -e wifi show -e level 4" "-e command network -e mobile hide" "-e command notifications -e visible false"; do
  adb shell am broadcast -a com.android.systemui.demo $a > /dev/null
done

sleep 40; anr
adb install -r "$APK"
adb shell am start -W -n in.fileora.app/.MainActivity
sleep 25
anr
# first launch: the app's permissions screen, Android's notification question, then Continue
if tapText 'Allow'; then sleep 3; tapText "Don.t allow" || tapText "Don’t allow" || back; sleep 2; fi
up 20
tapText 'Continue' && sleep 3
link fileora://setup/done
clean

# ---- Home, Tools
link fileora://screen/home 4
clean
shot 01-home
up 40; shot 02-home-more
up 40; shot 03-home-more-2
tapB "$(bounds 'Tools, tab[^\"]*' head)" || tapLast 'Tools'
sleep 3
shot 04-tools
up 30; shot 05-tools-more

# ---- sample files into Downloads
adb shell mkdir -p /sdcard/Download
for f in store/samples/*.pdf store/samples/*.jpg store/samples/*.docx; do adb push "$f" /sdcard/Download/ > /dev/null; done
adb shell content call --uri content://media --method scan_volume --arg external_primary > /dev/null 2>&1 || true
sleep 3

openDownloads() { # a fresh Files app each time (nothing left selected)
  adb shell am force-stop com.google.android.documentsui 2>/dev/null; adb shell am force-stop com.android.documentsui 2>/dev/null
  adb shell am start -W -a android.intent.action.VIEW -t vnd.android.document/root -d content://com.android.providers.downloads.documents/root/downloads > /dev/null 2>&1
  sleep 5
}
findFile() { # bounds of a file in the Files app, scrolling down if needed
  local k b
  for k in 1 2 3 4 5; do
    b=$(bounds "$1" head); [ -n "$b" ] && { echo "$b"; return 0; }
    adb shell input swipe $((W / 2)) $((H * 75 / 100)) $((W / 2)) $((H * 40 / 100)) 400; sleep 1.2
  done
  return 1
}
toTop() { local k; for k in 1 2 3 4; do adb shell input swipe $((W / 2)) $((H * 30 / 100)) $((W / 2)) $((H * 85 / 100)) 250; sleep 0.6; done; sleep 1; }
share() { # $1.. file names, last = name of the shot after Fileora opens
  local shot="${@: -1}" n=$(($# - 1)) i=0 f b
  openDownloads
  anr
  tapB "$(bounds 'List view' head)" && sleep 2
  for f in "${@:1:$n}"; do
    i=$((i + 1))
    [ $i -eq 1 ] && toTop
    b=$(findFile "$f") || { note "not found: $f"; saveUi "$shot-files"; return 1; }
    set -- $b; local x=$((($1 + $3) / 2)) y=$((($2 + $4) / 2))
    if [ $i -eq 1 ]; then adb shell input swipe $x $y $x $y 900; else adb shell input tap $x $y; fi
    sleep 1
  done
  tapText 'Share' || { saveUi "$shot-noshare"; back; return 1; }
  sleep 3
  shot "$shot-sheet"
  tapText 'Fileora' || { up 35; tapText 'Fileora'; } || { saveUi "$shot-sheet"; back; return 1; }
  sleep 8
  shot "$shot"
}
runCta() { # scrolls to the button at the bottom and taps it ($1 = its text), waits up to $2 s for the result
  up 15; up 15
  tapLast "$1" || { saveUi "cta"; return 1; }
  local t=0
  sleep 5
  while [ $t -lt "$2" ]; do
    [ -n "$(bounds '(Open file|Done|Open files)' head)" ] && { sleep 2; return 0; }
    sleep 5; t=$((t + 5))
  done
  note "no result after $2 s: $1"
}

# ---- 2 PDFs: Shared to Fileora (Merge first) -> Merge PDF -> result
if share Project-Plan.pdf Meeting-Notes.pdf 10-shared-pdfs; then
  tapText 'Merge PDF' && sleep 8 && shot 11-merge-ready
  runCta 'Merge PDF' 60 && { shot 12-merge-result; up 40; shot 13-merge-result-more; }
  saveUi 12-merge-result
  back; back
fi

# ---- 3 photos: Compress Image -> result
if share Mountains.jpg Sunset.jpg Lake.jpg 20-shared-images; then
  tapText 'Compress Image' && sleep 10 && shot 21-imgcompress-ready
  runCta 'Compress images' 150 && { shot 22-imgcompress-result; up 40; shot 23-imgcompress-result-more; }
  saveUi 22-imgcompress-result
  back; back
fi

# ---- 3 photos: JPG to PDF -> result
if share Mountains.jpg Sunset.jpg Lake.jpg 24-shared-images-2; then
  tapText 'JPG to PDF' || { up 40; tapText 'JPG to PDF'; }
  sleep 10; shot 25-jpg2pdf-ready
  runCta 'Convert to PDF' 150 && shot 26-jpg2pdf-result
  back; back
fi

# ---- Word file: opens Word to PDF with the file attached (not run: that tool uses the server)
share Proposal.docx 30-word2pdf && back

# ---- one PDF: Sign PDF with the file attached (not run)
if share Study-Guide.pdf 31-shared-pdf; then
  tapText 'Sign PDF' || { up 40; tapText 'Sign PDF'; }
  sleep 10
  # draw a signature on the pad (above "Sign above the line")
  b=$(bounds 'Sign above the line' head)
  if [ -n "$b" ]; then
    set -- $b; cx=$((($1 + $3) / 2)); ly=$2
    python3 - "$cx" "$ly" > /tmp/sig.txt <<'PY'
import math, sys
cx, ly = int(sys.argv[1]), int(sys.argv[2])
pts = []
for i in range(0, 121):
    t = i / 120
    x = cx - 300 + 600 * t
    y = ly - 70 - 55 * math.sin(t * math.pi * 5.2) * (1 - 0.5 * t) - 25 * math.sin(t * math.pi * 1.3)
    pts.append((int(x), int(y)))
print(' '.join(f'{x},{y}' for x, y in pts))
PY
    first=1
    for p in $(cat /tmp/sig.txt); do
      x=${p%,*}; y=${p#*,}
      if [ $first = 1 ]; then adb shell input motionevent DOWN $x $y; first=0; else adb shell input motionevent MOVE $x $y; fi
    done
    adb shell input motionevent UP $x $y
    sleep 1
  fi
  shot 32-sign-ready
  up 40; shot 33-sign-ready-more
  back; back
fi

# ---- Files (the results above), Recycle Bin card
link fileora://screen/files 5
shot 40-files
up 35; shot 41-files-list
up 35; shot 42-files-list-2

# ---- India tools and photo tools
for t in aadhaar passport examphoto imgcompress merge; do
  link "fileora://tool/$t" 8
  shot "50-tool-$t"
  back
done

# ---- languages
link fileora://screen/home 3
clean
tapB "$(bounds 'Language: [^"]*' head)" && { sleep 2; shot 60-languages; back; }
link fileora://lang/hi 4; clean; toTop; shot 61-home-hi
tapB "$(bounds '(टूल|Tools), tab[^\"]*' head)" && sleep 3 && { toTop; shot 62-tools-hi; }
link fileora://lang/en 3

# ---- dark mode (the app follows the phone)
adb shell cmd uimode night yes; sleep 3
link fileora://screen/home 4; clean; toTop; shot 70-home-dark
tapB "$(bounds 'Tools, tab[^\"]*' head)" && sleep 3 && { toTop; shot 71-tools-dark; }
link fileora://screen/files 5; shot 72-files-dark
adb shell cmd uimode night no; sleep 2

adb logcat -d | grep -iE "FATAL|AndroidRuntime" | tail -40 > "$OUT/crash.txt" || true
if adb shell pidof in.fileora.app > /dev/null; then echo RUNNING > "$OUT/status.txt"; else echo "NOT RUNNING" > "$OUT/status.txt"; fi
cat "$LOG"
