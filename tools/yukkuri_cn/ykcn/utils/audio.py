from __future__ import annotations

import sys
import subprocess
from pathlib import Path

def play_wav(path: Path, async_play: bool = True) -> None:
    path = path.resolve()

    if not path.exists():
        raise FileNotFoundError(f"WAV file not found at {path}")
    
    if sys.platform.startswith("win"):
        import winsound
        
        flags = winsound.SND_FILENAME
        if async_play:
            flags |= winsound.SND_ASYNC

        winsound.PlaySound(str(path), flags)
        return
    
    # Linux fallback to aplay
    if async_play:
        subprocess.Popen(["aplay", str(path)])
    else:
        subprocess.run(["aplay", str(path)], check=False)

def stop_wav() -> None:
    if sys.platform.startswith("win"):
        import winsound
        winsound.PlaySound(None, winsound.SND_PURGE)
    else:
        subprocess.run(["pkill", "-f", "aplay"], check=False)