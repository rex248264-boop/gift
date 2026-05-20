import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Transition.module.css';

type Props = {
  visible: boolean;
  text?: string;
  duration?: number;
  onDone?: () => void;
};

export function Transition({ visible, text, duration = 1400, onDone }: Props) {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShowText(false);
      return;
    }
    const t1 = window.setTimeout(() => setShowText(true), 200);
    const t2 = window.setTimeout(() => {
      onDone?.();
    }, duration);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [visible, duration, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.veil}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {showText && text && (
            <motion.div
              className={styles.text}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {text}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
