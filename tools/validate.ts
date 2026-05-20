// CLI: validate all .md scripts under scripts/
// Usage: npm run validate
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parseSceneFile, buildScript } from '../src/parser/parseScript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, '..', 'scripts');

async function walk(dir: string): Promise<string[]> {
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
      out.push(...(await walk(p)));
    } else if (e.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

async function main() {
  const all = await walk(SCRIPTS_DIR);
  const sceneFiles = all.filter((p) => {
    const base = p.split(/[\\/]/).pop() || p;
    return /S\d+[a-z]?/i.test(base) && !/^0[0-2]-/.test(base);
  });

  if (sceneFiles.length === 0) {
    console.error(`No scene .md files found under ${SCRIPTS_DIR}`);
    process.exit(1);
  }

  const scenes = [];
  for (const f of sceneFiles) {
    const raw = await readFile(f, 'utf8');
    scenes.push(parseSceneFile(f, raw));
  }
  scenes.sort((a, b) => a.id.localeCompare(b.id));

  const { script, diagnostics } = buildScript(scenes);

  console.log(`\n✓ Parsed ${script.scenes.size} scenes:`);
  for (const id of script.sceneOrder) {
    const s = script.scenes.get(id)!;
    const interactiveCount = s.frames.filter((f) =>
      f.dialogue?.items.some((i) => i.kind === 'choice' || i.kind === 'input'),
    ).length;
    console.log(
      `  ${id.padEnd(6)} "${s.title}"  ${s.frames.length} frame(s)  ${interactiveCount} interactive`,
    );
  }

  console.log(`\n${diagnostics.length} diagnostic(s):`);
  for (const d of diagnostics) {
    const icon = d.level === 'error' ? '✗' : '⚠';
    console.log(`  ${icon} [${d.scene ?? ''}${d.frame ? '/' + d.frame : ''}] ${d.message}`);
  }

  const errors = diagnostics.filter((d) => d.level === 'error').length;
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
