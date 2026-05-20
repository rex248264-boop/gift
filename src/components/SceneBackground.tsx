import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveBackground, pickFirstExisting } from '@/engine/assetResolver';
import { useGame } from '@/engine';
import styles from './SceneBackground.module.css';

/**
 * 全屏背景覆盖层。两种模式：
 * - 'color': 一层纯色（用于 scene-switch 默认的黑/白闪烁回落方案）。
 * - 'image': 全屏背景图（用于上传的 scene-switch 素材；与帧背景分层叠在最上层）。
 */
export type BgOverride =
  | { kind: 'color'; value: string }
  | { kind: 'image'; url: string };

type Props = {
  sceneId: string;
  frameId: string;
  hint?: string;
  fallbackText?: string;
  bgOverride?: BgOverride | null;
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(url);
}

export function SceneBackground({ sceneId, frameId, hint, fallbackText, bgOverride }: Props) {
  const [resolved, setResolved] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const assetNonce = useGame((s) => s.assetRefreshNonce);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setTried(false);
    const candidates = resolveBackground(sceneId, frameId, hint);
    pickFirstExisting(candidates).then((url) => {
      if (cancelled) return;
      // Append nonce as cache-buster so the browser re-fetches after upload.
      setResolved(url && assetNonce > 0 ? `${url}?v=${assetNonce}` : url);
      setTried(true);
    });
    return () => {
      cancelled = true;
    };
  }, [sceneId, frameId, hint, assetNonce]);

  const isVideo = resolved ? isVideoUrl(resolved) : false;

  return (
    <div className={styles.root} aria-hidden>
      <AnimatePresence mode="sync">
        {resolved && !isVideo && (
          <motion.div
            key={resolved}
            className={styles.image}
            style={{ backgroundImage: `url(${resolved})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
        {resolved && isVideo && (
          <motion.video
            key={resolved}
            className={styles.video}
            src={resolved}
            autoPlay
            loop
            muted
            playsInline
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      {tried && !resolved && bgOverride == null && (
        <div className={styles.placeholder}>
          <div className={styles.placeholderInner}>
            <div className={styles.placeholderTag}>[场景占位]</div>
            <div className={styles.placeholderText}>{fallbackText || `${sceneId} · Frame ${frameId}`}</div>
            <div className={styles.placeholderHint}>
              放置 <code>public/assets/bg/{sceneId}-{frameId}.jpg</code> 或 <code>.mp4</code> 即可替换
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {bgOverride && bgOverride.kind === 'color' && (
          <motion.div
            key={`bg-override-color-${bgOverride.value}`}
            className={styles.bgOverride}
            style={{ backgroundColor: bgOverride.value }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
        {bgOverride && bgOverride.kind === 'image' && (
          <motion.div
            key={`bg-override-image-${bgOverride.url}`}
            className={`${styles.bgOverride} ${styles.bgOverrideImage}`}
            style={{ backgroundImage: `url(${bgOverride.url})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
