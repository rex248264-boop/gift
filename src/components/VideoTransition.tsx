import { motion } from 'framer-motion';
import styles from './VideoTransition.module.css';

type Props = {
  src: string;
  onDone: () => void;
};

/**
 * Full-screen video that plays once, then calls onDone.
 * Parent is responsible for resolving and passing `src`.
 */
export function VideoTransition({ src, onDone }: Props) {
  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <video
        className={styles.video}
        src={src}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
      />
    </motion.div>
  );
}
