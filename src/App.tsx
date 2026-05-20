import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame, getSceneTheme } from '@/engine';
import { TitleScreen } from '@/pages/TitleScreen';
import { GameScreen } from '@/pages/GameScreen';
import { EndingScreen } from '@/pages/EndingScreen';
import { GameOverScreen } from '@/pages/GameOverScreen';
import { DevPanel } from '@/pages/DevPanel';

const stageStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100vw, calc(100vh * 1206 / 2442))',
  height: 'min(100vh, calc(100vw * 2442 / 1206))',
  overflow: 'hidden',
  background: '#000',
};

export default function App() {
  const phase = useGame((s) => s.phase);
  const currentSceneId = useGame((s) => s.currentSceneId);
  const script = useGame((s) => s.script);
  const fontScale = useGame((s) => s.fontScale);
  const [sceneEnterFadeVisible, setSceneEnterFadeVisible] = useState(false);

  const sceneTitle =
    phase === 'playing' && currentSceneId
      ? script.scenes.get(currentSceneId)?.title
      : undefined;
  const theme = getSceneTheme(sceneTitle);

  useEffect(() => {
    if (phase !== 'playing' || !currentSceneId) return;
    setSceneEnterFadeVisible(true);
    const timer = window.setTimeout(() => setSceneEnterFadeVisible(false), 1200);
    return () => window.clearTimeout(timer);
  }, [phase, currentSceneId]);

  return (
    <div className="stage" style={stageStyle} data-theme={theme} data-font-scale={fontScale}>
      {phase === 'title' && <TitleScreen />}
      {phase === 'playing' && <GameScreen />}
      {phase === 'gameover' && <GameOverScreen />}
      {phase === 'ending' && <EndingScreen />}
      <AnimatePresence>
        {sceneEnterFadeVisible && (
          <motion.div
            key={`scene-enter-${currentSceneId}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              width: '100dvw',
              height: '100dvh',
              zIndex: 90,
              background: '#000',
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>
      <DevPanel />
    </div>
  );
}
