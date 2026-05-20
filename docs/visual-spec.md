# 想见你 · Visual Spec v1

> 本文档是「想见你」UI 视觉规范的单一真实来源。所有组件样式、设计令牌、装饰元素的修改都必须先更新本文档，再同步到 `src/styles/tokens.css` 与组件 CSS。

## 0. 设计画布

**全局设计基线**：`1206 × 2442 px`（@3x，等同于约 `402 × 814` 逻辑像素的竖屏机型）

- 所有 UI 资源（PNG / 背景视频 / 角色立绘）按此画布尺寸出图。
- 适配方案：游戏视口 `100vw × 100vh`，组件用相对单位与 `min(px, vw-margin)` 自动缩放；窄屏设备会按比例自动缩小，更宽屏幕由 safe-area + 居中收住，必要时左右留黑。
- 视图方向：仅竖屏。横屏锁屏或显示提示页。
- 视口元标签：`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`

### 0.1 背景层级（z-index）

| 层级 | z-index | 用途 |
|---|---|---|
| SceneBackground 视频/图像 | 0 | 全屏场景背景，object-fit: cover |
| MicroEffect 局部覆层 | 1 | 仅在 `<!-- effect: ... -->` 显式声明时出现 |
| NarrationBox | 3 | 旁白文字 PNG 容器 |
| DialogueBox | 5 | 对话气泡 PNG |
| ChoiceMenu overlay | 10 | 选择遮罩 + 选项卡片 PNG + 红色横幅 |
| TopBar / BottomControls | 20 | 顶/底栏 |
| Transition | 50 | 转场黑屏 |

### 0.2 PNG 透明约定

所有 UI 资源（`dialogue-bubble.png`、`narration-background.png`、`choice-*.png`）的轮廓外像素为透明，CSS 上**禁止**对承载这些 PNG 的元素施加 `background-color` 或彩色 `background-image` 渐变，必须保留 PNG 自身的描金留白质感。透明区域应露出底层的 SceneBackground 视频/图像。

允许的修饰仅限于：

- `filter: drop-shadow(...)` —— 跟随 PNG 实际轮廓的阴影。
- `transform`、`opacity` —— 动效相关。
- 选中态切换 `background-image`（如 `--bg-choice-normal` → `--bg-choice-selected`）。

### 0.3 全局场景背景

在每个 frame 拥有自己的 `/assets/bg/{SceneId}-{FrameId}.{jpg|png|webp|mp4|webm}` 之前，引擎会回退到 `/assets/bg/_default.mp4`（当前等同于 `S01-1.1.mp4`），让整个游戏在缺资源期间也有视觉流动感。

资源就位后**直接覆盖** `_default.mp4` 即可全局切换占位视频；为单帧设资源时按命名约定放入 `/assets/bg/` 自动接管。

## 1. 设计语言

**关键词**：古风 · 江南 · 仙侠雅致 · 描金留白 · 命运感
**参考画风**：宋画山水 + 仙侠手游 UI（恋与制作人 / 光与夜之恋 / 古剑奇谭）的描金留白系
**情绪曲线**：日常温润 → 关键抉择时金线发光、红色横幅压迫 → 高光时刻蜡烛玫瑰暖光

## 2. 色板 Tokens

### 2.1 主色（描金体系）

| Token | Hex | 说明 | 来源 |
|---|---|---|---|
| `--gold-line` | `#C9A86A` | 主描金线条、双边框外圈 | 提取自所有 PNG 的金边 |
| `--gold-line-soft` | `#D9BE85` | 描金内圈、装饰线、低对比金 | 双边框内圈 |
| `--gold-deep` | `#A88450` | 强调金、点缀符号（菱形、勾） | 选中态菱形、纹饰 |
| `--gold-glow` | `#F4D58A` | 高光金（候选 hover / 灯效） | 蜡烛火焰外圈 |

### 2.2 容器底色（仅作 fallback 用，禁止覆盖 PNG）

PNG 自身已含底色质感。下列 token 仅在 PNG 缺失或需要绘制额外面板（如 banner、debug 面板）时使用。

| Token | Hex | Alpha | 说明 |
|---|---|---|---|
| `--cream-bg` | `#F4ECDA` | 0.88 | fallback：选项 normal 态 |
| `--cream-soft` | `#FFF6E3` | 0.92 | fallback：选项 selected 态、确认按钮 |
| `--paper-warm` | `#FAF3DF` | 0.85 | fallback：对话气泡 |
| `--candle-warm` | `#FFE4B0` | 0.95 | fallback：旁白容器 |

