import type { ParseDiagnostic, ParseResult, Scene, SceneMeta, Script } from './types';
import { extractAssetHints } from './parseAssetHints';
import { parseFramesFromBody } from './parseFrame';

// Parse a single .md scene file given its filePath and raw text.

const FILENAME_SCENE_RE = /^(?:\d+-)?(S\d+[a-z]?)(?:\.md)?$/i;
const TOP_TITLE_RE = /^#\s+(.+?)\s*$/;

// Metadata block: leading blockquote at top of file with key: value lines (used by S01.md etc.)
// Pattern e.g.:
// > **上游来源**：—
// > **下游出口**：跳转 → S02
// > **本场画面数**：3
const META_KEY_RE = /^>\s*\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/;

export function parseSceneFile(filePath: string, rawText: string): Scene {
  // Derive scene ID from filename
  const baseName = filePath.split(/[\\/]/).pop() || filePath;
  const noExt = baseName.replace(/\.md$/i, '');
  const idMatch = noExt.match(/(S\d+[a-z]?)/i) ?? noExt.match(FILENAME_SCENE_RE);
  const sceneId = idMatch ? idMatch[1].toUpperCase() : noExt.toUpperCase();

  // Split off file-level frontmatter / scene-level hints from comments
  const { hints, cleaned } = extractAssetHints(rawText);

  const lines = cleaned.split(/\r?\n/);

  let title = sceneId;
  const meta: SceneMeta = {};

  let cursor = 0;
  // Title
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    if (line.trim() === '') continue;
    const tm = line.match(TOP_TITLE_RE);
    if (tm) {
      title = tm[1].replace(/^《?[Ss]\d+[a-z]?》?\s*[·.\-]?\s*/, '').trim() || tm[1].trim();
      cursor++;
      break;
    }
    break;
  }

  // Metadata blockquote
  for (; cursor < lines.length; cursor++) {
    const line = lines[cursor];
    if (line.trim() === '') continue;
    const mm = line.match(META_KEY_RE);
    if (mm) {
      const key = mm[1].trim();
      const value = mm[2].trim().replace(/[「」『』"]/g, '');
      assignMeta(meta, key, value);
      continue;
    }
    if (line.startsWith('>')) {
      continue;
    }
    break;
  }

  // The rest is frame bodies (and possibly separators like ---)
  const remaining = lines.slice(cursor).join('\n');
  const frames = parseFramesFromBody(remaining, cursor);

  return {
    id: sceneId,
    title,
    filePath,
    meta,
    frames,
    hints,
  };
}

function assignMeta(meta: SceneMeta, key: string, value: string) {
  // NOTE: upstream/downstream are single-value fields and must use exact-key
  // matching. Loose substring matching (e.g. /下游/) would let auxiliary keys
  // such as "下游说明" silently overwrite the canonical "下游出口" value,
  // which broke S06b → S07 navigation by leaving "S06b ..." as the first
  // SXX token in meta.downstream and looping the player back to S06b.
  if (/^上游(来源)?$/.test(key)) meta.upstream = value;
  else if (/^下游(出口)?$/.test(key)) meta.downstream = value;
  else if (/画面数/.test(key)) meta.frameCount = parseInt(value, 10) || undefined;
  else if (/字数/.test(key)) meta.wordsBudget = value;
  else if (/时长/.test(key)) meta.playtimeEstimate = value;
  else if (/核心事件/.test(key)) meta.coreEvents = value;
  else if (/自检/.test(key)) {
    meta.selfChecks = meta.selfChecks || [];
    meta.selfChecks.push(value);
  } else if (/简化/.test(key) || /记录/.test(key)) {
    meta.simplificationNotes = meta.simplificationNotes || [];
    meta.simplificationNotes.push(value);
  }
}

export function buildScript(scenes: Scene[]): ParseResult {
  const map = new Map<string, Scene>();
  const order: string[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  for (const s of scenes) {
    if (map.has(s.id)) {
      diagnostics.push({ level: 'error', scene: s.id, message: `场次 ID 重复：${s.id}` });
    } else {
      map.set(s.id, s);
      order.push(s.id);
    }
  }

  // Validate jumps (choice targets, downstream)
  for (const s of map.values()) {
    if (s.meta.downstream && /S\d+/.test(s.meta.downstream)) {
      const targets = s.meta.downstream.match(/S\d+[a-z]?/g) ?? [];
      for (const t of targets) {
        if (!map.has(t.toUpperCase())) {
          diagnostics.push({ level: 'warn', scene: s.id, message: `下游出口指向不存在的场次：${t}` });
        }
      }
    }
    for (const f of s.frames) {
      if (!f.dialogue) continue;
      for (const item of f.dialogue.items) {
        if (item.kind === 'choice') {
          for (const opt of item.options) {
            const t = opt.targetSceneId?.toUpperCase();
            if (t && /^S\d+[A-Z]?$/i.test(t) && !map.has(t)) {
              diagnostics.push({
                level: 'warn',
                scene: s.id,
                frame: f.id,
                message: `选项「${opt.label}」跳转到不存在的场次：${t}`,
              });
            }
          }
        }
      }
    }
  }

  const script: Script = { scenes: map, sceneOrder: order };
  return { script, diagnostics };
}
