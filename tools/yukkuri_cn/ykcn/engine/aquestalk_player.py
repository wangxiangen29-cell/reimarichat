from __future__ import annotations

import subprocess
import wave
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from ..utils import append_silence_to_wav

@dataclass
class AquesTalkPlayerConfig:
    player_path: Path
    preset: str
    output_dir: Path
    silence_ms: int = 300


class AquesTalkPlayerSynthesizer:
    def __init__(self, config: AquesTalkPlayerConfig) -> None:
        self.config = config

    @classmethod
    def from_config_file(cls, config: dict, root: Path) -> AquesTalkPlayerSynthesizer:
        player_path = Path(config["aquestalk_player"]).resolve()
        preset = config.get("preset", "れいむ")
        output_dir = (root / config.get("output_dir", "output")).resolve()
        silence_ms = config.get("silence_ms", 300)

        return cls(AquesTalkPlayerConfig(
            player_path=player_path,
            preset=preset,
            output_dir=output_dir,
            silence_ms=silence_ms,
        ))
    
    @property
    def preset(self) -> str:
        return self.config.preset
    
    def synthesize(
        self,
        compact_text: str,
        output_name: Optional[str] = None,
    ) -> Path:
        player = self.config.player_path
        output_dir = self.config.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        if not player.exists():
            raise FileNotFoundError(f"AquesTalkPlayer.exe not found at {player}")
        
        if output_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_name = f"yukkuri_cn_{timestamp}.wav"

        wav_path = (output_dir / output_name).resolve()
        temp_txt = (output_dir / "_aquestalk_input.txt").resolve()

        self._write_input_text(temp_txt, compact_text)

        cmd = [
            str(player),
            "/F", str(temp_txt),
            "/P", self.preset,
            "/W", str(wav_path),
        ]

        proc = subprocess.run(
            cmd,
            cwd=str(player.parent),
            shell=False,
        )

        if proc.returncode != 0:
            raise RuntimeError(
                f"AquesTalkPlayer failed with return code {proc.returncode}\n"
                f"Command: {' '.join(cmd)}"
            )
        
        if not wav_path.exists():
            raise FileNotFoundError(f"Expected output wav file not found at {wav_path}")
        
        if self.config.silence_ms > 0:
            append_silence_to_wav(wav_path, silence_ms=self.config.silence_ms)

        return wav_path

    @staticmethod
    def _write_input_text(path: Path, compact_text: str) -> None:
        path.write_text(compact_text + "\r\n", encoding="cp932", errors="replace")
