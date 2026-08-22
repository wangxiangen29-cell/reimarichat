from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

def append_history(
    history_path: Path,
    *,
    source_text: str,
    kana: str,
    wav_path: Path,
    preset: str,
    unknown: list[str],
) -> None:
    history_path.parent.mkdir(parents=True, exist_ok=True)

    record: dict[str, Any] = {
        "time": datetime.now().isoformat(timespec="seconds"),
        "preset": preset,
        "source_text": source_text,
        "kana": kana,
        "wav_path": str(wav_path),
        "unknown": unknown,
    }

    with history_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")