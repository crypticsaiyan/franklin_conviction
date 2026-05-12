import styles from './ConvictionScore.module.css';

interface Props {
  score: number;
  token: string;
}

function scoreColor(s: number): string {
  if (s >= 70) return 'var(--green)';
  if (s >= 40) return 'var(--yellow)';
  return 'var(--red)';
}

function scoreLabel(s: number): string {
  if (s >= 80) return 'Strong Buy';
  if (s >= 65) return 'Buy';
  if (s >= 50) return 'Cautious Buy';
  if (s >= 40) return 'Neutral';
  if (s >= 25) return 'Caution';
  return 'Avoid';
}

export function ConvictionScore({ score, token }: Props) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const circumference = 2 * Math.PI * 54;
  const dashoffset = circumference * (1 - score / 100);

  return (
    <div className={styles.wrapper}>
      <div className={styles.left}>
        <div className={styles.ring}>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" strokeWidth="10" />
            <circle
              cx="70" cy="70" r="54"
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
            />
          </svg>
          <div className={styles.ringCenter}>
            <span className={styles.scoreNum} style={{ color }}>{score}</span>
            <span className={styles.scoreMax}>/100</span>
          </div>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.verdict} style={{ color }}>{label}</div>
        <div className={styles.tokenName}>{token.toUpperCase()}</div>
        <div className={styles.meterRow}>
          <span className={styles.meterLabel}>Conviction</span>
          <div className={styles.meter}>
            <div
              className={styles.meterFill}
              style={{ width: `${score}%`, background: color }}
            />
          </div>
          <span className={styles.meterPct}>{score}%</span>
        </div>
      </div>
    </div>
  );
}
