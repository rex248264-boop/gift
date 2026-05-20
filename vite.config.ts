import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Custom plugin: load .md scripts as raw text with HMR support
function rawMarkdownPlugin() {
  return {
    name: 'raw-markdown',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.endsWith('.md?raw')) {
        return null;
      }
      return null;
    },
    handleHotUpdate(ctx: { file: string; server: { ws: { send: (payload: unknown) => void } } }) {
      if (ctx.file.endsWith('.md')) {
        ctx.server.ws.send({ type: 'custom', event: 'script-changed', data: { path: ctx.file } });
      }
    },
  };
}

// Dev-only plugin: expose POST /dev/upload-asset to save an uploaded background or
// transition file into public/assets/, named by the current scene/frame.
//
// Request:
//   POST /dev/upload-asset?kind=bg|transition|voice|bgm|special-audio|title-logo&sceneId=S01&frameId=1.3&ext=mp4
//   bgm: 需 sceneId；可选 frameId（有则保存为小章节专属 BGM：S01-1.3.mp3）
//   title-logo: 无需 sceneId/frameId
//   DELETE /dev/delete-asset?kind=bgm|title-logo&sceneId=__title__  （删除该 stem 全部扩展名）
//   voice 额外需要 maleLineNumber（本帧内男主台词序号，从 1 起）
//   Body: raw binary bytes of the file (octet-stream)
//
// Behaviour:
//   - Validates kind / ext against an allow-list.
//   - Deletes any existing siblings with the SAME stem but a different extension
//     (e.g. uploading S01-1.3.png will delete S01-1.3.mp4) so the resolver isn't
//     confused by a stale companion file.
//   - Writes the new file to:
//       bg          → public/assets/bg/{sceneId}-{frameId}.{ext}
//       transition  → public/assets/transitions/{sceneId}-{frameId}.{ext}
//       voice       → public/assets/audio/voice/he/{sceneId}-{frameId}-d{N}.{ext}
function uploadAssetPlugin() {
  const ALLOWED_BG_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm']);
  const ALLOWED_TRANSITION_EXTS = new Set(['mp4', 'webm']);
  const ALLOWED_SCENE_SWITCH_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
  const ALLOWED_VOICE_EXTS = new Set(['mp3', 'ogg', 'm4a', 'wav']);
  const ALLOWED_BGM_EXTS = new Set(['mp3', 'ogg', 'm4a']);
  const ALLOWED_SPECIAL_AUDIO_EXTS = new Set(['mp3', 'ogg', 'm4a', 'wav']);
  const ALLOWED_TITLE_LOGO_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
  const ALL_BG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'];
  const ALL_TRANSITION_EXTS = ['mp4', 'webm'];
  const ALL_SCENE_SWITCH_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
  const ALL_VOICE_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];
  const ALL_BGM_EXTS = ['mp3', 'ogg', 'm4a'];
  const ALL_SPECIAL_AUDIO_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];
  const ALL_TITLE_LOGO_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

  return {
    name: 'upload-asset',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void };
      config: { root: string };
    }) {
      server.middlewares.use('/dev/upload-asset', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const url = new URL(req.url ?? '', 'http://x');
          const kind = url.searchParams.get('kind');
          const sceneId = url.searchParams.get('sceneId');
          const frameId = url.searchParams.get('frameId');
          const extRaw = (url.searchParams.get('ext') ?? '').toLowerCase().replace(/^\./, '');
          const swIndexRaw = url.searchParams.get('swIndex');
          const maleLineNumberRaw = url.searchParams.get('maleLineNumber');
          const voiceStemRaw = url.searchParams.get('voiceStem');

          if (!extRaw) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing ext' }));
            return;
          }

          const needsFrame = kind === 'bg' || kind === 'transition' || kind === 'scene-switch' || kind === 'voice';
          const needsScene = kind !== 'title-logo' && kind !== 'special-audio';

          if (needsScene && !sceneId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing sceneId' }));
            return;
          }
          if (needsFrame && !frameId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing frameId' }));
            return;
          }
          if (sceneId && !/^[A-Za-z0-9._-]+$/.test(sceneId)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid sceneId' }));
            return;
          }
          if (frameId && !/^[A-Za-z0-9._-]+$/.test(frameId)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid frameId' }));
            return;
          }

          let folder: string;
          let allExtsToSweep: string[];
          let stem: string;
          if (kind === 'bg') {
            if (!ALLOWED_BG_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `bg 不支持扩展名: ${extRaw}` }));
              return;
            }
            folder = 'bg';
            allExtsToSweep = ALL_BG_EXTS;
            stem = `${sceneId}-${frameId}`;
          } else if (kind === 'transition') {
            if (!ALLOWED_TRANSITION_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `transition 仅支持 mp4/webm，收到 ${extRaw}` }));
              return;
            }
            folder = 'transitions';
            allExtsToSweep = ALL_TRANSITION_EXTS;
            stem = `${sceneId}-${frameId}`;
          } else if (kind === 'scene-switch') {
            if (!ALLOWED_SCENE_SWITCH_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `scene-switch 仅支持图片(png/jpg/webp)，收到 ${extRaw}` }));
              return;
            }
            const swIndex = swIndexRaw ? Number(swIndexRaw) : NaN;
            if (!Number.isInteger(swIndex) || swIndex < 1) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `scene-switch 需要正整数 swIndex，收到 ${swIndexRaw}` }));
              return;
            }
            folder = 'scene-switches';
            allExtsToSweep = ALL_SCENE_SWITCH_EXTS;
            stem = `${sceneId}-${frameId}-sw${swIndex}`;
          } else if (kind === 'voice') {
            if (!ALLOWED_VOICE_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `voice 仅支持 mp3/ogg/m4a/wav，收到 ${extRaw}` }));
              return;
            }
            folder = 'audio/voice/he';
            allExtsToSweep = ALL_VOICE_EXTS;
            if (voiceStemRaw) {
              if (!/^[A-Za-z0-9._-]+$/.test(voiceStemRaw)) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `voiceStem 非法：${voiceStemRaw}` }));
                return;
              }
              stem = `${sceneId}-${frameId}-${voiceStemRaw}`;
            } else {
              const maleLineNumber = maleLineNumberRaw ? Number(maleLineNumberRaw) : NaN;
              if (!Number.isInteger(maleLineNumber) || maleLineNumber < 1) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: `voice 需要正整数 maleLineNumber，收到 ${maleLineNumberRaw}` }));
                return;
              }
              stem = `${sceneId}-${frameId}-d${maleLineNumber}`;
            }
          } else if (kind === 'bgm') {
            if (!ALLOWED_BGM_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `bgm 仅支持 mp3/ogg/m4a，收到 ${extRaw}` }));
              return;
            }
            folder = 'audio/bgm';
            allExtsToSweep = ALL_BGM_EXTS;
            stem = frameId ? `${sceneId}-${frameId}` : sceneId!;
          } else if (kind === 'special-audio') {
            if (!ALLOWED_SPECIAL_AUDIO_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `special-audio 仅支持 mp3/ogg/m4a/wav，收到 ${extRaw}` }));
              return;
            }
            folder = 'audio/special';
            allExtsToSweep = ALL_SPECIAL_AUDIO_EXTS;
            stem = 'S11-11.4-blue-dot';
          } else if (kind === 'title-logo') {
            if (!ALLOWED_TITLE_LOGO_EXTS.has(extRaw)) {
              res.statusCode = 415;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `title-logo 仅支持 png/jpg/webp，收到 ${extRaw}` }));
              return;
            }
            folder = 'ui';
            allExtsToSweep = ALL_TITLE_LOGO_EXTS;
            stem = 'title-logo';
          } else {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `unknown kind: ${kind}` }));
            return;
          }

          const dir = path.join(server.config.root, 'public', 'assets', folder);
          fs.mkdirSync(dir, { recursive: true });

          const finalPath = path.join(dir, `${stem}.${extRaw}`);
          const tempPath = path.join(dir, `.${stem}.${extRaw}.${Date.now()}.tmp`);
          const writeStream = fs.createWriteStream(tempPath);
          let bytes = 0;
          let settled = false;

          const cleanupTemp = async () => {
            await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
          };

          const fail = async (statusCode: number, error: string) => {
            if (settled) return;
            settled = true;
            writeStream.destroy();
            await cleanupTemp();
            res.statusCode = statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error }));
          };

          req.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (!writeStream.write(chunk)) {
              req.pause();
              writeStream.once('drain', () => req.resume());
            }
          });
          req.on('error', () => {
            void fail(500, 'Upload stream interrupted');
          });
          writeStream.on('error', () => {
            void fail(500, 'Failed to write upload file');
          });
          req.on('end', async () => {
            if (settled) return;
            writeStream.end();
            await new Promise<void>((resolve) => writeStream.once('finish', resolve));
            try {
              if (bytes === 0) {
                await fail(400, 'Empty file');
                return;
              }

              // Sweep: delete any sibling with the same stem but different ext.
              const deleted: string[] = [];
              for (const e of allExtsToSweep) {
                const sibling = path.join(dir, `${stem}.${e}`);
                if (fs.existsSync(sibling) && e !== extRaw) {
                  await fs.promises.unlink(sibling);
                  deleted.push(`${stem}.${e}`);
                }
              }

              await fs.promises.rename(tempPath, finalPath);
              settled = true;

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                ok: true,
                savedAs: `public/assets/${folder}/${stem}.${extRaw}`,
                bytes,
                deleted,
              }));
            } catch (e) {
              await fail(500, String(e));
            }
          });
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

