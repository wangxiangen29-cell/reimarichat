# -*- coding: utf-8 -*-
"""下载 dairi 仿黄昏绘立绘差分全量原图（仅供本站差分标注使用）

用法：
    python tools/download_portraits.py            # 直连
    python tools/download_portraits.py 7897       # 走本机代理端口

来源（免费素材，感谢 dairi）：
    灵梦  https://www.pixiv.net/artworks/39486261（27 页差分）
    魔理沙 https://www.pixiv.net/artworks/39261304（54 页差分）

下载到 public/avatars/src/{reimu|marisa}_p{NN}.png（约 33MB），
之后打开 http://localhost:3000/label.html 手动标注各情绪使用的差分。
注意：该目录已在 .gitignore 中（版权与体积考虑，请勿提交或再分发）。
"""
import json
import os
import sys
import urllib.request

ILLUSTS = [('reimu', 39486261), ('marisa', 39261304)]
DST_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'avatars', 'src')


def main():
    proxy_port = sys.argv[1] if len(sys.argv) > 1 else None
    if proxy_port:
        proxies = {'http': f'http://127.0.0.1:{proxy_port}', 'https': f'http://127.0.0.1:{proxy_port}'}
        opener = urllib.request.build_opener(urllib.request.ProxyHandler(proxies))
    else:
        opener = urllib.request.build_opener()
    opener.addheaders = [('Referer', 'https://www.pixiv.net/'), ('User-Agent', 'Mozilla/5.0')]

    os.makedirs(DST_DIR, exist_ok=True)
    for name, illust in ILLUSTS:
        req = urllib.request.Request(
            f'https://www.pixiv.net/ajax/illust/{illust}/pages?lang=zh',
            headers={'Referer': f'https://www.pixiv.net/artworks/{illust}', 'User-Agent': 'Mozilla/5.0'})
        pages = json.load(opener.open(req, timeout=40))['body']
        print(f'{name}: {len(pages)} 页')
        for i, p in enumerate(pages):
            dst = os.path.join(DST_DIR, f'{name}_p{i:02d}.png')
            if os.path.exists(dst) and os.path.getsize(dst) > 0:
                continue
            with opener.open(p['urls']['original'], timeout=120) as r, open(dst, 'wb') as f:
                f.write(r.read())
            print(f'  {name}_p{i:02d} ok')
    print('全部完成')


if __name__ == '__main__':
    main()
