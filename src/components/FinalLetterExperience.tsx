import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '@/engine';
import { audio } from '@/audio/audioManager';
import {
  FINAL_SLIDESHOW_DIR,
  pickFirstExisting,
  resolveFinalSlideshowImage,
} from '@/engine/assetResolver';
import { TopBar } from './TopBar';
import styles from './FinalLetterExperience.module.css';

const ENVELOPE_SOURCE = '/assets/ui/final-letter/envelope-source.png';
const MEMORY_ALBUM_SOURCE = '/assets/ui/final-letter/memory-album-source.png';
const FINAL_SCENE_ID = 'S15';
const FINAL_FRAME_ID = '15.1';
const SLIDESHOW_INTERVAL_MS = 3000;
const MAX_SLIDESHOW_IMAGES = 80;

const FINAL_LETTER_PAGES = [
  [
    '亲爱的棠：',
    '如果你看到这封信，说明我走到了最后。',
    '说明，我已不在你面前。',
  ],
  [
    '我曾经以为，所谓命运，是一条笔直的路。',
    '后来我才知道，它更像特克斯那样的城市。',
    '每一条街都通向你，每个出口也都在失去你，周而复始。',
  ],
  [
    '在你生日的那天，在你吹灭第一根蜡烛时，我见到了一个新世界。',
    '那座永远下着霓虹雨的赛博城市。',
    '我们从小就认识，我们长大，相恋，最后一起冲向月球。',
  ],
  [
    '可每一次，结局都停在最后一刻。',
    '我见过你倒在我怀里，见过你伸手去够舱门。',
    '见过你温柔的眼眸，渐渐失去色彩。',
  ],
  [
    '我会孤独地走向人生的终点。',
    '随后醒在现实，醒在认识你之前。',
    '直到有一回，我终于没有再犹豫。',
  ],
  [
    '我终于足够勇敢。',
    '为你挡下所有追兵，送你一个人去了月球。',
    '那一回，我没有重新回到原点。',
  ],
  [
    '可我却陷入了另一个死结。',
    '同样是你生日，在你吹灭第二根蜡烛时，我又去了一个如梦般的世界。',
  ],
  [
    '那里有战火，有雨巷，有旧报纸上晕开的墨迹。',
    '有一场来不及说出口的爱。',
    '可每次我到的时候，总是太晚太晚。',
  ],
  [
    '我早已做出选择。',
    '我失去了你。',
    '而不久后，你在病榻上闭上了眼睛。',
  ],
  [
    '我一次又一次活在懊悔中。',
    '也一次又一次醒在现实，醒在认识你之前。',
    '我开始祈求上帝，求我能回到那个世界更早的时间。',
  ],
  [
    '早一些，我就能坚定不移地，代替那个懦弱的我，选择你。',
    '上帝似乎听到了我的祷告，却也给我下了一个致命的枷锁。',
  ],
  [
    '回去得越早，在现实中醒来的就越晚。',
    '直到这一次，我越过了战火，穿过了雨巷。',
    '撕碎了那墨迹晕染的报纸。',
  ],
  [
    '我在你离开之前，挽回了你。',
    '代价，是现实里的我，只能隔着网络见你。',
    '我想见你，多想见你。',
    '想和你一起读书，一起旅游。',
    '一起笑，一起哭。',
    '一起拥抱、接吻。',
  ],
  [
    '可这是我，能够做出的最好选择了。',
    '没关系。',
    '那两个世界的我，有替我好好地陪伴你。',
  ],
  [
    '而我，也已拥有无数的回忆。',
    '生日快乐，亲爱的。',
    '每一个世界，我都如此爱你。',
  ],
];

