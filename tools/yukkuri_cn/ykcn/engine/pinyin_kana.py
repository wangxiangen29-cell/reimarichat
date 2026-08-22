from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Mapping, Optional, Tuple

from pypinyin import Style, lazy_pinyin, pinyin


DEFAULT_PUNCT_MAP: Dict[str, str] = {
    "，": "、",
    "、": "、",
    ",": "、",

    "。": "。",
    ".": "。",

    "！": "！",
    "!": "！",

    "？": "？",
    "?": "？",

    "；": "、",
    ";": "、",

    "：": "、",
    ":": "、",

    "…": "…",
    "—": "ー",

    " ": "",
    "\t": "",
    "\n": "。",
}

@dataclass
class ConvertResult:
    compact: str
    debug: str
    unknown: List[str]

def load_json(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))

def is_cjk(ch: str) -> bool:
    return "\u4e00" <= ch <= "\u9fff"

def strip_tone(pinyin: str) -> Tuple[str, str]:
    """
    'ni3' -> ('ni', '3')
    'ma5' -> ('ma', '5')
    'wo ' -> ('wo', '' )
    """
    pinyin = pinyin.lower().replace("u:", "ü")
    m = re.match(r"^([a-züv]+)([1-5]?)$", pinyin)
    if not m:
        return pinyin, ""
    return m.group(1), m.group(2)

def normalize_pinyin_base(base: str) -> str:
    return base.replace("u:", "ü")


class PinyinKanaConverter:
    def __init__(
        self,
        pinyin_kana: Mapping[str, str],
        kana_overrides: Optional[Mapping[str, str]] = None,
        pinyin_overrides: Optional[Mapping[str, str]] = None,
        punct_map: Optional[Mapping[str, str]] = None
    ) -> None:
        self.pinyin_kana = dict(pinyin_kana)
        self.kana_overrides  = dict(kana_overrides or {})
        self.pinyin_overrides = dict(pinyin_overrides or {})
        self.punct_map = dict(punct_map or DEFAULT_PUNCT_MAP)

        self._kana_override_items = sorted(
            self.kana_overrides.items(),
            key=lambda item: len(item[0]),
            reverse=True
        )

        self._pinyin_override_items = sorted(
            self.pinyin_overrides.items(),
            key=lambda item: len(item[0]),
            reverse=True
        )

    @classmethod
    def from_dict_dir(cls, dict_dir: Path) -> PinyinKanaConverter:
        pinyin_kana = load_json(dict_dir / "pinyin_kana.json")
        kana_overrides = load_json(dict_dir / "kana_override.json")
        pinyin_overrides = load_json(dict_dir / "pinyin_override.json")
        return cls(
            pinyin_kana=pinyin_kana,
            kana_overrides=kana_overrides,
            pinyin_overrides=pinyin_overrides
        )
    
    def convert(self, text: str) -> ConvertResult:
        compact_parts: List[str] = []
        debug_parts: List[str] = []
        unknown: List[str] = []

        pos = 0
        while pos < len(text):
            ch = text[pos]

            # kana override
            word, kana = self._match_kana_override(text, pos)
            if word is not None and kana is not None:
                compact_parts.append(kana)
                debug_parts.append(f"{word}=>{kana}")

                pos += len(word)
                continue

            # pinyin override
            word, pinyin_list = self._match_pinyin_override(text, pos)
            if word is not None and pinyin_list is not None:
                kana_text, _, unknown_bases = self._convert_pinyin_list(pinyin_list)
                compact_parts.append(kana_text)
                debug_parts.append(f"{word}({','.join(pinyin_list)})=>{kana_text}")
                unknown.extend(unknown_bases)

                pos += len(word)
                continue
            
            # punctuation
            if ch in self.punct_map:
                mapped = self.punct_map[ch]
                compact_parts.append(mapped)
                if mapped:
                    debug_parts.append(f"{ch}=>{mapped}")

                pos += 1
                continue

            # CJK character
            if is_cjk(ch):
                kana, debug, unknown_base = self._convert_cjk_char(ch)
                compact_parts.append(kana)
                debug_parts.append(debug)
                if unknown_base is not None:
                    unknown.append(unknown_base)

                pos += 1
                continue

            # other character
            compact_parts.append(ch)
            debug_parts.append(ch)
            pos += 1

        return ConvertResult(
            compact="".join(compact_parts),
            debug=" / ".join(debug_parts),
            unknown=sorted(set(unknown)),
        )
    
    def _match_kana_override(self, text: str, pos: int) -> Tuple[Optional[str], Optional[str]]:
        for word, kana in self._kana_override_items:
            if text.startswith(word, pos):
                return word, kana
        return None, None
    
    def _match_pinyin_override(self, text: str, pos: int) -> Tuple[Optional[str], Optional[List[str]]]:
        for word, pinyin_list in self._pinyin_override_items:
            if text.startswith(word, pos):
                return word, pinyin_list
        return None, None
    
    def _convert_pinyin_list(self, pinyin_list: List[str]) -> Tuple[str, str, list[str]]:
        kana_parts: List[str] = []
        debug_parts: List[str] = []
        unknown: List[str] = []

        for pinyin in pinyin_list:
            base, tone = strip_tone(pinyin)
            base = normalize_pinyin_base(base)

            kana = self._lookup_kana(base)
            if kana is None:
                kana_parts.append(f"[{base}]")
                debug_parts.append(f"{pinyin}=>[UNKNOWN:{base}]")
                unknown.append(base)
            else:
                kana_parts.append(kana)
                debug_parts.append(f"{pinyin}=>{kana}")

        return "".join(kana_parts), " / ".join(debug_parts), unknown

    def _lookup_kana(self, base: str) -> Optional[str]:
        kana = self.pinyin_kana.get(base)

        if kana is None and "ü" in base:
            kana = self.pinyin_kana.get(base.replace("ü", "v"))
        if kana is None and "v" in base:
            kana = self.pinyin_kana.get(base.replace("v", "ü"))

        return kana
    
    def _convert_cjk_char(self, ch: str) -> Tuple[str, Optional[str], Optional[str]]:
        pinyin = lazy_pinyin(ch, style=Style.TONE3)[0]
        base, tone = strip_tone(pinyin)
        base = normalize_pinyin_base(base)

        kana = self._lookup_kana(base)

        if kana is None:
            return ch, f"{ch}({pinyin})=>[UNKNOWN:{base}]", base

        return kana, f"{ch}({pinyin})=>{kana}", None
    
    def _char_to_pinyin(self, ch: str) -> str:
        result = lazy_pinyin(
            ch,
            style=Style.TONE3,
            neutral_tone_with_five=True,
            errors="default"
        )
        return result[0] if result else ch