### 2.3 文字色（墨色体系）

| Token | Hex | 说明 |
|---|---|---|
| `--ink-deep` | `#3D2C1A` | 主对话文字、选项文字 |
| `--ink-soft` | `#5C4830` | 旁白、次要文本 |
| `--ink-mute` | `#8A7758` | 提示、占位、动作描述 |
| `--ink-name` | `#A88450` | 角色名（与 `--gold-deep` 一致） |

### 2.4 强调色

| Token | Hex | 说明 |
|---|---|---|
| `--accent-red` | `#9B2C2C` | 「命运的分岔」红色横幅、关键警示 |
| `--accent-red-soft` | `#C25555` | 红色 hover/active |

### 2.5 状态色

| Token | Hex / Alpha | 说明 |
|---|---|---|
| `--state-disabled` | `#B8B0A2` | 禁用态文字、灰化选项 |
| `--state-shadow` | `rgba(58, 38, 18, 0.35)` | 通用阴影 |
| `--state-glow-gold` | `rgba(201, 168, 106, 0.55)` | 金色发光（hover/active） |
| `--state-overlay-dark` | `rgba(0, 0, 0, 0.55)` | 极暗遮罩（仅转场使用） |

## 3. 字体 Tokens

```
--font-serif:  "Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", "PingFang SC", serif;
--font-sans:   "PingFang SC", "HarmonyOS Sans SC", -apple-system, BlinkMacSystemFont, sans-serif;
--font-fancy:  "Source Han Serif SC", "ZCOOL XiaoWei", "Noto Serif SC", serif;
```

### 字号阶（rem 基于 16px）

| Token | px | 用途 |
|---|---|---|
| `--fs-xs` | 12 | 辅助文本（顶栏标签、底栏按钮） |
| `--fs-sm` | 14 | 提示文本 |
| `--fs-base` | 16 | 对话/选项正文 |
| `--fs-md` | 18 | 旁白 |
| `--fs-lg` | 20 | 角色名、确认按钮文字 |
| `--fs-xl` | 24 | 红色横幅、章节标题 |
| `--fs-2xl` | 32 | 标题屏 |

### 行高 & 字间距

| 场景 | line-height | letter-spacing |
|---|---|---|
| 对话正文 | 1.7 | 0.04em |
| 旁白 | 1.85 | 0.08em |
| 选项 | 1.4 | 0.08em |
| 角色名 | 1.1 | 0.18em |
| 红色横幅 | 1.0 | 0.32em |
| 确认按钮 | 1.0 | 0.40em |

## 4. 尺寸与间距 Tokens

```
--radius-pane:   32px         /* fallback：对话气泡 */
--radius-card:   16px         /* 顶栏/底栏胶囊按钮 */
--radius-pill:   9999px       /* fallback：选项、确认按钮 */
--radius-chip:   8px          /* 小标签 */

--space-1: 4   --space-2: 8   --space-3: 12   --space-4: 16
--space-5: 24  --space-6: 32  --space-7: 48   --space-8: 64
```

## 5. 核心容器规范

### 5.1 DialogueBox · 对话气泡

**视觉来源**：`assets-source/ui-reference/01-dialogue-bubble.png`（透明 PNG，1024×425）

**关键参数**：

| 元素 | 规范 |
|---|---|
| 容器宽度 | `min(580px, calc(100vw - var(--space-5)))` |
| 容器宽高比 | `aspect-ratio: 1024 / 425`（跟随 PNG） |
| padding | `0`（PNG 自带留白；内容用绝对定位的子区域覆盖） |
| border | `none`（PNG 自带描金线） |
| background-image | `var(--bg-dialogue)`，`background-size: 100% 100%`，`background-repeat: no-repeat` |
| background-color | **禁止**，保留 PNG 透明 |
| 阴影 | `filter: drop-shadow(0 12px 28px var(--state-shadow))` |
| 名牌区域 | 容器内绝对定位 `top: 2%; left: 7%; width: 28%; height: 18%`，与 PNG 上左角名牌位对齐 |
| 名字字体 | `--font-fancy`，`--fs-base`，`--ink-name`，`letter-spacing: 0.18em` |
| 别名（英文） | `--ink-mute`，`font-style: italic`，10px |
| 正文区域 | 绝对定位 `top: 22%; bottom: 10%; left: 9%; right: 9%`，flex 列向排布 |
| 正文字体 | `--font-serif`，`--fs-base`，`--ink-deep`，`line-height: 1.7` |
| 动作（括号内） | 正文区上方独立行，`--ink-mute`，`font-style: italic`，`--fs-xs` |
| 打字机速度 | 35 ms / 字 |

