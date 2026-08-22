# Yukkuri CN 用户与开发说明

## 1. 项目简介

Yukkuri CN 是一个本地中文ゆっくり语音生成器。

它的目标不是生成标准中文语音，而是生成一种“ゆっくり用近似中文发音读稿”的效果。

基本流程：

```text
中文文本
  ↓
中文转拼音
  ↓
拼音转片假名近似音
  ↓
AquesTalkPlayer 合成 WAV
```

例如：

```text
如果可以的话，请保存成音频文件。
```

可能被转换成：

```text
ルゥグオコーァイードーァホワ、チンバオツンチェンインピンウェンジエン。
```

这种近似音是项目的主要风格来源。

---

## 2. 分发版使用方法

分发包中通常包含：

```text
YukkuriCN.exe
ykcn.exe
install_player.exe
README.txt
dictionaries/
output/
third_party/
_internal/
```

普通用户使用步骤：

```text
1. 解压整个压缩包
2. 双击 install_player.exe
3. 双击 YukkuriCN.exe
```

如果启动 GUI 时提示找不到 AquesTalkPlayer，请重新运行：

```text
install_player.exe
```

---

## 3. AquesTalkPlayer 说明

本项目通过 AquesTalkPlayer 生成语音。

AquesTalkPlayer 是 A-Quest 提供的官方应用，使用 AquesTalk 音声合成引擎，可以进行文本朗读和 WAV 文件导出。Windows 版通过解压下载包安装，也支持命令行参数进行无窗口合成。

本项目不会随仓库或分发包直接附带 AquesTalkPlayer。安装脚本会从 A-Quest 官方网站下载并解压它。

请注意：

- AquesTalkPlayer 不属于本项目。
- AquesTalkPlayer 的使用和再分发受 A-Quest 官方许可约束。
- 个人非营利用途通常可以免费使用。
- 商业、公司、大学、服务端或其他用途请自行确认许可证。
- 未经许可不要再分发 AquesTalkPlayer 下载包或其中的文件。

---

## 4. 首次设置建议

安装 AquesTalkPlayer 后，建议手动打开一次：

```text
third_party/aquestalkplayer/AquesTalkPlayer.exe
```

推荐设置：

```text
1. 选择喜欢的声种，例如 れいむ
2. 建议关闭「棒読み」
3. 调整话速、音高等参数
4. 保存为新的 preset，例如 れいむ_cn（或者点击 set 保存到当前设置）
5. 修改 config.json 中的 preset 字段
```

示例 `config.json`：

```json
{
  "aquestalk_player": "third_party/aquestalkplayer/AquesTalkPlayer.exe",
  "preset": "れいむ_cn",
  "output_dir": "output",
  "silence_ms": 300
}
```

如果不想调整，也可以直接使用默认 preset。

---

## 5. GUI 使用方法

启动 GUI：

```text
YukkuriCN.exe
```

开发模式：

```powershell
python -m ykcn gui
```

GUI 主流程：

```text
1. 在「中文输入」中输入文本
2. 点击「转换」
3. 检查「假名预览」
4. 点击「播放预览」
5. 满意后点击「保存音频」
```

### 5.1 转换

「转换」会把中文输入转换成假名，并显示在「假名预览」区域。

如果存在未知拼音，程序会弹窗提示。此时可以检查 `dictionaries/pinyin_kana.json` 是否缺少对应规则。

### 5.2 播放预览

「播放预览」会生成临时音频并播放。

临时文件默认位于：

```text
output/_preview/preview.wav
```

播放预览不会写入 history，也不会生成正式音频。

### 5.3 保存音频

「保存音频」会把最后一次播放预览的音频保存为正式 WAV 文件，并写入 `history.jsonl`。

正式输出默认位于：

```text
output/
```

### 5.4 播放前自动转换

GUI 中有「播放前自动转换」选项。

开启时：

```text
点击「播放预览」时，会先根据中文输入重新转换假名。
假名预览区不可手动编辑。
```

关闭时：

```text
假名预览区可以手动编辑。
点击「播放预览」时，直接使用当前假名内容。
适合手动调整读音后反复试听。
```

### 5.5 菜单

菜单项包括：

```text
文件
  打开输出目录
  打开历史记录
  退出

编辑
  复制假名
  清空中文输入
  清空假名预览

查看
  显示/隐藏调试信息

工具
  检查 AquesTalkPlayer
  打开 config.json
  打开 dictionaries 目录

帮助
  关于
```

---

## 6. CLI 使用方法

分发版中使用：

```powershell
ykcn.exe shell
ykcn.exe batch input.txt
ykcn.exe check-player
```

开发模式使用：

```powershell
python -m ykcn shell
python -m ykcn batch input.txt
python -m ykcn check-player
```

如果不带子命令，默认进入 shell 模式：

```powershell
python -m ykcn
```

---

## 7. Shell 模式

启动：

```powershell
ykcn.exe shell
```

常用命令：

```text
help                  显示帮助
text <中文>            设置当前中文并转换
convert [中文]         转换当前中文或参数文本
kana                  显示当前假名
kana <假名>            手动设置当前假名
auto on/off/toggle    控制播放前是否自动转换
play [中文]            生成临时预览并播放
save [文件名.wav]      保存最后一次预览
generate [中文]        直接生成正式音频
stop                  停止播放
debug                 显示调试信息
unknown               显示未知拼音
status                显示当前状态
clear                 清空当前状态
quit / exit           退出
```

也可以直接输入中文文本，等价于：

```text
text <中文>
```

示例：

```text
ykcn> 如果可以的话，请保存成音频文件。
假名> ルゥグオコーァイードーァホワ、チンバオツンチェンインピンウェンジエン。
ykcn> play
ykcn> save
```

