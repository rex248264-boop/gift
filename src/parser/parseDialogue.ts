﻿﻿﻿﻿﻿﻿import type { ChoiceBlock, ChoiceOption, DialogueItem, DialogueLine, DialogueSection, SceneSwitchItem, TextInputBlock } from './types';
import { extractAssetHints } from './parseAssetHints';

// Matches 【画面切换：...】 directives — invisible to the player but triggers a bg switch
const SCENE_SWITCH_RE = /^【画面切换[：:]\s*(.+?)(?:·[^】]*)?\s*】$/;

// Matches dialogue lines. Two valid shapes:
//   1) **她**（动作）：「台词」  ← spoken dialogue
//   2) **她**（动作）           ← action-only (没台词)
// Speaker can be 你 / 他 / 她 / 旁白 / 大小姐 / 陌生访客 / 旁白外 / 等任意名字。
const DIALOGUE_RE = /^\*\*([^*]+?)\*\*\s*(?:（([^）]*)）|\(([^)]*)\))?\s*(?:[:：]\s*[「『"“]?([\s\S]*?)[」』"”]?)?\s*$/;

// Classic choice header: "[选项]" or "[选择]" + optional prompt on the same line
const CHOICE_HEADER_RE = /^\s*\[\s*(选项|选择)\s*\]\s*(.*)$/;

// Classic choice option lines (with explicit jump target):
//   - A) 救他 → S06a
//   - A. 救他 -> S06a
const CHOICE_OPTION_RE = /^\s*[-*]?\s*([A-Z]|[1-9一二三四五六七八九])[\)\.、:：]?\s+(.+?)\s*(?:→|->|=>|>>)\s*([A-Z]?\w[\w.-]*)\s*$/;

// Tonal/inline choice header (S03/S05 style): "——【交互·选择型对话·递工具的方式】——"
//   也支持 "——【选择·语气分支·...】——" / "——【选择·单线·...】——" / 任意 "——【...选择.../语气分支.../选择型...】——"
const TONAL_CHOICE_HEADER_RE = /^[—–-]{2,}【\s*(?:交互[·・]\s*)?(?:选择(?:型对话|·[^】]*)?|语气分支[^】]*)\s*[·・]?\s*(.*?)\s*】[—–-]{2,}\s*$/;

// 跨帧延续选择头：如 "——【接 Frame 2.2 的选择·他看你的方式】——"
// 捕获组 1 = 被引用的 frameId（如 "2.2"），捕获组 2 = 可选的提示文字
const CROSS_FRAME_CHOICE_HEADER_RE = /^[—–-]{2,}【接\s+Frame\s+([\w.]+)\s*的选择[·・]?(.*?)\s*】[—–-]{2,}\s*$/;

// Tonal choice option line: "- **A**：**她**（动作描述）...可能还跟着对话或跨行"
const TONAL_CHOICE_OPTION_RE = /^\s*-\s*\*\*([A-Z一二三四五六七八九])\*\*\s*(?:[（(]([^）)]{2,30})[）)])?\s*[:：]\s*(.+)$/;

// Indented continuation line under a tonal option:
//   "  - **他**（眼睛弯得更深一秒）：「……被你看穿了。」"
//   "  - → 跳转：S13a Frame 13a.1"
// 注意必须缩进，避免把下一个顶级选项行误吞。
const TONAL_OPTION_CONT_RE = /^\s{2,}[-*]\s+(.+)$/;

// 命运分叉跳转指令：
//   "→ 跳转：S13a Frame 13a.1"  / "-> 跳转: S13a"  / "=> 跳转 → S13a Frame 13a.1"
const JUMP_DIRECTIVE_RE = /^(?:→|->|=>|>>)\s*跳转\s*[:：]?\s*([A-Za-z]?\w[\w.-]*)(?:\s+Frame\s+([\w.]+))?/i;

