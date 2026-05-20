import { useMemo } from 'react';
import { useGame } from '@/engine';
import { audio } from '@/audio/audioManager';
import styles from './GameOverScreen.module.css';

export function GameOverScreen() {
  const goToTitle = useGame((s) => s.goToTitle);
  const endingSceneId = useGame((s) => s.endingSceneId);
  const script = useGame((s) => s.script);

  const subtitle = useMemo(() => {
    if (endingSceneId === 'S06B') return '赛博·虚无之相';
    if (endingSceneId === 'S13B') return '民国·邮轮孤帆';
    const title = endingSceneId ? script.scenes.get(endingSceneId)?.title : undefined;
    return title ?? '';
  }, [endingSceneId, script]);

  const handleHome = () => {
    audio.stopBGM();
    audio.stopVoice();
    goToTitle();
  };

  return (
    <div className={styles.root}>
      <h1 className={styles.heading}>游戏结束</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      <p className={styles.hint}>由于你的选择，世界崩塌，游戏结束。你可以回到主界面重新选择。</p>
      <button type="button" className={styles.btn} onClick={handleHome}>
        回到主界面
      </button>
    </div>
  );
}
