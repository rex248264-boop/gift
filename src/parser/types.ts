// Parsed runtime types for a script

export type AssetHints = {
  bg?: string;
  effect?: string;
  effectPos?: string;
  bgm?: string;
  sfx?: string;
  voice?: string;
  cg?: string;
  sprite?: string;
  [key: string]: string | undefined;
};

export type DescriptionBlock = {
  rawText: string;
  scene: { perspective?: string; text: string } | null;
  characters: string[];
  microEffects: string[];
  hints: AssetHints;
};

export type NarrationBlock = {
  lines: string[];
  hints: AssetHints;
};

export type DialogueLine = {
  kind: 'line';
  speaker: string;
  action?: string;
  text: string;
  voiceKey?: string;
  hints: AssetHints;
};

export type ChoiceOption = {
  label: string;
  letter?: string;
  targetSceneId?: string;
  targetFrameId?: string;
  flagDelta?: Record<string, number>;
  /**
   * 选中后要播放的支线对话（她的台词 + 他的回应 ...）。
   * 来源：剧本里每个选项下方的缩进续行（如 `  - **他**(...)：「...」`）。
   * 玩家确认选项后，FrameView 会把这些行就地"替换"掉 choice 节点继续播放。
   */
  branchLines?: (DialogueLine | SceneSwitchItem)[];
};

export type ChoiceBlock = {
  kind: 'choice';
  prompt?: string;
  options: ChoiceOption[];
  hints: AssetHints;
  /**
   * 跨帧延续选择：当本帧的分支结果取决于另一帧（如 Frame 2.2）的选择时，
   * refFrameId 记录被引用帧的 id（如 "2.2"）。
   * 引擎解析时将从 chosenOptionByFrame["sceneId/refFrameId"] 读取选项字母，
   * 而不要求玩家在本帧重新做选择。
   */
  refFrameId?: string;
};

export type TextInputBlock = {
  kind: 'input';
  prompt: string;
  placeholder?: string;
  flagKey?: string;
  buttonLabel?: string;
  hints: AssetHints;
};

export type SceneSwitchItem = {
  kind: 'scene-switch';
  description: string;
  hints: AssetHints;
  /**
   * 1-based 序号，由 parseFrame 在解析后按文档顺序统一编号——包含 frame 顶层
   * 的 scene-switch 以及每个 choice 的所有 option.branchLines 中的 scene-switch
   * （按 letter 顺序遍历 option）。这一序号用于把上传的素材文件名与该 switch
   * 绑定，例如 `public/assets/scene-switches/{sceneId}-{frameId}-sw{swIndex}.{ext}`。
   * 不论玩家最终选择哪一条分支，每个 switch 的 swIndex 都是稳定的。
   */
  swIndex?: number;
};

/**
 * Narration block emitted as an inline item in the dialogue stream.
 *
 * 一帧内可以出现多个 `### 背景旁白` 段，它们会被按文档顺序、与 `### 对话`
 * 段交错地拼接进同一个 items 序列里——例如「旁白 A → 对话若干 → 旁白 B」。
 * 渲染时由 FrameView 在当前 item 为 narration 时显示 NarrationBox，
 * 玩家点击翻页/翻完后再 advance 到下一个 item。
 */
export type NarrationItem = {
  kind: 'narration';
  lines: string[];
  hints: AssetHints;
};

export type DialogueItem = DialogueLine | ChoiceBlock | TextInputBlock | SceneSwitchItem | NarrationItem;

export type DialogueSection = {
  items: DialogueItem[];
  hints: AssetHints;
};

export type TransitionBlock = {
  rawText: string;
  kind: 'plain' | 'rich';
  hints: AssetHints;
};

export type Frame = {
  id: string;            // e.g. "1.1"
  title: string;         // e.g. "烛光餐桌"
  description: DescriptionBlock | null;
  narration: NarrationBlock | null;
  dialogue: DialogueSection | null;
  transition: TransitionBlock | null;
  rawMarkdown: string;
  sourceLine: number;
};

export type SceneMeta = {
  upstream?: string;
  downstream?: string;
  frameCount?: number;
  wordsBudget?: string;
  playtimeEstimate?: string;
  coreEvents?: string;
  selfChecks?: string[];
  simplificationNotes?: string[];
};

export type Scene = {
  id: string;            // e.g. "S01"
  title: string;         // e.g. "序章·吹灭第一根蜡烛"
  filePath: string;
  meta: SceneMeta;
  frames: Frame[];
  hints: AssetHints;     // scene-level hints (BGM etc.)
};

export type Script = {
  scenes: Map<string, Scene>;
  sceneOrder: string[];
};

export type ParseDiagnostic = {
  level: 'warn' | 'error';
  scene?: string;
  frame?: string;
  message: string;
};

export type ParseResult = {
  script: Script;
  diagnostics: ParseDiagnostic[];
};
