import { motion, AnimatePresence } from 'framer-motion';
import styles from './NarrationBox.module.css';
import { useTextOffsetStyle } from '@/engine';

type Props = {
  lines: string[];
  pageStart: number;   // 当前页起始行索引
  pageSize: number;    // 每页最多显示行数
};

export function NarrationBox({ lines, pageStart, pageSize }: Props) {
  const narrationOffset = useTextOffsetStyle('narration');

  if (lines.length === 0) return null;

  // 取当前页的行，整页一次性替换，不累积
  const visible = lines.slice(pageStart, pageStart + pageSize);
  const isLong = visible.some((l) => l.length > 36);

  return (
    // key={pageStart} 让整页换出时触发重新挂载动画，不产生"往上推"的效果
    <AnimatePresence mode="wait">
      <motion.div
        key={pageStart}
        className={`${styles.root} ${isLong ? styles.long : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        aria-live="polite"
      >
        <div className={styles.inner} style={narrationOffset}>
          {visible.map((line, i) => (
            <motion.p
              key={i}
              className={styles.line}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {line}
            </motion.p>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
