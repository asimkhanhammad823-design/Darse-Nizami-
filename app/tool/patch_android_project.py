#!/usr/bin/env python3
"""Patches the flutter-create generated Android project with everything this
app needs:

1. AndroidManifest.xml — the INTERNET permission (needed to stream audio),
   which flutter create only adds for debug builds, not release.
2. MainActivity.kt — sets FLAG_SECURE natively (blocks screenshots and
   screen recording for the whole app, before the first frame renders).
   Doing this natively avoids depending on any window-manager plugin.

Idempotent: safe to run more than once. Used by the build-apk GitHub
Actions workflow and equally usable after a local `flutter create .`:

    python3 app/tool/patch_android_project.py app/android
"""

import pathlib
import sys

PERMISSIONS = """\
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
"""

MAIN_ACTIVITY_TEMPLATE = """\
package {package}

import android.os.Bundle
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {{
    override fun onCreate(savedInstanceState: Bundle?) {{
        super.onCreate(savedInstanceState)
        // Blocks screenshots and screen recording at the OS level for the
        // whole app, from before the first frame is drawn.
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }}
}}
"""


def patch_manifest(path: pathlib.Path) -> bool:
    manifest = path.read_text(encoding="utf-8")
    changed = False
    if "android.permission.INTERNET" not in manifest:
        index = manifest.index("<application")
        manifest = manifest[:index] + PERMISSIONS + "    " + manifest[index:]
        changed = True
    if changed:
        path.write_text(manifest, encoding="utf-8")
    return changed


def patch_main_activity(android_dir: pathlib.Path) -> bool:
    candidates = list(android_dir.glob("app/src/main/kotlin/**/MainActivity.kt"))
    if not candidates:
        raise SystemExit("error: MainActivity.kt not found under app/src/main/kotlin")
    path = candidates[0]
    source = path.read_text(encoding="utf-8")
    if "FLAG_SECURE" in source:
        return False
    package = None
    for line in source.splitlines():
        stripped = line.strip()
        if stripped.startswith("package "):
            package = stripped.split()[1].rstrip(";")
            break
    if not package:
        raise SystemExit(f"error: could not find a 'package' declaration in {path}")
    path.write_text(MAIN_ACTIVITY_TEMPLATE.format(package=package), encoding="utf-8")
    return True


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <path/to/app/android>")
        return 2
    android_dir = pathlib.Path(sys.argv[1])
    manifest = android_dir / "app" / "src" / "main" / "AndroidManifest.xml"
    if not manifest.exists():
        raise SystemExit(f"error: {manifest} not found — run `flutter create .` first")

    changed_manifest = patch_manifest(manifest)
    changed_activity = patch_main_activity(android_dir)
    print(f"manifest: {'patched' if changed_manifest else 'already patched'}")
    print(f"MainActivity (FLAG_SECURE): {'patched' if changed_activity else 'already patched'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
