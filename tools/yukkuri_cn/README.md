# Yukkuri CN

Yukkuri CN 是一个本地中文ゆっくり语音生成器。

它不是标准中文 TTS，而是把中文转换成接近拼音读音的片假名，再调用 AquesTalkPlayer 生成ゆっくり风格的 WAV 音频。

```text
中文文本
  ↓
中文 → 拼音
  ↓
拼音 → 片假名近似音
  ↓
AquesTalkPlayer
  ↓
WAV 音频
```

## 什么是ゆっくり？

「ゆっくり」通常指源自日本网络文化、并与东方Project二次创作关系密切的一类角色形象与视频风格。其标志性台词是「ゆっくりしていってね!!!」，中文圈也常称为「油库里」或「馒馒来」。在后来的视频创作中，「ゆっくり」也常和软件合成语音、解说视频、实况视频等形式联系在一起。

本项目借用的是这种“ゆっくり语音”的风格方向：将中文文本转换成近似拼音读法的片假名，再交给 AquesTalkPlayer 生成带有ゆっくり风格的语音。它不是标准中文 TTS，而是一个偏风格化、娱乐化的本地语音生成工具。

更多背景可以参考：

- THBWiki：[馒馒来](https://thwiki.cc/%E9%A6%92%E9%A6%92%E6%9D%A5)
- ピクシブ百科事典：[ゆっくりしていってね](https://dic.pixiv.net/a/%E3%82%86%E3%81%A3%E3%81%8F%E3%82%8A%E3%81%97%E3%81%A6%E3%81%84%E3%81%A3%E3%81%A6%E3%81%AD)

## 功能概览

- 中文文本转片假名近似音
- 本地调用 AquesTalkPlayer 生成 WAV
- GUI 单句/短段生成：
  - 中文输入
  - 假名预览
  - 播放预览
  - 保存音频
  - 可手动调整假名
- CLI：
  - shell 交互模式
  - batch 批量生成
  - AquesTalkPlayer 检查
- 支持规则文件：
  - `pinyin_kana.json`
  - `pinyin_override.json`
  - `kana_override.json`
- 生成历史记录：
  - `history.jsonl`

## 快速使用

分发版用户：

```text
1. 解压压缩包
2. 双击 install_player.exe
3. 双击 YukkuriCN.exe
```

开发模式：

```powershell
python -m ykcn gui
python -m ykcn shell
python -m ykcn batch input.txt
python -m ykcn check-player
```

## 重要说明

本项目不会直接附带 AquesTalkPlayer。

AquesTalkPlayer 由 A-Quest 提供。请通过 `install_player.exe` 或 `install_player.py` 从 A-Quest 官方网站下载并安装。

AquesTalkPlayer 的使用和再分发受 A-Quest 官方许可约束。个人非营利用途通常可以免费使用；商业、公司、大学、服务端或其他用途请自行确认许可证。未经许可不要再分发 AquesTalkPlayer 下载包或其中的文件。

## 详细文档

请查看：

```text
docs/USER_GUIDE.md
```

其中包含：

- 安装说明
- GUI 使用方法
- CLI 使用方法
- batch 批量生成
- 规则文件说明
- AquesTalkPlayer 设置建议
- 常见问题
- 项目结构
