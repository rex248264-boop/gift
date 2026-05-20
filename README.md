# 想见你 · 画面式互动 web AVG

一个适配 iPhone 17 Pro 的中文互动 AVG，**以 `.md` 剧本为唯一数据源** —— 你改剧本，游戏跟着变。

---

## 核心理念

| 你的痛点 | 这套设计的解法 |
|---------|---------------|
| 文案随时要改 | 你的 `.md` 文件**就是**游戏数据。Vite 监听 `.md`，保存后浏览器自动重新加载当前画面，零导出步骤 |
| 不想破坏剧本格式 | 解析器适配你**已有**的画面式格式（`## Frame X.Y` / `### 画面描述` / `### 背景旁白` / `### 对话` / `### 转场`），不需要改任何一行 |
| 素材随时挂载 | 按命名约定自动加载；个别例外用 HTML 注释 `<!-- bg: xxx.jpg -->` 覆盖 |
| 资源缺失时不崩溃 | 缺背景图 → 显示"场景"文字占位；缺语音 → 只显示文字；缺立绘 → 显示角色名牌；**今天就能跑，资源边做边补** |
| 测试某一场不想从头玩 | 右上角"⚙ Dev"面板：任意场次/任意画面/任意 flag 都能跳/改 |

---

## 快速开始

```bash
cd xiangjianni-game
npm install
npm run dev
```

浏览器打开 http://localhost:5173 即可。

