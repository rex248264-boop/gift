import type { DescriptionBlock } from './types';
import { extractAssetHints } from './parseAssetHints';

const SCENE_RE = /^\*\*场景\*\*(?:【([^】]*)】)?\s*[:：]?\s*(.*)$/;
const CHAR_RE = /^\*\*人物\*\*\s*[:：]?\s*(.*)$/;
const EFFECT_RE = /^\*\*微动效\*\*\s*[:：]?\s*(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;

export function parseDescription(rawText: string): DescriptionBlock {
  const { hints, cleaned } = extractAssetHints(rawText);
  const lines = cleaned.split(/\r?\n/);

  let scene: DescriptionBlock['scene'] = null;
  const characters: string[] = [];
  const microEffects: string[] = [];

  let mode: 'none' | 'scene' | 'characters' | 'effects' = 'none';
  let sceneBuffer: string[] = [];
  let lastBullet: 'character' | 'effect' | null = null;

  const flushScene = () => {
    if (sceneBuffer.length > 0 && scene) {
      scene.text = (scene.text + ' ' + sceneBuffer.join(' ')).trim();
      sceneBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      flushScene();
      mode = 'none';
      lastBullet = null;
      continue;
    }

    const sceneMatch = line.match(SCENE_RE);
    if (sceneMatch) {
      flushScene();
      scene = { perspective: sceneMatch[1]?.trim() || undefined, text: sceneMatch[2].trim() };
      mode = 'scene';
      lastBullet = null;
      continue;
    }

    const charMatch = line.match(CHAR_RE);
    if (charMatch) {
      flushScene();
      const inlineText = charMatch[1].trim();
      if (inlineText.length > 0) {
        characters.push(inlineText);
      }
      mode = 'characters';
      lastBullet = 'character';
      continue;
    }

    const effectMatch = line.match(EFFECT_RE);
    if (effectMatch) {
      flushScene();
      const inlineText = effectMatch[1].trim();
      if (inlineText.length > 0) {
        microEffects.push(inlineText);
      }
      mode = 'effects';
      lastBullet = 'effect';
      continue;
    }

    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      if (lastBullet === 'character' || mode === 'characters') {
        characters.push(text);
      } else if (lastBullet === 'effect' || mode === 'effects') {
        microEffects.push(text);
      }
      continue;
    }

    // continuation line of scene block
    if (mode === 'scene') {
      sceneBuffer.push(line.trim());
    }
  }
  flushScene();

  return {
    rawText,
    scene,
    characters,
    microEffects,
    hints,
  };
}
