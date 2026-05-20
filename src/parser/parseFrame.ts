import type { AssetHints, DialogueItem, DialogueLine, DialogueSection, Frame, NarrationBlock } from './types';
import { extractAssetHints } from './parseAssetHints';
import { parseDescription } from './parseDescription';
import { parseDialogue } from './parseDialogue';
import { parseNarration } from './parseNarration';
import { parseTransition } from './parseTransition';

// A frame starts with: ## Frame X.Y · Title  (or ## Frame X.Y Title, or ## Frame N · Title)
// We collect everything until the next "## Frame ..." or end of document.

// Frame IDs may include a letter suffix, e.g. "6a.1" or "6b.2"
const FRAME_HEADER_RE = /^##\s+Frame\s+([0-9]+[a-z]?(?:\.[0-9]+[a-z]?)?)\s*[·•．\.\-]?\s*(.+?)\s*$/i;
const SUBSECTION_RE = /^###\s+(画面描述|背景旁白|对话|转场)\s*$/;

export function parseFramesFromBody(body: string, startingLineOffset = 0): Frame[] {
  const lines = body.split(/\r?\n/);
  const frames: Frame[] = [];

  type FrameRaw = { id: string; title: string; startLine: number; body: string[] };
  const rawFrames: FrameRaw[] = [];

  let current: FrameRaw | null = null;
  lines.forEach((line, idx) => {
    const m = line.match(FRAME_HEADER_RE);
    if (m) {
      if (current) rawFrames.push(current);
      current = { id: m[1], title: m[2].trim(), startLine: startingLineOffset + idx, body: [] };
    } else if (current) {
      current.body.push(line);
    }
  });
  if (current) rawFrames.push(current);

  for (const rf of rawFrames) {
    frames.push(buildFrame(rf));
  }

  return frames;
}

function buildFrame(rf: { id: string; title: string; startLine: number; body: string[] }): Frame {
  // 关键：按文档顺序保留每一个 ### 子段（允许 背景旁白 / 对话 出现多次并交错）
  const orderedSections = splitFrameSectionsOrdered(rf.body);

  // 画面描述 / 转场 仍然是 0..1 段；如果出现多个则拼起来，保持旧行为。
  const descBodies = orderedSections.filter((s) => s.key === '画面描述').map((s) => s.body);
  const transBodies = orderedSections.filter((s) => s.key === '转场').map((s) => s.body);
  const description = descBodies.length > 0 ? parseDescription(descBodies.join('\n\n')) : null;
  const transition = transBodies.length > 0 ? parseTransition(transBodies.join('\n\n')) : null;

  // 背景旁白 / 对话 按文档顺序逐段处理；narration 段被嵌入为 items 流里的
  // `kind: 'narration'` 项，与对话行交错——这样「旁白 A → 对话 → 旁白 B」会
  // 严格按文档顺序播放，而不会把多段旁白合并成一团显示在一开头。
  let firstNarration: NarrationBlock | null = null;
  const items: DialogueItem[] = [];
  let mergedHints: AssetHints = {};

  for (const sec of orderedSections) {
    if (sec.key === '背景旁白') {
      const block = parseNarration(sec.body);
      if (!firstNarration) firstNarration = block;
      mergedHints = { ...mergedHints, ...block.hints };
      if (block.lines.length > 0) {
        items.push({ kind: 'narration', lines: block.lines, hints: block.hints });
      }
    } else if (sec.key === '对话') {
      const parsed = parseDialogue(sec.body);
      mergedHints = { ...mergedHints, ...parsed.hints };
      items.push(...parsed.items);
    }
  }

  const dialogue: DialogueSection | null =
    items.length > 0 ? { items, hints: mergedHints } : null;

  // 给该帧内所有 scene-switch 编号（含 choice 各 option 分支里的）。
  // 编号在解析期一次性写入，runtime 可以稳定地把上传素材 / 资源文件与
  // 对应 switch 绑定，不受玩家选支线影响。
  if (dialogue) {
    assignSceneSwitchIndexes(dialogue.items);
    assignVoiceKeys(dialogue.items);
  }

  return {
    id: rf.id,
    title: rf.title,
    description,
    narration: firstNarration,
    dialogue,
    transition,
    rawMarkdown: rf.body.join('\n'),
    sourceLine: rf.startLine,
  };
}

/**
 * 按文档顺序遍历 frame 的 items，给每一个 scene-switch（含 choice option
 * 分支里的）按 1 起始编号——遍历顺序：顶层 items 顺序优先，遇到 choice
 * 时按 option 出现的顺序逐个进入其 branchLines 继续编号。
 */
function assignSceneSwitchIndexes(items: DialogueItem[]): void {
  let next = 1;
  for (const it of items) {
    if (it.kind === 'scene-switch') {
      it.swIndex = next++;
    } else if (it.kind === 'choice') {
      for (const opt of it.options) {
        if (!opt.branchLines) continue;
        for (const bl of opt.branchLines) {
          if (bl.kind === 'scene-switch') {
            bl.swIndex = next++;
          }
        }
      }
    }
  }
}

function assignVoiceKeys(items: DialogueItem[]): void {
  let mainCounter = 0;
  for (const it of items) {
    if (it.kind === 'line' && isMaleLine(it)) {
      mainCounter += 1;
      it.voiceKey ??= `d${mainCounter}`;
      continue;
    }
    if (it.kind !== 'choice') continue;
    for (const [optIndex, opt] of it.options.entries()) {
      let branchCounter = 0;
      const optionKey = opt.letter?.toUpperCase() ?? `IDX${optIndex + 1}`;
      for (const bl of opt.branchLines ?? []) {
        if (bl.kind !== 'line' || !isMaleLine(bl)) continue;
        branchCounter += 1;
        bl.voiceKey ??= `opt${optionKey}-d${branchCounter}`;
      }
    }
  }
}

function isMaleLine(line: DialogueLine): boolean {
  return line.speaker === '他' || line.speaker === '陌生访客' || line.speaker === '男主';
}

/**
 * 按文档顺序切分 frame 的 `### xxx` 子段；与旧版 `splitFrameSections` 不同，
 * 重复出现的同名子段不会被合并——而是各自作为独立条目按出现顺序返回。
 */
function splitFrameSectionsOrdered(body: string[]): Array<{ key: string; body: string }> {
  const out: Array<{ key: string; body: string }> = [];
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentKey != null) {
      const trimmed = buffer.join('\n').trim();
      if (trimmed.length > 0) {
        out.push({ key: currentKey, body: trimmed });
      }
    }
  };

  for (const line of body) {
    const m = line.match(SUBSECTION_RE);
    if (m) {
      flush();
      currentKey = m[1];
      buffer = [];
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();
  return out;
}

export function frameHasInteractive(frame: Frame): boolean {
  if (!frame.dialogue) return false;
  return frame.dialogue.items.some((it) => it.kind === 'choice' || it.kind === 'input');
}
