import { motion } from 'framer-motion';
import { useGame } from '@/engine';
import styles from './TopBar.module.css';

type Props = {
  contextLabel?: string;     // e.g. "通话中" or scene title
};

export function TopBar({ contextLabel }: Props) {
  const goToTitle = useGame((s) => s.goToTitle);
  return (
    <motion.div
      className={styles.root}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        className={styles.backBtn}
        onClick={(e) => {
          e.stopPropagation();
          goToTitle();
        }}
        aria-label="返回标题"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      {contextLabel && (
        <div className={styles.contextLabel}>
          <span className={styles.contextName}>{contextLabel}</span>
        </div>
      )}
    </motion.div>
  );
}
