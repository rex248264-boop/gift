/**
 * 文字位置微调（DevPanel 工具）
 *
 * 让 Dev 可在面板里实时调整每种"文字类型"在不同主题下的上下左右偏移（像素）。
 * - 调整结果通过 useTextOffset(slot) 暴露给各 UI 组件，以 inline `transform: translate(...)` 应用
 * - 数据按 `(slot × theme)` 分别存储，自动随当前场景主题切换
 * - 数据持久化到 localStorage，刷新不丢失；可导出为 JSON / CSS
 */

import type { CSSProperties } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGame } from './store';
import { getSceneTheme, type SceneTheme } from './sceneTheme';

/* ────────────────────────────── 文字插槽定义 ────────────────────────────── */

export const TEXT_SLOTS = [
  { key: 'dialogue-name',    label: '对话框 · 姓名',        group: '对话框' },
  { key: 'dialogue-text',    label: '对话框 · 正文',        group: '对话框' },
  { key: 'dialogue-action',  label: '对话框 · 动作（括号）', group: '对话框' },
  { key: 'narration',        label: '旁白 · 文字',           group: '旁白' },
  { key: 'choice-option',    label: '选项 · 文字',           group: '选择' },
  { key: 'choice-confirm',   label: '确认按钮 · 文字',       group: '选择' },
  { key: 'choice-subprompt', label: '选项 · 题干',           group: '选择' },
  { key: 'input-prompt',     label: '输入框 · 题干',         group: '输入' },
  { key: 'input-submit',     label: '输入框 · 按钮文字',     group: '输入' },
] as const;

export type TextSlotKey = (typeof TEXT_SLOTS)[number]['key'];

export const ALL_THEMES: SceneTheme[] = ['universal', 'cyber', 'minguo'];

export const THEME_LABEL: Record<SceneTheme, string> = {
  universal: '通用 / 现实',
  cyber: '赛博',
  minguo: '民国',
};

export type Offset = { dx: number; dy: number };

const ZERO: Offset = { dx: 0, dy: 0 };

type SlotMap = Partial<Record<TextSlotKey, Offset>>;
type AllOffsets = Record<SceneTheme, SlotMap>;

const emptyAll = (): AllOffsets => ({
  universal: {},
  cyber: {},
  minguo: {},
});

interface TextOffsetState {
  offsets: AllOffsets;
  set: (theme: SceneTheme, slot: TextSlotKey, value: Offset) => void;
  patch: (theme: SceneTheme, slot: TextSlotKey, delta: Partial<Offset>) => void;
  reset: (theme?: SceneTheme, slot?: TextSlotKey) => void;
  copyTo: (fromTheme: SceneTheme, toTheme: SceneTheme) => void;
}

export const useTextOffsets = create<TextOffsetState>()(
  persist(
    (set) => ({
      offsets: emptyAll(),

      set: (theme, slot, value) =>
        set((s) => ({
          offsets: {
            ...s.offsets,
            [theme]: { ...s.offsets[theme], [slot]: value },
          },
        })),

      patch: (theme, slot, delta) =>
        set((s) => {
          const cur = s.offsets[theme][slot] ?? ZERO;
          const next: Offset = {
            dx: delta.dx !== undefined ? cur.dx + delta.dx : cur.dx,
            dy: delta.dy !== undefined ? cur.dy + delta.dy : cur.dy,
          };
          return {
            offsets: {
              ...s.offsets,
              [theme]: { ...s.offsets[theme], [slot]: next },
            },
          };
        }),

      reset: (theme, slot) =>
        set((s) => {
          if (!theme) return { offsets: emptyAll() };
          if (!slot) return { offsets: { ...s.offsets, [theme]: {} } };
          const themeMap = { ...s.offsets[theme] };
          delete themeMap[slot];
          return { offsets: { ...s.offsets, [theme]: themeMap } };
        }),

      copyTo: (fromTheme, toTheme) =>
        set((s) => ({
          offsets: {
            ...s.offsets,
            [toTheme]: { ...s.offsets[fromTheme] },
          },
        })),
    }),
    {
      name: 'xiangjianni-text-offsets',
      version: 1,
    },
  ),
);

/* ──────────────────────────── 组件侧便捷 hook ──────────────────────────── */

/**
 * 返回当前主题下指定 slot 的 inline style。
 * 若偏移为 0/0，则返回 undefined（避免无谓的样式属性）。
 */
export function useTextOffsetStyle(slot: TextSlotKey): CSSProperties | undefined {
  const offsets = useTextOffsets((s) => s.offsets);
  const theme = useCurrentTheme();
  const v = offsets[theme]?.[slot];
  if (!v || (v.dx === 0 && v.dy === 0)) return undefined;
  return {
    transform: `translate(${v.dx}px, ${v.dy}px)`,
    willChange: 'transform',
  };
}

/** 读当前场景标题推导主题；脱离 playing 阶段时回退到 universal。 */
export function useCurrentTheme(): SceneTheme {
  const phase = useGame((s) => s.phase);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const script = useGame((s) => s.script);
  if (phase !== 'playing' || !currentSceneId) return 'universal';
  const title = script.scenes.get(currentSceneId)?.title;
  return getSceneTheme(title);
}

/* ───────────────────────────── 导出工具 ───────────────────────────── */

export function getNonEmptyOffsets(all: AllOffsets): AllOffsets {
  const out: AllOffsets = emptyAll();
  for (const t of ALL_THEMES) {
    for (const [k, v] of Object.entries(all[t])) {
      if (v && (v.dx !== 0 || v.dy !== 0)) {
        out[t][k as TextSlotKey] = v;
      }
    }
  }
  return out;
}
