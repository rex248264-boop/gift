import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Script } from '@/parser';
import { loadAllScripts } from '@/parser';

export type Flags = Record<string, number | string | boolean>;

export type AppPhase = 'title' | 'playing' | 'gameover' | 'ending';

/** 段落 BE：播完本场后展示「游戏结束」，不进入下游场次 */
export const BRANCH_GAME_OVER_SCENES = new Set(['S06B', 'S13B']);

export type FontScale = 'sm' | 'md' | 'lg';

export type ScriptUpdateTrigger = number;

export interface GameState {
  script: Script;
  diagnostics: ReturnType<typeof loadAllScripts>['diagnostics'];
  scriptVersion: ScriptUpdateTrigger;

  phase: AppPhase;
  currentSceneId: string | null;
  currentFrameId: string | null;
  currentDialogueIdx: number;

  flags: Flags;
  history: { sceneId: string; frameId: string }[];

  /**
   * 玩家在每一帧的选择记录。key = `${sceneId}/${frameId}`，value = 选项字母（如 "A"）。
   * 用于在 FrameView 中把 choice 节点就地替换为对应 option 的 branchLines。
   */
  chosenOptionByFrame: Record<string, string>;

  /** 已通关（完整播完）的场次，用于首页章节重玩 */
  clearedScenes: string[];
  /** 是否允许标题页展示「从当前进度继续」 */
  canResumeFromSave: boolean;
  /** 最近一次结局来源场次（如 S06B / S13B / S14） */
  endingSceneId: string | null;

  devMode: boolean;
  showDevPanel: boolean;
  audioUnlocked: boolean;
  fontScale: FontScale;

  /**
   * Bumped whenever an asset (background/transition) is re-uploaded from the
   * dev panel. Components that resolve assets read this and append it as a
   * cache-buster to invalidate the browser cache + force a re-resolve.
   */
  assetRefreshNonce: number;

  setPhase: (p: AppPhase) => void;
  goToTitle: () => void;
  setFontScale: (scale: FontScale) => void;
  startNewGame: (sceneId?: string) => void;
  replayChapter: (sceneId: string) => void;
  jumpTo: (sceneId: string, frameId?: string) => void;
  markSceneCleared: (sceneId: string) => void;
  advance: () => void;
  setDialogueIdx: (i: number) => void;
  setFlag: (key: string, value: number | string | boolean) => void;
  addToFlag: (key: string, delta: number) => void;
  getFlag: <T = number | string | boolean | undefined>(key: string) => T;
  setChosenOption: (sceneId: string, frameId: string, letter: string) => void;
  clearChosenOption: (sceneId: string, frameId: string) => void;
  toggleDevPanel: () => void;
  unlockAudio: () => void;
  reloadScript: () => void;
  bumpAssetRefresh: () => void;
}