export function FinalLetterExperience() {
  const goToTitle = useGame((s) => s.goToTitle);
  const markSceneCleared = useGame((s) => s.markSceneCleared);
  const audioUnlocked = useGame((s) => s.audioUnlocked);
  const unlockAudio = useGame((s) => s.unlockAudio);
  const assetNonce = useGame((s) => s.assetRefreshNonce);
  const [opened, setOpened] = useState(false);
  const [page, setPage] = useState(0);
  const [albumReady, setAlbumReady] = useState(false);
  const [slideshowStarted, setSlideshowStarted] = useState(false);
  const [slides, setSlides] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [envelopeSrc, setEnvelopeSrc] = useState(ENVELOPE_SOURCE);
  const [albumSrc, setAlbumSrc] = useState(MEMORY_ALBUM_SOURCE);
  const pageCount = FINAL_LETTER_PAGES.length;

  useEffect(() => {
    markSceneCleared(FINAL_SCENE_ID);
  }, [markSceneCleared]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      makeChromaTransparent(ENVELOPE_SOURCE),
      makeChromaTransparent(MEMORY_ALBUM_SOURCE),
    ]).then(([nextEnvelopeSrc, nextAlbumSrc]) => {
      if (cancelled) return;
      if (nextEnvelopeSrc) setEnvelopeSrc(nextEnvelopeSrc);
      if (nextAlbumSrc) setAlbumSrc(nextAlbumSrc);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!audioUnlocked) return;
    void audio.syncBGM({
      sceneId: FINAL_SCENE_ID,
      frameId: FINAL_FRAME_ID,
      sceneChanged: true,
      cacheBust: assetNonce || undefined,
    });
  }, [audioUnlocked, assetNonce]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      Array.from({ length: MAX_SLIDESHOW_IMAGES }, async (_, idx) => {
        const url = await pickFirstExisting(resolveFinalSlideshowImage(idx + 1));
        return url && assetNonce > 0 ? `${url}?v=${assetNonce}` : url;
      }),
    ).then((found) => {
      if (cancelled) return;
      setSlides(found.filter((url): url is string => Boolean(url)).reverse());
      setSlideIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [assetNonce]);

  useEffect(() => {
    if (!slideshowStarted || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setSlideIndex((idx) => {
        if (idx >= slides.length - 1) {
          window.clearInterval(timer);
          return idx;
        }
        return idx + 1;
      });
    }, SLIDESHOW_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, slideshowStarted]);

  const currentLines = useMemo(() => FINAL_LETTER_PAGES[page] ?? [], [page]);
  const unlockFinalAudio = () => {
    if (audioUnlocked) return;
    audio.unlock();
    unlockAudio();
  };

  return (
    <div className={styles.root}>
      <motion.div
        className={styles.darkness}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.4, ease: 'easeInOut' }}
      />
      <div className={styles.stars} />
      <TopBar contextLabel="尾章·告白" />

      <AnimatePresence mode="wait">
        {slideshowStarted ? (
          <motion.section
            key="slideshow"
            className={styles.slideshowScene}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          >
            {slides.length > 0 ? (
              <div className={styles.slideshowFrame}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={slides[slideIndex]}
                    className={styles.slideImage}
                    src={slides[slideIndex]}
                    alt=""
                    initial={{ opacity: 0, scale: 1.035 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.985 }}
                    transition={{ duration: 0.9, ease: 'easeInOut' }}
                    draggable={false}
                  />
                </AnimatePresence>
              </div>
            ) : (
              <div className={styles.emptySlideshow}>
                <span>把图片放到</span>
                <code>{FINAL_SLIDESHOW_DIR}/01.jpg</code>
                <span>开始播放</span>
              </div>
            )}
          </motion.section>
        ) : albumReady ? (
          <motion.section
            key="album"
            className={styles.albumScene}
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.94 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.img
              className={styles.memoryAlbum}
              src={albumSrc}
              alt="一本回忆相册"
              animate={{ y: [0, -14, 0], rotate: [0.8, -0.8, 0.8] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
              draggable={false}
            />
            <motion.button
              type="button"
              className={styles.albumButton}
              onClick={() => {
                unlockFinalAudio();
                setSlideshowStarted(true);
              }}
              whileTap={{ scale: 0.96 }}
            >
              查看他的回忆
            </motion.button>
          </motion.section>
        ) : !opened ? (
          <motion.section
            key="envelope"
            className={styles.envelopeScene}
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.9 }}
            transition={{ duration: 1.1, delay: 1.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.img
              className={styles.envelope}
              src={envelopeSrc}
              alt="一封漂亮的信封"
              animate={{ y: [0, -18, 0], rotate: [-1.2, 1.2, -1.2] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
              draggable={false}
            />
            <motion.button
              type="button"
              className={styles.openButton}
              onClick={() => {
                unlockFinalAudio();
                setOpened(true);
              }}
              whileTap={{ scale: 0.96 }}
            >
              打开信封
            </motion.button>
          </motion.section>
        ) : (
          <motion.section
            key="letter"
            className={styles.letterScene}
            initial={{ opacity: 0, scale: 0.82, rotateX: -36 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.letterGlow} />
            <article className={styles.letter}>
              <div className={styles.letterFold} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  className={styles.pageText}
                  initial={{ opacity: 0, x: 26 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -26 }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                >
                  {currentLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </motion.div>
              </AnimatePresence>
              <div className={styles.pageIndicator}>
                {page + 1} / {pageCount}
              </div>
              {page === pageCount - 1 && (
                <motion.div
                  className={styles.letterSignature}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.42, delay: 0.18, ease: 'easeOut' }}
                >
                  <span>一凯</span>
                  <span>2026.5.22</span>
                </motion.div>
              )}
            </article>

            <div className={styles.letterControls}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                上一页
              </button>
              {page < pageCount - 1 ? (
                <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
                  下一页
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    unlockFinalAudio();
                    setAlbumReady(true);
                  }}
                >
                  继续
                </button>
              )}
              <button type="button" onClick={() => goToTitle()}>
                收好
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

async function makeChromaTransparent(src: string): Promise<string | null> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode().catch(() => null);
  if (!image.naturalWidth || !image.naturalHeight) return null;

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isGreenScreen = g > 170 && r < 90 && b < 110 && g - Math.max(r, b) > 80;
    if (isGreenScreen) {
      data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
