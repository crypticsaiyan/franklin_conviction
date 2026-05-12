import { motion, AnimatePresence } from 'framer-motion';
import type { AgentName, AgentState, RoutingTier } from '../types';
import styles from './AgentBento.module.css';

const TIER_COLORS: Record<RoutingTier, string> = {
  SIMPLE:    '--neon-cyan',
  MEDIUM:    '--neon-amber',
  COMPLEX:   '--neon-violet',
  REASONING: '--neon-red',
};

function RoutingBadge({ tier, savings }: { tier?: RoutingTier; savings?: number }) {
  if (!tier) return null;
  const colorVar = `var(${TIER_COLORS[tier] ?? '--text-muted'})`;
  return (
    <motion.div
      className={styles.routingBadge}
      style={{ '--badge-c': colorVar } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className={styles.tierLabel}>{tier}</span>
      {savings !== undefined && savings > 0 && (
        <span className={styles.savingsChip}>
          {savings >= 1 ? 'FREE' : `-${Math.round(savings * 100)}%`}
        </span>
      )}
    </motion.div>
  );
}

interface TileSpec {
  name: AgentName;
  label: string;
  short: string;
  size: 'lg' | 'md' | 'sm' | 'wide';
  baseColor: string;
  glyph: string;
}

const TILES: TileSpec[] = [
  { name: 'bull',      label: 'BULL AGENT',      short: 'BUL', size: 'lg',   baseColor: 'var(--color-bull)',      glyph: '▲' },
  { name: 'bear',      label: 'BEAR AGENT',      short: 'BER', size: 'lg',   baseColor: 'var(--color-bear)',      glyph: '▼' },
  { name: 'macro',     label: 'MACRO',           short: 'MAC', size: 'md',   baseColor: 'var(--color-macro)',     glyph: '◐' },
  { name: 'narrative', label: 'NARRATIVE',       short: 'NAR', size: 'md',   baseColor: 'var(--color-narrative)', glyph: '◑' },
  { name: 'moderator', label: 'ARBITRATOR',      short: 'ARB', size: 'wide', baseColor: 'var(--color-arbiter)',   glyph: '⊳' },
  { name: 'synthesis', label: 'SYNTHESIS',       short: 'SYN', size: 'sm',   baseColor: 'var(--color-synth)',     glyph: '◆' },
  { name: 'risk',      label: 'RISK OFFICER',    short: 'RSK', size: 'sm',   baseColor: 'var(--color-risk)',      glyph: '▣' },
];

function scoreColor(score: number | undefined, fallback: string): string {
  if (score === undefined) return fallback;
  if (score >= 75) return 'var(--neon-green)';
  if (score >= 60) return 'var(--neon-cyan)';
  if (score >= 40) return 'var(--neon-amber)';
  if (score >= 25) return 'var(--neon-red)';
  return 'var(--neon-red)';
}

export function AgentBento({ agents }: { agents: Record<AgentName, AgentState> }) {
  const completed = Object.values(agents).filter(a => a.status === 'complete').length;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.headerLabel}>// AGENT_PIPELINE :: BENTO</span>
        <span className={styles.headerMeta}>
          <span className={styles.headerCount}>{completed}</span>
          <span className={styles.headerSlash}>/</span>
          <span>7 NODES</span>
        </span>
      </header>

      <div className={styles.bento}>
        {TILES.map((t, i) => (
          <BentoTile key={t.name} spec={t} state={agents[t.name]} index={i} />
        ))}
      </div>
    </div>
  );
}

function BentoTile({ spec, state, index }: { spec: TileSpec; state: AgentState; index: number }) {
  const status = state?.status ?? 'idle';
  const score = state?.result?.score;
  const tintColor = scoreColor(score, spec.baseColor);
  const running  = status === 'running';
  const done     = status === 'complete';
  const error    = status === 'error';

  return (
    <motion.article
      className={`${styles.tile} ${styles[`size_${spec.size}`]}`}
      data-status={status}
      style={{
        '--base-color': spec.baseColor,
        '--tint-color': tintColor,
      } as React.CSSProperties}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.06,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* shimmer layer */}
      <span className={styles.shimmer} aria-hidden />
      {/* scanline layer */}
      <span className={styles.scanline} aria-hidden />
      {/* glow halo when running/done */}
      <span className={styles.halo} aria-hidden />

      {/* corner brackets */}
      <span className={styles.cornerTL} />
      <span className={styles.cornerTR} />
      <span className={styles.cornerBL} />
      <span className={styles.cornerBR} />

      <header className={styles.tileHeader}>
        <span className={styles.tileShort}>[{spec.short}]</span>
        <StatusBadge status={status} color={tintColor} />
      </header>

      <div className={styles.tileBody}>
        <span className={styles.tileGlyph} aria-hidden>{spec.glyph}</span>
        <h3 className={styles.tileLabel}>{spec.label}</h3>
        {state?.result?.model && (
          <span className={styles.tileModel}>{state.result.model.split('/').pop()}</span>
        )}
        <RoutingBadge tier={state?.result?.routingTier} savings={state?.result?.routingSavings} />
      </div>

      <footer className={styles.tileFooter}>
        <AnimatePresence mode="wait">
          {done && score !== undefined ? (
            <motion.div
              key="score"
              className={styles.tileScore}
              initial={{ opacity: 0, y: 8, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.1,
              }}
            >
              <motion.span
                className={styles.tileScoreValue}
                initial={{ filter: 'blur(8px)' }}
                animate={{ filter: 'blur(0px)' }}
                transition={{ duration: 0.4 }}
              >{score}</motion.span>
              <span className={styles.tileScoreUnit}>/100</span>
            </motion.div>
          ) : running ? (
            <motion.div
              key="running"
              className={styles.tileLoader}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className={styles.loaderBar} />
              <span className={styles.loaderText}>PROCESSING</span>
            </motion.div>
          ) : done ? (
            <motion.div
              key="done"
              className={styles.tileDone}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className={styles.doneCheck}>✓</span>
              <span className={styles.doneLabel}>COMPLETE</span>
              {state?.result && (
                <span className={styles.doneMeta}>
                  {(state.result.latencyMs / 1000).toFixed(1)}s
                </span>
              )}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              className={styles.tileError}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span>✗ ERROR</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className={styles.tileIdle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span>— STANDBY</span>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>
    </motion.article>
  );
}

function StatusBadge({ status, color }: { status: AgentState['status']; color: string }) {
  const label = status === 'running' ? 'LIVE'
              : status === 'complete' ? 'DONE'
              : status === 'error'    ? 'ERR'
              : 'IDLE';
  return (
    <motion.span
      className={styles.statusBadge}
      data-status={status}
      style={{ '--badge-color': color } as React.CSSProperties}
      initial={false}
      animate={{
        boxShadow: status === 'running' || status === 'complete'
          ? [
              `0 0 0 1px ${color}, 0 0 6px ${color}`,
              `0 0 0 1px ${color}, 0 0 16px ${color}`,
              `0 0 0 1px ${color}, 0 0 6px ${color}`,
            ]
          : 'inset 0 0 0 1px var(--border-grid)',
      }}
      transition={{ duration: 1.4, repeat: status === 'running' ? Infinity : 0 }}
    >
      <span className={styles.statusBadgeDot} />
      {label}
    </motion.span>
  );
}
