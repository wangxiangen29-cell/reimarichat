from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path
from typing import Optional

try:
    from ykcn.utils import get_app_root
except ImportError:
    def get_app_root() -> Path:
        return Path(__file__).resolve().parent

ROOT = get_app_root()

PRODUCT_PAGE_URL = "https://www.a-quest.com/products/aquestalkplayer.html"

THIRD_PARTY_DIR = ROOT / "third_party"
DOWNLOAD_DIR = THIRD_PARTY_DIR / "_downloads"
INSTALL_DIR = THIRD_PARTY_DIR / "aquestalkplayer"
CONFIG_PATH = ROOT / "config.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Install AquesTalkPlayer locally.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download and overwrite existing third_party/aquestalkplayer.",
    )
    parser.add_argument(
        "--accept-license",
        action="store_true",
        help="Confirm that you have read and accepted the AquesTalkPlayer license terms.",
    )
    parser.add_argument(
        "--preset",
        default="れいむ",
        help="Default preset name written to config.json.",
    )
    parser.add_argument(
        "--silence-ms",
        type=int,
        default=300,
        help="Trailing silence added by your synthesizer after WAV generation.",
    )
    return parser.parse_args()


def urlopen_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 yukkuri-cn-installer",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def download_file(url: str, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 yukkuri-cn-installer",
        },
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        total_header = resp.headers.get("Content-Length")
        total = int(total_header) if total_header else None

        with dst.open("wb") as f:
            downloaded = 0
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

                if total:
                    percent = downloaded * 100 / total
                    print(f"\rDownloading... {percent:5.1f}%", end="")
                else:
                    print(f"\rDownloading... {downloaded / 1024 / 1024:.1f} MB", end="")

    print()


def find_windows_zip_url() -> str:
    html = urlopen_text(PRODUCT_PAGE_URL)

    # 官方页面目前的 Windows 包链接形如：
    # /archive/package/aquestalkplayer_20250606.zip
    matches = re.findall(
        r'href="([^"]*aquestalkplayer_[0-9]+\.zip)"',
        html,
        flags=re.IGNORECASE,
    )

    if not matches:
        raise RuntimeError("Could not find AquesTalkPlayer Windows zip link on official page.")

    href = matches[0]

    if href.startswith("http://") or href.startswith("https://"):
        return href

    if href.startswith("/"):
        return "https://www.a-quest.com" + href

    return "https://www.a-quest.com/products/" + href


def find_existing_player() -> Optional[Path]:
    candidates = [
        INSTALL_DIR / "AquesTalkPlayer.exe",
        *INSTALL_DIR.rglob("AquesTalkPlayer.exe"),
    ]

    for path in candidates:
        if path.exists():
            return path.resolve()

    return None


def extract_zip_flat(zip_path: Path, install_dir: Path) -> None:
    if install_dir.exists():
        shutil.rmtree(install_dir)

    tmp_dir = install_dir.with_name("_aquestalkplayer_extract_tmp")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)

    tmp_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(tmp_dir)

    exe_candidates = list(tmp_dir.rglob("AquesTalkPlayer.exe"))
    if not exe_candidates:
        raise RuntimeError("AquesTalkPlayer.exe was not found in the downloaded zip.")

    exe = exe_candidates[0]
    package_root = exe.parent

    install_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(package_root), str(install_dir))

    shutil.rmtree(tmp_dir, ignore_errors=True)


def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def save_config(config: dict) -> None:
    CONFIG_PATH.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_config(player_path: Path, preset: str, silence_ms: int) -> None:
    config = load_config()

    config["aquestalk_player"] = str(player_path.resolve())
    config.setdefault("preset", preset)
    config.setdefault("output_dir", "output")
    config.setdefault("silence_ms", silence_ms)

    save_config(config)


def confirm_license_or_exit(args: argparse.Namespace) -> None:
    if args.accept_license:
        return

    print("AquesTalkPlayer license note:")
    print("- Free use is limited to individual non-commercial use.")
    print("- Unauthorized redistribution of the downloaded package is prohibited.")
    print("- This script downloads from the official A-Quest website and does not bundle the package.")
    print()
    ans = input("Have you read and accepted the AquesTalkPlayer license terms? [y/N]> ").strip().lower()

    if ans != "y":
        print("Installation cancelled.")
        sys.exit(1)


def main() -> None:
    args = parse_args()

    if sys.platform != "win32":
        print("This installer currently targets Windows AquesTalkPlayer.")
        sys.exit(1)

    existing = find_existing_player()
    if existing and not args.force:
        print(f"AquesTalkPlayer already installed: {existing}")
        update_config(existing, preset=args.preset, silence_ms=args.silence_ms)
        print(f"config.json updated: {CONFIG_PATH}")
        return

    confirm_license_or_exit(args)

    print("Fetching official AquesTalkPlayer download link...")
    zip_url = find_windows_zip_url()
    print(f"Download URL: {zip_url}")

    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    zip_name = zip_url.rsplit("/", 1)[-1]
    zip_path = DOWNLOAD_DIR / zip_name

    print(f"Downloading to: {zip_path}")
    download_file(zip_url, zip_path)

    print(f"Extracting to: {INSTALL_DIR}")
    extract_zip_flat(zip_path, INSTALL_DIR)

    player = find_existing_player()
    if player is None:
        raise RuntimeError("Installation failed: AquesTalkPlayer.exe not found after extraction.")

    update_config(player, preset=args.preset, silence_ms=args.silence_ms)

    print()
    print("Installed successfully.")
    print(f"AquesTalkPlayer: {player}")
    print(f"config.json: {CONFIG_PATH}")


if __name__ == "__main__":
    main()
