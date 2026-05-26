import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/engine';
import { TITLE_BGM_SCENE_ID } from '@/engine/assetResolver';
import { audio } from '@/audio/audioManager';
import { OfflineDownload } from '@/components/OfflineDownload';
import { TitleLogo } from '@/components/TitleLogo';
import styles from './TitleScreen.module.css';

export function TitleScreen() {
  const startNewGame = useGame((s) => s.startNewGame);
  const unlockAudio = useGame((s) => s.unlockAudio);
  const script = useGame((s) => s.script);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const canResumeFromSave = useGame((s) => s.canResumeFromSave);
  const clearedScenes = useGame((s) => s.clearedScenes);
  const setPhase = useGame((s) => s.setPhase);
  const replayChapter = useGame((s) => s.replayChapter);
  const audioUnlocked = useGame((s) => s.audioUnlocked);
  const assetRefreshNonce = useGame((s) => s.assetRefreshNonce);

  const [showContinueMenu, setShowContinueMenu] = useState(false);

  useEffect(() => {
    if (!audioUnlocked) return;
    void audio.syncBGM({
      sceneId: TITLE_BGM_SCENE_ID,
      frameId: '__scene__',
      sceneChanged: true,
      cacheBust: assetRefreshNonce || undefined,
    });
  }, [audioUnlocked, assetRefreshNonce]);

  const unlockTitleAudio = () => {
    if (audioUnlocked) {
      void audio.syncBGM({
        sceneId: TITLE_BGM_SCENE_ID,
        frameId: '__scene__',
        sceneChanged: true,
        cacheBust: assetRefreshNonce || undefined,
      });
      return;
    }
    audio.unlock();
    unlockAudio();
    void audio.syncBGM({
      sceneId: TITLE_BGM_SCENE_ID,
      frameId: '__scene__',
      sceneChanged: true,
      cacheBust: assetRefreshNonce || undefined,
    });
  };

  const unlockAnd = (fn: () => void) => {
    audio.unlock();
    unlockAudio();
    fn();
  };

  const handleStart = () => {
    const firstSceneId = script.sceneOrder[0] ?? 'S01';
    unlockAnd(() => {
      audio.playKnownBGM(
        `/assets/audio/bgm/${firstSceneId}.mp3`,
        firstSceneId,
        assetRefreshNonce || undefined,
      );
      startNewGame(firstSceneId);
    });
  };

  const clearedChapterList = useMemo(() => {
    const order = script.sceneOrder;
    return order
      .filter((id) => clearedScenes.includes(id))
      .map((id) => {
        const scene = script.scenes.get(id);
        return { id, title: scene?.title ?? id };
      });
  }, [script, clearedScenes]);

  const canResume = Boolean(currentSceneId && canResumeFromSave);
  const canContinue = canResume || clearedChapterList.length > 0;

  const handleOpenContinue = () => {
    if (!canContinue) return;
    if (canResume && clearedChapterList.length === 0) {
      unlockAnd(() => setPhase('playing'));
      return;
    }
    setShowContinueMenu(true);
  };

  const handleResume = () => {
    unlockAnd(() => {
      setShowContinueMenu(false);
      setPhase('playing');
    });
  };

  const handleReplay = (sceneId: string) => {
    unlockAnd(() => {
      setShowContinueMenu(false);
      replayChapter(sceneId);
    });
  };

  return (
    <div className={styles.root} onPointerDown={unlockTitleAudio}>
      <video
        className={styles.bgVideo}
        src="/assets/video/home.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className={styles.overlay} />

      <div className={styles.titleStack}>
        <TitleLogo assetNonce={assetRefreshNonce} />
      </div>

      <div className={styles.buttons} onPointerDown={(e) => e.stopPropagation()}>
        <button className={styles.btnPrimary} onClick={handleStart}>
          开始游戏
        </button>
        {canContinue && (
          <button className={styles.btnSecondary} onClick={handleOpenContinue}>
            继续
          </button>
        )}
        <OfflineDownload />
      </div>

      {showContinueMenu && (
        <div
          className={styles.continueOverlay}
          onClick={() => setShowContinueMenu(false)}
          role="presentation"
        >
          <div
            className={styles.continuePanel}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="继续游戏"
          >
            <div className={styles.continueTitle}>继续 / 章节</div>
            {canResume && (
              <button type="button" className={styles.continueResumeBtn} onClick={handleResume}>
                从当前进度继续
                {currentSceneId && (
                  <span className={styles.continueResumeMeta}>
                    {script.scenes.get(currentSceneId)?.title ?? currentSceneId}
                  </span>
                )}
              </button>
            )}
            {clearedChapterList.length > 0 && (
              <>
                {canResume && <div className={styles.continueDivider}>或重玩已通关章节</div>}
                <div className={styles.chapterList}>
                  {clearedChapterList.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className={styles.chapterBtn}
                      onClick={() => handleReplay(ch.id)}
                    >
                      <span className={styles.chapterId}>{ch.id}</span>
                      <span className={styles.chapterTitle}>{ch.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              className={styles.continueCloseBtn}
              onClick={() => setShowContinueMenu(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