**在 iPhone 上看实机效果**：
```bash
npm run dev:host
```
然后用 iPhone 浏览器访问 `http://<你电脑的局域网 IP>:5173`（需要同一 WiFi）。
更稳的方式：装 [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 或 [ngrok](https://ngrok.com/) 给本地端口暴露 https。

---

## 修改剧本的工作流

剧本文件在 `scripts/想见你/` 下，就是你**已有的那些 `.md`**。

### 改一句台词

1. 在 Cursor 打开 `scripts/想见你/03-S01.md`
2. 把 `**他**：「姐姐——生日快乐。」` 改成你想要的
3. 保存 → 浏览器自动刷新到当前画面，新台词立刻生效

### 改一个选项的跳转

```markdown
- A) 救他 → S06a    ← 改这里
- B) 听他 → S06b
```

保存 → 浏览器右上角 Dev 面板会显示是否有跳转目标缺失。

### 改场次顺序 / 增删场次

只要新增的文件名包含 `S<数字>` 模式（如 `08-S05b.md`），就会自动被识别为新场次。

---

## 挂载素材

### 1. 约定命名（推荐，剧本里不用动）

把素材按下表命名后放进 `public/assets/`，游戏会自动加载。

| 类型 | 路径 | 命名 | 示例 |
|------|------|------|------|
| 背景图 | `public/assets/bg/` | `{SceneId}-{FrameId}.jpg` | `S01-1.1.jpg` |
| BGM | `public/assets/audio/bgm/` | `{SceneId}.mp3` | `S01.mp3` |
| 男主语音 | `public/assets/audio/voice/he/` | `{SceneId}-{FrameId}-d{N}.mp3` | `S01-1.1-d1.mp3`（=本场本帧第 1 句男主台词） |
| 立绘（男主） | `public/assets/sprite/he/` | `{state}.png` | `smile.png` / `tender.png` / `fade.png` |
| 立绘（女主） | `public/assets/sprite/she/` | `{state}.png` | 同上 |
| 微动效 | `public/assets/effects/` | 任意名 `.webm` 或 `.mp4` | `candle-flicker.webm` |

立绘的 `state` 由 `**他**（动作）` 里的动作关键词自动推断：
- `笑` / `弯了弯眼` → `smile`
- `疼` / `皱` / `颤` → `pain`
- `淡化` / `消散` / `粒子` → `fade`
- 其他 → `default`

把更多状态命名好的立绘放进去即可（建议你提供 10+ 状态的话用：`default` `smile` `tender` `tease` `serious` `pain` `angry` `low` `blink` `fade`）。

### 2. 在剧本里挂特殊素材（HTML 注释）

如果某画面要用非默认资源，在 `.md` 里加 HTML 注释：

```markdown
### 画面描述

<!-- bg: special-candle-close.jpg -->
<!-- effect: lapel-gold-light.webm  effectPos:center-top -->
<!-- bgm: S01-warm-piano.mp3 -->

**场景**【第三人称】：夜里的私人玻璃花房；...
```

支持的注释 key：
- `bg`：背景图路径（相对 `assets/bg/` 或绝对 `/assets/...`）
- `bgm`：BGM 路径
- `sfx`：单次音效路径
- `voice`：覆盖男主语音文件名（只对该句生效，放在对话块里）
- `effect`：微动效文件名
- `effectPos`：微动效位置（`center` / `center-top` / `center-bottom` / `left` / `right` / `full`）
- `sprite`：覆盖立绘文件名

HTML 注释在 Markdown 预览里是**不可见的**，所以剧本读起来依然干净。

### 3. 查看缺哪些素材

```bash
npm run audit
```

会列出**所有期望但缺失的资源路径**，照着补就行。

---

## 项目结构

```
xiangjianni-game/
├── public/assets/             # 所有素材放这里（按命名约定）
│   ├── bg/                    # 背景图
│   ├── sprite/                # 立绘
│   │   ├── he/                # 男主多状态
│   │   └── she/               # 女主多状态
│   ├── effects/               # 微动效（webm/mp4）
│   └── audio/
│       ├── bgm/
│       ├── sfx/
│       └── voice/he/          # 男主语音
├── scripts/想见你/             # 你的 .md 剧本（拷贝或软链）
├── src/
│   ├── parser/                # .md → 运行时数据
│   ├── engine/                # 状态/分支/存档/资源解析
│   ├── audio/                 # Howler 封装
│   ├── components/            # 画面四块的 React 组件
│   ├── pages/                 # 标题页 / 游戏页 / 结局页 / Dev 调试面板
│   ├── styles/                # 全局样式（safe-area / 字体）
│   ├── App.tsx
│   └── main.tsx
├── tools/
│   ├── validate.ts            # npm run validate  → 检查跳转完整性
│   └── asset-audit.ts         # npm run audit     → 缺失素材清单
└── README.md（本文件）
```

---

## iPhone 17 Pro 适配要点

- **Viewport**: `width=device-width, viewport-fit=cover` 让内容延伸到 Dynamic Island 和 home indicator 区域
- **Safe Area**: 对话框/标题用 `env(safe-area-inset-*)` 留出空间
- **Tap 推进**: 整屏 tap 推进对话；当前对话框 tap 一次先把"打字机"全部显示
- **音频解锁**: 首次进入需要点击"开始新游戏"才能播放 BGM 和语音（iOS 自动播放限制）
- **添加到主屏幕**: 已经预留 PWA 元信息（`apple-mobile-web-app-capable`），后续接 PWA 插件后可加书签当 app 用
- **横屏切回竖屏**: 设置已锁定竖屏体验，横屏会显示同样布局（推荐用户保持竖屏）

---

## Dev 调试面板（开发模式可见）

右上角 `⚙` 按钮打开。可以：

- 跳到任意场次、任意画面
- 手动改 flag（爱意值 `loveValue`、关键 flag `saveHim` 等）
- 一键 `+ loveValue` 测试 S06a / S06b 分支
- 看剧本诊断（跳转目标不存在等）
- `↻ 重新解析剧本`（一般 HMR 自动触发，这里是手动 fallback）

发布版（`npm run build`）会自动剥离 Dev 面板。

---

## 常用命令

```bash
npm run dev          # 启动本地开发
npm run dev:host     # 启动 + 监听局域网（手机访问）
npm run validate    # 校验剧本（跳转完整性、ID 唯一性）
npm run audit        # 列出缺失素材
npm run build        # 构建生产版本到 dist/
npm run preview      # 预览构建结果
```

---

## 下一步路线图

- [x] M0：项目骨架 + .md 解析器 + 画面四块渲染 + Dev 面板
- [ ] M1：素材按约定加载（先放 1-2 张背景 + 1 段 BGM 验证管线）
- [ ] M2：立绘多状态接入 + 自动状态推断校准
- [ ] M3：S05 关键选择 + 爱意值机制 + S06a/b 分支
- [ ] M4：富过渡（吹灭蜡烛 → 世界扭曲）特效
- [ ] M5：CG / Gallery / 存档槽
- [ ] M6：PWA + 真机性能调优
- [ ] M7：发布（Cloudflare Pages / Vercel / GitHub Pages）

---

## 故障排除

**问：保存 .md 后浏览器没有自动刷新**
- 确认 `npm run dev` 在跑
- 检查浏览器 Console 是否报错
- 在 Dev 面板点 `↻ 重新解析剧本` 手动触发

**问：背景图放进去了但没显示**
- 检查命名是否完全匹配（区分大小写、半角破折号）
- 路径必须是 `public/assets/bg/S01-1.1.jpg` 而不是 `S01-Frame1.1.jpg`
- 打开浏览器 DevTools 看 Network 标签，会看到尝试加载的路径

**问：iPhone 上字体看起来不对**
- 已配置 `PingFang SC` 优先，iPhone 自带这个字体
- 如果想换成其他字体，编辑 `src/styles/index.css` 里的 `--font-serif`
