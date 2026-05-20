import { useState, useEffect, useMemo, useRef } from 'react';
import {
  useGame,
  useTextOffsets,
  useCurrentTheme,
  getNonEmptyOffsets,
  TEXT_SLOTS,
  ALL_THEMES,
  THEME_LABEL,
  type TextSlotKey,
  type SceneTheme,
  type FontScale,
} from '@/engine';
import type { Frame, SceneSwitchItem } from '@/parser';
import { S11_BLUE_DOT_SPECIAL_AUDIO_STEM, TITLE_BGM_SCENE_ID } from '@/engine/assetResolver';
import styles from './DevPanel.module.css';

type SaveStatus = 'idle' | 'saving' | 'ok' | 'err' | 'unchanged' | 'notfound';

export function DevPanel() {
  const devMode = useGame((s) => s.devMode);
  const showDevPanel = useGame((s) => s.showDevPanel);
  const toggleDevPanel = useGame((s) => s.toggleDevPanel);
  const script = useGame((s) => s.script);
  const diagnostics = useGame((s) => s.diagnostics);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const currentFrameId = useGame((s) => s.currentFrameId);
  const flags = useGame((s) => s.flags);
  const jumpTo = useGame((s) => s.jumpTo);
  const setFlag = useGame((s) => s.setFlag);
  const reloadScript = useGame((s) => s.reloadScript);
  const fontScale = useGame((s) => s.fontScale);
  const setFontScale = useGame((s) => s.setFontScale);

  const [showAll, setShowAll] = useState(false);

  // ── 内容编辑器 ──────────────────────────────────────────────
  const [editText, setEditText] = useState('');
  const [editOriginal, setEditOriginal] = useState('');
  const [editFilePath, setEditFilePath] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // 当前画面切换时，把 rawMarkdown 载入编辑框
  useEffect(() => {
    if (!currentSceneId || !currentFrameId) return;
    const scene = script.scenes.get(currentSceneId);
    const frame = scene?.frames.find((f) => f.id === currentFrameId);
    if (!frame || !scene) return;
    setEditOriginal(frame.rawMarkdown);
    setEditText(frame.rawMarkdown);
    setEditFilePath(scene.filePath);
    setSaveStatus('idle');
  }, [currentSceneId, currentFrameId, script]);

  const handleSave = async () => {
    if (editText === editOriginal) {
      setSaveStatus('unchanged');
      return;
    }
    setSaveStatus('saving');
    try {
      const res = await fetch('/dev/patch-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: editFilePath, from: editOriginal, to: editText }),
      });
      if (res.ok) {
        setSaveStatus('ok');
        setEditOriginal(editText);
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        const data = await res.json() as { error?: string };
        setSaveStatus(data.error?.includes('not found') ? 'notfound' : 'err');
      }
    } catch {
      setSaveStatus('err');
    }
  };

  const saveLabel: Record<SaveStatus, string> = {
    idle: '保存到文件',
    saving: '保存中…',
    ok: '✓ 已保存',
    err: '✕ 保存失败',
    unchanged: '内容未变',
    notfound: '✕ 未找到原文',
  };

  if (!devMode) return null;

  return (
    <>
      <button className={styles.fab} onClick={toggleDevPanel} aria-label="Dev panel">
        ⚙
      </button>
      {showDevPanel && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <span>Dev · 调试面板</span>
            <button className={styles.closeBtn} onClick={toggleDevPanel}>
              ✕
            </button>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>字号</div>
            <div className={styles.txRow}>
              <label className={styles.txLabel}>大小</label>
              <div className={styles.txThemeGroup}>
                {(
                  [
                    { scale: 'sm' as FontScale, label: '小' },
                    { scale: 'md' as FontScale, label: '标准' },
                    { scale: 'lg' as FontScale, label: '大' },
                  ] as const
                ).map(({ scale, label }) => (
                  <button
                    key={scale}
                    className={`${styles.txChip} ${fontScale === scale ? styles.txChipActive : ''}`}
                    onClick={() => setFontScale(scale)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>当前位置</div>
            <div className={styles.kv}>
              <span>scene</span> <code>{currentSceneId ?? '—'}</code>
            </div>
            <div className={styles.kv}>
              <span>frame</span> <code>{currentFrameId ?? '—'}</code>
            </div>
          </section>

          {/* ── 背景音乐（首页 + 各幕）── */}
          <BgmUploadSection />

          {/* ── 标题 LOGO ── */}
          <TitleLogoUploadSection />

          {/* ── 素材上传 ── */}
          <AssetUploadSection sceneId={currentSceneId} frameId={currentFrameId} />

          {/* ── 男主台词配音 ── */}
          <MaleVoiceUploadSection sceneId={currentSceneId} frameId={currentFrameId} />

          {/* ── 内容编辑器 ── */}
          {editFilePath && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>编辑当前画面文案</div>
              <div className={styles.editMeta}>{editFilePath.split('/').slice(-2).join('/')}</div>
              <textarea
                className={styles.editTextarea}
                value={editText}
                onChange={(e) => { setEditText(e.target.value); setSaveStatus('idle'); }}
                spellCheck={false}
              />
              <div className={styles.editFooter}>
                <button
                  className={`${styles.saveBtn} ${saveStatus === 'ok' ? styles.saveBtnOk : ''} ${saveStatus.startsWith('err') || saveStatus === 'notfound' ? styles.saveBtnErr : ''}`}
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                >
                  {saveLabel[saveStatus]}
                </button>
                {editText !== editOriginal && (
                  <button
                    className={styles.resetBtn}
                    onClick={() => { setEditText(editOriginal); setSaveStatus('idle'); }}
                  >
                    还原
                  </button>
                )}
              </div>
              {saveStatus === 'notfound' && (
                <div className={styles.editHint}>
                  提示：原文在文件中未匹配到，可能是上次保存后内容已变更。请点还原后重试。
                </div>
              )}
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionTitle}>跳转</div>
            <div className={styles.sceneGrid}>
              {script.sceneOrder.map((id) => (
                <button
                  key={id}
                  className={`${styles.sceneBtn} ${id === currentSceneId ? styles.sceneBtnActive : ''}`}
                  onClick={() => jumpTo(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            {currentSceneId && (
              <>
                <div className={styles.sectionSubtitle}>{currentSceneId} 的画面</div>
                <div className={styles.frameGrid}>
                  {script.scenes.get(currentSceneId)?.frames.map((f) => (
                    <button
                      key={f.id}
                      className={`${styles.frameBtn} ${
                        f.id === currentFrameId ? styles.frameBtnActive : ''
                      }`}
                      onClick={() => jumpTo(currentSceneId, f.id)}
                      title={f.title}
                    >
                      {f.id} · {f.title}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>Flags</div>
            <div className={styles.flagList}>
              {Object.entries(flags).length === 0 && <div className={styles.muted}>（无）</div>}
              {Object.entries(flags).map(([k, v]) => (
                <div key={k} className={styles.kv}>
                  <span>{k}</span>
                  <code>{String(v)}</code>
                  {typeof v === 'number' && (
                    <>
                      <button onClick={() => setFlag(k, v - 1)}>-1</button>
                      <button onClick={() => setFlag(k, v + 1)}>+1</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.flagAdd}>
              <button onClick={() => setFlag('saveHim', true)}>set saveHim = true</button>
            </div>
          </section>

          <TextOffsetSection />

          <section className={styles.section}>
            <div className={styles.sectionTitle}>剧本诊断 ({diagnostics.length})</div>
            <button className={styles.reloadBtn} onClick={() => reloadScript()}>
              ↻ 重新解析剧本
            </button>
            {diagnostics.length > 0 && (
              <>
                <button className={styles.toggleAll} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? '收起' : '展开全部'}
                </button>
                <ul className={styles.diagList}>
                  {(showAll ? diagnostics : diagnostics.slice(0, 5)).map((d, i) => (
                    <li key={i} className={d.level === 'error' ? styles.diagError : styles.diagWarn}>
                      [{d.level}] {d.scene ?? ''}{d.frame ? `/${d.frame}` : ''} — {d.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  文字位置微调子面板
 * ──────────────────────────────────────────────────────────────────────── */

type ExportMode = 'idle' | 'json' | 'css';

function TextOffsetSection() {
  const offsets = useTextOffsets((s) => s.offsets);
  const setOffset = useTextOffsets((s) => s.set);
  const patchOffset = useTextOffsets((s) => s.patch);
  const resetOffset = useTextOffsets((s) => s.reset);
  const copyTo = useTextOffsets((s) => s.copyTo);

  const sceneTheme = useCurrentTheme();
  const [theme, setTheme] = useState<SceneTheme>(sceneTheme);
  const [followScene, setFollowScene] = useState(true);
  const [slot, setSlot] = useState<TextSlotKey>('dialogue-text');
  const [step, setStep] = useState<number>(1);
  const [exportMode, setExportMode] = useState<ExportMode>('idle');

  useEffect(() => {
    if (followScene) setTheme(sceneTheme);
  }, [sceneTheme, followScene]);

  const current = offsets[theme]?.[slot] ?? { dx: 0, dy: 0 };

  const nudge = (axis: 'dx' | 'dy', dir: 1 | -1) => {
    patchOffset(theme, slot, { [axis]: dir * step });
  };

  const setExact = (axis: 'dx' | 'dy', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    setOffset(theme, slot, { ...current, [axis]: n });
  };

  const exportText = useMemo(() => {
    const filtered = getNonEmptyOffsets(offsets);
    if (exportMode === 'json') {
      return JSON.stringify(filtered, null, 2);
    }
    if (exportMode === 'css') {
      const lines: string[] = [];
      for (const t of ALL_THEMES) {
        const map = filtered[t];
        const entries = Object.entries(map);
        if (entries.length === 0) continue;
        lines.push(`/* theme: ${t} */`);
        for (const [k, v] of entries) {
          if (!v) continue;
          lines.push(
            `--tx-${t}-${k}-x: ${v.dx}px;  --tx-${t}-${k}-y: ${v.dy}px;`,
          );
        }
      }
      return lines.length > 0 ? lines.join('\n') : '/* 全部为 0，没有非空数据 */';
    }
    return '';
  }, [exportMode, offsets]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>文字位置微调</div>

      {/* 主题选择 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>主题</label>
        <div className={styles.txThemeGroup}>
          {ALL_THEMES.map((t) => (
            <button
              key={t}
              className={`${styles.txChip} ${theme === t ? styles.txChipActive : ''}`}
              onClick={() => {
                setTheme(t);
                setFollowScene(false);
              }}
            >
              {THEME_LABEL[t]}
            </button>
          ))}
          <button
            className={`${styles.txChip} ${followScene ? styles.txChipActive : ''}`}
            onClick={() => {
              setFollowScene(true);
              setTheme(sceneTheme);
            }}
            title="自动跟随当前场景主题"
          >
            跟随场景
          </button>
        </div>
      </div>

      {/* 文字类型 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>类型</label>
        <select
          className={styles.txSelect}
          value={slot}
          onChange={(e) => setSlot(e.target.value as TextSlotKey)}
        >
          {Object.entries(groupSlots()).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((it) => (
                <option key={it.key} value={it.key}>
                  {it.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* 步长 */}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>步长</label>
        <div className={styles.txThemeGroup}>
          {[1, 2, 5, 10].map((n) => (
            <button
              key={n}
              className={`${styles.txChip} ${step === n ? styles.txChipActive : ''}`}
              onClick={() => setStep(n)}
            >
              {n}px
            </button>
          ))}
        </div>
      </div>

      {/* 方向按钮（十字布局） */}
      <div className={styles.txDpad}>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dy', -1)} title={`上 ${step}px`}>↑</button>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dx', -1)} title={`左 ${step}px`}>←</button>
        <button className={styles.txArrowCenter} onClick={() => setOffset(theme, slot, { dx: 0, dy: 0 })} title="重置当前">
          ⊙
        </button>
        <button className={styles.txArrow} onClick={() => nudge('dx', 1)} title={`右 ${step}px`}>→</button>
        <div />
        <button className={styles.txArrow} onClick={() => nudge('dy', 1)} title={`下 ${step}px`}>↓</button>
        <div />
      </div>

      {/* 数值显示与精确输入 */}
      <div className={styles.txValueRow}>
        <label className={styles.txValueLabel}>X</label>
        <input
          className={styles.txInput}
          type="number"
          value={current.dx}
          onChange={(e) => setExact('dx', e.target.value)}
        />
        <label className={styles.txValueLabel}>Y</label>
        <input
          className={styles.txInput}
          type="number"
          value={current.dy}
          onChange={(e) => setExact('dy', e.target.value)}
        />
      </div>

      {/* 操作 */}
      <div className={styles.txActions}>
        <button
          className={styles.txBtn}
          onClick={() => resetOffset(theme)}
          title={`清空 ${THEME_LABEL[theme]} 全部 slot 的偏移`}
        >
          重置本主题
        </button>
        <button className={styles.txBtn} onClick={() => resetOffset()} title="清空全部主题">
          全部重置
        </button>
        <button
          className={styles.txBtn}
          onClick={() => {
            const other = ALL_THEMES.find((t) => t !== theme);
            if (other) copyTo(theme, other);
          }}
          title="把当前主题的全部偏移复制到另一主题"
        >
          复制到其它主题
        </button>
      </div>

      {/* 导出 */}
      <div className={styles.txActions}>
        <button
          className={styles.txBtn}
          onClick={() => setExportMode((m) => (m === 'json' ? 'idle' : 'json'))}
        >
          {exportMode === 'json' ? '收起 JSON' : '导出 JSON'}
        </button>
        <button
          className={styles.txBtn}
          onClick={() => setExportMode((m) => (m === 'css' ? 'idle' : 'css'))}
        >
          {exportMode === 'css' ? '收起 CSS 变量' : '导出 CSS 变量'}
        </button>
      </div>
      {exportMode !== 'idle' && (
        <textarea className={styles.txExport} value={exportText} readOnly spellCheck={false} />
      )}
    </section>
  );
}

function groupSlots() {
  const groups: Record<string, typeof TEXT_SLOTS[number][]> = {};
  for (const s of TEXT_SLOTS) {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  }
  return groups;
}

/* ─────────────────────────────────────────────────────────────────────────
 *  素材上传子面板（背景图/视频 + 过渡视频）
 * ──────────────────────────────────────────────────────────────────────── */

type UploadStatus =
  | { state: 'idle' }
  | { state: 'uploading' }
  | { state: 'ok'; savedAs: string; bytes: number; deleted: string[] }
  | { state: 'err'; message: string };

const BG_ACCEPT = 'image/png,image/jpeg,image/webp,video/mp4,video/webm';
const TRANSITION_ACCEPT = 'video/mp4,video/webm';
const SCENE_SWITCH_ACCEPT = 'image/png,image/jpeg,image/webp';
const BG_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'];
const TRANSITION_EXTS = ['mp4', 'webm'];
const SCENE_SWITCH_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
const VOICE_ACCEPT = 'audio/mpeg,audio/mp3,audio/ogg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.ogg,.m4a,.wav';
const VOICE_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];
const BGM_ACCEPT = 'audio/mpeg,audio/mp3,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.ogg,.m4a';
const BGM_EXTS = ['mp3', 'ogg', 'm4a'];
const SPECIAL_AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/ogg,audio/mp4,audio/x-m4a,audio/wav,.mp3,.ogg,.m4a,.wav';
const SPECIAL_AUDIO_EXTS = ['mp3', 'ogg', 'm4a', 'wav'];
const TITLE_LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

type UploadKind = 'bg' | 'transition' | 'scene-switch' | 'voice' | 'bgm' | 'special-audio' | 'title-logo';
type DeletableKind = 'bgm' | 'title-logo';

function extOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

async function uploadAsset(
  kind: UploadKind,
  file: File,
  opts: { sceneId?: string; frameId?: string; swIndex?: number; maleLineNumber?: number; voiceStem?: string },
): Promise<UploadStatus> {
  const ext = extOf(file.name);
  const allowed =
    kind === 'bg'
      ? BG_EXTS
      : kind === 'transition'
        ? TRANSITION_EXTS
        : kind === 'voice'
          ? VOICE_EXTS
          : kind === 'bgm'
            ? BGM_EXTS
            : kind === 'special-audio'
              ? SPECIAL_AUDIO_EXTS
              : kind === 'title-logo'
                ? ['png', 'jpg', 'jpeg', 'webp']
                : SCENE_SWITCH_EXTS;
  if (!allowed.includes(ext === 'jpeg' ? 'jpeg' : ext)) {
    return { state: 'err', message: `不支持的扩展名 .${ext}（允许: ${allowed.join(', ')}）` };
  }
  const params = new URLSearchParams({ kind, ext });
  if (opts.sceneId) params.set('sceneId', opts.sceneId);
  if (opts.frameId) params.set('frameId', opts.frameId);
  if (kind === 'scene-switch' && opts.swIndex != null) {
    params.set('swIndex', String(opts.swIndex));
  }
  if (kind === 'voice' && opts.maleLineNumber != null) {
    params.set('maleLineNumber', String(opts.maleLineNumber));
  }
  if (kind === 'voice' && opts.voiceStem) {
    params.set('voiceStem', opts.voiceStem);
  }
  try {
    const res = await fetch(`/dev/upload-asset?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      savedAs?: string;
      bytes?: number;
      deleted?: string[];
      error?: string;
    } | null;
    if (res.ok && data?.ok && data.savedAs) {
      return {
        state: 'ok',
        savedAs: data.savedAs,
        bytes: data.bytes ?? 0,
        deleted: data.deleted ?? [],
      };
    }
    return { state: 'err', message: data?.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { state: 'err', message: String(e) };
  }
}

async function deleteAsset(
  kind: DeletableKind,
  sceneId?: string,
): Promise<{ ok: boolean; deleted: string[]; message?: string }> {
  const params = new URLSearchParams({ kind });
  if (sceneId) params.set('sceneId', sceneId);
  try {
    const res = await fetch(`/dev/delete-asset?${params.toString()}`, { method: 'DELETE' });
    const data = (await res.json()) as { ok?: boolean; deleted?: string[]; error?: string };
    if (res.ok && data.ok) {
      return { ok: true, deleted: data.deleted ?? [] };
    }
    return { ok: false, deleted: [], message: data.error ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, deleted: [], message: String(e) };
  }
}

/**
 * 把 frame 内所有 scene-switch（含 choice option 分支里的）按 swIndex 升序
 * 收集到一起，返回每条的索引、显示文字和来源 option（若来自分支）。
 */
type SceneSwitchEntry = {
  swIndex: number;
  description: string;
  fromOption?: string; // e.g. 'A' / 'B'
};

function collectSceneSwitches(frame: Frame | null): SceneSwitchEntry[] {
  if (!frame?.dialogue) return [];
  const out: SceneSwitchEntry[] = [];
  const pushSw = (sw: SceneSwitchItem, fromOption?: string) => {
    if (sw.swIndex == null) return;
    out.push({
      swIndex: sw.swIndex,
      description: cleanSceneSwitchLabel(sw.description),
      fromOption,
    });
  };
  for (const it of frame.dialogue.items) {
    if (it.kind === 'scene-switch') {
      pushSw(it);
    } else if (it.kind === 'choice') {
      for (const opt of it.options) {
        if (!opt.branchLines) continue;
        for (const bl of opt.branchLines) {
          if (bl.kind === 'scene-switch') pushSw(bl, opt.letter);
        }
      }
    }
  }
  return out.sort((a, b) => a.swIndex - b.swIndex);
}

function cleanSceneSwitchLabel(raw: string): string {
  // 把【画面切换：xxx】里的内层文字抽出来，方便面板显示。
  const m = raw.match(/^【\s*画面切换\s*[：:]\s*(.+?)\s*】\s*$/);
  return m ? m[1] : raw;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function UploadSlot({
  kind,
  label,
  hint,
  accept,
  sceneId,
  frameId,
  swIndex,
  maleLineNumber,
  voiceStem,
  targetName: explicitTargetName,
  deletable = false,
  onDeleted,
}: {
  kind: UploadKind;
  label: string;
  hint: string;
  accept: string;
  sceneId?: string;
  frameId?: string;
  /** Required when kind === 'scene-switch'. */
  swIndex?: number;
  /** Required when kind === 'voice'. */
  maleLineNumber?: number;
  voiceStem?: string;
  /** Optional override; otherwise computed from sceneId/frameId/(swIndex). */
  targetName?: string;
  deletable?: boolean;
  onDeleted?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>({ state: 'idle' });
  const bumpAssetRefresh = useGame((s) => s.bumpAssetRefresh);

  // Reset status when frame/scene/index changes.
  useEffect(() => {
    setStatus({ state: 'idle' });
  }, [sceneId, frameId, swIndex, maleLineNumber, voiceStem]);

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    setStatus({ state: 'uploading' });
    const result = await uploadAsset(kind, file, { sceneId, frameId, swIndex, maleLineNumber, voiceStem });
    setStatus(result);
    if (result.state === 'ok') {
      bumpAssetRefresh();
    }
  };

  const handleDelete = async () => {
    if (kind !== 'bgm' && kind !== 'title-logo') return;
    if (!window.confirm(`确定删除「${label}」的音频/图片文件？`)) return;
    setStatus({ state: 'uploading' });
    const result = await deleteAsset(kind, sceneId);
    if (result.ok) {
      setStatus({ state: 'idle' });
      bumpAssetRefresh();
      onDeleted?.();
    } else {
      setStatus({ state: 'err', message: result.message ?? '删除失败' });
    }
  };

  const stem =
    kind === 'title-logo'
      ? 'title-logo'
      : kind === 'bgm' && sceneId
        ? sceneId
        : kind === 'special-audio'
          ? S11_BLUE_DOT_SPECIAL_AUDIO_STEM
          : kind === 'scene-switch' && swIndex != null && sceneId && frameId
            ? `${sceneId}-${frameId}-sw${swIndex}`
            : kind === 'voice' && maleLineNumber != null && sceneId && frameId
              ? `${sceneId}-${frameId}-${voiceStem ?? `d${maleLineNumber}`}`
              : sceneId && frameId
                ? `${sceneId}-${frameId}`
                : '—';
  const targetName =
    explicitTargetName ??
    `${stem}.{${accept
      .split(',')
      .map((a) => a.split('/')[1] ?? a.replace(/^\./, ''))
      .join('|')}}`;

  return (
    <div className={styles.uploadSlot}>
      <div className={styles.uploadLabel}>{label}</div>
      <div className={styles.uploadHint}>{hint}</div>
      <div className={styles.uploadTarget}>
        将保存为 <code>{targetName}</code>
      </div>
      <div className={styles.uploadActions}>
        <button
          className={styles.uploadBtn}
          onClick={handlePick}
          disabled={status.state === 'uploading'}
        >
          {status.state === 'uploading' ? '上传中…' : '选择文件并上传'}
        </button>
        {deletable && (
          <button
            type="button"
            className={styles.uploadDeleteBtn}
            onClick={handleDelete}
            disabled={status.state === 'uploading'}
          >
            删除
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>
      {status.state === 'ok' && (
        <div className={styles.uploadStatusOk}>
          ✓ 已保存 {formatBytes(status.bytes)} → <code>{status.savedAs}</code>
          {status.deleted.length > 0 && (
            <div className={styles.uploadDeleted}>
              覆盖删除：{status.deleted.join('、')}
            </div>
          )}
        </div>
      )}
      {status.state === 'err' && (
        <div className={styles.uploadStatusErr}>✕ {status.message}</div>
      )}
    </div>
  );
}

function BgmUploadSection() {
  const script = useGame((s) => s.script);
  const entries = useMemo(
    () => [
      { id: TITLE_BGM_SCENE_ID, title: '首页' },
      ...script.sceneOrder.map((id) => ({
        id,
        title: script.scenes.get(id)?.title ?? id,
      })),
    ],
    [script],
  );

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>背景音乐（按幕）</div>
      <div className={styles.uploadHint}>
        保存至 <code>public/assets/audio/bgm/{'{幕ID}'}.mp3</code>。进入该幕时若有文件则切换；
        否则继续循环上一首。首页使用 <code>{TITLE_BGM_SCENE_ID}</code>。
      </div>
      {entries.map((ch) => (
        <UploadSlot
          key={ch.id}
          kind="bgm"
          label={ch.id === TITLE_BGM_SCENE_ID ? `首页 · ${ch.title}` : `${ch.id} · ${ch.title}`}
          hint="支持 mp3 / ogg / m4a。上传会覆盖同幕其它扩展名；可点删除清空。"
          accept={BGM_ACCEPT}
          sceneId={ch.id}
          targetName={`audio/bgm/${ch.id}.{mp3|ogg|m4a}`}
          deletable
        />
      ))}
    </section>
  );
}

function TitleLogoUploadSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>首页标题图</div>
      <UploadSlot
        kind="title-logo"
        label="想见你 标题 LOGO"
        hint="支持 png / jpg / webp。建议使用透明底 PNG；若为浅色底图，引擎会自动抠除浅色背景。"
        accept={TITLE_LOGO_ACCEPT}
        targetName="ui/title-logo.{png|webp|jpg}"
        deletable
      />
    </section>
  );
}

function AssetUploadSection({
  sceneId,
  frameId,
}: {
  sceneId: string | null;
  frameId: string | null;
}) {
  const script = useGame((s) => s.script);
  const frame = useMemo<Frame | null>(() => {
    if (!sceneId || !frameId) return null;
    const scene = script.scenes.get(sceneId);
    return scene?.frames.find((f) => f.id === frameId) ?? null;
  }, [sceneId, frameId, script]);

  const sceneSwitches = useMemo(() => collectSceneSwitches(frame), [frame]);

  if (!sceneId || !frameId) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>素材上传</div>
        <div className={styles.muted}>未选中画面，无法上传。</div>
      </section>
    );
  }
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>素材上传（当前画面）</div>
        <UploadSlot
          kind="bgm"
          label="当前小章节 BGM"
          hint="保存为当前画面专属音乐。若上传，则进入该画面时覆盖本幕默认 BGM；若未上传，则继续循环上一首。"
          accept={BGM_ACCEPT}
          sceneId={sceneId}
          frameId={frameId}
          targetName={`audio/bgm/${sceneId}-${frameId}.{mp3|ogg|m4a}`}
        />
        <UploadSlot
          kind="bg"
          label="背景图 / 背景视频"
          hint="一个文件对应一帧。图片支持 png/jpg/webp；视频支持 mp4/webm（自动循环）。"
          accept={BG_ACCEPT}
          sceneId={sceneId}
          frameId={frameId}
        />
        <UploadSlot
          kind="transition"
          label="过渡视频（离开本帧时播放）"
          hint="仅支持 mp4/webm。本帧最后一次点击后播放，结束自动进入下一帧。"
          accept={TRANSITION_ACCEPT}
          sceneId={sceneId}
          frameId={frameId}
        />
        {sceneId === 'S11' && frameId === '11.4' && (
          <UploadSlot
            kind="special-audio"
            label="11.4 专属长音频"
            hint="男主第一句出现时开始播放；播完自动结束，或推进到「她把那句歌词压进心里」之后停止。"
            accept={SPECIAL_AUDIO_ACCEPT}
            sceneId={sceneId}
            frameId={frameId}
            targetName={`audio/special/${S11_BLUE_DOT_SPECIAL_AUDIO_STEM}.{mp3|ogg|m4a|wav}`}
          />
        )}
      </section>

      {sceneSwitches.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            画面切换素材（{sceneSwitches.length}）
          </div>
          <div className={styles.uploadHint}>
            本帧 <code>【画面切换：…】</code> 共 {sceneSwitches.length} 处。每处可单独上传一张图片，
            会在该 switch 触发时全屏覆盖；未上传的仍保持默认黑/白闪烁。
          </div>
          {sceneSwitches.map((sw) => (
            <UploadSlot
              key={sw.swIndex}
              kind="scene-switch"
              label={`#${sw.swIndex}${sw.fromOption ? `（选项 ${sw.fromOption}）` : ''} · ${sw.description}`}
              hint="仅支持 png/jpg/webp。会作为该 scene-switch 的全屏覆盖图。"
              accept={SCENE_SWITCH_ACCEPT}
              sceneId={sceneId}
              frameId={frameId}
              swIndex={sw.swIndex}
            />
          ))}
        </section>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 *  男主台词配音上传（当前画面）
 * ──────────────────────────────────────────────────────────────────────── */

type MaleLineEntry = {
  maleLineNumber?: number;
  voiceStem: string;
  preview: string;
  action?: string;
  source: 'main' | 'branch';
  optionLetter?: string;
};

function isMaleSpeaker(speaker: string): boolean {
  return speaker === '他' || speaker === '陌生访客' || speaker === '男主';
}

function collectMaleDialogueLines(
  frame: Frame | null,
  chosenLetter: string | undefined,
  chosenOptionByFrame: Record<string, string>,
  sceneId: string | null,
): MaleLineEntry[] {
  if (!frame) return [];
  const out: MaleLineEntry[] = [];
  void chosenLetter;
  void chosenOptionByFrame;
  void sceneId;

  for (const it of frame.dialogue?.items ?? []) {
    if (it.kind !== 'line' || !isMaleSpeaker(it.speaker) || !it.voiceKey) continue;
    const raw = it.text.replace(/\s+/g, ' ').trim();
    const preview = raw.length > 36 ? `${raw.slice(0, 36)}…` : raw;
    const numberMatch = it.voiceKey.match(/^d(\d+)$/i);
    out.push({
      maleLineNumber: numberMatch ? Number(numberMatch[1]) : undefined,
      voiceStem: it.voiceKey,
      preview,
      action: it.action,
      source: 'main',
    });
  }

  for (const it of frame.dialogue?.items ?? []) {
    if (it.kind !== 'choice') continue;
    for (const opt of it.options) {
      for (const bl of opt.branchLines ?? []) {
        if (bl.kind === 'line' && isMaleSpeaker(bl.speaker) && bl.voiceKey) {
          const raw = bl.text.replace(/\s+/g, ' ').trim();
          const preview = raw.length > 36 ? `${raw.slice(0, 36)}…` : raw;
          const voiceStem = bl.voiceKey;
          if (out.some((entry) => entry.voiceStem === voiceStem)) continue;
          out.push({
            voiceStem,
            preview,
            action: bl.action,
            source: 'branch',
            optionLetter: opt.letter,
          });
        }
      }
    }
  }
  return out;
}

function MaleVoiceUploadSection({
  sceneId,
  frameId,
}: {
  sceneId: string | null;
  frameId: string | null;
}) {
  const script = useGame((s) => s.script);
  const chosenOptionByFrame = useGame((s) => s.chosenOptionByFrame);
  const chosenLetter =
    sceneId && frameId ? chosenOptionByFrame[`${sceneId}/${frameId}`] : undefined;

  const frame = useMemo<Frame | null>(() => {
    if (!sceneId || !frameId) return null;
    const scene = script.scenes.get(sceneId);
    return scene?.frames.find((f) => f.id === frameId) ?? null;
  }, [sceneId, frameId, script]);

  const maleLines = useMemo(
    () => collectMaleDialogueLines(frame, chosenLetter, chosenOptionByFrame, sceneId),
    [frame, chosenLetter, chosenOptionByFrame, sceneId],
  );

  const [selectedLine, setSelectedLine] = useState<string | null>(null);

  useEffect(() => {
    if (maleLines.length === 0) {
      setSelectedLine(null);
      return;
    }
    setSelectedLine((prev) => {
      if (prev != null && maleLines.some((l) => l.voiceStem === prev)) return prev;
      return maleLines[0].voiceStem;
    });
  }, [maleLines]);

  if (!sceneId || !frameId) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>男主台词配音</div>
        <div className={styles.muted}>未选中画面，无法配置配音。</div>
      </section>
    );
  }

  if (maleLines.length === 0) {
    return (
      <section className={styles.section}>
        <div className={styles.sectionTitle}>男主台词配音</div>
        <div className={styles.muted}>本画面暂无男主台词。</div>
      </section>
    );
  }

  const current = maleLines.find((l) => l.voiceStem === selectedLine) ?? maleLines[0];

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>男主台词配音</div>
      <div className={styles.uploadHint}>
        播放到对应台词时自动播放；快速点掉该句会停止。文件命名：
        <code>{sceneId}-{frameId}-d{'{N}'}.mp3</code>
      </div>
      <div className={styles.uploadHint}>
        分支内男主台词会单独命名为 <code>{sceneId}-{frameId}-opt{'{A/B}'}-d{'{N}'}.mp3</code>，
        不会再和主线路径冲突。
      </div>
      {chosenLetter && (
        <div className={styles.uploadHint}>
          当前已选分支 <code>{chosenLetter}</code>。主线台词编号现在固定，不会再因为分支插入而错位。
        </div>
      )}
      <div className={styles.txRow}>
        <label className={styles.txLabel}>台词</label>
        <select
          className={styles.txSelect}
          value={selectedLine ?? current.voiceStem}
          onChange={(e) => setSelectedLine(e.target.value)}
        >
          {maleLines.map((line) => (
            <option key={line.voiceStem} value={line.voiceStem}>
              {line.source === 'branch'
                ? `分支 ${line.optionLetter ?? '?'} · ${line.voiceStem} · ${line.preview}`
                : `主线 ${line.voiceStem} · ${line.preview}`}
            </option>
          ))}
        </select>
      </div>
      {current.action && (
        <div className={styles.uploadHint}>
          动作：（{current.action}）
        </div>
      )}
      <UploadSlot
        kind="voice"
        label={`${current.source === 'branch' ? `分支 ${current.optionLetter ?? '?'}` : '主线'} · ${current.preview}`}
        hint="支持 mp3 / ogg / m4a / wav。上传后播放到该句时自动播放。"
        accept={VOICE_ACCEPT}
        sceneId={sceneId}
        frameId={frameId}
        maleLineNumber={current.maleLineNumber}
        voiceStem={current.voiceStem}
        targetName={`${sceneId}-${frameId}-${current.voiceStem}.{mp3|ogg|m4a|wav}`}
      />
    </section>
  );
}
