"""Exercise the listener UI and media session on an isolated Android QA emulator."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.app.jcmradiorock.debug"

def shell(*args):
    return subprocess.check_output(["adb", "shell", *args], text=True, timeout=20)

def wait_for(probe, label, seconds=75):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if probe():
            print(f"PASS {label}", flush=True)
            return
        time.sleep(2)
    raise RuntimeError(f"Timed out waiting for {label}")

def press_play():
    result = shell("uiautomator", "dump", "/sdcard/jcm-window.xml")
    if "dumped to" not in result.lower():
        return False
    root = ET.fromstring(shell("cat", "/sdcard/jcm-window.xml").strip())
    for node in root.iter("node"):
        if "Reproducir radio" in (node.get("content-desc"), node.get("text")):
            left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
            shell("input", "tap", str((left + right) // 2), str((top + bottom) // 2))
            return True
    return False

def session_playing():
    dump = shell("dumpsys", "media_session")
    for block in re.split(r"(?m)^\s*Session #[0-9]+:", dump):
        if f"package={PACKAGE}" in block and re.search(r"state=PlaybackState\s*\{state=(?:PLAYING\(3\)|3)\b", block.replace("PLAYING(3)", "3")):
            return True
    return False

def foreground():
    return "isForeground=true" in shell("dumpsys", "activity", "services", PACKAGE + "/com.app.jcmradiorock.RadioService")

shell("input", "keyevent", "KEYCODE_WAKEUP")
shell("wm", "dismiss-keyguard")
shell("am", "start", "-W", "-n", PACKAGE + "/com.app.jcmradiorock.MainActivity")
wait_for(press_play, "listener starts the station")
wait_for(session_playing, "native session playing", 100)
wait_for(foreground, "foreground audio service")
try:
    shell("input", "keyevent", "KEYCODE_SLEEP")
    wait_for(lambda: "mWakefulness=Asleep" in shell("dumpsys", "power"), "screen asleep")
    for _ in range(6):
        time.sleep(5)
        assert session_playing() and foreground(), "Playback interrupted while asleep"
    print("PASS 30 seconds asleep with native playback active", flush=True)
    shell("input", "keyevent", "KEYCODE_MEDIA_PAUSE")
    wait_for(lambda: not session_playing(), "system pause")
    time.sleep(8)
    assert not session_playing(), "Playback restarted after pause"
finally:
    shell("input", "keyevent", "KEYCODE_WAKEUP")