// Pick a short, distinctive label from a tonal-choice option's raw line.
// Strategy: prefer the first quote string ("「...」"); otherwise pull the
// inner clause from the first parenthesized action; trim common prefixes.
function summarizeTonalOptionLabel(raw: string): string {
  // Strip any leading scene-switch directive before label extraction
  const base = raw.replace(/^\u3010[^\u3011]*\u3011\s*/, "");

  // 1) Prefer the first quoted line "「...」" if present.
  const quoteMatch = base.match(/[「『"“]([^」』"”]{2,40})[」』"”]/);
  if (quoteMatch) return quoteMatch[1].replace(/\*\*/g, "").trim();

  // 2) Otherwise, grab the parens action.
  const parenMatch = base.match(/[（(]([^）)]{2,400})[）)]/);
  if (parenMatch) {
    let content = parenMatch[1].replace(/\*\*/g, "").trim();
    // Drop common "prefix——actual" lead-ins like "你把扳手递过去——指尖..."
    const leadDash = content.match(/^.{2,14}[—–-]{2,}(.+)$/);
    if (leadDash) content = leadDash[1].trim();
    // If short enough, use the full content without clause truncation.
    if (content.length <= 32) {
      content = content.replace(/[—…\s,，、；;]+$/, '');
      return content;
    }
    // Take a short clause before first ；／，／、／—— if any.
    const clauseMatch = content.match(/^[^；;，、—–]{4,32}/);
    if (clauseMatch) content = clauseMatch[0].trim();
    // Trim trailing punctuation/whitespace artifacts.
    content = content.replace(/[—…\s,，、；;]+$/, '');
    return content;
  }

  // 3) Last resort: strip **speaker** markup and clamp length.
  const stripped = base.replace(/\*\*[^*]+\*\*\s*[:：]?/g, '').replace(/\*+/g, '').trim();
  return stripped.length > 32 ? stripped.slice(0, 30) + '…' : stripped;
}

// Text input header: "[文本输入]" or "[输入]"
const INPUT_HEADER_RE = /^\s*\[\s*(文本输入|输入)\s*\]\s*(.*)$/;
// Tonal text-input header: "——【交互·文本输入·第一个愿望】——"
const TONAL_INPUT_HEADER_RE = /^[—–-]{2,}【\s*(?:交互[·・]\s*)?(?:文本输入|输入)(?:[·・][^】]*)?\s*】[—–-]{2,}\s*$/;

// Field lines — 同时兼容朴素与 markdown 加粗（**xxx**）两种写法。
//   朴素: "提示: ...", "占位: ...", "记入: 标签名", "按钮: ..."
//   加粗: "- **提示文案**：（...）", "- **确认按钮**：「许完了」"
const INPUT_PROMPT_RE = /^\s*[-*]?\s*(?:\*\*)?提示(?:文案)?(?:\*\*)?\s*[:：]\s*[（(]?([\s\S]*?)[）)]?\s*$/;
const INPUT_PLACEHOLDER_RE = /^\s*[-*]?\s*(?:\*\*)?占位(?:文案)?(?:\*\*)?\s*[:：]\s*(.+)$/;
const INPUT_FLAG_RE = /^\s*[-*]?\s*(?:\*\*)?记入(?:\*\*)?\s*[:：]\s*(.+)$/;
const INPUT_BUTTON_RE = /^\s*[-*]?\s*(?:\*\*)?(?:确认按钮|按钮)(?:\*\*)?\s*[:：]\s*[「『"“]?([\s\S]+?)[」』"”]?\s*$/;

type BlockGroup = { startLine: number; lines: string[] };

function firstNonEmptyLine(lines: string[]): string | null {
  return lines.find((line) => line.trim().length > 0) ?? null;
}

function isChoiceHeaderOnlyGroup(group: BlockGroup): boolean {
  if (group.lines.length !== 1) return false;
  const line = group.lines[0]?.trim() ?? '';
  return (
    CHOICE_HEADER_RE.test(line) ||
    TONAL_CHOICE_HEADER_RE.test(line) ||
    CROSS_FRAME_CHOICE_HEADER_RE.test(line)
  );
}

function startsWithChoiceOptionGroup(group: BlockGroup): boolean {
  const line = firstNonEmptyLine(group.lines)?.trim() ?? '';
  return TONAL_CHOICE_OPTION_RE.test(line) || CHOICE_OPTION_RE.test(line);
}

function isInputHeaderOnlyGroup(group: BlockGroup): boolean {
  if (group.lines.length !== 1) return false;
  const line = group.lines[0]?.trim() ?? '';
  return INPUT_HEADER_RE.test(line) || TONAL_INPUT_HEADER_RE.test(line);
}

