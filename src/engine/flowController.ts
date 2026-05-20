import type { ChoiceOption, DialogueItem, Frame } from '@/parser';
import { useGame } from './store';

// flowController: side-effects for user actions (tap to advance, choose, input).

/**
 * 计算"考虑当前帧已选中分支"后的有效 items 序列：
 * 若帧内某个 choice 已被选中、且对应 option 带 branchLines，
 * 则把 choice 节点原地替换为这些支线对话行；否则保持原样。
 * FrameView 与 tapAdvance 共用，保证 dialogueIdx 在两边语义一致。
 *
 * @param chosenLetter       当前帧自身的选择字母（常规 choice 用）
 * @param allChosenByFrame   完整的 chosenOptionByFrame map（跨帧延续 choice 用）
 * @param sceneId            当前场景 ID（配合 allChosenByFrame 查跨帧选择）
 */
export function getEffectiveItems(
  frame: Frame,
  chosenLetter: string | undefined,
  allChosenByFrame?: Record<string, string>,
  sceneId?: string,
): DialogueItem[] {
  const base = frame.dialogue?.items ?? [];
  const hasChoice = base.some((it) => it.kind === 'choice');
  if (!hasChoice) return base;

  const out: DialogueItem[] = [];
  for (const it of base) {
    if (it.kind === 'choice') {
      // 跨帧延续：从被引用帧的选择记录中读取字母
      const effectiveLetter =
        it.refFrameId && sceneId && allChosenByFrame
          ? allChosenByFrame[`${sceneId}/${it.refFrameId}`]
          : chosenLetter;

      if (effectiveLetter) {
        const chosen = it.options.find((o) => o.letter === effectiveLetter);
        if (chosen?.branchLines && chosen.branchLines.length > 0) {
          out.push(...chosen.branchLines);
          continue;
        }
      }
    }
    out.push(it);
  }
  return out;
}

export function tapAdvance() {
  const state = useGame.getState();
  const frame = currentFrame();
  if (!frame) return;
  const { currentSceneId, currentFrameId, chosenOptionByFrame } = state;
  const chosenLetter =
    currentSceneId && currentFrameId
      ? chosenOptionByFrame[`${currentSceneId}/${currentFrameId}`]
      : undefined;
  const items = getEffectiveItems(
    frame,
    chosenLetter,
    chosenOptionByFrame,
    currentSceneId ?? undefined,
  );

  if (state.currentDialogueIdx < items.length) {
    const current = items[state.currentDialogueIdx];
    // Interactive items block auto-advance
    if (current.kind === 'choice' || current.kind === 'input') {
      return;
    }
    state.setDialogueIdx(state.currentDialogueIdx + 1);
    if (state.currentDialogueIdx + 1 < items.length) return;
  }

  // All dialogue consumed: only advance frame if no pending interactive
  const lastItem = items[items.length - 1];
  if (lastItem && (lastItem.kind === 'choice' || lastItem.kind === 'input')) return;

  state.advance();
}

export function chooseOption(option: ChoiceOption) {
  const state = useGame.getState();
  if (option.flagDelta) {
    for (const [k, v] of Object.entries(option.flagDelta)) {
      state.addToFlag(k, v);
    }
  }

  const hasBranch = !!option.branchLines && option.branchLines.length > 0;
  const { currentSceneId, currentFrameId } = state;

  // 选项里嵌了支线对话：把"已选中"写进 store，让 FrameView 把 choice
  // 节点替换成 branchLines；玩家继续点击屏幕逐行推进，最后到达帧尾时
  // 由 store.advance() 决定是常规推进、还是按命运分叉跳到 targetSceneId。
  if (hasBranch && option.letter && currentSceneId && currentFrameId) {
    state.setChosenOption(currentSceneId, currentFrameId, option.letter);
    return;
  }

  // 没有支线对话：保持原行为——若有目标场则直接跳，否则推进下一帧。
  if (option.targetSceneId) {
    state.jumpTo(option.targetSceneId.toUpperCase(), option.targetFrameId);
  } else {
    state.advance();
  }
}

export function submitTextInput(flagKey: string | undefined, value: string) {
  const state = useGame.getState();
  if (flagKey) state.setFlag(flagKey, value);
  // Advance past the input item
  state.setDialogueIdx(state.currentDialogueIdx + 1);
  const frame = currentFrame();
  const { currentSceneId, currentFrameId, chosenOptionByFrame } = state;
  const chosenLetter =
    currentSceneId && currentFrameId
      ? chosenOptionByFrame[`${currentSceneId}/${currentFrameId}`]
      : undefined;
  const items = frame
    ? getEffectiveItems(frame, chosenLetter, chosenOptionByFrame, currentSceneId ?? undefined)
    : [];
  if (state.currentDialogueIdx + 1 >= items.length) {
    state.advance();
  }
}

export function currentFrame() {
  const { script, currentSceneId, currentFrameId } = useGame.getState();
  if (!currentSceneId || !currentFrameId) return null;
  return script.scenes.get(currentSceneId)?.frames.find((f) => f.id === currentFrameId) ?? null;
}

export function currentScene() {
  const { script, currentSceneId } = useGame.getState();
  if (!currentSceneId) return null;
  return script.scenes.get(currentSceneId) ?? null;
}
