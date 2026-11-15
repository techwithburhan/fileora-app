#!/usr/bin/env python3
"""Sets code signing for the Fileora app target only (not the CocoaPods targets) before an archive.

Usage:
  ios-signing.py automatic TEAM_ID
  ios-signing.py manual TEAM_ID "PROFILE NAME"

Used by .github/workflows/ios.yml. It edits ios/FileoraApp.xcodeproj/project.pbxproj in the
CI runner only (nothing is committed).
"""
import re
import sys

PBX = 'ios/FileoraApp.xcodeproj/project.pbxproj'
MARK = 'PRODUCT_BUNDLE_IDENTIFIER = in.fileora.app;'


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('automatic', 'manual'):
        sys.exit(__doc__)
    style, team = sys.argv[1], sys.argv[2]
    if not re.fullmatch(r'[A-Z0-9]{10}', team):
        sys.exit('APPLE_TEAM_ID must be the 10-character Team ID from developer.apple.com → Membership details')
    s = open(PBX, encoding='utf-8').read()
    if s.count(MARK) != 2:
        sys.exit('Unexpected project file: app target settings not found')
    # drop earlier values in the app target, then add ours next to the bundle id
    lines = []
    for line in s.split('\n'):
        if re.match(r'\s*(CODE_SIGN_STYLE|DEVELOPMENT_TEAM|PROVISIONING_PROFILE_SPECIFIER|"CODE_SIGN_IDENTITY\[sdk=iphoneos\*\]") = ', line) and 'app-target' in line:
            continue
        lines.append(line)
    s = '\n'.join(lines)
    add = [f'CODE_SIGN_STYLE = {"Automatic" if style == "automatic" else "Manual"}; /* app-target */', f'DEVELOPMENT_TEAM = {team}; /* app-target */']
    if style == 'manual':
        profile = sys.argv[3]
        add += [f'PROVISIONING_PROFILE_SPECIFIER = "{profile}"; /* app-target */', '"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution"; /* app-target */']
    s = s.replace(MARK, MARK + ''.join('\n\t\t\t\t' + a for a in add))
    open(PBX, 'w', encoding='utf-8').write(s)
    print(f'App target signing: {style}, team {team}')


if __name__ == '__main__':
    main()
