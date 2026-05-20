import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { inferState, pickFirstExisting, resolveSprite, speakerToRole } from '@/engine/assetResolver';
import styles from './Character.module.css';

type Props = {
  speaker: string;
  action?: string;
  active?: boolean;
};

// Renders the active speaker's立绘 in the upper half of the screen.
// If no sprite asset is found we silently render nothing — the scene background
// (full-frame illustration / video) already carries the character, and a raw
// "他 / 她" placeholder over the art looked like a debug label.
export function Character({ speaker, action, active = true }: Props) {
  const role = speakerToRole(speaker);
  const state = inferState(action);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!role) {
      setResolved(null);
      return;
    }
    let cancelled = false;
    const candidates = resolveSprite(role, state);
    pickFirstExisting(candidates).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [role, state]);

  if (!role) return null;

  return (
    <AnimatePresence>
      {active && resolved && (
        <motion.div
          className={styles.root}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4 }}
        >
          <img src={resolved} alt={speaker} className={styles.sprite} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
