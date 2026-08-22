from __future__ import annotations

import argparse
from pathlib import Path
from typing import Sequence

from .engine import YukkuriCNApp
from .batch import add_batch_parser, run_batch

try:
    from .utils import get_app_root
except ImportError:
    def get_app_root() -> Path:
        return Path(__file__).resolve().parents[1]

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ykcn",
        description="Yukkuri Chinese Kana/Speech Generator",
    )

    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser(
        "shell",
        help="Start interactive shell mode.",
    )

    subparsers.add_parser(
        "gui",
        help="Start GUI mode.",
    )

    add_batch_parser(subparsers)

    subparsers.add_parser(
        "check-player",
        help="Check AquesTalkPlayer installation.",
    )

    return parser


def run_shell(app: YukkuriCNApp) -> int:
    from .shell import YukkuriShell

    YukkuriShell(app).cmdloop()
    return 0


def run_gui() -> int:
    from .gui import main as gui_main

    gui_main()
    return 0


def run_check_player(app: YukkuriCNApp) -> int:
    check = app.check_player()
    print(check.message)
    return 0 if check.ok else 1


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    command = args.command or "shell"

    if command == "gui":
        return run_gui()

    root = get_app_root()
    app = YukkuriCNApp(root)

    if command == "shell":
        return run_shell(app)

    if command == "batch":
        return run_batch(app, args)

    if command == "check-player":
        return run_check_player(app)

    parser.print_help()
    return 1