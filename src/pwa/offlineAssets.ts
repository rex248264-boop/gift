export type OfflineAsset = {
  url: string;
  size: number;
};

export type OfflineAssetManifest = {
  version: number;
  generatedAt: string;
  totalBytes: number;
  assets: OfflineAsset[];
};

const CACHE_NAME = 'xiangjianni-offline-v1';
const MANIFEST_URL = '/offline-assets.json';

export type DownloadProgress = {
  completed: number;
  total: number;
  downloadedBytes: number;
  totalBytes: number;
  currentUrl?: string;
};

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.warn('Service worker registration failed', error);
  }
}

export async function loadOfflineManifest(): Promise<OfflineAssetManifest> {
  const response = await fetch(`${MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('无法读取离线资源清单');
  }
  return response.json() as Promise<OfflineAssetManifest>;
}

export async function getOfflineStatus(manifest: OfflineAssetManifest) {
  if (!('caches' in window)) {
    return { cached: 0, total: manifest.assets.length, cachedBytes: 0, totalBytes: manifest.totalBytes };
  }

  const cache = await caches.open(CACHE_NAME);
  let cached = 0;
  let cachedBytes = 0;
  for (const asset of manifest.assets) {
    const match = await cache.match(asset.url);
    if (!match) continue;
    cached += 1;
    cachedBytes += asset.size;
  }
  return { cached, total: manifest.assets.length, cachedBytes, totalBytes: manifest.totalBytes };
}

export async function downloadOfflineAssets(
  manifest: OfflineAssetManifest,
  onProgress: (progress: DownloadProgress) => void,
) {
  if (!('caches' in window)) {
    throw new Error('当前浏览器不支持离线缓存');
  }

  const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
  if (!registration) {
    await registerServiceWorker();
  }

  const cache = await caches.open(CACHE_NAME);
  let completed = 0;
  let downloadedBytes = 0;

  for (const asset of manifest.assets) {
    const cached = await cache.match(asset.url);
    if (cached) {
      completed += 1;
      downloadedBytes += asset.size;
      onProgress({ completed, total: manifest.assets.length, downloadedBytes, totalBytes: manifest.totalBytes });
      continue;
    }

    onProgress({
      completed,
      total: manifest.assets.length,
      downloadedBytes,
      totalBytes: manifest.totalBytes,
      currentUrl: asset.url,
    });

    const response = await fetch(asset.url, { cache: 'reload' });
    if (!response.ok) {
      throw new Error(`下载失败：${asset.url}`);
    }
    await cache.put(asset.url, response);
    completed += 1;
    downloadedBytes += asset.size;
    onProgress({
      completed,
      total: manifest.assets.length,
      downloadedBytes,
      totalBytes: manifest.totalBytes,
      currentUrl: asset.url,
    });
  }
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
