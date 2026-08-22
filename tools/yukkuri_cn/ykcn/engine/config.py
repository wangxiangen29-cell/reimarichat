from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional


@dataclass
class PlayerCheckResult:
    ok: bool
    player_path: Optional[Path] = None
    message: str = ""


def load_app_config(root: Path) -> dict:
    config_path = root / "config.json"
    if not config_path.exists():
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))

def save_app_config(root: Path, config: dict[str, Any]) -> None:
    config_path = root / "config.json"
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8"
    )


def find_player_in_path(root: Path) -> Optional[Path]:
    candidates = list((root / "third_party").glob("**/AquesTalkPlayer.exe"))

    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()

    return None


def check_or_repair_player(root: Path, config: dict[str, Any]) -> PlayerCheckResult:
    configured = config.get("aquestalk_player")

    if configured:
        plater = Path(configured).resolve()
        if plater.exists():
            return PlayerCheckResult(
                ok=True,
                player_path=plater,
                message=f"Found AquesTalkPlayer at configured path: {plater}"
            )
        

    found = find_player_in_path(root)
    if found is not None:
        config["aquestalk_player"] = str(found)
        config.setdefault("preset", "れいむ")
        config.setdefault("output_dir", "output")
        config.setdefault("silence_ms", 300)
        save_app_config(root, config)

        return PlayerCheckResult(
            ok=True,
            player_path=found,
            message=f"Found AquesTalkPlayer at: {found}, updated config.json accordingly."
        )
    
    return PlayerCheckResult(
        ok=False,
        player_path=None,
        message=(
            "AquesTalkPlayer was not found. "
            "Run: python install_player.py"
        )
    )