import { useEffect, useMemo, useState } from 'react';
import {
  downloadOfflineAssets,
  formatBytes,
  getOfflineStatus,
  loadOfflineManifest,
  type DownloadProgress,
  type OfflineAssetManifest,
} from '@/pwa/offlineAssets';
import styles from '@/pages/TitleScreen.module.css';

type DownloadState = 'loading' | 'ready' | 'downloading' | 'done' | 'error' | 'unsupported';

export function OfflineDownload() {
  const [state, setState] = useState<DownloadState>('loading');
  const [manifest, setManifest] = useState<OfflineAssetManifest | null>(null);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!('serviceWorker' in navigator) || !('caches' in window)) {
        setState('unsupported');
        return;
      }

      try {
        const nextManifest = await loadOfflineManifest();
        const status = await getOfflineStatus(nextManifest);
        if (cancelled) return;

        setManifest(nextManifest);
        setProgress({
          completed: status.cached,
          total: status.total,
          downloadedBytes: status.cachedBytes,
          totalBytes: status.totalBytes,
        });
        setState(status.cached === status.total && status.total > 0 ? 'done' : 'ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const percent = useMemo(() => {
    if (!progress || progress.totalBytes <= 0) return 0;
    return Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100));
  }, [progress]);

  const handleDownload = async () => {
    if (!manifest || state === 'downloading') return;
    setError('');
    setState('downloading');
    try {
      await downloadOfflineAssets(manifest, setProgress);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  };

  if (state === 'unsupported') {
    return <div className={styles.offlineHint}>当前浏览器不支持离线下载</div>;
  }

  const totalText = progress ? formatBytes(progress.totalBytes) : '...';
  const doneText = progress ? `${progress.completed}/${progress.total}` : '--';
  const buttonText =
    state === 'loading'
      ? '读取资源中'
      : state === 'downloading'
        ? `下载中 ${percent}%`
        : state === 'done'
          ? '离线资源已下载'
          : state === 'error'
            ? '重试下载'
            : '下载离线资源';

  return (
    <div className={styles.offlinePanel}>
      <button
        type="button"
        className={styles.offlineButton}
        onClick={handleDownload}
        disabled={state === 'loading' || state === 'downloading' || state === 'done'}
      >
        {buttonText}
      </button>
      <div className={styles.offlineTrack} aria-hidden="true">
        <div className={styles.offlineFill} style={{ width: `${percent}%` }} />
      </div>
      <div className={styles.offlineMeta}>
        <span>{doneText}</span>
        <span>{totalText}</span>
      </div>
      {state === 'error' && <div className={styles.offlineError}>{error}</div>}
      {state === 'done' && <div className={styles.offlineDone}>已可在离线时打开</div>}
    </div>
  );
}
