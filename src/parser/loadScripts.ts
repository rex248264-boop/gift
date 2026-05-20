import { parseSceneFile, buildScript } from './parseScript';
import type { ParseResult } from './types';

// Eagerly load all .md scenes from scripts/ as raw text.
// import.meta.glob with `as: 'raw'` returns string contents.
const FILES = import.meta.glob<string>('/scripts/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Heuristics: ignore non-scene files like 00-人物档案.md, 01-大纲.md, 02-写作计划.md
function isSceneFile(filePath: string): boolean {
  const base = filePath.split('/').pop() || filePath;
  // Accept files whose name contains -S<digits> like 03-S01.md, or just S01.md.
  // Exclude meta docs that start with 00-/01-/02- (人物档案/大纲/写作计划).
  return /S\d+[a-z]?/i.test(base) && !/^0[0-2]-/.test(base);
}

export function loadAllScripts(): ParseResult {
  const scenes = [];
  for (const [filePath, raw] of Object.entries(FILES)) {
    if (!isSceneFile(filePath)) continue;
    scenes.push(parseSceneFile(filePath, raw));
  }
  scenes.sort((a, b) => a.id.localeCompare(b.id));
  return buildScript(scenes);
}
