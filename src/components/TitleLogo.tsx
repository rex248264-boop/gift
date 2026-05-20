import { useEffect, useState } from 'react';
import { resolveTitleLogo, pickFirstExisting } from '@/engine/assetResolver';
import styles from '@/pages/TitleScreen.module.css';

/** 将中性浅色/棋盘格背景抠为透明（保留金色文字的低饱和差异）。 */
function shouldKeyPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  if (spread > 22) return false;
  if (min >= 175 && max >= 190) return true;
  if (max >= 245) return true;
  return false;
}

function processLogo(img: HTMLImageElement): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (shouldKeyPixel(d[i], d[i + 1], d[i + 2])) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

type Props = {
  assetNonce?: number;
};

export function TitleLogo({ assetNonce = 0 }: Props) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setDisplaySrc(null);

    (async () => {
      const candidates = resolveTitleLogo();
      const url = await pickFirstExisting(candidates);
      if (cancelled) return;
      if (!url) {
        setFailed(true);
        return;
      }
      const src = assetNonce > 0 ? `${url}?v=${assetNonce}` : url;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (cancelled) return;
        const dataUrl = processLogo(img);
        if (!dataUrl) {
          setFailed(true);
          return;
        }
        setDisplaySrc(dataUrl);
      };
      img.onerror = () => {
        if (!cancelled) setFailed(true);
      };
      img.src = src;
    })();

    return () => {
      cancelled = true;
    };
  }, [assetNonce]);

  if (failed) {
    return (
      <h1 className={styles.title} aria-label="想见你">
        想见你
      </h1>
    );
  }

  if (!displaySrc) {
    return <div className={styles.titleLogoPlaceholder} aria-hidden />;
  }

  return (
    <img
      src={displaySrc}
      alt="想见你"
      className={styles.titleLogo}
      draggable={false}
    />
  );
}
