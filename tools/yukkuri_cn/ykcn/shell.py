from __future__ import annotations

import cmd
from pathlib import Path
from typing import Optional

from .engine import YukkuriCNApp, ConvertResult
from .utils import stop_wav

try:
    from .utils import get_app_root
except ImportError:
    def get_app_root() -> Path:
        return Path(__file__).resolve().parents[1]


class YukkuriShell(cmd.Cmd):
    intro = (
        "ゆっくり中文生成器 Shell\n"
        "输入 help 查看命令。直接输入中文也会自动转换。\n"
    )
    prompt = "ykcn> "

    def __init__(self, app: YukkuriCNApp) -> None:
        super().__init__()
        self.app = app

        self.source_text: str = ""
        self.convert_result: Optional[ConvertResult] = None
        self.kana: str = ""

        self.auto_convert: bool = True

        self.last_preview_wav: Optional[Path] = None
        self.last_preview_source_text: str = ""
        self.last_preview_kana: str = ""
        self.last_preview_unknown: list[str] = []

    # ------------------------------------------------------------------
    # lifecycle
    # ------------------------------------------------------------------

    def preloop(self) -> None:
        check = self.app.check_player()
        print(check.message)
        if not check.ok:
            print("请先运行 install_player.py。")
            print()

    def emptyline(self) -> None:
        # 默认 cmd 会重复上一条命令，这里禁用。
        pass

    def default(self, line: str) -> None:
        """
        未识别命令时，当作中文文本处理。
        """
        text = line.strip()
        if not text:
            return
        self._set_text_and_convert(text)

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _set_text_and_convert(self, text: str) -> None:
        self.source_text = text
        self.convert_result = self.app.convert(text)
        self.kana = self.convert_result.compact

        print("假名>", self.kana)

        if self.convert_result.unknown:
            print("未知>", ", ".join(self.convert_result.unknown))

    def _ensure_text(self) -> bool:
        if not self.source_text.strip():
            print("当前没有中文文本。使用：text <中文>")
            return False
        return True

    def _ensure_kana(self) -> bool:
        if not self.kana.strip():
            print("当前没有假名。请先 convert，或使用 kana <假名>。")
            return False
        return True

    def _get_unknown(self) -> list[str]:
        if self.convert_result is None:
            return []
        return self.convert_result.unknown

    # ------------------------------------------------------------------
    # commands
    # ------------------------------------------------------------------

    def do_text(self, arg: str) -> None:
        """
        text <中文>
        设置当前中文文本，并自动转换为假名。
        """
        text = arg.strip()
        if not text:
            print("用法：text <中文>")
            return

        self._set_text_and_convert(text)

    def do_convert(self, arg: str) -> None:
        """
        convert [中文]
        转换参数中的中文；如果没有参数，则转换当前中文。
        """
        text = arg.strip() or self.source_text.strip()
        if not text:
            print("用法：convert [中文]")
            return

        self._set_text_and_convert(text)

    def do_kana(self, arg: str) -> None:
        """
        kana
        kana <假名>
        不带参数时显示当前假名；带参数时手动设置当前假名。
        """
        new_kana = arg.strip()

        if not new_kana:
            if self.kana:
                print("当前假名>", self.kana)
            else:
                print("当前没有假名。")
            return

        self.kana = new_kana
        print("已手动设置假名。")

    def do_auto(self, arg: str) -> None:
        """
        auto on
        auto off
        auto toggle
        控制 play 时是否先根据中文重新转换假名。
        """
        value = arg.strip().lower()

        if value in ("on", "true", "1"):
            self.auto_convert = True
        elif value in ("off", "false", "0"):
            self.auto_convert = False
        elif value in ("toggle", ""):
            self.auto_convert = not self.auto_convert
        else:
            print("用法：auto on/off/toggle")
            return

        print(f"播放前自动转换：{'开启' if self.auto_convert else '关闭'}")

    def do_play(self, arg: str) -> None:
        """
        play [中文]
        生成临时预览 wav 并播放。不写入 history。
        """
        text = arg.strip()
        if text:
            self.source_text = text

        if not self._ensure_text():
            return

        if self.auto_convert or not self.kana.strip():
            self.convert_result = self.app.convert(self.source_text)
            self.kana = self.convert_result.compact
            print("假名>", self.kana)
        else:
            if self.convert_result is None:
                self.convert_result = self.app.convert(self.source_text)

        if not self._ensure_kana():
            return

        try:
            generated = self.app.generate(
                source_text=self.source_text,
                kana=self.kana,
                unknown=self._get_unknown(),
                output_name=self.app.make_preview_output_name(),
                play=True,
                record_history=False,
            )

            self.last_preview_wav = generated.wav_path
            self.last_preview_source_text = self.source_text
            self.last_preview_kana = self.kana
            self.last_preview_unknown = self._get_unknown()

            print(f"预览播放> {generated.wav_path}")

        except Exception as e:
            print(f"预览失败> {e}")

    def do_save(self, arg: str) -> None:
        """
        save [文件名.wav]
        保存最后一次预览音频为正式 wav，并写入 history。
        """
        if self.last_preview_wav is None:
            print("还没有可保存的预览。请先 play。")
            return

        output_name = arg.strip() or None

        try:
            saved = self.app.save_generated_as(
                source_wav_path=self.last_preview_wav,
                source_text=self.last_preview_source_text,
                kana=self.last_preview_kana,
                unknown=self.last_preview_unknown,
                output_name=output_name,
                record_history=True,
            )

            print(f"已保存> {saved.wav_path}")

        except Exception as e:
            print(f"保存失败> {e}")

    def do_generate(self, arg: str) -> None:
        """
        generate [中文]
        直接生成正式 wav，并写入 history。不经过预览保存流程。
        """
        text = arg.strip()
        if text:
            self.source_text = text

        if not self._ensure_text():
            return

        if self.auto_convert or not self.kana.strip():
            self.convert_result = self.app.convert(self.source_text)
            self.kana = self.convert_result.compact

        if not self._ensure_kana():
            return

        try:
            generated = self.app.generate(
                source_text=self.source_text,
                kana=self.kana,
                unknown=self._get_unknown(),
                play=False,
                record_history=True,
            )

            print(f"已生成> {generated.wav_path}")

        except Exception as e:
            print(f"生成失败> {e}")

    def do_stop(self, _arg: str) -> None:
        """
        stop
        停止播放。
        """
        stop_wav()
        print("已停止播放。")

    def do_debug(self, _arg: str) -> None:
        """
        debug
        显示当前转换调试信息。
        """
        if self.convert_result is None:
            print("当前没有转换结果。")
            return

        print(self.convert_result.debug)

    def do_unknown(self, _arg: str) -> None:
        """
        unknown
        显示当前未知拼音。
        """
        unknown = self._get_unknown()
        if unknown:
            print("未知>", ", ".join(unknown))
        else:
            print("未知> 无")

    def do_status(self, _arg: str) -> None:
        """
        status
        显示当前 shell 状态。
        """
        print("中文>", self.source_text or "无")
        print("假名>", self.kana or "无")
        print(f"播放前自动转换：{'开启' if self.auto_convert else '关闭'}")
        print(f"最后预览：{self.last_preview_wav or '无'}")

    def do_clear(self, _arg: str) -> None:
        """
        clear
        清空当前文本、假名和预览状态。
        """
        self.source_text = ""
        self.convert_result = None
        self.kana = ""

        self.last_preview_wav = None
        self.last_preview_source_text = ""
        self.last_preview_kana = ""
        self.last_preview_unknown = []

        print("已清空。")

    def do_quit(self, _arg: str) -> bool:
        """
        quit
        退出。
        """
        stop_wav()
        return True

    def do_exit(self, arg: str) -> bool:
        """
        exit
        退出。
        """
        return self.do_quit(arg)

    def do_EOF(self, arg: str) -> bool:
        print()
        return self.do_quit(arg)


def main() -> None:
    root = get_app_root()
    app = YukkuriCNApp(root)
    YukkuriShell(app).cmdloop()


if __name__ == "__main__":
    main()