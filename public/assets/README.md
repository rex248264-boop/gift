# Assets 目录

按下面这些路径放素材，游戏会自动加载：

```
public/assets/
├── bg/                          ← 背景图
│   └── S01-1.1.jpg              格式：{SceneId}-{FrameId}.{jpg|png|webp}
├── sprite/                      ← 立绘
│   ├── he/                      男主
│   │   ├── default.png
│   │   ├── smile.png
│   │   ├── tender.png
│   │   ├── tease.png
│   │   ├── serious.png
│   │   ├── pain.png
│   │   ├── angry.png
│   │   ├── lowered.png
│   │   ├── blink.png
│   │   └── fade.png             淡化消失
│   └── she/                     女主
│       └── ...
├── effects/                     ← 微动效（webm/mp4 优先；gif 也行）
│   ├── candle-flicker.webm
│   ├── lapel-gold-light.webm
│   └── particle-dissolve.webm
└── audio/
    ├── bgm/                     ← 整场 BGM
    │   ├── S01.mp3
    │   └── S05-climax.mp3
    ├── sfx/                     ← 单次音效
    │   ├── candle-blow.mp3
    │   └── world-shift.mp3
    └── voice/he/                ← 男主语音（按句）
        ├── S01-1.1-d1.mp3       =场次 S01 / Frame 1.1 / 第 1 句男主台词
        ├── S01-1.1-d2.mp3
        └── ...
```

`npm run audit` 会列出**所有期望但缺失的资源路径**。
