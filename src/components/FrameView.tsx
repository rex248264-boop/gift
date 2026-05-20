import { useEffect, useMemo, useRef, useState } from 'react';
import type { Frame } from '@/parser';
import { tapAdvance, currentScene, getEffectiveItems, submitTextInput } from '@/engine';
import { SceneBackground, type BgOverride } from './SceneBackground';
import { Character } from './Character';
import { MicroEffect } from './MicroEffect';
import { NarrationBox } from './NarrationBox';
import { DialogueBox } from './DialogueBox';
import { ChoiceMenu } from './ChoiceMenu';
import { TextInputBox } from './TextInputBox';
import { Transition } from './Transition';
import { VideoTransition } from './VideoTransition';
import { TopBar } from './TopBar';
import { useGame } from '@/engine';
import {
  resolveTransitionVideo,
  resolveSceneSwitchImage,
  pickFirstExisting,
} from '@/engine/assetResolver';
import { audio } from '@/audio/audioManager';
import styles from './FrameView.module.css';

type Props = {
  sceneId: string;
  frame: Frame;
};

const S11_BLUE_DOT_START_ACTION = '他的视线从始至终只落在你身上';
const S11_BLUE_DOT_STOP_ACTION = '在这瞬间心跳，为你而停留';

export function FrameView({ sceneId, frame }: Props) {
  const dialogueIdx = useGame((s) => s.currentDialogueIdx);
  const audioUnlocked = useGame((s) => s.audioUnlocked);
  const unlockAudio = useGame((s) => s.unlockAudio);
  // 订阅完整 map，使跨帧延续 choice（refFrameId）也能响应式地更新
  const chosenOptionByFrame = useGame((s) => s.chosenOptionByFrame);
  const chosenLetter = chosenOptionByFrame[`${sceneId}/${frame.id}`];

  // 把选中的 choice 节点替换为该 option 的 branchLines；
  // 这样 dialogueIdx 不变也能继续正确指向"选中后第一行支线对话"。
  const items = useMemo(
    () => getEffectiveItems(frame, chosenLetter, chosenOptionByFrame, sceneId),
    [frame, chosenLetter, chosenOptionByFrame, sceneId],
  );

  const currentItem = items[dialogueIdx];

  // 旁白被解析为 items 流里的 `kind: 'narration'` 项，与对话行交错。当
  // currentItem 是 narration 时显示 NarrationBox，玩家点击屏幕翻页；翻完最
  // 后一页后再点击会 advance 到下一个 item（可能是对话行、也可能是另一段旁
  // 白——这样「旁白 → 对话 → 旁白」会严格按文档顺序播放）。
  // 每次点击翻一"页"（NARRATION_PAGE_SIZE 行），整页替换，不逐行累积。
  const NARRATION_PAGE_SIZE = 3;
  const [narrationPage, setNarrationPage] = useState(0); // 当前页起始行索引
  const [transitionVisible, setTransitionVisible] = useState(false);
  const [sceneExitTransitionVisible, setSceneExitTransitionVisible] = useState(false);
  const [bgOverride, setBgOverride] = useState<BgOverride | null>(null);
  const bgOverrideToggleRef = useRef(false);

  // Probe for a transition video keyed to this frame (plays when leaving the frame).
  const [videoTransitionSrc, setVideoTransitionSrc] = useState<string | null>(null);
  const [showVideoTransition, setShowVideoTransition] = useState(false);
  const assetNonce = useGame((s) => s.assetRefreshNonce);

  // 预解析本帧 effective items 中所有 scene-switch 的上传素材 URL；当 scene-switch
  // 真的成为 currentItem 时直接查表使用，避免每次 advance 都触发异步 fetch。
  const [sceneSwitchUrls, setSceneSwitchUrls] = useState<Map<number, string>>(new Map());

  const narrationItem = currentItem?.kind === 'narration' ? currentItem : null;
  const narrationLines = narrationItem?.lines ?? [];
  const atLastNarrationPage =
    !!narrationItem && narrationPage + NARRATION_PAGE_SIZE >= narrationLines.length;

  useEffect(() => {
    setTransitionVisible(false);
    setSceneExitTransitionVisible(false);
    setBgOverride(null);
    bgOverrideToggleRef.current = false;
  }, [frame.id, sceneId]);

  // 切换到新 item 时把旁白的页索引归零；保证每段独立旁白都从第一页开始。
  useEffect(() => {
    setNarrationPage(0);
  }, [frame.id, sceneId, dialogueIdx]);

  // Re-probe transition video whenever the frame changes OR an asset is re-uploaded.
  useEffect(() => {
    setVideoTransitionSrc(null);
    setShowVideoTransition(false);
    const candidates = resolveTransitionVideo(sceneId, frame.id);
    pickFirstExisting(candidates).then((url) => {
      setVideoTransitionSrc(url && assetNonce > 0 ? `${url}?v=${assetNonce}` : url);
    });
  }, [frame.id, sceneId, assetNonce]);

  // 预解析本帧 effective items 路径上每个 scene-switch 的上传素材 URL。
  useEffect(() => {
    let cancelled = false;
    const switches = items.filter(
      (it): it is typeof it & { kind: 'scene-switch'; swIndex: number } =>
        it.kind === 'scene-switch' && typeof it.swIndex === 'number',
    );
    if (switches.length === 0) {
      setSceneSwitchUrls(new Map());
      return () => {
        cancelled = true;
      };
    }
    Promise.all(
      switches.map(async (sw) => {
        const url = await pickFirstExisting(resolveSceneSwitchImage(sceneId, frame.id, sw.swIndex));
        return { swIndex: sw.swIndex, url };
      }),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<number, string>();
      for (const r of results) {
        if (r.url) map.set(r.swIndex, assetNonce > 0 ? `${r.url}?v=${assetNonce}` : r.url);
      }
      setSceneSwitchUrls(map);
    });
    return () => {
      cancelled = true;
    };
  }, [items, sceneId, frame.id, assetNonce]);

  // Scene-switch 自动播放：若该 switch 有上传素材，用图片覆盖；否则回落到
  // 黑/白闪烁的占位方案。设置完覆盖后立即 tapAdvance 跳到下一个 item，
  // 覆盖图会留在屏幕上直到下一次 scene-switch 或换帧。
  useEffect(() => {
    if (currentItem?.kind !== 'scene-switch') return;
    const swIndex = currentItem.swIndex;
    const uploadedUrl = swIndex != null ? sceneSwitchUrls.get(swIndex) : undefined;
    if (uploadedUrl) {
      setBgOverride({ kind: 'image', url: uploadedUrl });
    } else {
      bgOverrideToggleRef.current = !bgOverrideToggleRef.current;
      setBgOverride({
        kind: 'color',
        value: bgOverrideToggleRef.current ? '#000000' : '#ffffff',
      });
    }
    tapAdvance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, sceneSwitchUrls]);

  const scene = currentScene();
  const lastBgmSceneIdRef = useRef<string | null>(null);

  // BGM 同步：新幕先尝试幕级默认，再尝试当前小章节覆盖；
  // 若当前小章节没有新音乐，则继续循环上一首，不回退、不叠播。
  useEffect(() => {
    if (!audioUnlocked) return;
    const sceneBgm = scene?.hints.bgm;
    const frameBgm = frame.description?.hints.bgm ?? frame.dialogue?.hints.bgm;
    const sceneChanged = lastBgmSceneIdRef.current !== sceneId;
    lastBgmSceneIdRef.current = sceneId;
    void audio.syncBGM({
      sceneId,
      frameId: frame.id,
      sceneHint: sceneBgm,
      frameHint: frameBgm,
      sceneChanged,
      cacheBust: assetNonce || undefined,
    });
  }, [sceneId, frame.id, audioUnlocked, frame.description?.hints.bgm, frame.dialogue?.hints.bgm, scene?.hints.bgm, assetNonce]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const sfx = frame.description?.hints.sfx;
    if (sfx) audio.playSFX(sfx);
  }, [sceneId, frame.id, audioUnlocked]);

  const maleLineMap = useMemo(() => {
    const map = new Map<number, number>();
    let counter = 0;
    // 基于当前 effective items 计数：这样 choice 选中后插入的 branchLines
    // 里的「他」台词也会获得正常的 dN 序号，可直接挂对应语音文件。
    items.forEach((it, idx) => {
      if (it.kind === 'line' && (it.speaker === '他' || it.speaker === '陌生访客' || it.speaker === '男主')) {
        counter += 1;
        map.set(idx, counter);
      }
    });
    return map;
  }, [items]);

  const blueDotSpecialRange = useMemo(() => {
    if (sceneId !== 'S11' || frame.id !== '11.4') return null;
    const start = items.findIndex(
      (it) =>
        it.kind === 'line' &&
        it.speaker === '他' &&
        (it.action ?? '').includes(S11_BLUE_DOT_START_ACTION),
    );
    const end = items.findIndex(
      (it) =>
        it.kind === 'line' &&
        it.speaker === '她' &&
        (it.action ?? '').includes(S11_BLUE_DOT_STOP_ACTION),
    );
    if (start < 0 || end < start) return null;
    return { start, end };
  }, [frame.id, items, sceneId]);

  const suppressLineVoice =
    !!blueDotSpecialRange &&
    dialogueIdx >= blueDotSpecialRange.start &&
    dialogueIdx <= blueDotSpecialRange.end;

  useEffect(() => {
    if (!audioUnlocked || !blueDotSpecialRange) {
      audio.stopSpecialVoice();
      return;
    }
    if (dialogueIdx === blueDotSpecialRange.start) {
      void audio.playS11BlueDotSpecialVoice(assetNonce || undefined);
      return;
    }
    if (dialogueIdx > blueDotSpecialRange.end) {
      audio.stopSpecialVoice();
    }
  }, [assetNonce, audioUnlocked, blueDotSpecialRange, dialogueIdx]);

  useEffect(() => () => audio.stopSpecialVoice(), [frame.id, sceneId]);

  const activeSpeaker =
    currentItem && currentItem.kind === 'line' ? currentItem : null;

  const isChoice = currentItem?.kind === 'choice';
  const isInput = currentItem?.kind === 'input';
  const isInteractive = isChoice || isInput;

  // True when the next tap would call state.advance() (exit this frame).
  const nextTapExitsFrame =
    !isInteractive &&
    (items.length === 0 || dialogueIdx >= items.length - 1);
  const isLastFrameOfScene = scene?.frames[scene.frames.length - 1]?.id === frame.id;
  const nextTapExitsScene = nextTapExitsFrame && isLastFrameOfScene;
  const beginSceneExitTransition = () => {
    audio.stopBGM();
    audio.stopVoice();
    audio.stopSpecialVoice();
    setSceneExitTransitionVisible(true);
  };

  const onScreenTap = () => {
    if (sceneExitTransitionVisible) return;
    if (!audioUnlocked) {
      audio.unlock();
      unlockAudio();
    }
    // 当前 item 是旁白：先翻页，翻到最后一页再点击会 advance 到下一个 item
    // （这就是「旁白 → 对话 → 旁白」按文档顺序播放的关键）。
    if (narrationItem) {
      if (atLastNarrationPage) {
        // 若这一段旁白也正好是该帧最后一个 item 且帧绑定了过场视频，先播视频。
        if (nextTapExitsFrame && videoTransitionSrc && !showVideoTransition) {
          setShowVideoTransition(true);
          return;
        }
        if (nextTapExitsScene) {
          beginSceneExitTransition();
          return;
        }
        tapAdvance();
      } else {
        setNarrationPage((p) => p + NARRATION_PAGE_SIZE);
      }
      return;
    }
    if (isInteractive) return;

    // If there's a transition video for this frame and we're about to leave it,
    // show the video first; actual advance happens in onVideoTransitionDone.
    if (nextTapExitsFrame && videoTransitionSrc && !showVideoTransition) {
      setShowVideoTransition(true);
      return;
    }

    if (nextTapExitsScene) {
      beginSceneExitTransition();
      return;
    }

    tapAdvance();
  };

  const onVideoTransitionDone = () => {
    setShowVideoTransition(false);
    useGame.getState().advance();
  };

  // Custom handler for TextInputBox: replicates submitTextInput but intercepts
  // the final state.advance() so we can play the transition video first.
  const handleTextInputConfirm = (flagKey: string | undefined, value: string) => {
    const storeState = useGame.getState();
    if (flagKey) storeState.setFlag(flagKey, value);
    const newIdx = storeState.currentDialogueIdx + 1;
    storeState.setDialogueIdx(newIdx);
    const wouldAdvance = newIdx >= items.length;
    if (wouldAdvance && videoTransitionSrc) {
      setShowVideoTransition(true);
    } else if (wouldAdvance && isLastFrameOfScene) {
      beginSceneExitTransition();
    } else if (wouldAdvance) {
      storeState.advance();
    }
  };

  const bgHint = frame.description?.hints.bg;
  const effectHint = frame.description?.hints.effect;
  const effectPos = (frame.description?.hints.effectPos as
    | 'center' | 'center-top' | 'center-bottom' | 'left' | 'right' | 'full'
    | undefined) ?? 'center';

  const sceneTitle = scene?.title;

  return (
    <div className={styles.root} onClick={onScreenTap}>
      <SceneBackground
        sceneId={sceneId}
        frameId={frame.id}
        hint={bgHint}
        fallbackText={frame.description?.scene?.text}
        bgOverride={bgOverride}
      />

      <MicroEffect hint={effectHint} position={effectPos} />

      <Character
        speaker={activeSpeaker?.speaker ?? ''}
        action={activeSpeaker?.action}
        active={!!activeSpeaker && activeSpeaker.speaker !== '旁白'}
      />

      {narrationItem && (
        <NarrationBox
          key={`narr-${frame.id}-${dialogueIdx}`}
          lines={narrationItem.lines}
          pageStart={narrationPage}
          pageSize={NARRATION_PAGE_SIZE}
        />
      )}

      <TopBar contextLabel={sceneTitle} />

      {currentItem && currentItem.kind === 'line' && (
        <DialogueBox
          key={`${frame.id}-${dialogueIdx}`}
          line={currentItem}
          sceneId={sceneId}
          frameId={frame.id}
          maleLineNumber={maleLineMap.get(dialogueIdx) ?? 1}
          suppressVoice={suppressLineVoice}
        />
      )}

      {currentItem && currentItem.kind === 'choice' && (
        <ChoiceMenu choice={currentItem} />
      )}

      {currentItem && currentItem.kind === 'input' && (
        <TextInputBox block={currentItem} onConfirm={handleTextInputConfirm} />
      )}

      <Transition
        visible={transitionVisible || sceneExitTransitionVisible}
        text={transitionVisible ? frame.transition?.rawText.split('\n')[0] : undefined}
        duration={sceneExitTransitionVisible ? 2200 : undefined}
        onDone={sceneExitTransitionVisible ? () => useGame.getState().advance() : undefined}
      />

      {showVideoTransition && videoTransitionSrc && (
        <VideoTransition src={videoTransitionSrc} onDone={onVideoTransitionDone} />
      )}
    </div>
  );
}
