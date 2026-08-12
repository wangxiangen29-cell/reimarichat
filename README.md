# 红白与黑白 · 主角组对谈站

让博丽灵梦和雾雨魔理沙（AI）互相聊天的网页，支持手动对谈、自动闲聊和观众话题投票。

## 在线体验

部署到免费云平台后，直接打开平台分配的网址即可使用；部署方法见文末「公开部署指南」。

## 本地运行

需要 Node.js 18 或以上（自带 fetch），无需安装任何依赖：

```bash
node server.js
```

然后打开浏览器访问：http://localhost:3000

## 功能

- **手动对谈**：设定话题后，两位主角轮流接话（默认每轮 3~12 句可选）；对话结束后按按钮会变成"继续对话"，接着上一段聊下去，点"清空"则重新开始。
- **旁白插话**：观众可以插入一句旁白（场景或事件），角色会自然地接住剧情，不会出现"第三者"乱入。
- **自动闲聊**：独立的界面（页面顶部"手动对谈 / 自动闲聊"切换）；后台开启后自动跳到该界面，直播两人不停地闲聊。
- **话题投票**：自动闲聊时，观众可以提议话题；新话题先进候选池，攒够票数立即切换，否则每轮结束自动换成票数最高的话题；没人提议时系统随机换题。
- **自动总结**：手动对谈和自动闲聊都会在对话积累到一定条数后自动把旧内容压缩成"前情提要"，只保留最近几条原文，节省 token 并保持上下文连贯。
- **自查 AI（防 OOC）**：在"设置 → 总结 API 与自查 AI"里开启并填入自己的 API Key 后，每次手动对谈输出前都会由自查 AI 检查台词是否符合角色人设与东方世界观，必要时自动润色；不配置则不启用，不使用内置 API。
- **总结 API 可单独配置**：总结默认用内置 API，也可以在设置里切换到"自定义"，单独填自己的总结 API Key/地址/模型。
- **演示模式**：不接 AI 时用内置台词演出，开箱即玩。
- **人设管理**：手动对谈的人设所有用户都可以修改（存在自己浏览器里，默认预设为主角组 CP 向）。每位角色的人设分三部分：基础设定（不建议修改）、补充设定（自由填写）、系统提示词（由前两者自动组合，不建议修改）。自动闲聊的人设在 `config.json` 中修改（`autoPersonaReimu` / `autoPersonaMarisa`）。
- **一设数据库**：内置东方Project官方设定参考库（整理自 THBWiki 并概括提取主角组相关部分），包含灵梦/魔理沙一设、幻想乡基础世界观、主角组关系、AI 易错提醒四类内容，随每次手动对谈请求发给 AI，防止角色崩塌；所有用户都可以在页面"一设"面板里修改自己的版本（存在本机浏览器），也可以一键恢复默认。

## 内置 AI（DeepSeek）

站点默认内置了一个 DeepSeek API Key（配置在 `config.json` 的 `deepseekApiKey`），由服务器代为调用，**不会下发给浏览器**。页面设置里也可以填自己的 Key（覆盖内置），接口兼容 OpenAI 格式。

⚠️ 如果网站要公开，请务必注意：

- `config.json` 里有 API Key 和管理员口令，已加入 `.gitignore`，不要提交到仓库或发给别人。
- 想停用内置 AI 时，把 `config.json` 的 `aiEnabled` 改成 `false` 即可，保存后自动生效。
- 如果 Key 曾在不安全的环境里出现过，建议到 DeepSeek 控制台重新生成一个。

## 后台管理（直接改 config.json）

前端不再提供管理员界面。所有服务器级开关都通过直接编辑 `config.json` 管理，服务器会**自动热加载**，保存后几秒内生效，无需重启：

- `aiEnabled`：内置 AI（DeepSeek）开关，`false` 时自动退回演示台词。
- `autoChatEnabled`：自动闲聊开关，`true` 时两人持续对话。
- `autoPersonaReimu` / `autoPersonaMarisa`：自动闲聊的人设。
- `personaReimu` / `personaMarisa`：手动对谈的默认人设（观众可在页面里用自己的版本覆盖）。
- `canonReimu` / `canonMarisa` / `canonWorld` / `canonPair` / `canonAiNotes`：自动闲聊使用的默认一设数据库（灵梦、魔理沙、世界观、主角组关系、AI 易错提醒）。
- `canonEnabled`：一设数据库总开关（默认 `true`；设为 `false` 时自动闲聊不再注入一设）。
- `adminToken`：管理员口令（仅供调试接口使用，页面不再展示管理员界面）。

可调参数（都在 `config.json`）：

- `topicRoundSec`：无票时每多少秒轮换一次话题（默认 180）。
- `switchVotes`：候选话题攒够多少票立即切换（默认 3）。
- `maxCandidates`：候选池上限（默认 12）。
- `proposalCooldownSec`：同一观众两次提议的最小间隔（默认 30）。
- `summarizeAfter`：对话积累到多少条后自动总结（默认 20，设 0 关闭）。
- `summaryKeepRecent`：总结后保留最近几条原文（默认 6）。
- `rateLimitPerMin`：每个访客每分钟最多调用 AI 的次数（默认 20，防刷）。

"总结 API 与自查 AI"配置（在页面设置里，保存在浏览器本地）：

- 总结 API：「默认内置」或「自定义」（自定义时填 Key、接口地址、模型）。
- 自查 AI：「关闭」/「开启」（开启时填自己的 Key、接口地址、模型；每次输出前多一次检查调用，费用走你自己的 API）。

