# 想见你 · UX Spec v1

> 描述每个核心屏的状态、交互、流转。视觉细节以 `visual-spec.md` 为准。

## 0. 全局约定

### 0.1 设备目标

- **主目标**：iPhone 17 Pro，430×932 (CSS px)，DPR 3
- **基础布局**：portrait 竖屏，宽度自适应 360 ~ 480px，超出居中
- **安全区**：尊重 `env(safe-area-inset-*)`，避开 Dynamic Island & home indicator
- **触控热区**：所有可点击元素 ≥ 44×44 px
- **滚动**：禁止背景滚动；选择卡片列表内部允许滚动（超过 5 项时）

### 0.2 全局快捷区

| 区域 | 位置 | 元素 | 何时显示 |
|---|---|---|---|
| TopBar | 安全区下 0~56px | 返回 + 上下文标签 | 对话/旁白/转场时显示；选择/文本输入时隐藏 |
| BottomControls | 安全区上 -56~0px | 回顾 / 跳过 / 自动 | 同上 |
| ChoiceMenu | 全屏覆盖 | 横幅 + 选项 + 确认 | 仅 frame.choice 出现时 |
| TextInputBox | 中下区域 | 输入框 + 提交 | 仅 frame.textInput 出现时 |

### 0.3 状态机（最高层）

```
TitleScreen
    │
    ├── [开始游戏] ──┐
    └── [继续游戏] ──┤
                    ↓
              GameScreen
                    │
                    ├── frame.narration   → 显示 NarrationBox → tap → next
                    ├── frame.dialogue    → 显示 DialogueBox → tap → next
                    ├── frame.choice      → 显示 ChoiceMenu  → confirm → next
                    ├── frame.textInput   → 显示 TextInputBox → submit → next
                    └── frame.transition  → 黑屏/白闪 → next
                    │
                    └── (script ended) → EndingScreen
```

### 0.4 输入模型

| 手势 | 行为 |
|---|---|
| 单击屏幕空白处（非交互元素） | tapAdvance（推进打字机 / 跳到下一行） |
| 单击选项 | 切换选中态（不直接提交） |
| 单击确认按钮 | 提交选择，进入下一帧 |
| 单击 TopBar 返回 | 回到 TitleScreen（弹确认） |
| 单击底栏「回顾」 | 打开历史记录抽屉（M2） |
| 单击底栏「跳过」 | 长按 800ms 触发快速跳过模式（M2） |
| 单击底栏「自动」 | 切换自动播放（每行停 2s，M1.5） |

## 1. 屏：TitleScreen（标题屏）

不变更，保留既有实现。

## 2. 屏：GameScreen → frame.dialogue

### 2.1 进入

1. SceneBackground 切换（背景图根据 hint 或 `S{X}-F{Y}-bg.jpg` 命名约定加载）
2. MicroEffect 播放（如有 MP4，自动 loop + 静音）
3. Character sprite 出现（如有）
4. **DialogueBox 出现动画**：fade + slide-up 12px，360ms
5. 名牌先于正文出现（提前 80ms）
6. **打字机**：每 35ms 显示一个字符；可被任何 tap 中断为立即全显示
7. 全显示后，光标在末尾闪烁（可选），等待用户 tap

### 2.2 交互态

| 状态 | 触发 | 表现 |
|---|---|---|
| typing | 进入 frame | 文字逐字显示 |
| ready | 打字完成 | 末尾出现 `▽` 小指示符号 1.2s 一次的呼吸动效 |
| advancing | 用户 tap | 触发 `tapAdvance` |
| exit | 切换到下一行/下一帧 | fade-out 240ms |

### 2.3 注意事项

- 单帧内可能有多行对话（多个 dialogue line）。每行独立 typing → ready → advance 周期。
- 角色名变化时，名牌做 240ms 的左滑淡入淡出
- **多角色对话**：交替的对白由名牌切换即可，气泡本身不变位置（避免抖动）

## 3. 屏：GameScreen → frame.narration

### 3.1 进入

1. 背景层不变
2. 屏幕中下出现 NarrationBox（蜡烛玫瑰背景）
3. 出现动画：fade + scale 0.96→1，600ms（比对话稍慢，营造庄重感）
4. 内部文字一次性出现（不打字机），但用 `letter-by-letter` opacity sweep 200ms 让字逐渐"显现"

### 3.2 交互

- 单击屏幕任意处 → 进入下一节
- 长旁白超过 3 行时，自动追加底部 `⋯` 指示，可独立 tap 该指示翻页（避免误触）

## 4. 屏：GameScreen → frame.choice（**核心变更**）

### 4.1 进入

1. 触发 frame.choice 时，先隐藏 TopBar 和 BottomControls
2. ChoiceMenu 出现：
   - 全屏遮罩 fade-in 200ms
   - 红色横幅从顶部 slide-down -16px → 0，480ms，spring 缓动
   - 选项卡片依次出现，每张延迟 120ms，fade + slide-up 8px
   - **确认按钮**：初始不可见

