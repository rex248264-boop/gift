import { useGame } from '@/engine';
import { currentFrame } from '@/engine';
import { FrameView } from '@/components/FrameView';
import { FinalLetterExperience } from '@/components/FinalLetterExperience';
import styles from './GameScreen.module.css';

export function GameScreen() {
  const goToTitle = useGame((s) => s.goToTitle);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const currentFrameId = useGame((s) => s.currentFrameId);
  const scriptVersion = useGame((s) => s.scriptVersion);
  void scriptVersion; // touched so HMR re-renders

  if (!currentSceneId || !currentFrameId) {
    return (
      <div className={styles.empty}>
        <p>未启动场次。</p>
        <button type="button" className={styles.emptyBtn} onClick={() => goToTitle()}>
          回到主界面
        </button>
      </div>
    );
  }

  if (currentSceneId === 'S15') {
    return <FinalLetterExperience />;
  }

  const frame = currentFrame();
  if (!frame) {
    return (
      <div className={styles.empty}>
        <p>找不到画面：{currentSceneId} / {currentFrameId}</p>
        <button type="button" className={styles.emptyBtn} onClick={() => goToTitle()}>
          回到主界面
        </button>
      </div>
    );
  }

  return <FrameView sceneId={currentSceneId} frame={frame} />;
}
