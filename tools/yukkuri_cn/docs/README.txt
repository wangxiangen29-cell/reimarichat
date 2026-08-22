Yukkuri CN 使用说明
====================

github链接：https://github.com/SaLTed114/yukkuri_cn

这是一个本地中文ゆっくり语音生成器。

它会把中文转换成接近拼音读音的片假名，
再调用 AquesTalkPlayer 生成ゆっくり风格的 WAV 音频。

第一次使用
----------

1. 解压整个压缩包。

2. 双击运行：

   install_player.exe

   它会从 A-Quest 官方网站下载并安装 AquesTalkPlayer。

3. 安装完成后，双击运行：

   YukkuriCN.exe

4. 如果程序提示找不到 AquesTalkPlayer，请重新运行 install_player.exe。


推荐设置
--------

第一次安装 AquesTalkPlayer 后，建议手动打开一次：

  third_party\aquestalkplayer\AquesTalkPlayer.exe

推荐操作：

1. 选择喜欢的声种，例如「れいむ」。
2. 建议关闭「棒読み」。
3. 调整话速、音高等设置。
4. 保存为新的 preset，例如：

   れいむ_cn

   或者直接按 set 保存到原来的设置。

5. 打开 config.json，把 preset 改成：

   "preset": "れいむ_cn"

如果不想调整，也可以直接使用默认设置。


GUI 使用方法
------------

1. 在「中文输入」中输入中文。

2. 点击「转换」。

   程序会生成片假名预览。

3. 点击「播放预览」。

   程序会生成临时音频并播放。

4. 如果效果满意，点击「保存音频」。

   正式音频会保存到 output 文件夹。

5. 如果想手动调整读音：

   取消勾选「播放前自动转换」。

   然后可以直接编辑「假名预览」里的内容。

   再点击「播放预览」。


按钮说明
--------

转换：
  把中文转换成假名，并显示在假名预览区。

播放预览：
  生成临时音频并播放。
  不会保存正式文件，也不会写入历史记录。

停止：
  停止当前播放。

保存音频：
  把最后一次播放预览的音频保存成正式 WAV 文件。


菜单说明
--------

文件：
  打开输出目录
  打开历史记录
  退出

编辑：
  复制假名
  清空中文输入
  清空假名预览

查看：
  显示或隐藏调试信息

工具：
  检查 AquesTalkPlayer
  打开 config.json
  打开 dictionaries 目录


输出位置
--------

正式音频默认保存在：

  output\

播放预览的临时音频保存在：

  output\_preview\preview.wav

历史记录保存在：

  history.jsonl


命令行用法
----------

高级用户可以使用：

  ykcn.exe shell

进入交互式 shell。

批量生成：

  ykcn.exe batch input.txt

只检查转换，不生成音频：

  ykcn.exe batch input.txt --dry-run

生成后逐句播放：

  ykcn.exe batch input.txt --play

检查 AquesTalkPlayer：

  ykcn.exe check-player


批量输入格式
------------

input.txt 示例：

  你好，我是ゆっくり中文生成器。
  如果可以的话，请保存成音频文件。
  然后我再手动检查效果。

规则：

- 每行生成一个 WAV。
- 空行会被跳过。
- 以 # 开头的行会被当作注释跳过。


规则文件
--------

规则文件位于：

  dictionaries\

主要文件：

  pinyin_kana.json

    拼音到片假名的主规则表。

  pinyin_override.json

    多音字、多音词规则。

  kana_override.json

    特殊词、外来词、专有名词的强制替换规则。

如果遇到未知拼音，可以补充 pinyin_kana.json。
如果遇到多音字读错，可以补充 pinyin_override.json。


注意事项
--------

本工具不会随分发包直接附带 AquesTalkPlayer。

AquesTalkPlayer 由 A-Quest 提供。
个人非营利用途通常可以免费使用。
商业、公司、大学、服务端或其他用途，请自行确认 A-Quest 官方许可。

不要未经许可再分发 AquesTalkPlayer 下载包或其中的文件。


常见问题
--------

Q: 双击 YukkuriCN.exe 后提示找不到 AquesTalkPlayer。

A: 请先运行 install_player.exe。


Q: 播放效果不符合预期。

A: 可以打开 AquesTalkPlayer.exe 调整声种、话速、音高。
   建议尝试关闭「棒読み」。


Q: 假名预览区不能编辑。

A: 请取消勾选「播放前自动转换」。


Q: 我已经手动改了假名，但点播放后又被覆盖。

A: 请取消勾选「播放前自动转换」。


Q: 生成的音频在哪里？

A: 在 output 文件夹中。


Q: 如何批量生成？

A: 准备一个 txt 文件，每行一句，然后运行：

   ykcn.exe batch input.txt