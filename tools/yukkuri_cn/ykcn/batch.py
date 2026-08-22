from __future__ import annotations

import argparse
from pathlib import Path

from .engine import YukkuriCNApp


def add_batch_parser(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "batch",
        help="Generate WAV files from a text file, one line per utterance.",
    )

    parser.add_argument(
        "input",
        type=Path,
        help="Input text file. Each non-empty non-comment line is generated as one WAV.",
    )
    parser.add_argument(
        "--play",
        action="store_true",
        help="Play each generated WAV during batch generation.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only convert text to kana; do not generate WAV.",
    )
    parser.add_argument(
        "--stop-on-unknown",
        action="store_true",
        help="Stop batch generation when unknown pinyin is detected.",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="Optional output filename prefix.",
    )


def run_batch(app: YukkuriCNApp, args: argparse.Namespace) -> int:
    check = app.check_player()
    print(check.message)

    if not check.ok and not args.dry_run:
        return 1

    input_path: Path = args.input
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        return 1

    lines = input_path.read_text(encoding="utf-8").splitlines()

    count = 0
    failed = 0

    for raw_line in lines:
        text = raw_line.strip()

        if not text:
            continue

        if text.startswith("#"):
            continue

        count += 1
        result = app.convert(text)

        print(f"[{count:03d}] {text}")
        print(f"kana> {result.compact}")

        if result.unknown:
            print("unknown>", ", ".join(result.unknown))

            if args.stop_on_unknown:
                print("Stopped because --stop-on-unknown was set.")
                return 2

        if args.dry_run:
            print()
            continue

        output_name = app.make_output_name(text, index=count)

        if args.prefix:
            output_name = f"{args.prefix}_{output_name}"

        try:
            generated = app.generate(
                source_text=text,
                kana=result.compact,
                unknown=result.unknown,
                output_name=output_name,
                play=args.play,
                record_history=True,
            )

            print(f"wav > {generated.wav_path}")

            if args.play:
                app.wait_until_wav_finished(generated.wav_path)

        except Exception as e:
            failed += 1
            print(f"failed> {e}")

        print()

    print(f"Done. {count - failed}/{count} generated.")
    return 0 if failed == 0 else 1
