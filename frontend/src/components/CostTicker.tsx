import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useEffect, useRef } from 'react';
import styles from './CostTicker.module.css';

interface Props {
  totalCost: number;
  totalGpt4Cost: number;
  totalSavings: number;
  totalRoutingSavings?: number;
  freeMode?: boolean;
}

function fmtUsd(v: number): string {
  if (v >= 1)    return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  if (v >= 0.0001) return `$${v.toFixed(5)}`;
  return v === 0 ? '$0.00' : `$${v.toFixed(6)}`;
}

export function CostTicker({ totalCost, totalGpt4Cost, totalSavings, totalRoutingSavings, freeMode }: Props) {
  const pct = totalGpt4Cost > 0
    ? Math.min(100, Math.round((totalSavings / totalGpt4Cost) * 100))
    : 0;
  const controls = useAnimationControls();
  const prevPct = useRef(pct);
  const prevCost = useRef(totalCost);

  useEffect(() => {
    if (pct !== prevPct.current || totalCost !== prevCost.current) {
      controls.start({
        boxShadow: [
          '0 0 8px rgba(0,255,133,0.4), inset 0 0 0 1px var(--neon-green)',
          '0 0 24px rgba(0,255,133,0.95), 0 0 48px rgba(0,255,133,0.5), inset 0 0 0 1px var(--neon-green)',
          '0 0 8px rgba(0,255,133,0.4), inset 0 0 0 1px var(--neon-green)',
        ],
        transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
      });
      prevPct.current = pct;
      prevCost.current = totalCost;
    }
  }, [pct, totalCost, controls]);

  return (
    <motion.div
      className={styles.ticker}
      animate={controls}
      initial={{ boxShadow: '0 0 8px rgba(0,255,133,0.4), inset 0 0 0 1px var(--neon-green)' }}
    >
      <div className={styles.left}>
        <span className={styles.label}>{freeMode ? '// ECO_MODE' : '// COST_DELTA'}</span>
        <div className={styles.savingsRow}>
          <AnimatePresence mode="popLayout">
            <motion.span
              key={pct}
              className={styles.pct}
              initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
              exit={{    opacity: 0, y: -14, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {`${pct}%`}
            </motion.span>
          </AnimatePresence>
          <span className={styles.savingsLabel}>{freeMode ? 'SAVINGS vs GPT-4' : 'SAVINGS vs GPT-4'}</span>
          {totalRoutingSavings !== undefined && (
            <span className={styles.routingLabel}>
              VIA SMART ROUTING · avg {Math.round(totalRoutingSavings * 100)}% / agent
            </span>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.right}>
        <div className={styles.line}>
          <span className={styles.lineLabel}>ACTUAL</span>
          <span className={styles.lineValue}>{fmtUsd(totalCost)}</span>
        </div>
        <div className={styles.line}>
          <span className={styles.lineLabel}>GPT-4 EQV</span>
          <span className={styles.lineValueDim}>{fmtUsd(totalGpt4Cost)}</span>
        </div>
        <div className={styles.line}>
          <span className={styles.lineLabel}>SAVED</span>
          <span className={styles.lineValueGreen}>{fmtUsd(totalSavings)}</span>
        </div>
      </div>

      <span className={styles.cornerTL} />
      <span className={styles.cornerTR} />
      <span className={styles.cornerBL} />
      <span className={styles.cornerBR} />
    </motion.div>
  );
}