function startsWithInputFieldGroup(group: BlockGroup): boolean {
  const line = firstNonEmptyLine(group.lines)?.trim() ?? '';
  return (
    INPUT_PROMPT_RE.test(line) ||
    INPUT_PLACEHOLDER_RE.test(line) ||
    INPUT_FLAG_RE.test(line) ||
    INPUT_BUTTON_RE.test(line) ||
    /玩家输入|完成后触发/.test(line)
  );
}

function splitBlankSeparatedBlocks(rawText: string): BlockGroup[] {
  const lines = rawText.split(/\r?\n/);
  const groups: BlockGroup[] = [];
  let current: BlockGroup | null = null;
  lines.forEach((line, idx) => {
    if (line.trim() === '') {
      if (current && current.lines.length > 0) {
        groups.push(current);
        current = null;
      }
    } else {
      if (current == null) {
        current = { startLine: idx, lines: [] };
      }
      current.lines.push(line);
    }
  });
  if (current && (current as BlockGroup).lines.length > 0) groups.push(current);
  return groups;
}

/**
 * 把"已剥离 list 前缀的一行"按 DIALOGUE_RE 解析为 DialogueLine。
 * 如：
 *   `**她**（你重新抬起眼，看回他）：「你今天的眼睛……比平时还亮一点。」`
 *   `**他**（眼睛弯得更深一秒）：「……被你看穿了。」`
 */
