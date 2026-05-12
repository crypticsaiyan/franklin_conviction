import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import styles from './ConvictionGauge.module.css';

interface Props {
  score: number;     // 0-100
  token: string;
  escalated?: boolean;
}

const SIZE = 460;
const CX = SIZE / 2;
const CY = 280;
const R = 180;
const START_ANGLE = -210; // degrees, sweep starts left
const END_ANGLE   = 30;   // sweep ends right
const SWEEP = END_ANGLE - START_ANGLE; // 240deg

function angleForScore(score: number) {
  return START_ANGLE + (score / 100) * SWEEP;
}

function polar(angle: number, r: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r };
}

function arcPath(startA: number, endA: number, r: number) {
  const s = polar(startA, r);
  const e = polar(endA, r);
  const large = endA - startA > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

function bandColor(score: number) {
  if (score >= 75) return 'var(--neon-green)';
  if (score >= 60) return 'var(--neon-cyan)';
  if (score >= 40) return 'var(--neon-amber)';
  if (score >= 25) return 'var(--neon-red)';
  return 'var(--neon-red)';
}

function bandLabel(score: number) {
  if (score >= 80) return 'STRONG BUY';
  if (score >= 65) return 'BUY';
  if (score >= 50) return 'CAUTIOUS BUY';
  if (score >= 40) return 'NEUTRAL';
  if (score >= 25) return 'CAUTION';
  return 'AVOID';
}

export function ConvictionGauge({ score, token, escalated }: Props) {
  const target = Math.max(0, Math.min(100, score));
  const spring = useSpring(0, { stiffness: 60, damping: 18, mass: 1.2 });
  const needleAngle = useTransform(spring, v => angleForScore(v));
  const displayScore = useTransform(spring, v => Math.round(v));

  useEffect(() => { spring.set(target); }, [target, spring]);

  const color = bandColor(target);
  const label = bandLabel(target);

  // tick marks every 5 score points
  const ticks = Array.from({ length: 21 }, (_, i) => {
    const score = i * 5;
    const a = angleForScore(score);
    const major = i % 4 === 0; // every 20 score points
    const r1 = R - (major ? 18 : 10);
    const r2 = R - 2;
    const p1 = polar(a, r1);
    const p2 = polar(a, r2);
    return { score, a, p1, p2, major };
  });

  return (
    <div className={styles.container} style={{ '--score-color': color } as any}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>// CONVICTION_GAUGE</span>
        <span className={styles.headerToken}>{token.toUpperCase()}</span>
      </div>

      <div className={styles.gaugeWrap}>
        <svg viewBox={`0 0 ${SIZE} 340`} className={styles.svg} aria-label={`Conviction score ${target} of 100`}>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#FF2A55" />
              <stop offset="35%"  stopColor="#FFB300" />
              <stop offset="60%"  stopColor="#00FFFF" />
              <stop offset="100%" stopColor="#00FF85" />
            </linearGradient>
            <filter id="needleGlow">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* outer mechanical bezel */}
          <path
            d={arcPath(START_ANGLE - 4, END_ANGLE + 4, R + 22)}
            fill="none" stroke="var(--border-bright)" strokeWidth="1"
          />
          <path
            d={arcPath(START_ANGLE - 2, END_ANGLE + 2, R + 14)}
            fill="none" stroke="var(--border-grid)" strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* gauge track background */}
          <path
            d={arcPath(START_ANGLE, END_ANGLE, R)}
            fill="none" stroke="var(--bg-inset)" strokeWidth="22"
            strokeLinecap="butt"
          />

          {/* gauge filled spectrum (always visible underneath) */}
          <path
            d={arcPath(START_ANGLE, END_ANGLE, R)}
            fill="none" stroke="url(#gaugeGrad)" strokeWidth="22"
            strokeLinecap="butt" opacity="0.18"
          />

          {/* animated fill to current score */}
          <motion.path
            d={arcPath(START_ANGLE, END_ANGLE, R)}
            fill="none" stroke="url(#gaugeGrad)" strokeWidth="22"
            strokeLinecap="butt"
            pathLength="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: target / 100 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}
          />

          {/* tick marks */}
          {ticks.map(t => (
            <line key={t.score}
              x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y}
              stroke={t.major ? 'var(--text-muted)' : 'var(--border-bright)'}
              strokeWidth={t.major ? 1.5 : 0.8}
            />
          ))}

          {/* tick labels (every 20) */}
          {[0, 20, 40, 60, 80, 100].map(s => {
            const a = angleForScore(s);
            const p = polar(a, R - 32);
            return (
              <text key={s} x={p.x} y={p.y + 4} textAnchor="middle"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  fill: 'var(--text-muted)', letterSpacing: '0.05em',
                }}
              >{s}</text>
            );
          })}

          {/* band labels along arc */}
          {[
            { s: 12, t: 'AVOID',    c: 'var(--neon-red)' },
            { s: 32, t: 'CAUTION',  c: 'var(--neon-red)' },
            { s: 50, t: 'NEUTRAL',  c: 'var(--neon-amber)' },
            { s: 68, t: 'BUY',      c: 'var(--neon-cyan)' },
            { s: 88, t: 'STRONG',   c: 'var(--neon-green)' },
          ].map(b => {
            const a = angleForScore(b.s);
            const p = polar(a, R + 36);
            return (
              <text key={b.t} x={p.x} y={p.y + 3} textAnchor="middle"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  fill: b.c, letterSpacing: '0.18em', fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >{b.t}</text>
            );
          })}

          {/* needle */}
          <motion.g
            style={{ rotate: needleAngle, transformOrigin: `${CX}px ${CY}px` }}
          >
            <line x1={CX} y1={CY} x2={CX + R - 12} y2={CY}
              stroke={color} strokeWidth="3" strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
            <line x1={CX} y1={CY} x2={CX + R - 12} y2={CY}
              stroke="rgba(255,255,255,0.7)" strokeWidth="1"
            />
            <polygon
              points={`${CX + R - 18},${CY - 6} ${CX + R - 2},${CY} ${CX + R - 18},${CY + 6}`}
              fill={color}
              style={{ filter: `drop-shadow(0 0 8px ${color})` }}
            />
            <line x1={CX} y1={CY} x2={CX - 30} y2={CY}
              stroke={color} strokeWidth="2" opacity="0.5"
            />
          </motion.g>

          {/* center hub — mechanical pivot */}
          <circle cx={CX} cy={CY} r="22" fill="var(--bg-elevated)"
            stroke="var(--border-bright)" strokeWidth="1.5" />
          <circle cx={CX} cy={CY} r="14" fill="var(--bg-base)"
            stroke={color} strokeWidth="2"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          <circle cx={CX} cy={CY} r="4" fill={color} />
          {/* mechanical screws */}
          {[45, 135, 225, 315].map(a => {
            const p = polar(a, 18);
            return <circle key={a} cx={p.x} cy={p.y} r="1.2" fill="var(--text-dim)" />;
          })}

          {/* digital readout above hub */}
          <motion.text
            x={CX} y={CY - 50} textAnchor="middle"
            style={{
              fontFamily: 'var(--font-display)', fontSize: 72,
              fontWeight: 800, letterSpacing: '-0.06em',
              fill: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayScore}
          </motion.text>
          <text x={CX} y={CY - 18} textAnchor="middle"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              fill: 'var(--text-muted)', letterSpacing: '0.25em',
            }}
          >/ 100</text>
        </svg>

        {/* status banner */}
        <div className={styles.banner}>
          <span className={styles.bannerMarker} style={{ background: color }} />
          <span className={styles.bannerLabel}>{label}</span>
          {escalated && <span className={styles.escTag}>ARBITRATED</span>}
        </div>
      </div>
    </div>
  );
}
