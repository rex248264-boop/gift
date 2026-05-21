import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChoiceBlock, ChoiceOption } from '@/parser';
import { chooseOption, useCurrentTheme, useTextOffsetStyle } from '@/engine';
import styles from './ChoiceMenu.module.css';

type Props = {
  choice: ChoiceBlock;
};

const DEFAULT_CONFIRM_LABEL = '确认';

function keyOf(opt: ChoiceOption, i: number): string {
  return opt.letter ?? `idx-${i}`;
}

export function ChoiceMenu({ choice }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const theme = useCurrentTheme();

  const customConfirm = choice.hints['choice-confirm-label'];
  const longPrompt =
    choice.prompt && choice.prompt.length > 24 ? choice.prompt : undefined;

  const confirmLabel = customConfirm ?? DEFAULT_CONFIRM_LABEL;
  const isWishDoneConfirm = confirmLabel === '许完了';

  const optionOffset = useTextOffsetStyle('choice-option');
  const confirmOffset = useTextOffsetStyle('choice-confirm');
  const subPromptOffset = useTextOffsetStyle('choice-subprompt');

  const stopEvent = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSelect = (opt: ChoiceOption, i: number) => {
    if (committing) return;
    const k = keyOf(opt, i);
    setSelectedKey((prev) => (prev === k ? null : k));
  };

  const handleConfirm = () => {
    if (committing || !selectedKey) return;
    const idx = choice.options.findIndex((o, i) => keyOf(o, i) === selectedKey);
    if (idx < 0) return;
    setCommitting(true);
    // 给一个短暂的"确认按下"反馈时间，再真正推进
    window.setTimeout(() => {
      chooseOption(choice.options[idx]);
    }, 180);
  };

  return (
    <div
      className={`${styles.overlay} ${styles[theme]}`}
      data-choice-theme={theme}
      onClick={stopEvent}
      onPointerDown={stopEvent}
      onPointerUp={stopEvent}
    >
      {longPrompt && (
        <motion.div
          className={styles.subPrompt}
          style={subPromptOffset}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {longPrompt}
        </motion.div>
      )}

      <div className={styles.options}>
        <AnimatePresence>
          {choice.options.map((opt, i) => {
            const k = keyOf(opt, i);
            const isSelected = selectedKey === k;
            const isDim = selectedKey !== null && !isSelected;
            return (
              <motion.button
                key={k}
                type="button"
                className={`${styles.option} ${isSelected ? styles.selected : ''} ${
                  isDim ? styles.dim : ''
                }`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.28 + i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                onClick={(e) => {
                  stopEvent(e);
                  handleSelect(opt, i);
                }}
                onPointerDown={stopEvent}
                onPointerUp={stopEvent}
                aria-pressed={isSelected}
              >
                <span className={styles.optionLabel} style={optionOffset}>{opt.label}</span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <div className={styles.confirmRow}>
        <AnimatePresence>
          {selectedKey && (
            <motion.button
              key="confirm"
              type="button"
              className={`${styles.confirm} ${isWishDoneConfirm ? styles.wishDoneConfirm : ''}`}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: committing ? 0.94 : 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => {
                stopEvent(e);
                handleConfirm();
              }}
              onPointerDown={stopEvent}
              onPointerUp={stopEvent}
              disabled={committing}
            >
              <span className={styles.confirmLabel} style={confirmOffset}>{confirmLabel}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
