import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '@/engine';
import styles from './BottomControls.module.css';

export function BottomControls() {
  const history = useGame((s) => s.history);
  const jumpTo = useGame((s) => s.jumpTo);
  const advance = useGame((s) => s.advance);
  const [autoMode, setAutoMode] = useState(false);

  const onReview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (history.length < 2) return;
    const prev = history[history.length - 2];
    jumpTo(prev.sceneId, prev.frameId);
  };

  const onSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    advance();
  };

  const onAuto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAutoMode((v) => !v);
  };

  return (
    <motion.div
      className={styles.root}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button className={styles.btn} onClick={onReview} aria-label="回顾">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        <span className={styles.label}>回顾</span>
      </button>
      <button className={styles.btn} onClick={onSkip} aria-label="跳过">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
        <span className={styles.label}>跳过</span>
      </button>
      <button
        className={`${styles.btn} ${autoMode ? styles.btnActive : ''}`}
        onClick={onAuto}
        aria-label="自动"
        aria-pressed={autoMode}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
        <span className={styles.label}>{autoMode ? '自动·开' : '自动'}</span>
      </button>
    </motion.div>
  );
}
