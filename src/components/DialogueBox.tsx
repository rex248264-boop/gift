import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DialogueLine } from '@/parser';
import type { MouseEvent, KeyboardEvent } from 'react';
import styles from './DialogueBox.module.css';
import { audio } from '@/audio/audioManager';
import { resolveCharacter } from '@/config/characters';
import { useGame, useTextOffsetStyle } from '@/engine';

type Props = {
  line: DialogueLine;
  sceneId: string;
  frameId: string;
  maleLineNumber: number;
  suppressVoice?: boolean;
  onComplete?: () => void;
};

const CHARS_PER_SECOND = 36;

export function DialogueBox({ line, sceneId, frameId, maleLineNumber, suppressVoice = false, onComplete }: Props) {
  const assetNonce = useGame((s) => s.assetRefreshNonce);
  const text = line.text;
  const [shown, setShown] = useState('');
  const isHe = line.speaker === '他' || line.speaker === '陌生访客' || line.speaker === '男主';
  const isNarrator = line.speaker === '旁白';
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = false;
    setShown('');
    if (!text) {
      completedRef.current = true;
      onComplete?.();
      return;
    }
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(interval);
        completedRef.current = true;
        onComplete?.();
      }
    }, 1000 / CHARS_PER_SECOND);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (!isHe || suppressVoice) return;
    audio.playVoice(
      sceneId,
      frameId,
      maleLineNumber,
      line.hints.voice,
      assetNonce || undefined,
      line.voiceKey,
    );
    return () => audio.stopVoice();
  }, [isHe, suppressVoice, sceneId, frameId, maleLineNumber, line.hints.voice, line.voiceKey, assetNonce]);

  const skipReveal = () => {
    if (!completedRef.current && text.length > 0) {
      audio.stopVoice();
      setShown(text);
      completedRef.current = true;
      onComplete?.();
    }
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!completedRef.current && text.length > 0) {
      e.stopPropagation();
      skipReveal();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !completedRef.current && text.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      skipReveal();
    }
  };

  const character = useMemo(() => resolveCharacter(line.speaker), [line.speaker]);
  const nameOffset = useTextOffsetStyle('dialogue-name');
  const textOffset = useTextOffsetStyle('dialogue-text');
  const actionOffset = useTextOffsetStyle('dialogue-action');

  return (
    <motion.div
      className={`${styles.root} ${isNarrator ? styles.narrator : ''}`}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {!isNarrator && (
        <div className={styles.namePlate}>
          <div className={styles.nameStack} style={nameOffset}>
            <span className={styles.name}>{character.display || line.speaker}</span>
            {character.alias && <span className={styles.alias}>{character.alias}</span>}
          </div>
        </div>
      )}
      <div className={styles.bodyZone}>
        {line.action && !isNarrator && (
          <span className={styles.action} style={actionOffset}>（{line.action}）</span>
        )}
        <p className={styles.text} style={textOffset}>
          {shown}
          {shown.length < text.length && <span className={styles.caret}>▌</span>}
        </p>
      </div>
    </motion.div>
  );
}
