// Asset resolver: given scene/frame/index/hint, returns the URL to load.
// Conventions (overridable by inline hints in the .md file):
//   bg:       /assets/bg/{SceneId}-{FrameId}.{jpg|png|webp}        e.g. /assets/bg/S01-1.1.jpg
//   bgm:      /assets/audio/bgm/{SceneId}.{mp3|ogg}
//   voice:    /assets/audio/voice/he/{SceneId}-{FrameId}-d{N}.mp3  N = 1-based index of male protagonist lines in frame
//   effect:   /assets/effects/{name}.{webm|mp4}                    (path comes from hint; we resolve to /assets/effects/...)
//   sprite:   /assets/sprite/{role}/{state}.png                    (state from speaker/action keywords if unspecified)
//
// All assets fail soft: if the file is missing, the renderer falls back to placeholder.

const BG_IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
const BG_VIDEO_EXTS = ['mp4', 'webm'];
const SPRITE_EXTS = ['png', 'webp', 'jpg'];
const EFFECT_EXTS = ['webm', 'mp4'];
const AUDIO_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];

/** 首页标题 BGM 的文件名 stem（public/assets/audio/bgm/__title__.mp3） */
export const TITLE_BGM_SCENE_ID = '__title__';
export const S11_BLUE_DOT_SPECIAL_AUDIO_STEM = 'S11-11.4-blue-dot';
export const FINAL_SLIDESHOW_DIR = '/assets/final-slideshow';

const TITLE_LOGO_EXTS = ['png', 'webp', 'jpg', 'jpeg'];

// Until each frame has a dedicated background, the entire game falls back to
// this video as a placeholder. Replace later by dropping per-frame files into
// /assets/bg/{SceneId}-{FrameId}.{jpg|png|webp|mp4|webm}.
export const DEFAULT_SCENE_BG_VIDEO = '/assets/bg/_default.mp4';

function joinUrl(...parts: string[]): string {
  return parts.join('/').replace(/([^:]\/)\/+/g, '$1');
}

function withBase(p: string): string {
  if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) return p;
  if (p.startsWith('/')) return p;
  return '/' + p;
}

// Returns a prioritized list of candidate background URLs for a frame.
// The first existing file wins. Order: explicit hint → static image → video → default fallback.
export function resolveBackground(sceneId: string, frameId: string, hint?: string): string[] {
  const base = joinUrl('/assets/bg', `${sceneId}-${frameId}`);
  const images = autoExt(base, BG_IMAGE_EXTS);
  const videos = autoExt(base, BG_VIDEO_EXTS);
  if (hint) {
    const explicit = hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'bg', hint));
    return [explicit, ...images, ...videos, DEFAULT_SCENE_BG_VIDEO];
  }
  return [...images, ...videos, DEFAULT_SCENE_BG_VIDEO];
}

export function resolveBGM(sceneId: string, hint?: string): string[] {
  if (hint) {
    return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'audio', 'bgm', hint))];
  }
  return autoExt(joinUrl('/assets/audio/bgm', sceneId), AUDIO_EXTS);
}

export function resolveFrameBGM(sceneId: string, frameId: string, hint?: string): string[] {
  if (hint) {
    return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'audio', 'bgm', hint))];
  }
  return autoExt(joinUrl('/assets/audio/bgm', `${sceneId}-${frameId}`), AUDIO_EXTS);
}

export function resolveTitleLogo(): string[] {
  return autoExt(joinUrl('/assets/ui', 'title-logo'), TITLE_LOGO_EXTS);
}

export function resolveSFX(hint: string): string {
  if (!hint) return '';
  return hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'audio', 'sfx', hint));
}

export function resolveVoice(
  sceneId: string,
  frameId: string,
  maleLineNumber: number,
  hint?: string,
  voiceKey?: string,
): string[] {
  if (hint) {
    return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'audio', 'voice', 'he', hint))];
  }
  if (voiceKey) {
    return autoExt(joinUrl('/assets/audio/voice/he', `${sceneId}-${frameId}-${voiceKey}`), AUDIO_EXTS);
  }
  return autoExt(joinUrl('/assets/audio/voice/he', `${sceneId}-${frameId}-d${maleLineNumber}`), AUDIO_EXTS);
}

export function resolveS11BlueDotSpecialAudio(): string[] {
  return autoExt(joinUrl('/assets/audio/special', S11_BLUE_DOT_SPECIAL_AUDIO_STEM), AUDIO_EXTS);
}

export function resolveFinalSlideshowImage(index: number): string[] {
  const padded = String(index).padStart(2, '0');
  return autoExt(joinUrl(FINAL_SLIDESHOW_DIR, padded), BG_IMAGE_EXTS);
}

