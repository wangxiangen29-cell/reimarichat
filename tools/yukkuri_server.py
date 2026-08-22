# -*- coding: utf-8 -*-
"""油库里语音本地 HTTP 服务（基于 yukkuri_cn / AquesTalkPlayer）

用法：
    python tools/yukkuri_server.py            # 默认监听 127.0.0.1:9120
    python tools/yukkuri_server.py 9125       # 自定义端口

接口（供网站前端 public/js/voice.js 调用）：
    GET /tts?text=你好&speaker=reimu   -> audio/wav
    GET /tts?text=你好&speaker=marisa  -> audio/wav
    GET /health                        -> {"ok":true,...}

首次使用请先安装 AquesTalkPlayer：
    cd tools/yukkuri_cn && python install_player.py --accept-license
    pip install pypinyin
"""
from __future__ import annotations

import io
import sys
import json
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent / "yukkuri_cn"
sys.path.insert(0, str(ROOT))

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from ykcn.engine import YukkuriCNApp, AquesTalkPlayerSynthesizer  # noqa: E402

PRESETS = {"reimu": "れいむ", "marisa": "まりさ"}

app = YukkuriCNApp(ROOT)
if app.synthesizer is None:
    print("[yukkuri] AquesTalkPlayer 未安装：", app.check_player().message, file=sys.stderr)
    print("[yukkuri] 请执行：cd tools/yukkuri_cn && python install_player.py --accept-license", file=sys.stderr)

SYNTHS = {}
for key, preset in PRESETS.items():
    cfg = dict(app.config)
    cfg["preset"] = preset
    SYNTHS[key] = AquesTalkPlayerSynthesizer.from_config_file(cfg, ROOT)

# AquesTalkPlayer 用固定临时文件名，必须串行调用
synth_lock = threading.Lock()


def synth_wav(text: str, speaker: str) -> bytes:
    speaker = speaker if speaker in PRESETS else "reimu"
    synth = SYNTHS[speaker]
    converted = app.convert(text)
    out_dir = (ROOT / app.config.get("output_dir", "output")).resolve() / "_server"
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"_server/{uuid.uuid4().hex}.wav"
    with synth_lock:
        path = synth.synthesize(converted.compact, output_name=name)
    try:
        return path.read_bytes()
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # 安静一点
        sys.stderr.write("[yukkuri] " + (fmt % args) + "\n")

    def _send(self, status: int, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            ok = app.synthesizer is not None
            self._send(200, json.dumps({
                "ok": ok,
                "presets": {k: PRESETS[k] for k in PRESETS},
            }).encode("utf-8"), "application/json; charset=utf-8")
            return
        if parsed.path == "/tts":
            params = parse_qs(parsed.query)
            text = (params.get("text") or [""])[0].strip()
            speaker = (params.get("speaker") or ["reimu"])[0]
            if not text:
                self._send(400, "missing text".encode("utf-8"), "text/plain; charset=utf-8")
                return
            if app.synthesizer is None:
                self._send(503, "AquesTalkPlayer not installed".encode("utf-8"), "text/plain; charset=utf-8")
                return
            try:
                wav = synth_wav(text, speaker)
                self._send(200, wav, "audio/wav")
            except Exception as err:  # noqa: BLE001
                self._send(500, str(err).encode("utf-8"), "text/plain; charset=utf-8")
            return
        self._send(404, b"not found", "text/plain; charset=utf-8")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9120
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[yukkuri] 油库里语音服务已启动：http://127.0.0.1:{port}  （灵梦=れいむ / 魔理沙=まりさ）")
    server.serve_forever()


if __name__ == "__main__":
    main()