**位置**：屏幕底部 `bottom: calc(env(safe-area-inset-bottom) + var(--space-7))`，水平居中。

### 5.2 NarrationBox · 背景旁白容器

**视觉来源**：`assets-source/ui-reference/02-narration-background.png`（透明 PNG，1024×323）

**用途**：「### 背景旁白」类长段氛围文字。比对话框更"沉重"。

| 元素 | 规范 |
|---|---|
| 容器宽度 | `min(620px, calc(100vw - var(--space-4)))` |
| 容器宽高比 | `aspect-ratio: 1024 / 323` |
| padding | `8% 14% 8% 12%`（避开 PNG 装饰角） |
| background-image | `var(--bg-narration)`，`background-size: 100% 100%` |
| background-color | **禁止** |
| 阴影 | `filter: drop-shadow(0 8px 24px var(--state-shadow))` |
| 文字色 | `--ink-soft` |
| 文字字号 | `--fs-md` |
| 文字风格 | `font-style: italic`，`line-height: 1.85` |
| 文字对齐 | 居中（短旁白）/ 左对齐（长段，根据行数自动） |
| 出现动效 | fade-in + slide-up 8px，600ms，`--ease-out-soft` |

**位置**：屏幕中上偏下（`top: 35vh`），与对话框不同时出现。

### 5.3 ChoiceMenu · 选择菜单（2 步流程）

#### 5.3.1 红色横幅（顶部）

| 元素 | 规范 |
|---|---|
| 高度 | 由 padding 与字号决定（约 48–56px） |
| 背景 | `--accent-red`（实色 banner，非 PNG，可保留 background-color） |
| 文字色 | `rgba(255, 250, 245, 0.98)` |
| 文字字号 | `--fs-md` |
| 文字字距 | `0.32em` |
| 文字内容 | 来自脚本 `<!-- choice-banner: ... -->`，缺省 `命运的分岔就此开启` |
| 装饰 | 左右 `❖` 菱形符号 |
| 阴影 | `0 4px 14px rgba(155, 44, 44, 0.45)` + 内描金亮线 |

#### 5.3.2 选项卡片

**视觉来源**：`03-choice-normal.png`（1024×167） + `04-choice-selected.png`

| 状态 | 背景 | 文字色 | 缩放/滤镜 |
|---|---|---|---|
| normal | `--bg-choice-normal` | `--ink-deep` | `drop-shadow(0 6px 14px rgba(0,0,0,0.45))` |
| hover (PC) | normal + `brightness(1.06)` | `--ink-deep` | `translateY(-1px)` |
| pressed | normal + `brightness(0.96)` | `--ink-deep` | `scale(0.985)` |
| selected | `--bg-choice-selected` | `--ink-name`（gold） | `drop-shadow(0 8px 22px var(--state-glow-gold))` |
| dim（未选中的其他项） | normal + `opacity 0.5 + grayscale(0.3)` | — | — |

| 元素 | 规范 |
|---|---|
| 单选项宽度 | `min(480px, calc(100vw - var(--space-7)))` |
| 单选项宽高比 | `aspect-ratio: 1024 / 167` |
| padding | `0 18% 0 14%`（让出 PNG 装饰区域） |
| 选项间距 | `--space-3` |
| 文字字号 | `--fs-base` |
| 文字字距 | `0.08em` |
| background-color | **禁止** |
| border | `none` |

#### 5.3.3 确认按钮

**视觉来源**：`05-choice-confirm.png`（618×145）

| 元素 | 规范 |
|---|---|
| 显隐 | 玩家点选任意选项前不渲染；点选后 fade-in（300ms） |
| 宽度 | `min(260px, 60vw)` |
| 宽高比 | `aspect-ratio: 618 / 145` |
| background-image | `var(--bg-choice-confirm)`，`background-size: 100% 100%` |
| background-color | **禁止** |
| 文字 | `确认` 或来自 `<!-- choice-confirm-label: ... -->` |
| 文字字号 | `--fs-lg` |
| 文字字色 | `--ink-name` |
| 文字字距 | `0.4em` + `padding-left: 0.4em`（视觉居中补偿） |
| hover | `brightness(1.08) + scale(1.03)` |
| pressed | `scale(0.97)` |

### 5.4 ChoiceMenu 整体布局

