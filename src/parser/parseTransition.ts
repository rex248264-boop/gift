import type { TransitionBlock } from './types';
import { extractAssetHints } from './parseAssetHints';

export function parseTransition(rawText: string): TransitionBlock {
  const { hints, cleaned } = extractAssetHints(rawText);
  const trimmed = cleaned.trim();
  // Rich transitions usually have multiple sections / lists; plain ones are 1-2 lines.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const kind: TransitionBlock['kind'] = lines.length > 2 || /\*\*[^*]+\*\*/.test(trimmed) ? 'rich' : 'plain';
  return { rawText: trimmed, kind, hints };
}
