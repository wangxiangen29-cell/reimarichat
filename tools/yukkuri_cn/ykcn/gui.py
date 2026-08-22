from __future__ import annotations

import os
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk
from tkinter.scrolledtext import ScrolledText

from .engine import YukkuriCNApp, ConvertResult
from .utils import stop_wav

try:
    from .utils import get_app_root
except ImportError:
    def get_app_root() -> Path:
        return Path(__file__).resolve().parents[1]

ROOT = get_app_root()

def enable_windows_dpi_awareness() -> None:
    """
    避免 Windows 高 DPI 下 Tkinter 字体发糊。
    必须在创建 tk.Tk() 之前调用。
    """
    if sys.platform != "win32":
        return

    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        try:
            import ctypes
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass


def open_path(path: Path) -> None:
    path = path.resolve()

    if not path.exists():
        raise FileNotFoundError(f"Path not found: {path}")

    if sys.platform == "win32":
        os.startfile(path)  # type: ignore[attr-defined]
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])


class ToolTip:
    def __init__(self, widget: tk.Widget, text: str) -> None:
        self.widget = widget
        self.text = text
        self.tip_window: tk.Toplevel | None = None

        widget.bind("<Enter>", self.show)
        widget.bind("<Leave>", self.hide)

    def show(self, _event: tk.Event | None = None) -> None:
        if self.tip_window is not None:
            return

        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 8

        self.tip_window = tk.Toplevel(self.widget)
        self.tip_window.wm_overrideredirect(True)
        self.tip_window.wm_geometry(f"+{x}+{y}")

        label = ttk.Label(
            self.tip_window,
            text=self.text,
            padding=(8, 5),
            relief=tk.SOLID,
            borderwidth=1,
            background="#ffffe0",
            justify=tk.LEFT,
        )
        label.pack()

    def hide(self, _event: tk.Event | None = None) -> None:
        if self.tip_window is not None:
            self.tip_window.destroy()
            self.tip_window = None


class YukkuriGUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("ゆっくり中文生成器")
        self.root.geometry("600x800")
        self.root.minsize(760, 620)

        self.app = YukkuriCNApp(ROOT)

        self.last_convert_result: ConvertResult | None = None
        self.last_converted_source: str | None = None

        self.last_preview_wav: Path | None = None
        self.last_preview_source_text: str | None = None
        self.last_preview_kana: str | None = None
        self.last_preview_unknown: list[str] = []
        self.preview_dirty = False

        self.debug_visible = False
        self.is_busy = False

        # 默认：播放前自动转换，假名区只读。
        self.auto_convert_var = tk.BooleanVar(value=True)

        self.ui_font = ("Microsoft YaHei UI", 11)
        self.jp_font = ("Yu Gothic UI", 12)
        self.debug_font = ("Consolas", 10)

        self.action_buttons: list[ttk.Button] = []

        self._setup_style()
        self._build_menubar()
        self._build_ui()
        self._check_player_on_startup()

    # ---------------------------------------------------------------------
    # setup
    # ---------------------------------------------------------------------

    def _setup_style(self) -> None:
        self.root.option_add("*Font", self.ui_font)

        style = ttk.Style()
        style.configure("TLabel", font=self.ui_font)
        style.configure("TButton", font=self.ui_font, padding=(10, 5))
        style.configure("TCheckbutton", font=self.ui_font)
        style.configure("TLabelframe.Label", font=("Microsoft YaHei UI", 11, "bold"))

    def _build_menubar(self) -> None:
        menubar = tk.Menu(self.root)

        file_menu = tk.Menu(menubar, tearoff=False)
        file_menu.add_command(label="打开输出目录", command=self.on_open_output_dir)
        file_menu.add_command(label="打开历史记录", command=self.on_open_history)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.destroy)
        menubar.add_cascade(label="文件", menu=file_menu)

        edit_menu = tk.Menu(menubar, tearoff=False)
        edit_menu.add_command(label="复制假名", command=self.on_copy_kana)
        edit_menu.add_command(label="清空中文输入", command=self.on_clear_input)
        edit_menu.add_command(label="清空假名预览", command=self.on_clear_kana)
        menubar.add_cascade(label="编辑", menu=edit_menu)

        view_menu = tk.Menu(menubar, tearoff=False)
        view_menu.add_command(label="显示/隐藏调试信息", command=self.on_toggle_debug)
        menubar.add_cascade(label="查看", menu=view_menu)

        tools_menu = tk.Menu(menubar, tearoff=False)
        tools_menu.add_command(label="检查 AquesTalkPlayer", command=self.on_check_player)
        tools_menu.add_separator()
        tools_menu.add_command(label="打开 config.json", command=self.on_open_config)
        tools_menu.add_command(label="打开 dictionaries 目录", command=self.on_open_dictionaries)
        menubar.add_cascade(label="工具", menu=tools_menu)

        help_menu = tk.Menu(menubar, tearoff=False)
        help_menu.add_command(label="关于", command=self.on_about)
        menubar.add_cascade(label="帮助", menu=help_menu)

        self.root.config(menu=menubar)

    def _make_text_box(
        self,
        parent: tk.Widget,
        *,
        height: int,
        font: tuple[str, int] | tuple[str, int, str],
        wrap: str = tk.WORD,
    ) -> ScrolledText:
        text = ScrolledText(
            parent,
            height=height,
            wrap=wrap,
            font=font,
            padx=10,
            pady=8,
            spacing1=3,
            spacing2=1,
            spacing3=5,
            undo=True,
        )
        text.pack(fill=tk.BOTH, expand=True)
        return text

    def _build_ui(self) -> None:
        self.status_var = tk.StringVar(value="启动中...")
        self.output_var = tk.StringVar(value="最近输出：尚未保存")

        main = ttk.Frame(self.root, padding=12)
        main.pack(fill=tk.BOTH, expand=True)

        main.columnconfigure(0, weight=1)
        main.rowconfigure(1, weight=3)
        main.rowconfigure(2, weight=3)
        main.rowconfigure(3, weight=0)

        # status
        status_frame = ttk.Frame(main)
        status_frame.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        status_frame.columnconfigure(0, weight=1)

        ttk.Label(
            status_frame,
            textvariable=self.status_var,
            anchor=tk.W,
        ).grid(row=0, column=0, sticky="ew")

        ttk.Label(
            status_frame,
            textvariable=self.output_var,
            anchor=tk.W,
            foreground="#666666",
        ).grid(row=1, column=0, sticky="ew", pady=(2, 0))

        # Chinese input
        input_frame = ttk.LabelFrame(main, text="中文输入")
        input_frame.grid(row=1, column=0, sticky="nsew", pady=(0, 8))
        self.input_text = self._make_text_box(
            input_frame,
            height=8,
            font=self.ui_font,
        )
        self.input_text.bind("<KeyRelease>", self._on_text_edited)

        # Kana preview with header controls
        kana_outer = ttk.Frame(main)
        kana_outer.grid(row=2, column=0, sticky="nsew", pady=(0, 8))
        kana_outer.columnconfigure(0, weight=1)
        kana_outer.rowconfigure(1, weight=1)

        kana_header = ttk.Frame(kana_outer)
        kana_header.grid(row=0, column=0, sticky="ew", pady=(0, 4))
        kana_header.columnconfigure(0, weight=1)

        ttk.Label(
            kana_header,
            text="假名预览",
            font=("Microsoft YaHei UI", 11, "bold"),
        ).grid(row=0, column=0, sticky="w")

        ttk.Button(
            kana_header,
            text="复制假名",
            command=self.on_copy_kana,
        ).grid(row=0, column=1, padx=(8, 0))

        auto_convert_check = ttk.Checkbutton(
            kana_header,
            text="播放前自动转换",
            variable=self.auto_convert_var,
            command=self._update_kana_edit_state,
        )
        auto_convert_check.grid(row=0, column=2, padx=(12, 0))

        help_label = ttk.Label(
            kana_header,
            text="?",
            width=2,
            anchor=tk.CENTER,
            relief=tk.GROOVE,
        )
        help_label.grid(row=0, column=3, padx=(6, 0))

        ToolTip(
            help_label,
            "开启：点击“播放预览”时，会先根据中文输入重新生成假名，"
            "并覆盖当前假名预览；此时假名预览区不可手动编辑。\n\n"
            "关闭：假名预览区可以手动编辑；点击“播放预览”时，"
            "直接使用当前假名内容，适合调整读音后反复试听。\n\n"
            "“转换”按钮始终会重新转换中文并更新假名预览。",
        )

        kana_body = ttk.Frame(kana_outer)
        kana_body.grid(row=1, column=0, sticky="nsew")

        self.kana_text = self._make_text_box(
            kana_body,
            height=8,
            font=self.jp_font,
            wrap=tk.CHAR,
        )
        self.kana_text.bind("<KeyRelease>", self._on_text_edited)
        self._update_kana_edit_state(update_status=False)

        # Debug
        self.debug_frame = ttk.LabelFrame(main, text="调试信息")
        self.debug_frame.grid(row=3, column=0, sticky="nsew", pady=(0, 8))
        self.debug_text = self._make_text_box(
            self.debug_frame,
            height=6,
            font=self.debug_font,
            wrap=tk.WORD,
        )
        self.debug_frame.grid_remove()

        # Bottom controls
        control_frame = ttk.Frame(main)
        control_frame.grid(row=4, column=0, sticky="ew", pady=(4, 0))

        self.convert_button = ttk.Button(
            control_frame,
            text="转换",
            command=self.on_convert,
        )
        self.convert_button.pack(side=tk.LEFT, padx=(0, 8))

        self.preview_button = ttk.Button(
            control_frame,
            text="播放预览",
            command=self.on_preview,
        )
        self.preview_button.pack(side=tk.LEFT, padx=(0, 8))

        self.stop_button = ttk.Button(
            control_frame,
            text="停止",
            command=self.on_stop,
        )
        self.stop_button.pack(side=tk.LEFT, padx=(0, 8))

        self.save_button = ttk.Button(
            control_frame,
            text="保存音频",
            command=self.on_save_audio,
        )
        self.save_button.pack(side=tk.LEFT, padx=(0, 8))

        self.action_buttons = [
            self.convert_button,
            self.preview_button,
            self.save_button,
        ]

    # ---------------------------------------------------------------------
    # startup/status
    # ---------------------------------------------------------------------

    def _check_player_on_startup(self) -> None:
        check = self.app.check_player()

        if check.ok:
            self.status_var.set("AquesTalkPlayer：已就绪")
            return

        self.status_var.set("AquesTalkPlayer：未找到")
        messagebox.showwarning(
            "AquesTalkPlayer 未找到",
            check.message + "\n\n请先运行：python install_player.py",
        )
        self.root.after(0, self.root.destroy)

    def _set_busy(self, busy: bool, status: str | None = None) -> None:
        self.is_busy = busy

        state = tk.DISABLED if busy else tk.NORMAL
        for button in self.action_buttons:
            button.config(state=state)

        if status is not None:
            self.status_var.set(status)

    def _on_text_edited(self, _event: tk.Event) -> None:
        self.preview_dirty = True

    # ---------------------------------------------------------------------
    # Kana text state helpers
    # ---------------------------------------------------------------------

    def _update_kana_edit_state(self, update_status: bool = True) -> None:
        if self.auto_convert_var.get():
            self.kana_text.config(state=tk.DISABLED)
            if update_status:
                self.status_var.set("播放前自动转换：开启，假名预览区已锁定")
        else:
            self.kana_text.config(state=tk.NORMAL)
            if update_status:
                self.status_var.set("播放前自动转换：关闭，可以手动编辑假名")

    def _set_kana_text(self, text: str) -> None:
        old_state = str(self.kana_text.cget("state"))

        self.kana_text.config(state=tk.NORMAL)
        self.kana_text.delete("1.0", tk.END)
        self.kana_text.insert("1.0", text)

        if old_state == tk.DISABLED:
            self.kana_text.config(state=tk.DISABLED)

    def _get_kana_text(self) -> str:
        return self.kana_text.get("1.0", tk.END).strip()

    # ---------------------------------------------------------------------
    # conversion/debug
    # ---------------------------------------------------------------------

    def on_convert(self) -> None:
        source_text = self.input_text.get("1.0", tk.END).strip()
        if not source_text:
            return

        result = self._convert_and_update(source_text, notify_unknown=True)
        self.preview_dirty = True

        if result.unknown:
            self.status_var.set("转换完成：存在未知拼音")
        else:
            self.status_var.set("转换完成")

    def _convert_and_update(
        self,
        source_text: str,
        *,
        notify_unknown: bool,
    ) -> ConvertResult:
        result = self.app.convert(source_text)

        self.last_convert_result = result
        self.last_converted_source = source_text

        self._set_kana_text(result.compact)
        self._update_debug_info(result)

        if notify_unknown:
            self._notify_unknown_if_needed(result)

        return result

    def _get_result_for_current_text(self, source_text: str) -> ConvertResult:
        if (
            self.last_convert_result is not None
            and self.last_converted_source == source_text
        ):
            return self.last_convert_result

        result = self.app.convert(source_text)
        self.last_convert_result = result
        self.last_converted_source = source_text
        self._update_debug_info(result)
        return result

    def _update_debug_info(self, result: ConvertResult) -> None:
        self.debug_text.delete("1.0", tk.END)

        if result.unknown:
            self.debug_text.insert(
                tk.END,
                "未知拼音：\n" + "\n".join(result.unknown) + "\n\n",
            )
        else:
            self.debug_text.insert(tk.END, "未知拼音：无\n\n")

        self.debug_text.insert(tk.END, "调试信息：\n" + result.debug)

    def _notify_unknown_if_needed(self, result: ConvertResult) -> None:
        if not result.unknown:
            return

        messagebox.showwarning(
            "存在未知拼音",
            "以下拼音没有找到 pinyin2kana 规则：\n\n"
            + "\n".join(result.unknown)
            + "\n\n可以补充 dictionaries/pinyin_kana.json，或打开调试信息查看细节。",
        )

    # ---------------------------------------------------------------------
    # preview/save
    # ---------------------------------------------------------------------

    def on_preview(self) -> None:
        source_text = self.input_text.get("1.0", tk.END).strip()
        if not source_text:
            messagebox.showinfo("输入为空", "请输入要生成的中文文本。")
            return

        kana = self._get_kana_text()

        if self.auto_convert_var.get() or not kana:
            result = self._convert_and_update(source_text, notify_unknown=True)
            kana = result.compact
        else:
            result = self._get_result_for_current_text(source_text)
            self._notify_unknown_if_needed(result)

        self._set_busy(True, "生成预览中...")

        def worker() -> None:
            try:
                generated = self.app.generate(
                    source_text=source_text,
                    kana=kana,
                    unknown=result.unknown,
                    output_name=self.app.make_preview_output_name(),
                    play=True,
                    record_history=False,
                )

                def on_success() -> None:
                    self.last_preview_wav = generated.wav_path
                    self.last_preview_source_text = source_text
                    self.last_preview_kana = kana
                    self.last_preview_unknown = result.unknown
                    self.preview_dirty = False

                    self.status_var.set(f"正在播放预览：{generated.wav_path.name}")
                    self.output_var.set("最近输出：预览文件，尚未保存")
                    self._set_busy(False)

                self.root.after(0, on_success)

            except Exception as e:
                err = str(e)

                def on_error() -> None:
                    self._set_busy(False, "预览生成失败")
                    messagebox.showerror("预览生成失败", err)

                self.root.after(0, on_error)

        threading.Thread(target=worker, daemon=True).start()

    def on_stop(self) -> None:
        stop_wav()
        self.status_var.set("播放已停止")

    def on_save_audio(self) -> None:
        if self.last_preview_wav is None:
            messagebox.showinfo("没有可保存的预览", "请先点击“播放预览”。")
            return

        if self.preview_dirty:
            ok = messagebox.askyesno(
                "内容已修改",
                "当前中文或假名内容已经在上次预览后被修改。\n\n"
                "保存操作会保存“最后一次播放预览”的音频，而不是当前编辑区内容。\n\n"
                "仍然保存吗？",
            )
            if not ok:
                return

        preview_wav = self.last_preview_wav
        source_text = self.last_preview_source_text or ""
        kana = self.last_preview_kana or ""
        unknown = self.last_preview_unknown

        self._set_busy(True, "保存中...")

        def worker() -> None:
            try:
                saved = self.app.save_generated_as(
                    source_wav_path=preview_wav,
                    source_text=source_text,
                    kana=kana,
                    unknown=unknown,
                )

                def on_success() -> None:
                    self.status_var.set(f"已保存：{saved.wav_path.name}")
                    self.output_var.set(f"最近输出：{saved.wav_path.name}")
                    self._set_busy(False)

                self.root.after(0, on_success)

            except Exception as e:
                err = str(e)

                def on_error() -> None:
                    self._set_busy(False, "保存失败")
                    messagebox.showerror("保存失败", err)

                self.root.after(0, on_error)

        threading.Thread(target=worker, daemon=True).start()

    # ---------------------------------------------------------------------
    # menubar actions
    # ---------------------------------------------------------------------

    def on_open_output_dir(self) -> None:
        try:
            output_dir = self.app.get_output_dir()
            output_dir.mkdir(parents=True, exist_ok=True)
            open_path(output_dir)
        except Exception as e:
            messagebox.showerror("打开失败", str(e))

    def on_open_config(self) -> None:
        try:
            open_path(ROOT / "config.json")
        except Exception as e:
            messagebox.showerror("打开失败", str(e))

    def on_open_dictionaries(self) -> None:
        try:
            open_path(ROOT / "dictionaries")
        except Exception as e:
            messagebox.showerror("打开失败", str(e))

    def on_open_history(self) -> None:
        history_path = ROOT / "history.jsonl"

        if not history_path.exists():
            messagebox.showinfo("历史记录不存在", "还没有生成过正式音频。")
            return

        try:
            open_path(history_path)
        except Exception as e:
            messagebox.showerror("打开失败", str(e))

    def on_check_player(self) -> None:
        check = self.app.check_player()

        if check.ok:
            messagebox.showinfo("AquesTalkPlayer", check.message)
            self.status_var.set("AquesTalkPlayer：已就绪")
        else:
            messagebox.showwarning("AquesTalkPlayer", check.message)
            self.status_var.set("AquesTalkPlayer：未找到")

    def on_copy_kana(self) -> None:
        kana = self._get_kana_text()

        if not kana:
            return

        self.root.clipboard_clear()
        self.root.clipboard_append(kana)
        self.status_var.set("已复制假名")

    def on_clear_input(self) -> None:
        self.input_text.delete("1.0", tk.END)
        self.preview_dirty = True

    def on_clear_kana(self) -> None:
        self._set_kana_text("")
        self.preview_dirty = True

    def on_toggle_debug(self) -> None:
        self.debug_visible = not self.debug_visible

        if self.debug_visible:
            self.debug_frame.grid()
        else:
            self.debug_frame.grid_remove()

    def on_about(self) -> None:
        messagebox.showinfo(
            "关于",
            "ゆっくり中文生成器\n\n"
            "中文 → 拼音近似假名 → AquesTalkPlayer 语音生成。",
        )


def main() -> None:
    enable_windows_dpi_awareness()

    root = tk.Tk()
    YukkuriGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