手动调整假名：

```text
ykcn> auto off
ykcn> kana ルーグオクーイーダーファ、チンバオツンチェンインピンウェンジエン！
ykcn> play
ykcn> save test.wav
```

---

## 8. Batch 批量生成

Batch 模式适合处理台本或大量句子。

启动：

```powershell
ykcn.exe batch input.txt
```

开发模式：

```powershell
python -m ykcn batch input.txt
```

### 8.1 输入格式

`input.txt` 示例：

```text
# 每行一句，空行和 # 开头的行会被跳过
你好，我是ゆっくり中文生成器。
如果可以的话，请保存成音频文件。
然后我再手动检查效果。
```

规则：

```text
每行生成一个 WAV。
空行跳过。
以 # 开头的行作为注释跳过。
```

### 8.2 常用参数

只转换，不生成音频：

```powershell
ykcn.exe batch input.txt --dry-run
```

生成后逐句播放：

```powershell
ykcn.exe batch input.txt --play
```

遇到未知拼音时停止：

```powershell
ykcn.exe batch input.txt --stop-on-unknown
```

给输出文件增加前缀：

```powershell
ykcn.exe batch input.txt --prefix scene01
```

---

## 9. 规则文件

规则文件位于：

```text
dictionaries/
```

主要有三个文件：

```text
pinyin_kana.json
pinyin_override.json
kana_override.json
```

### 9.1 pinyin_kana.json

拼音到片假名的主规则表。

示例：

```json
{
  "ni": "ニー",
  "hao": "ハオ",
  "wo": "ウォー",
  "shi": "シー"
}
```

大多数普通中文读音都应该通过这个文件处理。

如果出现未知拼音，通常应补充这个文件。

### 9.2 pinyin_override.json

用于处理多音字、多音词。

示例：

```json
{
  "重庆": ["chong2", "qing4"],
  "音乐": ["yin1", "yue4"],
  "银行": ["yin2", "hang2"]
}
```

它不会直接指定假名，而是强制指定拼音。指定后的拼音仍然会继续走 `pinyin_kana.json`。

适合：

```text
多音字
多音词
pypinyin 默认读错的词
```

### 9.3 override.json

用于强制替换特殊词。

示例：

```json
{
  "ゆっくり": "ユックリ",
  "AquesTalk": "アクエストーク",
  "RoboMaster": "ロボマスター"
}
```

适合：

```text
外来词
专有名词
特殊节目效果
不适合按中文拼音读的内容
```

---

## 10. 输出文件和历史记录

正式音频默认输出到：

```text
output/
```

GUI 播放预览临时文件：

```text
output/_preview/preview.wav
```

正式生成或保存音频后，会写入：

```text
history.jsonl
```

每行是一条 JSON 记录，包含：

```text
生成时间
原始中文
实际使用的假名
WAV 路径
preset
unknown 拼音
```

---

## 11. 开发模式

安装依赖：

```powershell
pip install -r requirements.txt
```

启动 GUI：

```powershell
python -m ykcn gui
```

启动 shell：

```powershell
python -m ykcn shell
```

批量生成：

```powershell
python -m ykcn batch input.txt
```

检查 AquesTalkPlayer：

```powershell
python -m ykcn check-player
```

---

## 12. 打包

推荐使用 PowerShell 脚本：

```powershell
.\build.ps1 -Clean -Zip
```

调试打包：

```powershell
.\build.ps1 -Clean -Debug
```

发布包中建议包含：

```text
YukkuriCN.exe
ykcn.exe
install_player.exe
README.txt
dictionaries/
output/
third_party/
_internal/
```

不要把已经下载好的 AquesTalkPlayer 直接放入发布包，除非确认许可证允许再分发。

---

## 13. 项目结构

当前建议结构：

```text
ykcn/
  __init__.py
  __main__.py

  cli.py
  shell.py
  batch.py
  gui.py
  gui_tk.py

  engine/
    __init__.py
    app.py
    pinyin_kana.py
    aquestalk_player.py
    config.py

  utils/
    __init__.py
    audio.py
    filename.py
    history.py
    runtime.py
    wav.py
```

含义：

```text
ykcn 顶层：
  用户入口和模式分发

engine：
  转换、合成、配置、应用编排

utils：
  播放、文件名、history、WAV、runtime 等辅助函数
```

---

## 14. 常见问题

### Q: 启动后提示找不到 AquesTalkPlayer。

请先运行：

```text
install_player.exe
```

或开发模式：

```powershell
python install_player.py
```

### Q: 假名预览区不能编辑。

请取消勾选：

```text
播放前自动转换
```

### Q: 我手动改了假名，但播放时又被覆盖。

请关闭：

```text
播放前自动转换
```

### Q: 生成的音频在哪里？

默认在：

```text
output/
```

### Q: 播放效果不符合预期。

可以打开 AquesTalkPlayer 调整声种、话速、音高等设置。建议尝试关闭「棒読み」，然后保存成自定义 preset。

### Q: 出现未知拼音怎么办？

优先补充：

```text
dictionaries/pinyin_kana.json
```

如果是多音字读错，补充：

```text
dictionaries/pinyin_override.json
```

如果是外来词或特殊词，补充：

```text
dictionaries/override.json
```

### Q: 可以商用吗？

本项目本身是否可商用取决于项目代码许可证。

AquesTalkPlayer 不属于本项目。它的使用、商业用途和再分发请以 A-Quest 官方许可为准。

---

## 15. 许可证说明

本项目代码的许可证请见仓库中的 `LICENSE`。

AquesTalkPlayer 由 A-Quest 提供，不属于本项目。使用 AquesTalkPlayer 时，请遵守 A-Quest 官方许可。