const initial = loadAllScripts();
const FIRST_SCENE = initial.script.sceneOrder[0] ?? 'S01';

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      script: initial.script,
      diagnostics: initial.diagnostics,
      scriptVersion: Date.now(),

      phase: 'title',
      currentSceneId: null,
      currentFrameId: null,
      currentDialogueIdx: 0,

      flags: {},
      history: [],
      chosenOptionByFrame: {},

      clearedScenes: [],
      canResumeFromSave: false,
      endingSceneId: null,

      devMode: import.meta.env.DEV,
      showDevPanel: false,
      audioUnlocked: false,
      fontScale: 'md',
      assetRefreshNonce: 0,

      setPhase: (p) => set({ phase: p }),

      goToTitle: () =>
        set({
          phase: 'title',
          endingSceneId: null,
        }),

      setFontScale: (scale) => set({ fontScale: scale }),

      startNewGame: (sceneId) => {
        const id = sceneId ?? FIRST_SCENE;
        const scene = get().script.scenes.get(id);
        const firstFrame = scene?.frames[0];
        set({
          phase: 'playing',
          currentSceneId: id,
          currentFrameId: firstFrame?.id ?? null,
          currentDialogueIdx: 0,
          flags: {},
          history: firstFrame ? [{ sceneId: id, frameId: firstFrame.id }] : [],
          chosenOptionByFrame: {},
          canResumeFromSave: true,
          endingSceneId: null,
        });
      },

      markSceneCleared: (sceneId) => {
        const id = sceneId.toUpperCase();
        set((s) => {
          if (s.clearedScenes.includes(id)) return s;
          return { clearedScenes: [...s.clearedScenes, id] };
        });
      },

      replayChapter: (sceneId) => {
        const id = sceneId.toUpperCase();
        set((s) => {
          const nextChosen = { ...s.chosenOptionByFrame };
          const prefix = `${id}/`;
          for (const key of Object.keys(nextChosen)) {
            if (key.startsWith(prefix)) delete nextChosen[key];
          }
          return { chosenOptionByFrame: nextChosen };
        });
        get().jumpTo(id);
      },

      jumpTo: (sceneId, frameId) => {
        const scene = get().script.scenes.get(sceneId.toUpperCase());
        if (!scene) {
          console.warn(`[jumpTo] scene not found: ${sceneId}`);
          return;
        }
        const frame = frameId
          ? scene.frames.find((f) => f.id === frameId) ?? scene.frames[0]
          : scene.frames[0];
        if (!frame) return;
        const targetKey = `${scene.id}/${frame.id}`;
        set((s) => {
          // 进入目标场景时清掉本场旧选择记录，使重访/调试跳转时玩家可以重新选择。
          // 只清目标帧不够：S12 这类分叉在后续帧，旧选择会让 choice 被 branchLines 直接替换。
          const nextChosen = { ...s.chosenOptionByFrame };
          const prefix = `${scene.id}/`;
          for (const key of Object.keys(nextChosen)) {
            if (key.startsWith(prefix)) delete nextChosen[key];
          }
          delete nextChosen[targetKey];
          return {
            phase: 'playing',
            currentSceneId: scene.id,
            currentFrameId: frame.id,
            currentDialogueIdx: 0,
            history: [...s.history, { sceneId: scene.id, frameId: frame.id }],
            chosenOptionByFrame: nextChosen,
            canResumeFromSave: true,
            endingSceneId: null,
          };
        });
      },

      advance: () => {
        const { script, currentSceneId, currentFrameId, chosenOptionByFrame } = get();
        if (!currentSceneId || !currentFrameId) return;
        const scene = script.scenes.get(currentSceneId);
        if (!scene) return;
        const idx = scene.frames.findIndex((f) => f.id === currentFrameId);
        if (idx < 0) return;

        // 命运分叉：当前帧已选中的选项若带 targetSceneId，跳到指定目标
        const chosenLetter = chosenOptionByFrame[`${currentSceneId}/${currentFrameId}`];
        if (chosenLetter) {
          const curFrame = scene.frames[idx];
          for (const item of curFrame?.dialogue?.items ?? []) {
            if (item.kind === 'choice') {
              const opt = item.options.find((o) => o.letter === chosenLetter);
              if (opt?.targetSceneId) {
                get().markSceneCleared(scene.id);
                get().jumpTo(opt.targetSceneId, opt.targetFrameId);
                return;
              }
              break;
            }
          }
        }

        const next = scene.frames[idx + 1];
        if (next) {
          set((s) => ({
            currentFrameId: next.id,
            currentDialogueIdx: 0,
            history: [...s.history, { sceneId: scene.id, frameId: next.id }],
          }));
        } else {
          get().markSceneCleared(scene.id);

          // 段落 BE：播完展示「游戏结束」，不进入 S07 / S14 等下游；
          // 但保留当前进度，方便玩家回到标题页后继续或重看。
          if (BRANCH_GAME_OVER_SCENES.has(scene.id)) {
            set({
              phase: 'gameover',
              endingSceneId: scene.id,
              canResumeFromSave: true,
            });
            return;
          }

          // End of scene: S14 now always flows into the final letter chapter.
          // S15 owns the custom darkened-envelope reveal instead of the normal ending screen.
          if (scene.id === 'S14') {
            if (script.scenes.has('S15')) {
              get().jumpTo('S15');
            } else {
              set({ phase: 'ending', endingSceneId: 'S14', canResumeFromSave: false });
            }
            return;
          }
          // General case: try downstream meta, otherwise next scene in order
          const downstreamMatch = scene.meta.downstream?.match(/S\d+[a-z]?/i);
          const nextSceneId = downstreamMatch
            ? downstreamMatch[0].toUpperCase()
            : nextInOrder(script, scene.id);
          if (nextSceneId && script.scenes.has(nextSceneId)) {
            get().jumpTo(nextSceneId);
          } else {
            set({ phase: 'ending', endingSceneId: scene.id, canResumeFromSave: false });
          }
        }
      },

      setDialogueIdx: (i) => set({ currentDialogueIdx: i }),

      setFlag: (key, value) => set((s) => ({ flags: { ...s.flags, [key]: value } })),
      addToFlag: (key, delta) =>
        set((s) => {
          const cur = Number(s.flags[key] ?? 0);
          return { flags: { ...s.flags, [key]: cur + delta } };
        }),
      getFlag: (key) => get().flags[key] as never,

      setChosenOption: (sceneId, frameId, letter) =>
        set((s) => ({
          chosenOptionByFrame: {
            ...s.chosenOptionByFrame,
            [`${sceneId}/${frameId}`]: letter,
          },
        })),

      clearChosenOption: (sceneId, frameId) =>
        set((s) => {
          const key = `${sceneId}/${frameId}`;
          if (!(key in s.chosenOptionByFrame)) return s;
          const next = { ...s.chosenOptionByFrame };
          delete next[key];
          return { chosenOptionByFrame: next };
        }),

      toggleDevPanel: () => set((s) => ({ showDevPanel: !s.showDevPanel })),
      unlockAudio: () => set({ audioUnlocked: true }),

      reloadScript: () => {
        const { script, diagnostics } = loadAllScripts();
        set({ script, diagnostics, scriptVersion: Date.now() });
      },

      bumpAssetRefresh: () => set((s) => ({ assetRefreshNonce: s.assetRefreshNonce + 1 })),
    }),
    {
      name: 'xiangjianni-save',
      partialize: (s) => ({
        flags: s.flags,
        history: s.history,
        currentSceneId: s.currentSceneId,
        currentFrameId: s.currentFrameId,
        currentDialogueIdx: s.currentDialogueIdx,
        phase: s.phase,
        chosenOptionByFrame: s.chosenOptionByFrame,
        clearedScenes: s.clearedScenes,
        canResumeFromSave: s.canResumeFromSave,
        endingSceneId: s.endingSceneId,
        fontScale: s.fontScale,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 旧存档：S06B/S13B 误存为 ending → 纠正为 gameover
        if (
          state.phase === 'ending' &&
          state.endingSceneId &&
          BRANCH_GAME_OVER_SCENES.has(state.endingSceneId.toUpperCase())
        ) {
          state.phase = 'gameover';
        }
      },
    },
  ),
);

function nextInOrder(script: Script, sceneId: string): string | null {
  const idx = script.sceneOrder.indexOf(sceneId);
  if (idx < 0) return null;
  return script.sceneOrder[idx + 1] ?? null;
}

// HMR: re-parse scripts when any .md changes
if (import.meta.hot) {
  if (typeof window !== 'undefined') {
    import.meta.hot.on('script-changed', () => {
      useGame.getState().reloadScript();
    });
  }
}
