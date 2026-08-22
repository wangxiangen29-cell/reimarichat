from __future__ import annotations

import re


def safe_filename_stem(text: str, max_len: int = 64) -> str:
    text = text.strip()

    text = re.sub(r'[<>:"/\\|?*\n\r\t]', "_", text)
    text = re.sub(r"\s+", "", text)

    for ch in "。，、！？":
        text = text.replace(ch, "")

    if not text:
        text = "yukkuri_cn"

    return text[:max_len]