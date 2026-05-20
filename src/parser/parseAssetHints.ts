import type { AssetHints } from './types';

// Parses HTML comments of the form: <!-- bg: candle.jpg  effect: gold.webm pos:top -->
// Returns hints map and the text with all such comments stripped.
const COMMENT_RE = /<!--([\s\S]*?)-->/g;

export function extractAssetHints(text: string): { hints: AssetHints; cleaned: string } {
  const hints: AssetHints = {};
  let cleaned = text;
  let m: RegExpExecArray | null;
  COMMENT_RE.lastIndex = 0;
  while ((m = COMMENT_RE.exec(text)) !== null) {
    const inner = m[1].trim();
    // Match repeated "key: value" or "key=value" pairs separated by whitespace.
    // Values can be unquoted (no whitespace) or quoted "..." / '...'
    const pairRe = /([a-zA-Z][\w-]*)\s*[:=]\s*("([^"]*)"|'([^']*)'|([^\s]+))/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(inner)) !== null) {
      const key = pm[1];
      const value = pm[3] ?? pm[4] ?? pm[5];
      if (key && value !== undefined) {
        hints[key] = value;
      }
    }
  }
  cleaned = text.replace(COMMENT_RE, '').trim();
  return { hints, cleaned };
}
