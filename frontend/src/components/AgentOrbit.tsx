import { motion, AnimatePresence } from 'framer-motion';
import type { AgentName, AgentState } from '../types';
import styles from './AgentOrbit.module.css';

interface Satellite {
  name: AgentName;
  label: string;
  short: string;
  angle: number; // degrees, 0 = right
  color: string;
}

const SATELLITES: Satellite[] = [
  { name: 'bull',      label: 'Bull',      short: 'BUL', angle: 270, color: 'var(--color-bull)' },
  { name: 'bear',      label: 'Bear',      short: 'BER', angle: 0,   color: 'var(--color-bear)' },
  { name: 'macro',     label: 'Macro',     short: 'MAC', angle: 90,  color: 'var(--color-macro)' },
  { name: 'narrative', label: 'Narrative', short: 'NAR', angle: 180, color: 'var(--color-narrative)' },
];

const SIZE = 560;
const CENTER = SIZE / 2;
const ORBIT_R = 200;
const SAT_R = 52;
const HUB_R = 72;

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CENTER + Math.cos(rad) * r, y: CENTER + Math.sin(rad) * r };
}

export function AgentOrbit({
  agents,
  synthesisActive,
  synthesisComplete,
}: {
  agents: Record<AgentName, AgentState>;
  synthesisActive: boolean;
  synthesisComplete: boolean;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>// AGENT_ORBIT</span>
        <span className={styles.headerMeta}>
          {Object.values(agents).filter(a => a.status === 'complete').length} / 7 NODES
        </span>
      </div>

      <svg className={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <defs>
          <radialGradient id="hubGrad" cx="50%" cy="50%">
            <stop offset="0%"  stopColor="rgba(155,92,255,0.4)" />
            <stop offset="60%" stopColor="rgba(155,92,255,0.08)" />
            <stop offset="100%" stopColor="rgba(155,92,255,0)" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="ticks" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.5" fill="rgba(255,255,255,0.08)" />
          </pattern>
        </defs>

        {/* orbit halo background */}
        <circle cx={CENTER} cy={CENTER} r={ORBIT_R + 80} fill="url(#hubGrad)" />

        {/* orbit ring */}
        <circle
          cx={CENTER} cy={CENTER} r={ORBIT_R}
          fill="none" stroke="var(--border-grid)" strokeWidth="1"
          strokeDasharray="2 4"
        />
        {/* secondary ring */}
        <circle
          cx={CENTER} cy={CENTER} r={ORBIT_R - 40}
          fill="none" stroke="var(--border-grid)" strokeWidth="0.5"
        />

        {/* tick marks on orbit */}
        {Array.from({ length: 36 }).map((_, i) => {
          const a = i * 10;
          const p1 = polar(a, ORBIT_R - 4);
          const p2 = polar(a, ORBIT_R + (i % 3 === 0 ? 8 : 4));
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="var(--border-bright)" strokeWidth={i % 3 === 0 ? 1.5 : 0.5} />
          );
        })}

        {/* connection lines hub → satellite */}
        {SATELLITES.map(s => {
          const p = polar(s.angle, ORBIT_R);
          const status = agents[s.name]?.status ?? 'idle';
          const active = status === 'running';
          const done = status === 'complete';
          return (
            <g key={`line-${s.name}`}>
              <line
                x1={CENTER} y1={CENTER} x2={p.x} y2={p.y}
                stroke={done ? s.color : active ? s.color : 'var(--border-grid)'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? '4 6' : done ? '0' : '2 4'}
                opacity={done ? 0.6 : active ? 0.9 : 0.4}
                style={{ filter: active || done ? `drop-shadow(0 0 6px ${s.color})` : 'none' }}
              >
                {active && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0" to="-20" dur="0.8s" repeatCount="indefinite"
                  />
                )}
              </line>
              {/* travelling pulse when running */}
              {active && (
                <circle r="4" fill={s.color} style={{ filter: `drop-shadow(0 0 6px ${s.color})` }}>
                  <animateMotion dur="1.4s" repeatCount="indefinite"
                    path={`M ${CENTER} ${CENTER} L ${p.x} ${p.y}`} />
                </circle>
              )}
            </g>
          );
        })}

        {/* central hub (synthesis) */}
        <g transform={`translate(${CENTER} ${CENTER})`}>
          <circle r={HUB_R + 14} fill="none" stroke="var(--neon-violet)"
            strokeWidth="0.5" strokeDasharray="1 3" opacity="0.5" />
          <motion.circle
            r={HUB_R}
            fill="var(--bg-elevated)"
            stroke="var(--neon-violet)"
            strokeWidth="2"
            animate={{
              filter: synthesisActive
                ? ['drop-shadow(0 0 8px #9B5CFF)', 'drop-shadow(0 0 24px #9B5CFF)', 'drop-shadow(0 0 8px #9B5CFF)']
                : synthesisComplete
                  ? 'drop-shadow(0 0 16px #9B5CFF)'
                  : 'drop-shadow(0 0 4px #9B5CFF)',
            }}
            transition={{ duration: 1.2, repeat: synthesisActive ? Infinity : 0 }}
          />
          {/* inner mechanical detail */}
          <circle r={HUB_R - 12} fill="none" stroke="var(--border-bright)" strokeWidth="1" />
          <circle r={HUB_R - 28} fill="none" stroke="var(--border-grid)" strokeWidth="0.5"
            strokeDasharray="2 2" />
          <text y="-4" textAnchor="middle" className={styles.hubLabel}>SYNTHESIS</text>
          <text y="14" textAnchor="middle" className={styles.hubSub}>[CORE]</text>
        </g>

        {/* satellites */}
        {SATELLITES.map(s => {
          const p = polar(s.angle, ORBIT_R);
          const state = agents[s.name];
          const status = state?.status ?? 'idle';
          return (
            <SatelliteNode key={s.name} sat={s} x={p.x} y={p.y} status={status}
              score={state?.result?.score} />
          );
        })}
      </svg>

      <div className={styles.legend}>
        {SATELLITES.map(s => {
          const state = agents[s.name];
          return (
            <div key={s.name} className={styles.legendItem} style={{ '--c': s.color } as any}>
              <span className={styles.legendDot} data-status={state?.status ?? 'idle'} />
              <span className={styles.legendName}>{s.label}</span>
              <span className={styles.legendStatus}>{(state?.status ?? 'idle').toUpperCase()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SatelliteNode({
  sat, x, y, status, score,
}: {
  sat: Satellite;
  x: number; y: number;
  status: AgentState['status'];
  score?: number;
}) {
  const running = status === 'running';
  const done    = status === 'complete';
  const error   = status === 'error';

  return (
    <motion.g
      transform={`translate(${x} ${y})`}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* outer ring */}
      <motion.circle
        r={SAT_R + 8}
        fill="none"
        stroke={sat.color}
        strokeWidth="0.5"
        opacity={running ? 0.6 : 0.2}
        animate={running ? { scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] } : {}}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      {/* main disc */}
      <motion.circle
        r={SAT_R}
        fill="var(--bg-elevated)"
        stroke={error ? 'var(--neon-red)' : sat.color}
        strokeWidth="2"
        animate={{
          filter: done
            ? `drop-shadow(0 0 12px ${sat.color})`
            : running
              ? [`drop-shadow(0 0 4px ${sat.color})`, `drop-shadow(0 0 16px ${sat.color})`, `drop-shadow(0 0 4px ${sat.color})`]
              : 'none',
        }}
        transition={{ duration: 1.2, repeat: running ? Infinity : 0 }}
      />
      {/* inner mechanical detail */}
      <circle r={SAT_R - 8} fill="none" stroke="var(--border-grid)" strokeWidth="0.5"
        strokeDasharray="2 3" />

      {/* short label */}
      <text y="-8" textAnchor="middle" style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, fill: sat.color,
        letterSpacing: '0.15em', fontWeight: 700,
      }}>{sat.short}</text>

      {/* score or status */}
      <AnimatePresence mode="wait">
        {done && score !== undefined ? (
          <motion.text
            key="score"
            y="14" textAnchor="middle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 14 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 18, fill: 'var(--text-primary)',
              fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            }}
          >{score}</motion.text>
        ) : (
          <motion.text
            key="status"
            y="14" textAnchor="middle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)',
              letterSpacing: '0.1em',
            }}
          >
            {running ? '...' : status === 'idle' ? 'IDLE' : '—'}
          </motion.text>
        )}
      </AnimatePresence>

      {/* status dot */}
      <circle cx={SAT_R - 12} cy={-SAT_R + 12} r={3}
        fill={done ? sat.color : running ? sat.color : 'var(--text-dim)'}
        style={{ filter: (done || running) ? `drop-shadow(0 0 4px ${sat.color})` : 'none' }}>
        {running && (
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        )}
      </circle>
    </motion.g>
  );
}
