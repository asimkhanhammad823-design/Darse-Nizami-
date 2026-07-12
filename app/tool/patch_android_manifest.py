#!/usr/bin/env python3
"""Patches the flutter-create generated AndroidManifest.xml with the
permissions and components this app needs (internet, background audio
playback, lock-screen media controls).

Idempotent: safe to run more than once. Used by the build-apk GitHub
Actions workflow and equally usable after a local `flutter create .`:

    python3 app/tool/patch_android_manifest.py app/android/app/src/main/AndroidManifest.xml
"""

import sys

PERMISSIONS = """\
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
"""

COMPONENTS = """\
        <service
            android:name="com.ryanheise.audioservice.AudioService"
            android:foregroundServiceType="mediaPlayback"
            android:exported="true">
          <intent-filter>
            <action android:name="android.media.browse.MediaBrowserService" />
          </intent-filter>
        </service>
        <receiver
            android:name="com.ryanheise.audioservice.MediaButtonReceiver"
            android:exported="true">
          <intent-filter>
            <action android:name="android.intent.action.MEDIA_BUTTON" />
          </intent-filter>
        </receiver>
"""


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <path/to/AndroidManifest.xml>")
        return 2
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        manifest = f.read()

    changed = False
    if "android.permission.INTERNET" not in manifest:
        index = manifest.index("<application")
        manifest = manifest[:index] + PERMISSIONS + "    " + manifest[index:]
        changed = True
    if "com.ryanheise.audioservice.AudioService" not in manifest:
        index = manifest.index("</application>")
        manifest = manifest[:index] + COMPONENTS + "    " + manifest[index:]
        changed = True

    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(manifest)
        print(f"patched {path}")
    else:
        print(f"{path} already patched — nothing to do")
    return 0


if __name__ == "__main__":
    sys.exit(main())