function deleteAssetPlugin() {
  const DELETABLE = new Set(['bgm', 'title-logo']);
  const EXTS_BY_KIND: Record<string, string[]> = {
    bgm: ['mp3', 'ogg', 'm4a'],
    'title-logo': ['png', 'jpg', 'jpeg', 'webp'],
  };

  return {
    name: 'delete-asset',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void };
      config: { root: string };
    }) {
      server.middlewares.use('/dev/delete-asset', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method !== 'DELETE') {
          res.statusCode = 405;
          res.end();
          return;
        }
        try {
          const url = new URL(req.url ?? '', 'http://x');
          const kind = url.searchParams.get('kind');
          const sceneId = url.searchParams.get('sceneId');

          if (!kind || !DELETABLE.has(kind)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `不支持的 kind: ${kind}` }));
            return;
          }

          let folder: string;
          let stem: string;
          if (kind === 'bgm') {
            if (!sceneId || !/^[A-Za-z0-9._-]+$/.test(sceneId)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'bgm 需要合法 sceneId（首页用 __title__）' }));
              return;
            }
            folder = 'audio/bgm';
            stem = sceneId;
          } else {
            folder = 'ui';
            stem = 'title-logo';
          }

          const dir = path.join(server.config.root, 'public', 'assets', folder);
          const exts = EXTS_BY_KIND[kind] ?? [];
          const deleted: string[] = [];
          for (const e of exts) {
            const fp = path.join(dir, `${stem}.${e}`);
            if (fs.existsSync(fp)) {
              fs.unlinkSync(fp);
              deleted.push(`${stem}.${e}`);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, deleted }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

// Dev-only plugin: expose POST /dev/patch-text to overwrite text in a script file.
// Only active during `vite dev`; not included in production builds.
function patchTextPlugin() {
  return {
    name: 'patch-text',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void };
      config: { root: string };
    }) {
      server.middlewares.use('/dev/patch-text', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { filePath, from, to } = JSON.parse(body) as { filePath: string; from: string; to: string };
            const absolutePath = path.join(server.config.root, filePath);
            // Normalize CRLF → LF so rawMarkdown (always LF) matches file content
            let content = await fs.promises.readFile(absolutePath, 'utf8');
            content = content.replace(/\r\n/g, '\n');
            if (!content.includes(from)) {
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Text not found in file' }));
              return;
            }
            // Replace first occurrence only
            const updated = content.replace(from, to);
            await fs.promises.writeFile(absolutePath, updated, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), rawMarkdownPlugin(), patchTextPlugin(), uploadAssetPlugin(), deleteAssetPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@scripts': path.resolve(__dirname, 'scripts'),
      '@assets': path.resolve(__dirname, 'public/assets'),
    },
  },
  server: {
    port: 4519,
    strictPort: true,
    host: true,
    fs: {
      // allow serving files from one level up so we can access the original scripts via symlink/copy
      allow: ['..'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