## 文件说明

- `server.js`：本地服务器（静态页面、AI 转发、自动闲聊、话题投票、配置热加载、限流与 CORS）。
- `public/`：前端页面（`index.html`、`style.css`、`app.js`、`demo.js`、`avatars/`），页面为幻想乡主角组风格（灵梦红白 × 魔理沙金黑，御朱印、鸟居纹样）。
- `config.json`：服务器配置（Key、管理员口令、开关，已 .gitignore）。
- `Procfile`：云平台启动文件（Render 等使用）。

## 立绘来源与版权

页面使用的角色头像为 **dairi / だいり** 的仿黄昏绘（伪黄昏绘）作品，从全身立绘裁出头部特写，原图来自 Pixiv：

- 博丽灵梦：https://www.pixiv.net/artworks/39486261
- 雾雨魔理沙：https://www.pixiv.net/artworks/39261304

仅用于个人同人学习交流，版权归原作者所有；如原作者要求，可随时替换图片（直接覆盖 `public/avatars/` 下同名文件即可）。
## 公开部署指南（免费、免备案）

本站是 **Node.js 服务端应用**（有后台进程、自动闲聊、AI 转发），不是纯静态页面，因此：

- ❌ **GitHub Pages 不行**：只托管静态文件，无法运行 Node.js 服务。
- ✅ 需要找能跑 Node.js 的免费托管平台（海外平台，均无需备案）。

### 推荐平台

| 平台 | 免费额度 | 适合本站的原因 | 注意事项 |
|---|---|---|---|
| **Koyeb**（首选） | 1 个免费 Web 服务（512MB 内存），无需信用卡 | 不睡眠，自动闲聊可持续运行 | 使用生成的公共 URL，无需买域名 |
| **Wasmer** | Hobby 免费：3 个 app、每月 10 万请求 | 可从 GitHub 导入仓库，中文界面友好 | 免费额度有存储/流量限制 |
| **Render** | 免费 750 小时/月 | 部署最简单，GitHub 一键 | 15 分钟无访问会休眠，唤醒需 30~60 秒，自动闲聊会暂停 |
| Zeabur | 免费档目前不稳定（2026 年部分账号仅付费） | 界面简单 | 不推荐作为首选 |

### 部署前必读：环境变量（不要把 config.json 传上去）

`config.json` 含 API Key 和管理员口令，**绝不能提交到公开仓库**（已在 `.gitignore` 中）。云平台上通过"环境变量"注入：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | DeepSeek 密钥。**建议新建一个专用 Key**（本地开发用的 Key 已在 config.json 里出现过，公开部署等于暴露给所有访客） |
| `ADMIN_TOKEN` | 建议 | 管理员口令；不填则每次重启随机生成，无法远程管理 |
| `AI_ENABLED` | 可选 | 内置 AI 总开关，`true` / `false` |
| `AUTO_CHAT_ENABLED` | 可选 | 自动闲聊开关，`true` / `false`（建议先 `false`，确认正常再开） |
| `RATE_LIMIT_PER_MIN` | 可选 | 每个访客每分钟最多调用 AI 的次数（默认 20，防刷） |
| `DEEPSEEK_MODEL` | 可选 | 模型名，默认 `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | 可选 | 接口地址，默认 `https://api.deepseek.com/v1` |

环境变量优先级高于 `config.json`。即使云平台文件系统是临时的，每次重启也会自动用环境变量重建配置。

### Koyeb 部署步骤（推荐）

1. 注册 GitHub 账号（如已有可跳过），把本项目推送到一个 **私有仓库**（私有即可，部署不需要公开）：
   ```bash
   git init
   git add .
   git commit -m "init"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```
   （`config.json` 已在 `.gitignore` 中，不会被上传。）
2. 打开 [koyeb.com](https://koyeb.com)，用 GitHub 登录（无需信用卡）。
3. 点 **Create App** → 选择刚推送的 GitHub 仓库 → 平台自动识别 Node.js。
4. 在 **Environment variables** 里填上表必填项（至少 `DEEPSEEK_API_KEY`、`ADMIN_TOKEN`）。
5. 点 **Deploy**，等 2~5 分钟，访问生成的 `https://<应用名>.koyeb.app`。

### Render 部署步骤（备选，简单但有休眠）

1. 同上把项目推到 GitHub 私有仓库。
2. 打开 [render.com](https://render.com) → GitHub 登录 → **New → Web Service**。
3. 选择仓库，框架自动识别 Node，Start Command 填 `node server.js`（或直接用仓库里的 Procfile）。
4. 添加环境变量（同上表）。
5. 部署后访问 `https://<服务名>.onrender.com`。

### Wasmer 部署步骤（备选）

1. 打开 [wasmer.io](https://wasmer.io)，GitHub 登录。
2. **Create App** → 选择 GitHub 仓库 → 选 Node.js 运行时。
3. 在环境变量中填写上表内容。
4. 部署完成后访问分配的 URL。

### 公开后的安全建议

- 后台不提供网页管理界面，一切开关通过环境变量或 `config.json` 管理。
- 内置 AI Key 会供所有访客使用（访客也可以填自己的 Key 覆盖）。若担心额度，把 `AI_ENABLED=false` 或换成额度有限的专用 Key，并配合 `RATE_LIMIT_PER_MIN` 限制。
- 需要改人设/一设数据库时，编辑本地 `config.json` 后重新推送；云平台上的持久改动建议用环境变量实现。
