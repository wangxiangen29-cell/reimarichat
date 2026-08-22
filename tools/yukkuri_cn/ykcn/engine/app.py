from __future__ import annotations

import shutil
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from .pinyin_kana import ConvertResult, PinyinKanaConverter
from .aquestalk_player import AquesTalkPlayerSynthesizer
from .config import check_or_repair_player, load_app_config, PlayerCheckResult
from ..utils import (
    play_wav,
    stop_wav,
    safe_filename_stem,
    append_history,
    get_wav_duration_sec,
)


@dataclass
class GenerateResult:
    source_text: str
    kana: str
    wav_path: Path
    unknown: list[str]


class YukkuriCNApp:
    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.dict_dir = self.root / "dictionaries"
        self.history_path = self.root / "history.jsonl"

        self.config = load_app_config(self.root)
        self.player_check: PlayerCheckResult = check_or_repair_player(
            self.root,
            self.config,
        )

        self.output_dir = self._resolve_output_dir()
        self.converter = PinyinKanaConverter.from_dict_dir(self.dict_dir)

        if self.player_check.ok:
            self.synthesizer: Optional[AquesTalkPlayerSynthesizer] = (
                AquesTalkPlayerSynthesizer.from_config_file(self.config, self.root)
            )
        else:
            self.synthesizer = None

    # -------------------------------------------------------------------------
    # config / status
    # -------------------------------------------------------------------------

    def _resolve_output_dir(self) -> Path:
        raw = self.config.get("output_dir", "output")
        path = Path(raw)

        if not path.is_absolute():
            path = self.root / path

        return path.resolve()

    def check_player(self) -> PlayerCheckResult:
        return self.player_check

    def get_output_dir(self) -> Path:
        return self.output_dir

    # -------------------------------------------------------------------------
    # convert
    # -------------------------------------------------------------------------

    def convert(self, text: str) -> ConvertResult:
        return self.converter.convert(text)

    # -------------------------------------------------------------------------
    # filename helpers
    # -------------------------------------------------------------------------

    def make_output_name(self, source_text: str, index: Optional[int] = None) -> str:
        stem = safe_filename_stem(source_text)

        if index is not None:
            return f"{index:03d}_{stem}.wav"

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{timestamp}_{stem}.wav"

    def make_preview_output_name(self) -> str:
        return "_preview/preview.wav"

    def _ensure_output_parent(self, output_name: str) -> None:
        path = self.output_dir / output_name
        path.parent.mkdir(parents=True, exist_ok=True)

    # -------------------------------------------------------------------------
    # generation
    # -------------------------------------------------------------------------

    def generate(
        self,
        *,
        source_text: str,
        kana: str,
        unknown: list[str],
        output_name: Optional[str] = None,
        play: bool = False,
        record_history: bool = True,
        async_play: bool = True,
    ) -> GenerateResult:
        """
        统一生成入口。

        - play=False：只生成
        - play=True ：生成后播放
        - record_history=False：用于 GUI 预览，避免 history 被临时试听污染
        """
        if self.synthesizer is None:
            raise RuntimeError(self.player_check.message)

        if output_name is None:
            output_name = self.make_output_name(source_text)

        self._ensure_output_parent(output_name)

        wav_path = self.synthesizer.synthesize(
            kana,
            output_name=output_name,
        )

        if record_history:
            self._append_generation_history(
                source_text=source_text,
                kana=kana,
                wav_path=wav_path,
                unknown=unknown,
            )

        if play:
            stop_wav()
            play_wav(wav_path, async_play=async_play)

        return GenerateResult(
            source_text=source_text,
            kana=kana,
            wav_path=wav_path,
            unknown=unknown,
        )

    def generate_from_text(
        self,
        text: str,
        *,
        output_name: Optional[str] = None,
        play: bool = False,
        record_history: bool = True,
        async_play: bool = True,
    ) -> tuple[ConvertResult, GenerateResult]:
        """
        中文文本直接转换并生成的便利函数。
        CLI 批量生成时可以用，GUI 通常会先 convert 再 generate。
        """
        converted = self.convert(text)

        generated = self.generate(
            source_text=text,
            kana=converted.compact,
            unknown=converted.unknown,
            output_name=output_name,
            play=play,
            record_history=record_history,
            async_play=async_play,
        )

        return converted, generated

    def save_generated_as(
        self,
        *,
        source_wav_path: Path,
        source_text: str,
        kana: str,
        unknown: list[str],
        output_name: Optional[str] = None,
        record_history: bool = True,
    ) -> GenerateResult:
        """
        把已经生成的 wav 保存成正式文件。

        GUI 的“保存音频”应该调用这个，而不是重新合成。
        这样可以保证保存下来的就是刚才预览听到的版本。
        """
        if self.synthesizer is None:
            raise RuntimeError(self.player_check.message)

        source_wav_path = source_wav_path.resolve()

        if not source_wav_path.exists():
            raise FileNotFoundError(f"Source wav not found: {source_wav_path}")

        if output_name is None:
            output_name = self.make_output_name(source_text)

        self._ensure_output_parent(output_name)

        dst_path = (self.output_dir / output_name).resolve()

        if source_wav_path == dst_path:
            # 已经是目标文件时不需要复制。
            pass
        else:
            shutil.copy2(source_wav_path, dst_path)

        if record_history:
            self._append_generation_history(
                source_text=source_text,
                kana=kana,
                wav_path=dst_path,
                unknown=unknown,
            )

        return GenerateResult(
            source_text=source_text,
            kana=kana,
            wav_path=dst_path,
            unknown=unknown,
        )

    # -------------------------------------------------------------------------
    # playback helper
    # -------------------------------------------------------------------------

    def wait_until_wav_finished(self, wav_path: Path, extra_sec: float = 0.5) -> None:
        duration = get_wav_duration_sec(wav_path)
        time.sleep(duration + extra_sec)

    # -------------------------------------------------------------------------
    # history
    # -------------------------------------------------------------------------

    def _append_generation_history(
        self,
        *,
        source_text: str,
        kana: str,
        wav_path: Path,
        unknown: list[str],
    ) -> None:
        if self.synthesizer is None:
            preset = ""
        else:
            preset = self.synthesizer.preset

        append_history(
            history_path=self.history_path,
            source_text=source_text,
            kana=kana,
            wav_path=wav_path,
            preset=preset,
            unknown=unknown,
        )

