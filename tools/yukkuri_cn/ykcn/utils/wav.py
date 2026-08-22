from __future__ import annotations

import wave
from pathlib import Path


def append_silence_to_wav(wav_path: Path, silence_ms: int = 300) -> None:
    wav_path = wav_path.resolve()
    tmp_path = wav_path.with_suffix(".tmp.wav")

    with wave.open(str(wav_path), "rb") as src:
        params = src.getparams()
        frames = src.readframes(src.getnframes())

        framerate = src.getframerate()
        channels  = src.getnchannels()
        sampwidth = src.getsampwidth()

    silence_frames = int(framerate * silence_ms / 1000)

    if sampwidth == 1:
        silence_sample = b"\x80"
    else:
        silence_sample = b"\x00" * sampwidth

    silence = silence_sample * channels * silence_frames

    with wave.open(str(tmp_path), "wb") as dst:
        dst.setparams(params)
        dst.writeframes(frames)
        dst.writeframes(silence)

    tmp_path.replace(wav_path)


def get_wav_duration_sec(wav_path: Path) -> float:
    with wave.open(str(wav_path), "rb") as wf:
        return wf.getnframes() / wf.getframerate()