// Resolves a *spot* micro-effect overlaid on a still scene (e.g. golden particles,
// sparkles, a brief light glint). Strictly opt-in via `<!-- effect: name -->`
// hint in the markdown so it never double-plays with the scene-bg video.
export function resolveEffect(hint: string | undefined): string[] {
  if (!hint) return [];
  if (/\.(webm|mp4|gif|json)$/i.test(hint)) {
    return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'effects', hint))];
  }
  return autoExt(joinUrl('/assets/effects', hint), EFFECT_EXTS);
}

export function resolveSprite(role: string, state: string, hint?: string): string[] {
  if (hint) {
    if (/\.(png|webp|jpg|jpeg)$/i.test(hint)) {
      return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'sprite', hint))];
    }
    return autoExt(joinUrl('/assets/sprite', role, hint), SPRITE_EXTS);
  }
  return autoExt(joinUrl('/assets/sprite', role, state), SPRITE_EXTS);
}

function autoExt(basePath: string, exts: string[]): string[] {
  return exts.map((e) => `${basePath}.${e}`);
}

// Try a list of candidate URLs and return the first one that REALLY exists.
//
// Why content-type check: Vite's dev server falls back to index.html (text/html, 200)
// for unknown static paths. A naive HEAD-OK check then incorrectly accepts every URL.
// We require the response content-type to match the expected asset family.
const FAMILY_CT_PREFIXES: Record<string, string[]> = {
  image: ['image/'],
  video: ['video/', 'application/octet-stream'],
  audio: ['audio/', 'application/octet-stream'],
};

function inferFamilyFromUrl(url: string): 'image' | 'video' | 'audio' | null {
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(url)) return 'image';
  if (/\.(mp4|webm|mov|m4v)$/i.test(url)) return 'video';
  if (/\.(mp3|ogg|m4a|wav)$/i.test(url)) return 'audio';
  return null;
}

export async function pickFirstExisting(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (!res.ok) continue;
      const ct = (res.headers.get('content-type') ?? '').toLowerCase();
      // Reject Vite's HTML SPA fallback.
      if (ct.startsWith('text/html')) continue;
      const family = inferFamilyFromUrl(url);
      if (family) {
        const accepted = FAMILY_CT_PREFIXES[family] ?? [];
        if (accepted.length > 0 && !accepted.some((p) => ct.startsWith(p))) continue;
      }
      return url;
    } catch {
      // ignore
    }
  }
  return null;
}

// Transition video: /assets/transitions/{SceneId}-{FrameId}.{mp4|webm}
// Convention: keyed by the *departing* frame (the frame whose transition leads out).
// e.g. S01 Frame 1.3 → /assets/transitions/S01-1.3.mp4
export function resolveTransitionVideo(sceneId: string, frameId: string, hint?: string): string[] {
  if (hint) {
    return [hint.includes('/') ? withBase(hint) : withBase(joinUrl('assets', 'transitions', hint))];
  }
  const base = joinUrl('/assets/transitions', `${sceneId}-${frameId}`);
  return autoExt(base, BG_VIDEO_EXTS);
}

// Scene-switch overlay image: /assets/scene-switches/{SceneId}-{FrameId}-sw{N}.{ext}
// 每个 frame 内 scene-switch 都有稳定的 swIndex（含 choice 分支内的），
// 上传后会作为该 switch 期间的全屏覆盖图取代默认的黑/白闪烁。
export function resolveSceneSwitchImage(
  sceneId: string,
  frameId: string,
  swIndex: number,
): string[] {
  const base = joinUrl('/assets/scene-switches', `${sceneId}-${frameId}-sw${swIndex}`);
  return autoExt(base, BG_IMAGE_EXTS);
}

// Map a speaker name to a role folder for sprite resolution.
export function speakerToRole(speaker: string): string {
  if (speaker === '他' || speaker === '陌生访客' || speaker === '男主') return 'he';
  if (speaker === '她' || speaker === '你' || speaker === '女主') return 'she';
  if (speaker === '大小姐') return 'miss';
  if (speaker === '旁白') return '';
  return speaker.toLowerCase();
}

// Try to infer sprite state from action / emotion keywords.
export function inferState(action?: string): string {
  if (!action) return 'default';
  if (/笑|弯了弯眼|温柔/.test(action)) return 'smile';
  if (/疼|皱|忍|颤/.test(action)) return 'pain';
  if (/淡化|消散|消失|粒子/.test(action)) return 'fade';
  if (/低/.test(action)) return 'lowered';
  if (/愤怒|怒/.test(action)) return 'angry';
  if (/调侃|挑/.test(action)) return 'tease';
  if (/认真/.test(action)) return 'serious';
  if (/眨/.test(action)) return 'blink';
  return 'default';
}