### 4.2 选择交互（2 步流程）

```
┌─ Phase A: SELECT ─────────────────────────┐
│  用户尚未选中任何选项                       │
│  - 所有选项 normal 态                       │
│  - 确认按钮 opacity: 0, pointer-events: none │
│  - 点击任一选项 → 进入 Phase B              │
└─────────────────────────────────────────────┘
                    ↓
┌─ Phase B: REVIEW ──────────────────────────┐
│  用户已选中 1 个选项                        │
│  - 被选项 selected 态（金色+菱形勾）         │
│  - 其余选项 normal 态                       │
│  - 确认按钮 opacity: 1, pointer-events: auto │
│  - 行为：                                    │
│    • 点击其他选项 → 切换选中（A 还原 normal） │
│    • 点击当前选中项 → 取消选中 → 回到 Phase A │
│    • 点击确认按钮 → Phase C                  │
└─────────────────────────────────────────────┘
                    ↓
┌─ Phase C: COMMIT ──────────────────────────┐
│  确认按钮按下                                │
│  - 所有未选项 fade-out + scale 0.96，200ms    │
│  - 选中项保留 100ms 后整体淡出，全屏遮罩散场 │
│  - 调用 chooseOption(option) → 推进 store   │
│  - 触发音效（如有 confirm.mp3）             │
└─────────────────────────────────────────────┘
```

### 4.3 数据模型（保留）

```ts
type ChoiceOption = {
  key: string;        // "A" | "B" | "C"
  label: string;      // "我留下陪你"
  target: string;     // "S05F1.2"
  flags?: Record<string, number>;  // 选中时给 flag 增减分
  hints?: AssetHints; // 比如选中音效
};
```

### 4.4 视觉提示

- **选项卡片左侧**：保留参考图原图中的小装饰（不额外加序号字母 A/B/C）
- **选项卡片右侧**：依靠 selected 背景图自带的"菱形勾"显示选中态
- **横幅文字**：来自脚本 `<!-- choice-banner: 自定义文字 -->` 注释。缺省 `命运的分岔就此开启`
- **确认按钮文字**：来自脚本 `<!-- choice-confirm-label: 自定义文字 -->`，缺省 `确认`

### 4.5 无障碍

- 按下 Enter / Space：当无选中时无效；有选中时等同点击确认
- 上下方向键：在选项间移动焦点
- 反向跳出：按 Esc → 在 Phase B 回到 Phase A；在 Phase A 无效（必须选）

## 5. 屏：GameScreen → frame.textInput

复用现有 TextInputBox，仅同步描金视觉：

- 输入框使用 `选择框-未选中态` 同款背景
- 提交按钮使用 `选择确认按钮` 同款背景
- 留白与圆角对齐 visual-spec §4

未提交不允许推进；提交后立即推进。

## 6. 屏：GameScreen → frame.transition

- 黑屏 / 白闪 / 淡出
- 默认 500ms in + 500ms out
- 中央可显示一行 fade-in 的转场提示（如"三日后"）

## 7. 屏：EndingScreen

不变更，保留既有实现。

## 8. 边界情况

| 场景 | 处理 |
|---|---|
| 无 BGM 文件 | 静音播放，console.warn 一次 |
| 无背景图 | 退化为渐变 placeholder（已实现） |
| 无微动效 | 退化为静态背景（已实现） |
| 无角色立绘 | 仅显示对话气泡（已实现） |
| 跳转目标不存在 | console.error 并停留当前帧 |
| 选项 flags 引用未定义 flag | 自动创建 flag = 0 后再加减（已实现） |
| 用户在打字机过程中切到选择 | 立即终止打字，跳到全显示后再启动选择动画 |
| 多个连续 narration | 每个之间留 200ms 间隔，避免视觉突然切换 |

## 9. 与脚本的接口

所有 UX 行为都可由脚本 `<!-- key: value -->` 注释覆盖：

| 注释 key | 作用 | 默认值 |
|---|---|---|
| `choice-banner` | 红色横幅文字 | `命运的分岔就此开启` |
| `choice-confirm-label` | 确认按钮文字 | `确认` |
| `narration-style` | 旁白样式 ID（normal/special） | `normal` |
| `typing-speed` | 打字机速度 ms/字 | `35` |
| `bgm` | BGM 文件名（不含扩展名） | 见 assetResolver |
| `bg` | 背景文件名 | 见 assetResolver |
| `effect` | 微动效文件名 | 见 assetResolver |
| `voice` | 语音文件名 | 见 assetResolver |
| `transition` | 转场效果 | `fade` |

## 10. 后续（M2+）

- 自动播放模式
- 跳过已读模式（需要记录已读帧 ID）
- 历史回顾抽屉
- 设置菜单（音量、字号、自动速度）
- 多结局存档分支
- 收藏 CG 画廊
