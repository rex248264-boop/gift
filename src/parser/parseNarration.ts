import type { NarrationBlock } from './types';
import { extractAssetHints } from './parseAssetHints';

const QUOTE_RE = /^>\s?(.*)$/;

export function parseNarration(rawText: string): NarrationBlock {
  const { hints, cleaned } = extractAssetHints(rawText);
  const lines = cleaned.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(QUOTE_RE);
    if (m) {
      const t = m[1].trim();
      if (t.length > 0) out.push(t);
    } else if (line.trim().length > 0) {
      // Tolerate naked lines (not blockquote) as narration too
      out.push(line.trim());
    }
  }
  return { lines: out, hints };
}