function tryParseDialogueLine(
  raw: string,
  sectionHints: Record<string, string | undefined>,
): DialogueLine | null {
  const { hints, cleaned } = extractAssetHints(raw);
  const m = cleaned.trim().match(DIALOGUE_RE);
  if (!m) return null;
  const speaker = m[1].trim();
  const action = (m[2] ?? m[3])?.trim();
  const inlineText = m[4]?.trim() ?? '';
  const text = inlineText.replace(/[「『"“”』」]/g, '').trim();
  return {
    kind: 'line',
    speaker,
    action,
    text,
    hints: { ...sectionHints, ...hints },
  };
}

function withVoiceKey(
  line: DialogueLine | null,
  optionLetter: string | undefined,
  indexWithinOption: number,
): DialogueLine | null {
  if (!line || !optionLetter || !isMaleSpeaker(line.speaker)) return line;
  return {
    ...line,
    voiceKey: `opt${optionLetter.toUpperCase()}-d${indexWithinOption}`,
  };
}

function isMaleSpeaker(speaker: string): boolean {
  return speaker === '他' || speaker === '陌生访客' || speaker === '男主';
}

function parseDialogueLineBlock(block: BlockGroup, sectionHints: Record<string, string | undefined>): DialogueLine | null {
  const joined = block.lines.join('\n');
  const { hints, cleaned } = extractAssetHints(joined);
  // Take only the first non-empty line for the speaker pattern, but allow text to span multiple lines.
  const firstLine = block.lines.find((l) => l.trim().length > 0) ?? '';
  const m = firstLine.match(DIALOGUE_RE);
  if (!m) return null;
  const speaker = m[1].trim();
  const action = (m[2] ?? m[3])?.trim();
  const inlineText = m[4]?.trim();
  // Combine inlineText with any subsequent lines in the block as multi-line text.
  const restLines = block.lines.slice(block.lines.indexOf(firstLine) + 1).join('\n').trim();
  const cleanedRest = extractAssetHints(restLines).cleaned;
  const text = [inlineText, cleanedRest].filter(Boolean).join('\n').replace(/[「『"“”』」]/g, '').trim();
  void cleaned;
  return {
    kind: 'line',
    speaker,
    action,
    text,
    hints: { ...sectionHints, ...hints },
  };
}

function parseChoiceBlock(block: BlockGroup, sectionHints: Record<string, string | undefined>): ChoiceBlock | null {
  const joined = block.lines.join('\n');
  const { hints, cleaned } = extractAssetHints(joined);
  const lines = cleaned.split(/\r?\n/);
  let prompt: string | undefined;
  const options: ChoiceOption[] = [];
  let inOptions = false;

  // 1) Tonal/inline choice header — standard style OR cross-frame continuation style
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (firstNonEmpty) {
    let refFrameId: string | undefined;
    const crossHeader = firstNonEmpty.match(CROSS_FRAME_CHOICE_HEADER_RE);
    const tonalHeader = crossHeader ? null : firstNonEmpty.match(TONAL_CHOICE_HEADER_RE);

    if (crossHeader) {
      refFrameId = crossHeader[1].trim();
      prompt = crossHeader[2].trim() || undefined;
    }

    if (crossHeader || tonalHeader) {
      if (tonalHeader) prompt = tonalHeader[1].trim() || undefined;

      // 用一个游标式 builder 收集"每个选项主行 + 后续缩进续行"。
      type Builder = {
        letter: string;
        explicitLabel?: string; // 显式选项文案（来自 **A**（...）格式）
        mainRaw: string;       // 主行内容（去掉 "- **X**：" 前缀后的部分）
        contRaws: string[];    // 后续缩进续行的内容（去掉 "  - " 前缀）
      };
      const builders: Builder[] = [];
      let cur: Builder | null = null;

      for (const line of lines) {
        if (line === firstNonEmpty) continue; // 跳过 header 行
        const opt = line.match(TONAL_CHOICE_OPTION_RE);
        if (opt) {
          cur = { letter: opt[1], explicitLabel: opt[2]?.trim() || undefined, mainRaw: opt[3], contRaws: [] };
          builders.push(cur);
          continue;
        }
        const cont = cur && line.match(TONAL_OPTION_CONT_RE);
        if (cont) {
          cur!.contRaws.push(cont[1].trim());
        }
      }

      const optionHints = { ...sectionHints, ...hints };
      for (const b of builders) {
        const label = b.explicitLabel ?? summarizeTonalOptionLabel(b.mainRaw);
        const option: ChoiceOption = { letter: b.letter, label };
        const branchLines: (DialogueLine | SceneSwitchItem)[] = [];
        let maleVoiceCounter = 0;

        // Scene-switch prefixes are emitted as SceneSwitchItem entries so the
        // bg-toggle fires during branch playback, then the dialogue line follows.
        const SCENE_SW = /^\u3010[^\u3011]*\u3011\s*/;
        const mainSwM = b.mainRaw.match(SCENE_SW);
        if (mainSwM) branchLines.push({ kind: 'scene-switch', description: mainSwM[0].trim(), hints: optionHints });
        const firstParsed = tryParseDialogueLine(b.mainRaw.replace(SCENE_SW, ''), optionHints);
        if (firstParsed && isMaleSpeaker(firstParsed.speaker)) maleVoiceCounter += 1;
        const firstBranch = withVoiceKey(firstParsed, b.letter, maleVoiceCounter);
        if (firstBranch) branchLines.push(firstBranch);

        for (const raw of b.contRaws) {
          const jump = raw.match(JUMP_DIRECTIVE_RE);
          if (jump) {
            option.targetSceneId = jump[1];
            if (jump[2]) option.targetFrameId = jump[2];
            continue;
          }
          const swM = raw.match(SCENE_SW);
          if (swM) branchLines.push({ kind: 'scene-switch', description: swM[0].trim(), hints: optionHints });
          const parsed = tryParseDialogueLine(raw.replace(SCENE_SW, ''), optionHints);
          if (parsed && isMaleSpeaker(parsed.speaker)) maleVoiceCounter += 1;
          const dl = withVoiceKey(parsed, b.letter, maleVoiceCounter);
          if (dl) branchLines.push(dl);
        }

        if (branchLines.length > 0) option.branchLines = branchLines;
        options.push(option);
      }

      if (options.length > 0) {
        const block: ChoiceBlock = { kind: 'choice', prompt, options, hints: optionHints };
        if (refFrameId) block.refFrameId = refFrameId;
        return block;
      }
    }
  }

  // 2) Classic [选项] header style
  for (const line of lines) {
    const headerMatch = line.match(CHOICE_HEADER_RE);
    if (headerMatch) {
      inOptions = true;
      if (headerMatch[2].trim()) prompt = headerMatch[2].trim();
      continue;
    }
    const optMatch = line.match(CHOICE_OPTION_RE);
    if (optMatch) {
      inOptions = true;
      options.push({
        letter: optMatch[1],
        label: optMatch[2].trim(),
        targetSceneId: optMatch[3].trim(),
      });
      continue;
    }
    if (!inOptions && line.trim().length > 0) {
      prompt = (prompt ?? '') + (prompt ? ' ' : '') + line.trim();
    }
  }
  if (options.length === 0) return null;
  return { kind: 'choice', prompt: prompt?.trim() || undefined, options, hints: { ...sectionHints, ...hints } };
}

function parseInputBlock(block: BlockGroup, sectionHints: Record<string, string | undefined>): TextInputBlock | null {
  const joined = block.lines.join('\n');
  const { hints, cleaned } = extractAssetHints(joined);
  const lines = cleaned.split(/\r?\n/);
  let hasHeader = false;
  let prompt = '';
  let placeholder: string | undefined;
  let flagKey: string | undefined;
  let buttonLabel: string | undefined;
  for (const line of lines) {
    const h = line.match(INPUT_HEADER_RE);
    if (h) {
      hasHeader = true;
      if (h[2].trim()) prompt = h[2].trim();
      continue;
    }
    const th = line.match(TONAL_INPUT_HEADER_RE);
    if (th) {
      hasHeader = true;
      continue;
    }
    const p = line.match(INPUT_PROMPT_RE);
    if (p) {
      prompt = p[1].trim();
      continue;
    }
    const pl = line.match(INPUT_PLACEHOLDER_RE);
    if (pl) {
      placeholder = pl[1].trim();
      continue;
    }
    const f = line.match(INPUT_FLAG_RE);
    if (f) {
      flagKey = f[1].trim();
      continue;
    }
    const b = line.match(INPUT_BUTTON_RE);
    if (b) {
      buttonLabel = b[1].trim();
      continue;
    }
    if (hasHeader && !prompt && line.trim()) {
      prompt = line.trim();
    }
  }
  if (!hasHeader) return null;
  // tonal 写法里 "提示文案" 通常就是输入框里的占位提示；如未单独指定 placeholder，
  // 复用 prompt 作为 placeholder，保证两边都能合理显示。
  if (!placeholder && prompt) placeholder = prompt;
  return {
    kind: 'input',
    prompt: prompt || '请输入...',
    placeholder,
    flagKey,
    buttonLabel,
    hints: { ...sectionHints, ...hints },
  };
}

export function parseDialogue(rawText: string): DialogueSection {
  const { hints: sectionHints, cleaned } = extractAssetHints(rawText);
  const groups = splitBlankSeparatedBlocks(cleaned);
  const items: DialogueItem[] = [];

  for (let i = 0; i < groups.length; i += 1) {
    let g = groups[i]!;

    // 某些剧本会把「选择标题」和实际 A/B/C 选项之间故意空一行。
    // splitBlankSeparatedBlocks 会把它们拆成两个 group，导致前者没有 option、
    // 后者没有 header，最终整段退化成普通文本。
    // 这里把这两类 group 自动拼回一个 choice block。
    if (
      isChoiceHeaderOnlyGroup(g) &&
      i + 1 < groups.length &&
      startsWithChoiceOptionGroup(groups[i + 1]!)
    ) {
      g = {
        startLine: g.startLine,
        lines: [...g.lines, ...groups[i + 1]!.lines],
      };
      i += 1;
    }

    if (
      isInputHeaderOnlyGroup(g) &&
      i + 1 < groups.length &&
      startsWithInputFieldGroup(groups[i + 1]!)
    ) {
      g = {
        startLine: g.startLine,
        lines: [...g.lines, ...groups[i + 1]!.lines],
      };
      i += 1;
    }

    // Try input first (it has a distinctive header)
    const input = parseInputBlock(g, sectionHints);
    if (input) {
      items.push(input);
      continue;
    }
    // Then choice
    const choice = parseChoiceBlock(g, sectionHints);
    if (choice) {
      items.push(choice);
      continue;
    }
    // Otherwise dialogue line
    const dialogue = parseDialogueLineBlock(g, sectionHints);
    if (dialogue) {
      items.push(dialogue);
      continue;
    }
    // Scene-switch directive: 【画面切换：...】 — invisible, triggers bg change
    const text = g.lines.join('\n').trim();
    const switchMatch = text.match(SCENE_SWITCH_RE);
    if (switchMatch) {
      const sceneSwitch: SceneSwitchItem = {
        kind: 'scene-switch',
        description: text,
        hints: sectionHints,
      };
      items.push(sceneSwitch);
      continue;
    }
    // Plain narration fragment inside dialogue section: treat as旁白 line
    if (text.length > 0) {
      items.push({
        kind: 'line',
        speaker: '旁白',
        text,
        hints: sectionHints,
      });
    }
  }

  return { items, hints: sectionHints };
}
