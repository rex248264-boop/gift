import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { resolveEffect, pickFirstExisting } from '@/engine/assetResolver';
import styles from './MicroEffect.module.css';

// MicroEffect now renders ONLY a resolved overlay media (video / GIF) when an
// explicit `effect:` hint is provided. The textual scene-description and
// micro-effect lines from the script are authoring metadata for image
// generation; we never surface them to the player.
type Props = {
  hint?: string;
  position?: 'center' | 'center-top' | 'center-bottom' | 'left' | 'right' | 'full';
};

export function MicroEffect({ hint, position = 'center' }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const candidates = resolveEffect(hint);
    if (candidates.length === 0) {
      setResolved(null);
      return;
    }
    pickFirstExisting(candidates).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [hint]);

  if (!resolved) return null;

  return (
    <motion.div
      className={`${styles.root} ${styles[`pos_${position}`]}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      aria-hidden
    >
      {resolved.endsWith('.gif') ? (
        <img src={resolved} alt="" className={styles.media} />
      ) : (
        <video src={resolved} className={styles.media} autoPlay loop muted playsInline />
      )}
    </motion.div>
  );
}
