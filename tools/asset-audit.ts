// CLI: list expected asset paths vs what exists.
// Usage: npm run audit
import { readFile, readdir, stat, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseSceneFile, buildScript } from '../src/parser/parseScript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SCRIPTS_DIR = join(ROOT, 'scripts');
const ASSETS_DIR = join(ROOT, 'public', 'assets');

async function walk(dir: string, filter: (p: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    const s = await stat(p);
    if (s.isDirectory()) {
      out.push(...(await walk(p, filter)));
    } else if (filter(p)) {
      out.push(p);
    }
  }
  return out;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function anyExt(basePath: string, exts: string[]): Promise<string | null> {
  for (const e of exts) {
    const p = `${basePath}.${e}`;
    if (await fileExists(p)) return p;
  }
  return null;
}

async function main() {
  const all = await walk(SCRIPTS_DIR, (p) => p.endsWith('.md'));
  const sceneFiles = all.filter((p) => {
    const base = p.split(/[\\/]/).pop() || p;
    return /S\d+[a-z]?/i.test(base) && !/^0[0-2]-/.test(base);
  });

  const scenes = [];
  for (const f of sceneFiles) {
    const raw = await readFile(f, 'utf8');
    scenes.push(parseSceneFile(f, raw));
  }
  scenes.sort((a, b) => a.id.localeCompare(b.id));
  const { script } = buildScript(scenes);

  const missingBg: string[] = [];
  const missingBgm: string[] = [];
  const missingVoice: string[] = [];

  for (const id of script.sceneOrder) {
    const s = script.scenes.get(id)!;

    // BGM
    const bgmPath = await anyExt(join(ASSETS_DIR, 'audio', 'bgm', id), ['mp3', 'ogg', 'm4a']);
    if (!bgmPath) missingBgm.push(`audio/bgm/${id}.mp3`);

    for (const f of s.frames) {
      // background
      const bgPath = await anyExt(join(ASSETS_DIR, 'bg', `${id}-${f.id}`), [
        'jpg', 'jpeg', 'png', 'webp',
      ]);
      if (!bgPath) missingBg.push(`bg/${id}-${f.id}.jpg`);

      // male voice lines
      const items = f.dialogue?.items ?? [];
      let male = 0;
      for (const it of items) {
        if (it.kind === 'line' && (it.speaker === '他' || it.speaker === '陌生访客' || it.speaker === '男主')) {
          male += 1;
          const voicePath = await anyExt(
            join(ASSETS_DIR, 'audio', 'voice', 'he', `${id}-${f.id}-d${male}`),
            ['mp3', 'ogg', 'm4a'],
          );
          if (!voicePath) missingVoice.push(`audio/voice/he/${id}-${f.id}-d${male}.mp3`);
        }
      }
    }
  }

  console.log('\n=== Asset Audit ===\n');
  console.log(`Missing backgrounds   : ${missingBg.length}`);
  missingBg.slice(0, 20).forEach((p) => console.log('  ·', p));
  if (missingBg.length > 20) console.log(`  ... and ${missingBg.length - 20} more`);

  console.log(`\nMissing BGM           : ${missingBgm.length}`);
  missingBgm.forEach((p) => console.log('  ·', p));

  console.log(`\nMissing male voice    : ${missingVoice.length}`);
  missingVoice.slice(0, 30).forEach((p) => console.log('  ·', p));
  if (missingVoice.length > 30) console.log(`  ... and ${missingVoice.length - 30} more`);

  console.log('\nTip: 把素材按上面这些路径放进 public/assets/ 下，游戏就会自动加载。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