```
                  ┌─ 顶部红色横幅 ─┐
                  │ ❖ 命运的分岔  ❖ │
                  └────────────────┘
                          ↓
                ┌──────────────────────┐
                │  选项 A (normal)      │
                ├──────────────────────┤
                │  选项 B (selected ✓)  │  ← 高亮
                ├──────────────────────┤
                │  选项 C (dim)         │  ← 灰化
                └──────────────────────┘
                          ↓
                    ┌───────────────┐
                    │    确  认      │   ← 选中后才出现
                    └───────────────┘
```

**overlay 遮罩**（关键修订）：

```css
background: linear-gradient(
  to bottom,
  rgba(0, 0, 0, 0.05) 0%,
  rgba(0, 0, 0, 0.18) 60%,
  rgba(0, 0, 0, 0.28) 100%
);
/* 不使用 backdrop-filter: blur — 让场景视频清晰透出 */
```

让玩家进入「专注抉择」氛围的同时，仍能感知到底层场景的流动。

## 6. 装饰元素库

### 6.1 SVG 流苏（nameplate-tassel）

PNG 自带，CSS 无需额外渲染。如需在 fallback 模式手绘：

```svg
<svg viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M 4 4 Q 12 0 18 8 Q 24 16 16 20 Q 8 24 14 32 Q 20 40 26 36"
        stroke="#C9A86A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <circle cx="26" cy="36" r="2" fill="#A88450"/>
</svg>
```

### 6.2 菱形装饰

红色横幅左右 `❖`（U+2756）即可。

### 6.3 资源映射

```
public/assets/ui/dialogue-bubble.png       ← 01-dialogue-bubble.png
public/assets/ui/narration-background.png  ← 02-narration-background.png
public/assets/ui/choice-normal.png         ← 03-choice-normal.png
public/assets/ui/choice-selected.png       ← 04-choice-selected.png
public/assets/ui/choice-confirm.png        ← 05-choice-confirm.png
public/assets/bg/_default.mp4              ← s01-frame-1.1 副本（全局占位）
public/assets/bg/S01-1.1.mp4               ← s01-frame-1.1（场景精确命中）
```

## 7. 动效规范

| 场景 | 动效 | 时长 | 缓动 |
|---|---|---|---|
| 对话气泡出现 | fade + slide-up 12px | 360ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 对话气泡消失 | fade + slide-down 8px | 240ms | `ease-in` |
| 旁白容器出现 | fade + scale 0.96→1 | 600ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 选项 normal→selected | 背景图交叉淡入 | 220ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 确认按钮显隐 | opacity 0↔1 + scale 0.94↔1 | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 红色横幅出现 | slide-down -16px→0 + fade | 480ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| 场景背景切换 | fade 全屏 | 800ms | `easeOut` |
| 转场（黑屏） | fade to black → fade out | 500+500ms | `ease-in-out` |
| 背景视频/微动效 | 自动播放 + loop + 静音 + playsInline | — | — |

## 8. 可访问性

- 所有可点击元素最小命中区 44×44px
- 墨色文字 `#3D2C1A` 在 `#F4ECDA` 上 → 8.4:1 (AAA)
- 红色横幅白字 `#FFF` 在 `#9B2C2C` 上 → 7.9:1 (AAA)
- 选中态金色文字 `#A88450` 在 `#FFF6E3` 上 → 4.7:1 (AA)
- 所有动效尊重 `prefers-reduced-motion: reduce`，自动降级为 instant

## 9. 命名约定

| 用途 | 路径 | CSS 变量 |
|---|---|---|
| 对话气泡 | `/assets/ui/dialogue-bubble.png` | `--bg-dialogue` |
| 旁白容器 | `/assets/ui/narration-background.png` | `--bg-narration` |
| 选项 normal | `/assets/ui/choice-normal.png` | `--bg-choice-normal` |
| 选项 selected | `/assets/ui/choice-selected.png` | `--bg-choice-selected` |
| 确认按钮 | `/assets/ui/choice-confirm.png` | `--bg-choice-confirm` |
| 全局占位视频 | `/assets/bg/_default.mp4` | — |
| 单帧背景图 | `/assets/bg/{SceneId}-{FrameId}.{jpg|png|webp}` | 自动 |
| 单帧背景视频 | `/assets/bg/{SceneId}-{FrameId}.{mp4|webm}` | 自动 |
| 局部微动效 | `/assets/effects/{name}.{webm|mp4}` | `<!-- effect: name -->` |
