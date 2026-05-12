import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ActivityLog.module.css';

/**
 * Typewriter — animates text char-by-char on mount.
 * Pure CSS-driven (animation-delay per span); no per-frame React updates.
 */
function Typewriter({ text, charDelay = 0.025, baseDelay = 0 }: {
  text: string;
  charDelay?: number;
  baseDelay?: number;
}) {
  return (
    <span className={styles.typewriter} aria-label={text}>
      {text.split('').map((ch, i) => (
        <span
          key={i}
          className={styles.tChar}
          style={{ animationDelay: `${baseDelay + i * charDelay}s` }}
        >{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  );
}

export type LogType =
  | 'init' | 'spawn' | 'done' | 'detect' | 'escalate'
  | 'synth' | 'risk' | 'final' | 'error' | 'info';

export interface LogEvent {
  id: number;
  time: string;
  type: LogType;
  verb: string;
  payload: string;
}

const GLYPH: Record<LogType, string> = {
  init:     '▸',
  spawn:    '▸',
  done:     '✓',
  detect:   '⚠',
  escalate: '▴',
  synth:    '◆',
  risk:     '▣',
  final:    '■',
  error:    '✗',
  info:     '·',
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'ALL' },
  { key: 'spawn', label: 'SPAWN' },
  { key: 'done', label: 'DONE' },
  { key: 'escalate', label: 'ESCALATE' },
  { key: 'error', label: 'ERROR' },
];

export function ActivityLog({ events }: { events: LogEvent[] }) {
  const [filter, setFilter] = useState('ALL');
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filter === 'ALL' ? events : events.filter(e => e.type === filter),
    [events, filter],
  );

  useEffect(() => {
    if (paused) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length, paused]);

  return (
    <div className={styles.log}>
      <div className={styles.header}>
        <span className={styles.title}>// ACTIVITY_LOG</span>
        <div className={styles.headerRight}>
          <span className={styles.eventCount}>{events.length} events</span>
          <span className={styles.liveIndicator} data-paused={paused}>
            <span className={styles.liveDot} />
            {paused ? 'PAUSED' : 'LIVE'}
          </span>
          <button
            className={styles.pauseBtn}
            onClick={() => setPaused(p => !p)}
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? '▶' : '⏸'}
          </button>
        </div>
      </div>

      <div className={styles.chips}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={styles.chip}
            data-active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            [{f.label}]
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className={styles.scroll}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence initial={false}>
          {filtered.map(e => (
            <motion.div
              key={e.id}
              className={styles.row}
              data-type={e.type}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <span className={styles.time}>
                <Typewriter text={e.time} charDelay={0.018} />
              </span>
              <span className={styles.glyph}>{GLYPH[e.type]}</span>
              <span className={styles.verb}>
                <Typewriter text={e.verb} charDelay={0.02} baseDelay={0.22} />
              </span>
              <span className={styles.payload}>
                <Typewriter text={e.payload} charDelay={0.008} baseDelay={0.4} />
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.cursor}>█</span> awaiting events...
          </div>
        )}
        <div className={styles.cursor}>█</div>
      </div>
    </div>
  );
}
