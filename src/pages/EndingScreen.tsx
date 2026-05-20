import { useMemo } from 'react';
import { useGame } from '@/engine';
import { audio } from '@/audio/audioManager';
import styles from './EndingScreen.module.css';

export function EndingScreen() {
  const goToTitle = useGame((s) => s.goToTitle);
  const endingSceneId = useGame((s) => s.endingSceneId);
  const script = useGame((s) => s.script);

  const endingCopy = useMemo(() => {
    const sceneTitle = endingSceneId
      ? script.scenes.get(endingSceneId)?.title
      : undefined;
    return {
      title: sceneTitle ? `· ${sceneTitle} ·` : '· 暂告一段落 ·',
      text: '烛火已尽，故事在此留下余韵。欢迎回到主界面，从已通关章节重玩或继续探索。',
    };
  }, [endingSceneId, script]);

  const goHome = () => {
    audio.stopBGM();
    audio.stopVoice();
    goToTitle();
  };

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>{endingCopy.title}</h2>
      <p className={styles.text}>{endingCopy.text}</p>
      <button type="button" className={styles.btn} onClick={goHome}>
        回到主界面
      </button>
    </div>
  );
}
